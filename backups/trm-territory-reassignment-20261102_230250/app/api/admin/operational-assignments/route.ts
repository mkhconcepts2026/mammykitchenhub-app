import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssignmentType = "territory" | "zone" | "vendor";

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function roleKind(value: unknown): AssignmentType | null {
  const role = normalize(value);
  if (["territory", "trm", "territoryrelationshipmanager", "territorymanager"].includes(role)) return "territory";
  if (["zm", "zonemanager", "zonalmanager"].includes(role)) return "zone";
  if (["vha", "vendorhubagent"].includes(role)) return "vendor";
  return null;
}

async function getAdminContext() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    return { response: NextResponse.json({ error: "Server Supabase environment is incomplete." }, { status: 500 }) } as const;
  }

  const cookieStore = await cookies();
  const sessionClient = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components may not be allowed to refresh cookies; getUser remains authoritative.
        }
      },
    },
  });

  const { data: auth, error: authError } = await sessionClient.auth.getUser();
  if (authError || !auth.user) {
    return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) } as const;
  }

  const { data: effectiveRole, error: roleError } = await sessionClient.rpc("current_effective_app_role");
  if (roleError || !["ADMIN", "COO"].includes(String(effectiveRole ?? "").toUpperCase())) {
    return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) } as const;
  }

  const db = createSupabaseClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { db, actorId: auth.user.id } as const;
}

export async function GET() {
  const context = await getAdminContext();
  if ("response" in context) return context.response;
  const { db } = context;

  const [
    employeesRes,
    rolesRes,
    profilesRes,
    territoriesRes,
    zonesRes,
    vendorsRes,
    trmAssignmentsRes,
    zmAssignmentsRes,
    vhaAssignmentsRes,
    accessAssignmentsRes,
  ] = await Promise.all([
    db.from("employees").select("id, profile_id, first_name, last_name, email, username, role_id, territory_id, zone_id, assigned_vendor_id, status, employment_status, created_at, updated_at").order("first_name"),
    db.from("employee_roles").select("id, name, system_role, status"),
    db.from("profiles").select("id, role, full_name, email, status, territory_id"),
    db.from("territories").select("id, name, lga_id, is_active, max_vendors, max_riders").eq("is_active", true).order("name"),
    db.from("zones").select("id, name, code, territory_id, is_active").eq("is_active", true).order("name"),
    db.from("vendors").select("id, name, status").eq("status", "active").order("name"),
    db.from("mkh_trm_territory_assignments").select("employee_id, territory_id, status, assigned_at").eq("status", "active"),
    db.from("zonal_manager_zones").select("employee_id, zone_id, status, assigned_at, unassigned_at").eq("status", "active").is("unassigned_at", null),
    db.from("vendor_hub_agent_assignments").select("employee_id, vendor_id, status, assigned_at, deactivated_at").eq("status", "active").is("deactivated_at", null),
    db.from("employee_access_assignments").select("employee_id, profile_id, role_id, is_active, effective_from, effective_until"),
  ]);

  const queryError = employeesRes.error || rolesRes.error || profilesRes.error || territoriesRes.error || zonesRes.error || vendorsRes.error || trmAssignmentsRes.error || zmAssignmentsRes.error || vhaAssignmentsRes.error || accessAssignmentsRes.error;
  if (queryError) {
    return NextResponse.json({
      error: `Unable to load assignment records. Apply the role-aware assignment SQL migration first if this is a new setup. Details: ${queryError.message}`,
    }, { status: 500 });
  }

  const roles = rolesRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const roleById = new Map(roles.map((role: any) => [role.id, role]));
  const profileById = new Map(profiles.map((profile: any) => [profile.id, profile]));
  const activeTrmRows = trmAssignmentsRes.data ?? [];
  const activeZmRows = zmAssignmentsRes.data ?? [];
  const activeVhaRows = vhaAssignmentsRes.data ?? [];
  const activeAccessRows = (accessAssignmentsRes.data ?? []).filter((assignment: any) => {
    const fromOk = !assignment.effective_from || new Date(assignment.effective_from).getTime() <= Date.now();
    const untilOk = !assignment.effective_until || new Date(assignment.effective_until).getTime() > Date.now();
    return assignment.is_active === true && fromOk && untilOk;
  });

  const latestByEmployee = <T extends { employee_id: string; assigned_at?: string | null }>(rows: T[]) => {
    const map = new Map<string, T>();
    [...rows].sort((a, b) => String(a.assigned_at ?? "").localeCompare(String(b.assigned_at ?? ""))).forEach((row) => map.set(row.employee_id, row));
    return map;
  };
  const trmByEmployee = latestByEmployee(activeTrmRows as any[]);
  const zmByEmployee = latestByEmployee(activeZmRows as any[]);
  const vhaByEmployee = latestByEmployee(activeVhaRows as any[]);

  const employees = (employeesRes.data ?? []).map((employee: any) => {
    const role: any = roleById.get(employee.role_id);
    const profile: any = profileById.get(employee.profile_id);
    const catalogKind = roleKind(role?.system_role);
    const profileKind = roleKind(profile?.role);
    const effectiveRoles = activeAccessRows
      .filter((assignment: any) => assignment.employee_id === employee.id || assignment.profile_id === employee.profile_id)
      .map((assignment: any) => roleById.get(assignment.role_id))
      .filter(Boolean);
    const effectiveConflict = effectiveRoles.some((effective: any) => roleKind(effective.system_role) !== catalogKind);
    const selectedTrm = trmByEmployee.get(employee.id) as any;
    const selectedZm = zmByEmployee.get(employee.id) as any;
    const selectedVha = vhaByEmployee.get(employee.id) as any;
    const currentTerritory = selectedTrm?.territory_id ?? employee.territory_id ?? profile?.territory_id ?? null;
    const currentZone = selectedZm?.zone_id ?? employee.zone_id ?? null;
    const currentVendor = selectedVha?.vendor_id ?? employee.assigned_vendor_id ?? null;

    return {
      id: employee.id,
      profile_id: employee.profile_id,
      display_name: [employee.first_name, employee.last_name].filter(Boolean).join(" ") || profile?.full_name || employee.email || profile?.email || employee.username || "Employee",
      email: employee.email || profile?.email || null,
      role_name: role?.name ?? "",
      system_role: role?.system_role ?? profile?.role ?? "",
      profile_role: profile?.role ?? "",
      employee_status: employee.status ?? null,
      employment_status: employee.employment_status ?? null,
      role_consistent: Boolean(catalogKind && catalogKind === profileKind && role?.status === "active" && !effectiveConflict),
      current_territory_id: currentTerritory,
      current_zone_id: currentZone,
      current_vendor_id: currentVendor,
      assignment_conflict: null,
    };
  }).filter((employee: any) => roleKind(employee.system_role) !== null);

  return NextResponse.json({
    employees,
    territories: territoriesRes.data ?? [],
    zones: zonesRes.data ?? [],
    vendors: vendorsRes.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext();
  if ("response" in context) return context.response;
  const { db, actorId } = context;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const employeeId = typeof body?.employee_id === "string" ? body.employee_id : "";
  const assignmentType = body?.assignment_type as AssignmentType;
  const targetId = typeof body?.target_id === "string" && body.target_id ? body.target_id : null;
  if (!employeeId || !["territory", "zone", "vendor"].includes(assignmentType)) {
    return NextResponse.json({ error: "Employee and a valid operational assignment type are required." }, { status: 400 });
  }

  let rpcName: string;
  let rpcArgs: Record<string, unknown>;

  if (assignmentType === "territory") {
    rpcName = targetId ? "mkh_admin_assign_trm_to_territory" : "mkh_admin_unassign_trm_from_territory";
    rpcArgs = targetId
      ? { p_employee_id: employeeId, p_territory_id: targetId, p_assigned_by: actorId }
      : { p_employee_id: employeeId, p_assigned_by: actorId };
  } else if (assignmentType === "zone") {
    rpcName = targetId ? "mkh_admin_assign_zm_to_zone" : "mkh_admin_unassign_zm_from_zone";
    rpcArgs = targetId
      ? { p_employee_id: employeeId, p_zone_id: targetId, p_assigned_by: actorId }
      : { p_employee_id: employeeId, p_assigned_by: actorId };
  } else if (targetId) {
    rpcName = "mkh_admin_assign_vha_to_vendor";
    rpcArgs = { p_employee_id: employeeId, p_vendor_id: targetId, p_assigned_by: actorId };
  } else {
    const { data: employee, error: employeeError } = await db
      .from("employees")
      .select("id, assigned_vendor_id")
      .eq("id", employeeId)
      .maybeSingle();
    if (employeeError) return NextResponse.json({ error: employeeError.message }, { status: 500 });
    if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    const { data: currentAssignment, error: assignmentError } = await db
      .from("vendor_hub_agent_assignments")
      .select("vendor_id")
      .eq("employee_id", employeeId)
      .eq("status", "active")
      .maybeSingle();
    if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    const currentVendorId = currentAssignment?.vendor_id ?? employee.assigned_vendor_id;
    if (!currentVendorId) return NextResponse.json({ success: true, already_unassigned: true });
    rpcName = "mkh_admin_unassign_vha_from_vendor";
    rpcArgs = { p_employee_id: employeeId, p_vendor_id: currentVendorId, p_assigned_by: actorId };
  }

  const { error } = await db.rpc(rpcName, rpcArgs as any);
  if (error) {
    const status = /administrator|authentication/i.test(error.message) ? 403 : 422;
    return NextResponse.json({ error: error.message || "Assignment was rejected." }, { status });
  }

  return NextResponse.json({ success: true });
}
