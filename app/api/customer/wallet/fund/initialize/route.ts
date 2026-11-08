import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return errorResponse("Wallet funding is temporarily unavailable. Please contact MKH support.", 503);

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return errorResponse("Please sign in to fund your wallet.", 401);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("WALLET FUNDING PROFILE ERROR:", profileError);
      return errorResponse("Unable to verify your customer account.", 500);
    }
    if (!profile || profile.role?.toLowerCase() !== "customer" || profile.status?.toLowerCase() !== "active") {
      return errorResponse("An active customer account is required.", 403);
    }

    const email = user.email || profile.email;
    if (typeof email !== "string" || !email.includes("@")) {
      return errorResponse("Add a valid email address to your account before funding your wallet.", 400);
    }

    const body = await request.json().catch(() => null) as { amount?: unknown } | null;
    const amountText = typeof body?.amount === "string" || typeof body?.amount === "number" ? String(body.amount).trim() : "";
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amountText)) {
      return errorResponse("Enter a valid amount in Naira, using no more than two decimal places.", 400);
    }

    const amountKobo = Math.round(Number(amountText) * 100);
    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
      return errorResponse("Enter a valid amount greater than zero.", 400);
    }

    const { data: wallet, error: walletError } = await adminClient
      .from("customer_wallets")
      .select("id")
      .eq("customer_id", user.id)
      .maybeSingle();

    if (walletError) {
      console.error("WALLET FUNDING WALLET LOOKUP ERROR:", walletError);
      return errorResponse("Unable to load your MKH Wallet.", 500);
    }
    if (!wallet) return errorResponse("Activate your MKH Wallet before adding money.", 409);

    const reference = `mkh-wallet-${randomUUID()}`;
    const { error: intentError } = await adminClient
      .from("customer_wallet_funding_intents")
      .insert({
        customer_id: user.id,
        wallet_id: wallet.id,
        reference,
        amount_kobo: amountKobo,
        currency: "NGN",
        status: "pending",
      });

    if (intentError) {
      console.error("WALLET FUNDING INTENT INSERT ERROR:", intentError);
      return errorResponse("Unable to start wallet funding. Please try again.", 500);
    }

    const callbackUrl = new URL("/api/customer/wallet/fund/verify", request.url);
    const initializeResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: "NGN",
        channels: ["card"],
        reference,
        callback_url: callbackUrl.toString(),
        metadata: {
          mkh_wallet_funding: true,
          customer_id: user.id,
          wallet_id: wallet.id,
        },
      }),
      cache: "no-store",
    });

    const initialized = await initializeResponse.json().catch(() => null);
    if (!initializeResponse.ok || initialized?.status !== true || initialized?.data?.reference !== reference || typeof initialized?.data?.authorization_url !== "string") {
      console.error("PAYSTACK WALLET INITIALIZATION FAILED:", initialized);
      return errorResponse("Paystack could not start the payment. Please try again.", 502);
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: initialized.data.authorization_url,
      reference,
    });
  } catch (error) {
    console.error("CUSTOMER WALLET FUND INITIALIZATION ERROR:", error);
    return errorResponse("An unexpected error occurred while starting wallet funding.", 500);
  }
}
