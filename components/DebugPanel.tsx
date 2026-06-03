"use client";

import { sortByLayer, type Garment } from "@/lib/garments";

interface Props {
  garments: Garment[];
}

export default function DebugPanel({ garments }: Props) {
  if (garments.length === 0) return null;

  const layered = sortByLayer(garments);

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

      <div className="flex flex-wrap gap-4">
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
    </div>
  );
}
