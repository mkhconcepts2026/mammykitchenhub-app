-- REVIEW ONLY: idempotent correction to the supplied Version 5 migration.
-- Reuses the existing verified surcharge registry/wallet, postings table, and deferred trigger.
-- Exact source-block replacement and schema/trigger checks fail closed on drift.
-- This file has NOT been applied to any database. TEST only after review.

/*
===============================================================================
MKH — DISTANCE SURCHARGE COMMISSION WALLET
TEST-ONLY MIGRATION — REVIEW CANDIDATE (NOT YET DATABASE-VALIDATED)
Version: 5 idempotent installed-object correction — preserves existing surcharge registry, wallet, subledger, and deferred trigger
Prepared: 2026-11-04

RUN INSTRUCTIONS:
  1. Open the MKH Supabase TEST project and confirm the project reference before
     opening SQL Editor. Do NOT run in Production.
  2. This corrected copy has undergone source-level checks only; TEST only. Verify the project reference before execution.
  3. If run after review, execute the entire script once as one transaction.
  4. If any preflight, function-patch, constraint, or posting validation fails,
     the transaction should abort and roll back transactional changes.
  5. Do not separately run individual sections or remove safety checks.

The script validates and reuses the already-installed surcharge registry, wallet, subledger, and deferred trigger,
then makes the smallest required changes to the existing beneficiary-posting,
delivery-finalization and COD-finalization function guards so positive surcharge
orders can reach the deferred posting trigger. The existing process_order_settlement
function and its vendor/rider/platform/delivery calculations are preserved.

APPROVED BUSINESS RULE PRESERVED:
  100% of each order's distance surcharge goes to the dedicated
  MKH_Surcharge_commission internal wallet. It is separate from the six-role
  NGN 1,500 base allocation. It is not shared with the rider, TRM, ZM, VHA,
  SG Global Alliance, MKH Pool, or MKH Commission Pool 2.

IMPLEMENTATION BOUNDARY:
  - Reuses the existing internal MKH organizational registry/wallet mapping; creates it only if genuinely absent.
  - Adds a dedicated idempotent surcharge-posting subledger.
  - Uses a deferred constraint trigger on completed rider_earning inserts.
  - Posts only after the existing order settlement inserts its financial rows;
    the deferred trigger runs at transaction end, so a posting failure rolls
    back that settlement transaction.
  - Links the surcharge posting to the existing delivery_revenue ledger row.
    It does NOT add another financial_revenue row or double-count revenue.
  - Does not change process_order_settlement, base allocation config, COD flow,
    vendor commission, existing SG/MKH pools, existing orders, historical
    postings, Paystack, or bank-transfer logic.
  - Does not backfill any old order.

FAIL-CLOSED RULE:
  If rider_distance_increment is non-zero, the settlement is blocked for an
  order with a distance surcharge. The rider-increment funding rule remains
  unresolved, and releasing both a full surcharge credit and an extra rider
  increment could over-allocate the delivery revenue. This migration does not
  invent a funding source. MKH-000110 currently has a zero rider increment in
  its captured allocation control, so it is a candidate after the normal base
  beneficiary postings are ready and its COD test cycle is completed/paid.
===============================================================================
*/

BEGIN;


-- 0. Fail-closed schema preflight. Existing surcharge objects are validated and reused.
DO $mkh_surcharge_preflight$
DECLARE
  v_missing text;
  v_wallet_owner_check text;
  v_beneficiary_type_check text;
  v_surcharge_status_check text;
  v_allocation_status_check text;
  v_financial_id_type text;
BEGIN
  IF to_regclass('public.orders') IS NULL
     OR to_regclass('public.order_delivery_fee_breakdowns') IS NULL
     OR to_regclass('public.order_delivery_allocation_controls') IS NULL
     OR to_regclass('public.order_delivery_allocation_ledger') IS NULL
     OR to_regclass('public.delivery_allocation_config_items') IS NULL
     OR to_regclass('public.delivery_beneficiary_registry') IS NULL
     OR to_regclass('public.delivery_beneficiary_payout_postings') IS NULL
     OR to_regclass('public.wallets') IS NULL
     OR to_regclass('public.financial_ledger') IS NULL THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: one or more required MKH tables are missing.';
  END IF;

  IF to_regprocedure('public.mkh_post_delivery_beneficiary_payouts(uuid)') IS NULL
     OR to_regprocedure('public.complete_my_delivery(uuid)') IS NULL
     OR to_regprocedure('public.mkh_complete_cod_delivery(uuid,boolean)') IS NULL
     OR to_regprocedure('public.process_order_settlement(uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: one or more installed MKH settlement functions are missing or have unexpected signatures.';
  END IF;

  SELECT string_agg(format('%s.%s', required.table_name, required.column_name), ', ')
    INTO v_missing
  FROM (VALUES
    ('orders','id'),
    ('orders','status'),
    ('orders','payment_status'),
    ('orders','delivery_fee'),
    ('orders','delivery_fee_base'),
    ('orders','delivery_distance_surcharge'),
    ('orders','delivery_route_distance_km'),
    ('orders','rider_amount'),
    ('orders','platform_fee'),
    ('order_delivery_fee_breakdowns','order_id'),
    ('order_delivery_fee_breakdowns','base_delivery_fee'),
    ('order_delivery_fee_breakdowns','customer_delivery_fee'),
    ('order_delivery_fee_breakdowns','distance_surcharge'),
    ('order_delivery_fee_breakdowns','platform_fee'),
    ('order_delivery_fee_breakdowns','rider_payout'),
    ('order_delivery_fee_breakdowns','route_distance_km'),
    ('order_delivery_allocation_controls','order_id'),
    ('order_delivery_allocation_controls','config_version_id'),
    ('order_delivery_allocation_controls','allocation_version'),
    ('order_delivery_allocation_controls','base_delivery_fee'),
    ('order_delivery_allocation_controls','distance_surcharge'),
    ('order_delivery_allocation_controls','rider_base_payout'),
    ('order_delivery_allocation_controls','actual_rider_payout'),
    ('order_delivery_allocation_controls','rider_distance_increment'),
    ('order_delivery_allocation_controls','base_allocation_status'),
    ('order_delivery_allocation_controls','surcharge_allocation_status'),
    ('order_delivery_allocation_controls','updated_at'),
    ('order_delivery_allocation_ledger','id'),
    ('order_delivery_allocation_ledger','order_id'),
    ('order_delivery_allocation_ledger','config_version_id'),
    ('order_delivery_allocation_ledger','allocation_version'),
    ('order_delivery_allocation_ledger','allocation_role'),
    ('order_delivery_allocation_ledger','amount'),
    ('order_delivery_allocation_ledger','funding_bucket'),
    ('order_delivery_allocation_ledger','allocation_status'),
    ('order_delivery_allocation_ledger','is_base_allocation'),
    ('order_delivery_allocation_ledger','posted_at'),
    ('delivery_allocation_config_items','config_version_id'),
    ('delivery_allocation_config_items','allocation_role'),
    ('delivery_allocation_config_items','amount'),
    ('delivery_beneficiary_registry','id'),
    ('delivery_beneficiary_registry','beneficiary_code'),
    ('delivery_beneficiary_registry','beneficiary_type'),
    ('delivery_beneficiary_registry','display_name'),
    ('delivery_beneficiary_registry','profile_id'),
    ('delivery_beneficiary_registry','wallet_id'),
    ('delivery_beneficiary_registry','is_active'),
    ('delivery_beneficiary_registry','verified_at'),
    ('delivery_beneficiary_registry','external_account_reference'),
    ('wallets','id'),
    ('wallets','owner_id'),
    ('wallets','owner_type'),
    ('wallets','available_balance'),
    ('wallets','pending_balance'),
    ('wallets','locked_balance'),
    ('wallets','settled_balance'),
    ('wallets','lifetime_earnings'),
    ('delivery_beneficiary_payout_postings','order_id'),
    ('delivery_beneficiary_payout_postings','allocation_ledger_id'),
    ('delivery_beneficiary_payout_postings','wallet_id'),
    ('delivery_beneficiary_payout_postings','amount'),
    ('delivery_beneficiary_payout_postings','status'),
    ('financial_ledger','id'),
    ('financial_ledger','order_id'),
    ('financial_ledger','entry_type'),
    ('financial_ledger','amount'),
    ('financial_ledger','status')
  ) AS required(table_name, column_name)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = required.table_name
   AND c.column_name = required.column_name
  WHERE c.column_name IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Surcharge migration stopped: missing required columns: %', v_missing;
  END IF;

  SELECT c.data_type
    INTO v_financial_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'financial_ledger'
    AND c.column_name = 'id';

  IF v_financial_id_type <> 'uuid' THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: financial_ledger.id is %, expected uuid.',
      v_financial_id_type;
  END IF;

  SELECT pg_get_constraintdef(c.oid)
    INTO v_wallet_owner_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.wallets'::regclass
    AND c.conname = 'wallets_owner_type_check'
    AND c.contype = 'c';

  IF v_wallet_owner_check IS NULL OR position('mkh' IN lower(v_wallet_owner_check)) = 0 THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: wallets_owner_type_check does not demonstrably allow owner_type = mkh.';
  END IF;

  SELECT string_agg(pg_get_constraintdef(c.oid), ' ')
    INTO v_beneficiary_type_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.delivery_beneficiary_registry'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%beneficiary_type%';

  IF v_beneficiary_type_check IS NULL
     OR position('mkh_pool' IN lower(v_beneficiary_type_check)) = 0 THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: registry beneficiary_type constraints do not demonstrably allow mkh_pool.';
  END IF;

  SELECT string_agg(pg_get_constraintdef(c.oid), ' ')
    INTO v_surcharge_status_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.order_delivery_allocation_controls'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%surcharge_allocation_status%';

  IF v_surcharge_status_check IS NULL
     OR position('posted' IN lower(v_surcharge_status_check)) = 0 THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: surcharge_allocation_status does not demonstrably allow posted.';
  END IF;

  SELECT string_agg(pg_get_constraintdef(c.oid), ' ')
    INTO v_allocation_status_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.order_delivery_allocation_ledger'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%allocation_status%';

  IF v_allocation_status_check IS NULL
     OR position('posted' IN lower(v_allocation_status_check)) = 0 THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: allocation_status does not demonstrably allow posted.';
  END IF;

  -- Existing surcharge objects are expected. Validate them instead of treating
  -- their presence as an error or attempting to create duplicate objects.
  IF to_regclass('public.mkh_surcharge_commission_postings') IS NOT NULL THEN
    SELECT string_agg(required.column_name, ', ')
      INTO v_missing
    FROM (VALUES
      ('id'), ('order_id'), ('allocation_ledger_id'),
      ('delivery_revenue_ledger_id'), ('beneficiary_registry_id'),
      ('wallet_id'), ('amount'), ('currency'), ('status'),
      ('idempotency_key'), ('created_at'), ('posted_at'),
      ('reversed_at'), ('metadata')
    ) AS required(column_name)
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = 'mkh_surcharge_commission_postings'
     AND c.column_name = required.column_name
    WHERE c.column_name IS NULL;
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'Existing surcharge postings table is missing required columns: %', v_missing;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.financial_ledger'::regclass
      AND t.tgname = 'trg_mkh_post_order_distance_surcharge_deferred'
      AND NOT t.tgisinternal
      AND (NOT t.tgdeferrable OR NOT t.tginitdeferred
        OR position('mkh_trg_post_order_distance_surcharge' IN pg_get_triggerdef(t.oid)) = 0
        OR position('AFTER INSERT ON public.financial_ledger' IN pg_get_triggerdef(t.oid)) = 0)
  ) THEN
    RAISE EXCEPTION 'Existing surcharge deferred trigger does not match the expected deferred financial_ledger insert trigger.';
  END IF;

  -- The installed MKH design keeps the core allocation-clearance guard in
  -- process_order_settlement, while the rider-distance-increment guard lives
  -- in complete_my_delivery and mkh_complete_cod_delivery. Do not require the
  -- increment column to appear inside the core settlement function.
  IF position('surcharge_allocation_status' IN lower(pg_get_functiondef(
       'public.process_order_settlement(uuid,text,uuid)'::regprocedure
     ))) = 0
     OR position('base_allocation_status' IN lower(pg_get_functiondef(
       'public.process_order_settlement(uuid,text,uuid)'::regprocedure
     ))) = 0
     OR position('allocation_status not in' IN lower(pg_get_functiondef(
       'public.process_order_settlement(uuid,text,uuid)'::regprocedure
     ))) = 0
     OR position('payment_status' IN lower(pg_get_functiondef(
       'public.process_order_settlement(uuid,text,uuid)'::regprocedure
     ))) = 0 THEN
    RAISE EXCEPTION
      'Surcharge migration stopped: the installed core settlement function is missing its payment/allocation-clearance guards.';
  END IF;
END;
$mkh_surcharge_preflight$;

-- 0A. Adapt the existing MKH settlement pipeline without replacing its core
-- financial math. Each function definition is inspected and patched only when
-- the exact known guard exists once. Any drift aborts the transaction.
DO $mkh_patch_existing_settlement_functions$
DECLARE
  v_def text;
  v_new text;
  v_matches integer;
  v_fee_pattern text := $rx$IF v_control\.base_delivery_fee <> 1500\s+OR v_control\.customer_delivery_fee <>\s+\(v_control\.base_delivery_fee \+ v_control\.distance_surcharge\)\s+OR v_control\.distance_surcharge < 0\s+OR v_control\.rider_base_payout <> 800\s+OR v_control\.actual_rider_payout <> 800\s+OR v_control\.rider_distance_increment <> 0\s+OR v_order\.delivery_fee IS DISTINCT FROM v_control\.customer_delivery_fee\s+OR v_order\.delivery_fee_base IS DISTINCT FROM v_control\.base_delivery_fee\s+OR v_order\.delivery_distance_surcharge IS DISTINCT FROM v_control\.distance_surcharge\s+OR \(v_control\.distance_surcharge = 0 AND v_control\.settlement_hold_reason IS NOT NULL\)\s+OR \(v_control\.distance_surcharge > 0 AND v_control\.settlement_hold_reason IS DISTINCT FROM\s+'Distance surcharge / rider increment funding rule not yet approved'\) THEN\s+RAISE EXCEPTION\s+'Order % does not match the approved base allocation and captured surcharge, or has an unrelated settlement hold\.',\s+p_order_id;\s+END IF;$rx$;
  v_fee_replacement text := $replacement$IF v_control.base_delivery_fee <> 1500
       OR v_control.customer_delivery_fee <>
            (v_control.base_delivery_fee + v_control.distance_surcharge)
       OR v_control.distance_surcharge < 0
       OR v_control.rider_base_payout <> 800
       OR v_control.actual_rider_payout <> 800
       OR v_control.rider_distance_increment <> 0
       OR v_order.delivery_fee IS DISTINCT FROM v_control.customer_delivery_fee
       OR v_order.delivery_fee_base IS DISTINCT FROM v_control.base_delivery_fee
       OR v_order.delivery_distance_surcharge IS DISTINCT FROM v_control.distance_surcharge
       OR (v_control.distance_surcharge = 0 AND v_control.settlement_hold_reason IS NOT NULL)
       OR (v_control.distance_surcharge > 0 AND v_control.settlement_hold_reason IS DISTINCT FROM
              'Distance surcharge / rider increment funding rule not yet approved') THEN
        RAISE EXCEPTION
            'Order % does not match the approved base allocation and captured surcharge, or has an unrelated settlement hold.',
            p_order_id;
    END IF;$replacement$;
  v_completion_guard_pattern text := $rx$IF COALESCE\(v_control\.distance_surcharge, 0\) <> 0\s+OR COALESCE\(v_control\.rider_distance_increment, 0\) <> 0\s+OR v_control\.settlement_hold_reason IS NOT NULL THEN\s+RAISE EXCEPTION[^;]*;\s+END IF;$rx$;
  v_completion_guard_anchor text := $guard$    IF COALESCE(v_control.distance_surcharge, 0) <> 0
       OR COALESCE(v_control.rider_distance_increment, 0) <> 0
       OR v_control.settlement_hold_reason IS NOT NULL THEN
        RAISE EXCEPTION 'Delivery settlement blocked by unresolved surcharge, rider increment, or settlement hold.';
    END IF;$guard$;
  v_completion_guard_replacement text := $replacement$IF COALESCE(v_control.rider_distance_increment, 0) <> 0
       OR COALESCE(v_control.actual_rider_payout, 0) IS DISTINCT FROM
            COALESCE(v_control.rider_base_payout, 0)
       OR COALESCE(v_order.delivery_fee, 0) IS DISTINCT FROM
            COALESCE(v_control.customer_delivery_fee, 0)
       OR COALESCE(v_control.customer_delivery_fee, 0) IS DISTINCT FROM
            (COALESCE(v_control.base_delivery_fee, 0) + COALESCE(v_control.distance_surcharge, 0))
       OR COALESCE(v_control.distance_surcharge, 0) < 0
       OR (COALESCE(v_control.distance_surcharge, 0) = 0
           AND v_control.settlement_hold_reason IS NOT NULL)
       OR (COALESCE(v_control.distance_surcharge, 0) > 0
           AND v_control.settlement_hold_reason IS DISTINCT FROM
                'Distance surcharge / rider increment funding rule not yet approved') THEN
        RAISE EXCEPTION
            'Delivery settlement blocked: the captured surcharge, rider increment or settlement hold does not meet the approved surcharge-only settlement conditions.';
    END IF;$replacement$;
  v_finalizer_block text := $finalizer$    v_posting_result := public.mkh_post_delivery_beneficiary_payouts(p_order_id);
    IF COALESCE((v_posting_result ->> 'success')::boolean, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'Beneficiary payout posting did not complete successfully.';
    END IF;$finalizer$;
  v_finalizer_replacement text := $finalizer_replacement$    -- Temporarily approve the captured surcharge control before calling the
    -- existing beneficiary-posting helper. Its original hold reason remains in
    -- place during that helper call because the helper validates this exact
    -- captured state. PostgreSQL rolls this approval back if any later step fails.
    IF COALESCE(v_control.distance_surcharge, 0) > 0 THEN
        UPDATE public.order_delivery_allocation_controls
           SET surcharge_allocation_status = 'approved',
               updated_at = pg_catalog.now()
         WHERE order_id = p_order_id
           AND surcharge_allocation_status = 'unallocated'
           AND distance_surcharge = v_control.distance_surcharge
           AND settlement_hold_reason =
               'Distance surcharge / rider increment funding rule not yet approved';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The captured surcharge control could not be transactionally approved.';
        END IF;
    END IF;

    v_posting_result := public.mkh_post_delivery_beneficiary_payouts(p_order_id);
    IF COALESCE((v_posting_result ->> 'success')::boolean, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'Beneficiary payout posting did not complete successfully.';
    END IF;

    -- Promote only the original held surcharge snapshot row inside this same
    -- transaction so the unchanged core settlement guard can pass. The deferred
    -- surcharge trigger changes it to posted only after all canonical financial
    -- ledger entries have been written. Any later failure rolls this back.
    IF COALESCE(v_control.distance_surcharge, 0) > 0 THEN
        UPDATE public.order_delivery_allocation_ledger
           SET allocation_status = 'ready'
         WHERE order_id = p_order_id
           AND allocation_version = v_control.allocation_version
           AND config_version_id IS NOT DISTINCT FROM v_control.config_version_id
           AND allocation_role = 'distance_surcharge_unallocated'
           AND funding_bucket = 'distance_surcharge'
           AND is_base_allocation IS FALSE
           AND allocation_status = 'held'
           AND amount = v_control.distance_surcharge;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The captured distance surcharge row is not uniquely ready for this settlement.';
        END IF;

        UPDATE public.order_delivery_allocation_controls
           SET settlement_hold_reason = NULL,
               updated_at = pg_catalog.now()
         WHERE order_id = p_order_id
           AND surcharge_allocation_status = 'approved'
           AND distance_surcharge = v_control.distance_surcharge
           AND settlement_hold_reason =
               'Distance surcharge / rider increment funding rule not yet approved';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The captured surcharge control hold could not be cleared transactionally.';
        END IF;
    END IF;$finalizer_replacement$;
BEGIN
  -- Beneficiary posting helper: permit a positive surcharge as a separate
  -- sub-allocation, but keep the rider increment at zero and all six base rows
  -- exactly as approved.
  v_def := pg_get_functiondef('public.mkh_post_delivery_beneficiary_payouts(uuid)'::regprocedure);
  SELECT count(*) INTO v_matches FROM regexp_matches(v_def, v_fee_pattern, 'gs');
  IF v_matches <> 1 THEN
    RAISE EXCEPTION 'Expected one known base/surcharge guard in mkh_post_delivery_beneficiary_payouts; found %.', v_matches;
  END IF;
  v_new := regexp_replace(v_def, v_fee_pattern, v_fee_replacement, 'gs');

  -- Preserve the installed allocation-status guard byte-for-byte. The finalizer
  -- now sets surcharge_allocation_status='approved' inside the same transaction
  -- immediately before it calls this helper, so the existing guard passes without
  -- being replaced or weakened.
  EXECUTE v_new;

  -- Both standard delivery completion and COD cash confirmation share the
  -- same surcharge gate. Keep authentication, OTP, cash-confirmation and order
  -- ownership checks intact; permit only the known surcharge hold with zero
  -- rider increment and exact quote/control fee agreement.
  v_def := pg_get_functiondef('public.complete_my_delivery(uuid)'::regprocedure);
  -- Patch the standard delivery guard using the exact installed source block
  -- supplied for this function. No regex is used on this function body.
  v_matches := (length(v_def) - length(replace(v_def, v_completion_guard_anchor, ''))) / length(v_completion_guard_anchor);
  IF v_matches <> 1 THEN
    RAISE EXCEPTION 'Expected one exact surcharge guard block in complete_my_delivery; found %.', v_matches;
  END IF;
  v_new := replace(v_def, v_completion_guard_anchor, v_completion_guard_replacement);

  -- Replace the entire known beneficiary-posting block in one operation. This
  -- avoids any intermediate regex match that could consume or alter the call.
  v_matches := (length(v_new) - length(replace(v_new, v_finalizer_block, ''))) / length(v_finalizer_block);
  IF v_matches <> 1 THEN
    RAISE EXCEPTION 'Expected one exact beneficiary posting block in complete_my_delivery; found %.', v_matches;
  END IF;
  v_new := replace(v_new, v_finalizer_block, v_finalizer_replacement);
  EXECUTE v_new;

  v_def := pg_get_functiondef('public.mkh_complete_cod_delivery(uuid,boolean)'::regprocedure);
  SELECT count(*) INTO v_matches FROM regexp_matches(v_def, v_completion_guard_pattern, 'gs');
  IF v_matches <> 1 THEN
    RAISE EXCEPTION 'Expected one surcharge guard in mkh_complete_cod_delivery; found %.', v_matches;
  END IF;
  v_new := regexp_replace(v_def, v_completion_guard_pattern, v_completion_guard_replacement, 'gs');
  EXECUTE v_new;
END;
$mkh_patch_existing_settlement_functions$;

-- 1. Dedicated surcharge posting subledger.
-- One order can produce at most one surcharge credit. The row is a sub-allocation
-- of the existing delivery_revenue entry, not a second customer charge/revenue.
CREATE TABLE IF NOT EXISTS public.mkh_surcharge_commission_postings (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  allocation_ledger_id bigint NOT NULL
    REFERENCES public.order_delivery_allocation_ledger(id) ON DELETE RESTRICT,
  delivery_revenue_ledger_id uuid NOT NULL
    REFERENCES public.financial_ledger(id) ON DELETE RESTRICT,
  beneficiary_registry_id uuid NOT NULL
    REFERENCES public.delivery_beneficiary_registry(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL
    REFERENCES public.wallets(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('posted','reversed')),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT mkh_surcharge_posting_one_order_uq UNIQUE (order_id),
  CONSTRAINT mkh_surcharge_posting_one_allocation_uq UNIQUE (allocation_ledger_id),
  CONSTRAINT mkh_surcharge_posting_one_revenue_entry_uq UNIQUE (delivery_revenue_ledger_id)
);

CREATE INDEX IF NOT EXISTS mkh_surcharge_commission_postings_wallet_idx
  ON public.mkh_surcharge_commission_postings(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mkh_surcharge_commission_postings_status_idx
  ON public.mkh_surcharge_commission_postings(status, created_at DESC);

ALTER TABLE public.mkh_surcharge_commission_postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mkh_surcharge_commission_postings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mkh_surcharge_commission_postings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mkh_surcharge_commission_postings_id_seq TO service_role;

COMMENT ON TABLE public.mkh_surcharge_commission_postings IS
  'Idempotent internal wallet credits for 100% of an order distance surcharge. Each row references the original held allocation row and the existing delivery_revenue ledger entry; it does not create additional customer revenue or initiate an external transfer.';

-- 2. Create or validate the dedicated internal MKH_Surcharge_commission wallet.
-- This does not create external bank details or authorize withdrawals/transfers.
DO $mkh_surcharge_wallet$
DECLARE
  v_registry public.delivery_beneficiary_registry%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_wallet_count integer;
  v_wallet_id uuid;
BEGIN
  SELECT *
    INTO v_registry
  FROM public.delivery_beneficiary_registry
  WHERE beneficiary_code = 'MKH-SURCHARGE-COMMISSION'
  FOR UPDATE;

  IF FOUND THEN
    -- Preserve the existing registry and wallet IDs; never recreate or reset balances.
    IF v_registry.beneficiary_code <> 'MKH-SURCHARGE-COMMISSION'
       OR v_registry.beneficiary_type <> 'mkh_pool'
       OR v_registry.display_name <> 'MKH_Surcharge_commission'
       OR v_registry.profile_id IS NOT NULL
       OR v_registry.is_active IS NOT TRUE
       OR v_registry.verified_at IS NULL
       OR v_registry.wallet_id IS NULL THEN
      RAISE EXCEPTION 'Existing surcharge registry row does not satisfy expected identity/verification/mapping; no changes made.';
    END IF;
    SELECT * INTO v_wallet
    FROM public.wallets w
    WHERE w.id = v_registry.wallet_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_wallet.owner_type <> 'mkh'
       OR v_wallet.owner_id <> v_registry.id THEN
      RAISE EXCEPTION 'Existing surcharge registry-to-wallet mapping is invalid; no changes made.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.owner_type = 'mkh'
        AND w.owner_id = v_registry.id
        AND w.id <> v_registry.wallet_id
    ) THEN
      RAISE EXCEPTION 'Multiple MKH wallets are linked to the surcharge registry; no changes made.';
    END IF;
  ELSE
  INSERT INTO public.delivery_beneficiary_registry (
    beneficiary_code,
    beneficiary_type,
    display_name,
    profile_id,
    wallet_id,
    external_account_reference,
    is_active,
    verified_at,
    verified_by,
    notes
  ) VALUES (
    'MKH-SURCHARGE-COMMISSION',
    'mkh_pool',
    'MKH_Surcharge_commission',
    NULL,
    NULL,
    NULL,
    TRUE,
    clock_timestamp(),
    NULL,
    'Dedicated internal MKH wallet for 100% of distance surcharges only. Internal registry mapping verification is not external bank-account verification and does not authorize transfers. Kept separate from MKH-POOL, MKH-COMMISSION-POOL-2, SG-GLOBAL-ALLIANCE and the six-role base allocation.'
  )
  RETURNING * INTO v_registry;

  SELECT count(*)::integer
    INTO v_wallet_count
  FROM public.wallets w
  WHERE w.owner_type = 'mkh'
    AND w.owner_id = v_registry.id;

  IF v_wallet_count > 0 THEN
    RAISE EXCEPTION
      'Unexpected MKH wallet already exists for the newly generated surcharge registry ID. Stop and inspect.';
  END IF;

  INSERT INTO public.wallets (
    owner_id,
    owner_type,
    available_balance,
    pending_balance,
    locked_balance,
    settled_balance,
    lifetime_earnings
  ) VALUES (
    v_registry.id,
    'mkh',
    0,
    0,
    0,
    0,
    0
  )
  RETURNING * INTO v_wallet;

  UPDATE public.delivery_beneficiary_registry
     SET wallet_id = v_wallet.id,
         updated_at = clock_timestamp()
   WHERE id = v_registry.id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.delivery_beneficiary_registry b
    JOIN public.wallets w ON w.id = b.wallet_id
    WHERE b.id = v_registry.id
      AND b.beneficiary_code = 'MKH-SURCHARGE-COMMISSION'
      AND b.beneficiary_type = 'mkh_pool'
      AND b.profile_id IS NULL
      AND b.is_active IS TRUE
      AND b.verified_at IS NOT NULL
      AND w.owner_type = 'mkh'
      AND w.owner_id = b.id
  ) THEN
    RAISE EXCEPTION
      'Surcharge wallet registry-to-wallet mapping did not pass validation.';
  END IF;
  END IF;
END;
$mkh_surcharge_wallet$;

-- 3. Idempotent posting function. It is called by a DEFERRED trigger after the
-- existing process_order_settlement inserts the completed rider_earning row.
CREATE OR REPLACE FUNCTION public.mkh_post_order_distance_surcharge(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_control public.order_delivery_allocation_controls%ROWTYPE;
  v_registry public.delivery_beneficiary_registry%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_existing public.mkh_surcharge_commission_postings%ROWTYPE;
  v_surcharge_ledger_id bigint;
  v_surcharge_ledger_count integer;
  v_surcharge_ledger_status text;
  v_surcharge_ledger_amount numeric(12,2);
  v_surcharge numeric(12,2);
  v_fee_snapshot_count integer;
  v_config_role_count integer;
  v_expected_base_total numeric(12,2);
  v_base_posting_count integer;
  v_base_posting_role_count integer;
  v_base_posting_total numeric(12,2);
  v_base_postings_valid boolean;
  v_settlement_entry_total integer;
  v_rider_entry_count integer;
  v_vendor_entry_count integer;
  v_platform_entry_count integer;
  v_delivery_entry_count integer;
  v_delivery_revenue public.financial_ledger%ROWTYPE;
  v_inserted_id bigint;
  v_idempotency_key text;
  v_rows integer;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Distance surcharge posting requires an order ID.';
  END IF;

  -- Separate lock namespace from the existing allocation and payout locks.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 9011503));

  SELECT *
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Distance surcharge posting stopped: order % was not found.', p_order_id;
  END IF;

  SELECT *
    INTO v_control
  FROM public.order_delivery_allocation_controls
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Preserve historical/base-fee orders only when their delivery fee does
    -- not exceed the established base. A distance-priced order without its
    -- immutable control snapshot must never bypass surcharge allocation.
    IF COALESCE(v_order.delivery_distance_surcharge, 0) = 0
       AND COALESCE(v_order.delivery_fee, 0) <= 1500 THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'surcharge_amount', 0,
        'wallet_credited', false,
        'message', 'No allocation control or distance surcharge exists; no surcharge credit is due.'
      );
    END IF;
    RAISE EXCEPTION
      'Distance surcharge posting stopped: order % is above the base delivery fee or has a surcharge, but no allocation control snapshot exists.',
      p_order_id;
  END IF;

  v_surcharge := COALESCE(v_control.distance_surcharge, 0)::numeric(12,2);

  -- A base-fee-only order has no surcharge credit to make. Preserve existing
  -- historical settlement behaviour only when the order and control agree.
  IF v_surcharge = 0 THEN
    IF COALESCE(v_order.delivery_distance_surcharge, 0) <> 0
       OR v_order.delivery_fee IS DISTINCT FROM v_control.base_delivery_fee
       OR v_order.delivery_fee_base IS DISTINCT FROM v_control.base_delivery_fee THEN
      RAISE EXCEPTION
        'Order % has fee fields inconsistent with a zero-surcharge allocation control.',
        p_order_id;
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'surcharge_amount', 0,
      'wallet_credited', false,
      'message', 'No distance surcharge exists for this order.'
    );
  END IF;

  IF v_order.status <> 'delivered'
     OR COALESCE(lower(btrim(v_order.payment_status)), '') <> 'paid' THEN
    RAISE EXCEPTION
      'Distance surcharge credit requires a delivered order with confirmed payment. Order %, status %, payment %.',
      p_order_id, v_order.status, v_order.payment_status;
  END IF;

  -- Existing posting means this order was already credited. Validate it and
  -- return without touching wallet balances again.
  SELECT *
    INTO v_existing
  FROM public.mkh_surcharge_commission_postings
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status <> 'posted'
       OR v_existing.amount IS DISTINCT FROM v_surcharge
       OR v_existing.idempotency_key IS DISTINCT FROM
            ('mkh-surcharge-commission:' || p_order_id::text)
       OR v_control.surcharge_allocation_status <> 'posted' THEN
      RAISE EXCEPTION
        'Existing surcharge posting for order % is inconsistent. Reconciliation is required; no retry credit was made.',
        p_order_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_posted', true,
      'order_id', p_order_id,
      'posting_id', v_existing.id,
      'amount', v_existing.amount,
      'wallet_credited_again', false,
      'message', 'Distance surcharge was already credited; idempotent retry made no second credit.'
    );
  END IF;

  IF v_control.base_allocation_status NOT IN ('ready','posted') THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: base allocation status is %, not ready/posted.',
      v_control.base_allocation_status;
  END IF;

  IF v_control.surcharge_allocation_status <> 'approved' THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: surcharge control must be transactionally approved by the delivery finalizer; found %.',
      v_control.surcharge_allocation_status;
  END IF;

  -- No approved funding rule exists for an extra rider distance increment.
  -- Do not post the full surcharge and an extra rider amount against the same
  -- delivery revenue unless those amounts are independently funded/approved.
  IF COALESCE(v_control.rider_distance_increment, 0) <> 0
     OR COALESCE(v_control.actual_rider_payout, 0)
          <> COALESCE(v_control.rider_base_payout, 0) THEN
    RAISE EXCEPTION
      'Distance surcharge settlement held: rider distance increment is non-zero. Approve its independent funding rule before settlement.';
  END IF;

  IF v_order.delivery_fee IS DISTINCT FROM
       (v_control.base_delivery_fee + v_control.distance_surcharge)
     OR v_order.delivery_fee_base IS DISTINCT FROM v_control.base_delivery_fee
     OR v_order.delivery_distance_surcharge IS DISTINCT FROM v_control.distance_surcharge THEN
    RAISE EXCEPTION
      'Order fee fields do not match the immutable allocation control snapshot for order %.',
      p_order_id;
  END IF;

  SELECT count(*)::integer
    INTO v_fee_snapshot_count
  FROM public.order_delivery_fee_breakdowns b
  WHERE b.order_id = p_order_id
    AND b.base_delivery_fee = v_control.base_delivery_fee
    AND b.customer_delivery_fee = v_order.delivery_fee
    AND b.distance_surcharge = v_surcharge
    AND b.platform_fee = v_order.platform_fee
    AND b.rider_payout = v_order.rider_amount
    AND b.route_distance_km IS NOT DISTINCT FROM v_order.delivery_route_distance_km;

  IF v_fee_snapshot_count <> 1 THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: expected one matching immutable delivery-fee snapshot for order %, found %.',
      p_order_id, v_fee_snapshot_count;
  END IF;

  -- Check the five non-rider beneficiary roles from the exact config version
  -- captured on the order. Their allocations remain separate from surcharge.
  SELECT count(*)::integer,
         COALESCE(sum(i.amount), 0)::numeric(12,2)
    INTO v_config_role_count, v_expected_base_total
  FROM public.delivery_allocation_config_items i
  WHERE i.config_version_id = v_control.config_version_id
    AND i.allocation_role IN ('trm','zm','vha','mkh_main','sg_global_alliance');

  IF v_config_role_count <> 5 THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: captured config version % has % non-rider base roles; expected 5.',
      v_control.config_version_id, v_config_role_count;
  END IF;

  SELECT count(*)::integer,
         count(DISTINCT l.allocation_role)::integer,
         COALESCE(sum(p.amount), 0)::numeric(12,2),
         COALESCE(bool_and(
           p.status = 'posted'
           AND p.beneficiary_registry_id IS NOT NULL
           AND p.wallet_id IS NOT NULL
           AND p.amount = i.amount
           AND l.allocation_status = 'posted'
         ), false)
    INTO v_base_posting_count, v_base_posting_role_count,
         v_base_posting_total, v_base_postings_valid
  FROM public.delivery_beneficiary_payout_postings p
  JOIN public.order_delivery_allocation_ledger l
    ON l.id = p.allocation_ledger_id
   AND l.order_id = p.order_id
  JOIN public.delivery_allocation_config_items i
    ON i.config_version_id = v_control.config_version_id
   AND i.allocation_role = l.allocation_role
  WHERE p.order_id = p_order_id
    AND l.is_base_allocation IS TRUE
    AND l.allocation_version = v_control.allocation_version
    AND l.config_version_id IS NOT DISTINCT FROM v_control.config_version_id
    AND l.allocation_role IN ('trm','zm','vha','mkh_main','sg_global_alliance');

  IF v_base_posting_count <> 5
     OR v_base_posting_role_count <> 5
     OR v_base_posting_total <> v_expected_base_total
     OR v_base_postings_valid IS NOT TRUE THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: five verified non-rider base beneficiary postings are not fully posted for order %.',
      p_order_id;
  END IF;

  -- The existing settlement function writes these four rows in one transaction.
  -- The deferred trigger runs at transaction end, after all four are present.
  SELECT count(*) FILTER (
           WHERE entry_type IN ('rider_earning','vendor_earning','platform_revenue','delivery_revenue')
         ),
         count(*) FILTER (WHERE entry_type = 'rider_earning' AND status = 'completed'),
         count(*) FILTER (WHERE entry_type = 'vendor_earning' AND status = 'completed'),
         count(*) FILTER (WHERE entry_type = 'platform_revenue' AND status = 'completed'),
         count(*) FILTER (WHERE entry_type = 'delivery_revenue' AND status = 'completed')
    INTO v_settlement_entry_total, v_rider_entry_count, v_vendor_entry_count,
         v_platform_entry_count, v_delivery_entry_count
  FROM public.financial_ledger
  WHERE order_id = p_order_id;

  IF v_settlement_entry_total <> 4
     OR v_rider_entry_count <> 1
     OR v_vendor_entry_count <> 1
     OR v_platform_entry_count <> 1
     OR v_delivery_entry_count <> 1 THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: expected exactly one completed vendor, rider, platform and delivery ledger entry for order %.',
      p_order_id;
  END IF;

  SELECT *
    INTO v_delivery_revenue
  FROM public.financial_ledger
  WHERE order_id = p_order_id
    AND entry_type = 'delivery_revenue'
    AND status = 'completed'
  FOR UPDATE;

  IF v_delivery_revenue.amount IS DISTINCT FROM
       (v_expected_base_total + v_surcharge)
     OR v_delivery_revenue.amount IS DISTINCT FROM
       (v_order.delivery_fee - COALESCE(v_order.rider_amount, 0)) THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: delivery_revenue does not exactly reconcile to base beneficiary allocations plus the full surcharge for order %.',
      p_order_id;
  END IF;

  -- Resolve the distinct MKH surcharge registry and wallet. Internal mapping
  -- verification is required; external bank details are neither read nor used.
  SELECT *
    INTO v_registry
  FROM public.delivery_beneficiary_registry
  WHERE beneficiary_code = 'MKH-SURCHARGE-COMMISSION'
    AND beneficiary_type = 'mkh_pool'
    AND display_name = 'MKH_Surcharge_commission'
    AND profile_id IS NULL
    AND is_active IS TRUE
    AND verified_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND OR v_registry.wallet_id IS NULL THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: MKH_Surcharge_commission registry is missing, inactive, unverified or unlinked.';
  END IF;

  SELECT *
    INTO v_wallet
  FROM public.wallets
  WHERE id = v_registry.wallet_id
    AND owner_type = 'mkh'
    AND owner_id = v_registry.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: surcharge wallet owner mapping does not match its registry.';
  END IF;

  -- Locate the original immutable surcharge snapshot row. Its amount and role
  -- are never rewritten; only its operational allocation status changes.
  SELECT count(*)::integer,
         min(id),
         min(amount),
         min(allocation_status)
    INTO v_surcharge_ledger_count, v_surcharge_ledger_id,
         v_surcharge_ledger_amount, v_surcharge_ledger_status
  FROM public.order_delivery_allocation_ledger
  WHERE order_id = p_order_id
    AND allocation_version = v_control.allocation_version
    AND config_version_id IS NOT DISTINCT FROM v_control.config_version_id
    AND allocation_role = 'distance_surcharge_unallocated'
    AND funding_bucket = 'distance_surcharge'
    AND is_base_allocation IS FALSE;

  IF v_surcharge_ledger_count <> 1
     OR v_surcharge_ledger_amount IS DISTINCT FROM v_surcharge
     OR v_surcharge_ledger_status <> 'ready' THEN
    RAISE EXCEPTION
      'Distance surcharge posting stopped: expected exactly one original ready surcharge allocation row with the captured amount for order %.',
      p_order_id;
  END IF;

  v_idempotency_key := 'mkh-surcharge-commission:' || p_order_id::text;

  INSERT INTO public.mkh_surcharge_commission_postings (
    order_id,
    allocation_ledger_id,
    delivery_revenue_ledger_id,
    beneficiary_registry_id,
    wallet_id,
    amount,
    currency,
    status,
    idempotency_key,
    metadata
  ) VALUES (
    p_order_id,
    v_surcharge_ledger_id,
    v_delivery_revenue.id,
    v_registry.id,
    v_wallet.id,
    v_surcharge,
    'NGN',
    'posted',
    v_idempotency_key,
    jsonb_build_object(
      'allocation_rule', '100_percent_to_mkh_surcharge_commission',
      'source_allocation_role', 'distance_surcharge_unallocated',
      'source_funding_bucket', 'distance_surcharge',
      'source_financial_ledger_entry_type', 'delivery_revenue',
      'suballocation_of_delivery_revenue', true,
      'additional_customer_charge', false,
      'external_bank_transfer', false,
      'wallet_credit_method', 'available_balance_and_lifetime_earnings',
      'settlement_trigger', 'deferred_completed_rider_earning'
    )
  )
  RETURNING id INTO v_inserted_id;

  UPDATE public.wallets
     SET available_balance = COALESCE(available_balance, 0) + v_surcharge,
         lifetime_earnings = COALESCE(lifetime_earnings, 0) + v_surcharge,
         updated_at = clock_timestamp()
   WHERE id = v_wallet.id
     AND owner_type = 'mkh'
     AND owner_id = v_registry.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION
      'Distance surcharge wallet credit did not update exactly one wallet for order %. Transaction rolled back.',
      p_order_id;
  END IF;

  UPDATE public.order_delivery_allocation_ledger
     SET allocation_status = 'posted',
         posted_at = clock_timestamp()
   WHERE id = v_surcharge_ledger_id
     AND order_id = p_order_id
     AND allocation_status = 'ready';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION
      'Original surcharge allocation status could not be marked posted for order %. Transaction rolled back.',
      p_order_id;
  END IF;

  UPDATE public.order_delivery_allocation_controls
     SET surcharge_allocation_status = 'posted',
         updated_at = clock_timestamp()
   WHERE order_id = p_order_id
     AND surcharge_allocation_status = 'approved';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION
      'Surcharge allocation control could not be marked posted for order %. Transaction rolled back.',
      p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_posted', false,
    'order_id', p_order_id,
    'posting_id', v_inserted_id,
    'surcharge_amount', v_surcharge,
    'wallet_id', v_wallet.id,
    'wallet_credited', true,
    'additional_customer_charge', false,
    'external_bank_transfer', false,
    'message', 'Full distance surcharge credited once to MKH_Surcharge_commission.'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_post_order_distance_surcharge(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- 4. Deferred trigger wrapper. Because it is INITIALLY DEFERRED, the call runs
-- at transaction end after process_order_settlement has inserted all four
-- financial_ledger entries and updated the existing vendor/rider wallets.
CREATE OR REPLACE FUNCTION public.mkh_trg_post_order_distance_surcharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.entry_type IS DISTINCT FROM 'rider_earning'
     OR NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  PERFORM public.mkh_post_order_distance_surcharge(NEW.order_id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_trg_post_order_distance_surcharge()
  FROM PUBLIC, anon, authenticated, service_role;

DO $mkh_surcharge_trigger_install$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.financial_ledger'::regclass
      AND t.tgname = 'trg_mkh_post_order_distance_surcharge_deferred'
      AND NOT t.tgisinternal
  ) THEN
    CREATE CONSTRAINT TRIGGER trg_mkh_post_order_distance_surcharge_deferred
    AFTER INSERT ON public.financial_ledger
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.mkh_trg_post_order_distance_surcharge();
  END IF;
END;
$mkh_surcharge_trigger_install$;

COMMENT ON FUNCTION public.mkh_post_order_distance_surcharge(uuid) IS
  'Posts 100% of a delivered, paid order distance surcharge to the separate MKH_Surcharge_commission wallet. Idempotent and reconciled to the existing delivery_revenue entry. Called by a deferred financial_ledger trigger; no external transfer occurs.';

COMMIT;

-- 5. READ-ONLY post-install verification. These statements execute after COMMIT and do not modify records.
SELECT
  b.beneficiary_code,
  b.beneficiary_type,
  b.display_name,
  b.is_active,
  (b.verified_at IS NOT NULL) AS internal_mapping_verified,
  b.id AS registry_id,
  b.wallet_id,
  w.owner_type AS wallet_owner_type,
  w.owner_id AS wallet_owner_id,
  w.available_balance,
  w.pending_balance,
  w.locked_balance,
  w.settled_balance,
  w.lifetime_earnings,
  (w.id IS NOT NULL AND w.owner_type = 'mkh' AND w.owner_id = b.id)
    AS wallet_mapping_matches,
  b.external_account_reference,
  'Internal wallet only; no bank recipient or transfer is configured by this migration'
    AS transfer_note
FROM public.delivery_beneficiary_registry b
LEFT JOIN public.wallets w ON w.id = b.wallet_id
WHERE b.beneficiary_code = 'MKH-SURCHARGE-COMMISSION';

SELECT
  p.order_id,
  o.order_number,
  p.allocation_ledger_id,
  p.delivery_revenue_ledger_id,
  p.beneficiary_registry_id,
  p.wallet_id,
  p.amount,
  p.status,
  p.idempotency_key,
  p.created_at,
  p.posted_at,
  p.metadata
FROM public.mkh_surcharge_commission_postings p
JOIN public.orders o ON o.id = p.order_id
ORDER BY p.created_at DESC;

SELECT
  t.tgname AS trigger_name,
  t.tgdeferrable AS deferrable,
  t.tginitdeferred AS initially_deferred,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.financial_ledger'::regclass
  AND t.tgname = 'trg_mkh_post_order_distance_surcharge_deferred'
  AND NOT t.tgisinternal;



SELECT
  position('base_allocation_status NOT IN' IN pg_get_functiondef(
    'public.mkh_post_delivery_beneficiary_payouts(uuid)'::regprocedure
  )) > 0 AS beneficiary_base_status_guard_preserved,
  position('surcharge_allocation_status NOT IN' IN pg_get_functiondef(
    'public.mkh_post_delivery_beneficiary_payouts(uuid)'::regprocedure
  )) > 0 AS beneficiary_surcharge_status_guard_preserved,
  position('surcharge_allocation_status = ''approved''' IN pg_get_functiondef(
    'public.complete_my_delivery(uuid)'::regprocedure
  )) > 0 AS delivery_finalizer_approves_surcharge_transactionally;

-- 6. READ-ONLY function/trigger verification.
SELECT
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) ILIKE '%distance_surcharge%' AS references_distance_surcharge,
  pg_get_functiondef(p.oid) ILIKE '%rider_distance_increment%' AS guards_rider_increment
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'mkh_post_order_distance_surcharge',
    'mkh_post_delivery_beneficiary_payouts',
    'complete_my_delivery',
    'mkh_complete_cod_delivery'
  )
ORDER BY p.proname;

SELECT
  t.tgname,
  t.tgdeferrable,
  t.tginitdeferred,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.financial_ledger'::regclass
  AND t.tgname = 'trg_mkh_post_order_distance_surcharge_deferred'
  AND NOT t.tgisinternal;
