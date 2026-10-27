-- MKH Vendor Commission Offer Decline Support
-- Adds an explicit, audited decline state for offers that have not yet been accepted.
-- This migration does NOT enable commission enforcement, alter checkout, edit accepted terms,
-- create vendor offers, recalculate historical orders, or move money.
-- Run in Supabase SQL Editor after MKH_Vendor_Sales_Commission_Migration.sql.

BEGIN;

DO $constraint$
BEGIN
  IF to_regclass('public.vendor_commission_agreements') IS NULL THEN
    RAISE EXCEPTION 'Required table public.vendor_commission_agreements does not exist. Apply the MKH vendor commission migration first.';
  END IF;
  IF to_regclass('public.vendor_commission_audit') IS NULL THEN
    RAISE EXCEPTION 'Required table public.vendor_commission_audit does not exist. Apply the MKH vendor commission migration first.';
  END IF;
END
$constraint$;

ALTER TABLE public.vendor_commission_agreements
  DROP CONSTRAINT IF EXISTS vendor_commission_agreements_status_check;

ALTER TABLE public.vendor_commission_agreements
  ADD CONSTRAINT vendor_commission_agreements_status_check
  CHECK (status IN ('offered', 'accepted', 'declined', 'superseded', 'expired', 'revoked'));

CREATE OR REPLACE FUNCTION public.mkh_decline_vendor_commission_agreement(
  p_agreement_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_vendor_id uuid;
  v_agreement public.vendor_commission_agreements%ROWTYPE;
  v_before jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_agreement_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Choose an offer and provide a decline reason of at least five characters';
  END IF;

  SELECT p.vendor_id
    INTO v_vendor_id
    FROM public.profiles p
   WHERE p.id = v_actor
     AND p.status = 'active'
     AND p.vendor_id IS NOT NULL;

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Your active profile is not linked to a vendor' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_agreement
    FROM public.vendor_commission_agreements
   WHERE id = p_agreement_id
     AND vendor_id = v_vendor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agreement not found for your vendor';
  END IF;

  IF v_agreement.status <> 'offered' THEN
    RAISE EXCEPTION 'Only an offered agreement can be declined';
  END IF;

  v_before := to_jsonb(v_agreement);

  UPDATE public.vendor_commission_agreements
     SET status = 'declined', updated_at = now()
   WHERE id = p_agreement_id
   RETURNING * INTO v_agreement;

  INSERT INTO public.vendor_commission_audit
    (vendor_id, agreement_id, actor_id, action, before_state, after_state, reason)
  VALUES
    (v_vendor_id, p_agreement_id, v_actor, 'agreement_declined', v_before, to_jsonb(v_agreement), btrim(p_reason));

  RETURN jsonb_build_object(
    'success', true,
    'agreement_id', v_agreement.id,
    'agreement_version', v_agreement.agreement_version,
    'status', v_agreement.status,
    'declined_at', now()
  );
END
$function$;

REVOKE ALL ON FUNCTION public.mkh_decline_vendor_commission_agreement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkh_decline_vendor_commission_agreement(uuid, text) TO authenticated, service_role;

COMMIT;

-- Read-only verification:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.vendor_commission_agreements'::regclass
--   AND conname = 'vendor_commission_agreements_status_check';
-- SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND proname = 'mkh_decline_vendor_commission_agreement';
