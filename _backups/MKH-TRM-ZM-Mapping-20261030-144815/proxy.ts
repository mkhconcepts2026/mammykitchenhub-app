import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isFinanceRoute = pathname === "/finance" || pathname.startsWith("/finance/");
  const authCookie = request.cookies.getAll().find((cookie) => cookie.name.includes("auth-token"));

  if (!authCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Other existing protected-route behavior is intentionally unchanged.
  if (!isFinanceRoute) {
    return NextResponse.next();
  }

  // FINANCE_ROUTE_GUARD: Finance UI is denied unless the effective app role is FINANCE.
  // Fail closed if Supabase configuration, identity verification, or role lookup fails.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login?access=denied", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    const redirect = NextResponse.redirect(new URL("/login?access=denied", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  const { data: effectiveRole, error: roleError } = await supabase.rpc("current_effective_app_role");
  const role = String(effectiveRole ?? "").trim().toUpperCase();
  if (roleError || role !== "FINANCE") {
    const redirect = NextResponse.redirect(new URL("/login?access=denied", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/vendor/:path*",
    "/vendor-dashboard-v2/:path*",
    "/rider/:path*",
    "/manager/:path*",
    "/admin/:path*",
    "/hr/:path*",
    "/finance/:path*",
  ],
};