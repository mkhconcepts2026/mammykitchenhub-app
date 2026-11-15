-- Customer destination geometry comes from Google Maps (Place ID or exact pin).
-- MKH locality/territory/zone data is operational metadata, not a customer checkout prerequisite.
-- Existing quotes retain their destination_locality_id; new Google-only quotes may store NULL.
-- Only the locality-presence requirement is removed from the two order RPCs.
-- Route distance, rate-card, fee allocation, wallet debit, COD test flow, idempotency,
-- row locking, and all order/ledger trigger sequencing remain unchanged.

DO $mkh_customer_google_destination_locality_optional$
DECLARE
  v_target regprocedure;
  v_definition text;
  v_locality_check text := 'v_quote.destination_locality_id IS NULL OR';
  v_old_message text := 'Delivery quote is missing required locality, route, rate or fee data.';
  v_new_message text := 'Delivery quote is missing required route, rate or fee data.';
  v_match_count integer;
BEGIN
  FOREACH v_target IN ARRAY ARRAY[
    'public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure,
    'public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)'::regprocedure
  ]
  LOOP
    v_definition := pg_get_functiondef(v_target::oid);

    v_match_count := (
      length(v_definition) - length(replace(v_definition, v_locality_check, ''))
    ) / length(v_locality_check);
    IF v_match_count <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one locality-required condition in %, found %',
        v_target, v_match_count;
    END IF;

    v_match_count := (
      length(v_definition) - length(replace(v_definition, v_old_message, ''))
    ) / length(v_old_message);
    IF v_match_count <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one locality-specific validation message in %, found %',
        v_target, v_match_count;
    END IF;

    v_definition := replace(v_definition, v_locality_check, '');
    v_definition := replace(v_definition, v_old_message, v_new_message);
    EXECUTE v_definition;
  END LOOP;
END
$mkh_customer_google_destination_locality_optional$;
