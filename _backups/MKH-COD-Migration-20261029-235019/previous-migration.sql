-- MKH Stage 2: consume a trusted delivery quote atomically with a COD test order.
-- Apply to the MKH TEST project only after reviewing and backing up the current schema.
-- This does not enable COD for production or change wallet settlement/payout calculations.

BEGIN;

-- Link a created order to the exact quote used to price it. Existing orders remain NULL.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_quote_id uuid;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_delivery_quote_id_fk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_quote_id_fk
      FOREIGN KEY (delivery_quote_id)
      REFERENCES public.delivery_quotes(id)
      ON DELETE RESTRICT;
  END IF;
END;
$migration$;

-- One quote may be used by at most one order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_delivery_quote_id_uq
  ON public.orders(delivery_quote_id)
  WHERE delivery_quote_id IS NOT NULL;

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
    v_order_result jsonb;
    v_order_id uuid;
    v_total numeric;
    v_rows integer;
BEGIN
    IF p_customer_id IS NULL
       OR p_delivery_quote_id IS NULL
       OR p_checkout_reference IS NULL
       OR p_checkout_reference !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR p_cart_hash IS NULL
       OR p_cart_hash !~ '^[0-9a-fA-F]{64}$'
       OR p_destination_address_hash IS NULL
       OR p_destination_address_hash !~ '^[0-9a-fA-F]{64}$'
    THEN
        RAISE EXCEPTION 'Valid customer, checkout reference, delivery quote and request hashes are required.';
    END IF;

    -- Serialize retries using the same reference as the existing COD order RPC.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_checkout_reference, 0));

    -- Lock the quote so another checkout cannot consume it concurrently.
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

    IF v_quote.cart_hash IS DISTINCT FROM lower(p_cart_hash)
       OR v_quote.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash)
    THEN
        RAISE EXCEPTION 'Cart or delivery address changed. Recalculate delivery before checkout.';
    END IF;

    -- An identical retry returns the original order, including after a page reload
    -- causes the customer to obtain a fresh quote for the same cart and address.
    -- The original COD RPC revalidates customer/contact/cart data below.
    SELECT *
    INTO v_existing
    FROM public.orders
    WHERE cod_checkout_reference = p_checkout_reference
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.delivery_quote_id IS NULL THEN
            RAISE EXCEPTION 'Checkout reference already belongs to an order without a delivery quote. Check your orders before retrying.';
        END IF;

        SELECT *
        INTO v_existing_quote
        FROM public.delivery_quotes
        WHERE id = v_existing.delivery_quote_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The original order quote could not be found. Check your orders before retrying.';
        END IF;

        IF v_existing_quote.customer_id IS DISTINCT FROM p_customer_id
           OR v_existing_quote.status <> 'consumed'
           OR v_existing_quote.consumed_at IS NULL
           OR v_existing_quote.cart_hash IS DISTINCT FROM lower(p_cart_hash)
           OR v_existing_quote.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash)
           OR v_existing.vendor_id IS DISTINCT FROM v_existing_quote.vendor_id
           OR round(COALESCE(v_existing.food_amount, 0)::numeric, 2) <> round(v_existing_quote.subtotal_amount, 2)
           OR round(COALESCE(v_existing.delivery_fee, 0)::numeric, 2) <> round(v_existing_quote.customer_delivery_fee, 2)
           OR round(COALESCE(v_existing.platform_fee, 0)::numeric, 2) <> round(v_existing_quote.platform_fee, 2)
           OR COALESCE(v_existing.total, 0) <> round(
                v_existing_quote.subtotal_amount
                + v_existing_quote.customer_delivery_fee
                + v_existing_quote.platform_fee
              )::integer
        THEN
            RAISE EXCEPTION 'Checkout reference already belongs to a different or incomplete order. Check your orders before retrying.';
        END IF;

        v_order_result := public.create_customer_cod_order(
            p_customer_id,
            p_cart,
            p_delivery_address,
            p_customer_phone,
            p_customer_notes,
            p_checkout_reference
        );

        RETURN v_order_result;
    END IF;

    IF v_quote.status <> 'quoted' OR v_quote.expires_at <= now() THEN
        RAISE EXCEPTION 'Delivery quote has expired or has already been used. Recalculate delivery before checkout.';
    END IF;

    IF v_quote.destination_locality_id IS NULL THEN
        RAISE EXCEPTION 'Delivery quote has no saved MKH locality. Recalculate delivery before checkout.';
    END IF;

    -- Reuse the existing, database-priced and idempotent COD order creation logic.
    -- Any later error in this function rolls back that order and its order items.
    v_order_result := public.create_customer_cod_order(
        p_customer_id,
        p_cart,
        p_delivery_address,
        p_customer_phone,
        p_customer_notes,
        p_checkout_reference
    );

    IF COALESCE((v_order_result ->> 'success')::boolean, false) IS NOT TRUE
       OR NULLIF(v_order_result ->> 'order_id', '') IS NULL
    THEN
        RAISE EXCEPTION 'The existing COD order function did not confirm order creation.';
    END IF;

    v_order_id := (v_order_result ->> 'order_id')::uuid;

    SELECT *
    INTO v_existing
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Created COD order could not be loaded; checkout cancelled.';
    END IF;

    IF v_existing.delivery_quote_id IS NOT NULL
       OR v_existing.vendor_id IS DISTINCT FROM v_quote.vendor_id
       OR round(COALESCE(v_existing.food_amount, 0)::numeric, 2) <> round(v_quote.subtotal_amount, 2)
    THEN
        RAISE EXCEPTION 'The current cart no longer matches the delivery quote; checkout cancelled.';
    END IF;

    v_total := round(
        v_quote.subtotal_amount
        + v_quote.customer_delivery_fee
        + v_quote.platform_fee
    );

    IF v_total <= 0 OR v_total > 2147483647 THEN
        RAISE EXCEPTION 'Quoted order total is outside the supported range.';
    END IF;

    -- Store the exact customer-facing fee snapshot from the quote.
    -- Existing rider_amount/mkh_amount allocation snapshots are deliberately
    -- not recalculated here; payout allocation rules remain a separate approval.
    UPDATE public.orders
    SET delivery_quote_id = v_quote.id,
        delivery_fee = v_quote.customer_delivery_fee,
        platform_fee = v_quote.platform_fee,
        total = v_total::integer
    WHERE id = v_order_id
      AND delivery_quote_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Could not attach the delivery quote to the order; checkout cancelled.';
    END IF;

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

-- The legacy function has no quote parameter. Keep it server-only so clients cannot
-- bypass the quote-aware endpoint and create an order at the old hard-coded price.
REVOKE EXECUTE ON FUNCTION public.create_customer_cod_order(
    uuid, jsonb, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_cod_order(
    uuid, jsonb, text, text, text, text
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_customer_cod_order_from_quote(
    uuid, jsonb, text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_cod_order_from_quote(
    uuid, jsonb, text, text, text, text, uuid, text, text
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Read-only verification in MKH TEST after applying:
-- SELECT to_regclass('public.orders') AS orders_table,
--        to_regclass('public.delivery_quotes') AS delivery_quotes_table;
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_quote_id';
-- SELECT has_function_privilege('anon',
--   'public.create_customer_cod_order(uuid,jsonb,text,text,text,text)', 'EXECUTE') AS anon_can_call_legacy_cod,
--        has_function_privilege('service_role',
--   'public.create_customer_cod_order_from_quote(uuid,jsonb,text,text,text,text,uuid,text,text)', 'EXECUTE') AS service_role_can_call_quote_cod;
