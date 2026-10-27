
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST() {
  try {
    // 1. Authenticate the customer using their server-side session.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to activate your wallet." },
        { status: 401 }
      );
    }

    // 2. Confirm this account has a customer profile.
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("WALLET PROFILE LOOKUP ERROR:", profileError);
      return NextResponse.json(
        { success: false, message: "Unable to verify your account." },
        { status: 500 }
      );
    }

    if (
      !profile ||
      profile.role?.toLowerCase() !== "customer" ||
      profile.status?.toLowerCase() !== "active"
    ) {
      return NextResponse.json(
        { success: false, message: "An active customer account is required." },
        { status: 403 }
      );
    }

    // 3. Return the wallet if it already exists.
    const { data: existingWallet, error: lookupError } = await adminClient
      .from("customer_wallets")
      .select("id, available_balance, locked_balance, created_at")
      .eq("customer_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("WALLET LOOKUP ERROR:", lookupError);
      return NextResponse.json(
        { success: false, message: "Unable to load your wallet." },
        { status: 500 }
      );
    }

    if (existingWallet) {
      return NextResponse.json({
        success: true,
        wallet: existingWallet,
        alreadyExists: true,
      });
    }

    // 4. Create an empty wallet. Never accept a balance from the browser.
    const { data: wallet, error: createError } = await adminClient
      .from("customer_wallets")
      .insert({
        customer_id: user.id,
        available_balance: 0,
        locked_balance: 0,
      })
      .select("id, available_balance, locked_balance, created_at")
      .single();

    if (createError) {
      // Handle concurrent activation requests without creating duplicates.
      if (createError.code === "23505") {
        const { data: concurrentWallet, error: retryError } =
          await adminClient
            .from("customer_wallets")
            .select("id, available_balance, locked_balance, created_at")
            .eq("customer_id", user.id)
            .maybeSingle();

        if (!retryError && concurrentWallet) {
          return NextResponse.json({
            success: true,
            wallet: concurrentWallet,
            alreadyExists: true,
          });
        }
      }

      console.error("WALLET CREATION ERROR:", createError);
      return NextResponse.json(
        { success: false, message: "Unable to activate your wallet." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, wallet, alreadyExists: false },
      { status: 201 }
    );
  } catch (error) {
    console.error("CUSTOMER WALLET ACTIVATION ERROR:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
