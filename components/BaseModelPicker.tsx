"use client";

import { BASE_MODELS } from "@/lib/models";

interface Props {
  selected: string;
  onSelect: (src: string) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export default function BaseModelPicker({ selected, onSelect }: Props) {
  const isCustom = selected.startsWith("data:");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    onSelect(await readFileAsDataUrl(file));
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-800">Base model</h2>
      <p className="mb-3 text-xs text-gray-500">
        Pick a mannequin, or upload a real front-facing photo for the most realistic result.
      </p>
      <div className="flex flex-wrap gap-3">
        {BASE_MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.src)}
            className={`overflow-hidden rounded-lg border-2 transition ${
              selected === m.src ? "border-gray-900" : "border-transparent hover:border-black/20"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.src} alt={m.label} className="h-28 w-20 bg-gray-50 object-cover" />
          </button>
        ))}
        <label
          className={`flex h-28 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center text-[11px] leading-tight text-gray-500 hover:bg-gray-50 ${
            isCustom ? "border-gray-900" : "border-black/20"
          }`}
        >
          {isCustom ? "Custom ✓" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}
