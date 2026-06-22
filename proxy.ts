import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {

  const path = request.nextUrl.pathname;

  const authCookie =
    request.cookies.getAll()
      .find(cookie =>
        cookie.name.includes("auth-token")
      );

  if (!authCookie) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  const role =
    request.cookies.get("user-role")?.value;

  console.log("ROLE COOKIE:", role);
  console.log("PATH:", path);

  if (
    path.startsWith("/admin") &&
    role !== "admin"
  ) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  if (
    path.startsWith("/vendor") &&
    role !== "vendor"
  ) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }
/*
  if (
    path.startsWith("/manager") &&
    role !== "manager"
  ) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }
*/

  if (
    path.startsWith("/rider") &&
    role !== "rider"
  ) {
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
  ],
};