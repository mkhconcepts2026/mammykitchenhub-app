-- MKH customer delivery quotes use Google Maps destination capture only.
-- This migration removes the obsolete requirement for the customer to select
-- an MKH locality at checkout. The locality column remains for historical
-- quote compatibility and existing quote/order rows are not rewritten.
--
-- Only the explicit locality-required validation is removed from the two
-- existing quote consumption functions. All other validations, including
-- quote ownership, cart/address hashes, expiry, idempotency, menu prices,
-- approved delivery rate cards, delivery allocation snapshots, wallet debit,
-- COD handling, and order/ledger triggers remain as currently installed.
--
-- Uses pg_get_functiondef + narrowly guarded text replacement so the current
-- Production function bodies are preserved rather than recreated from an
-- older application copy. Abort if the functions do not match the expected
-- current source text exactly.

BEGIN;

DO $migration$
DECLARE
  v_signature regprocedure;
  v_definition text;
  v_updated text;
  v_needle text := 'v_quote.destination_locality_id IS NULL OR';
  v_message_old text := 'Delivery quote is missing required locality, route, rate or fee data.';
  v_message_new text := 'Delivery quote is missing required route, rate or fee data.';
  v_cod regprocedure := 'public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure;
  v_wallet regprocedure := 'public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure;
  v_occurrences integer;
  v_message_occurrences integer;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[v_cod, v_wallet]
  LOOP
    v_definition := pg_get_functiondef(v_signature);

    v_occurrences := (
      length(v_definition) - length(replace(v_definition, v_needle, ''))
    ) / length(v_needle);

    IF v_occurrences <> 1 THEN
      RAISE EXCEPTION
        'Expected exactly one locality-required validation in %, found %. No function was changed.',
        v_signature,
        v_occurrences;
    END IF;

    v_message_occurrences := (
      length(v_definition) - length(replace(v_definition, v_message_old, ''))
    ) / length(v_message_old);

    IF v_message_occurrences <> 1 THEN
      RAISE EXCEPTION
        'Expected exactly one locality-specific validation message in %, found %. No function was changed.',
        v_signature,
        v_message_occurrences;
    END IF;

    v_updated := replace(v_definition, v_needle, '');
    v_updated := replace(v_updated, v_message_old, v_message_new);

    IF position(v_needle in v_updated) > 0 OR position(v_message_old in v_updated) > 0 THEN
      RAISE EXCEPTION
        'Locality requirement remains in %. No function was changed.',
        v_signature;
    END IF;

    EXECUTE v_updated;
  END LOOP;
END;
$migration$;

COMMIT;
