-- MKH vendor bank-account API permission hardening
-- REVIEW ONLY — DO NOT APPLY until MKH explicitly approves the database change.
--
-- Audit findings on MKH-production (ujjxnexhuuekrbrnnwcg):
--   * public.vendor_bank_accounts has RLS enabled.
--   * No row-level policies currently exist on this table.
--   * anon and authenticated currently hold broad table privileges,
--     including INSERT, UPDATE, DELETE and TRUNCATE.
--   * Current MKH vendor/Finance code reads and writes this table only
--     through server-side adminClient (service_role) endpoints.
--
-- This change removes direct Data API table privileges from client roles.
-- It does NOT modify vendor bank records, payout requests, wallet balances,
-- payout functions, settlement logic, or payment status.
--
-- Before application, verify no additional browser-side dependency has been
-- introduced since this review. Keep RLS enabled and retain service_role's
-- existing server-side access.

BEGIN;

REVOKE ALL PRIVILEGES
ON TABLE public.vendor_bank_accounts
FROM PUBLIC, anon, authenticated;

COMMIT;
