import { adminClient } from "@/lib/supabase/admin";

export type PaystackVerification = {
  id: string | number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  domain: string;
  paid_at?: string | null;
  paidAt?: string | null;
};

type PaystackVerifyResponse = {
  status?: boolean;
  message?: string;
  data?: PaystackVerification;
};

export async function verifyAndCreditCustomerWallet(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack is not configured on this server.");

  const { data: intent, error: intentError } = await adminClient
    .from("customer_wallet_funding_intents")
    .select("reference, customer_id, wallet_id, amount_kobo, currency, status")
    .eq("reference", reference)
    .maybeSingle();

  if (intentError) throw new Error("Unable to load the wallet funding record.");
  if (!intent) throw new Error("Wallet funding reference was not found.");

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as PaystackVerifyResponse | null;
  if (!response.ok || payload?.status !== true || !payload.data) {
    throw new Error("Paystack could not verify this wallet payment yet.");
  }

  const transaction = payload.data;
  if (
    transaction.reference !== reference ||
    transaction.status !== "success" ||
    transaction.currency !== "NGN" ||
    !Number.isSafeInteger(Number(transaction.amount)) ||
    Number(transaction.amount) !== Number(intent.amount_kobo)
  ) {
    throw new Error("The verified Paystack payment does not match this wallet funding request.");
  }

  const expectedDomain = secret.startsWith("sk_test_") ? "test" : secret.startsWith("sk_live_") ? "live" : null;
  if (!expectedDomain || transaction.domain !== expectedDomain) {
    throw new Error("The Paystack transaction belongs to a different payment environment.");
  }

  const { data: creditResult, error: creditError } = await adminClient.rpc(
    "mkh_credit_customer_wallet_from_paystack",
    {
      p_reference: reference,
      p_amount_kobo: Number(transaction.amount),
      p_transaction_id: String(transaction.id),
      p_currency: transaction.currency,
      p_domain: transaction.domain,
      p_paid_at: transaction.paid_at ?? transaction.paidAt ?? new Date().toISOString(),
    }
  );

  if (creditError) {
    console.error("PAYSTACK WALLET CREDIT RPC ERROR:", creditError);
    throw new Error("Payment was verified, but wallet credit needs reconciliation. Do not pay again; contact MKH support.");
  }

  if (!creditResult || creditResult.success !== true) {
    throw new Error("Payment was verified, but wallet credit could not be confirmed. Do not pay again; contact MKH support.");
  }

  return {
    success: true as const,
    duplicate: creditResult.duplicate === true,
    amount: Number(transaction.amount) / 100,
  };
}
