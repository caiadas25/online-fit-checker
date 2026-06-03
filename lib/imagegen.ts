import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODE_LABELS,
  type GenerationMode,
} from "./generation-modes";
import type { GarmentType } from "./garments";
import { IMAGE_GENERATION_SYSTEM_PROMPT } from "./image-prompts";
import { MODEL_KEYS, MODEL_LABELS, type ModelKey } from "./model-options";
import {
  buildCutoutCompositionPrompt,
  buildGarmentCutoutPrompt,
  buildOutfitPrompt,
} from "./outfit-prompt";

export { MODEL_KEYS, type ModelKey };

const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Map each model key to its OpenRouter model ID and output modalities.
const OPENROUTER_MODELS: Record<ModelKey, { id: string; modalities: string[] }> = {
  gemini: { id: "google/gemini-2.5-flash-image", modalities: ["image", "text"] },
  "nano-banana-2": {
    id: "google/gemini-3.1-flash-image-preview",
    modalities: ["image", "text"],
  },
};

type OpenRouterModelConfig = (typeof OPENROUTER_MODELS)[ModelKey];
type ImageContent = { type: string; text?: string; image_url?: { url: string } };
type ImageUsage = { totalTokens: number; costUsd: number | null };
type GeneratedGarmentCutout = {
  type: GarmentType;
  label: string;
  image: string;
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
    generationMode: GenerationMode;
    generationModeLabel: string;
  };
  preprocessedGarments?: GeneratedGarmentCutout[];
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

function addUsage(a: ImageUsage, b: ImageUsage): ImageUsage {
  return {
    totalTokens: a.totalTokens + b.totalTokens,
    costUsd: a.costUsd == null || b.costUsd == null ? null : a.costUsd + b.costUsd,
  };
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

async function generateImage(
  apiKey: string,
  modelCfg: OpenRouterModelConfig,
  modelLabel: string,
  content: ImageContent[],
): Promise<{ image: string; usage: ImageUsage }> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "FitMashr",
    },
    body: JSON.stringify({
      model: modelCfg.id,
      modalities: modelCfg.modalities,
      usage: { include: true },
      messages: [
        { role: "system", content: IMAGE_GENERATION_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    throw translateError(res.status, await res.text());
  }
  const data = await res.json();
  const usage = data.usage as { total_tokens?: number; cost?: number } | undefined;

  const next = imageFromResponse(data);
  if (!next) {
    const said = textFromResponse(data);
    throw new Error(
      `${modelLabel} returned no image.` +
        (said ? ` Model said: "${said.slice(0, 240)}"` : " Try a different model or regenerate."),
    );
  }

  return {
    image: next.startsWith("data:") ? next : toDataUrl(await loadImage(next)),
    usage: {
      totalTokens: usage?.total_tokens ?? 0,
      costUsd: typeof usage?.cost === "number" ? usage.cost : null,
    },
  };
}

async function composeSinglePass(
  apiKey: string,
  modelCfg: OpenRouterModelConfig,
  modelLabel: string,
  baseModelSrc: string,
  garments: OutfitGarment[],
  hasBaseImage: boolean,
): Promise<{ image: string; usage: ImageUsage }> {
  const garmentImgs = await Promise.all(garments.map((g) => loadImage(g.imageUrl)));
  const content: ImageContent[] = [
    { type: "text", text: buildOutfitPrompt(garments, hasBaseImage) },
  ];

  if (hasBaseImage) {
    content.push({ type: "image_url", image_url: { url: toDataUrl(await loadImage(baseModelSrc)) } });
  }
  for (const img of garmentImgs) {
    content.push({ type: "image_url", image_url: { url: toDataUrl(img) } });
  }

  return generateImage(apiKey, modelCfg, modelLabel, content);
}

async function preprocessGarment(
  apiKey: string,
  modelCfg: OpenRouterModelConfig,
  modelLabel: string,
  garment: OutfitGarment,
): Promise<{ image: string; usage: ImageUsage }> {
  const img = await loadImage(garment.imageUrl);
  return generateImage(apiKey, modelCfg, modelLabel, [
    { type: "text", text: buildGarmentCutoutPrompt(garment) },
    { type: "image_url", image_url: { url: toDataUrl(img) } },
  ]);
}

async function composePreprocessed(
  apiKey: string,
  modelCfg: OpenRouterModelConfig,
  modelLabel: string,
  baseModelSrc: string,
  garments: OutfitGarment[],
  hasBaseImage: boolean,
): Promise<{
  image: string;
  usage: ImageUsage;
  preprocessedGarments: GeneratedGarmentCutout[];
}> {
  let usage: ImageUsage = { totalTokens: 0, costUsd: 0 };
  const preprocessedGarments = [];

  for (const garment of garments) {
    const cutout = await preprocessGarment(apiKey, modelCfg, modelLabel, garment);
    usage = addUsage(usage, cutout.usage);
    preprocessedGarments.push({
      type: garment.type,
      label: garment.label,
      image: cutout.image,
    });
  }

  const content: ImageContent[] = [
    { type: "text", text: buildCutoutCompositionPrompt(garments, hasBaseImage) },
  ];
  if (hasBaseImage) {
    content.push({ type: "image_url", image_url: { url: toDataUrl(await loadImage(baseModelSrc)) } });
  }
  for (const garment of preprocessedGarments) {
    content.push({ type: "image_url", image_url: { url: garment.image } });
  }

  const final = await generateImage(apiKey, modelCfg, modelLabel, content);

  return {
    image: final.image,
    usage: addUsage(usage, final.usage),
    preprocessedGarments,
  };
}

/**
 * Compose the whole outfit in a SINGLE request: the model receives every garment
 * image at once (plus an optional base photo) and renders one full-body figure
 * wearing all of them. This avoids the drift/cropping/lost-layers problems of
 * editing one garment at a time. Garments are pre-sorted innermost→outermost.
 */
export async function composeOutfit(
  baseModelSrc: string,
  garments: OutfitGarment[],
  modelKey: ModelKey,
  generationMode: GenerationMode = DEFAULT_GENERATION_MODE,
): Promise<OutfitResult> {
  const modelCfg = OPENROUTER_MODELS[modelKey] ?? OPENROUTER_MODELS.gemini;
  const modelLabel = MODEL_LABELS[modelKey] ?? MODEL_LABELS.gemini;
  const generationModeLabel = GENERATION_MODE_LABELS[generationMode];
  const requests = generationMode === "preprocessed" ? garments.length + 1 : 1;

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is required for image generation. Add it to .env.local and restart the dev server.",
    );
  }

  // A real uploaded/linked photo is an image source; the "mannequin" sentinel is not.
  const hasBaseImage = /^(data:|https?:|\/)/.test(baseModelSrc);

  if (generationMode === "preprocessed") {
    const result = await composePreprocessed(
      apiKey,
      modelCfg,
      modelLabel,
      baseModelSrc,
      garments,
      hasBaseImage,
    );

    return {
      image: result.image,
      preprocessedGarments: result.preprocessedGarments,
      usage: {
        requests,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.costUsd,
        model: modelKey,
        modelLabel,
        generationMode,
        generationModeLabel,
      },
    };
  }

  const result = await composeSinglePass(
    apiKey,
    modelCfg,
    modelLabel,
    baseModelSrc,
    garments,
    hasBaseImage,
  );

  return {
    image: result.image,
    usage: {
      requests,
      totalTokens: result.usage.totalTokens,
      costUsd: result.usage.costUsd,
      model: modelKey,
      modelLabel,
      generationMode,
      generationModeLabel,
    },
  };
}
