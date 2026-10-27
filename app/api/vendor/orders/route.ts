import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to view orders." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("vendor_id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Vendor orders profile lookup failed:", profileError.message);
      return NextResponse.json(
        { success: false, message: "Unable to verify vendor account." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (
      !profile?.vendor_id ||
      profile.role?.toLowerCase() !== "vendor" ||
      profile.status?.toLowerCase() !== "active"
    ) {
      return NextResponse.json(
        { success: false, message: "An active vendor account is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: orders, error: ordersError } = await adminClient
      .from("orders")
      .select(`
        *,
        profiles!orders_user_id_fkey (
          full_name,
          phone,
          email
        )
      `)
      .eq("vendor_id", profile.vendor_id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Vendor orders lookup failed:", ordersError.message);
      return NextResponse.json(
        { success: false, message: "Unable to load vendor orders." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { success: true, orders: orders ?? [] },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error) {
    console.error("Vendor orders API failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load vendor orders." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}