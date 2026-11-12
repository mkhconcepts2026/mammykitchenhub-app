import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { newRiderTransferReference, paystackRequest, requireActiveRider, riderJson } from "@/lib/rider-payouts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["reserved", "transfer_submitted", "needs_reconciliation"];

export async function GET() {
  const access = await requireActiveRider();
  if ("response" in access) return access.response;
  const { data, error } = await adminClient
    .from("rider_payout_requests")
    .select("id, amount, currency, status, transfer_reference, requested_at, status_updated_at, completed_at, destination_bank_name, destination_account_name, destination_account_last4, failure_reason")
    .eq("rider_id", access.user.id)
    .order("requested_at", { ascending: false })
    .limit(30);
  if (error) return riderJson({ success: false, message: "Unable to load payout history." }, 500);
  return riderJson({ success: true, payouts: data ?? [] });
}

export async function POST(_request: NextRequest) {
  const access = await requireActiveRider();
  if ("response" in access) return access.response;

  const { data: bank, error: bankError } = await adminClient
    .from("rider_bank_accounts")
    .select("id, bank_name, account_name, account_number_last4, paystack_recipient_code, verification_status")
    .eq("rider_id", access.user.id)
    .maybeSingle();
  if (bankError || !bank || bank.verification_status !== "verified" || !bank.paystack_recipient_code) {
    return riderJson({ success: false, message: "Add and verify your bank account before requesting a withdrawal." }, 409);
  }

  const reference = newRiderTransferReference();
  const { data: reservation, error: reserveError } = await adminClient.rpc("mkh_rider_reserve_payout", {
    p_rider_id: access.user.id,
    p_bank_account_id: bank.id,
    p_reference: reference,
  });
  if (reserveError) {
    console.error("Rider payout reservation failed:", reserveError.message);
    return riderJson({ success: false, message: "Your withdrawal could not be reserved. No transfer was sent." }, 500);
  }
  if (!reservation?.success) {
    return riderJson({ success: false, message: reservation?.message ?? "No eligible wallet balance is available." }, 409);
  }

  const payoutId = String(reservation.payout_id ?? "");
  const amountNaira = Number(reservation.amount);
  const amountKobo = Math.round(amountNaira * 100);
  if (!payoutId || !Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    if (payoutId) await adminClient.rpc("mkh_rider_mark_payout_uncertain", { p_payout_id: payoutId, p_reason: "The reservation response could not be validated." });
    return riderJson({ success: false, message: "The payout reservation response was incomplete. Finance reconciliation is required." }, 500);
  }

  try {
    const transfer = await paystackRequest<any>("/transfer", {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: amountKobo,
        recipient: String(reservation.recipient_code ?? ""),
        reference,
        reason: "MKH rider wallet withdrawal",
        currency: "NGN",
      }),
    });

    const providerStatus = String(transfer?.data?.status ?? "").toLowerCase();
    if (providerStatus === "otp") {
      await adminClient.rpc("mkh_rider_mark_payout_uncertain", { p_payout_id: payoutId, p_reason: "Paystack TEST transfers require OTP confirmation. Automated transfer approval is not enabled." });
      return riderJson({ success: true, payout: { id: payoutId, amount: amountNaira, status: "needs_reconciliation" }, message: "Paystack requires transfer OTP approval. The reservation is held for TEST configuration/reconciliation; no second withdrawal should be submitted." }, 202);
    }
    const transferCode = String(transfer?.data?.transfer_code ?? "");
    const providerReference = String(transfer?.data?.reference ?? "");
    const transferId = Number(transfer?.data?.id);
    if (!transferCode || providerReference !== reference) {
      await adminClient.rpc("mkh_rider_mark_payout_uncertain", { p_payout_id: payoutId, p_reason: "Paystack response did not contain the expected transfer code/reference." });
      return riderJson({ success: true, payout: { id: payoutId, amount: amountNaira, status: "needs_reconciliation" }, message: "Paystack response requires reconciliation. Your funds remain reserved; do not submit another withdrawal." }, 202);
    }
    const { data: submitted, error: submittedError } = await adminClient.rpc("mkh_rider_mark_payout_submitted", {
      p_payout_id: payoutId,
      p_transfer_code: transferCode || null,
      p_transfer_id: Number.isSafeInteger(transferId) ? transferId : null,
    });
    if (submittedError || !submitted?.success) {
      console.error("Rider payout status update failed:", submittedError?.message ?? submitted?.message);
      await adminClient.rpc("mkh_rider_mark_payout_uncertain", { p_payout_id: payoutId, p_reason: "Paystack accepted the TEST transfer, but MKH could not save the provider transfer status." });
      return riderJson({ success: true, payout: { id: payoutId, amount: amountNaira, status: "needs_reconciliation" }, message: "Paystack accepted the TEST transfer request. MKH is reconciling its status; do not submit another withdrawal." }, 202);
    }

    // Paystack TEST transfers return success without actual bank processing.
    // Keep the payout submitted so the authorised TEST event simulator can
    // exercise success, failure and reversal accounting paths.
    return riderJson({
      success: true,
      mode: "test",
      payout: { id: payoutId, amount: amountNaira, status: submitted.status ?? "transfer_submitted", transfer_reference: reference },
      message: submitted.status === "successful"
        ? "Paystack's signed TEST event has already confirmed the payout. No real money moved."
        : ["failed", "reversed"].includes(String(submitted.status))
          ? `Paystack's signed TEST event reported ${submitted.status}. The reserved wallet amount has been restored.`
          : "TEST transfer accepted. No real money moved. Await a signed webhook or authorised TEST event simulation to finalise the payout status.",
    }, 202);
  } catch (error) {
    const httpStatus = Number((error as any)?.httpStatus ?? 0);
    if (httpStatus > 0 && httpStatus < 500) {
      await adminClient.rpc("mkh_rider_apply_paystack_transfer_event", {
        p_reference: reference,
        p_event_type: "transfer.failed",
        p_transfer_code: null,
        p_failure_reason: error instanceof Error ? error.message.slice(0, 300) : "Paystack rejected the TEST transfer.",
      });
      return riderJson({ success: false, message: error instanceof Error ? error.message : "Paystack rejected the transfer." }, 422);
    }

    // A timeout or provider/server error is ambiguous: retain the reservation.
    await adminClient.rpc("mkh_rider_mark_payout_uncertain", {
      p_payout_id: payoutId,
      p_reason: "Paystack response was inconclusive. Finance reconciliation is required before retrying.",
    });
    console.error("Rider Paystack transfer outcome uncertain:", error instanceof Error ? error.message : "unknown error");
    return riderJson({ success: true, payout: { id: payoutId, amount: amountNaira, status: "needs_reconciliation" }, message: "Transfer outcome is being reconciled. Your funds remain reserved; do not submit another withdrawal." }, 202);
  }
}
