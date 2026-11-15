import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthenticatedAdmin = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

type AuthResult =
  | { ok: true; context: AuthenticatedAdmin }
  | { ok: false; response: NextResponse };

async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const { data: roleData, error: roleError } = await (supabase as any).rpc(
    "current_effective_app_role",
  );
  const role = String(roleData ?? "").toUpperCase();

  if (roleError || !["ADMIN", "COO"].includes(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Forbidden. Admin or COO access is required." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, context: { supabase, userId: user.id } };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const [settingsResult, vendorsResult, agreementsResult, rolloutResult, auditResult] =
      await Promise.all([
        adminClient
          .from("vendor_commission_settings")
          .select(
            "id, commission_enforcement_enabled, minimum_rate, maximum_rate, allowed_rates, policy_version, updated_at",
          )
          .eq("id", true)
          .single(),
        adminClient
          .from("vendors")
          .select("id, name, email, status")
          .order("name", { ascending: true })
          .limit(1000),
        adminClient
          .from("vendor_commission_agreements")
          .select(
            "id, vendor_id, agreement_version, agreement_type, commission_rate, policy_version, status, offered_at, accepted_at, effective_from, effective_to, terms_snapshot",
          )
          .order("offered_at", { ascending: false })
          .limit(300),
        adminClient
          .from("vendor_commission_rollout")
          .select("vendor_id, rollout_mode, reason, updated_at"),
        adminClient
          .from("vendor_commission_audit")
          .select("id, vendor_id, agreement_id, action, reason, created_at, before_state, after_state")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    const coreError = settingsResult.error || vendorsResult.error || agreementsResult.error;
    if (coreError || !settingsResult.data) {
      console.error("Vendor commission settings read failed:", coreError?.message);
      return NextResponse.json(
        {
          success: false,
          message:
            "Vendor commission data could not be loaded. Confirm the vendor commission SQL migrations have been run.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      settings: settingsResult.data,
      vendors: vendorsResult.data ?? [],
      agreements: agreementsResult.data ?? [],
      rollout: rolloutResult.error ? [] : rolloutResult.data ?? [],
      audit: auditResult.error ? [] : auditResult.data ?? [],
      warnings: [
        ...(rolloutResult.error ? ["Vendor rollout classifications are temporarily unavailable."] : []),
        ...(auditResult.error ? ["Vendor commission audit history is temporarily unavailable."] : []),
      ],
    });
  } catch (error) {
    console.error("Vendor commission GET failed:", error);
    return NextResponse.json(
      { success: false, message: "Unexpected error loading vendor commission settings." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const action = String(body.action ?? "");
  const reason = String(body.reason ?? "").trim();
  if (reason.length < 5) {
    return NextResponse.json(
      { success: false, message: "Enter a meaningful reason of at least five characters." },
      { status: 400 },
    );
  }

  try {
    if (action === "update_policy") {
      const rawRates = body.allowedPercentages;
      if (!Array.isArray(rawRates)) {
        return NextResponse.json(
          { success: false, message: "Choose one or more allowed commission rates." },
          { status: 400 },
        );
      }

      const allowedPercentages = [...new Set(rawRates.map(Number))].sort((a, b) => a - b);
      if (
        allowedPercentages.length === 0 ||
        allowedPercentages.some((rate) => !Number.isInteger(rate) || rate < 5 || rate > 10)
      ) {
        return NextResponse.json(
          { success: false, message: "Allowed rates must be selected from 5% through 10%." },
          { status: 400 },
        );
      }

      const minimumRate = Math.min(...allowedPercentages) / 100;
      const maximumRate = Math.max(...allowedPercentages) / 100;
      const { data, error } = await (auth.context.supabase as any).rpc(
        "mkh_set_vendor_commission_policy",
        {
          p_minimum_rate: minimumRate,
          p_maximum_rate: maximumRate,
          p_allowed_rates: allowedPercentages.map((rate) => rate / 100),
          p_reason: reason,
        },
      );

      if (error) {
        return NextResponse.json(
          { success: false, message: error.message || "Policy update failed." },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: true, action, result: data });
    }

    if (action === "offer_agreement") {
      const vendorId = String(body.vendorId ?? "").trim();
      const agreementType = String(body.agreementType ?? "");
      const ratePercent = Number(body.ratePercent);
      const effectiveFromText = String(body.effectiveFrom ?? "").trim();
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(vendorId)) {
        return NextResponse.json(
          { success: false, message: "Select a valid vendor." },
          { status: 400 },
        );
      }
      if (!["percentage", "full_sales"].includes(agreementType)) {
        return NextResponse.json(
          { success: false, message: "Select a supported agreement type." },
          { status: 400 },
        );
      }
      if (agreementType === "percentage" && (!Number.isFinite(ratePercent) || ratePercent < 5 || ratePercent > 10)) {
        return NextResponse.json(
          { success: false, message: "Percentage commission must be between 5% and 10%." },
          { status: 400 },
        );
      }
      if (agreementType === "full_sales" && ratePercent !== 0) {
        return NextResponse.json(
          { success: false, message: "The full-sales agreement must explicitly use a 0% commission rate." },
          { status: 400 },
        );
      }

      let effectiveFrom: string | null = null;
      if (effectiveFromText) {
        const parsedDate = new Date(`${effectiveFromText}T00:00:00.000Z`);
        if (Number.isNaN(parsedDate.getTime())) {
          return NextResponse.json(
            { success: false, message: "Effective date is invalid." },
            { status: 400 },
          );
        }
        effectiveFrom = parsedDate.toISOString();
      }

      // The RPC runs using the authenticated user's session so auth.uid() and the database-side
      // ADMIN/COO guard remain effective. We intentionally never expose a global enforcement action.
      const { data, error } = await (auth.context.supabase as any).rpc(
        "mkh_offer_vendor_commission_agreement",
        {
          p_vendor_id: vendorId,
          p_agreement_type: agreementType,
          p_commission_rate: agreementType === "full_sales" ? 0 : ratePercent / 100,
          p_effective_from: effectiveFrom,
          p_reason: reason,
        },
      );

      if (error) {
        return NextResponse.json(
          { success: false, message: error.message || "Vendor commission offer could not be created." },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: true, action, agreementId: data });
    }

    return NextResponse.json(
      { success: false, message: "Unsupported action. Enforcement is intentionally not configurable here." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Vendor commission POST failed:", error);
    return NextResponse.json(
      { success: false, message: "Unexpected error updating vendor commission settings." },
      { status: 500 },
    );
  }
}
