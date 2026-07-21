import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { profileId } = await request.json();

    if (!profileId) {
      return NextResponse.json(
        {
          success: false,
          message: "Profile ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const temporaryPassword =
      `MKH${Math.floor(100000 + Math.random() * 900000)}!`;

    const { error: authError } =
      await adminClient.auth.admin.updateUserById(
        profileId,
        {
          password: temporaryPassword,
        }
      );

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
          must_change_password: true,
        })
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
      temporaryPassword,
    });

  } catch (error: any) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          error.message || "Unable to reset password.",
      },
      {
        status: 500,
      }
    );
  }
}