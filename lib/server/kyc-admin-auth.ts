import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Server-side authorization shared by the Admin KYC endpoints. */
export async function authorizeKycAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

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

  // Match the roles currently admitted by the MKH Admin Dashboard.
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
