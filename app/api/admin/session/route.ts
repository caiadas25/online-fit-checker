import { NextResponse } from "next/server";
import { isAdminCookieHeaderAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return NextResponse.json({
    authenticated: await isAdminCookieHeaderAuthenticated(req.headers.get("cookie")),
  });
}
