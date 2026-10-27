import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, message: "Please sign in again." }, { status: 401 });
    const { data: profile, error: profileError } = await adminClient.from("profiles").select("vendor_id,role,status").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.vendor_id || String(profile.role ?? "").toLowerCase() !== "vendor" || String(profile.status ?? "").toLowerCase() !== "active") {
      return NextResponse.json({ success: false, message: "An active vendor account is required." }, { status: 403 });
    }
    const { data: wallet, error } = await adminClient.from("vendor_wallets").select("available_balance,pending_balance,lifetime_earnings").eq("vendor_id", profile.vendor_id).maybeSingle();
    if (error) {
      console.error("Vendor wallet lookup failed:", error);
      return NextResponse.json({ success: false, message: "Could not load this vendor's wallet." }, { status: 500 });
    }
    return NextResponse.json({ success: true, wallet: wallet ?? { available_balance: 0, pending_balance: 0, lifetime_earnings: 0 } }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Vendor payout wallet failed:", error);
    return NextResponse.json({ success: false, message: "An unexpected error occurred." }, { status: 500 });
  }
}