import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const isAuthenticated = await isValidAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/try/:path*",
    "/api/tryon/:path*",
    "/api/extract/:path*",
    "/api/waitlist/admin/:path*",
  ],
};
