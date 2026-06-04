import { NextResponse } from "next/server";
import { z } from "zod";
import { isTesterCookieHeaderAuthenticated } from "@/lib/admin-auth";
import { extractProduct } from "@/lib/scrape";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().min(1) });

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
    return NextResponse.json({ error: "A URL is required." }, { status: 400 });
  }

  try {
    const product = await extractProduct(parsed.data.url);
    return NextResponse.json(product);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read that page.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
