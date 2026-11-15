/*
MKH CUSTOMER WALLET + QUOTE-BACKED ORDER CHECKOUT
REVIEW/APPLY PACKAGE — TEST PROJECT FIRST
Prepared 2026-11-04

Includes:
- Paystack wallet funding intent ledger and server-only idempotent credit function.
- Corrected COD quote RPC: quote fields are inserted BEFORE existing orders triggers.
- New MKH Wallet quote RPC: same quote validation and trigger sequencing, plus an
  existing atomic customer-wallet debit in the same PostgreSQL transaction.

No old order, wallet balance, transaction, allocation snapshot or historical ledger
record is backfilled or rewritten. Customer cash withdrawals remain disabled.
COD remains TEST-only. The wallet checkout function keeps payment_method='wallet'.
The base delivery allocation remains NGN 1,500 and rider base remains NGN 800.
*/

BEGIN;

-- Paystack funding attempts are server-owned. Customers cannot read or mutate them.
CREATE TABLE IF NOT EXISTS public.customer_wallet_funding_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL REFERENCES public.customer_wallets(id) ON DELETE RESTRICT,
  reference text NOT NULL UNIQUE,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','credited','failed')),
  paystack_transaction_id text NULL,
  gateway_domain text NULL CHECK (gateway_domain IS NULL OR gateway_domain IN ('test','live')),
  initialized_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz NULL,
  credited_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT customer_wallet_funding_intent_credited_state_ck CHECK (
    (status <> 'credited') OR
    (paystack_transaction_id IS NOT NULL AND gateway_domain IS NOT NULL AND paid_at IS NOT NULL AND credited_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_wallet_funding_paystack_txn_uq
  ON public.customer_wallet_funding_intents(paystack_transaction_id)
  WHERE paystack_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_wallet_funding_customer_created_idx
  ON public.customer_wallet_funding_intents(customer_id, initialized_at DESC);

ALTER TABLE public.customer_wallet_funding_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_wallet_funding_intents FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.customer_wallet_funding_intents TO service_role;

COMMENT ON TABLE public.customer_wallet_funding_intents IS
  'Server-owned Paystack wallet funding intents. A successful server-side Verify API result is required before the existing customer wallet transaction primitive credits the wallet.';

CREATE OR REPLACE FUNCTION public.mkh_credit_customer_wallet_from_paystack(
  p_reference text,
  p_amount_kobo bigint,
  p_transaction_id text,
  p_currency text,
  p_domain text,
  p_paid_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_intent public.customer_wallet_funding_intents%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_credit_result jsonb;
  v_amount numeric(14,2);
BEGIN
  IF p_reference IS NULL OR btrim(p_reference) = ''
     OR p_amount_kobo IS NULL OR p_amount_kobo <= 0
     OR p_transaction_id IS NULL OR btrim(p_transaction_id) = ''
     OR p_currency IS DISTINCT FROM 'NGN'
     OR p_domain IS NULL OR p_domain NOT IN ('test','live')
     OR p_paid_at IS NULL THEN
    RAISE EXCEPTION 'Invalid verified Paystack wallet funding details.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_reference, 8122026));

  SELECT * INTO v_intent
    FROM public.customer_wallet_funding_intents
   WHERE reference = p_reference
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet funding intent not found.';
  END IF;

  IF v_intent.amount_kobo IS DISTINCT FROM p_amount_kobo
     OR v_intent.currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'Verified Paystack amount or currency does not match the funding intent.';
  END IF;

  IF v_intent.status = 'credited' THEN
    IF v_intent.paystack_transaction_id IS DISTINCT FROM p_transaction_id
       OR v_intent.gateway_domain IS DISTINCT FROM p_domain THEN
      RAISE EXCEPTION 'Previously credited wallet funding reference has conflicting Paystack transaction details.';
    END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'reference', p_reference);
  END IF;

  IF v_intent.status <> 'pending' THEN
    RAISE EXCEPTION 'Wallet funding intent is not pending and cannot be credited.';
  END IF;

  SELECT * INTO v_wallet
    FROM public.customer_wallets
   WHERE id = v_intent.wallet_id
     AND customer_id = v_intent.customer_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funding intent wallet does not match its customer.';
  END IF;

  -- Keep amounts in Naira in the customer wallet ledger; Paystack reports kobo.
  v_amount := (p_amount_kobo::numeric / 100)::numeric(14,2);

  v_credit_result := public.process_customer_wallet_transaction(
    v_intent.customer_id,
    'credit',
    v_amount,
    'paystack-wallet:' || p_reference,
    'Paystack wallet funding'
  );

  IF COALESCE((v_credit_result ->> 'success')::boolean, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Existing customer wallet transaction did not confirm funding credit.';
  END IF;

  UPDATE public.customer_wallet_funding_intents
     SET status = 'credited',
         paystack_transaction_id = p_transaction_id,
         gateway_domain = p_domain,
         paid_at = p_paid_at,
         credited_at = clock_timestamp()
   WHERE id = v_intent.id
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet funding intent could not be marked credited.';
  END IF;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'reference', p_reference, 'amount', v_amount);
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_credit_customer_wallet_from_paystack(text,bigint,text,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_credit_customer_wallet_from_paystack(text,bigint,text,text,text,timestamptz)
  TO service_role;

-- Quote-backed COD test checkout. Fee fields are written in INSERT, before triggers.
CREATE OR REPLACE FUNCTION public.create_customer_cod_order_from_quote(
    p_customer_id uuid,
    p_cart jsonb,
    p_delivery_address text,
    p_customer_phone text,
    p_customer_notes text,
    p_checkout_reference text,
    p_delivery_quote_id uuid,
    p_cart_hash text,
    p_destination_address_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_quote public.delivery_quotes%ROWTYPE;
    v_existing public.orders%ROWTYPE;
    v_existing_quote public.delivery_quotes%ROWTYPE;
    v_config public.delivery_allocation_config_versions%ROWTYPE;

    v_json_item jsonb;
    v_item_id uuid;
    v_quantity integer;
    v_item_count integer := 0;
    v_i integer;
    v_item_ids uuid[] := ARRAY[]::uuid[];
    v_item_quantities integer[] := ARRAY[]::integer[];
    v_item_names text[] := ARRAY[]::text[];
    v_item_prices integer[] := ARRAY[]::integer[];

    v_menu_name text;
    v_menu_price integer;
    v_menu_vendor_id uuid;
    v_menu_available boolean;
    v_vendor_id uuid;

    v_address text;
    v_phone text;
    v_notes text;
    v_subtotal numeric(12,2) := 0;
    v_rider_base numeric(12,2);
    v_delivery_fee integer;
    v_platform_fee integer;
    v_distance_surcharge numeric(12,2);
    v_total numeric(12,2);
    v_order_id uuid;
    v_rows integer;
BEGIN
    /* 1. Validate request envelope and normalize customer details. */
    IF p_customer_id IS NULL OR p_delivery_quote_id IS NULL THEN
        RAISE EXCEPTION 'A valid customer and delivery quote are required.';
    END IF;

    IF p_checkout_reference IS NULL OR
       p_checkout_reference !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        RAISE EXCEPTION 'A valid checkout reference is required.';
    END IF;

    IF p_cart_hash IS NULL OR p_cart_hash !~ '^[0-9a-fA-F]{64}$' OR
       p_destination_address_hash IS NULL OR p_destination_address_hash !~ '^[0-9a-fA-F]{64}$' THEN
        RAISE EXCEPTION 'Valid cart and delivery-address hashes are required.';
    END IF;

    v_address := btrim(COALESCE(p_delivery_address, ''));
    v_phone := btrim(COALESCE(p_customer_phone, ''));
    v_notes := NULLIF(btrim(COALESCE(p_customer_notes, '')), '');

    IF v_address = '' OR length(v_address) > 1000 THEN
        RAISE EXCEPTION 'A valid delivery address is required.';
    END IF;
    IF v_phone !~ '^0[0-9]{10}$' THEN
        RAISE EXCEPTION 'Phone number must be exactly 11 digits and start with 0.';
    END IF;
    IF length(COALESCE(v_notes, '')) > 2000 THEN
        RAISE EXCEPTION 'Customer notes are too long.';
    END IF;

    IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' THEN
        RAISE EXCEPTION 'Cart must be a JSON array.';
    END IF;
    IF jsonb_array_length(p_cart) < 1 OR jsonb_array_length(p_cart) > 50 THEN
        RAISE EXCEPTION 'Cart must contain between 1 and 50 items.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_customer_id
          AND lower(COALESCE(p.role, '')) = 'customer'
          AND lower(COALESCE(p.status, '')) = 'active'
    ) THEN
        RAISE EXCEPTION 'Customer profile is not active or eligible.';
    END IF;

    /* 2. Parse and validate the submitted cart. */
    FOR v_json_item IN
        SELECT value FROM jsonb_array_elements(p_cart) AS cart(value)
    LOOP
        IF jsonb_typeof(v_json_item) <> 'object' THEN
            RAISE EXCEPTION 'Each cart item must be an object.';
        END IF;

        IF jsonb_typeof(v_json_item -> 'menu_item_id') <> 'string' OR
           (v_json_item ->> 'menu_item_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            RAISE EXCEPTION 'A cart item has an invalid menu item ID.';
        END IF;

        IF jsonb_typeof(v_json_item -> 'quantity') <> 'number' OR
           (v_json_item ->> 'quantity') !~ '^[0-9]{1,2}$' THEN
            RAISE EXCEPTION 'Each quantity must be a whole number.';
        END IF;

        v_item_id := (v_json_item ->> 'menu_item_id')::uuid;
        v_quantity := (v_json_item ->> 'quantity')::integer;
        IF v_quantity < 1 OR v_quantity > 99 THEN
            RAISE EXCEPTION 'Quantity must be between 1 and 99.';
        END IF;
        IF v_item_id = ANY(v_item_ids) THEN
            RAISE EXCEPTION 'Duplicate cart items must be combined.';
        END IF;

        v_item_ids := array_append(v_item_ids, v_item_id);
        v_item_quantities := array_append(v_item_quantities, v_quantity);
        v_item_count := v_item_count + 1;
    END LOOP;

    /* 3. Serialize retries and lock the submitted quote. */
    PERFORM pg_advisory_xact_lock(hashtextextended(p_checkout_reference, 0));

    SELECT *
    INTO v_quote
    FROM public.delivery_quotes
    WHERE id = p_delivery_quote_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery quote not found. Recalculate delivery before checkout.';
    END IF;
    IF v_quote.customer_id IS DISTINCT FROM p_customer_id THEN
        RAISE EXCEPTION 'Delivery quote does not belong to this customer.';
    END IF;
    IF v_quote.cart_hash IS DISTINCT FROM lower(p_cart_hash) OR
       v_quote.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash) THEN
        RAISE EXCEPTION 'Cart or delivery address changed. Recalculate delivery before checkout.';
    END IF;

    /* 4. Idempotent retry: return the original matching order unchanged. */
    SELECT *
    INTO v_existing
    FROM public.orders
    WHERE cod_checkout_reference = p_checkout_reference
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.user_id IS DISTINCT FROM p_customer_id OR
           v_existing.delivery_address IS DISTINCT FROM v_address OR
           v_existing.customer_phone IS DISTINCT FROM v_phone OR
           v_existing.customer_notes IS DISTINCT FROM v_notes OR
           v_existing.payment_method IS DISTINCT FROM 'cash_on_delivery' OR
           v_existing.delivery_quote_id IS NULL THEN
            RAISE EXCEPTION 'Checkout reference already belongs to a different or incomplete order. Check your orders before retrying.';
        END IF;

        SELECT *
        INTO v_existing_quote
        FROM public.delivery_quotes
        WHERE id = v_existing.delivery_quote_id
        FOR UPDATE;

        IF NOT FOUND OR
           v_existing_quote.customer_id IS DISTINCT FROM p_customer_id OR
           v_existing_quote.status IS DISTINCT FROM 'consumed' OR
           v_existing_quote.consumed_at IS NULL OR
           v_existing_quote.cart_hash IS DISTINCT FROM lower(p_cart_hash) OR
           v_existing_quote.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash) OR
           v_existing.vendor_id IS DISTINCT FROM v_existing_quote.vendor_id OR
           round(COALESCE(v_existing.food_amount, 0)::numeric, 2) <> round(v_existing_quote.subtotal_amount, 2) OR
           round(COALESCE(v_existing.delivery_fee, 0)::numeric, 2) <> round(v_existing_quote.customer_delivery_fee, 2) OR
           round(COALESCE(v_existing.platform_fee, 0)::numeric, 2) <> round(v_existing_quote.platform_fee, 2) OR
           COALESCE(v_existing.total, 0) <> round(
               v_existing_quote.subtotal_amount +
               v_existing_quote.customer_delivery_fee +
               v_existing_quote.platform_fee
           )::integer THEN
            RAISE EXCEPTION 'Checkout reference already belongs to a different or incomplete order. Check your orders before retrying.';
        END IF;

        SELECT count(*)::integer
        INTO v_rows
        FROM public.order_items oi
        WHERE oi.order_id = v_existing.id;

        IF v_rows <> v_item_count THEN
            RAISE EXCEPTION 'Checkout reference does not match the original cart.';
        END IF;

        FOR v_i IN 1..v_item_count LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM public.order_items oi
                WHERE oi.order_id = v_existing.id
                  AND oi.menu_item_id = v_item_ids[v_i]
                  AND oi.quantity = v_item_quantities[v_i]
            ) THEN
                RAISE EXCEPTION 'Checkout reference does not match the original cart.';
            END IF;
        END LOOP;

        RETURN jsonb_build_object(
            'success', true,
            'order_id', v_existing.id,
            'total', v_existing.total,
            'duplicate', true,
            'delivery_quote_id', v_existing.delivery_quote_id
        );
    END IF;

    /* 5. A new order requires a fresh, unconsumed quote with complete route data. */
    IF v_quote.status IS DISTINCT FROM 'quoted' OR v_quote.expires_at <= now() THEN
        RAISE EXCEPTION 'Delivery quote has expired or has already been used. Recalculate delivery before checkout.';
    END IF;
    IF v_quote.destination_locality_id IS NULL OR
       v_quote.route_distance_meters IS NULL OR v_quote.route_distance_meters <= 0 OR
       v_quote.route_distance_km IS NULL OR v_quote.route_distance_km <= 0 OR
       v_quote.rate_version IS NULL OR v_quote.rate_version <= 0 OR
       v_quote.customer_delivery_fee IS NULL OR v_quote.platform_fee IS NULL THEN
        RAISE EXCEPTION 'Delivery quote is missing required locality, route, rate or fee data.';
    END IF;

    /* 6. Re-price and lock the current menu rows; never trust browser prices. */
    FOR v_i IN 1..v_item_count LOOP
        SELECT mi.name, mi.price, mi.vendor_id, mi.available
        INTO v_menu_name, v_menu_price, v_menu_vendor_id, v_menu_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_ids[v_i]
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'A selected menu item no longer exists.';
        END IF;
        IF v_menu_available IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'A selected menu item is unavailable.';
        END IF;
        IF v_menu_price IS NULL OR v_menu_price < 0 OR v_menu_vendor_id IS NULL THEN
            RAISE EXCEPTION 'A selected menu item has invalid price or vendor information.';
        END IF;

        IF v_vendor_id IS NULL THEN
            v_vendor_id := v_menu_vendor_id;
        ELSIF v_vendor_id IS DISTINCT FROM v_menu_vendor_id THEN
            RAISE EXCEPTION 'Please order from one vendor at a time.';
        END IF;

        v_item_names := array_append(v_item_names, v_menu_name);
        v_item_prices := array_append(v_item_prices, v_menu_price);
        v_subtotal := v_subtotal + (v_menu_price::numeric * v_item_quantities[v_i]);
    END LOOP;

    IF v_vendor_id IS DISTINCT FROM v_quote.vendor_id OR
       round(v_subtotal, 2) <> round(v_quote.subtotal_amount, 2) THEN
        RAISE EXCEPTION 'The current cart or menu prices no longer match the delivery quote. Recalculate delivery.';
    END IF;

    /* 7. Lock the active allocation configuration used by the insert trigger. */
    SELECT *
    INTO v_config
    FROM public.delivery_allocation_config_versions
    WHERE status = 'active'
    ORDER BY version_number DESC
    LIMIT 1
    FOR SHARE;

    IF NOT FOUND OR v_config.base_delivery_fee IS DISTINCT FROM 1500 THEN
        RAISE EXCEPTION 'The active delivery allocation base fee must remain NGN 1,500.';
    END IF;

    SELECT amount
    INTO STRICT v_rider_base
    FROM public.delivery_allocation_config_items
    WHERE config_version_id = v_config.id
      AND allocation_role = 'rider_base';

    IF v_rider_base IS DISTINCT FROM 800 THEN
        RAISE EXCEPTION 'The active rider base payout must remain NGN 800.';
    END IF;

    IF v_quote.customer_delivery_fee < v_config.base_delivery_fee THEN
        RAISE EXCEPTION 'Quoted delivery fee is below the active allocation base fee.';
    END IF;
    IF v_quote.customer_delivery_fee <> round(v_quote.customer_delivery_fee) OR
       v_quote.platform_fee <> round(v_quote.platform_fee) THEN
        RAISE EXCEPTION 'Quoted delivery and platform fees must be whole Naira amounts.';
    END IF;

    v_delivery_fee := round(v_quote.customer_delivery_fee)::integer;
    v_platform_fee := round(v_quote.platform_fee)::integer;
    v_distance_surcharge := greatest(
        v_quote.customer_delivery_fee - v_config.base_delivery_fee,
        0
    )::numeric(12,2);

    v_total := round(
        v_subtotal + v_quote.customer_delivery_fee + v_quote.platform_fee
    )::numeric(12,2);

    IF v_total <= 0 OR v_total > 2147483647 THEN
        RAISE EXCEPTION 'Quoted order total is outside the supported range.';
    END IF;

    /*
      8. CRITICAL SEQUENCING CORRECTION:
      Insert all quote-derived fields BEFORE the existing order INSERT triggers run.
      The existing commission, delivery-fee-breakdown and delivery-allocation triggers
      therefore receive the verified fee, base, surcharge, route, rate version and quote ID.

      Existing legacy order fields (vendor_amount, rider_amount, mkh_amount) retain
      their established semantics. rider_amount is populated from the active versioned
      rider_base configuration rather than a hard-coded amount.
    */
    INSERT INTO public.orders (
        user_id,
        vendor_id,
        food_amount,
        delivery_fee,
        platform_fee,
        vendor_amount,
        rider_amount,
        mkh_amount,
        total,
        delivery_fee_base,
        delivery_distance_surcharge,
        delivery_route_distance_km,
        delivery_rate_version,
        delivery_quote_id,
        delivery_address,
        customer_notes,
        customer_phone,
        status,
        payment_method,
        payment_status,
        cod_checkout_reference
    )
    VALUES (
        p_customer_id,
        v_vendor_id,
        v_subtotal,
        v_delivery_fee,
        v_platform_fee,
        v_subtotal,
        v_rider_base,
        700,
        v_total::integer,
        v_config.base_delivery_fee,
        v_distance_surcharge,
        v_quote.route_distance_km,
        v_quote.rate_version,
        v_quote.id,
        v_address,
        v_notes,
        v_phone,
        'pending',
        'cash_on_delivery',
        'unpaid',
        p_checkout_reference
    )
    RETURNING id INTO v_order_id;

    /* 9. Save the validated item snapshots within the same transaction. */
    FOR v_i IN 1..v_item_count LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            name,
            quantity,
            price
        )
        VALUES (
            v_order_id,
            v_item_ids[v_i],
            v_item_names[v_i],
            v_item_quantities[v_i],
            v_item_prices[v_i]
        );
    END LOOP;

    /* 10. Consume the quote only after order, items and insert-trigger snapshots succeed. */
    UPDATE public.delivery_quotes
    SET status = 'consumed',
        consumed_at = now()
    WHERE id = v_quote.id
      AND status = 'quoted'
      AND expires_at > now();

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Delivery quote could not be consumed. Checkout cancelled.';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total', v_total::integer,
        'duplicate', false,
        'delivery_quote_id', v_quote.id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)
  TO service_role;

-- Existing wallet orders already use wallet_checkout_reference; ensure it is indexed.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS wallet_checkout_reference text;
DO $wallet_checkout_reference_preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE wallet_checkout_reference IS NOT NULL
    GROUP BY wallet_checkout_reference
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate historical wallet checkout references exist; inspect them before creating the unique index.';
  END IF;
END;
$wallet_checkout_reference_preflight$;
CREATE UNIQUE INDEX IF NOT EXISTS orders_wallet_checkout_reference_uq
  ON public.orders(wallet_checkout_reference)
  WHERE wallet_checkout_reference IS NOT NULL;

-- Quote-backed customer wallet order. Creation, wallet debit, ledger and quote use
-- are one transaction. A failed debit rolls the entire order/quote operation back.
CREATE OR REPLACE FUNCTION public.create_customer_wallet_order_from_quote(
    p_customer_id uuid,
    p_cart jsonb,
    p_delivery_address text,
    p_customer_phone text,
    p_customer_notes text,
    p_checkout_reference text,
    p_delivery_quote_id uuid,
    p_cart_hash text,
    p_destination_address_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_quote public.delivery_quotes%ROWTYPE;
    v_existing public.orders%ROWTYPE;
    v_existing_quote public.delivery_quotes%ROWTYPE;
    v_config public.delivery_allocation_config_versions%ROWTYPE;

    v_json_item jsonb;
    v_item_id uuid;
    v_quantity integer;
    v_item_count integer := 0;
    v_i integer;
    v_item_ids uuid[] := ARRAY[]::uuid[];
    v_item_quantities integer[] := ARRAY[]::integer[];
    v_item_names text[] := ARRAY[]::text[];
    v_item_prices integer[] := ARRAY[]::integer[];

    v_menu_name text;
    v_menu_price integer;
    v_menu_vendor_id uuid;
    v_menu_available boolean;
    v_vendor_id uuid;

    v_address text;
    v_phone text;
    v_notes text;
    v_subtotal numeric(12,2) := 0;
    v_rider_base numeric(12,2);
    v_delivery_fee integer;
    v_platform_fee integer;
    v_distance_surcharge numeric(12,2);
    v_total numeric(12,2);
    v_order_id uuid;
    v_rows integer;
    v_wallet_balance numeric(14,2);
    v_wallet_result jsonb;
BEGIN
    /* 1. Validate request envelope and normalize customer details. */
    IF p_customer_id IS NULL OR p_delivery_quote_id IS NULL THEN
        RAISE EXCEPTION 'A valid customer and delivery quote are required.';
    END IF;

    IF p_checkout_reference IS NULL OR
       p_checkout_reference !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        RAISE EXCEPTION 'A valid checkout reference is required.';
    END IF;

    IF p_cart_hash IS NULL OR p_cart_hash !~ '^[0-9a-fA-F]{64}$' OR
       p_destination_address_hash IS NULL OR p_destination_address_hash !~ '^[0-9a-fA-F]{64}$' THEN
        RAISE EXCEPTION 'Valid cart and delivery-address hashes are required.';
    END IF;

    v_address := btrim(COALESCE(p_delivery_address, ''));
    v_phone := btrim(COALESCE(p_customer_phone, ''));
    v_notes := NULLIF(btrim(COALESCE(p_customer_notes, '')), '');

    IF v_address = '' OR length(v_address) > 1000 THEN
        RAISE EXCEPTION 'A valid delivery address is required.';
    END IF;
    IF v_phone !~ '^0[0-9]{10}$' THEN
        RAISE EXCEPTION 'Phone number must be exactly 11 digits and start with 0.';
    END IF;
    IF length(COALESCE(v_notes, '')) > 2000 THEN
        RAISE EXCEPTION 'Customer notes are too long.';
    END IF;

    IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' THEN
        RAISE EXCEPTION 'Cart must be a JSON array.';
    END IF;
    IF jsonb_array_length(p_cart) < 1 OR jsonb_array_length(p_cart) > 50 THEN
        RAISE EXCEPTION 'Cart must contain between 1 and 50 items.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_customer_id
          AND lower(COALESCE(p.role, '')) = 'customer'
          AND lower(COALESCE(p.status, '')) = 'active'
    ) THEN
        RAISE EXCEPTION 'Customer profile is not active or eligible.';
    END IF;

    /* 2. Parse and validate the submitted cart. */
    FOR v_json_item IN
        SELECT value FROM jsonb_array_elements(p_cart) AS cart(value)
    LOOP
        IF jsonb_typeof(v_json_item) <> 'object' THEN
            RAISE EXCEPTION 'Each cart item must be an object.';
        END IF;

        IF jsonb_typeof(v_json_item -> 'menu_item_id') <> 'string' OR
           (v_json_item ->> 'menu_item_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            RAISE EXCEPTION 'A cart item has an invalid menu item ID.';
        END IF;

        IF jsonb_typeof(v_json_item -> 'quantity') <> 'number' OR
           (v_json_item ->> 'quantity') !~ '^[0-9]{1,2}$' THEN
            RAISE EXCEPTION 'Each quantity must be a whole number.';
        END IF;

        v_item_id := (v_json_item ->> 'menu_item_id')::uuid;
        v_quantity := (v_json_item ->> 'quantity')::integer;
        IF v_quantity < 1 OR v_quantity > 99 THEN
            RAISE EXCEPTION 'Quantity must be between 1 and 99.';
        END IF;
        IF v_item_id = ANY(v_item_ids) THEN
            RAISE EXCEPTION 'Duplicate cart items must be combined.';
        END IF;

        v_item_ids := array_append(v_item_ids, v_item_id);
        v_item_quantities := array_append(v_item_quantities, v_quantity);
        v_item_count := v_item_count + 1;
    END LOOP;

    /* 3. Serialize retries and lock the submitted quote. */
    PERFORM pg_advisory_xact_lock(hashtextextended(p_checkout_reference, 0));

    SELECT *
    INTO v_quote
    FROM public.delivery_quotes
    WHERE id = p_delivery_quote_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery quote not found. Recalculate delivery before checkout.';
    END IF;
    IF v_quote.customer_id IS DISTINCT FROM p_customer_id THEN
        RAISE EXCEPTION 'Delivery quote does not belong to this customer.';
    END IF;
    IF v_quote.cart_hash IS DISTINCT FROM lower(p_cart_hash) OR
       v_quote.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash) THEN
        RAISE EXCEPTION 'Cart or delivery address changed. Recalculate delivery before checkout.';
    END IF;

    /* 4. Idempotent retry: return the original matching order unchanged. */
    SELECT *
    INTO v_existing
    FROM public.orders
    WHERE wallet_checkout_reference = p_checkout_reference
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.user_id IS DISTINCT FROM p_customer_id OR
           v_existing.delivery_address IS DISTINCT FROM v_address OR
           v_existing.customer_phone IS DISTINCT FROM v_phone OR
           v_existing.customer_notes IS DISTINCT FROM v_notes OR
           v_existing.payment_method IS DISTINCT FROM 'wallet' OR
           v_existing.payment_status IS DISTINCT FROM 'paid' OR
           v_existing.delivery_quote_id IS NULL THEN
            RAISE EXCEPTION 'Checkout reference already belongs to a different or incomplete order. Check your orders before retrying.';
        END IF;

        SELECT *
        INTO v_existing_quote
        FROM public.delivery_quotes
        WHERE id = v_existing.delivery_quote_id
        FOR UPDATE;

        IF NOT FOUND OR
           v_existing_quote.customer_id IS DISTINCT FROM p_customer_id OR
           v_existing_quote.status IS DISTINCT FROM 'consumed' OR
           v_existing_quote.consumed_at IS NULL OR
           v_existing_quote.cart_hash IS DISTINCT FROM lower(p_cart_hash) OR
           v_existing_quote.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash) OR
           v_existing.vendor_id IS DISTINCT FROM v_existing_quote.vendor_id OR
           round(COALESCE(v_existing.food_amount, 0)::numeric, 2) <> round(v_existing_quote.subtotal_amount, 2) OR
           round(COALESCE(v_existing.delivery_fee, 0)::numeric, 2) <> round(v_existing_quote.customer_delivery_fee, 2) OR
           round(COALESCE(v_existing.platform_fee, 0)::numeric, 2) <> round(v_existing_quote.platform_fee, 2) OR
           COALESCE(v_existing.total, 0) <> round(
               v_existing_quote.subtotal_amount +
               v_existing_quote.customer_delivery_fee +
               v_existing_quote.platform_fee
           )::integer THEN
            RAISE EXCEPTION 'Checkout reference already belongs to a different or incomplete order. Check your orders before retrying.';
        END IF;

        SELECT count(*)::integer
        INTO v_rows
        FROM public.order_items oi
        WHERE oi.order_id = v_existing.id;

        IF v_rows <> v_item_count THEN
            RAISE EXCEPTION 'Checkout reference does not match the original cart.';
        END IF;

        FOR v_i IN 1..v_item_count LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM public.order_items oi
                WHERE oi.order_id = v_existing.id
                  AND oi.menu_item_id = v_item_ids[v_i]
                  AND oi.quantity = v_item_quantities[v_i]
            ) THEN
                RAISE EXCEPTION 'Checkout reference does not match the original cart.';
            END IF;
        END LOOP;

        RETURN jsonb_build_object(
            'success', true,
            'order_id', v_existing.id,
            'total', v_existing.total,
            'duplicate', true,
            'delivery_quote_id', v_existing.delivery_quote_id
        );
    END IF;

    /* 5. A new order requires a fresh, unconsumed quote with complete route data. */
    IF v_quote.status IS DISTINCT FROM 'quoted' OR v_quote.expires_at <= now() THEN
        RAISE EXCEPTION 'Delivery quote has expired or has already been used. Recalculate delivery before checkout.';
    END IF;
    IF v_quote.destination_locality_id IS NULL OR
       v_quote.route_distance_meters IS NULL OR v_quote.route_distance_meters <= 0 OR
       v_quote.route_distance_km IS NULL OR v_quote.route_distance_km <= 0 OR
       v_quote.rate_version IS NULL OR v_quote.rate_version <= 0 OR
       v_quote.customer_delivery_fee IS NULL OR v_quote.platform_fee IS NULL THEN
        RAISE EXCEPTION 'Delivery quote is missing required locality, route, rate or fee data.';
    END IF;

    /* 6. Re-price and lock the current menu rows; never trust browser prices. */
    FOR v_i IN 1..v_item_count LOOP
        SELECT mi.name, mi.price, mi.vendor_id, mi.available
        INTO v_menu_name, v_menu_price, v_menu_vendor_id, v_menu_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_ids[v_i]
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'A selected menu item no longer exists.';
        END IF;
        IF v_menu_available IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'A selected menu item is unavailable.';
        END IF;
        IF v_menu_price IS NULL OR v_menu_price < 0 OR v_menu_vendor_id IS NULL THEN
            RAISE EXCEPTION 'A selected menu item has invalid price or vendor information.';
        END IF;

        IF v_vendor_id IS NULL THEN
            v_vendor_id := v_menu_vendor_id;
        ELSIF v_vendor_id IS DISTINCT FROM v_menu_vendor_id THEN
            RAISE EXCEPTION 'Please order from one vendor at a time.';
        END IF;

        v_item_names := array_append(v_item_names, v_menu_name);
        v_item_prices := array_append(v_item_prices, v_menu_price);
        v_subtotal := v_subtotal + (v_menu_price::numeric * v_item_quantities[v_i]);
    END LOOP;

    IF v_vendor_id IS DISTINCT FROM v_quote.vendor_id OR
       round(v_subtotal, 2) <> round(v_quote.subtotal_amount, 2) THEN
        RAISE EXCEPTION 'The current cart or menu prices no longer match the delivery quote. Recalculate delivery.';
    END IF;

    /* 7. Lock the active allocation configuration used by the insert trigger. */
    SELECT *
    INTO v_config
    FROM public.delivery_allocation_config_versions
    WHERE status = 'active'
    ORDER BY version_number DESC
    LIMIT 1
    FOR SHARE;

    IF NOT FOUND OR v_config.base_delivery_fee IS DISTINCT FROM 1500 THEN
        RAISE EXCEPTION 'The active delivery allocation base fee must remain NGN 1,500.';
    END IF;

    SELECT amount
    INTO STRICT v_rider_base
    FROM public.delivery_allocation_config_items
    WHERE config_version_id = v_config.id
      AND allocation_role = 'rider_base';

    IF v_rider_base IS DISTINCT FROM 800 THEN
        RAISE EXCEPTION 'The active rider base payout must remain NGN 800.';
    END IF;

    IF v_quote.customer_delivery_fee < v_config.base_delivery_fee THEN
        RAISE EXCEPTION 'Quoted delivery fee is below the active allocation base fee.';
    END IF;
    IF v_quote.customer_delivery_fee <> round(v_quote.customer_delivery_fee) OR
       v_quote.platform_fee <> round(v_quote.platform_fee) THEN
        RAISE EXCEPTION 'Quoted delivery and platform fees must be whole Naira amounts.';
    END IF;

    v_delivery_fee := round(v_quote.customer_delivery_fee)::integer;
    v_platform_fee := round(v_quote.platform_fee)::integer;
    v_distance_surcharge := greatest(
        v_quote.customer_delivery_fee - v_config.base_delivery_fee,
        0
    )::numeric(12,2);

    v_total := round(
        v_subtotal + v_quote.customer_delivery_fee + v_quote.platform_fee
    )::numeric(12,2);

    IF v_total <= 0 OR v_total > 2147483647 THEN
        RAISE EXCEPTION 'Quoted order total is outside the supported range.';
    END IF;

    -- Lock and validate the customer wallet before any order mutation.
    SELECT available_balance
      INTO v_wallet_balance
      FROM public.customer_wallets
     WHERE customer_id = p_customer_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer wallet not found. Activate your wallet before checkout.';
    END IF;
    IF COALESCE(v_wallet_balance, 0) < v_total THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    /*
      8. CRITICAL SEQUENCING CORRECTION:
      Insert all quote-derived fields BEFORE the existing order INSERT triggers run.
      The existing commission, delivery-fee-breakdown and delivery-allocation triggers
      therefore receive the verified fee, base, surcharge, route, rate version and quote ID.

      Existing legacy order fields (vendor_amount, rider_amount, mkh_amount) retain
      their established semantics. rider_amount is populated from the active versioned
      rider_base configuration rather than a hard-coded amount.
    */
    INSERT INTO public.orders (
        user_id,
        vendor_id,
        food_amount,
        delivery_fee,
        platform_fee,
        vendor_amount,
        rider_amount,
        mkh_amount,
        total,
        delivery_fee_base,
        delivery_distance_surcharge,
        delivery_route_distance_km,
        delivery_rate_version,
        delivery_quote_id,
        delivery_address,
        customer_notes,
        customer_phone,
        status,
        payment_method,
        payment_status,
        wallet_checkout_reference
    )
    VALUES (
        p_customer_id,
        v_vendor_id,
        v_subtotal,
        v_delivery_fee,
        v_platform_fee,
        v_subtotal,
        v_rider_base,
        700,
        v_total::integer,
        v_config.base_delivery_fee,
        v_distance_surcharge,
        v_quote.route_distance_km,
        v_quote.rate_version,
        v_quote.id,
        v_address,
        v_notes,
        v_phone,
        'pending',
        'wallet',
        'unpaid',
        p_checkout_reference
    )
    RETURNING id INTO v_order_id;

    /* 9. Save the validated item snapshots within the same transaction. */
    FOR v_i IN 1..v_item_count LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            name,
            quantity,
            price
        )
        VALUES (
            v_order_id,
            v_item_ids[v_i],
            v_item_names[v_i],
            v_item_quantities[v_i],
            v_item_prices[v_i]
        );
    END LOOP;

    /* 10. Consume the quote only after order, items and insert-trigger snapshots succeed. */
    UPDATE public.delivery_quotes
    SET status = 'consumed',
        consumed_at = now()
    WHERE id = v_quote.id
      AND status = 'quoted'
      AND expires_at > now();

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Delivery quote could not be consumed. Checkout cancelled.';
    END IF;

    -- The existing wallet primitive row-locks the wallet and writes the
    -- completed order_payment ledger entry. Any failure rolls back the order,
    -- item rows, allocation snapshots and quote consumption in this transaction.
    v_wallet_result := public.process_customer_wallet_transaction(
        p_customer_id,
        'debit',
        v_total,
        'mkh-wallet-order:' || p_checkout_reference,
        'MKH Wallet payment for order ' || v_order_id::text
    );

    IF COALESCE((v_wallet_result ->> 'success')::boolean, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'Customer wallet debit did not complete successfully.';
    END IF;

    UPDATE public.orders
       SET payment_status = 'paid'
     WHERE id = v_order_id
       AND payment_method = 'wallet'
       AND payment_status = 'unpaid';

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Wallet order payment status could not be confirmed.';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total', v_total::integer,
        'duplicate', false,
        'delivery_quote_id', v_quote.id,
        'wallet_debited', true
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_wallet_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)
  TO service_role;

COMMIT;

-- READ-ONLY POST-APPLY CHECKS (run after the approved TEST migration):
SELECT proname, pg_get_function_identity_arguments(oid) AS arguments,
       pg_get_function_result(oid) AS result_type
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('create_customer_cod_order_from_quote',
                  'create_customer_wallet_order_from_quote',
                  'mkh_credit_customer_wallet_from_paystack')
ORDER BY proname;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customer_wallet_funding_intents'
ORDER BY ordinal_position;
