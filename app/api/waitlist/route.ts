import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  const { kv } = await import("@vercel/kv");
  return kv;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).email === "string"
      ? ((body as Record<string, string>).email as string).trim().toLowerCase()
      : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const kv = await getKv();
  if (!kv) {
    return NextResponse.json(
      { error: "Waitlist is not configured yet. Please try again later." },
      { status: 503 },
    );
  }

  try {
    const existing = await kv.get<string>(`waitlist:${email}`);
    if (existing) {
      return NextResponse.json({ message: "You're already on the list!" });
    }

    await kv.set(`waitlist:${email}`, new Date().toISOString());
    await kv.incr("waitlist:count");

    return NextResponse.json({
      message: "You're on the list! We'll notify you when FitMashr drops.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const kv = await getKv();
  if (!kv) return NextResponse.json({ count: 0 });

  try {
    const count = (await kv.get<number>("waitlist:count")) ?? 0;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
