import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";

/**
 * Server-side authorization shared by the Admin KYC endpoints.
 *
 * Browser requests may provide the current Supabase access token explicitly.
 * The token is verified by Supabase and the effective role is still checked
 * server-side; the bearer header is not treated as proof of an Admin role.
 * Cookie authentication remains available for same-origin navigation/tools.
 */
export async function authorizeKycAdmin(request?: Request) {
  const authorization = request?.headers.get("authorization") ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = bearerMatch?.[1]?.trim() || null;

  const supabase = accessToken
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        },
      )
    : await createCookieClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken ?? undefined);

  if (userError || !user) {
    return {
      response: NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    } as const;
  }

  const { data: effectiveRole, error: roleError } = await (supabase as any).rpc(
    "current_effective_app_role",
  );
  const role = String(effectiveRole ?? "").toUpperCase();

  // Keep the exact Admin Dashboard role boundary. Never trust a role from the client.
  if (roleError || !["ADMIN", "COO"].includes(role)) {
    return {
      response: NextResponse.json(
        { success: false, message: "Forbidden. Admin access is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    } as const;
  }

  return { user, role } as const;
}
