import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export function normalizeOperationalRole(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type OperationalEmployeeContext = {
  userId: string;
  profile: {
    id: string;
    role: string | null;
    status: string | null;
    full_name: string | null;
    email: string | null;
    territory_id?: string | null;
  };
  employee: {
    id: string;
    profile_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string | null;
    employment_status: string | null;
    role_id: string;
    territory_id: string | null;
    zone_id: string | null;
    assigned_vendor_id: string | null;
  };
  employeeRole: {
    name: string;
    system_role: string;
    status: string;
  };
};

export type OperationalContextResult =
  | { context: OperationalEmployeeContext }
  | { response: NextResponse };

export async function requireOperationalEmployee(
  allowedRoleKinds: string[],
  label: string
): Promise<OperationalContextResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { success: false, message: "Please sign in again." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const { data: effectiveRole, error: effectiveRoleError } =
    await supabase.rpc("current_effective_app_role");

  if (
    effectiveRoleError ||
    !allowedRoleKinds.includes(normalizeOperationalRole(effectiveRole))
  ) {
    return {
      response: NextResponse.json(
        { success: false, message: `${label} dashboard access is required.` },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, status, full_name, email, territory_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      response: NextResponse.json(
        { success: false, message: "Your employee profile could not be verified." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  if (String(profile.status ?? "").trim().toLowerCase() !== "active") {
    return {
      response: NextResponse.json(
        { success: false, message: "Your employee account is not active." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  if (!allowedRoleKinds.includes(normalizeOperationalRole(profile.role))) {
    return {
      response: NextResponse.json(
        { success: false, message: "Your profile role does not match this dashboard." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const { data: employee, error: employeeError } = await adminClient
    .from("employees")
    .select("id, profile_id, first_name, last_name, email, status, employment_status, role_id, territory_id, zone_id, assigned_vendor_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (employeeError || !employee) {
    return {
      response: NextResponse.json(
        { success: false, message: "No linked HR employee record was found." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const employeeStatus = String(employee.status ?? "").trim().toLowerCase();
  const employmentStatus = String(employee.employment_status ?? "").trim().toLowerCase();
  if (
    employeeStatus !== "active" ||
    (employmentStatus && !["active", "onboarding"].includes(employmentStatus))
  ) {
    return {
      response: NextResponse.json(
        { success: false, message: "Your HR employee record is not active." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const { data: employeeRole, error: employeeRoleError } = await adminClient
    .from("employee_roles")
    .select("name, system_role, status")
    .eq("id", employee.role_id)
    .maybeSingle();

  if (
    employeeRoleError ||
    !employeeRole ||
    String(employeeRole.status ?? "").trim().toLowerCase() !== "active" ||
    !allowedRoleKinds.includes(normalizeOperationalRole(employeeRole.system_role))
  ) {
    return {
      response: NextResponse.json(
        { success: false, message: "Your HR role assignment does not match this dashboard." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  return {
    context: {
      userId: user.id,
      profile,
      employee,
      employeeRole,
    },
  };
}
