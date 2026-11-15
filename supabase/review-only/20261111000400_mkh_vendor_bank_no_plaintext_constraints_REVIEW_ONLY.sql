-- MKH prevent reintroduction of plaintext vendor bank numbers
-- REVIEW ONLY — run only after the encrypted backfill has completed and passed
-- verification for all existing vendor bank/application/KYC rows.
--
-- The legacy account_number fields are retained for compatibility during this
-- transition, but are constrained to NULL so future writes must use the
-- encrypted fields. No existing records are deleted.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_bank_accounts_account_number_must_be_null'
      AND conrelid = 'public.vendor_bank_accounts'::regclass
  ) THEN
    ALTER TABLE public.vendor_bank_accounts
      ADD CONSTRAINT vendor_bank_accounts_account_number_must_be_null
      CHECK (account_number IS NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_applications_account_number_must_be_null'
      AND conrelid = 'public.vendor_applications'::regclass
  ) THEN
    ALTER TABLE public.vendor_applications
      ADD CONSTRAINT vendor_applications_account_number_must_be_null
      CHECK (account_number IS NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_kyc_account_number_must_be_null'
      AND conrelid = 'public.vendor_kyc'::regclass
  ) THEN
    ALTER TABLE public.vendor_kyc
      ADD CONSTRAINT vendor_kyc_account_number_must_be_null
      CHECK (account_number IS NULL) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.vendor_bank_accounts
  VALIDATE CONSTRAINT vendor_bank_accounts_account_number_must_be_null;

ALTER TABLE public.vendor_applications
  VALIDATE CONSTRAINT vendor_applications_account_number_must_be_null;

ALTER TABLE public.vendor_kyc
  VALIDATE CONSTRAINT vendor_kyc_account_number_must_be_null;

COMMIT;
