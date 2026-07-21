import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { employeeId } = await request.json();

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee ID is required.",
        },
        {
          status: 400,
        }
      );
    }

   const { data: employee, error: employeeError } =
  await adminClient
    .from("employees")
    .select(`
      profile_id,
      profiles:profile_id (
        id
      )
    `)
    .eq("id", employeeId)
    .single();

if (employeeError || !employee) {

  return NextResponse.json(
    {
      success: false,
      message: "Employee not found.",
    },
    {
      status: 404,
    }
  );

}

const profileId = employee.profile_id;

const { error: authError } =
  await adminClient.auth.admin.deleteUser(profileId);

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          message: authError.message,
        },
        {
          status: 400,
        }
      );
    }

    const { error: profileError } =
      await adminClient
        .from("profiles")
        .delete()
        .eq("id", profileId);

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          message: profileError.message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Unable to delete employee.",
      },
      {
        status: 500,
      }
    );
  }
}