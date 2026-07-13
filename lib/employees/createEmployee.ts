import { createClient } from "@supabase/supabase-js";

import { prepareEmployee } from "./provisioning";
import { createTemporaryPassword } from "./createTemporaryPassword";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createEmployee(data: any) {

  const employee =
    await prepareEmployee(data);

  const temporaryPassword =
    createTemporaryPassword();

  // ===================================================
  // CREATE AUTH USER
  // ===================================================

  const {
    data: authUser,
    error: authError,
  } = await supabase.auth.admin.createUser({

    email: employee.email,

    password: temporaryPassword,

    email_confirm: true,

  });

  if (authError) {

    throw new Error(authError.message);

  }

  const profileId =
    authUser.user.id;

  // ===================================================
  // CREATE PROFILE
  // ===================================================

  const { error: profileError } =
    await supabase
      .from("profiles")
      .insert({

        id: profileId,

        full_name:
          `${employee.firstName} ${employee.lastName}`,

        email: employee.email,

        phone: employee.phone,

        role: "employee",

      });

  if (profileError) {

    await supabase.auth.admin.deleteUser(profileId);

    throw new Error(profileError.message);

  }

  // ===================================================
  // CREATE EMPLOYEE
  // ===================================================

  const { data: employeeRow, error: employeeError } =
    await supabase
      .from("employees")
      .insert({

        profile_id: profileId,

        employee_number:
          employee.employeeNumber,

        first_name:
          employee.firstName,

        last_name:
          employee.lastName,

        phone:
          employee.phone,

        gender:
          employee.gender,

        nationality:
          employee.nationality,

        address:
          employee.address,

        department_id:
          employee.departmentId,

        role_id:
          employee.roleId,

        state_id:
          employee.stateId,

        lga_id:
          employee.lgaId || null,

        territory_id:
          employee.territoryId || null,

        reports_to:
          employee.reportsTo || null,

        employment_type:
          employee.employmentType,

        hire_date:
          new Date(),

        employment_status:
          "Active",

        photo_url:
          employee.photoUrl,

        office_location:
          employee.officeLocation,

        email:
          employee.email,

        username:
          employee.username,

        status:
          "Pending Approval",

      })

      .select()

      .single();

  if (employeeError) {

    await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId);

    await supabase.auth.admin.deleteUser(profileId);

    throw new Error(employeeError.message);

  }

  return {

    success: true,

    employee: employeeRow,

    temporaryPassword,

  };

}