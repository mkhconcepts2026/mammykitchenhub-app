BEGIN;

CREATE OR REPLACE FUNCTION public.request_vendor_payout(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_wallet public.vendor_wallets%ROWTYPE;
    v_amount numeric;
    v_payout public.payout_requests%ROWTYPE;
    v_lagos_now timestamp without time zone;
    v_lagos_day integer;
    v_lagos_hour integer;
BEGIN
    IF p_vendor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vendor identity is required.');
    END IF;

    v_lagos_now := timezone('Africa/Lagos', now());
    v_lagos_day := EXTRACT(ISODOW FROM v_lagos_now)::integer;
    v_lagos_hour := EXTRACT(HOUR FROM v_lagos_now)::integer;

    IF NOT ((v_lagos_day = 5 AND v_lagos_hour >= 16) OR v_lagos_day IN (6, 7)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'PAYOUT_WINDOW_CLOSED',
            'message', 'Vendor payout requests are open Friday 4:00 PM through Sunday 11:59 PM Nigeria time.'
        );
    END IF;

    SELECT * INTO v_wallet
      FROM public.vendor_wallets
     WHERE vendor_id = p_vendor_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vendor wallet was not found.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.payout_requests
         WHERE requester_id = p_vendor_id
           AND lower(requester_type) = 'vendor'
           AND lower(COALESCE(status, '')) IN ('pending','approved','processing','transfer_submitted','on_hold')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ACTIVE_PAYOUT_EXISTS',
            'message', 'An existing payout request is still active. Please contact Finance if you need help.'
        );
    END IF;

    v_amount := COALESCE(v_wallet.available_balance, 0)
              + COALESCE(v_wallet.accrued_balance, 0);

    IF v_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'NO_AVAILABLE_BALANCE',
            'message', 'There is no available balance to withdraw.'
        );
    END IF;

    UPDATE public.vendor_wallets
       SET available_balance = 0,
           accrued_balance = 0,
           pending_balance = COALESCE(pending_balance, 0) + v_amount,
           updated_at = now()
     WHERE vendor_id = p_vendor_id;

    INSERT INTO public.payout_requests (
        requester_id, requester_type, amount, status, status_updated_at
    ) VALUES (
        p_vendor_id, 'vendor', v_amount, 'pending', now()
    ) RETURNING * INTO v_payout;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payout request submitted for review.',
        'payout', jsonb_build_object(
            'id', v_payout.id,
            'amount', v_payout.amount,
            'status', v_payout.status,
            'requested_at', v_payout.requested_at
        )
    );
END;
$function$;

COMMIT;