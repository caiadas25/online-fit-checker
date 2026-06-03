"use client";

import { sortByLayer, type Garment, type GarmentType } from "@/lib/garments";

interface Props {
  garments: Garment[];
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

function buildOutfitPrompt(garments: Garment[]): string {
  const offset = 1; // mannequin, no base image
  const lines = garments.map(
    (g, i) =>
      `From image ${i + offset}, take ONLY the ${ARTICLE[g.type]} — ignore the model and any other clothing, footwear, or accessories they are wearing in that photo.`,
  );

  return [
    "Render one neutral, faceless, light-gray full-body display mannequin standing front-facing on a seamless light-gray studio background.",
    `You are given ${garments.length} reference photo(s). Each one shows a real model wearing one target garment, usually together with other clothes, brand logos, and size/height text — all of which must be IGNORED.`,
    lines.join(" "),
    "Dress the figure in exactly those extracted garments as one coherent outfit, layered innermost→outermost in the order listed (e.g. shirts under jackets, ties over shirts).",
    "Match each extracted garment precisely: same colour, pattern, knit/weave, fabric, cut, and length as in its photo. Do not restyle or recolour it, and do not copy any garment that wasn't named.",
    "Show the entire figure from head to feet, centred and full-length — do not crop or zoom in.",
    "Do NOT render any text, captions, size labels, brand logos, price tags, or watermarks anywhere in the image.",
    "Output only the final composed image.",
  ].join(" ");
}

export default function DebugPanel({ garments }: Props) {
  if (garments.length === 0) return null;

  const layered = sortByLayer(garments);
  const prompt = buildOutfitPrompt(layered);

  return (
    <div className="mt-12 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-4">
      <h2 className="mb-1 text-sm font-semibold text-orange-800">
        Debug — images fed to the model
      </h2>
      <p className="mb-4 text-xs text-orange-600">
        These are the exact images sent in the API request, in layer order
        (innermost → outermost). The mannequin is AI-generated server-side and
        has no preview here.
      </p>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-40 w-32 items-center justify-center rounded-lg border border-orange-200 bg-white text-xs text-gray-400">
            🧍 AI mannequin
          </div>
          <span className="text-[10px] text-orange-500">base (no image sent)</span>
        </div>

        {layered.map((g, i) => (
          <div key={g.id} className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.imageUrl}
              alt={`${g.label} — image ${i + 1}`}
              className="h-40 w-32 rounded-lg border border-orange-200 object-cover"
            />
            <span className="max-w-[8rem] truncate text-center text-[10px] text-orange-600">
              image {i + 1}: {g.type}
            </span>
            <span
              className="max-w-[8rem] truncate text-center text-[10px] text-gray-400"
              title={g.label}
            >
              {g.label}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mb-1 text-sm font-semibold text-orange-800">
        Debug — text prompt sent to the model
      </h2>
      <p className="mb-2 text-xs text-orange-600">
        This is the exact text content accompanying the images in the API request.
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-orange-200 bg-white p-3 text-[11px] leading-relaxed text-gray-700">
        {prompt}
      </pre>
    </div>
  );
}
