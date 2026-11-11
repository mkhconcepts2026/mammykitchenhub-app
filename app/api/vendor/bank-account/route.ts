import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { encryptVendorBankAccountNumber } from "@/lib/vendor-payout/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BANK_CHANGE_LOCK_STATUSES = [
  "processing",
  "transfer_submitted",
  "on_hold",
];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

type VendorContext = {
  vendorId: string;
  email: string | null;
};

async function getVendorContext(): Promise<
  | { context: VendorContext; supabase: Awaited<ReturnType<typeof createClient>> }
  | { response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: json(
        { success: false, message: "Please sign in again." },
        401,
      ),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("vendor_id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile?.vendor_id ||
    String(profile.role ?? "").trim().toLowerCase() !== "vendor" ||
    String(profile.status ?? "").trim().toLowerCase() !== "active"
  ) {
    return {
      response: json(
        { success: false, message: "An active vendor account is required." },
        403,
      ),
    };
  }

  const { data: vendor, error: vendorError } = await adminClient
    .from("vendors")
    .select("email")
    .eq("id", profile.vendor_id)
    .maybeSingle();

  if (vendorError || !vendor) {
    return {
      response: json(
        { success: false, message: "Your vendor record could not be verified." },
        403,
      ),
    };
  }

  return {
    context: {
      vendorId: String(profile.vendor_id),
      email: vendor.email ? String(vendor.email) : null,
    },
    supabase,
  };
}

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !/^sk_(test|live)_/.test(secret)) {
    throw new Error("Paystack bank verification is not configured.");
  }
  return secret;
}

async function paystackRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.status !== true) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : "Paystack could not complete the bank verification request.";
    throw new Error(message);
  }

  return payload as T;
}

async function loadBankDirectory() {
  const payload = await paystackRequest<{
    data?: Array<{
      name?: string;
      code?: string;
      active?: boolean;
      currency?: string;
    }>;
  }>("/bank?currency=NGN&perPage=300");

  return (Array.isArray(payload.data) ? payload.data : [])
    .filter(
      (bank) =>
        bank.active !== false &&
        typeof bank.name === "string" &&
        typeof bank.code === "string" &&
        bank.code.trim().length > 0,
    )
    .map((bank) => ({
      name: bank.name!.trim(),
      code: bank.code!.trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getActivePayout(vendorId: string) {
  const { data, error } = await adminClient
    .from("payout_requests")
    .select("id, status, requested_at")
    .eq("requester_id", vendorId)
    .eq("requester_type", "vendor")
    .in("status", BANK_CHANGE_LOCK_STATUSES)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to confirm whether a payout request is active.");
  }

  return data ?? null;
}

function maskAccount(accountNumber: unknown) {
  const value = String(accountNumber ?? "").replace(/\D/g, "");
  return value.length >= 4 ? value.slice(-4) : "";
}

export async function GET() {
  const access = await getVendorContext();
  if ("response" in access) return access.response;

  try {
    const [bankDirectory, accountResult, activePayout] = await Promise.all([
      loadBankDirectory(),
      adminClient
        .from("vendor_bank_accounts")
        .select("id, bank_name, account_name, account_number, account_number_encrypted, account_number_last4, verified, created_at")
        .eq("vendor_id", access.context.vendorId)
        .maybeSingle(),
      getActivePayout(access.context.vendorId),
    ]);

    if (accountResult.error) {
      console.error("Vendor bank-account lookup failed:", accountResult.error.message);
      return json(
        { success: false, message: "Your payout bank account could not be loaded." },
        500,
      );
    }

    const row = accountResult.data;
    let onboardingSuggestion: {
      bankCode: string;
      accountName: string;
      accountLast4: string;
      bankName: string;
    } | null = null;

    // Existing approved applications already contain bank details. Do not expose
    // the full number; ask the vendor to re-enter it so Paystack can verify it
    // before MKH activates the payout account.
    if (!row && access.context.email) {
      const { data: application } = await adminClient
        .from("vendor_applications")
        .select("bank_code, account_number, account_number_last4, account_name")
        .eq("email", access.context.email)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        application?.bank_code &&
        (application?.account_number_last4 ||
          application?.account_number_encrypted ||
          application?.account_number) &&
        application?.account_name
      ) {
        const bankCode = String(application.bank_code);
        const bank = bankDirectory.find((item) => item.code === bankCode);
        onboardingSuggestion = {
          bankCode,
          accountName: String(application.account_name),
          accountLast4:
            String(application.account_number_last4 ?? "").trim() ||
            maskAccount(application.account_number),
          bankName: bank?.name ?? "",
        };
      }
    }

    const account = row
      ? {
          id: row.id,
          bankName: row.bank_name ?? "",
          bankCode:
            bankDirectory.find(
              (bank) =>
                bank.name.toLowerCase() === String(row.bank_name ?? "").toLowerCase(),
            )?.code ?? "",
          accountName: row.account_name ?? "",
          accountLast4:
            String(row.account_number_last4 ?? "").trim() ||
            maskAccount(row.account_number),
          verified: row.verified === true,
          savedAt: row.created_at ?? null,
        }
      : null;

    return json({
      success: true,
      account,
      onboardingSuggestion,
      banks: bankDirectory,
      activePayout,
      canUpdate: !activePayout,
      changeBlockedReason: activePayout
        ? "Your bank account cannot be changed while a payout request is active. Wait until Finance resolves that request, then try again."
        : null,
    });
  } catch (error) {
    console.error("Vendor bank-account load failed:", error);
    return json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load your payout bank-account settings.",
      },
      502,
    );
  }
}

export async function PUT(request: NextRequest) {
  const access = await getVendorContext();
  if ("response" in access) return access.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, message: "A valid JSON request is required." },
      400,
    );
  }

  const bankCode =
    typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  const accountNumber =
    typeof body?.accountNumber === "string"
      ? body.accountNumber.replace(/\s+/g, "")
      : "";

  if (!/^[A-Za-z0-9_-]{2,20}$/.test(bankCode)) {
    return json({ success: false, message: "Select a valid bank." }, 400);
  }

  if (!/^\d{10}$/.test(accountNumber)) {
    return json(
      { success: false, message: "Enter a valid 10-digit Nigerian account number." },
      400,
    );
  }

  try {
    // A saved destination must not change underneath a payout already reserved
    // for processing. Pending/approved requests remain editable until Finance
    // begins processing; once processing/transfer starts, the account is locked.
    const activePayout = await getActivePayout(access.context.vendorId);
    if (activePayout) {
      return json(
        {
          success: false,
          code: "ACTIVE_PAYOUT_EXISTS",
          message:
            "Your bank account cannot be changed while a payout request is active. Wait until Finance resolves that request, then try again.",
        },
        409,
      );
    }

    const banks = await loadBankDirectory();
    const selectedBank = banks.find((bank) => bank.code === bankCode);
    if (!selectedBank) {
      return json(
        { success: false, message: "Select an active Nigerian bank from the list." },
        400,
      );
    }

    const query = new URLSearchParams({
      account_number: accountNumber,
      bank_code: bankCode,
    });
    const resolved = await paystackRequest<{
      data?: { account_name?: string; account_number?: string };
    }>(`/bank/resolve?${query.toString()}`);

    const accountName = String(resolved.data?.account_name ?? "").trim();
    const resolvedAccountNumber = String(
      resolved.data?.account_number ?? "",
    ).replace(/\D/g, "");

    if (
      !accountName ||
      (resolvedAccountNumber && resolvedAccountNumber !== accountNumber)
    ) {
      return json(
        {
          success: false,
          message:
            "Paystack could not confirm that the bank account details match. Check the bank and account number.",
        },
        422,
      );
    }

    // Recheck immediately before saving so a newly active payout blocks a
    // destination change. The database's unique vendor_id constraint makes
    // this an update of the vendor's one saved payout account.
    const payoutRecheck = await getActivePayout(access.context.vendorId);
    if (payoutRecheck) {
      return json(
        {
          success: false,
          code: "ACTIVE_PAYOUT_EXISTS",
          message:
            "A payout request became active while the account was being verified. No bank details were changed.",
        },
        409,
      );
    }

    const encryptedAccountNumber =
      encryptVendorBankAccountNumber(accountNumber);

    const { data: saved, error: saveError } = await adminClient
      .from("vendor_bank_accounts")
      .upsert(
        {
          vendor_id: access.context.vendorId,
          bank_name: selectedBank.name,
          account_number: null,
          account_number_encrypted: encryptedAccountNumber,
          account_number_last4: accountNumber.slice(-4),
          account_name: accountName,
          verified: true,
        },
        { onConflict: "vendor_id" },
      )
      .select("id, bank_name, account_name, account_number_last4, verified, created_at")
      .single();

    if (saveError || !saved) {
      console.error("Vendor bank-account save failed:", saveError?.message);
      return json(
        {
          success: false,
          message:
            "Paystack verified the account, but MKH could not save it. No existing bank-account record was replaced.",
        },
        500,
      );
    }

    return json({
      success: true,
      message: "Your bank account has been verified and saved for MKH vendor payouts.",
      account: {
        id: saved.id,
        bankName: saved.bank_name ?? "",
        bankCode,
        accountName: saved.account_name ?? "",
        accountLast4: String(saved.account_number_last4 ?? "").trim(),
        verified: saved.verified === true,
        savedAt: saved.created_at ?? null,
      },
    });
  } catch (error) {
    console.error("Vendor bank-account verification failed:", error);
    return json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Bank-account verification failed. Your saved account was not changed.",
      },
      502,
    );
  }
}
