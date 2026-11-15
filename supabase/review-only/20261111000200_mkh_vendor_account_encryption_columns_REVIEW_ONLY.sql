-- MKH vendor bank-account encryption columns
-- REVIEW ONLY — do not apply until MKH explicitly approves the database migration.
--
-- Adds versioned AES-256-GCM ciphertext and last-four metadata for all vendor
-- bank-number records. Existing account_number values are intentionally kept
-- temporarily so the application can encrypt and verify them in a controlled
-- server-side backfill. No payout status, wallet, settlement, or vendor record
-- is deleted or changed by this migration.
--
-- Apply only after the matching application patch is reviewed. Run the
-- protected server-side encryption backfill before clearing any legacy
-- plaintext account_number fields.

BEGIN;

ALTER TABLE public.vendor_bank_accounts
  ADD COLUMN IF NOT EXISTS account_number_encrypted text,
  ADD COLUMN IF NOT EXISTS account_number_last4 character(4);

ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS account_number_encrypted text,
  ADD COLUMN IF NOT EXISTS account_number_last4 character(4);

ALTER TABLE public.vendor_kyc
  ADD COLUMN IF NOT EXISTS account_number_encrypted text,
  ADD COLUMN IF NOT EXISTS account_number_last4 character(4);

UPDATE public.vendor_bank_accounts
SET account_number_last4 = RIGHT(REGEXP_REPLACE(account_number, '\D', '', 'g'), 4)
WHERE NULLIF(BTRIM(account_number), '') IS NOT NULL
  AND account_number_last4 IS NULL;

UPDATE public.vendor_applications
SET account_number_last4 = RIGHT(REGEXP_REPLACE(account_number, '\D', '', 'g'), 4)
WHERE NULLIF(BTRIM(account_number), '') IS NOT NULL
  AND account_number_last4 IS NULL;

UPDATE public.vendor_kyc
SET account_number_last4 = RIGHT(REGEXP_REPLACE(account_number, '\D', '', 'g'), 4)
WHERE NULLIF(BTRIM(account_number), '') IS NOT NULL
  AND account_number_last4 IS NULL;

COMMIT;
