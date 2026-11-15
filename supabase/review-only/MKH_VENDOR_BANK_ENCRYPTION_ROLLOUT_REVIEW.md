# MKH vendor bank-account encryption rollout

Status: staged for review. No SQL in this folder has been applied to the live MKH-production project.

## Scope

Protect full bank account numbers in:
- public.vendor_bank_accounts
- public.vendor_applications
- public.vendor_kyc

The application uses AES-256-GCM encryption with a server-only key named
`MKH_VENDOR_PAYOUT_ENCRYPTION_KEY`. This key must be a Base64-encoded 32-byte
random value. Never use a `NEXT_PUBLIC_` prefix. Keep a recovery copy in MKH's
approved password manager or secret vault; losing the key makes stored
ciphertext unrecoverable.

The vendor onboarding flow stores only ciphertext and last-four metadata.
Vendor bank-account updates continue through the existing Paystack account
verification route. Finance/Admin server routes decrypt only for an authorized
Finance/Admin session. The browser never receives ciphertext.

## Required rollout order

1. Generate a fresh 32-byte key on a trusted machine and store its recovery
   copy securely. Add the same secret value to the Vercel Preview and Production
   environments before using the encrypted routes. Do not paste it into source,
   chat, SQL, logs, or a `NEXT_PUBLIC_` variable.
2. Review and approve the schema-only SQL:
   `20261111000200_mkh_vendor_account_encryption_columns_REVIEW_ONLY.sql`.
   It adds encrypted and last-four columns and does not delete legacy values.
3. Deploy the matching application patch only after the schema exists and the
   key is configured. Keep this branch as Preview until the database rollout
   and regression checks are complete.
4. Temporarily set the server-only Vercel flag
   `MKH_ENABLE_VENDOR_BANK_ENCRYPTION_MIGRATION=true`, deploy it, and invoke
   `POST /api/admin/security/vendor-bank-encryption` while signed in as an
   active Admin. The endpoint is additionally gated, preflights all three
   tables, encrypts existing valid 10-digit numbers, clears legacy plaintext,
   and verifies the ciphertext/last-four pairing. It returns counts only.
5. Confirm the backfill reports zero plaintext rows for all three tables.
   If preflight or verification fails, stop and investigate; do not proceed to
   permissions or the no-plaintext constraints.
6. Review and approve the permissions SQL:
   `20261111000300_mkh_vendor_bank_permissions_REVIEW_ONLY.sql`.
   It removes direct browser access to vendor_bank_accounts, removes the
   obsolete public INSERT policy for vendor applications while preserving
   Admin SELECT/UPDATE via the existing RLS rules, and keeps authenticated
   vendor-owned SELECT/INSERT for vendor_kyc.
7. Review and approve the post-backfill constraints SQL:
   `20261111000400_mkh_vendor_bank_no_plaintext_constraints_REVIEW_ONLY.sql`.
   It validates that all three legacy `account_number` columns remain NULL.
8. Set `MKH_ENABLE_VENDOR_BANK_ENCRYPTION_MIGRATION=false` or remove the
   variable. Verify Bank Account GET/PUT, vendor onboarding, Admin KYC review,
   Admin application review/approval, and Finance payout queue. Verify that
   encrypted data cannot be read by browser roles and Finance sees the
   verified account only after successful server-side decryption.
9. Only after all checks pass may the security branch be merged into the
   designated MKH working branch. Do not initiate any real payout until this
   work is complete.

## Data and business-rule safeguards

- No payout request, payout status, wallet amount, earning, settlement,
  commission, or historical order is changed by these changes.
- Existing vendor and KYC records are updated in place; no application/KYC
  record is deleted or recreated.
- COD test records remain test artifacts.
- COD remains disabled for production. Customer payment remains Paystack card
  or MKH Wallet.
- The current test payout request for Floral Kitchen Foods remains in
  Processing with its reserved balance unchanged. No transfer is initiated.
