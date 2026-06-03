import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminCookieHeaderAuthenticated } from "@/lib/admin-auth";
import { composeOutfit, MODEL_KEYS } from "@/lib/imagegen";
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODES,
  type GenerationMode,
} from "@/lib/generation-modes";
import { GARMENT_TYPES, sortByLayer } from "@/lib/garments";
import { DEFAULT_MODEL } from "@/lib/model-options";

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
  if (!(await isAdminCookieHeaderAuthenticated(req.headers.get("cookie")))) {
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

  try {
    const ordered = sortByLayer(parsed.data.garments);
    const result = await composeOutfit(
      parsed.data.baseModel,
      ordered,
      parsed.data.model as (typeof MODEL_KEYS)[number],
      parsed.data.generationMode as GenerationMode,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate the outfit.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
