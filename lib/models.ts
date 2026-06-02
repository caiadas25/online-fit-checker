// Bundled base models the user can dress. These ship as stylized silhouette
// placeholders; for the most realistic AI try-on, users can upload a real
// front-facing photo of a person on a plain background instead.

export interface BaseModel {
  id: string;
  label: string;
  src: string; // path under public/
}

export const BASE_MODELS: BaseModel[] = [
  { id: "neutral-a", label: "Mannequin A", src: "/models/mannequin-a.svg" },
  { id: "neutral-b", label: "Mannequin B", src: "/models/mannequin-b.svg" },
];

export const DEFAULT_BASE_MODEL = BASE_MODELS[0].src;
