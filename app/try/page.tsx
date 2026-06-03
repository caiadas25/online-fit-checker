"use client";

import Link from "next/link";
import { useState } from "react";
import AddGarmentForm from "@/components/AddGarmentForm";
import GarmentCard from "@/components/GarmentCard";
import ResultPanel from "@/components/ResultPanel";
import DebugPanel from "@/components/DebugPanel";
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODE_LABELS,
  type GenerationMode,
} from "@/lib/generation-modes";
import { sortByLayer, type Garment, type GarmentType } from "@/lib/garments";
import { MANNEQUIN } from "@/lib/models";

const workflow = ["Paste", "Upload", "Layer", "Generate"];

const SHOW_DEV_TOOLS = true;

const DEV_TEST_GARMENTS: { label: string; type: GarmentType; url: string }[] = [
  {
    label: "bottom",
    type: "bottom",
    url: "https://www.uniqlo.com/eu-pt/en/products/E480302-000/00?colorDisplayCode=09&sizeDisplayCode=003",
  },
  {
    label: "top",
    type: "top",
    url: "https://www.uniqlo.com/eu-pt/en/products/E485473-000/00?colorDisplayCode=09&sizeDisplayCode=003",
  },
  {
    label: "jacket",
    type: "jacket",
    url: "https://www.uniqlo.com/eu-pt/en/products/E478557-000/00?colorDisplayCode=05&sizeDisplayCode=003",
  },
];

function newGarmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function estimatedRequestCount(garmentCount: number, mode: GenerationMode): number {
  if (garmentCount === 0) return mode === "preprocessed" ? 2 : 1;
  return mode === "preprocessed" ? garmentCount + 1 : 1;
}

function generationCostNote(garmentCount: number, mode: GenerationMode): string {
  const requests = estimatedRequestCount(garmentCount, mode);
  if (mode === "preprocessed") {
    return `Estimated token cost: about ${requests} image request${requests === 1 ? "" : "s"} (${garmentCount || 1} cutout ${garmentCount === 1 ? "pass" : "passes"} plus final composition), roughly ${requests}x the single-pass token usage. Exact tokens appear after generation.`;
  }

  return "Estimated token cost: about 1 image request. Exact tokens appear after generation.";
}

export default function TryPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    requests: number;
    totalTokens: number;
    costUsd: number | null;
    modelLabel: string;
    generationModeLabel?: string;
  } | null>(null);
  const [preprocessedGarments, setPreprocessedGarments] = useState<
    { type: GarmentType; label: string; image: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLoading, setDevLoading] = useState(false);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>(DEFAULT_GENERATION_MODE);

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
    setPreprocessedGarments([]);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseModel: MANNEQUIN,
          generationMode,
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
      setPreprocessedGarments(data.preprocessedGarments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setImage(null);
      setUsage(null);
      setPreprocessedGarments([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDevTestFit() {
    setDevLoading(true);
    setDevMessage(null);
    setError(null);
    setImage(null);
    setUsage(null);
    setPreprocessedGarments([]);

    try {
      const loaded = await Promise.all(
        DEV_TEST_GARMENTS.map(async (item) => {
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: item.url }),
          });
          const data = (await res.json()) as {
            imageUrl?: string;
            title?: string;
            error?: string;
          };
          if (!res.ok || !data.imageUrl) {
            throw new Error(data.error || `Failed to load ${item.label}.`);
          }
          return {
            id: newGarmentId(),
            type: item.type,
            label: data.title?.slice(0, 60) || item.label,
            imageUrl: data.imageUrl,
            sourceUrl: item.url,
          };
        }),
      );

      setGarments(loaded);
      setDevMessage(`Loaded ${loaded.length} Uniqlo test pieces.`);
    } catch (err) {
      setDevMessage(err instanceof Error ? err.message : "Failed to load test fit.");
    } finally {
      setDevLoading(false);
    }
  }

  function clearFit() {
    setGarments([]);
    setImage(null);
    setUsage(null);
    setPreprocessedGarments([]);
    setError(null);
    setDevMessage("Cleared.");
  }

  // Preview the order garments will actually be layered in.
  const layered = sortByLayer(garments);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f4ec] text-[#151515]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,#f8f4ec_0%,#f8f4ec_42%,#f6ff70_42%,#f6ff70_58%,#ff6bb5_58%,#ff6bb5_72%,#62d8ff_72%,#62d8ff_100%)] opacity-25" />

      <div
        className={`mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 ${
          SHOW_DEV_TOOLS ? "pb-36" : ""
        }`}
      >
        <nav className="flex items-center justify-between rounded-full border-2 border-[#151515] bg-[#fffaf0]/90 px-4 py-3 shadow-[6px_6px_0_#151515]">
          <Link href="/" className="text-lg font-black tracking-tight">
            Lookloop
          </Link>
          <div className="hidden items-center gap-2 text-xs font-black uppercase md:flex">
            {workflow.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#151515]/20 bg-white px-3 py-1"
              >
                {item}
              </span>
            ))}
          </div>
          <span className="rounded-full border-2 border-[#151515] bg-[#ff6bb5] px-4 py-2 text-sm font-black">
            Fit lab
          </span>
        </nav>

        <header className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="inline-flex rotate-[-1deg] rounded-full border-2 border-[#151515] bg-[#f6ff70] px-4 py-2 text-xs font-black uppercase shadow-[4px_4px_0_#151515]">
              Build the look before checkout
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.92] tracking-normal sm:text-6xl lg:text-7xl">
              Stack your cart into one fit check.
            </h1>
          </div>
          <p className="max-w-xl text-base font-bold leading-7 text-[#39352f] lg:text-right">
            Add store links or uploads, order the layers, then generate one model preview
            that makes the buy-or-bye decision obvious.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.86fr)_minmax(0,1.14fr)]">
          <div className="flex flex-col gap-5">
            <AddGarmentForm onAdd={addGarment} garments={garments} />

            <section className="rounded-[1.6rem] border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[7px_7px_0_#151515]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#746f67]">Layer stack</p>
                  <h2 className="text-xl font-black">
                    Outfit ({garments.length})
                  </h2>
                </div>
                <span className="rounded-full bg-[#151515] px-3 py-1 text-[11px] font-black uppercase text-white">
                  base to outer
                </span>
              </div>

              {garments.length > 0 ? (
                <div className="flex flex-col gap-3">
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
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-[#151515]/30 bg-white/70 px-4 py-8 text-center">
                  <p className="text-sm font-black text-[#39352f]">
                    Your outfit stack is empty.
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-[#746f67]">
                    Add a top, bottom, shoes, or any chaos from your cart.
                  </p>
                </div>
              )}
            </section>

            <button
              onClick={generate}
              disabled={loading || garments.length === 0}
              className="min-h-14 rounded-[1.35rem] border-2 border-[#151515] bg-[#ff6bb5] px-5 text-base font-black text-[#151515] shadow-[6px_6px_0_#151515] transition hover:-translate-y-0.5 hover:bg-[#f6ff70] disabled:translate-y-0 disabled:bg-[#d8d2c6] disabled:opacity-70"
            >
              {loading ? "Generating..." : image ? "Regenerate fit" : "Generate fit"}
            </button>
            <p className="text-center text-[11px] font-bold leading-5 text-[#746f67]">
              {garments.length > 0
                ? generationMode === "preprocessed"
                  ? `Preprocessed mode extracts ${garments.length} garment cutout${garments.length === 1 ? "" : "s"} before final composition.`
                  : `All ${garments.length} garment${garments.length === 1 ? "" : "s"} are composed in one image request. Layering follows item type.`
                : "Your whole outfit will be composed according to the selected generation mode."}
              <br />
              {generationCostNote(garments.length, generationMode)}
            </p>
          </div>

          <ResultPanel
            image={image}
            usage={usage}
            loading={loading}
            error={error}
            hasGarments={garments.length > 0}
          />
        </div>

        <DebugPanel
          garments={layered}
          generationMode={generationMode}
          preprocessedGarments={preprocessedGarments}
        />
      </div>

      {SHOW_DEV_TOOLS && (
        <DevToolsToolbar
          loading={devLoading}
          message={devMessage}
          generationMode={generationMode}
          onClear={clearFit}
          onGenerationModeChange={setGenerationMode}
          onLoad={loadDevTestFit}
        />
      )}
    </main>
  );
}

function DevToolsToolbar({
  loading,
  message,
  generationMode,
  onClear,
  onGenerationModeChange,
  onLoad,
}: {
  loading: boolean;
  message: string | null;
  generationMode: GenerationMode;
  onClear: () => void;
  onGenerationModeChange: (mode: GenerationMode) => void;
  onLoad: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[#151515] bg-[#151515] px-4 py-3 text-white shadow-[0_-6px_0_#ff6bb5]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-[#62d8ff]">Dev tools</p>
          <p className="text-sm font-black">
            One-click test data and generation mode comparison.
          </p>
        </div>

        {message && (
          <p className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
            {message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border-2 border-white bg-white p-1 text-xs font-black text-[#151515]">
            {(["single-pass", "preprocessed"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onGenerationModeChange(mode)}
                disabled={loading}
                className={`rounded-full px-3 py-2 transition disabled:opacity-60 ${
                  generationMode === mode
                    ? "bg-[#ff6bb5] text-[#151515]"
                    : "text-[#39352f] hover:bg-[#62d8ff]"
                }`}
              >
                {GENERATION_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onLoad}
            disabled={loading}
            className="min-h-11 rounded-full border-2 border-white bg-[#f6ff70] px-5 text-sm font-black text-[#151515] transition hover:-translate-y-0.5 hover:bg-[#62d8ff] disabled:translate-y-0 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Load Uniqlo test fit"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className="min-h-11 rounded-full border-2 border-white px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white hover:text-[#151515] disabled:translate-y-0 disabled:opacity-60"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
