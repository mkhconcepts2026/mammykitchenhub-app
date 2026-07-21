import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
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
        {
          status: 401,
        }
      );
    }

    const { newPassword } = await request.json();

    if (!newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "New password is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    const { error: authError } =
      await adminClient.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

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
        .update({
          must_change_password: false,
        })
        .eq("id", user.id);

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
        message: error.message || "Unable to change password.",
      },
      {
        status: 500,
      }
    );
  }
}