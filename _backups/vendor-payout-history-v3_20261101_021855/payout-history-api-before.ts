import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Please sign in again." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("vendor_id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile?.vendor_id ||
      String(profile.role ?? "").toLowerCase() !== "vendor" ||
      String(profile.status ?? "").toLowerCase() !== "active"
    ) {
      return NextResponse.json(
        { success: false, message: "An active vendor account is required." },
        { status: 403 }
      );
    }

    const { data: payouts, error: payoutError } = await adminClient
      .from("payout_requests")
      .select(
        "id, amount, status, requested_at, processed_at, rejection_reason"
      )
      .eq("requester_id", profile.vendor_id)
      .eq("requester_type", "vendor")
      .order("requested_at", { ascending: false })
      .limit(50);

    if (payoutError) {
      console.error("Vendor payout history lookup failed:", payoutError);

      return NextResponse.json(
        { success: false, message: "Could not load payout history." },
        { status: 500 }
      );
    }

    const history = payouts ?? [];
    const activeStatuses = new Set([
      "pending",
      "approved",
      "processing",
      "transfer_submitted",
      "on_hold",
    ]);

    const hasActivePayout = history.some((payout) =>
      activeStatuses.has(String(payout.status ?? "").toLowerCase())
    );

    return NextResponse.json({
      success: true,
      payouts: history,
      hasActivePayout,
    });
  } catch (error) {
    console.error("Vendor payout history failed:", error);

    return NextResponse.json(
      { success: false, message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
