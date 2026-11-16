-- MKH grouped / multi-vendor customer checkout.
-- One parent checkout holds one NGN 300 service fee and one payment.
-- Each vendor remains a separate child order with its own delivery quote,
-- delivery fee, delivery allocation snapshot and rider workflow.
--
-- The existing single-vendor COD order creator is deliberately reused for each
-- child. Its vendor/menu/quote/commission/allocation safeguards and triggers
-- therefore remain the authoritative child-order creation path.
--
-- The wallet path creates every child first, performs one wallet debit for the
-- parent total, and marks all children paid inside this same transaction.
-- Any exception rolls back the parent, every child, consumed quote and debit.

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_checkout_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  checkout_reference text NOT NULL UNIQUE,
  payment_method text NOT NULL CHECK (payment_method IN ('wallet', 'cash_on_delivery')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'confirmed', 'completed', 'cancelled')),
  delivery_address text NOT NULL,
  customer_phone text NOT NULL,
  customer_notes text,
  cart_hash text NOT NULL CHECK (length(cart_hash) = 64),
  destination_address_hash text NOT NULL CHECK (length(destination_address_hash) = 64),
  food_subtotal numeric(12,2) NOT NULL CHECK (food_subtotal > 0),
  delivery_fee_total numeric(12,2) NOT NULL CHECK (delivery_fee_total >= 0),
  service_fee numeric(12,2) NOT NULL CHECK (service_fee >= 0),
  total numeric(12,2) NOT NULL CHECK (total > 0),
  order_count integer NOT NULL CHECK (order_count BETWEEN 2 AND 10),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_checkout_groups_total_ck
    CHECK (round(food_subtotal + delivery_fee_total + service_fee, 2) = round(total, 2)),
  CONSTRAINT customer_checkout_groups_paid_state_ck
    CHECK ((payment_status = 'paid') = (paid_at IS NOT NULL))
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_group_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_checkout_group_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_checkout_group_id_fkey
      FOREIGN KEY (checkout_group_id)
      REFERENCES public.customer_checkout_groups(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS customer_checkout_groups_customer_created_idx
  ON public.customer_checkout_groups(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_checkout_group_id_idx
  ON public.orders(checkout_group_id)
  WHERE checkout_group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_group_vendor_uidx
  ON public.orders(checkout_group_id, vendor_id)
  WHERE checkout_group_id IS NOT NULL;

ALTER TABLE public.customer_checkout_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_checkout_groups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_checkout_groups TO service_role;

CREATE OR REPLACE FUNCTION public.mkh_create_customer_group_order_from_quotes(
  p_customer_id uuid,
  p_cart jsonb,
  p_delivery_address text,
  p_customer_phone text,
  p_customer_notes text,
  p_checkout_reference text,
  p_quotes jsonb,
  p_cart_hash text,
  p_destination_address_hash text,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_existing_group public.customer_checkout_groups%ROWTYPE;
  v_group_id uuid;
  v_vendor_ids uuid[];
  v_vendor_count integer;
  v_item_count integer := 0;
  v_item_id uuid;
  v_quantity integer;
  v_json_item jsonb;
  v_seen_item_ids uuid[] := ARRAY[]::uuid[];
  v_matched_items integer;
  v_vendor_id uuid;
  v_vendor_cart jsonb;
  v_quote_input jsonb;
  v_quote_id uuid;
  v_quote_cart_hash text;
  v_quote public.delivery_quotes%ROWTYPE;
  v_child_checkout_reference text;
  v_child_wallet_reference text;
  v_child_result jsonb;
  v_child_order_id uuid;
  v_child_total integer;
  v_child_total_sum numeric(12,2) := 0;
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_food_subtotal numeric(12,2) := 0;
  v_delivery_fee_total numeric(12,2) := 0;
  v_service_fee numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_wallet_result jsonb;
  v_rows integer;
  v_index integer := 0;
  v_child_orders jsonb;
BEGIN
  /* 1. Validate the trusted checkout envelope. */
  IF p_customer_id IS NULL OR
     p_checkout_reference IS NULL OR
     p_checkout_reference !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR
     p_payment_method IS NULL OR
     p_payment_method NOT IN ('wallet', 'cash_on_delivery') THEN
    RAISE EXCEPTION 'A valid customer, checkout reference and payment method are required.';
  END IF;

  IF p_cart_hash IS NULL OR p_cart_hash !~ '^[0-9a-fA-F]{64}$' OR
     p_destination_address_hash IS NULL OR p_destination_address_hash !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'Valid basket and delivery-address hashes are required.';
  END IF;

  IF p_quotes IS NULL OR jsonb_typeof(p_quotes) <> 'array' OR
     jsonb_array_length(p_quotes) < 2 OR jsonb_array_length(p_quotes) > 10 THEN
    RAISE EXCEPTION 'A grouped checkout requires quotes for 2 to 10 vendors.';
  END IF;

  IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' OR
     jsonb_array_length(p_cart) < 2 OR jsonb_array_length(p_cart) > 50 THEN
    RAISE EXCEPTION 'The grouped basket must contain between 2 and 50 items.';
  END IF;

  IF btrim(coalesce(p_delivery_address, '')) = '' OR length(p_delivery_address) > 1000 THEN
    RAISE EXCEPTION 'A valid Google Maps delivery address is required.';
  END IF;
  IF btrim(coalesce(p_customer_phone, '')) !~ '^0[0-9]{10}$' THEN
    RAISE EXCEPTION 'Phone number must be exactly 11 digits and start with 0.';
  END IF;
  IF length(coalesce(p_customer_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Customer notes are too long.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_customer_id
      AND lower(coalesce(p.role, '')) = 'customer'
      AND lower(coalesce(p.status, '')) = 'active'
  ) THEN
    RAISE EXCEPTION 'Customer profile is not active or eligible.';
  END IF;

  /* 2. Validate all item IDs and quantities before grouping. */
  FOR v_json_item IN
    SELECT value FROM jsonb_array_elements(p_cart) AS cart(value)
  LOOP
    IF jsonb_typeof(v_json_item) <> 'object' OR
       jsonb_typeof(v_json_item -> 'menu_item_id') <> 'string' OR
       (v_json_item ->> 'menu_item_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR
       jsonb_typeof(v_json_item -> 'quantity') <> 'number' OR
       (v_json_item ->> 'quantity') !~ '^[0-9]{1,2}$' THEN
      RAISE EXCEPTION 'A basket item has an invalid ID or quantity.';
    END IF;

    v_item_id := (v_json_item ->> 'menu_item_id')::uuid;
    v_quantity := (v_json_item ->> 'quantity')::integer;
    IF v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'Item quantity must be between 1 and 99.';
    END IF;
    IF v_item_id = ANY(v_seen_item_ids) THEN
      RAISE EXCEPTION 'Duplicate menu items must be combined.';
    END IF;

    v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);
    v_item_count := v_item_count + 1;
  END LOOP;

  SELECT count(*)::integer,
         array_agg(DISTINCT mi.vendor_id ORDER BY mi.vendor_id)
    INTO v_matched_items, v_vendor_ids
    FROM jsonb_array_elements(p_cart) AS item(value)
    JOIN public.menu_items mi
      ON mi.id = (item.value ->> 'menu_item_id')::uuid;

  IF v_matched_items <> v_item_count OR v_vendor_ids IS NULL THEN
    RAISE EXCEPTION 'One or more menu items no longer exist.';
  END IF;

  v_vendor_count := cardinality(v_vendor_ids);
  IF v_vendor_count < 2 OR v_vendor_count > 10 THEN
    RAISE EXCEPTION 'A grouped checkout must contain between 2 and 10 distinct vendors.';
  END IF;
  IF jsonb_array_length(p_quotes) <> v_vendor_count THEN
    RAISE EXCEPTION 'There must be exactly one delivery quote for every vendor in the basket.';
  END IF;

  /* 3. Serialize retries and return a previously completed parent checkout. */
  PERFORM pg_advisory_xact_lock(hashtextextended(p_checkout_reference, 0));

  SELECT *
    INTO v_existing_group
    FROM public.customer_checkout_groups
   WHERE checkout_reference = p_checkout_reference
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing_group.customer_id IS DISTINCT FROM p_customer_id OR
       v_existing_group.payment_method IS DISTINCT FROM p_payment_method OR
       v_existing_group.delivery_address IS DISTINCT FROM btrim(p_delivery_address) OR
       v_existing_group.customer_phone IS DISTINCT FROM btrim(p_customer_phone) OR
       v_existing_group.customer_notes IS DISTINCT FROM NULLIF(btrim(coalesce(p_customer_notes, '')), '') OR
       v_existing_group.cart_hash IS DISTINCT FROM lower(p_cart_hash) OR
       v_existing_group.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash) THEN
      RAISE EXCEPTION 'Checkout reference already belongs to a different basket or payment attempt.';
    END IF;

    SELECT count(*)::integer INTO v_rows
      FROM public.orders
     WHERE checkout_group_id = v_existing_group.id;

    IF v_rows <> v_existing_group.order_count THEN
      RAISE EXCEPTION 'The previous grouped checkout is incomplete. Please contact MKH support before retrying.';
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'orderId', o.id,
      'orderNumber', o.order_number,
      'vendorId', o.vendor_id,
      'total', o.total,
      'status', o.status
    ) ORDER BY o.created_at, o.id), '[]'::jsonb)
      INTO v_child_orders
      FROM public.orders o
     WHERE o.checkout_group_id = v_existing_group.id;

    RETURN jsonb_build_object(
      'success', true,
      'group_id', v_existing_group.id,
      'order_ids', coalesce((SELECT jsonb_agg(value ->> 'orderId') FROM jsonb_array_elements(v_child_orders)), '[]'::jsonb),
      'orders', v_child_orders,
      'total', v_existing_group.total,
      'service_fee', v_existing_group.service_fee,
      'duplicate', true,
      'payment_method', v_existing_group.payment_method,
      'payment_status', v_existing_group.payment_status
    );
  END IF;

  /* 4. Lock and validate one quote per vendor.
        Quotes are sorted by vendor ID. Exactly the first quote carries NGN 300;
        every other quote must carry zero platform fee. */
  FOREACH v_vendor_id IN ARRAY v_vendor_ids
  LOOP
    v_index := v_index + 1;

    SELECT value
      INTO v_quote_input
      FROM jsonb_array_elements(p_quotes) AS q(value)
     WHERE lower(value ->> 'vendor_id') = v_vendor_id::text;

    IF v_quote_input IS NULL THEN
      RAISE EXCEPTION 'A delivery quote is missing for one vendor in the basket.';
    END IF;

    IF jsonb_typeof(v_quote_input -> 'quote_id') <> 'string' OR
       (v_quote_input ->> 'quote_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR
       jsonb_typeof(v_quote_input -> 'cart_hash') <> 'string' OR
       (v_quote_input ->> 'cart_hash') !~ '^[0-9a-fA-F]{64}$' THEN
      RAISE EXCEPTION 'A vendor delivery quote reference or basket hash is invalid.';
    END IF;

    v_quote_id := (v_quote_input ->> 'quote_id')::uuid;
    v_quote_cart_hash := lower(v_quote_input ->> 'cart_hash');

    SELECT *
      INTO v_quote
      FROM public.delivery_quotes
     WHERE id = v_quote_id
     FOR UPDATE;

    IF NOT FOUND OR
       v_quote.customer_id IS DISTINCT FROM p_customer_id OR
       v_quote.vendor_id IS DISTINCT FROM v_vendor_id OR
       v_quote.cart_hash IS DISTINCT FROM v_quote_cart_hash OR
       v_quote.destination_address_hash IS DISTINCT FROM lower(p_destination_address_hash) OR
       v_quote.status IS DISTINCT FROM 'quoted' OR
       v_quote.expires_at <= now() THEN
      RAISE EXCEPTION 'A vendor delivery quote is missing, expired or does not match this basket.';
    END IF;

    IF v_quote.platform_fee IS DISTINCT FROM
       (CASE WHEN v_index = 1 THEN 300::numeric ELSE 0::numeric END) THEN
      RAISE EXCEPTION 'The grouped service fee must be charged once at NGN 300 for the entire basket.';
    END IF;

    IF v_quote.route_distance_km IS NULL OR
       v_quote.route_distance_km <= 0 OR
       v_quote.route_distance_km > 3 OR
       v_quote.customer_delivery_fee < 1500 OR
       v_quote.rider_payout < 800 OR
       v_quote.fixed_beneficiary_shares IS DISTINCT FROM 700::numeric OR
       v_quote.distance_surcharge IS NULL OR
       v_quote.distance_surcharge < 0 THEN
      RAISE EXCEPTION 'A vendor quote does not satisfy MKH delivery-rate or allocation rules.';
    END IF;

    v_food_subtotal := v_food_subtotal + v_quote.subtotal_amount;
    v_delivery_fee_total := v_delivery_fee_total + v_quote.customer_delivery_fee;
    v_service_fee := v_service_fee + v_quote.platform_fee;
  END LOOP;

  IF v_service_fee IS DISTINCT FROM 300::numeric THEN
    RAISE EXCEPTION 'The parent checkout must contain exactly one NGN 300 service fee.';
  END IF;

  v_total := round(v_food_subtotal + v_delivery_fee_total + v_service_fee, 2);
  IF v_total <= 0 OR v_total > 2147483647 THEN
    RAISE EXCEPTION 'Grouped checkout total is outside the supported range.';
  END IF;

  /* 5. Create the parent group first. Any child or payment failure rolls it back. */
  INSERT INTO public.customer_checkout_groups (
    customer_id,
    checkout_reference,
    payment_method,
    payment_status,
    status,
    delivery_address,
    customer_phone,
    customer_notes,
    cart_hash,
    destination_address_hash,
    food_subtotal,
    delivery_fee_total,
    service_fee,
    total,
    order_count
  )
  VALUES (
    p_customer_id,
    p_checkout_reference,
    p_payment_method,
    'unpaid',
    'created',
    btrim(p_delivery_address),
    btrim(p_customer_phone),
    NULLIF(btrim(coalesce(p_customer_notes, '')), ''),
    lower(p_cart_hash),
    lower(p_destination_address_hash),
    v_food_subtotal,
    v_delivery_fee_total,
    v_service_fee,
    v_total,
    v_vendor_count
  )
  RETURNING id INTO v_group_id;

  /* 6. Create one existing single-vendor child order for each vendor.
        The existing child creator re-prices menu items, validates the quote,
        runs commission snapshots, fee-breakdown trigger and delivery allocation
        snapshot trigger, inserts all order_items and consumes that quote. */
  v_index := 0;
  FOREACH v_vendor_id IN ARRAY v_vendor_ids
  LOOP
    v_index := v_index + 1;

    SELECT value
      INTO v_quote_input
      FROM jsonb_array_elements(p_quotes) AS q(value)
     WHERE lower(value ->> 'vendor_id') = v_vendor_id::text;

    v_quote_id := (v_quote_input ->> 'quote_id')::uuid;
    v_quote_cart_hash := lower(v_quote_input ->> 'cart_hash');

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'menu_item_id', item.value ->> 'menu_item_id',
      'quantity', (item.value ->> 'quantity')::integer
    ) ORDER BY item.value ->> 'menu_item_id'), '[]'::jsonb)
      INTO v_vendor_cart
      FROM jsonb_array_elements(p_cart) AS item(value)
      JOIN public.menu_items mi
        ON mi.id = (item.value ->> 'menu_item_id')::uuid
     WHERE mi.vendor_id = v_vendor_id;

    IF jsonb_array_length(v_vendor_cart) = 0 THEN
      RAISE EXCEPTION 'The grouped basket contains no valid items for a quoted vendor.';
    END IF;

    v_child_checkout_reference := gen_random_uuid()::text;

    v_child_result := public.create_customer_cod_order_from_quote(
      p_customer_id,
      v_vendor_cart,
      btrim(p_delivery_address),
      btrim(p_customer_phone),
      NULLIF(btrim(coalesce(p_customer_notes, '')), ''),
      v_child_checkout_reference,
      v_quote_id,
      v_quote_cart_hash,
      lower(p_destination_address_hash)
    );

    IF coalesce((v_child_result ->> 'success')::boolean, false) IS NOT TRUE OR
       (v_child_result ->> 'order_id') IS NULL THEN
      RAISE EXCEPTION 'A vendor child order could not be created. The grouped checkout has been cancelled.';
    END IF;

    v_child_order_id := (v_child_result ->> 'order_id')::uuid;
    v_child_total := (v_child_result ->> 'total')::integer;
    v_child_total_sum := v_child_total_sum + v_child_total;

    IF p_payment_method = 'wallet' THEN
      v_child_wallet_reference := gen_random_uuid()::text;

      UPDATE public.orders
         SET checkout_group_id = v_group_id,
             payment_method = 'wallet',
             payment_status = 'unpaid',
             cod_checkout_reference = NULL,
             wallet_checkout_reference = v_child_wallet_reference
       WHERE id = v_child_order_id
         AND user_id = p_customer_id
         AND vendor_id = v_vendor_id
         AND payment_method = 'cash_on_delivery'
         AND payment_status = 'unpaid';
    ELSE
      UPDATE public.orders
         SET checkout_group_id = v_group_id
       WHERE id = v_child_order_id
         AND user_id = p_customer_id
         AND vendor_id = v_vendor_id
         AND payment_method = 'cash_on_delivery'
         AND payment_status = 'unpaid';
    END IF;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'A vendor child order could not be attached to the grouped checkout.';
    END IF;

    v_order_ids := array_append(v_order_ids, v_child_order_id);
  END LOOP;

  IF round(v_child_total_sum, 2) IS DISTINCT FROM round(v_total, 2) THEN
    RAISE EXCEPTION
      'Grouped child-order totals do not reconcile to the parent basket total. No payment was taken.';
  END IF;

  /* 7. One wallet debit for the entire basket. Failure rolls every child back. */
  IF p_payment_method = 'wallet' THEN
    v_wallet_result := public.process_customer_wallet_transaction(
      p_customer_id,
      'debit',
      v_total,
      'mkh-wallet-group:' || p_checkout_reference,
      'MKH Wallet payment for grouped basket ' || p_checkout_reference
    );

    IF coalesce((v_wallet_result ->> 'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'The single grouped wallet payment did not complete successfully.';
    END IF;

    UPDATE public.orders
       SET payment_status = 'paid'
     WHERE checkout_group_id = v_group_id
       AND payment_method = 'wallet'
       AND payment_status = 'unpaid';

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_vendor_count THEN
      RAISE EXCEPTION 'Not all vendor orders could be marked as paid. The grouped payment has been rolled back.';
    END IF;

    UPDATE public.customer_checkout_groups
       SET payment_status = 'paid',
           status = 'confirmed',
           paid_at = now(),
           updated_at = now()
     WHERE id = v_group_id;
  ELSE
    UPDATE public.customer_checkout_groups
       SET payment_status = 'unpaid',
           status = 'created',
           updated_at = now()
     WHERE id = v_group_id;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'vendorId', o.vendor_id,
    'total', o.total,
    'status', o.status
  ) ORDER BY o.created_at, o.id), '[]'::jsonb)
    INTO v_child_orders
    FROM public.orders o
   WHERE o.checkout_group_id = v_group_id;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group_id,
    'order_ids', to_jsonb(v_order_ids),
    'orders', v_child_orders,
    'total', v_total,
    'service_fee', v_service_fee,
    'duplicate', false,
    'payment_method', p_payment_method,
    'payment_status', CASE WHEN p_payment_method = 'wallet' THEN 'paid' ELSE 'unpaid' END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_create_customer_group_order_from_quotes(
  uuid, jsonb, text, text, text, text, jsonb, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_create_customer_group_order_from_quotes(
  uuid, jsonb, text, text, text, text, jsonb, text, text, text
) TO service_role;

COMMIT;
