import type { GarmentType } from "./garments";

export const GENERATION_MODES = ["single-pass", "preprocessed"] as const;

export type GenerationMode = (typeof GENERATION_MODES)[number];

export const GENERATION_MODE_LABELS: Record<GenerationMode, string> = {
  "single-pass": "Single pass",
  preprocessed: "Preprocessed cutouts",
};

export const DEFAULT_GENERATION_MODE: GenerationMode = "single-pass";

export function resolveGenerationMode(
  garments: { type: GarmentType }[],
  requestedMode: GenerationMode = DEFAULT_GENERATION_MODE,
): GenerationMode {
  return garments.some((garment) => garment.type === "jacket")
    ? "preprocessed"
    : requestedMode;
}
