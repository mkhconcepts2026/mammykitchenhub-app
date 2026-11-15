-- MKH vendor bank-data direct permission hardening
-- REVIEW ONLY — DO NOT APPLY until MKH explicitly approves.
--
-- Security model:
--   * vendor_bank_accounts is accessed only through authenticated server routes
--     using service_role. No browser role needs direct table access.
--   * vendor_applications is used by the Admin dashboard through the
--     authenticated client for SELECT/UPDATE. Existing RLS policies restrict
--     those operations to Admin profiles. Public INSERT is moved to the
--     server-side encrypted onboarding endpoint.
--   * vendor_kyc vendor read/insert flows are protected by the existing
--     auth.uid() = vendor_id RLS policies. Keep only SELECT/INSERT for
--     authenticated users; Admin/KYC APIs continue through service_role.
--
-- This SQL does not modify data, RLS policy conditions (except removal of the
-- no-longer-needed public application INSERT policy), payout statuses, wallet
-- balances, settlement records, or transfer state.

BEGIN;

REVOKE ALL PRIVILEGES
ON TABLE public.vendor_bank_accounts
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.vendor_applications
FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE
ON TABLE public.vendor_applications
TO authenticated;

DROP POLICY IF EXISTS "Allow public insert vendor applications"
ON public.vendor_applications;

REVOKE ALL PRIVILEGES
ON TABLE public.vendor_kyc
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT
ON TABLE public.vendor_kyc
TO authenticated;

COMMIT;
