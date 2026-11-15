-- MKH Rider Self-Service Automated Payouts - TEST PHASE ONLY
-- Review-only migration. Do not apply until MKH approves the complete SQL.
-- Does not alter vendor payout functions, process_order_settlement, rider earnings,
-- existing wallet balances, historical ledger rows, or Monday settlement/release logic.

BEGIN;

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.profiles');
  END IF;
  IF to_regclass('public.rider_wallets') IS NULL THEN
    v_missing := array_append(v_missing, 'public.rider_wallets');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='rider_id' AND data_type='uuid') THEN v_missing := array_append(v_missing, 'rider_wallets.rider_id UUID'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='available_balance' AND data_type='numeric') THEN v_missing := array_append(v_missing, 'rider_wallets.available_balance NUMERIC'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='pending_balance' AND data_type='numeric') THEN v_missing := array_append(v_missing, 'rider_wallets.pending_balance NUMERIC'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='updated_at') THEN v_missing := array_append(v_missing, 'rider_wallets.updated_at'); END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id' AND data_type='uuid') THEN
    v_missing := array_append(v_missing, 'profiles.id UUID');
  END IF;
  IF to_regclass('public.rider_bank_accounts') IS NOT NULL THEN
    v_missing := array_append(v_missing, 'public.rider_bank_accounts already exists; inspect its complete schema before extending it');
  END IF;
  IF to_regclass('public.rider_payout_requests') IS NOT NULL THEN
    v_missing := array_append(v_missing, 'public.rider_payout_requests already exists; inspect its complete schema before extending it');
  END IF;
  IF to_regclass('public.rider_payout_events') IS NOT NULL THEN
    v_missing := array_append(v_missing, 'public.rider_payout_events already exists; inspect its complete schema before extending it');
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='rider_wallets'
       AND column_name='payout_reserved_balance' AND data_type <> 'numeric'
  ) THEN
    v_missing := array_append(v_missing, 'rider_wallets.payout_reserved_balance must be numeric');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Rider payout migration preflight failed: %. No migration changes applied.', array_to_string(v_missing, ', ');
  END IF;
END;
$preflight$;

-- Dedicated reservation amount. Existing available/pending/lifetime amounts are untouched.
ALTER TABLE public.rider_wallets
  ADD COLUMN IF NOT EXISTS payout_reserved_balance numeric(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.rider_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  bank_name text NOT NULL,
  bank_code text NOT NULL,
  account_name text NOT NULL,
  account_number_last4 char(4) NOT NULL,
  account_number_encrypted text NOT NULL,
  paystack_recipient_code text NOT NULL,
  verification_status text NOT NULL DEFAULT 'disabled' CHECK (verification_status IN ('verified','disabled')),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rider_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES public.rider_bank_accounts(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','transfer_submitted','needs_reconciliation','successful','failed','reversed')),
  transfer_reference text NOT NULL UNIQUE,
  paystack_transfer_code text,
  paystack_transfer_id bigint,
  destination_bank_name text NOT NULL,
  destination_account_name text NOT NULL,
  destination_account_last4 char(4) NOT NULL,
  paystack_recipient_code_snapshot text NOT NULL,
  failure_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.rider_payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.rider_payout_requests(id) ON DELETE RESTRICT,
  provider_event_type text NOT NULL CHECK (provider_event_type IN ('transfer.success','transfer.failed','transfer.reversed')),
  transfer_reference text NOT NULL,
  transfer_code text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payout_id, provider_event_type)
);

CREATE INDEX IF NOT EXISTS rider_payout_requests_rider_history_idx
  ON public.rider_payout_requests (rider_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS rider_payout_requests_active_lookup_idx
  ON public.rider_payout_requests (rider_id, requested_at DESC)
  WHERE status IN ('reserved','transfer_submitted','needs_reconciliation');

CREATE UNIQUE INDEX IF NOT EXISTS rider_payout_requests_one_active_per_rider_uq
  ON public.rider_payout_requests (rider_id)
  WHERE status IN ('reserved','transfer_submitted','needs_reconciliation');

ALTER TABLE public.rider_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_bank_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rider_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_payout_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rider_payout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_payout_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS riders_view_own_payout_requests ON public.rider_payout_requests;
CREATE POLICY riders_view_own_payout_requests
  ON public.rider_payout_requests FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

-- Bank-account ciphertext, recipient codes and event data are server-only.
REVOKE ALL ON public.rider_bank_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.rider_payout_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.rider_payout_requests FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.rider_payout_requests FROM authenticated;
GRANT SELECT ON public.rider_payout_requests TO authenticated;
GRANT ALL ON public.rider_bank_accounts, public.rider_payout_requests, public.rider_payout_events TO service_role;

CREATE OR REPLACE FUNCTION public.mkh_rider_reserve_payout(
  p_rider_id uuid,
  p_bank_account_id uuid,
  p_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_wallet public.rider_wallets%ROWTYPE;
  v_bank public.rider_bank_accounts%ROWTYPE;
  v_wallet_count integer;
  v_amount numeric(14,2);
  v_payout public.rider_payout_requests%ROWTYPE;
BEGIN
  IF p_rider_id IS NULL OR p_bank_account_id IS NULL OR p_reference IS NULL OR p_reference !~ '^[a-z0-9_-]{16,50}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Rider, verified bank account and valid transfer reference are required.');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_rider_id FOR UPDATE;
  IF NOT FOUND OR lower(coalesce(v_profile.role,'')) <> 'rider' OR lower(coalesce(v_profile.status,'')) <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'An active rider account is required.');
  END IF;

  SELECT * INTO v_bank FROM public.rider_bank_accounts
   WHERE id = p_bank_account_id AND rider_id = p_rider_id AND verification_status = 'verified'
   FOR UPDATE;
  IF NOT FOUND OR v_bank.paystack_recipient_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'A verified Paystack bank recipient is required.');
  END IF;

  SELECT count(*)::integer INTO v_wallet_count FROM public.rider_wallets WHERE rider_id = p_rider_id;
  IF v_wallet_count <> 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Exactly one rider wallet is required. Finance review is required.');
  END IF;

  SELECT * INTO v_wallet FROM public.rider_wallets WHERE rider_id = p_rider_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.rider_payout_requests
     WHERE rider_id = p_rider_id AND status IN ('reserved','transfer_submitted','needs_reconciliation')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'An earlier withdrawal is still being processed or reconciled.');
  END IF;

  v_amount := round(coalesce(v_wallet.available_balance,0), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'There is no available balance to withdraw.');
  END IF;

  UPDATE public.rider_wallets
     SET available_balance = 0,
         payout_reserved_balance = coalesce(payout_reserved_balance,0) + v_amount,
         updated_at = now()
   WHERE rider_id = p_rider_id;

  INSERT INTO public.rider_payout_requests (
    rider_id, bank_account_id, amount, status, transfer_reference,
    destination_bank_name, destination_account_name, destination_account_last4, paystack_recipient_code_snapshot
  ) VALUES (
    p_rider_id, p_bank_account_id, v_amount, 'reserved', p_reference,
    v_bank.bank_name, v_bank.account_name, v_bank.account_number_last4, v_bank.paystack_recipient_code
  ) RETURNING * INTO v_payout;

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'amount', v_amount, 'reference', p_reference,
    'recipient_code', v_bank.paystack_recipient_code, 'status', v_payout.status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_mark_payout_submitted(
  p_payout_id uuid,
  p_transfer_code text,
  p_transfer_id bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE v_rows integer; v_existing_status text;
BEGIN
  UPDATE public.rider_payout_requests
     SET status = 'transfer_submitted', paystack_transfer_code = p_transfer_code,
         paystack_transfer_id = p_transfer_id, status_updated_at = now()
   WHERE id = p_payout_id AND status = 'reserved';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT status INTO v_existing_status FROM public.rider_payout_requests WHERE id = p_payout_id;
    IF v_existing_status IN ('transfer_submitted','needs_reconciliation','successful','failed','reversed') THEN
      RETURN jsonb_build_object('success', true, 'status', v_existing_status, 'already_advanced', true);
    END IF;
    RETURN jsonb_build_object('success', false, 'message', 'Payout request is not in a reservable state.');
  END IF;
  RETURN jsonb_build_object('success', true, 'status', 'transfer_submitted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_mark_payout_uncertain(
  p_payout_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE v_rows integer;
BEGIN
  UPDATE public.rider_payout_requests
     SET status = 'needs_reconciliation', failure_reason = left(coalesce(p_reason,'Outcome uncertain.'),300), status_updated_at = now()
   WHERE id = p_payout_id AND status IN ('reserved','transfer_submitted');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('success', v_rows = 1, 'status', CASE WHEN v_rows = 1 THEN 'needs_reconciliation' ELSE 'unchanged' END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_apply_paystack_transfer_event(
  p_reference text,
  p_event_type text,
  p_transfer_code text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_payout public.rider_payout_requests%ROWTYPE;
  v_wallet public.rider_wallets%ROWTYPE;
  v_inserted integer;
  v_wallet_count integer;
BEGIN
  IF p_event_type IS NULL OR p_event_type NOT IN ('transfer.success','transfer.failed','transfer.reversed') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unsupported Paystack transfer event.');
  END IF;

  SELECT * INTO v_payout FROM public.rider_payout_requests WHERE transfer_reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Rider payout reference was not found.'); END IF;

  INSERT INTO public.rider_payout_events (payout_id, provider_event_type, transfer_reference, transfer_code, failure_reason)
  VALUES (v_payout.id, p_event_type, p_reference, p_transfer_code, left(p_failure_reason,300))
  ON CONFLICT (payout_id, provider_event_type) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN jsonb_build_object('success', true, 'duplicate', true, 'status', v_payout.status); END IF;

  IF v_payout.status IN ('successful','failed','reversed') THEN
    RETURN jsonb_build_object('success', true, 'terminal', true, 'status', v_payout.status);
  END IF;

  SELECT count(*)::integer INTO v_wallet_count FROM public.rider_wallets WHERE rider_id = v_payout.rider_id;
  IF v_wallet_count <> 1 THEN RAISE EXCEPTION 'Exactly one rider wallet is required to reconcile payout %.', v_payout.id; END IF;
  SELECT * INTO v_wallet FROM public.rider_wallets WHERE rider_id = v_payout.rider_id FOR UPDATE;
  IF coalesce(v_wallet.payout_reserved_balance,0) < v_payout.amount THEN
    RAISE EXCEPTION 'Rider payout reservation does not cover payout %. Finance reconciliation is required.', v_payout.id;
  END IF;

  IF p_event_type = 'transfer.success' THEN
    UPDATE public.rider_wallets SET payout_reserved_balance = payout_reserved_balance - v_payout.amount, updated_at = now()
     WHERE rider_id = v_payout.rider_id;
    UPDATE public.rider_payout_requests SET status='successful', paystack_transfer_code=coalesce(p_transfer_code,paystack_transfer_code),
      failure_reason=NULL, status_updated_at=now(), completed_at=now() WHERE id=v_payout.id;
  ELSE
    UPDATE public.rider_wallets SET available_balance = coalesce(available_balance,0) + v_payout.amount,
      payout_reserved_balance = payout_reserved_balance - v_payout.amount, updated_at = now()
     WHERE rider_id = v_payout.rider_id;
    UPDATE public.rider_payout_requests SET status=CASE WHEN p_event_type='transfer.failed' THEN 'failed' ELSE 'reversed' END,
      paystack_transfer_code=coalesce(p_transfer_code,paystack_transfer_code), failure_reason=left(coalesce(p_failure_reason,p_event_type),300),
      status_updated_at=now(), completed_at=now() WHERE id=v_payout.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_event_type='transfer.success' THEN 'successful' WHEN p_event_type='transfer.failed' THEN 'failed' ELSE 'reversed' END);
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_rider_reserve_payout(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_mark_payout_submitted(uuid,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_mark_payout_uncertain(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_apply_paystack_transfer_event(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_reserve_payout(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_rider_mark_payout_submitted(uuid,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_rider_mark_payout_uncertain(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_rider_apply_paystack_transfer_event(text,text,text,text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
