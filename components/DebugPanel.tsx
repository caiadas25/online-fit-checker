"use client";

import { sortByLayer, type Garment } from "@/lib/garments";
import type { GenerationMode } from "@/lib/generation-modes";
import { IMAGE_GENERATION_SYSTEM_PROMPT } from "@/lib/image-prompts";
import { buildCutoutCompositionPrompt, buildOutfitPrompt } from "@/lib/outfit-prompt";

interface Props {
  garments: Garment[];
  generationMode: GenerationMode;
  preprocessedGarments: { type: Garment["type"]; label: string; image: string }[];
}

export default function DebugPanel({
  garments,
  generationMode,
  preprocessedGarments,
}: Props) {
  if (garments.length === 0) return null;

  const layered = sortByLayer(garments);
  const prompt =
    generationMode === "preprocessed"
      ? buildCutoutCompositionPrompt(layered, false)
      : buildOutfitPrompt(layered, false);

  return (
    <section className="mt-12 rounded-[1.6rem] border-2 border-dashed border-[#151515] bg-[#fffaf0]/90 p-4 shadow-[7px_7px_0_#151515]">
      <h2 className="mb-1 text-sm font-black text-[#151515]">
        Debug: images fed to the model
      </h2>
      <p className="mb-4 text-xs font-bold leading-5 text-[#746f67]">
        These are the exact images sent in the API request, in layer order
        (innermost to outermost). The mannequin is AI-generated server-side and
        has no preview here.
      </p>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-40 w-32 items-center justify-center rounded-2xl border-2 border-[#151515] bg-[#62d8ff] text-center text-xs font-black text-[#151515]">
            🧍 AI mannequin
          </div>
          <span className="text-[10px] font-black text-[#746f67]">base (no image sent)</span>
        </div>

        {layered.map((g, i) => (
          <div key={g.id} className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.imageUrl}
              alt={`${g.label} image ${i + 1}`}
              className="h-40 w-32 rounded-2xl border-2 border-[#151515] object-cover"
            />
            <span className="max-w-[8rem] truncate text-center text-[10px] font-black text-[#151515]">
              image {i + 1}: {g.type}
            </span>
            <span
              className="max-w-[8rem] truncate text-center text-[10px] font-bold text-[#746f67]"
              title={g.label}
            >
              {g.label}
            </span>
          </div>
        ))}
      </div>

      {preprocessedGarments.length > 0 && (
        <>
          <h2 className="mb-1 text-sm font-black text-[#151515]">
            Debug: preprocessed garment cutouts
          </h2>
          <p className="mb-4 text-xs font-bold leading-5 text-[#746f67]">
            These are the intermediate garment-only images used for final composition in
            preprocessed mode.
          </p>
          <div className="mb-6 flex flex-wrap gap-4">
            {preprocessedGarments.map((g, i) => (
              <div key={`${g.type}-${i}`} className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image}
                  alt={`${g.label} cutout`}
                  className="h-40 w-32 rounded-2xl border-2 border-[#151515] bg-white object-contain"
                />
                <span className="max-w-[8rem] truncate text-center text-[10px] font-black text-[#151515]">
                  cutout {i + 1}: {g.type}
                </span>
                <span
                  className="max-w-[8rem] truncate text-center text-[10px] font-bold text-[#746f67]"
                  title={g.label}
                >
                  {g.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-1 text-sm font-black text-[#151515]">
        Debug: system prompt sent to the model
      </h2>
      <p className="mb-2 text-xs font-bold text-[#746f67]">
        This instruction is sent as a separate system message before the image prompt.
      </p>
      <pre className="mb-5 overflow-x-auto whitespace-pre-wrap rounded-2xl border-2 border-[#151515] bg-white p-3 text-[11px] font-bold leading-relaxed text-[#39352f]">
        {IMAGE_GENERATION_SYSTEM_PROMPT}
      </pre>

      <h2 className="mb-1 text-sm font-black text-[#151515]">
        Debug: user prompt sent to the model
      </h2>
      <p className="mb-2 text-xs font-bold text-[#746f67]">
        This is the exact text content accompanying the images in the API request.
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border-2 border-[#151515] bg-white p-3 text-[11px] font-bold leading-relaxed text-[#39352f]">
        {prompt}
      </pre>
    </section>
  );
}
