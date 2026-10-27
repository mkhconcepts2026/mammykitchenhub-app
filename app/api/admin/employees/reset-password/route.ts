
import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the requester.
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
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
          message: "Forbidden. Only active HR users may reset employee passwords.",
        },
        { status: 403 }
      );
    }

    // 3. Validate the request.
    let body: { profileId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const profileId =
      typeof body.profileId === "string"
        ? body.profileId.trim()
        : "";

    if (!profileId) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee profile ID is required.",
        },
        { status: 400 }
      );
    }

    // 4. Confirm the target belongs to an employee record.
    const { data: employee, error: employeeError } =
      await adminClient
        .from("employees")
        .select("profile_id")
        .eq("profile_id", profileId)
        .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup failed:", employeeError);

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify the employee.",
        },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message: "The requested employee was not found.",
        },
        { status: 404 }
      );
    }

    // 5. Generate a temporary password using a cryptographic RNG.
    const temporaryPassword =
      `MKH${randomInt(100000, 1000000)}!`;

    // 6. Reset the employee's Supabase Auth password.
    const { error: authError } =
      await adminClient.auth.admin.updateUserById(
        profileId,
        { password: temporaryPassword }
      );

    if (authError) {
      console.error("Password reset failed:", authError);

      return NextResponse.json(
        {
          success: false,
          message: "Password reset failed.",
        },
        { status: 400 }
      );
    }

    // 7. Require a password change at the next login.
    const { error: profileError } =
      await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", profileId);

    if (profileError) {
      console.error(
        "Failed to update password-change requirement:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "The password was reset, but the password-change requirement could not be updated. Contact support before retrying.",
        },
        { status: 500 }
      );
    }

    // 8. Preserve the response expected by EmployeeCredentialsModal.
    return NextResponse.json({
      success: true,
      temporaryPassword,
    });
  } catch (error: unknown) {
    console.error("Employee password reset error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while resetting the password.",
      },
      { status: 500 }
    );
  
  }
}
