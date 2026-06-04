import { NextResponse } from "next/server";
import { isTesterCookieHeaderAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return NextResponse.json({
    authenticated: await isTesterCookieHeaderAuthenticated(req.headers.get("cookie")),
  });
}
