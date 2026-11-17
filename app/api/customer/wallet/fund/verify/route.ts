import { NextResponse } from "next/server";
import { verifyAndCreditCustomerWallet } from "@/lib/payments/paystack-wallet";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const reference = requestUrl.searchParams.get("reference") ?? "";
  const destination = new URL("/customer-dashboard", request.url);

  if (!/^mkh-wallet-[0-9a-f-]{36}$/i.test(reference)) {
    destination.searchParams.set("wallet_funding", "invalid");
    return NextResponse.redirect(destination);
  }

  try {
    await verifyAndCreditCustomerWallet(reference);
    destination.searchParams.set("wallet_funding", "success");
  } catch (error) {
    console.error("CUSTOMER WALLET FUND VERIFICATION ERROR:", error);
    destination.searchParams.set("wallet_funding", "pending");
  }

  return NextResponse.redirect(destination);
}
