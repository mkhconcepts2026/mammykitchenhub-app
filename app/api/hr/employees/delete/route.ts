import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Authenticate the HR operator using their normal user session.
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

    // Preserve the existing effective-role authorization rule.
    const { data: callerRole, error: callerRoleError } =
      await (supabase as any).rpc("current_effective_app_role");

    if (
      callerRoleError ||
      String(callerRole ?? "").toUpperCase() !== "HR"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden. Only active HR users may remove employees from the active roster.",
        },
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

    const employeeId =
      typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(employeeId)) {
      return NextResponse.json(
        { success: false, message: "A valid employee ID is required." },
        { status: 400 }
      );
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, profile_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup failed:", employeeError);
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

    // One database transaction deactivates the employee, revokes their
    // effective assignments, and records an audit event. Historical rows
    // that reference the employee are deliberately retained.
    const { data: result, error: deactivationError } = await adminClient.rpc(
      "hr_deactivate_employee_safely",
      {
        p_employee_id: employee.id,
        p_actor_id: user.id,
      }
    );

    if (deactivationError) {
      console.error("Employee deactivation failed:", deactivationError);
      return NextResponse.json(
        {
          success: false,
          message:
            "The employee could not be removed from the active roster. No partial database changes were committed. Check the server log for details.",
        },
        { status: 409 }
      );
    }

    if (!result || result.success !== true) {
      return NextResponse.json(
        {
          success: false,
          message: "The database did not confirm employee deactivation.",
        },
        { status: 500 }
      );
    }

    // Ban the linked Auth user after the DB transaction succeeds. The profile
    // is also made inactive by the transaction, so the app role is revoked.
    // If Auth banning fails, report the partial security condition clearly.
    let authBanWarning: string | null = null;
    if (employee.profile_id) {
      const { error: authBanError } = await adminClient.auth.admin.updateUserById(
        employee.profile_id,
        { ban_duration: "876000h" }
      );

      if (authBanError) {
        console.error("Employee Auth ban failed:", authBanError);
        authBanWarning =
          "The employee is marked inactive and app access is revoked, but the Auth sign-in ban could not be confirmed. Please review the Auth user before closing this task.";
      }
    }

    return NextResponse.json({
      success: true,
      message: authBanWarning
        ? authBanWarning
        : "Employee removed from the active roster. Login access revoked; historical HR and audit records retained.",
      historicalRecordRetained: true,
      authBanWarning,
    });
  } catch (error: unknown) {
    console.error("Employee deactivation error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while removing the employee from the active roster.",
      },
      { status: 500 }
    );
  }
}
