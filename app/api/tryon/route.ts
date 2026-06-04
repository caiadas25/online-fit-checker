import { NextResponse } from "next/server";
import { z } from "zod";
import { isTesterCookieHeaderAuthenticated } from "@/lib/admin-auth";
import { composeOutfit, MODEL_KEYS } from "@/lib/imagegen";
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODES,
  GENERATION_MODE_LABELS,
  resolveGenerationMode,
  type GenerationMode,
} from "@/lib/generation-modes";
import { GARMENT_TYPES, sortByLayer } from "@/lib/garments";
import { DEFAULT_MODEL, MODEL_LABELS } from "@/lib/model-options";
import { recordUsageEvent } from "@/lib/usage-analytics";

export const runtime = "nodejs";
export const maxDuration = 300; // preprocessed mode can make one image call per garment

const garmentSchema = z.object({
  imageUrl: z.string().min(1),
  type: z.enum(GARMENT_TYPES),
  label: z.string().default(""),
});

const schema = z.object({
  baseModel: z.string().min(1),
  model: z.enum(MODEL_KEYS as [string, ...string[]]).default(DEFAULT_MODEL),
  generationMode: z
    .enum(GENERATION_MODES as unknown as [string, ...string[]])
    .default(DEFAULT_GENERATION_MODE),
  garments: z.array(garmentSchema).min(1).max(8),
});

export async function POST(req: Request) {
  if (!(await isTesterCookieHeaderAuthenticated(req.headers.get("cookie")))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Add at least one garment and pick a base model (max 8 garments)." },
      { status: 400 },
    );
  }

  const ordered = sortByLayer(parsed.data.garments);
  const requestedGenerationMode = parsed.data.generationMode as GenerationMode;
  const effectiveGenerationMode = resolveGenerationMode(ordered, requestedGenerationMode);
  const startedAt = Date.now();
  try {
    const result = await composeOutfit(
      parsed.data.baseModel,
      ordered,
      parsed.data.model as (typeof MODEL_KEYS)[number],
      requestedGenerationMode,
    );

    await recordUsageEvent({
      outcome: "success",
      requests: result.usage.requests,
      totalTokens: result.usage.totalTokens,
      costUsd: result.usage.costUsd,
      model: result.usage.model,
      modelLabel: result.usage.modelLabel,
      generationMode: result.usage.generationMode,
      generationModeLabel: result.usage.generationModeLabel,
      garmentCount: ordered.length,
      durationMs: Date.now() - startedAt,
    }).catch(() => undefined);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate the outfit.";
    const model = parsed.data.model as (typeof MODEL_KEYS)[number];

    await recordUsageEvent({
      outcome: "error",
      requests: 0,
      totalTokens: 0,
      costUsd: null,
      model,
      modelLabel: MODEL_LABELS[model],
      generationMode: effectiveGenerationMode,
      generationModeLabel: GENERATION_MODE_LABELS[effectiveGenerationMode],
      garmentCount: ordered.length,
      durationMs: Date.now() - startedAt,
      error: message,
    }).catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
