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

/**
 * Iteratively dress the base model in each garment, one Gemini call per item,
 * feeding the running composite forward so layers stack correctly.
 * Garments are expected to be pre-sorted into layer order by the caller.
 * Returns a data URL for the final composite.
 */
export async function composeOutfit(
  baseModelSrc: string,
  garments: OutfitGarment[],
): Promise<string> {
  if (isMock()) {
    return toDataUrl(await loadImage("/sample-composite.svg"));
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  let current = await loadImage(baseModelSrc);

  for (const garment of garments) {
    const garmentImg = await loadImage(garment.imageUrl);
    const response = await ai.models.generateContent({
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
    const next = imageFromResponse(response);
    if (!next) {
      throw new Error(`The model didn't return an image for "${garment.label || garment.type}".`);
    }
    current = next;
  }

  return toDataUrl(current);
}
