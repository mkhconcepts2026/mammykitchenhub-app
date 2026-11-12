import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRole(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function requireFinanceAccess() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ success: false, message: "Please sign in again." }, { status: 401 }) } as const;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile || String(profile.status ?? "").toLowerCase() !== "active") {
    return { response: NextResponse.json({ success: false, message: "An active Finance account is required." }, { status: 403 }) } as const;
  }

  const { data: effectiveRole, error: roleError } = await supabase.rpc("current_effective_app_role");
  if (roleError || !["finance", "admin", "coo"].includes(normalizeRole(effectiveRole))) {
    return { response: NextResponse.json({ success: false, message: "Finance dashboard access is required." }, { status: 403 }) } as const;
  }

  return { userId: user.id } as const;
}

export async function GET() {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  const [summaryResult, ridersResult, walletsResult] = await Promise.all([
    adminClient.rpc("mkh_finance_dashboard_summary"),
    adminClient.from("profiles")
      .select("id, full_name, email, phone, status")
      .ilike("role", "rider")
      .eq("status", "active")
      .order("full_name"),
    adminClient.from("rider_wallets")
      .select("rider_id, available_balance, pending_balance, lifetime_earnings, updated_at"),
  ]);

  const queryError = summaryResult.error || ridersResult.error || walletsResult.error;
  if (queryError) {
    console.error("Finance control-room load failed:", queryError.message);
    return NextResponse.json(
      { success: false, message: "Unable to load the Finance control-room data. Confirm the Finance dashboard migration is installed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const walletsByRider = new Map<string, any[]>();
  for (const wallet of walletsResult.data ?? []) {
    const rows = walletsByRider.get(wallet.rider_id) ?? [];
    rows.push(wallet);
    walletsByRider.set(wallet.rider_id, rows);
  }

  const riders = (ridersResult.data ?? []).map((rider: any) => {
    const rows = walletsByRider.get(rider.id) ?? [];
    return {
      ...rider,
      wallet: rows.length === 1 ? rows[0] : null,
      wallet_count: rows.length,
      wallet_issue: rows.length > 1 ? "multiple_wallet_rows" : null,
    };
  });

  return NextResponse.json(
    { success: true, summary: summaryResult.data, riders },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}

export async function POST(request: NextRequest) {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "A valid JSON request is required." }, { status: 400 });
  }

  const riderId = typeof body?.rider_id === "string" ? body.rider_id.trim() : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(riderId)) {
    return NextResponse.json({ success: false, message: "A valid rider profile ID is required." }, { status: 400 });
  }

  const { data, error } = await adminClient.rpc("mkh_finance_activate_rider_wallet", {
    p_rider_id: riderId,
  });

  if (error) {
    console.error("Rider wallet activation failed:", error.message);
    return NextResponse.json(
      { success: false, message: error.message || "Rider wallet activation failed." },
      { status: 422 }
    );
  }

  if (!data?.success) {
    return NextResponse.json({ success: false, message: data?.message ?? "Rider wallet activation could not be confirmed." }, { status: 422 });
  }

  return NextResponse.json({ success: true, result: data }, { headers: { "Cache-Control": "no-store" } });
}
