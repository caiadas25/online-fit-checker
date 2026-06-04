import { NextResponse } from "next/server";
import {
  TESTER_SESSION_COOKIE,
  createTesterSessionToken,
  getTesterAuthConfig,
  getAdminSessionMaxAge,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const config = getTesterAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Tester auth is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const password =
    typeof body === "object" && body !== null && "password" in body
      ? String(body.password)
      : "";

  if (password !== config.password) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const res = NextResponse.json({ authenticated: true });
  res.cookies.set({
    name: TESTER_SESSION_COOKIE,
    value: await createTesterSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminSessionMaxAge(),
  });

  return res;
}
