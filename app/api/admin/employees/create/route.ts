import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { prepareEmployee } from "@/lib/employees/provisioning";

export async function POST(request: Request) {
  let authUserId: string | null = null;

  try {
    const body = await request.json();

    const employee = await prepareEmployee(body);

    // ---------------------------------------
    // Get Role Name
    // ---------------------------------------

    const { data: role, error: roleError } =
await adminClient
  .from("employee_roles")
  .select("name, system_role")
  .eq("id", employee.roleId)
  .single();

  console.log("ROLE RECORD:", role);
console.log("SYSTEM ROLE:", role?.system_role);

    if (roleError) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee role could not be found.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------
    // Temporary Password
    // ---------------------------------------

    const temporaryPassword =
      `MKH${Math.floor(100000 + Math.random() * 900000)}!`;

    // ---------------------------------------
    // Create Auth User
    // ---------------------------------------

    const {
      data: authUser,
      error: authError,
    } = await adminClient.auth.admin.createUser({
      email: employee.email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      return NextResponse.json(
        {
          success: false,
          message: authError?.message,
        },
        { status: 400 }
      );
    }

    authUserId = authUser.user.id;

    // ---------------------------------------
    // Create Profile FIRST
    // ---------------------------------------

    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({
        id: authUserId,

        full_name: `${employee.firstName} ${employee.lastName}`,

        email: employee.email,

        //phone: employee.phone,

        username: employee.username,

        role: role.system_role,

        status: "active",

        must_change_password: true,
      });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        {
          success: false,
          message: profileError.message,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------
    // Create Employee
    // ---------------------------------------

    const {
      data,
      error: employeeError,
    } = await adminClient
      .from("employees")
      .insert({
        profile_id: authUserId,

        employee_number: employee.employeeNumber,

        first_name: employee.firstName,
        last_name: employee.lastName,

        gender: employee.gender,
        nationality: employee.nationality,

        address: employee.address,

        //phone: employee.phone,

        photo_url: employee.photoUrl,

        department_id: employee.departmentId,

        role_id: employee.roleId,

        reports_to:
          employee.reportsTo || null,

        state_id:
          employee.stateId || null,

        lga_id:
          employee.lgaId || null,

        territory_id:
          employee.territoryId || null,

        office_location:
          employee.officeLocation || null,

        employment_type:
          employee.employmentType || "Full Time",

        hire_date:
          employee.hireDate || null,

        employment_status:
          "Pending Activation",

        email:
          employee.email,

        username:
          employee.username,

        created_by:
          body.createdBy || null,
      })
      .select()
      .single();

    if (employeeError) {

      await adminClient
        .from("profiles")
        .delete()
        .eq("id", authUserId);

      await adminClient.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        {
          success: false,
          message: employeeError.message,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------
    // Delete Draft
    // ---------------------------------------

    if (body.createdBy) {
      await adminClient
        .from("employee_drafts")
        .delete()
        .eq("created_by", body.createdBy)
        .eq("status", "draft");
    }

    // ---------------------------------------
    // Success
    // ---------------------------------------

    return NextResponse.json({
      success: true,

      employee: data,

      credentials: {
        employeeNumber: employee.employeeNumber,

        fullName:
          `${employee.firstName} ${employee.lastName}`,

        username:
          employee.username,

        loginId:
          employee.email,

        temporaryPassword,
      },
    });

  } catch (error: any) {

    if (authUserId) {

      await adminClient
        .from("profiles")
        .delete()
        .eq("id", authUserId);

      await adminClient.auth.admin.deleteUser(authUserId);

    }

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          error.message || "Employee creation failed.",
      },
      {
        status: 500,
      }
    );
  }
}