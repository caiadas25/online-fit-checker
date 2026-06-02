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
  bottom: "bottoms (pants/skirt)",
  dress: "dress",
  jacket: "jacket / outerwear (outermost layer)",
  tie: "necktie (worn over the shirt)",
  shoes: "shoes",
  accessory: "accessory",
};

/**
 * Build one prompt that composes the whole outfit in a single request.
 * `garments` are pre-sorted innermost→outermost. We deliberately do NOT include
 * the scraped store title (it caused models to render that text into the image),
 * and we reference each garment by its image position.
 */
function buildOutfitPrompt(garments: OutfitGarment[], hasBaseImage: boolean): string {
  // Image index where the garments start (1-based, after an optional base photo).
  const offset = hasBaseImage ? 2 : 1;
  const lines = garments.map((g, i) => `Image ${i + offset} is the ${ARTICLE[g.type]}.`);

  const subject = hasBaseImage
    ? "The first image shows a person. Keep their exact face, body, hair, and skin, and use a plain studio background."
    : "Render a single neutral, faceless, light-gray full-body display mannequin standing front-facing on a seamless light-gray studio background.";

  return [
    subject,
    `The remaining ${garments.length} image(s) are the garments to put on, listed from innermost to outermost layer:`,
    lines.join(" "),
    `Dress the figure in ALL of these garments together as one complete, coherent outfit, layered naturally in that order (e.g. shirts under jackets, ties over shirts).`,
    `Reproduce each garment exactly as shown in its image — identical colour, wash, pattern, texture, cut, and length. Do not substitute, restyle, or recolour them.`,
    `Show the entire figure from head to feet, centred and full-length — do not crop or zoom in on one garment.`,
    `Do NOT add any text, captions, labels, logos, price tags, or watermarks anywhere in the image.`,
    `Output only the final composed image.`,
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
