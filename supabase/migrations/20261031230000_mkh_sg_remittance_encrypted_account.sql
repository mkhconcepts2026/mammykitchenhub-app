-- MKH SG Global Alliance remittance: encrypted account-number storage foundation.
-- Account details can be saved without verifying the bank account or initiating transfers.
ALTER TABLE public.sg_global_alliance_remittance_profiles
    ADD COLUMN IF NOT EXISTS account_number_encrypted TEXT;

COMMENT ON COLUMN public.sg_global_alliance_remittance_profiles.account_number_encrypted IS
    'AES-256-GCM encrypted account number. Encrypted only in the authorised server API; never return this value to the browser or log it.';