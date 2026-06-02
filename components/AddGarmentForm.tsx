"use client";

import { useState } from "react";
import {
  GARMENT_TYPES,
  GARMENT_TYPE_LABELS,
  type Garment,
  type GarmentType,
} from "@/lib/garments";

interface Props {
  onAdd: (garment: Garment) => void;
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

export default function AddGarmentForm({ onAdd }: Props) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<GarmentType>("top");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        label: data.title?.slice(0, 60) || GARMENT_TYPE_LABELS[type],
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
        label: file.name.replace(/\.[^.]+$/, "").slice(0, 60) || GARMENT_TYPE_LABELS[type],
        imageUrl: dataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-800">Add a clothing item</h2>

      <label className="mb-1 block text-xs font-medium text-gray-500">Item type</label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as GarmentType)}
        className="mb-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-900"
      >
        {GARMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {GARMENT_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs font-medium text-gray-500">Paste a store link</label>
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

      <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
        <span className="h-px flex-1 bg-black/10" /> or <span className="h-px flex-1 bg-black/10" />
      </div>

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
