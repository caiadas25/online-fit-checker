import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GarmentType } from "./garments";
import { MODEL_KEYS, MODEL_LABELS, type ModelKey } from "./model-options";

export { MODEL_KEYS, type ModelKey };

const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Map each model key to its OpenRouter model ID and the output modalities its
// endpoint actually supports (Seedream is image-only; requesting "text" too 404s).
const OPENROUTER_MODELS: Record<ModelKey, { id: string; modalities: string[] }> = {
  gemini: { id: "google/gemini-2.5-flash-image", modalities: ["image", "text"] },
  gpt: { id: "openai/gpt-5-image", modalities: ["image", "text"] },
  seedream: { id: "bytedance-seed/seedream-4.5", modalities: ["image"] },
};

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
    /** Image requests made — one per garment. */
    requests: number;
    /** Total tokens billed across all requests, 0 if unreported. */
    totalTokens: number;
    /** Actual USD cost reported by OpenRouter, or null if unavailable. */
    costUsd: number | null;
    /** Which model produced the result. */
    model: ModelKey;
    modelLabel: string;
    /** True when produced by mock mode rather than a real API call. */
    mocked: boolean;
  };
}

function isMock(): boolean {
  return process.env.MOCK_TRYON === "1" || !process.env.OPENROUTER_API_KEY;
}

/** Load an image (data URL, http(s) URL, or bundled public/ path) into inline base64. */
export async function loadImage(src: string): Promise<ImageInput> {
  if (src.startsWith("data:")) {
    const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(src);
    if (!match) throw new Error("Malformed image data.");
    return { mimeType: match[1], data: match[2] };
  }
  if (src.startsWith("/")) {
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

function toDataUrl(img: ImageInput): string {
  return `data:${img.mimeType};base64,${img.data}`;
}

const ARTICLE: Record<GarmentType, string> = {
  top: "top / shirt",
  bottom: "pair of bottoms (pants/skirt)",
  dress: "dress",
  jacket: "jacket / outerwear, layered on top of any existing clothing",
  tie: "necktie, worn over the shirt",
  shoes: "pair of shoes",
  accessory: "accessory",
};

function describe(type: GarmentType, label: string): string {
  return `${ARTICLE[type]}${label ? ` ("${label}")` : ""}`;
}

/** First step when there's no base image: create a mannequin already wearing the garment. */
function createOnMannequinPrompt(type: GarmentType, label: string): string {
  return [
    `Generate a single photorealistic, full-length image of a plain, faceless, neutral light-gray display mannequin standing front-facing on a seamless studio background.`,
    `The image provided is a ${describe(type, label)}.`,
    `Dress the mannequin in that ${type}, fitted naturally to its body. Show the full figure from head to feet.`,
    `Output only the image.`,
  ].join(" ");
}

/** Subsequent steps: layer the next garment onto the current composite. */
function layerPrompt(type: GarmentType, label: string): string {
  return [
    `The first image shows a mannequin (it may already be wearing some clothing).`,
    `The second image is a ${describe(type, label)}.`,
    `Edit the first image so the same mannequin also wears that ${type}, fitted to its body and layered correctly over anything it already wears.`,
    `Keep the exact same mannequin, pose, camera framing, lighting, and plain background.`,
    `Output only the edited image.`,
  ].join(" ");
}

function isImageUrl(url: unknown): url is string {
  return typeof url === "string" && (url.startsWith("data:") || /^https?:/.test(url));
}

/** Pull the first generated image URL (data: or http) out of an OpenRouter response. */
function imageFromResponse(data: unknown): string | null {
  const msg = (data as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]?.message;
  if (!msg) return null;
  const images = msg.images as ({ image_url?: { url?: string }; url?: string } | string)[] | undefined;
  if (Array.isArray(images)) {
    for (const im of images) {
      if (isImageUrl(im)) return im;
      const url = (im as { image_url?: { url?: string }; url?: string })?.image_url?.url ?? (im as { url?: string })?.url;
      if (isImageUrl(url)) return url;
    }
  }
  // Fallback: some models return image parts inside content.
  const content = msg.content;
  if (Array.isArray(content)) {
    for (const part of content as { image_url?: { url?: string } }[]) {
      if (isImageUrl(part?.image_url?.url)) return part.image_url!.url!;
    }
  }
  return null;
}

/** Any assistant text in the response — used to explain why no image came back. */
function textFromResponse(data: unknown): string {
  const msg = (data as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]?.message;
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return (msg.content as { text?: string }[])
      .map((p) => p?.text ?? "")
      .join(" ")
      .trim();
  }
  return "";
}

/** Map OpenRouter HTTP errors to clear, user-facing messages. */
function translateError(status: number, body: string): Error {
  const text = body.toLowerCase();
  if (status === 401 || status === 403) {
    return new Error("Your OpenRouter API key was rejected. Check OPENROUTER_API_KEY.");
  }
  if (status === 402 || text.includes("insufficient") || text.includes("credit")) {
    return new Error(
      "BILLING_REQUIRED: Your OpenRouter account is out of credits for this model. Top up your OpenRouter balance to keep generating.",
    );
  }
  if (status === 429) {
    return new Error("Rate limited by OpenRouter — wait a moment and try again.");
  }
  return new Error(`The image model failed (${status}): ${body.slice(0, 200)}`);
}

/**
 * Iteratively dress the base model in each garment via the chosen OpenRouter image model,
 * one request per garment, feeding the running composite forward so layers stack correctly.
 * Garments are expected to be pre-sorted into layer order by the caller.
 */
export async function composeOutfit(
  baseModelSrc: string,
  garments: OutfitGarment[],
  modelKey: ModelKey,
): Promise<OutfitResult> {
  const modelCfg = OPENROUTER_MODELS[modelKey] ?? OPENROUTER_MODELS.gemini;
  const modelLabel = MODEL_LABELS[modelKey] ?? MODEL_LABELS.gemini;

  if (isMock()) {
    return {
      image: toDataUrl(await loadImage("/sample-composite.svg")),
      usage: {
        requests: garments.length,
        totalTokens: 0,
        costUsd: 0,
        model: modelKey,
        modelLabel,
        mocked: true,
      },
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY!;
  // A real photo base is an image source; the default "mannequin" sentinel is not,
  // so we ask the model to invent the mannequin from the first garment instead.
  const hasBaseImage = /^(data:|https?:|\/)/.test(baseModelSrc);
  let currentDataUrl: string | null = hasBaseImage
    ? toDataUrl(await loadImage(baseModelSrc))
    : null;
  let totalTokens = 0;
  let costUsd = 0;
  let costSeen = false;

  for (const garment of garments) {
    const garmentImg = await loadImage(garment.imageUrl);

    // No current image yet (default mannequin, first garment): generate the
    // mannequin wearing this garment from text + the garment image alone.
    const content =
      currentDataUrl === null
        ? [
            { type: "text", text: createOnMannequinPrompt(garment.type, garment.label) },
            { type: "image_url", image_url: { url: toDataUrl(garmentImg) } },
          ]
        : [
            { type: "text", text: layerPrompt(garment.type, garment.label) },
            { type: "image_url", image_url: { url: currentDataUrl } },
            { type: "image_url", image_url: { url: toDataUrl(garmentImg) } },
          ];

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Online Fit Checker",
      },
      body: JSON.stringify({
        model: modelCfg.id,
        modalities: modelCfg.modalities,
        usage: { include: true },
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      throw translateError(res.status, await res.text());
    }
    const data = await res.json();
    const usage = data.usage as { total_tokens?: number; cost?: number } | undefined;
    totalTokens += usage?.total_tokens ?? 0;
    if (typeof usage?.cost === "number") {
      costUsd += usage.cost;
      costSeen = true;
    }
    const next = imageFromResponse(data);
    if (!next) {
      const said = textFromResponse(data);
      throw new Error(
        `${modelLabel} returned no image for "${garment.label || garment.type}".` +
          (said ? ` Model said: "${said.slice(0, 240)}"` : " Try a different model or regenerate."),
      );
    }
    // Normalize to a self-contained data URL (so it downloads and feeds forward reliably).
    currentDataUrl = next.startsWith("data:") ? next : toDataUrl(await loadImage(next));
  }

  if (currentDataUrl === null) {
    throw new Error("Add at least one garment to generate an outfit.");
  }

  return {
    image: currentDataUrl,
    usage: {
      requests: garments.length,
      totalTokens,
      costUsd: costSeen ? costUsd : null,
      model: modelKey,
      modelLabel,
      mocked: false,
    },
  };
}
