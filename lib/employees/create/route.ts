import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { prepareEmployee } from "@/lib/employees/provisioning";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const employee = await prepareEmployee(body);

    const { data, error } = await supabase
      .from("employees")
      .insert({
        employee_number: employee.employeeNumber,

        first_name: employee.firstName,

        last_name: employee.lastName,

        phone: employee.phone,

        gender: employee.gender,

        nationality: employee.nationality,

        address: employee.address,

        department_id: employee.departmentId,

        role_id: employee.roleId,

        state_id: employee.stateId,

        lga_id: employee.lgaId || null,

        territory_id: employee.territoryId || null,

        office_location: employee.officeLocation,

        email: employee.email,

        username: employee.username,

        photo_url: employee.photoUrl,

        status: "Pending Approval",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      employee: data,
    });
  } catch (error: any) {
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
}