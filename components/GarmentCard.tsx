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
    <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={garment.imageUrl}
        alt={garment.label}
        className="h-16 w-16 shrink-0 rounded-lg border border-black/5 object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900" title={garment.label}>
          {garment.label}
        </p>
        <select
          value={garment.type}
          onChange={(e) => onChangeType(garment.id, e.target.value as GarmentType)}
          className="mt-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-gray-700"
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
          className="rounded-md border border-black/10 px-2 text-xs text-gray-600 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          onClick={() => onMove(garment.id, 1)}
          disabled={index === count - 1}
          aria-label="Move down"
          className="rounded-md border border-black/10 px-2 text-xs text-gray-600 disabled:opacity-30"
        >
          ↓
        </button>
      </div>
      <button
        onClick={() => onRemove(garment.id)}
        aria-label="Remove"
        className="rounded-md px-2 py-1 text-sm text-red-500 hover:bg-red-50"
      >
        ✕
      </button>
    </div>
  );
}
