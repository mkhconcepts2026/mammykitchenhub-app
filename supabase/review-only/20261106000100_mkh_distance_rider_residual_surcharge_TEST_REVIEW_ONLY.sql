/*
===============================================================================
MKH — DISTANCE RIDER PAYOUT + RESIDUAL SURCHARGE REVISION
TEST-ONLY REVIEW CANDIDATE v1.0 — NOT YET APPLIED
Prepared: 2026-11-06

NEW APPROVED PAYMENT MODEL
  Customer delivery fee = actual rider payout + NGN 700 fixed sharing + residual surcharge
  Residual surcharge = customer fee - actual rider payout - NGN 700

The fixed NGN 700 is the existing five-beneficiary base sharing:
  TRM 30 + ZM 50 + VHA 170 + MKH main 400 + SG Global Alliance 50.
The separate NGN 300 platform fee remains outside delivery-fee allocation.

PILOT: current TEST route cap remains 3 km. Standard model after rollout approval: max 10 km.
No rate-card values are changed by this migration; rate card already stores customer fee + rider payout.

PRESERVATION:
- Does not edit/backfill historical orders, wallets, ledger rows, or MKH-000110.
- Does not change process_order_settlement; it already credits orders.rider_amount once.
- Does not initiate external transfers.
- Keeps COD TEST-only and preserves its explicit cash-collected + OTP gates.
- Uses guarded function-definition replacements; any unexpected source drift aborts the transaction.
*/

BEGIN;

-- 0. Fail-closed environment and object preflight.
DO $mkh_distance_rider_preflight$
DECLARE
  v_missing text;
BEGIN
  IF to_regclass('public.delivery_quotes') IS NULL
     OR to_regclass('public.delivery_distance_rate_cards') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.order_delivery_fee_breakdowns') IS NULL
     OR to_regclass('public.order_delivery_allocation_controls') IS NULL
     OR to_regclass('public.order_delivery_allocation_ledger') IS NULL
     OR to_regclass('public.delivery_allocation_config_versions') IS NULL
     OR to_regclass('public.delivery_allocation_config_items') IS NULL
     OR to_regclass('public.delivery_beneficiary_payout_postings') IS NULL
     OR to_regclass('public.mkh_surcharge_commission_postings') IS NULL
     OR to_regclass('public.financial_ledger') IS NULL
     OR to_regclass('public.wallets') IS NULL THEN
    RAISE EXCEPTION 'MKH distance/rider revision stopped: a required existing TEST object is missing.';
  END IF;

  IF to_regprocedure('public.mkh_capture_order_delivery_fee_breakdown()') IS NULL
     OR to_regprocedure('public.mkh_prepare_order_delivery_allocations(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.mkh_post_delivery_beneficiary_payouts(uuid)') IS NULL
     OR to_regprocedure('public.mkh_post_order_distance_surcharge(uuid)') IS NULL
     OR to_regprocedure('public.mkh_trg_post_order_distance_surcharge()') IS NULL
     OR to_regprocedure('public.complete_my_delivery(uuid)') IS NULL
     OR to_regprocedure('public.mkh_complete_cod_delivery(uuid,boolean)') IS NULL
     OR to_regprocedure('public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)') IS NULL
     OR to_regprocedure('public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)') IS NULL
     OR to_regprocedure('public.process_order_settlement(uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'MKH distance/rider revision stopped: an expected function signature is missing.';
  END IF;

  SELECT string_agg(r.column_name, ', ')
    INTO v_missing
  FROM (VALUES
    ('delivery_quotes','customer_delivery_fee'),
    ('delivery_quotes','platform_fee'),
    ('delivery_quotes','route_distance_km'),
    ('delivery_quotes','rate_version'),
    ('delivery_distance_rate_cards','rider_payout'),
    ('orders','rider_amount'),
    ('orders','delivery_fee_base'),
    ('orders','delivery_distance_surcharge'),
    ('order_delivery_fee_breakdowns','rider_payout'),
    ('order_delivery_fee_breakdowns','distance_surcharge'),
    ('order_delivery_allocation_controls','actual_rider_payout'),
    ('order_delivery_allocation_controls','rider_distance_increment'),
    ('order_delivery_allocation_ledger','allocation_role'),
    ('order_delivery_allocation_ledger','allocation_status')
  ) AS r(table_name,column_name)
  LEFT JOIN information_schema.columns c
    ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
  WHERE c.column_name IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'MKH distance/rider revision stopped: existing schema is missing required columns: %', v_missing;
  END IF;

  -- The current active config must still be the approved six-role NGN 1,500 base.
  IF (SELECT count(*) FROM public.delivery_allocation_config_versions WHERE status='active') <> 1
     OR NOT EXISTS (
       SELECT 1
       FROM public.delivery_allocation_config_versions v
       JOIN public.delivery_allocation_config_items i ON i.config_version_id=v.id
       WHERE v.status='active'
       GROUP BY v.id, v.base_delivery_fee
       HAVING v.base_delivery_fee=1500
          AND count(*)=6
          AND sum(i.amount)=1500
          AND sum(i.amount) FILTER (WHERE i.allocation_role <> 'rider_base')=700
          AND max(i.amount) FILTER (WHERE i.allocation_role='rider_base')=800
     ) THEN
    RAISE EXCEPTION 'MKH distance/rider revision stopped: TEST must have one active config with Rider NGN 800 + five beneficiaries NGN 700 = NGN 1,500.';
  END IF;

  -- All ten approved customer-fee/rider-payout bands must already exist in the rate card.
  -- This block validates; it does not insert or revise any rate-card record.
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      (0.000::numeric,1.000::numeric,1500::numeric,800::numeric),
      (1.000::numeric,2.000::numeric,1700::numeric,900::numeric),
      (2.000::numeric,3.000::numeric,1900::numeric,1000::numeric),
      (3.000::numeric,4.000::numeric,2100::numeric,1200::numeric),
      (4.000::numeric,5.000::numeric,2300::numeric,1400::numeric),
      (5.000::numeric,6.000::numeric,2500::numeric,1600::numeric),
      (6.000::numeric,7.000::numeric,2700::numeric,1800::numeric),
      (7.000::numeric,8.000::numeric,2900::numeric,2000::numeric),
      (8.000::numeric,9.000::numeric,3100::numeric,2200::numeric),
      (9.000::numeric,10.000::numeric,3300::numeric,2400::numeric)
    ) AS e(min_km,max_km,customer_fee,rider_pay)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.delivery_distance_rate_cards r
      WHERE r.active IS TRUE
        AND r.effective_from <= now()
        AND (r.effective_to IS NULL OR r.effective_to > now())
        AND r.rate_version = (
          SELECT max(r2.rate_version)
          FROM public.delivery_distance_rate_cards r2
          WHERE r2.active IS TRUE
            AND r2.effective_from <= now()
            AND (r2.effective_to IS NULL OR r2.effective_to > now())
        )
        AND r.min_distance_km=e.min_km
        AND r.max_distance_km=e.max_km
        AND r.customer_delivery_fee=e.customer_fee
        AND r.rider_payout=e.rider_pay
    )
  ) THEN
    RAISE EXCEPTION 'MKH distance/rider revision stopped: the latest effective rate card does not contain the approved 0-10 km customer-fee and rider-payout schedule.';
  END IF;

  -- The core settlement must pay the captured orders.rider_amount once and calculate delivery revenue as fee less rider payout.
  IF position('v_rider_amount := COALESCE(v_order.rider_amount, 0)' IN
      pg_get_functiondef('public.process_order_settlement(uuid,text,uuid)'::regprocedure))=0
     OR position('v_delivery_amount := COALESCE(v_order.delivery_fee, 0)' IN
      pg_get_functiondef('public.process_order_settlement(uuid,text,uuid)'::regprocedure))=0
     OR position('- COALESCE(v_order.rider_amount, 0)' IN
      pg_get_functiondef('public.process_order_settlement(uuid,text,uuid)'::regprocedure))=0 THEN
    RAISE EXCEPTION 'MKH distance/rider revision stopped: core settlement no longer matches the reviewed orders.rider_amount flow.';
  END IF;
END;
$mkh_distance_rider_preflight$;

-- 1. Add quote-level and order fee-breakdown snapshots. Existing rows remain NULL and unchanged.
ALTER TABLE public.delivery_quotes
  ADD COLUMN IF NOT EXISTS rider_payout numeric(12,2),
  ADD COLUMN IF NOT EXISTS fixed_beneficiary_shares numeric(12,2),
  ADD COLUMN IF NOT EXISTS distance_surcharge numeric(12,2);

ALTER TABLE public.delivery_quotes
  DROP CONSTRAINT IF EXISTS delivery_quotes_rider_split_ck;
ALTER TABLE public.delivery_quotes
  ADD CONSTRAINT delivery_quotes_rider_split_ck
  CHECK (
    (rider_payout IS NULL OR rider_payout >= 800)
    AND (fixed_beneficiary_shares IS NULL OR fixed_beneficiary_shares = 700)
    AND (distance_surcharge IS NULL OR distance_surcharge >= 0)
    AND (
      rider_payout IS NULL OR fixed_beneficiary_shares IS NULL OR distance_surcharge IS NULL
      OR (
        customer_delivery_fee = rider_payout + fixed_beneficiary_shares + distance_surcharge
        AND distance_surcharge = GREATEST(customer_delivery_fee-rider_payout-fixed_beneficiary_shares,0)
      )
    )
  );

ALTER TABLE public.order_delivery_fee_breakdowns
  ADD COLUMN IF NOT EXISTS fixed_beneficiary_shares numeric(12,2);

ALTER TABLE public.order_delivery_fee_breakdowns
  DROP CONSTRAINT IF EXISTS order_delivery_breakdown_surcharge_ck;
ALTER TABLE public.order_delivery_fee_breakdowns
  DROP CONSTRAINT IF EXISTS order_delivery_breakdown_rider_split_ck;
ALTER TABLE public.order_delivery_fee_breakdowns
  ADD CONSTRAINT order_delivery_breakdown_rider_split_ck
  CHECK (
    (fixed_beneficiary_shares IS NULL OR fixed_beneficiary_shares=700)
    AND (fixed_beneficiary_shares IS NULL OR
      distance_surcharge = GREATEST(customer_delivery_fee-rider_payout-fixed_beneficiary_shares,0))
    AND (fixed_beneficiary_shares IS NULL OR
      customer_delivery_fee = rider_payout+fixed_beneficiary_shares+distance_surcharge)
  );

-- 2. New order fee snapshot: residual surcharge is calculated after rider + fixed NGN 700 sharing.
CREATE OR REPLACE FUNCTION public.mkh_capture_order_delivery_fee_breakdown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_base numeric(12,2) := 1500;
  v_fixed_shares numeric(12,2) := 700;
  v_delivery_fee numeric(12,2);
  v_platform_fee numeric(12,2);
  v_rider_payout numeric(12,2);
  v_surcharge numeric(12,2);
BEGIN
  v_delivery_fee := GREATEST(COALESCE(NEW.delivery_fee, 0), 0)::numeric(12,2);
  v_platform_fee := GREATEST(COALESCE(NEW.platform_fee, 0), 0)::numeric(12,2);
  v_rider_payout := GREATEST(COALESCE(NEW.rider_amount, 0), 0)::numeric(12,2);
  v_surcharge := GREATEST(v_delivery_fee-v_rider_payout-v_fixed_shares,0)::numeric(12,2);

  IF v_rider_payout < 800 OR v_delivery_fee <> v_rider_payout+v_fixed_shares+v_surcharge THEN
    RAISE EXCEPTION 'Order % does not reconcile to rider payout + NGN 700 fixed sharing + residual surcharge.', NEW.id;
  END IF;

  UPDATE public.orders
     SET delivery_fee_base = COALESCE(NEW.delivery_fee_base, v_base),
         delivery_distance_surcharge = v_surcharge
   WHERE id = NEW.id;

  INSERT INTO public.order_delivery_fee_breakdowns (
    order_id, route_distance_km, rate_version, base_delivery_fee,
    customer_delivery_fee, distance_surcharge, platform_fee, rider_payout,
    fixed_beneficiary_shares, source
  ) VALUES (
    NEW.id, NEW.delivery_route_distance_km, NEW.delivery_rate_version,
    COALESCE(NEW.delivery_fee_base, v_base), v_delivery_fee, v_surcharge,
    v_platform_fee, v_rider_payout, v_fixed_shares, 'order_insert_snapshot'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_capture_order_delivery_fee_breakdown() FROM PUBLIC, anon, authenticated;

-- 3. Carry trusted quote rider payout into COD and wallet orders. No browser-supplied payout is accepted.
DO $mkh_patch_quote_checkout_functions$
DECLARE
  v_sig text;
  v_def text;
  v_new text;
  v_old_calc text := $old$ v_distance_surcharge := greatest(
        v_quote.customer_delivery_fee - v_config.base_delivery_fee,
        0
    )::numeric(12,2);$old$;
  v_new_calc text := $new$ IF v_quote.route_distance_km > 3
       OR v_quote.rider_payout IS NULL
       OR v_quote.rider_payout < v_rider_base
       OR v_quote.fixed_beneficiary_shares IS DISTINCT FROM 700::numeric
       OR v_quote.distance_surcharge IS NULL
       OR v_quote.distance_surcharge < 0
       OR v_quote.distance_surcharge IS DISTINCT FROM
            GREATEST(v_quote.customer_delivery_fee-v_quote.rider_payout-v_quote.fixed_beneficiary_shares,0)::numeric(12,2)
       OR v_quote.customer_delivery_fee IS DISTINCT FROM
            (v_quote.rider_payout+v_quote.fixed_beneficiary_shares+v_quote.distance_surcharge) THEN
        RAISE EXCEPTION 'Quote does not contain the approved rider + fixed sharing + residual surcharge snapshot.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.delivery_distance_rate_cards r
        WHERE r.active IS TRUE
          AND r.rate_version=v_quote.rate_version
          AND r.effective_from <= now()
          AND (r.effective_to IS NULL OR r.effective_to > now())
          AND v_quote.route_distance_km <= r.max_distance_km
          AND (CASE WHEN r.min_distance_km=0 THEN v_quote.route_distance_km >= 0
                    ELSE v_quote.route_distance_km > r.min_distance_km END)
          AND r.customer_delivery_fee=v_quote.customer_delivery_fee
          AND r.rider_payout=v_quote.rider_payout
    ) THEN
        RAISE EXCEPTION 'Quote rider payout does not match the effective trusted distance rate card.';
    END IF;

    v_distance_surcharge := v_quote.distance_surcharge::numeric(12,2); $new$;
  v_order_value_anchor text := $anchor$        v_subtotal,
        v_rider_base,
        700,
        v_total::integer,$anchor$;
  v_order_value_replacement text := $replacement$        v_subtotal,
        v_quote.rider_payout,
        700,
        v_total::integer,$replacement$;
  v_count integer;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)',
    'public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'
  ] LOOP
    v_def := pg_get_functiondef(v_sig::regprocedure);
    v_count := (length(v_def)-length(replace(v_def,v_old_calc,''))) / length(v_old_calc);
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Quote checkout patch stopped: expected exactly one old surcharge formula in %, found %.', v_sig, v_count;
    END IF;
    v_new := replace(v_def,v_old_calc,v_new_calc);
    v_count := (length(v_new)-length(replace(v_new,v_order_value_anchor,''))) / length(v_order_value_anchor);
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Quote checkout patch stopped: expected exactly one order rider amount slot in %, found %.', v_sig, v_count;
    END IF;
    v_new := replace(v_new,v_order_value_anchor,v_order_value_replacement);
    EXECUTE v_new;
  END LOOP;
END;
$mkh_patch_quote_checkout_functions$;

-- 4. Allocation preparation: rider increment is funded by the additional customer delivery fee.
DO $mkh_patch_allocation_preparation$
DECLARE
  v_def text;
  v_new text;
  v_old_calc text := 'v_surcharge := GREATEST(v_delivery_fee - v_config.base_delivery_fee, 0)::numeric(12,2);';
  v_new_calc text := 'v_surcharge := GREATEST(v_delivery_fee - v_rider_payout - (v_config.base_delivery_fee - v_rider_base), 0)::numeric(12,2);';
  v_old_hold text := $old$WHEN v_surcharge > 0 OR v_rider_increment > 0
          THEN 'Distance surcharge / rider increment funding rule not yet approved'$old$;
  v_new_hold text := $new$WHEN v_surcharge > 0
          THEN 'Distance surcharge / rider increment funding rule not yet approved'$new$;
  v_old_increment_pattern text := $rx$IF v_rider_increment > 0 THEN\s+INSERT INTO public\.order_delivery_allocation_ledger\s+\(order_id, allocation_version, config_version_id, allocation_role,\s+beneficiary_id, beneficiary_label, amount, funding_bucket,\s+allocation_status, is_base_allocation, notes\)\s+VALUES\s+\(\s*p_order_id, v_config\.version_number, v_config\.id,\s+'rider_distance_increment_unfunded', v_order\.rider_id,\s+'Rider distance payout increment', v_rider_increment,\s+'rider_distance_increment', 'held', false,\s+'Funding source awaits approved business rule'\s*\);\s+END IF;$rx$;
  v_new_increment text := $new$IF v_rider_increment > 0 THEN
      INSERT INTO public.order_delivery_allocation_ledger
        (order_id, allocation_version, config_version_id, allocation_role,
         beneficiary_id, beneficiary_label, amount, funding_bucket,
         allocation_status, is_base_allocation, notes)
      VALUES (
        p_order_id, v_config.version_number, v_config.id,
        'rider_distance_increment_funded', v_order.rider_id,
        'Funded rider distance payout increment', v_rider_increment,
        'customer_delivery_fee', 'ready', false,
        'Included in orders.rider_amount and paid once by process_order_settlement; funded from customer delivery fee after the fixed NGN 700 sharing.'
      );
    END IF;$new$;
  v_count integer;
BEGIN
  v_def := pg_get_functiondef('public.mkh_prepare_order_delivery_allocations(uuid,uuid,uuid,uuid)'::regprocedure);

  v_count := (length(v_def)-length(replace(v_def,v_old_calc,''))) / length(v_old_calc);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Allocation preparation patch stopped: expected one old surcharge formula, found %.', v_count;
  END IF;
  v_new := replace(v_def,v_old_calc,v_new_calc);

  v_count := (length(v_new)-length(replace(v_new,v_old_hold,''))) / length(v_old_hold);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Allocation preparation patch stopped: expected one old increment hold condition, found %.', v_count;
  END IF;
  v_new := replace(v_new,v_old_hold,v_new_hold);

  SELECT count(*) INTO v_count FROM regexp_matches(v_new,v_old_increment_pattern,'gs');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Allocation preparation patch stopped: expected one unfunded rider-increment row block, found %.', v_count;
  END IF;
  v_new := regexp_replace(v_new,v_old_increment_pattern,v_new_increment,'gs');

  -- Require the configured rider payout never to fall below its NGN 800 base.
  IF position('v_rider_payout < v_rider_base' IN v_new)=0 THEN
    v_count := (length(v_new)-length(replace(v_new,
      'IF v_platform_fee < 0 OR v_rider_payout < 0 THEN',
      '')))
      / length('IF v_platform_fee < 0 OR v_rider_payout < 0 THEN');
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Allocation preparation patch stopped: could not add the minimum rider base guard.';
    END IF;
    v_new := replace(v_new,
      'IF v_platform_fee < 0 OR v_rider_payout < 0 THEN',
      'IF v_platform_fee < 0 OR v_rider_payout < v_rider_base THEN');
  END IF;
  EXECUTE v_new;
END;
$mkh_patch_allocation_preparation$;

-- 5. Beneficiary helper guard: preserve the five non-rider beneficiary rows totaling NGN 700.
DO $mkh_patch_beneficiary_guard$
DECLARE
  v_def text;
  v_new text;
  v_pattern text := $rx$IF v_control\.base_delivery_fee <> 1500\s+OR v_control\.customer_delivery_fee <>\s+\(v_control\.base_delivery_fee \+ v_control\.distance_surcharge\)\s+OR v_control\.distance_surcharge < 0\s+OR v_control\.rider_base_payout <> 800\s+OR v_control\.actual_rider_payout <> 800\s+OR v_control\.rider_distance_increment <> 0\s+OR v_order\.delivery_fee IS DISTINCT FROM v_control\.customer_delivery_fee\s+OR v_order\.delivery_fee_base IS DISTINCT FROM v_control\.base_delivery_fee\s+OR v_order\.delivery_distance_surcharge IS DISTINCT FROM v_control\.distance_surcharge\s+OR \(v_control\.distance_surcharge = 0 AND v_control\.settlement_hold_reason IS NOT NULL\) THEN\s+RAISE EXCEPTION\s+'Order % does not match the approved base allocation and captured surcharge, or has an unrelated settlement hold\.',\s+p_order_id;\s+END IF;$rx$;
  v_replacement text := $replacement$IF v_control.base_delivery_fee <> 1500
       OR v_control.rider_base_payout <> 800
       OR v_control.actual_rider_payout < v_control.rider_base_payout
       OR v_control.actual_rider_payout IS DISTINCT FROM v_order.rider_amount
       OR v_control.rider_distance_increment IS DISTINCT FROM
            (v_control.actual_rider_payout-v_control.rider_base_payout)
       OR v_control.customer_delivery_fee IS DISTINCT FROM
            (v_control.base_delivery_fee+v_control.rider_distance_increment+v_control.distance_surcharge)
       OR v_order.delivery_fee IS DISTINCT FROM v_control.customer_delivery_fee
       OR v_order.delivery_fee_base IS DISTINCT FROM v_control.base_delivery_fee
       OR v_order.delivery_distance_surcharge IS DISTINCT FROM v_control.distance_surcharge
       OR v_control.distance_surcharge < 0
       OR (v_control.distance_surcharge = 0 AND v_control.settlement_hold_reason IS NOT NULL) THEN
        RAISE EXCEPTION
            'Order % does not match the approved rider payout, fixed NGN 700 beneficiary allocation and residual surcharge snapshot.',
            p_order_id;
    END IF;$replacement$;
  v_count integer;
BEGIN
  v_def := pg_get_functiondef('public.mkh_post_delivery_beneficiary_payouts(uuid)'::regprocedure);
  SELECT count(*) INTO v_count FROM regexp_matches(v_def,v_pattern,'gs');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Beneficiary posting guard patch stopped: expected one known v5.2 guard block, found %.', v_count;
  END IF;
  v_new := regexp_replace(v_def,v_pattern,v_replacement,'gs');
  EXECUTE v_new;
END;
$mkh_patch_beneficiary_guard$;

-- 6. Standard and COD completion guards: allow only the captured, fully funded rider increment.
DO $mkh_patch_completion_guards$
DECLARE
  v_sig text;
  v_def text;
  v_new text;
  v_pattern text := $rx$IF COALESCE\(v_control\.rider_distance_increment, 0\) <> 0\s+OR COALESCE\(v_control\.actual_rider_payout, 0\) IS DISTINCT FROM\s+COALESCE\(v_control\.rider_base_payout, 0\)\s+OR COALESCE\(v_order\.delivery_fee, 0\) IS DISTINCT FROM\s+COALESCE\(v_control\.customer_delivery_fee, 0\)\s+OR COALESCE\(v_control\.customer_delivery_fee, 0\) IS DISTINCT FROM\s+\(COALESCE\(v_control\.base_delivery_fee, 0\) \+ COALESCE\(v_control\.distance_surcharge, 0\)\)\s+OR COALESCE\(v_control\.distance_surcharge, 0\) < 0\s+OR \(COALESCE\(v_control\.distance_surcharge, 0\) = 0\s+AND v_control\.settlement_hold_reason IS NOT NULL\)\s+OR \(COALESCE\(v_control\.distance_surcharge, 0\) > 0\s+AND v_control\.settlement_hold_reason IS DISTINCT FROM\s+'Distance surcharge / rider increment funding rule not yet approved'\) THEN\s+RAISE EXCEPTION\s+'Delivery settlement blocked: the captured surcharge, rider increment or settlement hold does not meet the approved surcharge-only settlement conditions\.';\s+END IF;$rx$;
  v_replacement text := $replacement$IF COALESCE(v_control.base_delivery_fee, 0) <> 1500
       OR COALESCE(v_control.rider_base_payout, 0) <> 800
       OR COALESCE(v_control.actual_rider_payout, 0) < COALESCE(v_control.rider_base_payout, 0)
       OR COALESCE(v_control.actual_rider_payout, 0) IS DISTINCT FROM COALESCE(v_order.rider_amount, 0)
       OR COALESCE(v_control.rider_distance_increment, 0) IS DISTINCT FROM
            (COALESCE(v_control.actual_rider_payout, 0)-COALESCE(v_control.rider_base_payout, 0))
       OR COALESCE(v_order.delivery_fee, 0) IS DISTINCT FROM COALESCE(v_control.customer_delivery_fee, 0)
       OR COALESCE(v_control.customer_delivery_fee, 0) IS DISTINCT FROM
            (COALESCE(v_control.base_delivery_fee, 0)+COALESCE(v_control.rider_distance_increment, 0)+COALESCE(v_control.distance_surcharge, 0))
       OR COALESCE(v_order.delivery_fee_base, 0) IS DISTINCT FROM COALESCE(v_control.base_delivery_fee, 0)
       OR COALESCE(v_order.delivery_distance_surcharge, 0) IS DISTINCT FROM COALESCE(v_control.distance_surcharge, 0)
       OR COALESCE(v_control.distance_surcharge, 0) < 0
       OR (COALESCE(v_control.distance_surcharge, 0) = 0 AND v_control.settlement_hold_reason IS NOT NULL)
       OR (COALESCE(v_control.distance_surcharge, 0) > 0 AND v_control.settlement_hold_reason IS DISTINCT FROM
            'Distance surcharge / rider increment funding rule not yet approved') THEN
        RAISE EXCEPTION
            'Delivery settlement blocked: rider payout, fixed NGN 700 sharing, residual surcharge or settlement hold does not match the captured quote.';
    END IF;$replacement$;
  v_count integer;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.complete_my_delivery(uuid)',
    'public.mkh_complete_cod_delivery(uuid,boolean)'
  ] LOOP
    v_def := pg_get_functiondef(v_sig::regprocedure);
    SELECT count(*) INTO v_count FROM regexp_matches(v_def,v_pattern,'gs');
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Completion guard patch stopped for %: expected one known guard, found %.', v_sig, v_count;
    END IF;
    v_new := regexp_replace(v_def,v_pattern,v_replacement,'gs');
    EXECUTE v_new;
  END LOOP;
END;
$mkh_patch_completion_guards$;

-- 7. Surcharge posting: permit the funded rider increment and verify the residual only.
DO $mkh_patch_surcharge_posting$
DECLARE
  v_def text;
  v_new text;
  v_old_increment text := $old$IF COALESCE(v_control.rider_distance_increment, 0) <> 0
     OR COALESCE(v_control.actual_rider_payout, 0)
          <> COALESCE(v_control.rider_base_payout, 0) THEN
    RAISE EXCEPTION
      'Distance surcharge settlement held: rider distance increment is non-zero. Approve its independent funding rule before settlement.';
  END IF;$old$;
  v_new_increment text := $new$IF COALESCE(v_control.actual_rider_payout, 0) < COALESCE(v_control.rider_base_payout, 0)
     OR COALESCE(v_control.actual_rider_payout, 0) IS DISTINCT FROM COALESCE(v_order.rider_amount, 0)
     OR COALESCE(v_control.rider_distance_increment, 0) IS DISTINCT FROM
          (COALESCE(v_control.actual_rider_payout, 0)-COALESCE(v_control.rider_base_payout, 0)) THEN
    RAISE EXCEPTION
      'Distance surcharge settlement stopped: rider payout/increment does not match the immutable order amount.';
  END IF;$new$;
  v_old_fee text := $old$IF v_order.delivery_fee IS DISTINCT FROM
       (v_control.base_delivery_fee + v_control.distance_surcharge)
     OR v_order.delivery_fee_base IS DISTINCT FROM v_control.base_delivery_fee
     OR v_order.delivery_distance_surcharge IS DISTINCT FROM v_control.distance_surcharge THEN$old$;
  v_new_fee text := $new$IF v_order.delivery_fee IS DISTINCT FROM
       (v_control.base_delivery_fee + v_control.rider_distance_increment + v_control.distance_surcharge)
     OR v_order.delivery_fee_base IS DISTINCT FROM v_control.base_delivery_fee
     OR v_order.delivery_distance_surcharge IS DISTINCT FROM v_control.distance_surcharge THEN$new$;
  v_old_snapshot text := $old$    AND b.rider_payout = v_order.rider_amount
    AND b.route_distance_km IS NOT DISTINCT FROM v_order.delivery_route_distance_km;$old$;
  v_new_snapshot text := $new$    AND b.rider_payout = v_order.rider_amount
    AND b.fixed_beneficiary_shares = 700
    AND b.distance_surcharge = v_control.distance_surcharge
    AND b.route_distance_km IS NOT DISTINCT FROM v_order.delivery_route_distance_km;$new$;
  v_count integer;
BEGIN
  v_def := pg_get_functiondef('public.mkh_post_order_distance_surcharge(uuid)'::regprocedure);

  v_count := (length(v_def)-length(replace(v_def,v_old_increment,''))) / length(v_old_increment);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Surcharge posting patch stopped: expected one old rider-increment block, found %.', v_count;
  END IF;
  v_new := replace(v_def,v_old_increment,v_new_increment);

  v_count := (length(v_new)-length(replace(v_new,v_old_fee,''))) / length(v_old_fee);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Surcharge posting patch stopped: expected one old order-fee equation, found %.', v_count;
  END IF;
  v_new := replace(v_new,v_old_fee,v_new_fee);

  v_count := (length(v_new)-length(replace(v_new,v_old_snapshot,''))) / length(v_old_snapshot);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Surcharge posting patch stopped: expected one fee-snapshot validation block, found %.', v_count;
  END IF;
  v_new := replace(v_new,v_old_snapshot,v_new_snapshot);

  -- Confirm the five non-rider beneficiary shares still total the fixed NGN 700.
  IF position('v_expected_base_total <> (v_control.base_delivery_fee-v_control.rider_base_payout)' IN v_new)=0 THEN
    v_count := (length(v_new)-length(replace(v_new,'  IF v_config_role_count <> 5 THEN',''))) /
               length('  IF v_config_role_count <> 5 THEN');
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Surcharge posting patch stopped: expected one five-role configuration guard, found %.', v_count;
    END IF;
    v_new := replace(v_new,
      '  IF v_config_role_count <> 5 THEN',
      '  IF v_config_role_count <> 5 OR v_expected_base_total <> (v_control.base_delivery_fee-v_control.rider_base_payout) THEN');
  END IF;
  IF position('fixed_beneficiary_shares = 700' IN v_new)=0 THEN
    RAISE EXCEPTION 'Surcharge posting patch stopped: fixed beneficiary share snapshot guard was not inserted.';
  END IF;

  EXECUTE v_new;
END;
$mkh_patch_surcharge_posting$;

-- 8. Deferred settlement trigger also closes the funded rider-increment allocation snapshot.
CREATE OR REPLACE FUNCTION public.mkh_trg_post_order_distance_surcharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_increment numeric(12,2);
  v_rows integer;
BEGIN
  IF NEW.entry_type IS DISTINCT FROM 'rider_earning'
     OR NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(rider_distance_increment,0)
    INTO v_increment
  FROM public.order_delivery_allocation_controls
  WHERE order_id=NEW.order_id
  FOR UPDATE;

  IF COALESCE(v_increment,0) > 0 THEN
    UPDATE public.order_delivery_allocation_ledger
       SET allocation_status='posted',
           posted_at=clock_timestamp()
     WHERE order_id=NEW.order_id
       AND allocation_role='rider_distance_increment_funded'
       AND funding_bucket='customer_delivery_fee'
       AND is_base_allocation IS FALSE
       AND amount=v_increment
       AND allocation_status='ready';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Funded rider distance increment snapshot did not reconcile for order %. Settlement rolled back.', NEW.order_id;
    END IF;
  END IF;

  PERFORM public.mkh_post_order_distance_surcharge(NEW.order_id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_trg_post_order_distance_surcharge()
  FROM PUBLIC, anon, authenticated, service_role;

-- 9. Verify the new functions and captured model inside the same transaction before commit.
DO $mkh_distance_rider_postflight$
DECLARE
  v_text text;
BEGIN
  v_text := pg_get_functiondef('public.process_order_settlement(uuid,text,uuid)'::regprocedure);
  IF position('v_rider_amount := COALESCE(v_order.rider_amount, 0)' IN v_text)=0 THEN
    RAISE EXCEPTION 'Core rider settlement no longer consumes the captured rider_amount.';
  END IF;

  v_text := pg_get_functiondef('public.mkh_post_order_distance_surcharge(uuid)'::regprocedure);
  IF position('v_control.rider_distance_increment' IN v_text)=0
     OR position('fixed_beneficiary_shares = 700' IN v_text)=0
     OR position('v_expected_base_total <> (v_control.base_delivery_fee-v_control.rider_base_payout)' IN v_text)=0 THEN
    RAISE EXCEPTION 'Surcharge posting function did not receive all revised rider/fixed-sharing guards.';
  END IF;

  v_text := pg_get_functiondef('public.mkh_prepare_order_delivery_allocations(uuid,uuid,uuid,uuid)'::regprocedure);
  IF position('v_delivery_fee - v_rider_payout - (v_config.base_delivery_fee - v_rider_base)' IN v_text)=0
     OR position('rider_distance_increment_funded' IN v_text)=0
     OR position('WHEN v_surcharge > 0 OR v_rider_increment > 0' IN v_text)>0 THEN
    RAISE EXCEPTION 'Allocation preparation did not adopt the funded rider-increment and residual surcharge formula.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.delivery_quotes'::regclass
      AND conname='delivery_quotes_rider_split_ck'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.order_delivery_fee_breakdowns'::regclass
      AND conname='order_delivery_breakdown_rider_split_ck'
  ) THEN
    RAISE EXCEPTION 'Quote or order fee-snapshot split constraints are missing.';
  END IF;
END;
$mkh_distance_rider_postflight$;

COMMIT;

-- 10. One-row read-only post-install verification.
-- Supabase SQL Editor may display only the final result grid; this SELECT intentionally returns one row.
WITH effective_rate_version AS (
  SELECT max(rate_version) AS version
  FROM public.delivery_distance_rate_cards
  WHERE active IS TRUE
    AND effective_from <= now()
    AND (effective_to IS NULL OR effective_to > now())
), rate_card_snapshot AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'distance_band_km', r.min_distance_km::text || '-' || r.max_distance_km::text,
      'customer_delivery_fee', r.customer_delivery_fee,
      'rider_payout', r.rider_payout,
      'rate_version', r.rate_version
    ) ORDER BY r.min_distance_km
  ) AS schedule,
  count(*) AS band_count
  FROM public.delivery_distance_rate_cards r
  JOIN effective_rate_version v ON v.version = r.rate_version
  WHERE r.active IS TRUE
    AND r.effective_from <= now()
    AND (r.effective_to IS NULL OR r.effective_to > now())
)
SELECT
  to_regclass('public.delivery_quotes') IS NOT NULL AS delivery_quotes_exists,
  (SELECT count(*)=3 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='delivery_quotes'
      AND column_name IN ('rider_payout','fixed_beneficiary_shares','distance_surcharge')) AS quote_split_columns_exist,
  (SELECT count(*)=1 FROM pg_constraint
    WHERE conrelid='public.delivery_quotes'::regclass
      AND conname='delivery_quotes_rider_split_ck') AS quote_split_constraint_exists,
  (SELECT count(*)=1 FROM pg_constraint
    WHERE conrelid='public.order_delivery_fee_breakdowns'::regclass
      AND conname='order_delivery_breakdown_rider_split_ck') AS order_snapshot_split_constraint_exists,
  position('v_quote.rider_payout' IN pg_get_functiondef(
    'public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure
  )) > 0 AS cod_checkout_uses_quote_rider_payout,
  position('v_quote.rider_payout' IN pg_get_functiondef(
    'public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure
  )) > 0 AS wallet_checkout_uses_quote_rider_payout,
  position('v_quote.route_distance_km > 3' IN pg_get_functiondef(
    'public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure
  )) > 0 AS cod_checkout_enforces_3km_test_cap,
  position('v_quote.route_distance_km > 3' IN pg_get_functiondef(
    'public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure
  )) > 0 AS wallet_checkout_enforces_3km_test_cap,
  position('rider_distance_increment_funded' IN pg_get_functiondef(
    'public.mkh_prepare_order_delivery_allocations(uuid,uuid,uuid,uuid)'::regprocedure
  )) > 0 AS funded_rider_increment_snapshot_enabled,
  position('rider_distance_increment_funded' IN pg_get_functiondef(
    'public.mkh_trg_post_order_distance_surcharge()'::regprocedure
  )) > 0 AS deferred_rider_increment_posting_guard,
  position('fixed_beneficiary_shares = 700' IN pg_get_functiondef(
    'public.mkh_post_order_distance_surcharge(uuid)'::regprocedure
  )) > 0 AS surcharge_fixed_share_guard_enabled,
  position('v_rider_amount := COALESCE(v_order.rider_amount, 0)' IN pg_get_functiondef(
    'public.process_order_settlement(uuid,text,uuid)'::regprocedure
  )) > 0 AS core_settlement_credits_captured_rider_amount,
  position('- COALESCE(v_order.rider_amount, 0)' IN pg_get_functiondef(
    'public.process_order_settlement(uuid,text,uuid)'::regprocedure
  )) > 0 AS delivery_revenue_excludes_rider_payout,
  (SELECT band_count=10 FROM rate_card_snapshot) AS full_0_to_10km_rate_card_present,
  (SELECT schedule FROM rate_card_snapshot) AS unchanged_active_rate_card;
