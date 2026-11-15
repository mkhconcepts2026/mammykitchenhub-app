import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

const EMPLOYEE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    // Authenticate HR through the same effective-role check used by the
    // existing certified safe-deactivation route.
    const supabase = await createClient();
    const {
      data: { user },
      error: authUserError,
    } = await supabase.auth.getUser();

    if (authUserError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data: callerRole, error: callerRoleError } =
      await (supabase as any).rpc("current_effective_app_role");

    if (callerRoleError || String(callerRole ?? "").toUpperCase() !== "HR") {
      return NextResponse.json(
        { success: false, message: "Forbidden. Only active HR users may activate employee accounts." },
        { status: 403 }
      );
    }

    let body: { employeeId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    if (!EMPLOYEE_ID_PATTERN.test(employeeId)) {
      return NextResponse.json(
        { success: false, message: "A valid employee ID is required." },
        { status: 400 }
      );
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, profile_id, status, employment_status")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup failed during activation:", employeeError);
      return NextResponse.json(
        { success: false, message: "Unable to look up the employee." },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Employee not found." },
        { status: 404 }
      );
    }

    if (!employee.profile_id) {
      return NextResponse.json(
        { success: false, message: "This employee has no linked login profile and cannot be activated." },
        { status: 409 }
      );
    }

    const employeeStatus = String(employee.status ?? "").trim().toLowerCase();
    const employmentStatus = String(employee.employment_status ?? "").trim().toLowerCase();
    if (employeeStatus !== "inactive" || employmentStatus !== "terminated") {
      return NextResponse.json(
        {
          success: false,
          message: "Only employees deactivated through the existing HR safe-deactivation workflow can use Activate Account. Onboarding employees must remain in the HR approval workflow.",
        },
        { status: 409 }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, status")
      .eq("id", employee.profile_id)
      .maybeSingle();

    if (profileError) {
      console.error("Employee profile lookup failed during activation:", profileError);
      return NextResponse.json(
        { success: false, message: "Unable to verify the employee login profile." },
        { status: 500 }
      );
    }

    if (!profile || String(profile.status ?? "").trim().toLowerCase() !== "inactive") {
      return NextResponse.json(
        { success: false, message: "The employee and login profile are not in the expected inactive state. No changes were made." },
        { status: 409 }
      );
    }

    // Lift the Auth ban first. The profile remains inactive until the SQL
    // transaction succeeds, so login and application role checks still deny
    // access if the database activation is rejected.
    const { error: unbanError } = await adminClient.auth.admin.updateUserById(
      employee.profile_id,
      { ban_duration: "none" }
    );

    if (unbanError) {
      console.error("Employee Auth unban failed:", unbanError);
      return NextResponse.json(
        { success: false, message: "Supabase Auth could not restore this login. The employee remains inactive." },
        { status: 502 }
      );
    }

    const { data: result, error: activationError } = await adminClient.rpc(
      "hr_activate_employee_safely",
      {
        p_employee_id: employee.id,
        p_actor_id: user.id,
      }
    );

    if (activationError || !result || result.success !== true) {
      console.error("Employee database activation failed:", activationError || result);

      // Best-effort rollback of the Auth unban. The profile remains inactive
      // if the transactional SQL function rejects the activation.
      const { error: rebanError } = await adminClient.auth.admin.updateUserById(
        employee.profile_id,
        { ban_duration: "876000h" }
      );
      if (rebanError) {
        console.error("Auth re-ban after failed activation also failed:", rebanError);
      }

      return NextResponse.json(
        {
          success: false,
          message: rebanError
            ? "Database activation failed. The profile remains inactive, but Auth re-banning could not be confirmed; review this Auth user before closing the task."
            : "The employee could not be activated. No employee/profile database changes were committed, and the Auth ban was restored.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Employee account activated. Existing role and operational assignments were left unchanged; revoked access assignments were not restored.",
      employeeId: employee.id,
      historicalRecordRetained: true,
      assignmentsChanged: false,
    });
  } catch (error: unknown) {
    console.error("Employee activation error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred while activating the employee account." },
      { status: 500 }
    );
  }
}
