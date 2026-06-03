"use client";

import { sortByLayer, type Garment, type GarmentType } from "@/lib/garments";
import { IMAGE_GENERATION_SYSTEM_PROMPT } from "@/lib/image-prompts";

interface Props {
  garments: Garment[];
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

function buildOutfitPrompt(garments: Garment[]): string {
  const offset = 1; // mannequin, no base image

  const extractionSteps = garments.map(
    (g, i) =>
      `Step ${i + 2}: From image ${i + offset}, extract ONLY the ${ARTICLE[g.type]}. Ignore the person, all other clothing, shoes, accessories, page UI, measurement labels, price tags, captions, and watermarks. Copy the garment's exact colour, fabric, cut, length, collar style, sleeve length, stitching, buttons, seams, trims, pattern, print, embroidery, patches, and any logo or lettering physically attached to the garment. If the garment is pink, it stays pink. If it is denim, it stays denim. Do not simplify, change, or restyle it.`,
  );

  return [
    "Generate one neutral, faceless, light-gray full-body mannequin standing front-facing on a seamless light-gray studio background. The mannequin should be slim, average height, with no facial features.",
    `You are given ${garments.length} image(s). Images ${Array.from({ length: garments.length }, (_, i) => i + offset).join(", ")} are reference photos of individual garments on models. Each photo shows many items — you must extract ONLY the one named below from each.`,
    "EXTRACTION STEPS (follow in order):",
    ...extractionSteps,
    `Step ${garments.length + 2}: Compose the extracted garments onto the mannequin as ONE outfit, layered from innermost to outermost in the order listed. Shirts go under jackets. Ties go over shirts. Bottoms sit at the waist.`,
    `CRITICAL — Match each garment EXACTLY: same colour (do not recolour), same fabric texture, same cut, same length, same collar/sleeve style, same stitching, same trims, same patterns, and same garment-native logos or lettering when present. A pink polo shirt must appear as a pink polo, NOT a blue V-neck. A dark denim jacket must appear as a dark denim jacket, NOT disappear.`,
    "Show the ENTIRE figure from head to feet, centred, full-length. Do not crop or zoom in.",
    "Do NOT render unrelated text, captions, product labels, price tags, size labels, measurements, signatures, UI, or watermarks. Logos or text are allowed only when they are physically part of the target garment, and then they should be preserved faithfully.",
    "Output only the final composed image.",
  ].join("\n\n");
}

export default function DebugPanel({ garments }: Props) {
  if (garments.length === 0) return null;

  const layered = sortByLayer(garments);
  const prompt = buildOutfitPrompt(layered);

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
