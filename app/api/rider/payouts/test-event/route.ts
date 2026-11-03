import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requirePaystackTestKey, riderJson } from "@/lib/rider-payouts/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.MKH_ENABLE_RIDER_PAYOUT_TEST_TOOLS !== "true") {
    return riderJson({ success: false, message: "TEST payout tools are disabled." }, 404);
  }
  try { requirePaystackTestKey(); }
  catch { return riderJson({ success: false, message: "A Paystack TEST key is required." }, 403); }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return riderJson({ success: false, message: "Authentication required." }, 401);
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    adminClient.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    supabase.rpc("current_effective_app_role"),
  ]);
  if (profileError || !profile || String(profile.status ?? "").toLowerCase() !== "active" || roleError || !["ADMIN", "FINANCE"].includes(String(role ?? "").toUpperCase())) {
    return riderJson({ success: false, message: "Admin or Finance access is required." }, 403);
  }

  let body: any;
  try { body = await request.json(); } catch { return riderJson({ success: false, message: "Invalid JSON." }, 400); }
  const reference = String(body?.reference ?? "");
  const eventType = String(body?.event_type ?? "");
  if (!reference || !["transfer.success", "transfer.failed", "transfer.reversed"].includes(eventType)) {
    return riderJson({ success: false, message: "Provide a payout reference and supported transfer event." }, 400);
  }
  const { data, error } = await adminClient.rpc("mkh_rider_apply_paystack_transfer_event", {
    p_reference: reference,
    p_event_type: eventType,
    p_transfer_code: typeof body?.transfer_code === "string" ? body.transfer_code : "TEST_SIMULATED",
    p_failure_reason: eventType === "transfer.success" ? null : "Authorised MKH TEST event simulation.",
  });
  if (error || !data?.success) return riderJson({ success: false, message: error?.message ?? data?.message ?? "Simulation failed." }, 422);
  return riderJson({ success: true, mode: "test", result: data });
}
