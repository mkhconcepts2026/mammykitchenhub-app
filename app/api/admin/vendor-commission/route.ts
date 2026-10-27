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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  try {
    // Search/pagination endpoint. Never load the full vendor table into the browser.
    if (view === "vendors") {
      const rawSearch = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
      // Require two characters before substring matching to avoid broad one-character scans.
      if (rawSearch.length === 1) {
        return NextResponse.json({
          success: true,
          vendors: [],
          agreements: [],
          rollout: [],
          totalCount: 0,
          page: 1,
          pageSize: 20,
          queryTooShort: true,
        });
      }

      // Remove PostgREST filter grammar and wildcard characters from user input, while preserving
      // normal vendor names such as "Mama's Kitchen".
      const search = rawSearch.replace(/[%,_*()\\]/g, " ").replace(/\s+/g, " ").trim();
      if (rawSearch.length > 0 && search.length < 2) {
        return NextResponse.json({
          success: true,
          vendors: [],
          agreements: [],
          rollout: [],
          totalCount: 0,
          page: 1,
          pageSize: 20,
          queryTooShort: true,
        });
      }
      const pageSize = 20;
      const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
      const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), 100000) : 1;
      const activeOnly = url.searchParams.get("activeOnly") === "true";
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let vendorQuery = adminClient
        .from("vendors")
        .select("id, name, email, status", { count: "exact" })
        .order("name", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to);

      if (activeOnly) vendorQuery = vendorQuery.ilike("status", "active");
      if (search.length >= 2) {
        vendorQuery = vendorQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const vendorsResult = await vendorQuery;
      if (vendorsResult.error) {
        console.error("Vendor commission vendor search failed:", vendorsResult.error.message);
        return NextResponse.json(
          { success: false, message: "Vendor search failed. Please refine the search and try again." },
          { status: 500 },
        );
      }

      const vendors = vendorsResult.data ?? [];
      const vendorIds = vendors.map((vendor) => vendor.id);
      let agreements: unknown[] = [];
      let rollout: unknown[] = [];
      let rolloutUnavailable = false;

      if (vendorIds.length) {
        const [agreementsResult, rolloutResult] = await Promise.all([
          adminClient
            .from("vendor_commission_agreements")
            .select("id, vendor_id, agreement_version, agreement_type, commission_rate, policy_version, status, offered_at, accepted_at, effective_from, effective_to, terms_snapshot")
            .in("vendor_id", vendorIds)
            .order("offered_at", { ascending: false })
            .limit(1000),
          adminClient
            .from("vendor_commission_rollout")
            .select("vendor_id, rollout_mode, reason, updated_at")
            .in("vendor_id", vendorIds),
        ]);

        if (agreementsResult.error) {
          console.error("Vendor commission agreement lookup failed:", agreementsResult.error.message);
          return NextResponse.json({ success: false, message: "Vendor agreement records could not be loaded." }, { status: 500 });
        }
        agreements = agreementsResult.data ?? [];
        rolloutUnavailable = Boolean(rolloutResult.error);
        rollout = rolloutResult.error ? [] : rolloutResult.data ?? [];
      }

      return NextResponse.json({
        success: true,
        vendors,
        agreements,
        rollout,
        totalCount: vendorsResult.count ?? 0,
        page,
        pageSize,
        queryTooShort: false,
        warnings: rolloutUnavailable
          ? ["Vendor rollout classifications are temporarily unavailable for this result page."]
          : [],
      });
    }

    // Summary payload: only small, bounded data sets are returned here. Vendor rows are loaded
    // separately through view=vendors with server-side search and 20-row pagination.
    const [settingsResult, activeCountResult, offeredCountResult, acceptedCountResult, auditResult] =
      await Promise.all([
        adminClient
          .from("vendor_commission_settings")
          .select("id, commission_enforcement_enabled, minimum_rate, maximum_rate, allowed_rates, policy_version, updated_at")
          .eq("id", true)
          .single(),
        adminClient.from("vendors").select("id", { count: "exact", head: true }).ilike("status", "active"),
        adminClient.from("vendor_commission_agreements").select("id", { count: "exact", head: true }).eq("status", "offered"),
        adminClient.from("vendor_commission_agreements").select("id", { count: "exact", head: true }).eq("status", "accepted"),
        adminClient
          .from("vendor_commission_audit")
          .select("id, vendor_id, agreement_id, action, reason, created_at, before_state, after_state")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    const coreError = settingsResult.error || activeCountResult.error || offeredCountResult.error || acceptedCountResult.error;
    if (coreError || !settingsResult.data) {
      console.error("Vendor commission settings read failed:", coreError?.message);
      return NextResponse.json(
        {
          success: false,
          message: "Vendor commission data could not be loaded. Confirm the vendor commission SQL migrations have been run.",
        },
        { status: 500 },
      );
    }

    const audit = auditResult.data ?? [];
    const auditVendorIds = [...new Set(audit.map((entry) => entry.vendor_id).filter((id): id is string => Boolean(id)))];
    let auditVendors: unknown[] = [];
    if (auditVendorIds.length) {
      const auditVendorsResult = await adminClient
        .from("vendors")
        .select("id, name, email, status")
        .in("id", auditVendorIds);
      if (!auditVendorsResult.error) auditVendors = auditVendorsResult.data ?? [];
    }

    return NextResponse.json({
      success: true,
      settings: settingsResult.data,
      activeVendorCount: activeCountResult.count ?? 0,
      offeredCount: offeredCountResult.count ?? 0,
      acceptedCount: acceptedCountResult.count ?? 0,
      audit,
      auditVendors,
      warnings: [
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
      const selectedVendorResult = await adminClient
        .from("vendors")
        .select("id, name, status")
        .eq("id", vendorId)
        .maybeSingle();
      if (selectedVendorResult.error || !selectedVendorResult.data) {
        return NextResponse.json(
          { success: false, message: "The selected vendor could not be found." },
          { status: 404 },
        );
      }
      if (String(selectedVendorResult.data.status ?? "").toLowerCase() !== "active") {
        return NextResponse.json(
          { success: false, message: "Only active vendors can receive new commission offers." },
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
