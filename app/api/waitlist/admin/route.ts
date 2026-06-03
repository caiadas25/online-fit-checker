import { NextResponse } from "next/server";
import { isAdminCookieHeaderAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  const { kv } = await import("@vercel/kv");
  return kv;
}

export async function GET(req: Request) {
  if (!(await isAdminCookieHeaderAuthenticated(req.headers.get("cookie")))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const kv = await getKv();
  if (!kv) {
    return NextResponse.json({ error: "KV not configured." }, { status: 503 });
  }

  try {
    // Scan for all waitlist email keys
    const keys: string[] = [];
    let cursor = "0";
    do {
      const result = await kv.scan(cursor, { match: "waitlist:*", count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");

    // Filter out the count key and fetch each email's timestamp
    const emailKeys = keys.filter((k) => k !== "waitlist:count");
    const entries = await Promise.all(
      emailKeys.map(async (key) => {
        const email = key.replace("waitlist:", "");
        const subscribedAt = await kv.get<string>(key);
        return { email, subscribedAt };
      }),
    );

    // Sort by most recent
    entries.sort((a, b) => {
      if (!a.subscribedAt || !b.subscribedAt) return 0;
      return new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime();
    });

    const count = (await kv.get<number>("waitlist:count")) ?? entries.length;

    return NextResponse.json({ count, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read waitlist.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
