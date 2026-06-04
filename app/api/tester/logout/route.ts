import { NextResponse } from "next/server";
import { TESTER_SESSION_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set({
    name: TESTER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}
