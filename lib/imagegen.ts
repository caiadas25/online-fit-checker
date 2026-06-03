import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GarmentType } from "./garments";
import { IMAGE_GENERATION_SYSTEM_PROMPT } from "./image-prompts";
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
  bottom: "bottoms (pants/skirt)",
  dress: "dress",
  jacket: "jacket / outerwear",
  tie: "necktie",
  shoes: "shoes",
  accessory: "accessory",
  hat: "hat / headwear",
};

/**
 * Build one prompt that composes the whole outfit in a single request.
 *
 * Reference photos are e-commerce HERO shots: a real model wearing the target
 * item ALONGSIDE other clothing, page text, and unrelated overlays. The model must
 * extract ONLY the named garment from each photo and ignore everything else.
 * `garments` are pre-sorted innermost→outermost.
 *
 * Restructured as numbered steps with strong extraction language to improve
 * adherence on weaker image models (Gemini Flash, etc.).
 */
function buildOutfitPrompt(garments: OutfitGarment[], hasBaseImage: boolean): string {
  const offset = hasBaseImage ? 2 : 1;

  const subject = hasBaseImage
    ? "The first image shows the target person. Keep their exact face, body, hair, and skin, on a plain light-gray studio background."
    : "Generate one neutral, faceless, light-gray full-body mannequin standing front-facing on a seamless light-gray studio background. The mannequin should be slim, average height, with no facial features.";

  const extractionSteps = garments.map(
    (g, i) =>
      `Step ${i + 2}: From image ${i + offset}, extract ONLY the ${ARTICLE[g.type]}. Ignore the person, all other clothing, shoes, accessories, page UI, measurement labels, price tags, captions, and watermarks. Copy the garment's exact colour, fabric, cut, length, collar style, sleeve length, stitching, buttons, seams, trims, pattern, print, embroidery, patches, and any logo or lettering physically attached to the garment. If the garment is pink, it stays pink. If it is denim, it stays denim. Do not simplify, change, or restyle it.`,
  );

  return [
    subject,
    `You are given ${garments.length + (hasBaseImage ? 1 : 0)} image(s). Images ${Array.from({ length: garments.length }, (_, i) => i + offset).join(", ")} are reference photos of individual garments on models. Each photo shows many items — you must extract ONLY the one named below from each.`,
    "EXTRACTION STEPS (follow in order):",
    ...extractionSteps,
    `Step ${garments.length + 2}: Compose the extracted garments onto the mannequin as ONE outfit, layered from innermost to outermost in the order listed. Shirts go under jackets. Ties go over shirts. Bottoms sit at the waist.`,
    `CRITICAL — Match each garment EXACTLY: same colour (do not recolour), same fabric texture, same cut, same length, same collar/sleeve style, same stitching, same trims, same patterns, and same garment-native logos or lettering when present. A pink polo shirt must appear as a pink polo, NOT a blue V-neck. A dark denim jacket must appear as a dark denim jacket, NOT disappear.`,
    "Show the ENTIRE figure from head to feet, centred, full-length. Do not crop or zoom in.",
    "Do NOT render unrelated text, captions, product labels, price tags, size labels, measurements, signatures, UI, or watermarks. Logos or text are allowed only when they are physically part of the target garment, and then they should be preserved faithfully.",
    "Output only the final composed image.",
  ].join("\n\n");
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
 * Compose the whole outfit in a SINGLE request: the model receives every garment
 * image at once (plus an optional base photo) and renders one full-body figure
 * wearing all of them. This avoids the drift/cropping/lost-layers problems of
 * editing one garment at a time. Garments are pre-sorted innermost→outermost.
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
      usage: { requests: 1, totalTokens: 0, costUsd: 0, model: modelKey, modelLabel, mocked: true },
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY!;
  // A real uploaded/linked photo is an image source; the "mannequin" sentinel is not.
  const hasBaseImage = /^(data:|https?:|\/)/.test(baseModelSrc);

  // Load all images up front (base first, then garments in layer order).
  const garmentImgs = await Promise.all(garments.map((g) => loadImage(g.imageUrl)));

  const content: { type: string; text?: string; image_url?: { url: string } }[] = [
    { type: "text", text: buildOutfitPrompt(garments, hasBaseImage) },
  ];
  if (hasBaseImage) {
    content.push({ type: "image_url", image_url: { url: toDataUrl(await loadImage(baseModelSrc)) } });
  }
  for (const img of garmentImgs) {
    content.push({ type: "image_url", image_url: { url: toDataUrl(img) } });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Lookloop",
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
  // Normalize to a self-contained data URL (so it downloads reliably).
  const image = next.startsWith("data:") ? next : toDataUrl(await loadImage(next));

  return {
    image,
    usage: {
      requests: 1,
      totalTokens: usage?.total_tokens ?? 0,
      costUsd: typeof usage?.cost === "number" ? usage.cost : null,
      model: modelKey,
      modelLabel,
      mocked: false,
    },
  };
}
