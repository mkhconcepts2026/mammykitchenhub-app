import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      setAll: (values) => { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
    },
  });
  const { data: auth, error: authError } = await sessionClient.auth.getUser();
  if (authError || !auth.user) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) } as const;
  const { data: role, error: roleError } = await sessionClient.rpc("current_effective_app_role");
  if (roleError || !["ADMIN", "COO"].includes(String(role ?? "").toUpperCase())) {
    return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) } as const;
  }
  const db = createSupabaseClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  return { db, actorId: auth.user.id } as const;
}

export async function GET() {
  const context = await getAdminContext();
  if ("response" in context) return context.response;
  const { db } = context;
  const [employeesRes, rolesRes, profilesRes, zonesRes, vendorsRes] = await Promise.all([
    db.from("employees").select("id, profile_id, first_name, last_name, email, username, role_id, zone_id, assigned_vendor_id, status, employment_status").order("first_name"),
    db.from("employee_roles").select("id, name, system_role, status"),
    db.from("profiles").select("id, role, full_name, email, status"),
    db.from("zones").select("id, name, code, territory_id, is_active").eq("is_active", true).order("name"),
    db.from("vendors").select("id, name, status").order("name"),
  ]);
  const error = employeesRes.error || rolesRes.error || profilesRes.error || zonesRes.error || vendorsRes.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const roles = rolesRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const zones = zonesRes.data ?? [];
  const vendors = vendorsRes.data ?? [];
  const allEmployees = (employeesRes.data ?? []).map((employee: any) => {
    const role = roles.find((r: any) => r.id === employee.role_id);
    const profile = profiles.find((p: any) => p.id === employee.profile_id);
    return { ...employee, role_name: role?.name ?? "", system_role: role?.system_role ?? profile?.role ?? "", display_name: [employee.first_name, employee.last_name].filter(Boolean).join(" ") || profile?.full_name || employee.email || profile?.email || employee.username || "Employee" };
  }).filter((employee: any) => {
    const key = String(employee.system_role ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return key.includes("ZM") || key.includes("ZONEMANAGER") || key.includes("ZONALMANAGER") || key.includes("ZONALMANAGER") || key.includes("VHA") || key.includes("VENDORHUBAGENT");
  });
  return NextResponse.json({ employees: allEmployees, zones, vendors });
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext();
  if ("response" in context) return context.response;
  const { db, actorId } = context;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const employeeId = typeof body?.employee_id === "string" ? body.employee_id : "";
  const assignmentType = body?.assignment_type;
  const targetId = typeof body?.target_id === "string" && body.target_id ? body.target_id : null;
  if (!employeeId || !["zone", "vendor"].includes(assignmentType)) return NextResponse.json({ error: "Employee and valid assignment type are required." }, { status: 400 });
  const { data: employee, error: employeeError } = await db.from("employees").select("id, role_id, profile_id").eq("id", employeeId).maybeSingle();
  if (employeeError) return NextResponse.json({ error: employeeError.message }, { status: 500 });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  const [{ data: role, error: roleError }, { data: profile, error: profileError }] = await Promise.all([
    db.from("employee_roles").select("system_role, name").eq("id", employee.role_id).maybeSingle(),
    db.from("profiles").select("role").eq("id", employee.profile_id).maybeSingle(),
  ]);
  if (roleError || profileError) return NextResponse.json({ error: roleError?.message || profileError?.message }, { status: 500 });
  const roleKey = String(role?.system_role ?? profile?.role ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isZm = roleKey.includes("ZM") || roleKey.includes("ZONEMANAGER") || roleKey.includes("ZONALMANAGER");
  const isVha = roleKey.includes("VHA") || roleKey.includes("VENDORHUBAGENT");
  if ((assignmentType === "zone" && !isZm) || (assignmentType === "vendor" && !isVha)) return NextResponse.json({ error: "Assignment type does not match this employee's role." }, { status: 422 });
  if (targetId) {
    const table = assignmentType === "zone" ? "zones" : "vendors";
    let check = db.from(table).select("id").eq("id", targetId);
    if (assignmentType === "zone") check = check.eq("is_active", true) as any;
    const { data: target, error: targetError } = await check.maybeSingle();
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: `Selected ${assignmentType} was not found or is inactive.` }, { status: 422 });
  }
  const column = assignmentType === "zone" ? "zone_id" : "assigned_vendor_id";
  const { error: updateError } = await db.from("employees").update({ [column]: targetId, updated_at: new Date().toISOString() }).eq("id", employeeId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  const { error: auditError } = await db.from("employee_audit_logs").insert({
    employee_id: employeeId,
    action: assignmentType === "zone" ? "ZONE_ASSIGNMENT_UPDATED" : "VENDOR_ASSIGNMENT_UPDATED",
    description: `${assignmentType === "zone" ? "Zone Manager zone" : "Vendor Hub Agent vendor"} assignment ${targetId ? "set to " + targetId : "cleared"} by administrator.`,
    performed_by: actorId,
  });
  if (auditError) return NextResponse.json({ error: `Assignment saved, but audit log failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ success: true });
}

