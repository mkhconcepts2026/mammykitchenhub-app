import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { prepareEmployee } from "@/lib/employees/provisioning";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const employee = await prepareEmployee(body);

    const { data, error } = await adminClient
      .from("employees")
      .insert({
        employee_number: employee.employeeNumber,

        first_name: employee.firstName,
        last_name: employee.lastName,
        gender: employee.gender,
        nationality: employee.nationality,
        address: employee.address,

        photo_url: employee.photoUrl,

        department_id: employee.departmentId,
        role_id: employee.roleId,
        reports_to: employee.reportsTo || null,

        state_id: employee.stateId || null,
        lga_id: employee.lgaId || null,
        territory_id: employee.territoryId || null,

        office_location: employee.officeLocation || null,

        employment_type:
          employee.employmentType || "Full Time",

        employment_status: "Pending Activation",

        email: employee.email,
        username: employee.username,

        created_by: null,
      })
      .select()
      .single();

    if (error) {
      console.error(error);

await adminClient
  .from("employee_drafts")
  .update({
    status: "completed",
  })
  .eq("created_by", body.createdBy)
  .eq("status", "draft");

      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: 400,
        }
      );
    }

if (body.createdBy) {
  await adminClient
    .from("employee_drafts")
    .delete()
    .eq("created_by", body.createdBy)
    .eq("status", "draft");
}

    return NextResponse.json({
      success: true,
      employee: data,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}