
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the caller.
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

    // 2. Authorize through the effective role assignment.
    const { data: callerRole, error: callerRoleError } =
      await (supabase as any).rpc("current_effective_app_role");

    if (
      callerRoleError ||
      String(callerRole ?? "").toUpperCase() !== "HR"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden. Only active HR users may delete employee records.",
        },
        { status: 403 }
      );
    }

    // 3. Validate the request body.
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
      typeof body.employeeId === "string"
        ? body.employeeId.trim()
        : "";

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(employeeId)) {
      return NextResponse.json(
        { success: false, message: "A valid employee ID is required." },
        { status: 400 }
      );
    }

    // 4. Find the employee and linked profile, if any.
    const { data: employee, error: employeeError } =
      await adminClient
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

    // 5. Delete the employee record first.
    // Foreign keys protect records that must not be deleted.
    const { error: deleteEmployeeError } =
      await adminClient
        .from("employees")
        .delete()
        .eq("id", employee.id);

    if (deleteEmployeeError) {
      console.error(
        "Employee deletion blocked:",
        deleteEmployeeError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "The employee could not be deleted because related records may still depend on it. Review the employee's assignments and relationships.",
        },
        { status: 409 }
      );
    }

    // 6. If there is no linked profile, the employee record
    // is deleted; do not call Supabase Auth with a null ID.
    if (!employee.profile_id) {
      return NextResponse.json({
        success: true,
        message: "Employee record deleted. No linked profile existed.",
      });
    }

    // 7. Remove the linked Auth account.
    // The linked profile's FK relationships may prevent deletion.
    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(employee.profile_id);

    if (authDeleteError) {
      console.error(
        "Linked Auth account deletion failed:",
        authDeleteError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "The employee record was deleted, but the linked login account could not be deleted. Further cleanup is required.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Employee and linked login account deleted successfully.",
    });
  } catch (error: unknown) {
    console.error("Employee deletion error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while deleting the employee.",
      },
      { status: 500 }
    );
  }
}
