import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { paystackRequest, riderJson } from "@/lib/rider-payouts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireFinanceAccess() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: riderJson({ success: false, message: "Authentication required." }, 401) } as const;

  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    adminClient.from("profiles").select("id,status").eq("id", user.id).maybeSingle(),
    supabase.rpc("current_effective_app_role"),
  ]);
  const effectiveRole = String(role ?? "").toUpperCase();
  if (profileError || !profile || String(profile.status ?? "").toLowerCase() !== "active" || roleError || !["ADMIN", "FINANCE", "COO"].includes(effectiveRole)) {
    return { response: riderJson({ success: false, message: "Active Finance, Admin or COO access is required." }, 403) } as const;
  }
  return { user, supabase } as const;
}

export async function GET() {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  const { data: payouts, error } = await adminClient
    .from("rider_payout_requests")
    .select("id, rider_id, amount, currency, status, transfer_reference, paystack_transfer_code, paystack_transfer_id, destination_bank_name, destination_account_name, destination_account_last4, failure_reason, requested_at, status_updated_at, completed_at")
    .order("requested_at", { ascending: false })
    .limit(300);
  if (error) return riderJson({ success: false, message: "Unable to load rider payout records." }, 500);

  const riderIds = [...new Set((payouts ?? []).map((row: any) => row.rider_id).filter(Boolean))] as string[];
  const { data: profiles, error: profileError } = riderIds.length
    ? await adminClient.from("profiles").select("id, full_name, email, phone, status").in("id", riderIds)
    : { data: [], error: null } as any;
  if (profileError) return riderJson({ success: false, message: "Unable to load rider identities for payout reconciliation." }, 500);

  const riderMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  return riderJson({
    success: true,
    payouts: (payouts ?? []).map((payout: any) => ({
      ...payout,
      rider: riderMap.get(payout.rider_id) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  let body: any;
  try { body = await request.json(); } catch { return riderJson({ success: false, message: "A valid JSON request is required." }, 400); }
  const payoutId = String(body?.payout_id ?? "");
  const action = String(body?.action ?? "verify_transfer").toLowerCase();
  if (!["verify_transfer", "retry_same_reference"].includes(action)) {
    return riderJson({ success: false, message: "Unsupported Finance reconciliation action." }, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payoutId)) {
    return riderJson({ success: false, message: "A valid rider payout ID is required." }, 400);
  }

  const { data: payout, error: payoutError } = await adminClient
    .from("rider_payout_requests")
    .select("id, rider_id, amount, transfer_reference, paystack_recipient_code_snapshot, status")
    .eq("id", payoutId)
    .maybeSingle();
  if (payoutError || !payout) return riderJson({ success: false, message: "Rider payout request was not found." }, 404);
  if (!["reserved", "transfer_submitted", "needs_reconciliation"].includes(String(payout.status))) {
    return riderJson({ success: false, message: `This payout is already in a terminal state (${payout.status}).` }, 409);
  }

  try {
    if (action === "retry_same_reference") {
      if (payout.status !== "needs_reconciliation") {
        return riderJson({ success: false, message: "Only a payout marked needs_reconciliation can be retried using its original reference." }, 409);
      }
      const amountKobo = Math.round(Number(payout.amount) * 100);
      if (!payout.paystack_recipient_code_snapshot || !Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        return riderJson({ success: false, message: "The saved recipient or payout amount is invalid. Do not create a new transfer reference." }, 409);
      }
      const retry = await paystackRequest<any>("/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance",
          amount: amountKobo,
          recipient: payout.paystack_recipient_code_snapshot,
          reference: payout.transfer_reference,
          reason: "MKH rider wallet withdrawal retry",
          currency: "NGN",
        }),
      });
      const retryReference = String(retry?.data?.reference ?? "");
      const retryCode = String(retry?.data?.transfer_code ?? "");
      const retryProviderStatus = String(retry?.data?.status ?? "").toLowerCase();
      if (retryProviderStatus === "otp") {
        await adminClient.rpc("mkh_rider_mark_payout_uncertain", { p_payout_id: payout.id, p_reason: "Paystack TEST retry requires OTP confirmation." });
        return riderJson({ success: false, message: "Paystack requires OTP confirmation. The original reservation remains held for reconciliation." }, 202);
      }
      if (retryReference !== payout.transfer_reference || !retryCode) {
        return riderJson({ success: false, message: "Paystack retry response was inconclusive. The original reservation remains held." }, 202);
      }
      const { data: retryState, error: retryStateError } = await adminClient.rpc("mkh_rider_mark_payout_submitted", {
        p_payout_id: payout.id,
        p_transfer_code: retryCode,
        p_transfer_id: Number.isSafeInteger(Number(retry?.data?.id)) ? Number(retry.data.id) : null,
      });
      if (retryStateError || !retryState?.success) {
        return riderJson({ success: false, message: "Paystack accepted the same-reference retry, but MKH could not update its status. Reconcile this request; do not create a new reference." }, 202);
      }
      return riderJson({ success: true, retried: true, status: retryState.status, reference: payout.transfer_reference, message: "The original transfer reference was retried. No new payout request or wallet reservation was created." }, 202);
    }

    const verified = await paystackRequest<any>(`/transfer/verify/${encodeURIComponent(payout.transfer_reference)}`);
    const transfer = verified?.data;
    if (String(transfer?.reference ?? "") !== payout.transfer_reference) {
      return riderJson({ success: false, message: "Paystack returned a different transfer reference. No wallet change was made." }, 409);
    }
    const providerStatus = String(transfer?.status ?? "").toLowerCase();
    const eventType = providerStatus === "success" ? "transfer.success"
      : providerStatus === "failed" ? "transfer.failed"
      : providerStatus === "reversed" ? "transfer.reversed" : "";
    if (!eventType) {
      return riderJson({ success: true, reconciled: false, provider_status: providerStatus || "unknown", message: "Paystack has not supplied a final transfer outcome. The payout remains reserved." }, 202);
    }

    const { data: result, error: applyError } = await adminClient.rpc("mkh_rider_apply_paystack_transfer_event", {
      p_reference: payout.transfer_reference,
      p_event_type: eventType,
      p_transfer_code: transfer?.transfer_code ? String(transfer.transfer_code) : null,
      p_failure_reason: eventType === "transfer.success" ? null : String(transfer?.failures ?? eventType).slice(0, 300),
    });
    if (applyError || !result?.success) {
      console.error("Finance rider payout reconciliation failed:", applyError?.message ?? result?.message);
      return riderJson({ success: false, message: "Transfer was verified, but MKH could not apply the reconciliation. Finance review is required." }, 500);
    }
    return riderJson({ success: true, reconciled: true, result });
  } catch (error) {
    return riderJson({ success: false, message: error instanceof Error ? error.message : "Unable to verify this TEST transfer." }, 502);
  }
}
