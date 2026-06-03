"use client";

import {
  GARMENT_TYPES,
  GARMENT_TYPE_LABELS,
  type Garment,
  type GarmentType,
} from "@/lib/garments";

interface Props {
  garment: Garment;
  index: number;
  count: number;
  onChangeType: (id: string, type: GarmentType) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}

export default function GarmentCard({
  garment,
  index,
  count,
  onChangeType,
  onMove,
  onRemove,
}: Props) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-[#151515] bg-white p-3 shadow-[4px_4px_0_#151515]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={garment.imageUrl}
        alt={garment.label}
        className="h-16 w-16 shrink-0 rounded-xl border-2 border-[#151515] object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-[#151515]" title={garment.label}>
          {garment.label}
        </p>
        <select
          value={garment.type}
          onChange={(e) => onChangeType(garment.id, e.target.value as GarmentType)}
          className="mt-2 rounded-full border-2 border-[#151515] bg-[#f6ff70] px-3 py-1 text-xs font-black text-[#151515]"
        >
          {GARMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {GARMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => onMove(garment.id, -1)}
          disabled={index === 0}
          aria-label="Move up"
          className="rounded-full border-2 border-[#151515] bg-[#fffaf0] px-2 text-xs font-black text-[#151515] transition hover:bg-[#62d8ff] disabled:opacity-30"
        >
          ↑
        </button>
        <button
          onClick={() => onMove(garment.id, 1)}
          disabled={index === count - 1}
          aria-label="Move down"
          className="rounded-full border-2 border-[#151515] bg-[#fffaf0] px-2 text-xs font-black text-[#151515] transition hover:bg-[#62d8ff] disabled:opacity-30"
        >
          ↓
        </button>
      </div>
      <button
        onClick={() => onRemove(garment.id)}
        aria-label="Remove"
        className="rounded-full border-2 border-[#151515] bg-[#ff6bb5] px-2 py-1 text-sm font-black text-[#151515] transition hover:bg-[#f6ff70]"
      >
        ✕
      </button>
    </div>
  );
}
