import { NextResponse } from "next/server";
import { z } from "zod";
import { composeOutfit, MODEL_KEYS } from "@/lib/imagegen";
import { GARMENT_TYPES, sortByLayer } from "@/lib/garments";

export const runtime = "nodejs";
export const maxDuration = 120; // iterative image edits can take a while

const garmentSchema = z.object({
  imageUrl: z.string().min(1),
  type: z.enum(GARMENT_TYPES),
  label: z.string().default(""),
});

const schema = z.object({
  baseModel: z.string().min(1),
  model: z.enum(MODEL_KEYS as [string, ...string[]]).default("gemini"),
  garments: z.array(garmentSchema).min(1).max(8),
});

export async function POST(req: Request) {
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
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate the outfit.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
