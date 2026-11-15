import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { encryptRiderAccountNumber, paystackRequest, requireActiveRider, riderJson } from "@/lib/rider-payouts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireActiveRider();
  if ("response" in access) return access.response;
  const { data, error } = await adminClient
    .from("rider_bank_accounts")
    .select("id, bank_name, bank_code, account_name, account_number_last4, verification_status, verified_at, updated_at")
    .eq("rider_id", access.user.id)
    .maybeSingle();
  if (error) return riderJson({ success: false, message: "Unable to load your saved bank account." }, 500);
  return riderJson({ success: true, bankAccount: data ?? null });
}

export async function PUT(request: NextRequest) {
  const access = await requireActiveRider();
  if ("response" in access) return access.response;

  let body: any;
  try { body = await request.json(); } catch { return riderJson({ success: false, message: "A valid JSON request is required." }, 400); }
  const bankCode = typeof body?.bank_code === "string" ? body.bank_code.trim() : "";
  const bankName = typeof body?.bank_name === "string" ? body.bank_name.trim() : "";
  const accountNumber = typeof body?.account_number === "string" ? body.account_number.replace(/\s+/g, "") : "";
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(bankCode) || bankName.length < 2 || bankName.length > 100 || !/^\d{10}$/.test(accountNumber)) {
    return riderJson({ success: false, message: "Select a bank and enter a valid 10-digit Nigerian account number." }, 400);
  }

  try {
    const encryptedAccountNumber = encryptRiderAccountNumber(accountNumber);
    const bankDirectory = await paystackRequest<any>("/bank?currency=NGN&perPage=300");
    const matchedBank = Array.isArray(bankDirectory.data)
      ? bankDirectory.data.find((item: any) => String(item?.code ?? "") === bankCode && item?.active !== false)
      : null;
    if (!matchedBank) return riderJson({ success: false, message: "Select a valid active Nigerian bank from MKH's bank list." }, 400);
    const verifiedBankName = String(matchedBank.name);
    const resolved = await paystackRequest<any>(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    const accountName = String(resolved?.data?.account_name ?? "").trim();
    if (!accountName) return riderJson({ success: false, message: "Paystack could not confirm the account holder name." }, 422);

    const { data: activePayout, error: activePayoutError } = await adminClient
      .from("rider_payout_requests")
      .select("id")
      .eq("rider_id", access.user.id)
      .in("status", ["reserved", "transfer_submitted", "needs_reconciliation"])
      .limit(1)
      .maybeSingle();
    if (activePayoutError) return riderJson({ success: false, message: "Unable to confirm whether an earlier withdrawal is still active. Please retry." }, 500);
    if (activePayout) return riderJson({ success: false, message: "Your bank account cannot be changed while a withdrawal is being processed or reconciled." }, 409);

    const recipient = await paystackRequest<any>("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
        description: `MKH rider ${access.user.id}`,
      }),
    });
    const recipientCode = String(recipient?.data?.recipient_code ?? "");
    if (!recipientCode) return riderJson({ success: false, message: "Paystack did not return a transfer recipient code." }, 502);

    const { data: saved, error } = await adminClient
      .from("rider_bank_accounts")
      .upsert({
        rider_id: access.user.id,
        bank_name: verifiedBankName,
        bank_code: bankCode,
        account_name: accountName,
        account_number_last4: accountNumber.slice(-4),
        account_number_encrypted: encryptedAccountNumber,
        paystack_recipient_code: recipientCode,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "rider_id" })
      .select("id, bank_name, bank_code, account_name, account_number_last4, verification_status, verified_at, updated_at")
      .single();

    if (error || !saved) {
      console.error("Rider bank-account save failed:", error?.message);
      return riderJson({ success: false, message: "Account verified, but MKH could not save it. Please retry or contact support." }, 500);
    }
    return riderJson({ success: true, message: "Bank account verified and saved in TEST mode.", bankAccount: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bank-account verification failed.";
    return riderJson({ success: false, message }, 502);
  }
}
