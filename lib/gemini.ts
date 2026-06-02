import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GarmentType } from "./garments";

const MODEL = "gemini-2.5-flash-image";
const MAX_IMAGE_BYTES = 7 * 1024 * 1024; // keep well under the 20MB request cap

export interface ImageInput {
  data: string; // base64, no data-URL prefix
  mimeType: string;
}

export interface OutfitGarment {
  imageUrl: string; // remote URL or data URL
  type: GarmentType;
  label: string;
}

export interface OutfitResult {
  image: string; // data URL
  usage: {
    /** Number of Gemini requests made — one per garment. This is what rate limits count. */
    requests: number;
    /** Total tokens billed across all requests (sum of usageMetadata), 0 if unreported. */
    totalTokens: number;
    /** True when produced by mock mode rather than a real API call. */
    mocked: boolean;
  };
}

const TOKENS_PER_IMAGE = 1290; // each generated image ≈ 1290 output tokens (per Google pricing)

function isMock(): boolean {
  return process.env.MOCK_TRYON === "1" || !process.env.GEMINI_API_KEY;
}

/** Load an image (data URL, http(s) URL, or bundled public/ path) into inline base64. */
export async function loadImage(src: string): Promise<ImageInput> {
  if (src.startsWith("data:")) {
    const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(src);
    if (!match) throw new Error("Malformed image data.");
    return { mimeType: match[1], data: match[2] };
  }
  if (src.startsWith("/")) {
    // Bundled asset under public/
    const filePath = path.join(process.cwd(), "public", src.replace(/^\//, ""));
    const buf = await readFile(filePath);
    return { mimeType: guessMime(src), data: buf.toString("base64") };
  }
  const res = await fetch(src, { redirect: "follow" });
  if (!res.ok) throw new Error(`Couldn't download the garment image (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("That image is too large. Try a smaller one.");
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0] || guessMime(src);
  if (!mimeType.startsWith("image/")) {
    throw new Error("That URL didn't point to an image.");
  }
  return { mimeType, data: buf.toString("base64") };
}

function guessMime(src: string): string {
  const ext = src.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}

function promptFor(type: GarmentType, label: string): string {
  const article: Record<GarmentType, string> = {
    top: "top / shirt",
    bottom: "pair of bottoms (pants/skirt)",
    dress: "dress",
    jacket: "jacket / outerwear, layered on top of any existing clothing",
    tie: "necktie, worn over the shirt",
    shoes: "pair of shoes",
    accessory: "accessory",
  };
  return [
    `You are a virtual try-on tool. The first image is a person.`,
    `The second image is a ${article[type]}${label ? ` ("${label}")` : ""}.`,
    `Edit the first image so the person is realistically wearing that ${type}, fitted to their body and pose and layered correctly over anything they already wear.`,
    `Keep the exact same person, face, body, pose, camera framing, lighting, and plain background.`,
    `Output a single photorealistic image only.`,
  ].join(" ");
}

/** Extract the first inline image returned by the model. */
function imageFromResponse(response: {
  candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
}): ImageInput | null {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      return { data: inline.data, mimeType: inline.mimeType || "image/png" };
    }
  }
  return null;
}

function toDataUrl(img: ImageInput): string {
  return `data:${img.mimeType};base64,${img.data}`;
}

/** Turn raw Gemini SDK errors into user-facing messages, flagging billing/quota issues. */
function translateGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const status =
    (typeof err === "object" && err && "status" in err ? String((err as { status: unknown }).status) : "") || "";
  const haystack = `${status} ${raw}`.toLowerCase();

  // The image model has no free tier (limit: 0), so a 429 almost always means
  // billing isn't enabled rather than a transient burst limit.
  if (
    haystack.includes("429") ||
    haystack.includes("resource_exhausted") ||
    haystack.includes("quota") ||
    haystack.includes("billing")
  ) {
    return new Error(
      "BILLING_REQUIRED: Gemini 2.5 Flash Image has no free tier, so this request was rejected for quota. " +
        "Enable billing on your Google AI Studio / Cloud project to generate real images (~$0.039 per image).",
    );
  }
  if (haystack.includes("api key") || haystack.includes("permission") || haystack.includes("401") || haystack.includes("403")) {
    return new Error("Your Gemini API key was rejected. Double-check GEMINI_API_KEY is a valid AI Studio key.");
  }
  return new Error(`The image model failed: ${raw}`);
}

/**
 * Iteratively dress the base model in each garment, one Gemini call per item,
 * feeding the running composite forward so layers stack correctly.
 * Garments are expected to be pre-sorted into layer order by the caller.
 * Returns a data URL for the final composite.
 */
export async function composeOutfit(
  baseModelSrc: string,
  garments: OutfitGarment[],
): Promise<OutfitResult> {
  if (isMock()) {
    return {
      image: toDataUrl(await loadImage("/sample-composite.svg")),
      usage: {
        requests: garments.length,
        totalTokens: garments.length * TOKENS_PER_IMAGE, // estimate; no real call made
        mocked: true,
      },
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  let current = await loadImage(baseModelSrc);
  let totalTokens = 0;

  for (const garment of garments) {
    const garmentImg = await loadImage(garment.imageUrl);
    let response;
    try {
      response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: promptFor(garment.type, garment.label) },
              { inlineData: { mimeType: current.mimeType, data: current.data } },
              { inlineData: { mimeType: garmentImg.mimeType, data: garmentImg.data } },
            ],
          },
        ],
      });
    } catch (err) {
      throw translateGeminiError(err);
    }
    totalTokens += response.usageMetadata?.totalTokenCount ?? 0;
    const next = imageFromResponse(response);
    if (!next) {
      throw new Error(`The model didn't return an image for "${garment.label || garment.type}".`);
    }
    current = next;
  }

  return {
    image: toDataUrl(current),
    usage: { requests: garments.length, totalTokens, mocked: false },
  };
}
