"use client";

import { useState } from "react";
import type { Garment, GarmentType } from "@/lib/garments";

interface Props {
  onAdd: (garment: Garment) => void;
  garments: Garment[];
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/** Primary card options shown by default. */
const PRIMARY_CARDS: { type: GarmentType; label: string; icon: string }[] = [
  { type: "top", label: "Top", icon: "👕" },
  { type: "bottom", label: "Bottom", icon: "👖" },
  { type: "shoes", label: "Shoes", icon: "👟" },
  { type: "jacket", label: "Outer", icon: "🧥" },
];

/** Secondary options shown when "Other" is expanded. */
const OTHER_CARDS: { type: GarmentType; label: string; icon: string }[] = [
  { type: "dress", label: "Dress", icon: "👗" },
  { type: "tie", label: "Tie", icon: "👔" },
  { type: "hat", label: "Hat", icon: "🧢" },
  { type: "accessory", label: "Accessory", icon: "💍" },
];

/** Count how many garments of each type exist. */
function countByType(garments: Garment[]): Partial<Record<GarmentType, number>> {
  const counts: Partial<Record<GarmentType, number>> = {};
  for (const g of garments) {
    counts[g.type] = (counts[g.type] ?? 0) + 1;
  }
  return counts;
}

export default function AddGarmentForm({ onAdd, garments }: Props) {
  const [type, setType] = useState<GarmentType>("top");
  const [showOther, setShowOther] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = countByType(garments);

  async function handleUrlAdd() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that page.");
      onAdd({
        id: newId(),
        type,
        label: data.title?.slice(0, 60) || "",
        imageUrl: data.imageUrl,
        sourceUrl: url.trim(),
      });
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onAdd({
        id: newId(),
        type,
        label: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
        imageUrl: dataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  function selectType(t: GarmentType) {
    setType(t);
    if (PRIMARY_CARDS.some((c) => c.type === t)) {
      setShowOther(false);
    }
  }

  function handleOtherClick() {
    setShowOther((prev) => !prev);
  }

  /**
   * Figure out the visual state of a card:
   *  - active: currently selected for the next add
   *  - used: has garments of this type in the outfit (but not selected now)
   */
  function cardStyle(t: GarmentType, isOther = false): string {
    const active = type === t && (isOther || !showOther);
    const used = (counts[t] ?? 0) > 0;

    if (active) {
      return "border-gray-900 bg-gray-900 text-white";
    }
    if (used) {
      return "border-gray-400 bg-gray-100 text-gray-800";
    }
    return "border-black/10 bg-gray-50 text-gray-700 hover:border-black/25";
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-800">
        Add a clothing item
      </h2>

      {/* Type cards */}
      <label className="mb-2 block text-xs font-medium text-gray-500">
        What kind of item?
      </label>
      <div className="mb-2 grid grid-cols-5 gap-2">
        {PRIMARY_CARDS.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => selectType(c.type)}
            className={`relative flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition ${cardStyle(c.type)}`}
          >
            {(counts[c.type] ?? 0) > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-800 px-1 text-[10px] font-bold text-white">
                {counts[c.type]}
              </span>
            )}
            <span className="text-2xl leading-none">{c.icon}</span>
            <span className="text-[11px] font-medium">{c.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={handleOtherClick}
          className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition ${
            showOther
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-black/10 bg-gray-50 text-gray-700 hover:border-black/25"
          }`}
        >
          <span className="text-2xl leading-none">⋯</span>
          <span className="text-[11px] font-medium">Other</span>
        </button>
      </div>

      {/* Other options (expandable) */}
      {showOther && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {OTHER_CARDS.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => selectType(c.type)}
              className={`relative flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center transition ${cardStyle(c.type, true)}`}
            >
              {(counts[c.type] ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-800 px-1 text-[9px] font-bold text-white">
                  {counts[c.type]}
                </span>
              )}
              <span className="text-lg leading-none">{c.icon}</span>
              <span className="text-[10px] font-medium">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* URL input */}
      <label className="mb-1 block text-xs font-medium text-gray-500">
        Paste a store link
      </label>
      <div className="mb-3 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUrlAdd()}
          placeholder="https://store.com/product/…"
          className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm text-gray-900"
          disabled={busy}
        />
        <button
          onClick={handleUrlAdd}
          disabled={busy || !url.trim()}
          className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "…" : "Add"}
        </button>
      </div>

      {/* Divider */}
      <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
        <span className="h-px flex-1 bg-black/10" /> or{" "}
        <span className="h-px flex-1 bg-black/10" />
      </div>

      {/* Upload */}
      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-black/20 px-3 py-3 text-sm text-gray-600 hover:bg-gray-50">
        Upload an image
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
