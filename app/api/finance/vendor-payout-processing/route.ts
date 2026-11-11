import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { decryptVendorBankAccountNumber } from "@/lib/vendor-payout/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRole(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getAuthorizedContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { success: false, message: "Your session has expired. Please sign in again." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    } as const;
  }

  const [
    { data: profile, error: profileError },
    { data: effectiveRole, error: roleError },
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, status")
      .eq("id", user.id)
      .maybeSingle(),

    supabase.rpc("current_effective_app_role"),
  ]);

  const role = normalizeRole(effectiveRole);

  if (
    profileError ||
    !profile ||
    String(profile.status ?? "").toLowerCase() !== "active" ||
    roleError ||
    !["finance", "admin"].includes(role)
  ) {
    return {
      response: NextResponse.json(
        {
          success: false,
          message: "An active Finance or Admin account is required for vendor payout processing.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    } as const;
  }

  return { supabase, userId: user.id } as const;
}

export async function GET() {
  const access = await getAuthorizedContext();

  if ("response" in access) return access.response;

  try {
    const { data: requests, error: requestError } = await adminClient
      .from("payout_requests")
      .select(
        "id, requester_id, requester_type, amount, status, requested_at, processed_at, approved_by, transfer_reference, status_updated_at, admin_note, hold_reason"
      )
      .eq("requester_type", "vendor")
      .in("status", ["approved", "processing", "transfer_submitted", "on_hold"])
      .order("requested_at", { ascending: false })
      .limit(300);

    if (requestError) {
      throw new Error("Unable to load Finance-stage vendor payout requests.");
    }

    const vendorIds = [
      ...new Set(
        (requests ?? [])
          .map((row: any) => row.requester_id)
          .filter(Boolean)
      ),
    ] as string[];

    if (!vendorIds.length) {
      return NextResponse.json(
        { success: true, payouts: [], refreshedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const [
      { data: vendors, error: vendorsError },
      { data: accounts, error: accountsError },
    ] = await Promise.all([
      adminClient
        .from("vendors")
        .select("id, name, owner_name")
        .in("id", vendorIds),

      adminClient
        .from("vendor_bank_accounts")
        .select("id, vendor_id, bank_name, account_name, account_number_encrypted, account_number_last4, verified, created_at")
        .in("vendor_id", vendorIds)
        .eq("verified", true)
        .order("created_at", { ascending: false }),
    ]);

    if (vendorsError) {
      throw new Error("Unable to resolve vendor names for payout requests.");
    }

    if (accountsError) {
      throw new Error("Unable to load verified vendor bank-account records.");
    }

    const vendorMap = new Map<string, any>(
      (vendors ?? []).map(
        (row: any) => [String(row.id), row] as [string, any]
      )
    );

    const accountsMap = new Map<string, any[]>();

    for (const account of accounts ?? []) {
      // Never send stored ciphertext to the browser. Only the authorized
      // Finance/Admin response receives the decrypted destination number.
      const accountNumber = account.account_number_encrypted
        ? decryptVendorBankAccountNumber(account.account_number_encrypted)
        : "";
      const financeAccount = {
        id: account.id,
        vendor_id: account.vendor_id,
        bank_name: account.bank_name,
        account_name: account.account_name,
        account_number: accountNumber,
        account_number_last4: String(account.account_number_last4 ?? "").trim(),
        verified: account.verified === true,
        created_at: account.created_at,
      };
      const list = accountsMap.get(String(account.vendor_id)) ?? [];
      list.push(financeAccount);
      accountsMap.set(String(account.vendor_id), list);
    }

    const payouts = (requests ?? []).map((row: any) => ({
      ...row,
      vendor_name:
        vendorMap.get(String(row.requester_id))?.name ||
        vendorMap.get(String(row.requester_id))?.owner_name ||
        "Vendor",
      bank_accounts: accountsMap.get(String(row.requester_id)) ?? [],
    }));

    return NextResponse.json(
      {
        success: true,
        payouts,
        refreshedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Finance vendor payout queue failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load vendor payout queue.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await getAuthorizedContext();

  if ("response" in access) return access.response;

  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const payoutRequestId = String(body?.payout_request_id ?? "");
  const action = String(body?.action ?? "").toLowerCase();

  const allowedActions = new Set([
    "start_processing",
    "submit_transfer",
    "mark_paid",
    "hold",
    "resume",
    "confirm_transfer_failure",
  ]);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payoutRequestId) ||
    !allowedActions.has(action)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "A valid payout request ID and supported Finance action are required.",
      },
      { status: 400 }
    );
  }

  const reason =
    typeof body?.reason === "string" ? body.reason.trim() : "";

  const transferReference =
    typeof body?.transfer_reference === "string"
      ? body.transfer_reference.trim()
      : "";

  if (
    ["hold", "confirm_transfer_failure"].includes(action) &&
    !reason
  ) {
    return NextResponse.json(
      { success: false, message: "A reason is required for this payout action." },
      { status: 400 }
    );
  }

  if (action === "submit_transfer" && !transferReference) {
    return NextResponse.json(
      { success: false, message: "A genuine bank transfer reference is required." },
      { status: 400 }
    );
  }

  if (
    action === "mark_paid" &&
    body?.confirmed_transfer_success !== true
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Finance must explicitly confirm independently verified transfer success.",
      },
      { status: 400 }
    );
  }

  if (action === "start_processing" || action === "submit_transfer") {
    const { data: payout, error: payoutError } = await adminClient
      .from("payout_requests")
      .select("id, requester_id, requester_type, status")
      .eq("id", payoutRequestId)
      .maybeSingle();

    if (
      payoutError ||
      !payout ||
      String(payout.requester_type).toLowerCase() !== "vendor"
    ) {
      return NextResponse.json(
        { success: false, message: "Vendor payout request was not found." },
        { status: 404 }
      );
    }

    const expectedStatus = action === "start_processing" ? "approved" : "processing";
    if (String(payout.status ?? "").toLowerCase() !== expectedStatus) {
      return NextResponse.json(
        {
          success: false,
          message:
            action === "start_processing"
              ? "Only an approved vendor payout can enter processing."
              : "Only a payout already in processing can be submitted for transfer.",
        },
        { status: 409 }
      );
    }

    const { data: verifiedAccounts, error: bankError } = await adminClient
      .from("vendor_bank_accounts")
      .select("id, bank_name, account_name, account_number_encrypted, account_number_last4")
      .eq("vendor_id", payout.requester_id)
      .eq("verified", true);

    if (bankError) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to confirm the vendor's verified bank account.",
        },
        { status: 500 }
      );
    }

    const singleVerifiedAccount =
      (verifiedAccounts ?? []).length === 1 ? verifiedAccounts![0] : null;
    let encryptedAccountIsValid = false;
    if (singleVerifiedAccount?.account_number_encrypted) {
      try {
        const decryptedAccountNumber = decryptVendorBankAccountNumber(
          singleVerifiedAccount.account_number_encrypted,
        );
        encryptedAccountIsValid = /^\\d{10}$/.test(decryptedAccountNumber);
      } catch {
        encryptedAccountIsValid = false;
      }
    }
    const accountComplete = Boolean(
      singleVerifiedAccount &&
      String(singleVerifiedAccount.bank_name ?? "").trim() &&
      String(singleVerifiedAccount.account_name ?? "").trim() &&
      String(singleVerifiedAccount.account_number_last4 ?? "").trim() &&
      encryptedAccountIsValid
    );

    if (!accountComplete) {
      return NextResponse.json(
        {
          success: false,
          code: "VERIFIED_BANK_ACCOUNT_REQUIRED",
          message:
            "Finance cannot move this payout forward until the vendor has exactly one complete, verified and encrypted bank account on record.",
        },
        { status: 409 }
      );
    }
  }

  const { data: result, error: rpcError } =
    await access.supabase.rpc("resolve_vendor_payout", {
      p_payout_request_id: payoutRequestId,
      p_action: action,
      p_reason: reason || null,
      p_transfer_reference: transferReference || null,
    });

  if (rpcError) {
    console.error("Finance payout action RPC failed:", rpcError.message);

    return NextResponse.json(
      {
        success: false,
        message: rpcError.message || "Payout action failed.",
      },
      { status: 409 }
    );
  }

  if (!result?.success) {
    return NextResponse.json(
      {
        success: false,
        message: result?.message || "Payout action was not completed.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      status: result.status,
      message: `Vendor payout updated to ${String(result.status ?? "updated").replace(/_/g, " ").toUpperCase()}.`,
      result,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}