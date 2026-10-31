-- MKH Finance Dashboard Command Center
-- TEST FIRST. Creates read-model and zero-balance rider-wallet activation functions.
-- Does not update orders, financial ledger entries, wallet balances, payout requests,
-- settlement states, commission allocations, or transfer records.

BEGIN;

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.profiles');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id') THEN v_missing := array_append(v_missing, 'profiles.id'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') THEN v_missing := array_append(v_missing, 'profiles.role'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='status') THEN v_missing := array_append(v_missing, 'profiles.status'); END IF;
  END IF;

  IF to_regclass('public.orders') IS NULL THEN
    v_missing := array_append(v_missing, 'public.orders');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='id') THEN v_missing := array_append(v_missing, 'orders.id'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='total') THEN v_missing := array_append(v_missing, 'orders.total'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='payment_method') THEN v_missing := array_append(v_missing, 'orders.payment_method'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='payment_status') THEN v_missing := array_append(v_missing, 'orders.payment_status'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='created_at') THEN v_missing := array_append(v_missing, 'orders.created_at'); END IF;
  END IF;

  IF to_regclass('public.financial_ledger') IS NULL THEN
    v_missing := array_append(v_missing, 'public.financial_ledger');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_ledger' AND column_name='entry_type') THEN v_missing := array_append(v_missing, 'financial_ledger.entry_type'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_ledger' AND column_name='status') THEN v_missing := array_append(v_missing, 'financial_ledger.status'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_ledger' AND column_name='amount') THEN v_missing := array_append(v_missing, 'financial_ledger.amount'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_ledger' AND column_name='created_at') THEN v_missing := array_append(v_missing, 'financial_ledger.created_at'); END IF;
  END IF;

  IF to_regclass('public.vendor_wallets') IS NULL THEN
    v_missing := array_append(v_missing, 'public.vendor_wallets');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_wallets' AND column_name='available_balance') THEN v_missing := array_append(v_missing, 'vendor_wallets.available_balance'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_wallets' AND column_name='pending_balance') THEN v_missing := array_append(v_missing, 'vendor_wallets.pending_balance'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_wallets' AND column_name='accrued_balance') THEN v_missing := array_append(v_missing, 'vendor_wallets.accrued_balance'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_wallets' AND column_name='lifetime_earnings') THEN v_missing := array_append(v_missing, 'vendor_wallets.lifetime_earnings'); END IF;
  END IF;

  IF to_regclass('public.rider_wallets') IS NULL THEN
    v_missing := array_append(v_missing, 'public.rider_wallets');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='rider_id') THEN v_missing := array_append(v_missing, 'rider_wallets.rider_id'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='available_balance') THEN v_missing := array_append(v_missing, 'rider_wallets.available_balance'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='pending_balance') THEN v_missing := array_append(v_missing, 'rider_wallets.pending_balance'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='lifetime_earnings') THEN v_missing := array_append(v_missing, 'rider_wallets.lifetime_earnings'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rider_wallets' AND column_name='updated_at') THEN v_missing := array_append(v_missing, 'rider_wallets.updated_at'); END IF;
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'rider_wallets'
        AND c.is_nullable = 'NO'
        AND c.column_default IS NULL
        AND c.is_identity = 'NO'
        AND c.is_generated = 'NEVER'
        AND c.column_name NOT IN ('rider_id', 'available_balance', 'pending_balance', 'lifetime_earnings', 'updated_at')
    ) THEN
      RAISE EXCEPTION 'rider_wallets contains an additional required column without a default. Wallet activation was not enabled; review the table schema first.';
    END IF;
  END IF;

  IF to_regclass('public.customer_wallets') IS NULL THEN
    v_missing := array_append(v_missing, 'public.customer_wallets');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_wallets' AND column_name='available_balance') THEN v_missing := array_append(v_missing, 'customer_wallets.available_balance'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_wallets' AND column_name='locked_balance') THEN v_missing := array_append(v_missing, 'customer_wallets.locked_balance'); END IF;
  END IF;

  IF to_regclass('public.payout_requests') IS NULL THEN
    v_missing := array_append(v_missing, 'public.payout_requests');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payout_requests' AND column_name='requester_type') THEN v_missing := array_append(v_missing, 'payout_requests.requester_type'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payout_requests' AND column_name='status') THEN v_missing := array_append(v_missing, 'payout_requests.status'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payout_requests' AND column_name='amount') THEN v_missing := array_append(v_missing, 'payout_requests.amount'); END IF;
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Finance dashboard prerequisites missing: %. No migration changes applied.', array_to_string(v_missing, ', ');
  END IF;
END;
$preflight$;

-- Authoritative Finance read model. Values remain separated by source and status.
-- An order marked paid is reported as such; this function does not verify a bank transfer.
CREATE OR REPLACE FUNCTION public.mkh_finance_dashboard_command_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
SELECT jsonb_build_object(
  'generatedAt', now(),
  'orderSummary', (
    SELECT jsonb_build_object(
      'total_orders', count(*)::integer,
      'total_order_value', COALESCE(sum(total), 0)::numeric,
      'paid_orders', count(*) FILTER (WHERE lower(COALESCE(payment_status, '')) = 'paid')::integer,
      'paid_order_value', COALESCE(sum(total) FILTER (WHERE lower(COALESCE(payment_status, '')) = 'paid'), 0)::numeric,
      'unpaid_cod_orders', count(*) FILTER (WHERE lower(COALESCE(payment_method, '')) = 'cash_on_delivery' AND lower(COALESCE(payment_status, '')) <> 'paid')::integer,
      'unpaid_cod_order_value', COALESCE(sum(total) FILTER (WHERE lower(COALESCE(payment_method, '')) = 'cash_on_delivery' AND lower(COALESCE(payment_status, '')) <> 'paid'), 0)::numeric,
      'unpaid_other_orders', count(*) FILTER (WHERE lower(COALESCE(payment_method, '')) <> 'cash_on_delivery' AND lower(COALESCE(payment_status, '')) <> 'paid')::integer,
      'unpaid_other_order_value', COALESCE(sum(total) FILTER (WHERE lower(COALESCE(payment_method, '')) <> 'cash_on_delivery' AND lower(COALESCE(payment_status, '')) <> 'paid'), 0)::numeric
    )
    FROM public.orders
  ),
  'orderPayments', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'payment_method', q.payment_method,
      'payment_status', q.payment_status,
      'order_count', q.order_count,
      'order_total', q.order_total
    ) ORDER BY q.payment_method, q.payment_status)
    FROM (
      SELECT
        COALESCE(NULLIF(lower(trim(payment_method)), ''), 'unknown') AS payment_method,
        COALESCE(NULLIF(lower(trim(payment_status)), ''), 'unknown') AS payment_status,
        count(*)::integer AS order_count,
        COALESCE(sum(total), 0)::numeric AS order_total
      FROM public.orders
      GROUP BY 1, 2
    ) q
  ), '[]'::jsonb),
  'dailyPaidOrders', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'day', d.day,
      'paid_order_count', d.paid_order_count,
      'paid_order_value', d.paid_order_value
    ) ORDER BY d.day)
    FROM (
      SELECT
        days.day::date AS day,
        count(o.id)::integer AS paid_order_count,
        COALESCE(sum(o.total), 0)::numeric AS paid_order_value
      FROM generate_series((current_date - 13)::timestamp, current_date::timestamp, interval '1 day') AS days(day)
      LEFT JOIN public.orders o
        ON o.created_at::date = days.day::date
       AND lower(COALESCE(o.payment_status, '')) = 'paid'
      GROUP BY days.day::date
    ) d
  ), '[]'::jsonb),
  'ledger', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'entry_type', q.entry_type,
      'status', q.status,
      'entry_count', q.entry_count,
      'amount_total', q.amount_total
    ) ORDER BY q.entry_type, q.status)
    FROM (
      SELECT
        COALESCE(NULLIF(lower(trim(entry_type)), ''), 'unknown') AS entry_type,
        COALESCE(NULLIF(lower(trim(status)), ''), 'unclassified') AS status,
        count(*)::integer AS entry_count,
        COALESCE(sum(amount), 0)::numeric AS amount_total
      FROM public.financial_ledger
      GROUP BY 1, 2
    ) q
  ), '[]'::jsonb),
  'wallets', jsonb_build_object(
    'vendor', (SELECT jsonb_build_object(
      'wallet_count', count(*)::integer,
      'available_balance', COALESCE(sum(available_balance), 0)::numeric,
      'pending_balance', COALESCE(sum(pending_balance), 0)::numeric,
      'accrued_balance', COALESCE(sum(accrued_balance), 0)::numeric,
      'lifetime_earnings', COALESCE(sum(lifetime_earnings), 0)::numeric
    ) FROM public.vendor_wallets),
    'rider', (SELECT jsonb_build_object(
      'wallet_count', count(*)::integer,
      'available_balance', COALESCE(sum(available_balance), 0)::numeric,
      'pending_balance', COALESCE(sum(pending_balance), 0)::numeric,
      'lifetime_earnings', COALESCE(sum(lifetime_earnings), 0)::numeric
    ) FROM public.rider_wallets),
    'customer', (SELECT jsonb_build_object(
      'wallet_count', count(*)::integer,
      'available_balance', COALESCE(sum(available_balance), 0)::numeric,
      'locked_balance', COALESCE(sum(locked_balance), 0)::numeric
    ) FROM public.customer_wallets)
  ),
  'payoutRequests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'requester_type', q.requester_type,
      'status', q.status,
      'request_count', q.request_count,
      'amount_total', q.amount_total
    ) ORDER BY q.requester_type, q.status)
    FROM (
      SELECT
        COALESCE(NULLIF(lower(trim(requester_type)), ''), 'unknown') AS requester_type,
        COALESCE(NULLIF(lower(trim(status)), ''), 'unknown') AS status,
        count(*)::integer AS request_count,
        COALESCE(sum(amount), 0)::numeric AS amount_total
      FROM public.payout_requests
      GROUP BY 1, 2
    ) q
  ), '[]'::jsonb)
);
$function$;

REVOKE ALL ON FUNCTION public.mkh_finance_dashboard_command_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_finance_dashboard_command_summary() TO service_role;

-- Create an empty rider wallet only when the active rider has no wallet row.
-- It never adds funds or alters an existing wallet balance.
CREATE OR REPLACE FUNCTION public.mkh_finance_activate_rider_wallet(p_rider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_role text;
  v_status text;
  v_wallet_count integer;
BEGIN
  IF p_rider_id IS NULL THEN
    RAISE EXCEPTION 'A rider profile ID is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('mkh-rider-wallet:' || p_rider_id::text, 0));

  SELECT lower(trim(COALESCE(role, ''))), lower(trim(COALESCE(status, '')))
    INTO v_role, v_status
    FROM public.profiles
   WHERE id = p_rider_id
   FOR UPDATE;

  IF NOT FOUND OR v_role <> 'rider' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'Only an active rider profile can have a rider wallet activated.';
  END IF;

  SELECT count(*)::integer INTO v_wallet_count
    FROM public.rider_wallets
   WHERE rider_id = p_rider_id;

  IF v_wallet_count > 1 THEN
    RAISE EXCEPTION 'Multiple rider wallet rows exist. Finance review is required; no wallet was changed.';
  ELSIF v_wallet_count = 1 THEN
    RETURN jsonb_build_object(
      'success', true,
      'created', false,
      'already_active', true,
      'rider_id', p_rider_id,
      'message', 'Rider wallet already exists. Existing balances were preserved.'
    );
  END IF;

  INSERT INTO public.rider_wallets (
    rider_id, available_balance, pending_balance, lifetime_earnings, updated_at
  ) VALUES (
    p_rider_id, 0, 0, 0, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'created', true,
    'already_active', false,
    'rider_id', p_rider_id,
    'available_balance', 0,
    'pending_balance', 0,
    'lifetime_earnings', 0,
    'message', 'An empty rider wallet was created. No funds were credited.'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_finance_activate_rider_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_finance_activate_rider_wallet(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
