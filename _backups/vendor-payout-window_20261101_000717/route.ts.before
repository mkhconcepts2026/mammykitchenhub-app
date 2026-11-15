import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Please sign in again." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("vendor_id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile?.vendor_id ||
      String(profile.role ?? "").toLowerCase() !== "vendor" ||
      String(profile.status ?? "").toLowerCase() !== "active"
    ) {
      return NextResponse.json(
        { success: false, message: "An active vendor account is required." },
        { status: 403 }
      );
    }

    // Enforce the payout window using Nigeria time on the server.
    const lagosParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      weekday: "short",
    }).formatToParts(new Date());

    const lagosTime = Object.fromEntries(
      lagosParts.map((part) => [part.type, part.value])
    );

    const day = lagosTime.weekday;
    // Approved interval: Friday 00:00 inclusive to Monday 00:00 exclusive,
    // in Africa/Lagos time. Database enforcement must independently match.
    const payoutWindowOpen =
      day === "Fri" ||
      day === "Sat" ||
      day === "Sun";

    if (!payoutWindowOpen) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYOUT_WINDOW_CLOSED",
          message:
            "Vendor payout requests are open Friday 12:00 AM through Sunday 11:59 PM Nigeria time.",
        },
        { status: 403 }
      );
    }
    // All balance validation, locking, reservation and request creation
    // happen inside the atomic database function.
    const { data, error } = await adminClient.rpc(
      "request_vendor_payout",
      { p_vendor_id: profile.vendor_id }
    );

    if (error) {
      console.error("Atomic vendor payout request failed:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Could not submit your payout request. Please try again.",
        },
        { status: 500 }
      );
    }

    const result = data as {
      success?: boolean;
      code?: string;
      message?: string;
      payout?: {
        id: string;
        amount: number;
        status: string;
        requested_at: string;
      };
    } | null;

    if (!result?.success) {
      const status =
        result?.code === "ACTIVE_PAYOUT_EXISTS" ? 409 :
        result?.code === "NO_AVAILABLE_BALANCE" ? 400 :
        400;

      return NextResponse.json(
        {
          success: false,
          code: result?.code,
          message: result?.message || "Payout request could not be submitted.",
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Payout request submitted for review.",
      payout: result.payout,
    });
  } catch (error) {
    console.error("Vendor payout request failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
