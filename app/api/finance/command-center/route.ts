import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRole(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function requireFinanceAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { success: false, message: "Your session has expired. Please sign in again." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    } as const;
  }

  const [{ data: profile, error: profileError }, { data: effectiveRole, error: roleError }] =
    await Promise.all([
      adminClient
        .from("profiles")
        .select("id, full_name, email, role, status")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.rpc("current_effective_app_role"),
    ]);

  if (
    profileError ||
    !profile ||
    String(profile.status ?? "").toLowerCase() !== "active"
  ) {
    return {
      response: NextResponse.json(
        { success: false, message: "An active Finance account is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    } as const;
  }

  const role = normalizeRole(effectiveRole);
  if (roleError || !["finance", "admin", "coo"].includes(role)) {
    return {
      response: NextResponse.json(
        { success: false, message: "Finance dashboard access is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    } as const;
  }

  return { userId: user.id, profile } as const;
}

export async function GET() {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  const [summaryResult, ridersResult, walletsResult] = await Promise.all([
    adminClient.rpc("mkh_finance_dashboard_command_summary"),
    adminClient
      .from("profiles")
      .select("id, full_name, email, phone, status")
      .ilike("role", "rider")
      .ilike("status", "active")
      .order("full_name", { ascending: true }),
    adminClient
      .from("rider_wallets")
      .select("rider_id, available_balance, pending_balance, lifetime_earnings, updated_at"),
  ]);

  const queryError = summaryResult.error || ridersResult.error || walletsResult.error;
  if (queryError) {
    console.error("Finance command center load failed:", queryError.message);
    return NextResponse.json(
      {
        success: false,
        message:
          "Finance data could not be loaded. Confirm the Finance Command Center TEST migration has been applied and the required tables are available.",
      },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }

  const walletsByRider = new Map<string, Array<Record<string, unknown>>>();
  for (const wallet of walletsResult.data ?? []) {
    const rows = walletsByRider.get(wallet.rider_id) ?? [];
    rows.push(wallet as unknown as Record<string, unknown>);
    walletsByRider.set(wallet.rider_id, rows);
  }

  type ActiveRiderProfile = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
  };
  const riders = (ridersResult.data ?? []).map((rider: ActiveRiderProfile) => {
    const rows = walletsByRider.get(rider.id) ?? [];
    return {
      ...rider,
      wallet: rows.length === 1 ? rows[0] : null,
      wallet_count: rows.length,
      wallet_issue: rows.length > 1 ? "multiple_wallet_rows" : null,
    };
  });

  return NextResponse.json(
    {
      success: true,
      generatedAt: new Date().toISOString(),
      profile: {
        full_name: access.profile.full_name,
        email: access.profile.email,
        role: access.profile.role,
      },
      summary: summaryResult.data,
      riders,
      riderCounts: {
        active: riders.length,
        withWallet: riders.filter((rider: { wallet_count: number }) => rider.wallet_count === 1).length,
        missingWallet: riders.filter((rider: { wallet_count: number }) => rider.wallet_count === 0).length,
        duplicateWallet: riders.filter((rider: { wallet_count: number }) => rider.wallet_count > 1).length,
      },
    },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}

export async function POST(request: NextRequest) {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "A valid JSON request is required." },
      { status: 400 }
    );
  }

  const riderId =
    body && typeof body === "object" && "rider_id" in body &&
    typeof (body as { rider_id?: unknown }).rider_id === "string"
      ? (body as { rider_id: string }).rider_id.trim()
      : "";

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(riderId)) {
    return NextResponse.json(
      { success: false, message: "A valid rider profile ID is required." },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient.rpc("mkh_finance_activate_rider_wallet", {
    p_rider_id: riderId,
  });

  if (error) {
    console.error("Rider wallet activation failed:", error.message);
    return NextResponse.json(
      { success: false, message: error.message || "Rider wallet activation failed." },
      { status: 422, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!data?.success) {
    return NextResponse.json(
      { success: false, message: data?.message ?? "Rider wallet activation could not be confirmed." },
      { status: 422, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { success: true, result: data },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}
