import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  TESTER_SESSION_COOKIE,
  hasTesterSessionTokenAccess,
  isValidAdminSessionToken,
} from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const testerToken = request.cookies.get(TESTER_SESSION_COOKIE)?.value;
  const isAdminRoute = pathname.startsWith("/api/waitlist/admin");

  const isAuthenticated = isAdminRoute
    ? await isValidAdminSessionToken(adminToken)
    : await hasTesterSessionTokenAccess(adminToken, testerToken);

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const loginUrl = new URL("/tester", request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/try/:path*",
    "/api/tryon/:path*",
    "/api/extract/:path*",
    "/api/waitlist/admin/:path*",
  ],
};
