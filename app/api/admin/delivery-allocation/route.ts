import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AllocationRole =
  | "rider_base"
  | "trm"
  | "zm"
  | "mkh_main"
  | "sg_global_alliance"
  | "vha";

const ALLOCATION_ROLES: AllocationRole[] = [
  "rider_base",
  "trm",
  "zm",
  "mkh_main",
  "sg_global_alliance",
  "vha",
];


async function getAdminClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      response: NextResponse.json(
        { error: "Server Supabase environment is incomplete." },
        { status: 500 },
      ),
    } as const;
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Some Server Component contexts are read-only. API Route handlers
          // normally permit cookie writes; authentication still uses getUser().
        }
      },
    },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return {
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    } as const;
  }

  // Read the role through the signed-in user's session before using the
  // service-role client. Never trust a role supplied by the browser.
  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  const role = String(profile?.role ?? "").toUpperCase();
  if (profileError || !["ADMIN", "COO"].includes(role)) {
    return {
      response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
    } as const;
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { authUser: userData.user, adminClient } as const;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const context = await getAdminClients();
  if ("response" in context) return context.response;

  const { adminClient } = context;

  const { data: activeVersion, error: activeError } = await adminClient
    .from("delivery_allocation_config_versions")
    .select("*")
    .eq("status", "active")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) return errorResponse(activeError.message, 500);

  const { data: draftVersion, error: draftError } = await adminClient
    .from("delivery_allocation_config_versions")
    .select("*")
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) return errorResponse(draftError.message, 500);

  const versionIds = [activeVersion?.id, draftVersion?.id].filter(
    (id): id is number => typeof id === "number",
  );

  let allItems: any[] = [];
  if (versionIds.length) {
    const { data, error } = await adminClient
      .from("delivery_allocation_config_items")
      .select("*")
      .in("config_version_id", versionIds)
      .order("id", { ascending: true });
    if (error) return errorResponse(error.message, 500);
    allItems = data ?? [];
  }

  const { data: audit, error: auditError } = await adminClient
    .from("delivery_allocation_config_audit")
    .select("id, config_version_id, action, action_at, reason, details, actor_id")
    .order("action_at", { ascending: false })
    .limit(25);

  if (auditError) return errorResponse(auditError.message, 500);

  const splitItems = (version: any) =>
    version ? allItems.filter((item) => item.config_version_id === version.id) : [];

  return NextResponse.json({
    active: activeVersion
      ? { version: activeVersion, items: splitItems(activeVersion) }
      : null,
    draft: draftVersion
      ? { version: draftVersion, items: splitItems(draftVersion) }
      : null,
    audit: audit ?? [],
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminClients();
  if ("response" in context) return context.response;

  const { adminClient, authUser } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.");
  }

  const action = String(body?.action ?? "");
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const actorId = authUser.id;

  if (!reason || reason.length < 5) {
    return errorResponse("Enter a change reason of at least 5 characters.");
  }
  if (reason.length > 500) return errorResponse("Change reason is too long.");

  let result: { data: any; error: any };

  if (action === "create_draft") {
    result = await adminClient.rpc("mkh_create_delivery_allocation_draft", {
      p_actor_id: actorId,
      p_change_reason: reason,
    });
  } else if (action === "set_item") {
    const configVersionId = Number(body?.config_version_id);
    const allocationRole = String(body?.allocation_role) as AllocationRole;
    const amount = Number(body?.amount);

    if (!Number.isInteger(configVersionId) || configVersionId <= 0) {
      return errorResponse("A valid draft configuration ID is required.");
    }
    if (!ALLOCATION_ROLES.includes(allocationRole)) {
      return errorResponse("Unknown allocation role.");
    }
    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) {
      return errorResponse("Allocation amount must be a valid non-negative amount.");
    }

    result = await adminClient.rpc("mkh_set_delivery_allocation_draft_item", {
      p_config_version_id: configVersionId,
      p_allocation_role: allocationRole,
      p_amount: amount,
      p_actor_id: actorId,
      p_reason: reason,
    });
  } else if (action === "set_fees") {
    const configVersionId = Number(body?.config_version_id);
    const baseDeliveryFee = Number(body?.base_delivery_fee);
    const platformFeeDefault = Number(body?.platform_fee_default);

    if (!Number.isInteger(configVersionId) || configVersionId <= 0) {
      return errorResponse("A valid draft configuration ID is required.");
    }
    if (
      !Number.isFinite(baseDeliveryFee) || baseDeliveryFee < 0 ||
      !Number.isFinite(platformFeeDefault) || platformFeeDefault < 0
    ) {
      return errorResponse("Base delivery and platform fees must be valid non-negative amounts.");
    }

    result = await adminClient.rpc("mkh_set_delivery_allocation_draft_fees", {
      p_config_version_id: configVersionId,
      p_base_delivery_fee: baseDeliveryFee,
      p_platform_fee_default: platformFeeDefault,
      p_actor_id: actorId,
      p_reason: reason,
    });
  } else if (action === "activate") {
    const configVersionId = Number(body?.config_version_id);
    if (!Number.isInteger(configVersionId) || configVersionId <= 0) {
      return errorResponse("A valid draft configuration ID is required.");
    }

    // Database function validates six roles and exact allocation/fee balance,
    // then activates the version atomically. It does not run payouts.
    result = await adminClient.rpc("mkh_activate_delivery_allocation_config", {
      p_config_version_id: configVersionId,
      p_actor_id: actorId,
      p_reason: reason,
    });
  } else {
    return errorResponse("Unsupported action.");
  }

  if (result.error) {
    return errorResponse(result.error.message || "Allocation settings operation failed.", 422);
  }

  return NextResponse.json({ success: true, data: result.data ?? null });
}
