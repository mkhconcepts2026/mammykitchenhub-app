import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRole(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function failure(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function requireFinanceAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: failure("Your session has expired. Please sign in again.", 401),
    } as const;
  }

  const [{ data: profile, error: profileError }, { data: effectiveRole, error: roleError }] =
    await Promise.all([
      adminClient
        .from("profiles")
        .select("id, status, full_name, email, role")
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
      response: failure("An active Finance account is required.", 403),
    } as const;
  }

  if (roleError || !["finance", "admin", "coo"].includes(normalizeRole(effectiveRole))) {
    return {
      response: failure("Finance, Admin or COO access is required.", 403),
    } as const;
  }

  return { userId: user.id } as const;
}

const EXPECTED_PROFILE_ROLES: Record<string, string[]> = {
  trm: ["trm", "territory", "territoryrelationshipmanager"],
  zm: ["zm", "zonemanager", "zonalmanager"],
  vha: ["vha", "vendorhubagent"],
};

export async function GET() {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  const [registryResult, auditResult] = await Promise.all([
    adminClient
      .from("delivery_beneficiary_registry")
      .select("id, beneficiary_code, beneficiary_type, display_name, profile_id, wallet_id, is_active, verified_at, verified_by, notes")
      .in("beneficiary_type", ["trm", "zm", "vha"])
      .order("beneficiary_type")
      .order("display_name"),
    adminClient
      .from("delivery_beneficiary_verification_audit")
      .select("id, beneficiary_type, profile_id, wallet_id, performed_by, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (registryResult.error || auditResult.error) {
    console.error(
      "Beneficiary verification read failed:",
      registryResult.error?.message || auditResult.error?.message
    );
    return failure(
      "Unable to load beneficiary verification data. Confirm the verification migration has been applied.",
      500
    );
  }

  const registryRows = registryResult.data ?? [];
  const profileIds = [...new Set(
    registryRows.map((row: any) => row.profile_id).filter(Boolean)
  )] as string[];

  if (profileIds.length === 0) {
    return NextResponse.json({
      success: true,
      beneficiaries: [],
      audit: auditResult.data ?? [],
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const [profilesResult, walletsResult, employeesResult] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, full_name, email, role, status")
      .in("id", profileIds),
    adminClient
      .from("wallets")
      .select("id, owner_id, owner_type, available_balance, pending_balance, locked_balance, settled_balance, lifetime_earnings")
      .in("owner_id", profileIds),
    adminClient
      .from("employees")
      .select("id, profile_id, role_id, status, employment_status, territory_id, assigned_vendor_id")
      .in("profile_id", profileIds),
  ]);

  if (profilesResult.error || walletsResult.error || employeesResult.error) {
    console.error(
      "Beneficiary verification relationship lookup failed:",
      profilesResult.error?.message ||
      walletsResult.error?.message ||
      employeesResult.error?.message
    );
    return failure("Unable to resolve beneficiary profiles, wallets or employee assignments.", 500);
  }

  const employeeRows = employeesResult.data ?? [];
  const roleIds = [...new Set(
    employeeRows.map((row: any) => row.role_id).filter(Boolean)
  )] as string[];
  const employeeIds = employeeRows.map((row: any) => row.id).filter(Boolean) as string[];

  const [rolesResult, zoneAssignmentsResult] = await Promise.all([
    roleIds.length
      ? adminClient
          .from("employee_roles")
          .select("id, system_role, status")
          .in("id", roleIds)
      : Promise.resolve({ data: [], error: null } as any),
    employeeIds.length
      ? adminClient
          .from("zonal_manager_zones")
          .select("id, employee_id, zone_id, status")
          .in("employee_id", employeeIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (rolesResult.error || zoneAssignmentsResult.error) {
    console.error(
      "Beneficiary assignment lookup failed:",
      rolesResult.error?.message || zoneAssignmentsResult.error?.message
    );
    return failure("Unable to resolve employee roles or ZM zone assignments.", 500);
  }

  const assignedVendorIds = [...new Set(
    employeeRows.map((row: any) => row.assigned_vendor_id).filter(Boolean)
  )] as string[];

  const vendorZoneAssignmentsResult = assignedVendorIds.length
    ? await adminClient
        .from("zone_vendors")
        .select("vendor_id, zone_id, status, unassigned_at")
        .in("vendor_id", assignedVendorIds)
        .eq("status", "active")
        .is("unassigned_at", null)
    : { data: [], error: null } as any;

  if (vendorZoneAssignmentsResult.error) {
    console.error("Beneficiary vendor-zone lookup failed:", vendorZoneAssignmentsResult.error.message);
    return failure("Unable to resolve VHA vendor territory assignments.", 500);
  }
  const zoneIds = [...new Set([
    ...(zoneAssignmentsResult.data ?? []).map((row: any) => row.zone_id),
    ...(vendorZoneAssignmentsResult.data ?? []).map((row: any) => row.zone_id),
  ].filter(Boolean))] as string[];

  const zonesResult = zoneIds.length
    ? await adminClient
        .from("zones")
        .select("id, name, is_active, territory_id")
        .in("id", zoneIds)
    : { data: [], error: null } as any;

  if (zonesResult.error) {
    console.error("Beneficiary zone lookup failed:", zonesResult.error.message);
    return failure("Unable to verify ZM zone assignments.", 500);
  }

  const territoryIdsForLookup = [...new Set([
    ...employeeRows.map((row: any) => row.territory_id),
    ...(zonesResult.data ?? []).map((row: any) => row.territory_id),
  ].filter(Boolean))] as string[];

  const territoriesResult = territoryIdsForLookup.length
    ? await adminClient
        .from("territories")
        .select("id, name")
        .in("id", territoryIdsForLookup)
    : { data: [], error: null } as any;

  if (territoriesResult.error) {
    console.error("Beneficiary territory lookup failed:", territoriesResult.error.message);
    return failure("Unable to resolve beneficiary territory names.", 500);
  }

  const territoriesById = new Map<string, any>(
    (territoriesResult.data ?? []).map((row: any) => [row.id, row])
  );
  const profilesById = new Map<string, any>(
    (profilesResult.data ?? []).map((row: any) => [row.id, row])
  );
  const rolesById = new Map<string, any>(
    (rolesResult.data ?? []).map((row: any) => [row.id, row])
  );
  const zonesById = new Map<string, any>(
    (zonesResult.data ?? []).map((row: any) => [row.id, row])
  );

  const wallets = walletsResult.data ?? [];
  const employees = employeeRows;
  const zoneAssignments = zoneAssignmentsResult.data ?? [];

  const beneficiaries = registryRows.map((registry: any) => {
    const type = String(registry.beneficiary_type ?? "").toLowerCase();
    const expectedRoles = EXPECTED_PROFILE_ROLES[type] ?? [];

    const profile = registry.profile_id
      ? profilesById.get(registry.profile_id)
      : null;

    const profileRole = normalizeRole(profile?.role);
    const profileActive = String(profile?.status ?? "").toLowerCase() === "active";

    const linkedEmployees = employees.filter(
      (employee: any) => employee.profile_id === registry.profile_id
    );    const assignmentEmployee = linkedEmployees.length === 1 ? linkedEmployees[0] : null;


    const eligibleEmployees = linkedEmployees.filter((employee: any) => {
      const role = rolesById.get(employee.role_id);
      return (
        String(employee.status ?? "").toLowerCase() === "active" &&
        String(employee.employment_status ?? "").toLowerCase() === "active" &&
        String(role?.status ?? "").toLowerCase() === "active" &&
        expectedRoles.includes(normalizeRole(role?.system_role))
      );
    });

    const employee = eligibleEmployees.length === 1 ? eligibleEmployees[0] : null;
    const employeeRole = employee ? rolesById.get(employee.role_id) : null;

    const matchingWallets = wallets.filter(
      (wallet: any) =>
        wallet.owner_id === registry.profile_id &&
        wallet.owner_type === type
    );

    const wallet = matchingWallets.length === 1 ? matchingWallets[0] : null;

    const activeZoneAssignmentCount = employee
      ? zoneAssignments.filter((assignment: any) => {
          const zone = zonesById.get(assignment.zone_id);
          return (
            assignment.employee_id === employee.id &&
            String(assignment.status ?? "").toLowerCase() === "active" &&
            zone?.is_active === true
          );
        }).length
      : 0;

    const assignmentSourceEmployee = employee ?? assignmentEmployee;

    const beneficiaryZoneIds = type === "zm"
      ? zoneAssignments
          .filter((assignment: any) =>
            assignment.employee_id === assignmentSourceEmployee?.id &&
            String(assignment.status ?? "").toLowerCase() === "active"
          )
          .map((assignment: any) => assignment.zone_id)
      : type === "vha"
        ? (vendorZoneAssignmentsResult.data ?? [])
            .filter((assignment: any) =>
              assignment.vendor_id === assignmentSourceEmployee?.assigned_vendor_id
            )
            .map((assignment: any) => assignment.zone_id)
        : [];

    const beneficiaryTerritoryIdSet = new Set<string>();

    if (assignmentSourceEmployee?.territory_id) {
      beneficiaryTerritoryIdSet.add(String(assignmentSourceEmployee.territory_id));
    }

    for (const zoneId of beneficiaryZoneIds) {
      const zone = zonesById.get(zoneId);
      if (zone?.is_active === true && zone.territory_id) {
        beneficiaryTerritoryIdSet.add(String(zone.territory_id));
      }
    }

    const beneficiaryTerritories = Array.from(beneficiaryTerritoryIdSet)
      .map((id) => territoriesById.get(id))
      .filter(Boolean)
      .map((territory: any) => ({ id: territory.id, name: territory.name }));

    const territoryLabel = beneficiaryTerritories.length > 0
      ? beneficiaryTerritories.map((territory: any) => territory.name).join(", ")
      : "Unassigned / unresolved";
    const blockers: string[] = [];

    if (!profile) blockers.push("Beneficiary profile is missing.");
    else {
      if (!profileActive) blockers.push("Beneficiary profile is not active.");
      if (!expectedRoles.includes(profileRole)) blockers.push("Profile role does not match beneficiary type.");
    }

    if (eligibleEmployees.length !== 1) {
      blockers.push("Exactly one active employee assignment with the matching role is required.");
    }

    if (type === "trm" && !employee?.territory_id) {
      blockers.push("TRM requires a territory assignment.");
    }

    if (type === "zm" && activeZoneAssignmentCount < 1) {
      blockers.push("ZM requires at least one active zone assignment.");
    }

    if (type === "vha" && !employee?.assigned_vendor_id) {
      blockers.push("VHA requires a vendor assignment.");
    }

    if (matchingWallets.length !== 1) {
      blockers.push("Exactly one existing wallet with the correct owner mapping is required.");
    }

    if (wallet && registry.wallet_id !== wallet.id) {
      blockers.push("Registry wallet does not match the beneficiary wallet.");
    }

    if (
      registry.is_active === true ||
      registry.verified_at ||
      registry.verified_by
    ) {
      if (!(registry.is_active === true && registry.verified_at && registry.verified_by)) {
        blockers.push("Registry verification state requires manual reconciliation.");
      }
    }

    const alreadyVerified =
      registry.is_active === true &&
      Boolean(registry.verified_at) &&
      Boolean(registry.verified_by);

    return {
      registry_id: registry.id,
      beneficiary_code: registry.beneficiary_code,
      beneficiary_type: type,
      display_name: registry.display_name || profile?.full_name || "Beneficiary",
      profile_id: registry.profile_id,
      profile_role: profile?.role ?? null,
      profile_status: profile?.status ?? null,
      is_active: registry.is_active === true,
      verified_at: registry.verified_at,
      verified_by: registry.verified_by,
      wallet_id: registry.wallet_id,
      wallet_owner_type: wallet?.owner_type ?? null,
      wallet_owner_id: wallet?.owner_id ?? null,
      wallet_available_balance: wallet?.available_balance ?? null,
      wallet_pending_balance: wallet?.pending_balance ?? null,
      employee_status: employee?.status ?? null,
      employment_status: employee?.employment_status ?? null,
      employee_system_role: employeeRole?.system_role ?? null,
      territory_id: assignmentSourceEmployee?.territory_id ?? null,
      beneficiary_territories: beneficiaryTerritories,
      territory_ids: beneficiaryTerritories.map((territory: any) => territory.id),
      territory_label: territoryLabel,
      assigned_vendor_id: employee?.assigned_vendor_id ?? null,
      active_zone_assignment_count: activeZoneAssignmentCount,
      blockers,
      already_verified: alreadyVerified,
      eligible: !alreadyVerified && blockers.length === 0,
    };
  });

  return NextResponse.json({
    success: true,
    beneficiaries,
    audit: auditResult.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  let body: any;

  try {
    body = await request.json();
  } catch {
    return failure("Request body must be valid JSON.");
  }

  const beneficiaryType = String(body?.beneficiary_type ?? "").toLowerCase().trim();
  const profileId = String(body?.profile_id ?? "").trim();
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!["trm", "zm", "vha"].includes(beneficiaryType)) {
    return failure("Select a valid TRM, ZM or VHA beneficiary.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
    return failure("A valid beneficiary profile is required.");
  }

  if (reason.length < 5 || reason.length > 500) {
    return failure("Enter a verification reason between 5 and 500 characters.");
  }

  // The actor ID comes from the authenticated server session.
  // It is never accepted from the browser request body.
  const { data, error } = await adminClient.rpc(
    "mkh_verify_delivery_beneficiary",
    {
      p_beneficiary_type: beneficiaryType,
      p_profile_id: profileId,
      p_actor_id: access.userId,
      p_reason: reason,
    }
  );

  if (error) {
    console.error("Beneficiary verification failed:", error.message);
    return failure(error.message || "Beneficiary verification failed.", 422);
  }

  return NextResponse.json({
    success: true,
    message: data?.message || "Beneficiary verification completed.",
    result: data,
  }, { headers: { "Cache-Control": "no-store" } });
}