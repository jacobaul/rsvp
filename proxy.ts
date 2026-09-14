import { NextResponse, type NextRequest } from "next/server";

import { decryptSession, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Optimistic gate only. It reads the cookie and never touches the database,
 * because proxy runs on every matched request including prefetches. The real
 * check is requireAdmin() inside each page, action, and route handler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (!session) {
    // API routes get a status, not a login page, so a stale tab downloading an
    // export sees a real error instead of HTML.
    if (pathname.startsWith("/api/")) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const url = new URL("/admin/login", request.nextUrl);

    if (pathname !== "/admin") {
      url.searchParams.set("next", pathname);
    }

    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
