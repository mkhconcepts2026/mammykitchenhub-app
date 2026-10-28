-- MKH Delivery + Payout Finalization (TEST ENVIRONMENT)
--
-- Purpose:
--   1. Capture allocation amounts and at-order TRM/ZM/VHA assignment for NEW
--      orders only, using the active versioned allocation configuration.
--   2. Make complete_my_delivery() run beneficiary staging/posting and the
--      existing rider/vendor settlement atomically when a paid rider order is
--      marked delivered.
--   3. Keep COD cash confirmation in mkh_complete_cod_delivery(), but delegate
--      all payouts to the same complete_my_delivery() finalizer so beneficiary
--      postings are not executed twice.
--
-- No existing orders, wallet balances, payout requests, or ledger rows are
--   modified by installing this migration. Historical orders lacking a snapshot
--   remain blocked until their at-order beneficiary allocation is explicitly
--   reconciled. Do NOT guess VHA assignment at delivery time.

BEGIN;

-- 1. Snapshot NEW orders at order creation, when recipient mappings are unambiguous
--    and already active/verified. If mappings are not ready, the order can still
--    be created, but no allocation snapshot is fabricated; delivery settlement
--    remains blocked until a valid snapshot is provided.
CREATE OR REPLACE FUNCTION public.mkh_prepare_delivery_allocations_after_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
    v_zone_id uuid;
    v_territory_id uuid;
    v_zone_count integer := 0;
    v_trm_count integer := 0;
    v_zm_count integer := 0;
    v_vha_count integer := 0;
    v_vha_assigned_count integer := 0;
    v_trm_profile_id uuid;
    v_zm_profile_id uuid;
    v_vha_profile_id uuid;
    v_base_delivery_fee numeric(12,2);
BEGIN
    IF NEW.vendor_id IS NULL OR NEW.delivery_fee IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT c.base_delivery_fee
      INTO v_base_delivery_fee
      FROM public.delivery_allocation_config_versions c
     WHERE c.status = 'active'
     ORDER BY c.version_number DESC
     LIMIT 1;

    IF NOT FOUND OR v_base_delivery_fee IS NULL
       OR NEW.delivery_fee::numeric < v_base_delivery_fee THEN
        RETURN NEW;
    END IF;

    -- Exactly one active vendor-to-zone mapping is required.
    SELECT COUNT(DISTINCT zv.zone_id)::integer
      INTO v_zone_count
      FROM public.zone_vendors zv
      JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
     WHERE zv.vendor_id = NEW.vendor_id
       AND lower(COALESCE(zv.status, '')) = 'active';

    IF v_zone_count <> 1 THEN
        RETURN NEW;
    END IF;

    SELECT z.id, z.territory_id
      INTO v_zone_id, v_territory_id
      FROM public.zone_vendors zv
      JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
     WHERE zv.vendor_id = NEW.vendor_id
       AND lower(COALESCE(zv.status, '')) = 'active'
     ORDER BY zv.assigned_at DESC NULLS LAST
     LIMIT 1;

    IF v_zone_id IS NULL OR v_territory_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- TRM: resolve from the territory assigned to the order's zone.
    SELECT COUNT(DISTINCT e.profile_id)::integer
      INTO v_trm_count
      FROM public.employees e
      JOIN public.employee_roles er ON er.id = e.role_id
      JOIN public.profiles p ON p.id = e.profile_id
     WHERE e.territory_id = v_territory_id
       AND lower(COALESCE(e.status, '')) = 'active'
       AND lower(COALESCE(e.employment_status, '')) = 'active'
       AND lower(COALESCE(er.status, '')) = 'active'
       AND lower(COALESCE(p.status, '')) = 'active'
       AND regexp_replace(lower(COALESCE(er.system_role, '')), '[^a-z0-9]', '', 'g')
           IN ('trm', 'territory', 'territoryrelationshipmanager');

    IF v_trm_count <> 1 THEN
        RETURN NEW;
    END IF;

    SELECT e.profile_id
      INTO v_trm_profile_id
      FROM public.employees e
      JOIN public.employee_roles er ON er.id = e.role_id
      JOIN public.profiles p ON p.id = e.profile_id
     WHERE e.territory_id = v_territory_id
       AND lower(COALESCE(e.status, '')) = 'active'
       AND lower(COALESCE(e.employment_status, '')) = 'active'
       AND lower(COALESCE(er.status, '')) = 'active'
       AND lower(COALESCE(p.status, '')) = 'active'
       AND regexp_replace(lower(COALESCE(er.system_role, '')), '[^a-z0-9]', '', 'g')
           IN ('trm', 'territory', 'territoryrelationshipmanager')
     LIMIT 1;

    IF NOT EXISTS (
        SELECT 1
          FROM public.delivery_beneficiary_registry b
          JOIN public.wallets w ON w.id = b.wallet_id
         WHERE b.beneficiary_type = 'trm'
           AND b.profile_id = v_trm_profile_id
           AND b.is_active IS TRUE
           AND b.verified_at IS NOT NULL
           AND w.owner_type = 'trm'
           AND w.owner_id = v_trm_profile_id
    ) THEN
        RETURN NEW;
    END IF;

    -- ZM: resolve through the active Zone Manager -> Zone relationship.
    SELECT COUNT(DISTINCT e.profile_id)::integer
      INTO v_zm_count
      FROM public.zonal_manager_zones zmz
      JOIN public.employees e ON e.id = zmz.employee_id
      JOIN public.employee_roles er ON er.id = e.role_id
      JOIN public.profiles p ON p.id = e.profile_id
     WHERE zmz.zone_id = v_zone_id
       AND lower(COALESCE(zmz.status, '')) = 'active'
       AND lower(COALESCE(e.status, '')) = 'active'
       AND lower(COALESCE(e.employment_status, '')) = 'active'
       AND lower(COALESCE(er.status, '')) = 'active'
       AND lower(COALESCE(p.status, '')) = 'active'
       AND regexp_replace(lower(COALESCE(er.system_role, '')), '[^a-z0-9]', '', 'g')
           IN ('zm', 'zonemanager', 'zonalmanager');

    IF v_zm_count <> 1 THEN
        RETURN NEW;
    END IF;

    SELECT e.profile_id
      INTO v_zm_profile_id
      FROM public.zonal_manager_zones zmz
      JOIN public.employees e ON e.id = zmz.employee_id
      JOIN public.employee_roles er ON er.id = e.role_id
      JOIN public.profiles p ON p.id = e.profile_id
     WHERE zmz.zone_id = v_zone_id
       AND lower(COALESCE(zmz.status, '')) = 'active'
       AND lower(COALESCE(e.status, '')) = 'active'
       AND lower(COALESCE(e.employment_status, '')) = 'active'
       AND lower(COALESCE(er.status, '')) = 'active'
       AND lower(COALESCE(p.status, '')) = 'active'
       AND regexp_replace(lower(COALESCE(er.system_role, '')), '[^a-z0-9]', '', 'g')
           IN ('zm', 'zonemanager', 'zonalmanager')
     LIMIT 1;

    IF NOT EXISTS (
        SELECT 1
          FROM public.delivery_beneficiary_registry b
          JOIN public.wallets w ON w.id = b.wallet_id
         WHERE b.beneficiary_type = 'zm'
           AND b.profile_id = v_zm_profile_id
           AND b.is_active IS TRUE
           AND b.verified_at IS NOT NULL
           AND w.owner_type = 'zm'
           AND w.owner_id = v_zm_profile_id
    ) THEN
        RETURN NEW;
    END IF;

    -- VHA must be captured at order creation. If none is attached, NULL tells
    -- the existing preparation function to route the VHA share to MKH Pool.
    -- An assigned but unverified or ambiguous VHA is NOT treated as unassigned.
    SELECT COUNT(DISTINCT e.profile_id)::integer
      INTO v_vha_assigned_count
      FROM public.employees e
      JOIN public.employee_roles er ON er.id = e.role_id
      JOIN public.profiles p ON p.id = e.profile_id
     WHERE e.assigned_vendor_id = NEW.vendor_id
       AND lower(COALESCE(e.status, '')) = 'active'
       AND lower(COALESCE(e.employment_status, '')) = 'active'
       AND lower(COALESCE(er.status, '')) = 'active'
       AND lower(COALESCE(p.status, '')) = 'active'
       AND regexp_replace(lower(COALESCE(er.system_role, '')), '[^a-z0-9]', '', 'g')
           IN ('vha', 'vendorhubagent');

    IF v_vha_assigned_count > 1 THEN
        RETURN NEW;
    ELSIF v_vha_assigned_count = 1 THEN
        SELECT e.profile_id
          INTO v_vha_profile_id
          FROM public.employees e
          JOIN public.employee_roles er ON er.id = e.role_id
          JOIN public.profiles p ON p.id = e.profile_id
         WHERE e.assigned_vendor_id = NEW.vendor_id
           AND lower(COALESCE(e.status, '')) = 'active'
           AND lower(COALESCE(e.employment_status, '')) = 'active'
           AND lower(COALESCE(er.status, '')) = 'active'
           AND lower(COALESCE(p.status, '')) = 'active'
           AND regexp_replace(lower(COALESCE(er.system_role, '')), '[^a-z0-9]', '', 'g')
               IN ('vha', 'vendorhubagent')
         LIMIT 1;

        SELECT COUNT(*)::integer
          INTO v_vha_count
          FROM public.delivery_beneficiary_registry b
          JOIN public.wallets w ON w.id = b.wallet_id
         WHERE b.beneficiary_type = 'vha'
           AND b.profile_id = v_vha_profile_id
           AND b.is_active IS TRUE
           AND b.verified_at IS NOT NULL
           AND w.owner_type = 'vha'
           AND w.owner_id = v_vha_profile_id;

        IF v_vha_count <> 1 THEN
            RETURN NEW;
        END IF;
    ELSE
        v_vha_profile_id := NULL;
    END IF;

    -- This snapshots configuration and at-order recipient IDs only; it does not
    -- credit wallets. Existing snapshots are protected by the function's guard.
    PERFORM public.mkh_prepare_order_delivery_allocations(
        NEW.id,
        v_trm_profile_id,
        v_zm_profile_id,
        v_vha_profile_id
    );

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_prepare_delivery_allocations_after_order_insert()
    FROM PUBLIC, anon, authenticated;

DO $install_allocation_snapshot_trigger$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_trigger t
         WHERE t.tgrelid = 'public.orders'::regclass
           AND t.tgname = 'trg_mkh_prepare_delivery_allocations_after_order_insert'
           AND NOT t.tgisinternal
    ) THEN
        EXECUTE $create_trigger$
            CREATE TRIGGER trg_mkh_prepare_delivery_allocations_after_order_insert
            AFTER INSERT ON public.orders
            FOR EACH ROW
            EXECUTE FUNCTION public.mkh_prepare_delivery_allocations_after_order_insert()
        $create_trigger$;
    END IF;
END;
$install_allocation_snapshot_trigger$;

-- 2. One finalization path for all rider deliveries. For regular paid orders,
-- complete_my_delivery() now checks payment, snapshots and allocation holds,
-- stages/posts the five non-rider beneficiary shares while the order is still
-- picked_up, marks the order delivered, then calls the existing settlement math.
-- The transaction rolls back fully if any posting or core settlement fails.
CREATE OR REPLACE FUNCTION public.complete_my_delivery(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
DECLARE
    v_user_id uuid;
    v_order public.orders%ROWTYPE;
    v_control public.order_delivery_allocation_controls%ROWTYPE;
    v_result jsonb;
    v_reference text;
    v_stage_result jsonb;
    v_posting_result jsonb;
    v_posting_count integer;
    v_posted_count integer;
    v_rider_ledger_count integer;
    v_vendor_ledger_count integer;
    v_platform_ledger_count integer;
    v_delivery_ledger_count integer;
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'Order ID is required.';
    END IF;

    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 9011503));

    SELECT *
      INTO v_order
      FROM public.orders
     WHERE id = p_order_id
     FOR UPDATE;

    IF NOT FOUND OR v_order.rider_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'Order is not assigned to this rider.' USING ERRCODE = '42501';
    END IF;

    -- Idempotent success only when all five beneficiary postings and all four
    -- canonical ledger entries already exist. Any partial historical state is
    -- reported for reconciliation, never silently paid again.
    IF lower(COALESCE(v_order.status, '')) = 'delivered'
       AND lower(COALESCE(v_order.payment_status, '')) = 'paid' THEN
        SELECT COUNT(*)::integer,
               COUNT(*) FILTER (WHERE status = 'posted')::integer
          INTO v_posting_count, v_posted_count
          FROM public.delivery_beneficiary_payout_postings
         WHERE order_id = p_order_id;

        SELECT COUNT(*) FILTER (WHERE entry_type = 'rider_earning')::integer,
               COUNT(*) FILTER (WHERE entry_type = 'vendor_earning')::integer,
               COUNT(*) FILTER (WHERE entry_type = 'platform_revenue')::integer,
               COUNT(*) FILTER (WHERE entry_type = 'delivery_revenue')::integer
          INTO v_rider_ledger_count,
               v_vendor_ledger_count,
               v_platform_ledger_count,
               v_delivery_ledger_count
          FROM public.financial_ledger
         WHERE order_id = p_order_id
           AND status = 'completed';

        IF v_posting_count = 5
           AND v_posted_count = 5
           AND v_rider_ledger_count = 1
           AND v_vendor_ledger_count = 1
           AND v_platform_ledger_count = 1
           AND v_delivery_ledger_count = 1 THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_completed', true,
                'order_id', p_order_id,
                'status', 'delivered',
                'wallets_credited_again', false,
                'message', 'Delivery and settlement are already complete.'
            );
        END IF;

        RAISE EXCEPTION
            'Order is already delivered and paid, but the financial records are incomplete. Reconciliation is required; no duplicate settlement was attempted.';
    END IF;

    IF lower(COALESCE(v_order.status, '')) <> 'picked_up' THEN
        RAISE EXCEPTION 'Order must be picked up before completion. Current status: %.',
            COALESCE(v_order.status, '<NULL>');
    END IF;

    IF lower(COALESCE(v_order.payment_status, '')) <> 'paid' THEN
        RAISE EXCEPTION
            'Payment must be confirmed before delivery settlement. COD orders must use mkh_complete_cod_delivery().';
    END IF;

    IF v_order.otp_verified IS NOT TRUE
       OR NOT EXISTS (
           SELECT 1
             FROM private.delivery_otps d
            WHERE d.order_id = p_order_id
              AND d.verified_at IS NOT NULL
       ) THEN
        RAISE EXCEPTION 'Customer OTP verification required.';
    END IF;

    -- Never append a new payout to a partial/legacy financial state.
    IF EXISTS (
        SELECT 1
          FROM public.financial_ledger l
         WHERE l.order_id = p_order_id
           AND l.status = 'completed'
    ) THEN
        RAISE EXCEPTION
            'Existing financial ledger activity was found before delivery completion. Reconciliation is required.';
    END IF;

    SELECT *
      INTO v_control
      FROM public.order_delivery_allocation_controls
     WHERE order_id = p_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Delivery settlement blocked: this order has no allocation snapshot from order creation. Recipient assignment must not be guessed at delivery time.';
    END IF;

    IF COALESCE(v_control.distance_surcharge, 0) <> 0
       OR COALESCE(v_control.rider_distance_increment, 0) <> 0
       OR v_control.settlement_hold_reason IS NOT NULL THEN
        RAISE EXCEPTION
            'Delivery settlement blocked by unresolved surcharge, rider increment, or settlement hold.';
    END IF;

    v_stage_result := public.mkh_stage_delivery_beneficiary_payouts(p_order_id);
    IF COALESCE((v_stage_result ->> 'success')::boolean, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'Beneficiary payout staging did not complete successfully.';
    END IF;

    v_posting_result := public.mkh_post_delivery_beneficiary_payouts(p_order_id);
    IF COALESCE((v_posting_result ->> 'success')::boolean, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'Beneficiary payout posting did not complete successfully.';
    END IF;

    UPDATE public.orders
       SET status = 'delivered',
           delivered_at = pg_catalog.now()
     WHERE id = p_order_id
       AND rider_id = v_user_id
       AND status = 'picked_up'
       AND otp_verified IS TRUE
       AND lower(COALESCE(payment_status, '')) = 'paid';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Could not complete delivery after payout posting.';
    END IF;

    v_reference := 'MKH-' || upper(replace(gen_random_uuid()::text, '-', ''));
    v_result := public.process_order_settlement(p_order_id, v_reference, NULL);

    IF COALESCE((v_result ->> 'success')::boolean, FALSE) IS NOT TRUE
       OR COALESCE((v_result ->> 'settlement_pending')::boolean, FALSE) IS TRUE THEN
        RAISE EXCEPTION 'Core rider/vendor settlement did not complete successfully.';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'already_completed', false,
        'order_id', p_order_id,
        'status', 'delivered',
        'beneficiary_posting', v_posting_result,
        'settlement', v_result,
        'message', 'Delivery and all configured settlement postings completed successfully.'
    );
END;
$function$;

-- 3. Keep COD cash collection confirmation, but DO NOT call the staging/posting
-- helpers here. complete_my_delivery() owns the shared payout pipeline, avoiding
-- double posting. The entire COD payment + beneficiary + rider/vendor settlement
-- remains one PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.mkh_complete_cod_delivery(
    p_order_id uuid,
    p_cash_collected boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
DECLARE
    v_user_id uuid;
    v_order public.orders%ROWTYPE;
    v_control public.order_delivery_allocation_controls%ROWTYPE;
    v_delivery_result jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF p_cash_collected IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Cash collection must be explicitly confirmed.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 9011503));

    SELECT *
      INTO v_order
      FROM public.orders
     WHERE id = p_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    IF v_order.rider_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'Order is not assigned to this rider.' USING ERRCODE = '42501';
    END IF;

    IF lower(COALESCE(v_order.payment_method, '')) <> 'cash_on_delivery' THEN
        RAISE EXCEPTION 'This function is only for Cash on Delivery orders.';
    END IF;

    -- Retry is idempotent only after the complete payout and core settlement exist.
    IF lower(COALESCE(v_order.status, '')) = 'delivered'
       AND lower(COALESCE(v_order.payment_status, '')) = 'paid' THEN
        v_delivery_result := public.complete_my_delivery(p_order_id);
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'order_id', p_order_id,
            'delivery', v_delivery_result,
            'wallets_credited_again', false,
            'message', 'COD delivery and settlement were already completed.'
        );
    END IF;

    IF lower(COALESCE(v_order.status, '')) <> 'picked_up' THEN
        RAISE EXCEPTION 'Order must be picked up before COD completion. Current status: %.',
            COALESCE(v_order.status, '<NULL>');
    END IF;

    IF lower(COALESCE(v_order.payment_status, '')) <> 'unpaid' THEN
        RAISE EXCEPTION 'COD order is not in the expected unpaid state. Review its payment history.';
    END IF;

    IF v_order.otp_verified IS NOT TRUE
       OR NOT EXISTS (
           SELECT 1
             FROM private.delivery_otps d
            WHERE d.order_id = p_order_id
              AND d.verified_at IS NOT NULL
       ) THEN
        RAISE EXCEPTION 'Verified customer OTP is required.';
    END IF;

    SELECT *
      INTO v_control
      FROM public.order_delivery_allocation_controls
     WHERE order_id = p_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'COD completion blocked: this order has no allocation snapshot from order creation. Recipient assignment must not be guessed at delivery time.';
    END IF;

    IF COALESCE(v_control.distance_surcharge, 0) <> 0
       OR COALESCE(v_control.rider_distance_increment, 0) <> 0
       OR v_control.settlement_hold_reason IS NOT NULL THEN
        RAISE EXCEPTION 'COD completion blocked by an unresolved allocation or settlement hold.';
    END IF;

    UPDATE public.orders
       SET payment_status = 'paid'
     WHERE id = p_order_id
       AND rider_id = v_user_id
       AND status = 'picked_up'
       AND lower(COALESCE(payment_method, '')) = 'cash_on_delivery'
       AND lower(COALESCE(payment_status, '')) = 'unpaid';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'COD payment confirmation could not be recorded.';
    END IF;

    v_delivery_result := public.complete_my_delivery(p_order_id);
    IF COALESCE((v_delivery_result ->> 'success')::boolean, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'COD delivery and settlement did not complete successfully.';
    END IF;

    INSERT INTO public.order_events (
        order_id, event_type, title, description, actor_type, actor_id
    ) VALUES (
        p_order_id,
        'cod_cash_collected',
        'COD Cash Collection Confirmed',
        'Rider confirmed collection of the full COD amount. Payment, beneficiary postings and core settlement completed in one transaction.',
        'rider',
        v_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_completed', false,
        'order_id', p_order_id,
        'payment_status', 'paid',
        'delivery', v_delivery_result,
        'message', 'COD delivery and all configured settlement postings completed successfully.'
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_my_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_my_delivery(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.mkh_complete_cod_delivery(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkh_complete_cod_delivery(uuid, boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Functional completion still requires a valid allocation snapshot with active,
-- verified beneficiary mappings. The trigger does not modify old orders; it only
-- prepares future orders when mapping is complete at the time of order creation.
