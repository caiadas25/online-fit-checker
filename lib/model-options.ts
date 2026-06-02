// Client-safe model metadata (no Node-only imports), shared by the UI and server.
// The server (lib/imagegen.ts) maps these keys to OpenRouter model IDs.

export const MODEL_OPTIONS = [
  { key: "gemini", label: "Gemini", sub: "2.5 Flash Image" },
  { key: "gpt", label: "GPT", sub: "GPT-5 Image" },
  { key: "seedream", label: "Seedream", sub: "4.5 Edit" },
] as const;

export type ModelKey = (typeof MODEL_OPTIONS)[number]["key"];

export const MODEL_KEYS = MODEL_OPTIONS.map((o) => o.key) as ModelKey[];

export const MODEL_LABELS: Record<ModelKey, string> = Object.fromEntries(
  MODEL_OPTIONS.map((o) => [o.key, `${o.label} (${o.sub})`]),
) as Record<ModelKey, string>;
