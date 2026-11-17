import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Please sign in again." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || String(profile.role ?? "").toLowerCase() !== "rider" || String(profile.status ?? "").toLowerCase() !== "active") {
      return NextResponse.json({ success: false, message: "An active rider account is required." }, { status: 403 });
    }

    const { data: wallets, error: walletError } = await adminClient
      .from("rider_wallets")
      .select("rider_id, available_balance, pending_balance, lifetime_earnings, updated_at")
      .eq("rider_id", user.id);

    if (walletError) {
      return NextResponse.json({ success: false, message: "Unable to load your rider wallet." }, { status: 500 });
    }

    if ((wallets ?? []).length > 1) {
      return NextResponse.json({ success: false, message: "Multiple wallet records require Finance review." }, { status: 409 });
    }

    return NextResponse.json(
      { success: true, active: Boolean(wallets?.length), wallet: wallets?.[0] ?? null },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error) {
    console.error("Rider wallet read failed:", error);
    return NextResponse.json({ success: false, message: "Unable to load your rider wallet." }, { status: 500 });
  }
}
