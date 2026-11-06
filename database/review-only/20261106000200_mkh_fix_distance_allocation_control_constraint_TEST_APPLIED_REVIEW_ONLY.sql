/*
===============================================================================
MKH — FIX DISTANCE / RIDER ALLOCATION CONTROL AMOUNT CONSTRAINT
APPLY SCRIPT — MKH TEST SUPABASE PROJECT ONLY
Prepared: 2026-11-06

WHY THIS FIX IS REQUIRED
The installed check constraint still uses the old surcharge formula:
  distance_surcharge = customer_delivery_fee - base_delivery_fee
That rejects the approved distance-rider model whenever rider payout increases
above the NGN 800 base.

APPROVED MODEL
  customer_delivery_fee = actual_rider_payout
                         + (base_delivery_fee - rider_base_payout)
                         + distance_surcharge

  rider_distance_increment = actual_rider_payout - rider_base_payout

For the current 2–3 km test band:
  NGN 1,900 = NGN 1,000 rider + NGN 700 fixed sharing + NGN 200 residual.

SAFETY
- Run this script in the MKH TEST Supabase project's SQL Editor ONLY.
- Replaces only the CHECK constraint named below.
- Locks the allocation-control table while validating and replacing the rule.
- Stops without changing the constraint if the installed rule is unexpected or
  if any existing allocation-control row fails the new reconciliation.
- Does not update/delete/backfill orders, wallets, ledger rows, payout records,
  historical snapshots, or MKH-000110.
- Does not change pricing, rate cards, triggers, functions, or settlement logic.
- The change is transactional: any error before COMMIT rolls back the change.
===============================================================================
*/

BEGIN;

-- Prevent concurrent allocation-control writes between validation and DDL.
LOCK TABLE public.order_delivery_allocation_controls IN ACCESS EXCLUSIVE MODE;

DO $mkh_apply_distance_allocation_constraint$
DECLARE
  v_definition text;
  v_invalid_rows bigint;
  v_table_exists boolean;
BEGIN
  SELECT to_regclass('public.order_delivery_allocation_controls') IS NOT NULL
    INTO v_table_exists;

  IF v_table_exists IS NOT TRUE THEN
    RAISE EXCEPTION
      'MKH correction stopped: public.order_delivery_allocation_controls does not exist in this database.';
  END IF;

  SELECT pg_get_constraintdef(c.oid)
    INTO v_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.order_delivery_allocation_controls'::regclass
    AND c.conname = 'order_delivery_allocation_amounts_ck'
    AND c.contype = 'c';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION
      'MKH correction stopped: expected CHECK constraint order_delivery_allocation_amounts_ck was not found.';
  END IF;

  -- Fail closed: only replace the known old formula. This also prevents an
  -- accidental second execution over an already-corrected constraint.
  IF position('customer_delivery_fee - base_delivery_fee' IN v_definition) = 0
     OR position('actual_rider_payout - rider_base_payout' IN v_definition) = 0
     OR position('customer_delivery_fee - actual_rider_payout' IN v_definition) > 0 THEN
    RAISE EXCEPTION
      'MKH correction stopped: the installed constraint is not the expected old rule. No change made. Current definition: %',
      v_definition;
  END IF;

  -- Never rewrite historical rows to make the new constraint pass.
  SELECT count(*)
    INTO v_invalid_rows
  FROM public.order_delivery_allocation_controls c
  WHERE c.actual_rider_payout < c.rider_base_payout
     OR c.rider_distance_increment IS DISTINCT FROM
          (c.actual_rider_payout - c.rider_base_payout)
     OR c.distance_surcharge IS DISTINCT FROM
          GREATEST(
            c.customer_delivery_fee
              - c.actual_rider_payout
              - (c.base_delivery_fee - c.rider_base_payout),
            0
          )
     OR c.customer_delivery_fee IS DISTINCT FROM
          (
            c.actual_rider_payout
            + (c.base_delivery_fee - c.rider_base_payout)
            + c.distance_surcharge
          );

  IF v_invalid_rows > 0 THEN
    RAISE EXCEPTION
      'MKH correction stopped: % existing allocation-control row(s) do not reconcile under the approved model. No constraint change made.',
      v_invalid_rows;
  END IF;
END;
$mkh_apply_distance_allocation_constraint$;

ALTER TABLE public.order_delivery_allocation_controls
  DROP CONSTRAINT order_delivery_allocation_amounts_ck;

ALTER TABLE public.order_delivery_allocation_controls
  ADD CONSTRAINT order_delivery_allocation_amounts_ck
  CHECK (
    actual_rider_payout >= rider_base_payout
    AND rider_distance_increment =
        (actual_rider_payout - rider_base_payout)
    AND distance_surcharge = GREATEST(
        customer_delivery_fee
          - actual_rider_payout
          - (base_delivery_fee - rider_base_payout),
        0
    )
    AND customer_delivery_fee =
        actual_rider_payout
          + (base_delivery_fee - rider_base_payout)
          + distance_surcharge
  );

COMMENT ON CONSTRAINT order_delivery_allocation_amounts_ck
  ON public.order_delivery_allocation_controls IS
  'Validates customer delivery fee = captured rider payout + fixed non-rider sharing (base fee minus rider base) + residual distance surcharge; rider increment equals actual rider payout minus rider base payout.';

COMMIT;

-- Final verification: this must return constraint_installed = true and
-- approved_2_3km_example_reconciles = true.
SELECT
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.order_delivery_allocation_controls'::regclass
      AND conname = 'order_delivery_allocation_amounts_ck'
      AND contype = 'c'
  ) AS constraint_installed,
  (
    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.order_delivery_allocation_controls'::regclass
      AND conname = 'order_delivery_allocation_amounts_ck'
      AND contype = 'c'
  ) AS installed_constraint_definition,
  (1900::numeric = 1000::numeric + 700::numeric + 200::numeric)
    AS approved_2_3km_example_reconciles;