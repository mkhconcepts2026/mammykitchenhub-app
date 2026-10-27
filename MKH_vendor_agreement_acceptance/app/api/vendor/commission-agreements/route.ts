import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, private" };

type VendorContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  vendorId: string;
};

async function resolveVendor(): Promise<
  | { context: VendorContext }
  | { response: ReturnType<typeof NextResponse.json> }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { success: false, message: "Please sign in to your vendor account." },
        { status: 401, headers: NO_STORE },
      ),
    };
  }

  // Use the server-side admin client only after authenticating the request.
  // The service-role key never reaches browser code.
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,status,vendor_id")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    String(profile.status ?? "").toLowerCase() !== "active" ||
    !profile.vendor_id
  ) {
    return {
      response: NextResponse.json(
        {
          success: false,
          message:
            "This signed-in profile is not actively linked to a vendor. Contact MKH support if this is unexpected.",
        },
        { status: 403, headers: NO_STORE },
      ),
    };
  }

  return {
    context: {
      supabase,
      userId: user.id,
      vendorId: String(profile.vendor_id),
    },
  };
}

export async function GET() {
  const resolved = await resolveVendor();
  if ("response" in resolved) return resolved.response;

  const { vendorId } = resolved.context;
  const [{ data: vendor, error: vendorError }, { data: agreements, error: agreementError }, { data: settings, error: settingsError }] =
    await Promise.all([
      adminClient.from("vendors").select("id,name,status").eq("id", vendorId).maybeSingle(),
      adminClient
        .from("vendor_commission_agreements")
        .select(
          "id,agreement_version,agreement_type,commission_rate,policy_version,status,offered_at,accepted_at,effective_from,effective_to,terms_snapshot",
        )
        .eq("vendor_id", vendorId)
        .order("offered_at", { ascending: false })
        .limit(50),
      adminClient
        .from("vendor_commission_settings")
        .select("commission_enforcement_enabled,policy_version")
        .eq("id", true)
        .maybeSingle(),
    ]);

  if (vendorError || agreementError || settingsError) {
    console.error("Vendor commission agreement load failed", {
      vendor: vendorError?.message,
      agreements: agreementError?.message,
      settings: settingsError?.message,
    });
    return NextResponse.json(
      { success: false, message: "Unable to load commission agreements right now." },
      { status: 500, headers: NO_STORE },
    );
  }

  if (!vendor) {
    return NextResponse.json(
      { success: false, message: "Your linked vendor record could not be found." },
      { status: 403, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      success: true,
      vendor: { id: vendor.id, name: vendor.name, status: vendor.status },
      commissionEnforcementEnabled: Boolean(settings?.commission_enforcement_enabled),
      currentPolicyVersion: settings?.policy_version ?? null,
      agreements: agreements ?? [],
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const resolved = await resolveVendor();
  if ("response" in resolved) return resolved.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The request body must be valid JSON." },
      { status: 400, headers: NO_STORE },
    );
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const action = String(payload.action ?? "").trim().toLowerCase();
  const agreementId = String(payload.agreementId ?? "").trim();
  const reason = String(payload.reason ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agreementId)) {
    return NextResponse.json(
      { success: false, message: "Choose a valid commission offer." },
      { status: 400, headers: NO_STORE },
    );
  }

  // This RPC relies on auth.uid(), so call it through the signed-in request client,
  // not the service-role client. The database function also verifies vendor ownership.
  if (action === "accept") {
    const { data, error } = await resolved.context.supabase.rpc(
      "mkh_accept_vendor_commission_agreement",
      { p_agreement_id: agreementId },
    );
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message || "The offer could not be accepted." },
        { status: 400, headers: NO_STORE },
      );
    }
    return NextResponse.json({ success: true, result: data }, { headers: NO_STORE });
  }

  if (action === "decline") {
    if (reason.length < 5) {
      return NextResponse.json(
        { success: false, message: "Please provide a reason of at least five characters." },
        { status: 400, headers: NO_STORE },
      );
    }
    const { data, error } = await resolved.context.supabase.rpc(
      "mkh_decline_vendor_commission_agreement",
      { p_agreement_id: agreementId, p_reason: reason },
    );
    if (error) {
      const migrationHint = /function .*mkh_decline_vendor_commission_agreement.*does not exist/i.test(
        error.message,
      )
        ? " The required vendor-offer decline migration has not been applied yet. Please contact MKH Admin."
        : "";
      return NextResponse.json(
        { success: false, message: `${error.message || "The offer could not be declined."}${migrationHint}` },
        { status: 400, headers: NO_STORE },
      );
    }
    return NextResponse.json({ success: true, result: data }, { headers: NO_STORE });
  }

  return NextResponse.json(
    { success: false, message: "Unsupported action. Choose accept or decline." },
    { status: 400, headers: NO_STORE },
  );
}
