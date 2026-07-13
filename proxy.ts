import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {

  const authCookie = request.cookies
    .getAll()
    .find((cookie) =>
      cookie.name.includes("auth-token")
    );

  if (!authCookie) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  return NextResponse.next();

}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/vendor/:path*",
    "/rider/:path*",
    "/manager/:path*",
    "/admin/:path*",
    "/hr/:path*",
    "/finance/:path*",
  ],
};