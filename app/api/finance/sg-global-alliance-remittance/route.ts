import { createCipheriv, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeRole(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function requireFinanceAccess() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: failure("Your session has expired. Please sign in again.", 401) } as const;

  const [{ data: profile, error: profileError }, { data: effectiveRole, error: roleError }] = await Promise.all([
    adminClient.from("profiles").select("id,status").eq("id", user.id).maybeSingle(),
    supabase.rpc("current_effective_app_role"),
  ]);

  if (profileError || !profile || String(profile.status ?? "").toLowerCase() !== "active") {
    return { response: failure("An active Finance account is required.", 403) } as const;
  }
  if (roleError || !["finance", "admin", "coo"].includes(normalizeRole(effectiveRole))) {
    return { response: failure("Finance, Admin or COO access is required.", 403) } as const;
  }
  return { userId: user.id } as const;
}

function encryptAccountNumber(accountNumber: string): string {
  const encodedKey = process.env.MKH_SG_REMITTANCE_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error("MKH_SG_REMITTANCE_ENCRYPTION_KEY is not configured on the server.");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("MKH_SG_REMITTANCE_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

async function getSgProfile() {
  const { data: registry, error: registryError } = await adminClient
    .from("delivery_beneficiary_registry")
    .select("id, beneficiary_code, beneficiary_type")
    .eq("beneficiary_code", "SG-GLOBAL-ALLIANCE")
    .eq("beneficiary_type", "sg_global_alliance")
    .maybeSingle();
  if (registryError || !registry) throw new Error("The SG Global Alliance beneficiary registry record could not be found.");

  const [{ data: profile, error: profileError }, { data: wallet, error: walletError }] = await Promise.all([
    adminClient.from("sg_global_alliance_remittance_profiles")
      .select("id, provider, currency, bank_name, bank_code, account_name, account_number_last4, provider_recipient_code, status, account_verified_at, recipient_created_at, updated_at")
      .eq("beneficiary_registry_id", registry.id).maybeSingle(),
    adminClient.from("wallets")
      .select("available_balance, lifetime_earnings")
      .eq("owner_type", "sg_global_alliance").eq("owner_id", registry.id).maybeSingle(),
  ]);
  if (profileError || !profile) throw new Error("The SG Global Alliance remittance profile is unavailable. Apply its profile migration first.");
  if (walletError) throw new Error("The SG Global Alliance internal wallet could not be loaded.");

  return {
    id: profile.id,
    provider: profile.provider,
    currency: profile.currency,
    bank_name: profile.bank_name,
    bank_code: profile.bank_code,
    account_name: profile.account_name,
    account_number_last4: profile.account_number_last4,
    status: profile.status,
    account_verified_at: profile.account_verified_at,
    recipient_created_at: profile.recipient_created_at,
    updated_at: profile.updated_at,
    wallet_available_balance: wallet?.available_balance ?? 0,
    wallet_lifetime_earnings: wallet?.lifetime_earnings ?? 0,
  };
}

export async function GET() {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;
  try {
    const profile = await getSgProfile();
    return NextResponse.json({ success: true, profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to load SG remittance profile.", 500);
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireFinanceAccess();
  if ("response" in access) return access.response;

  let body: any;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON."); }

  const bankName = typeof body?.bank_name === "string" ? body.bank_name.trim() : "";
  const bankCode = typeof body?.bank_code === "string" ? body.bank_code.trim() : "";
  const accountName = typeof body?.account_name === "string" ? body.account_name.trim() : "";
  const accountNumber = typeof body?.account_number === "string" ? body.account_number.trim() : "";

  if (bankName.length < 2 || bankName.length > 100) return failure("Enter a valid bank name.");
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(bankCode)) return failure("Enter a valid bank code.");
  if (accountName.length < 2 || accountName.length > 120) return failure("Enter the official account holder name.");
  if (!/^\d{10}$/.test(accountNumber)) return failure("Enter a valid 10-digit Nigerian bank account number.");

  try {
    const encryptedAccount = encryptAccountNumber(accountNumber);
    const { data: registry, error: registryError } = await adminClient
      .from("delivery_beneficiary_registry")
      .select("id")
      .eq("beneficiary_code", "SG-GLOBAL-ALLIANCE")
      .eq("beneficiary_type", "sg_global_alliance")
      .maybeSingle();
    if (registryError || !registry) return failure("The SG Global Alliance beneficiary registry record could not be found.", 500);

    const { data: existing, error: existingError } = await adminClient
      .from("sg_global_alliance_remittance_profiles")
      .select("id,status")
      .eq("beneficiary_registry_id", registry.id)
      .maybeSingle();
    if (existingError || !existing) return failure("The SG remittance profile is missing. Apply the profile migration first.", 500);
    if (existing.status !== "not_configured") return failure("This SG remittance profile is no longer editable in setup-only mode.", 409);

    const { data: updated, error: updateError } = await adminClient
      .from("sg_global_alliance_remittance_profiles")
      .update({
        bank_name: bankName,
        bank_code: bankCode,
        account_name: accountName,
        account_number_last4: accountNumber.slice(-4),
        account_number_encrypted: encryptedAccount,
        status: "not_configured",
        account_verified_at: null,
        recipient_created_at: null,
        provider_recipient_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("status", "not_configured")
      .select("id,provider,currency,bank_name,bank_code,account_name,account_number_last4,status,account_verified_at,recipient_created_at,updated_at")
      .maybeSingle();

    if (updateError || !updated) return failure(updateError?.message || "SG bank details were not saved. The profile may have changed; refresh and try again.", 409);

    return NextResponse.json({
      success: true,
      message: "SG bank details saved securely. No account verification, Paystack recipient creation or transfer was performed.",
      profile: { ...updated },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("SG remittance profile save failed:", error instanceof Error ? error.message : "unknown error");
    return failure(error instanceof Error ? error.message : "SG bank details could not be saved.", 500);
  }
}