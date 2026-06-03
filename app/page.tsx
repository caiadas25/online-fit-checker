"use client";

import { useState } from "react";
import AddGarmentForm from "@/components/AddGarmentForm";
import GarmentCard from "@/components/GarmentCard";
import ResultPanel from "@/components/ResultPanel";
import DebugPanel from "@/components/DebugPanel";
import { sortByLayer, type Garment, type GarmentType } from "@/lib/garments";
import { MANNEQUIN } from "@/lib/models";
export default function Home() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    requests: number;
    totalTokens: number;
    costUsd: number | null;
    modelLabel: string;
    mocked: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addGarment(g: Garment) {
    setGarments((prev) => [...prev, g]);
  }
  function removeGarment(id: string) {
    setGarments((prev) => prev.filter((g) => g.id !== id));
  }
  function changeType(id: string, type: GarmentType) {
    setGarments((prev) => prev.map((g) => (g.id === id ? { ...g, type } : g)));
  }
  function moveGarment(id: string, dir: -1 | 1) {
    setGarments((prev) => {
      const i = prev.findIndex((g) => g.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function generate() {
    if (garments.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseModel: MANNEQUIN,
          garments: garments.map((g) => ({
            imageUrl: g.imageUrl,
            type: g.type,
            label: g.label,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate the outfit.");
      setImage(data.image);
      setUsage(data.usage ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setImage(null);
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }

  // Preview the order garments will actually be layered in.
  const layered = sortByLayer(garments);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-gray-900">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Lookloop</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add clothing from store links or uploads, then see the whole outfit on one model.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left column: controls */}
        <div className="flex flex-col gap-4">
          <AddGarmentForm onAdd={addGarment} garments={garments} />

          {garments.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">
                  Outfit ({garments.length})
                </h2>
                <span className="text-xs text-gray-400">layered base → outer</span>
              </div>
              {layered.map((g, i) => (
                <GarmentCard
                  key={g.id}
                  garment={g}
                  index={i}
                  count={layered.length}
                  onChangeType={changeType}
                  onMove={moveGarment}
                  onRemove={removeGarment}
                />
              ))}
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading || garments.length === 0}
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-40"
          >
            {loading ? "Generating…" : image ? "Regenerate outfit" : "Generate outfit"}
          </button>
          <p className="text-center text-[11px] text-gray-400">
            {garments.length > 0
              ? `All ${garments.length} garment${garments.length === 1 ? "" : "s"} are composed in one image request, billed to your OpenRouter credits. Layering follows item type.`
              : "Your whole outfit is composed in a single image request, billed to your OpenRouter credits. Layering follows item type."}
          </p>
        </div>

        {/* Right column: result */}
        <ResultPanel
          image={image}
          usage={usage}
          loading={loading}
          error={error}
          hasGarments={garments.length > 0}
        />
      </div>
      <DebugPanel garments={layered} />
    </main>
  );
}
