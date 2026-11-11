import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  decryptVendorBankAccountNumber,
  encryptVendorBankAccountNumber,
} from "@/lib/vendor-payout/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES = [
  "vendor_bank_accounts",
  "vendor_applications",
  "vendor_kyc",
] as const;

type TableName = (typeof TABLES)[number];

type AccountRow = {
  id: string;
  account_number: string | null;
  account_number_encrypted: string | null;
  account_number_last4: string | null;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function normalizeAccountNumber(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

async function requireActiveAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { response: json({ success: false, message: "Please sign in again." }, 401) } as const;
  }

  const [
    { data: profile, error: profileError },
    { data: effectiveRole, error: roleError },
  ] = await Promise.all([
    adminClient.from("profiles").select("id,status").eq("id", user.id).maybeSingle(),
    supabase.rpc("current_effective_app_role"),
  ]);

  if (
    profileError ||
    !profile ||
    String(profile.status ?? "").toLowerCase() !== "active" ||
    roleError ||
    String(effectiveRole ?? "").toUpperCase() !== "ADMIN"
  ) {
    return { response: json({ success: false, message: "An active Admin account is required for this one-time security migration." }, 403) } as const;
  }

  return { userId: user.id } as const;
}

export async function POST() {
  if (process.env.MKH_ENABLE_VENDOR_BANK_ENCRYPTION_MIGRATION !== "true") {
    return json({ success: false, message: "The one-time vendor bank encryption migration is disabled." }, 404);
  }

  const access = await requireActiveAdmin();
  if ("response" in access) return access.response;

  try {
    // Preflight every table before writing anything. This avoids starting a
    // partial backfill if any existing number is invalid or ciphertext fails
    // authentication. The operation is idempotent and safe to retry.
    const plans: Array<{
      table: TableName;
      id: string;
      expectedPlaintext: string | null;
      patch: {
        account_number: null;
        account_number_encrypted?: string;
        account_number_last4?: string;
      };
    }> = [];

    for (const table of TABLES) {
      const { data, error } = await (adminClient as any)
        .from(table)
        .select("id,account_number,account_number_encrypted,account_number_last4");

      if (error) {
        console.error("Vendor account encryption preflight failed:", table, error.message);
        return json({
          success: false,
          message: "The encryption columns are not ready or a vendor bank-data table could not be read. No records were changed.",
        }, 500);
      }

      const rows = (data ?? []) as AccountRow[];

      for (const row of rows) {
        const storedPlaintext =
          typeof row.account_number === "string" ? row.account_number : null;
        const raw =
          storedPlaintext && storedPlaintext.trim() ? storedPlaintext : null;
        const digits = raw ? normalizeAccountNumber(raw) : "";
        const existingCiphertext = String(row.account_number_encrypted ?? "").trim();
        const currentLast4 = String(row.account_number_last4 ?? "").trim();

        if (existingCiphertext) {
          const decrypted = decryptVendorBankAccountNumber(existingCiphertext);
          if (raw && digits !== decrypted) {
            return json({
              success: false,
              message: "A stored encrypted account does not match its legacy value. No records were changed; manual review is required.",
              table,
            }, 409);
          }

          const last4 = decrypted.slice(-4);
          if (storedPlaintext !== null || currentLast4 !== last4) {
            plans.push({
              table,
              id: row.id,
              expectedPlaintext: storedPlaintext,
              patch: {
                account_number: null,
                account_number_last4: last4,
              },
            });
          }
          continue;
        }

        if (raw) {
          if (!/^\d{10}$/.test(digits)) {
            return json({
              success: false,
              message: "An existing vendor bank number is not a valid 10-digit Nigerian account number. No records were changed; manual review is required.",
              table,
            }, 409);
          }

          plans.push({
            table,
            id: row.id,
            expectedPlaintext: storedPlaintext,
            patch: {
              account_number: null,
              account_number_encrypted: encryptVendorBankAccountNumber(digits),
              account_number_last4: digits.slice(-4),
            },
          });
        } else if (storedPlaintext !== null) {
          // Clear empty/whitespace-only legacy values before the final
          // database constraint requires the old column to remain NULL.
          plans.push({
            table,
            id: row.id,
            expectedPlaintext: storedPlaintext,
            patch: { account_number: null },
          });
        }
      }
    }

    const changedByTable: Record<string, number> = {
      vendor_bank_accounts: 0,
      vendor_applications: 0,
      vendor_kyc: 0,
    };

    for (const plan of plans) {
      let query = (adminClient as any)
        .from(plan.table)
        .update(plan.patch)
        .eq("id", plan.id);

      query = plan.expectedPlaintext === null
        ? query.is("account_number", null)
        : query.eq("account_number", plan.expectedPlaintext);

      const { data, error } = await query.select("id").maybeSingle();
      if (error || !data) {
        console.error("Vendor account encryption update failed:", plan.table, error?.message ?? "Record changed during migration.");
        return json({
          success: false,
          message: "The backfill stopped because a record changed during migration. It is safe to rerun after reviewing the table status.",
          changed_before_stop: changedByTable,
        }, 409);
      }
      changedByTable[plan.table] += 1;
    }

    const verifiedByTable: Record<string, {
      rows: number;
      encrypted_and_verified: number;
      plaintext_remaining: number;
      no_full_number: number;
    }> = {};

    for (const table of TABLES) {
      const { data, error } = await (adminClient as any)
        .from(table)
        .select("id,account_number,account_number_encrypted,account_number_last4");

      if (error) {
        return json({
          success: false,
          message: "The backfill completed its writes, but the final verification query failed. Rerun the migration to verify its idempotent state.",
          changed: changedByTable,
        }, 500);
      }

      const rows = (data ?? []) as AccountRow[];
      let encryptedAndVerified = 0;
      let plaintextRemaining = 0;
      let noFullNumber = 0;

      for (const row of rows) {
        if (row.account_number !== null && String(row.account_number).trim() !== "") {
          plaintextRemaining += 1;
        }

        if (row.account_number_encrypted) {
          const decrypted = decryptVendorBankAccountNumber(row.account_number_encrypted);
          if (String(row.account_number_last4 ?? "").trim() !== decrypted.slice(-4)) {
            throw new Error("A last-four verification check failed after encryption.");
          }
          encryptedAndVerified += 1;
        } else {
          noFullNumber += 1;
        }
      }

      verifiedByTable[table] = {
        rows: rows.length,
        encrypted_and_verified: encryptedAndVerified,
        plaintext_remaining: plaintextRemaining,
        no_full_number: noFullNumber,
      };
    }

    const allPlaintextCleared = Object.values(verifiedByTable)
      .every((item) => item.plaintext_remaining === 0);

    return json({
      success: allPlaintextCleared,
      changed: changedByTable,
      verification: verifiedByTable,
      message: allPlaintextCleared
        ? "Vendor bank-account ciphertext verified and legacy plaintext fields cleared."
        : "Encryption completed with plaintext still present. Do not enable vendor payouts until the remaining rows are reviewed.",
    }, allPlaintextCleared ? 200 : 409);
  } catch (error) {
    console.error("Vendor bank-account encryption migration failed:", error instanceof Error ? error.message : "unknown error");
    return json({
      success: false,
      message: "Vendor bank-account encryption failed. No account numbers were returned; review the database and rerun only after checking the migration state.",
    }, 500);
  }
}
