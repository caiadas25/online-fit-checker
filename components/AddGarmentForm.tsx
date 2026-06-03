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
      return "border-[#151515] bg-[#151515] text-white shadow-[3px_3px_0_#ff6bb5]";
    }
    if (used) {
      return "border-[#151515] bg-[#f6ff70] text-[#151515]";
    }
    return "border-[#151515]/25 bg-white text-[#39352f] hover:border-[#151515]";
  }

  return (
    <section className="rounded-[1.6rem] border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[7px_7px_0_#151515]">
      <p className="text-xs font-black uppercase text-[#746f67]">Drop a piece</p>
      <h2 className="mb-4 text-xl font-black text-[#151515]">
        Add clothing
      </h2>

      <label className="mb-2 block text-xs font-black uppercase text-[#746f67]">
        What kind of item?
      </label>
      <div className="mb-2 grid grid-cols-5 gap-2">
        {PRIMARY_CARDS.map((c) => (
          <button
            key={c.type}
          type="button"
          onClick={() => selectType(c.type)}
            className={`relative flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center text-[#151515] transition ${cardStyle(c.type)}`}
          >
            {(counts[c.type] ?? 0) > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#151515] bg-[#62d8ff] text-[9px] font-black text-[#151515]">
                ✓
              </span>
            )}
            <span className="text-2xl leading-none">{c.icon}</span>
            <span className="text-[11px] font-black">{c.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={handleOtherClick}
          className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center transition ${
            showOther
              ? "border-[#151515] bg-[#151515] text-white shadow-[3px_3px_0_#ff6bb5]"
              : "border-[#151515]/25 bg-white text-[#39352f] hover:border-[#151515]"
          }`}
        >
          <span className="text-2xl leading-none">⋯</span>
          <span className="text-[11px] font-black">Other</span>
        </button>
      </div>

      {showOther && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {OTHER_CARDS.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => selectType(c.type)}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-2.5 text-center transition ${cardStyle(c.type, true)}`}
            >
              {(counts[c.type] ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#151515] bg-[#62d8ff] text-[9px] font-black text-[#151515]">
                  ✓
                </span>
              )}
              <span className="text-lg leading-none">{c.icon}</span>
              <span className="text-[10px] font-black">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      <label className="mb-1 block text-xs font-black uppercase text-[#746f67]">
        Paste a store link
      </label>
      <div className="mb-3 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUrlAdd()}
          placeholder="https://store.com/product/..."
          className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-[#151515] bg-white px-4 text-sm font-bold text-[#151515] outline-none placeholder:text-[#746f67] focus:ring-2 focus:ring-[#ff6bb5]"
          disabled={busy}
        />
        <button
          onClick={handleUrlAdd}
          disabled={busy || !url.trim()}
          className="shrink-0 rounded-2xl border-2 border-[#151515] bg-[#151515] px-4 py-2 text-sm font-black text-white transition hover:bg-[#ff6bb5] hover:text-[#151515] disabled:opacity-40"
        >
          {busy ? "..." : "Add"}
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-[#746f67]">
        <span className="h-0.5 flex-1 bg-[#151515]" /> or{" "}
        <span className="h-0.5 flex-1 bg-[#151515]" />
      </div>

      <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[#151515] bg-[#62d8ff] px-3 py-3 text-sm font-black text-[#151515] transition hover:bg-[#f6ff70]">
        Upload an image
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {error && <p className="mt-3 text-sm font-bold text-[#bf1f46]">{error}</p>}
    </section>
  );
}
