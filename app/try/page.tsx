"use client";

import Link from "next/link";
import { useState } from "react";
import AddGarmentForm from "@/components/AddGarmentForm";
import GarmentCard from "@/components/GarmentCard";
import ResultPanel from "@/components/ResultPanel";
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODES,
  GENERATION_MODE_LABELS,
  resolveGenerationMode,
  type GenerationMode,
} from "@/lib/generation-modes";
import { sortByLayer, type Garment, type GarmentType } from "@/lib/garments";
import { DEFAULT_MODEL, MODEL_OPTIONS, type ModelKey } from "@/lib/model-options";
import { MANNEQUIN } from "@/lib/models";

const workflow = ["Paste", "Upload", "Layer", "Generate"];
const SHOW_DEV_TOOLS = process.env.NODE_ENV === "development";

const DEV_TEST_GARMENTS: { label: string; type: GarmentType; url: string }[] = [
  {
    label: "Bottom",
    type: "bottom",
    url: "https://www.uniqlo.com/eu-pt/en/products/E480302-000/00?colorDisplayCode=09&sizeDisplayCode=003",
  },
  {
    label: "Top",
    type: "top",
    url: "https://www.uniqlo.com/eu-pt/en/products/E485473-000/00?colorDisplayCode=09&sizeDisplayCode=003",
  },
  {
    label: "Jacket",
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

function canUseType(
  garments: Garment[],
  type: GarmentType,
  changingId?: string,
): boolean {
  const otherGarments = garments.filter((g) => g.id !== changingId);
  const hasDress = otherGarments.some((g) => g.type === "dress");
  const hasTopOrBottom = otherGarments.some(
    (g) => g.type === "top" || g.type === "bottom",
  );

  if (hasDress && (type === "top" || type === "bottom")) return false;
  if (hasTopOrBottom && type === "dress") return false;
  return true;
}

export default function TryPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [baseModel, setBaseModel] = useState(MANNEQUIN);
  const [selectedModel, setSelectedModel] = useState<ModelKey>(DEFAULT_MODEL);
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>(DEFAULT_GENERATION_MODE);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState<string | null>(null);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addGarment(g: Garment) {
    setGarments((prev) => (canUseType(prev, g.type) ? [...prev, g] : prev));
  }
  function removeGarment(id: string) {
    setGarments((prev) => prev.filter((g) => g.id !== id));
  }
  function changeType(id: string, type: GarmentType) {
    setGarments((prev) =>
      canUseType(prev, type, id)
        ? prev.map((g) => (g.id === id ? { ...g, type } : g))
        : prev,
    );
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
          baseModel,
          model: selectedModel,
          generationMode: effectiveGenerationMode,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setImage(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedGarment(item: (typeof DEV_TEST_GARMENTS)[number]) {
    if (!canUseType(garments, item.type)) {
      setDevMessage("A dress replaces top and bottom pieces in the same outfit.");
      return;
    }

    setDevLoading(item.label);
    setDevMessage(null);
    setError(null);
    setImage(null);

    try {
      const loaded = await extractSavedGarment(item);
      setGarments((prev) => (canUseType(prev, loaded.type) ? [...prev, loaded] : prev));
      setDevMessage(`Added ${item.label.toLowerCase()}.`);
    } catch (err) {
      setDevMessage(err instanceof Error ? err.message : `Failed to load ${item.label}.`);
    } finally {
      setDevLoading(null);
    }
  }

  async function loadSavedFit() {
    setDevLoading("all");
    setDevMessage(null);
    setError(null);
    setImage(null);

    try {
      const loaded = await Promise.all(DEV_TEST_GARMENTS.map(extractSavedGarment));
      setGarments(loaded);
      setDevMessage(`Loaded ${loaded.length} saved test pieces.`);
    } catch (err) {
      setDevMessage(err instanceof Error ? err.message : "Failed to load saved test fit.");
    } finally {
      setDevLoading(null);
    }
  }

  function clearFit() {
    setGarments([]);
    setImage(null);
    setError(null);
    setDevMessage("Cleared.");
  }

  // Preview the order garments will actually be layered in.
  const layered = sortByLayer(garments);
  const effectiveGenerationMode = resolveGenerationMode(layered, generationMode);
  const isGenerationModeForced = effectiveGenerationMode !== generationMode;
  const usesOuterwearCutouts = effectiveGenerationMode === "preprocessed";
  const isTypeDisabledForGarment = (type: GarmentType, garment: Garment) =>
    !canUseType(garments, type, garment.id);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f4ec] text-[#151515]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,#f8f4ec_0%,#f8f4ec_42%,#f6ff70_42%,#f6ff70_58%,#ff6bb5_58%,#ff6bb5_72%,#62d8ff_72%,#62d8ff_100%)] opacity-25" />

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border-2 border-[#151515] bg-[#fffaf0]/90 px-4 py-3 shadow-[6px_6px_0_#151515]">
          <Link href="/" className="text-lg font-black tracking-tight">
            FitMashr
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
              Build the fit before checkout
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.92] tracking-normal sm:text-6xl lg:text-7xl">
              Mash your cart into one fit check.
            </h1>
          </div>
          <p className="max-w-xl text-base font-bold leading-7 text-[#39352f] lg:text-right">
            Add store links or uploads, order the layers, then generate one model preview
            that makes the cop-or-drop decision obvious.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.86fr)_minmax(0,1.14fr)]">
          <div className="flex flex-col gap-5">
            <AddGarmentForm onAdd={addGarment} garments={garments} />

            {SHOW_DEV_TOOLS && (
              <DevToolsPanel
                baseModel={baseModel}
                effectiveGenerationMode={effectiveGenerationMode}
                isGenerationModeForced={isGenerationModeForced}
                selectedModel={selectedModel}
                onBaseModelChange={setBaseModel}
                onClear={clearFit}
                onGenerationModeChange={setGenerationMode}
                onLoadSavedFit={loadSavedFit}
                onLoadSavedGarment={loadSavedGarment}
                onModelChange={setSelectedModel}
                loadingAction={devLoading}
                message={devMessage}
              />
            )}

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
                  {layered.map((g) => (
                    <GarmentCard
                      key={g.id}
                      garment={g}
                      onChangeType={changeType}
                      onRemove={removeGarment}
                      isTypeDisabled={isTypeDisabledForGarment}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-[#151515]/30 bg-white/70 px-4 py-8 text-center">
                  <p className="text-sm font-black text-[#39352f]">
                    Your outfit stack is empty.
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-[#746f67]">
                    Add a top, bottom, jacket, shoes, hat, or dress from your cart.
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
                ? usesOuterwearCutouts
                  ? "Outerwear uses cutout preprocessing first, then we layer every piece into one complete preview."
                  : "We will layer your pieces by item type and build one complete preview."
                : "Add a few pieces to build your fit preview."}
            </p>
          </div>

          <ResultPanel
            image={image}
            loading={loading}
            error={error}
            hasGarments={garments.length > 0}
          />
        </div>
      </div>
    </main>
  );
}

async function extractSavedGarment(
  item: (typeof DEV_TEST_GARMENTS)[number],
): Promise<Garment> {
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
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function DevToolsPanel({
  baseModel,
  effectiveGenerationMode,
  isGenerationModeForced,
  selectedModel,
  onBaseModelChange,
  onClear,
  onGenerationModeChange,
  onLoadSavedFit,
  onLoadSavedGarment,
  onModelChange,
  loadingAction,
  message,
}: {
  baseModel: string;
  effectiveGenerationMode: GenerationMode;
  isGenerationModeForced: boolean;
  selectedModel: ModelKey;
  onBaseModelChange: (value: string) => void;
  onClear: () => void;
  onGenerationModeChange: (value: GenerationMode) => void;
  onLoadSavedFit: () => void;
  onLoadSavedGarment: (item: (typeof DEV_TEST_GARMENTS)[number]) => void;
  onModelChange: (value: ModelKey) => void;
  loadingAction: string | null;
  message: string | null;
}) {
  const isCustomBase = baseModel.startsWith("data:");

  async function handleBaseUpload(file: File | undefined) {
    if (!file) return;
    onBaseModelChange(await readFileAsDataUrl(file));
  }

  return (
    <section className="rounded-[1.6rem] border-2 border-[#151515] bg-[#62d8ff] p-4 shadow-[7px_7px_0_#151515]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#151515]/70">Local only</p>
          <h2 className="text-xl font-black">Dev tools</h2>
        </div>
        <span className="rounded-full bg-[#151515] px-3 py-1 text-[11px] font-black uppercase text-white">
          enabled
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-black uppercase text-[#151515]/70">
            Base model
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onBaseModelChange(MANNEQUIN)}
              className={`min-h-20 rounded-2xl border-2 px-3 text-sm font-black transition ${
                baseModel === MANNEQUIN
                  ? "border-[#151515] bg-[#151515] text-white shadow-[3px_3px_0_#ff6bb5]"
                  : "border-[#151515]/25 bg-white text-[#151515] hover:border-[#151515]"
              }`}
            >
              Mannequin
            </button>
            {isCustomBase && (
              <div className="relative min-h-20 overflow-hidden rounded-2xl border-2 border-[#151515] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={baseModel} alt="Custom base" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-[#151515]/80 py-1 text-center text-[10px] font-black uppercase text-white">
                  custom
                </span>
              </div>
            )}
            <label className="flex min-h-20 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[#151515]/40 bg-white px-3 text-center text-sm font-black text-[#151515] transition hover:border-[#151515]">
              {isCustomBase ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleBaseUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase text-[#151515]/70">
            Image model
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODEL_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onModelChange(option.key)}
                className={`min-h-16 rounded-2xl border-2 px-3 text-left transition ${
                  selectedModel === option.key
                    ? "border-[#151515] bg-[#f6ff70] shadow-[3px_3px_0_#151515]"
                    : "border-[#151515]/25 bg-white hover:border-[#151515]"
                }`}
              >
                <span className="block text-sm font-black">{option.label}</span>
                <span className="block text-[11px] font-bold text-[#39352f]">{option.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase text-[#151515]/70">
            Generation mode
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {GENERATION_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onGenerationModeChange(mode)}
                disabled={isGenerationModeForced && mode === "single-pass"}
                aria-pressed={effectiveGenerationMode === mode}
                className={`min-h-12 rounded-2xl border-2 px-3 text-sm font-black transition ${
                  effectiveGenerationMode === mode
                    ? "border-[#151515] bg-[#ff6bb5] shadow-[3px_3px_0_#151515]"
                    : "border-[#151515]/25 bg-white hover:border-[#151515] disabled:cursor-not-allowed disabled:bg-[#d8d2c6] disabled:text-[#746f67] disabled:opacity-70"
                }`}
              >
                {GENERATION_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          {isGenerationModeForced && (
            <p className="mt-2 rounded-2xl border-2 border-[#151515]/20 bg-white/70 px-3 py-2 text-xs font-black text-[#151515]">
              Jacket detected. Effective mode: {GENERATION_MODE_LABELS[effectiveGenerationMode]}.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="block text-xs font-black uppercase text-[#151515]/70">
              Saved URLs
            </label>
            <button
              type="button"
              onClick={onClear}
              disabled={loadingAction !== null}
              className="rounded-full border-2 border-[#151515] bg-white px-3 py-1 text-[11px] font-black uppercase text-[#151515] transition hover:bg-[#f6ff70] disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onLoadSavedFit}
              disabled={loadingAction !== null}
              className="min-h-12 w-full rounded-2xl border-2 border-[#151515] bg-[#151515] px-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#f6ff70] hover:text-[#151515] disabled:translate-y-0 disabled:opacity-60"
            >
              {loadingAction === "all" ? "Loading saved fit..." : "Load saved fit"}
            </button>

            <div className="grid gap-2 sm:grid-cols-3">
              {DEV_TEST_GARMENTS.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => onLoadSavedGarment(item)}
                  disabled={loadingAction !== null}
                  title={item.url}
                  className="min-h-14 rounded-2xl border-2 border-[#151515]/25 bg-white px-3 text-left transition hover:border-[#151515] disabled:opacity-60"
                >
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className="block truncate text-[10px] font-bold text-[#39352f]">
                    {loadingAction === item.label ? "Loading..." : "Add one click"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {message && (
            <p className="mt-2 rounded-2xl border-2 border-[#151515]/20 bg-white/70 px-3 py-2 text-xs font-black text-[#151515]">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
