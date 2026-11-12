import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET() {
  try {
    // Authenticate the caller using their normal session.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    // Only an authenticated user with the effective HR role may use the
    // server-side read. The service-role client is never exposed to the browser.
    const { data: callerRole, error: roleError } = await (supabase as any).rpc(
      "current_effective_app_role"
    );

    if (roleError || String(callerRole ?? "").toUpperCase() !== "HR") {
      return NextResponse.json(
        { success: false, message: "Forbidden. Only active HR users may view employee records." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const { data: employees, error: employeesError } = await adminClient
      .from("employees")
      .select(`
        *,
        department:department_id (name),
        role:role_id (name),
        state:state_id (name)
      `)
      .order("created_at", { ascending: false });

    if (employeesError) {
      console.error("HR employee list query failed:", employeesError);
      return NextResponse.json(
        { success: false, message: "Unable to load employee records." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const employeeRows = employees || [];
    const profileIds = Array.from(
      new Set(
        employeeRows
          .map((employee: any) => employee.profile_id)
          .filter((profileId: unknown): profileId is string =>
            typeof profileId === "string" && profileId.length > 0
          )
      )
    );

    let profileRows: any[] = [];

    if (profileIds.length > 0) {
      const { data: profiles, error: profilesError } = await adminClient
        .from("profiles")
        .select("id, must_change_password, status, role")
        .in("id", profileIds);

      if (profilesError) {
        console.error("HR linked-profile query failed:", profilesError);
        return NextResponse.json(
          { success: false, message: "Unable to load employee login-profile statuses." },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      profileRows = profiles || [];
    }

    const profilesById = new Map<string, any>(
      profileRows.map((profile: any) => [profile.id, profile] as [string, any])
    );

    const result = employeeRows.map((employee: any) => ({
      ...employee,
      profiles: profilesById.get(employee.profile_id) || null,
    }));

    return NextResponse.json(
      { success: true, employees: result },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error("HR employee list API failed:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred while loading employees." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}