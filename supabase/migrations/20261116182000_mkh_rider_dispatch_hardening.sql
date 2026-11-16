-- Harden the approved MKH rider dispatch workflow:
-- 1) Remove the legacy global pickup-claim RPC from browser roles.
-- 2) Close expired offers before TRM cross-zone replacement.
-- 3) Permit cross-zone fallback only after all designated riders have either
--    been offered/declined/expired or are genuinely occupied/unavailable.
-- 4) Use explicit TG_OP branches for INSERT vs UPDATE trigger safety.

BEGIN;

REVOKE ALL ON FUNCTION public.accept_delivery_order(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_delivery_order(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.mkh_enforce_max_six_active_zones_per_territory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_active_count integer;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF TG_OP='UPDATE' THEN
    IF OLD.is_active=true AND OLD.territory_id=NEW.territory_id THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM 1 FROM public.territories
   WHERE id=NEW.territory_id AND is_active=true
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active territory is required before activating a zone.';
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.zones z
  WHERE z.territory_id=NEW.territory_id
    AND z.is_active=true
    AND (TG_OP='INSERT' OR z.id<>NEW.id);

  IF v_active_count >= 6 THEN
    RAISE EXCEPTION 'A territory may have a maximum of six active zones.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.mkh_enforce_max_five_active_vendors_per_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NEW.status<>'active' OR NEW.unassigned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP='UPDATE' THEN
    IF OLD.status='active' AND OLD.unassigned_at IS NULL AND OLD.zone_id=NEW.zone_id THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM 1 FROM public.zones z
   WHERE z.id=NEW.zone_id AND z.is_active=true
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active zone is required for a vendor assignment.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.zone_vendors zv
  WHERE zv.zone_id=NEW.zone_id
    AND zv.status='active'
    AND zv.unassigned_at IS NULL
    AND (TG_OP='INSERT' OR zv.id<>NEW.id);

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'A zone may have a maximum of five active vendors. Resolve existing capacity exceptions before adding another vendor.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.mkh_enforce_four_rider_vendor_coverage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_rider_role text;
  v_rider_status text;
  v_vendor_status text;
  v_vendor_zone_id uuid;
  v_vendor_zone_count integer;
  v_home_zone_id uuid;
  v_coverage_count integer;
BEGIN
  IF NEW.status<>'active' OR NEW.unassigned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP='UPDATE' THEN
    IF OLD.status='active' AND OLD.unassigned_at IS NULL
       AND OLD.rider_id=NEW.rider_id AND OLD.vendor_id=NEW.vendor_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT lower(coalesce(role,'')),lower(coalesce(status,''))
    INTO v_rider_role,v_rider_status
  FROM public.profiles
  WHERE id=NEW.rider_id
  FOR SHARE;

  IF NOT FOUND OR v_rider_role<>'rider' OR v_rider_status<>'active' THEN
    RAISE EXCEPTION 'Vendor coverage may only include an active rider account.';
  END IF;

  SELECT lower(coalesce(status,'')) INTO v_vendor_status
  FROM public.vendors WHERE id=NEW.vendor_id FOR SHARE;

  IF NOT FOUND OR v_vendor_status<>'active' THEN
    RAISE EXCEPTION 'Vendor coverage may only be assigned to an active vendor.';
  END IF;

  SELECT count(*),min(zv.zone_id)
    INTO v_vendor_zone_count,v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id=zv.zone_id AND z.is_active=true
  WHERE zv.vendor_id=NEW.vendor_id
    AND zv.status='active'
    AND zv.unassigned_at IS NULL;

  IF v_vendor_zone_count<>1 THEN
    RAISE EXCEPTION 'The vendor must have exactly one active zone assignment before rider coverage is added.';
  END IF;

  SELECT h.home_zone_id INTO v_home_zone_id
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id=h.home_zone_id AND z.is_active=true
  WHERE h.rider_id=NEW.rider_id
    AND h.status='active'
    AND h.unassigned_at IS NULL
  FOR SHARE;

  IF NOT FOUND OR v_home_zone_id IS DISTINCT FROM v_vendor_zone_id THEN
    RAISE EXCEPTION 'A vendor''s four designated riders must have the same permanent home zone as that vendor.';
  END IF;

  SELECT count(*) INTO v_coverage_count
  FROM public.vendor_riders vr
  WHERE vr.vendor_id=NEW.vendor_id
    AND vr.status='active'
    AND vr.unassigned_at IS NULL
    AND (TG_OP='INSERT' OR vr.id<>NEW.id);

  IF v_coverage_count >= 4 THEN
    RAISE EXCEPTION 'A vendor may have a maximum of four active designated riders.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.mkh_orders_dispatch_status_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
BEGIN
  IF NEW.status='ready_for_pickup' THEN
    IF TG_OP='INSERT' THEN
      PERFORM private.mkh_offer_nearest_vendor_rider(NEW.id);
    ELSIF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM private.mkh_offer_nearest_vendor_rider(NEW.id);
    END IF;
  END IF;

  IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status='delivered' THEN
      UPDATE public.rider_dispatch_offers
      SET offer_status='completed',completed_at=now(),updated_at=now()
      WHERE order_id=NEW.id AND offer_status='accepted';

      INSERT INTO public.rider_dispatch_audit (
        order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
        action,actor_role,reason
      )
      SELECT order_id,id,rider_id,home_zone_id,vendor_zone_id,
        'completed','system','Order marked delivered; temporary dispatch closed.'
      FROM public.rider_dispatch_offers
      WHERE order_id=NEW.id AND offer_status='completed'
        AND completed_at>=now()-interval '2 seconds'
      ON CONFLICT DO NOTHING;
    ELSIF NEW.status='cancelled' THEN
      UPDATE public.rider_dispatch_offers
      SET offer_status='cancelled',responded_at=now(),updated_at=now()
      WHERE order_id=NEW.id AND offer_status IN ('offered','accepted');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_trm_dispatch_cross_zone_rider(
  p_actor_id uuid,
  p_order_id uuid,
  p_rider_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_vendor_zone_id uuid;
  v_territory_id uuid;
  v_rider_zone_id uuid;
  v_offer_id uuid;
  v_distance integer;
  v_vendor_lat double precision;
  v_vendor_lng double precision;
  v_trm_employee_id uuid;
  v_trm_assignment_count integer;
  v_vendor_zone_count integer;
  v_pending_offer record;
BEGIN
  IF p_actor_id IS NULL OR p_order_id IS NULL OR p_rider_id IS NULL
     OR length(btrim(coalesce(p_reason,'')))<10 OR length(p_reason)>500 THEN
    RAISE EXCEPTION 'Order, rider and a dispatch reason of 10 to 500 characters are required.';
  END IF;

  SELECT count(*)::integer
  INTO v_trm_assignment_count
  FROM public.mkh_trm_territory_assignments a
  JOIN public.employees e ON e.id=a.employee_id AND e.profile_id=p_actor_id
  WHERE a.status='active'
    AND lower(coalesce(e.status,''))='active';

  IF v_trm_assignment_count<>1 THEN
    RAISE EXCEPTION 'Exactly one active TRM territory assignment is required for cross-zone dispatch.';
  END IF;

  SELECT e.id,a.territory_id
  INTO v_trm_employee_id,v_territory_id
  FROM public.mkh_trm_territory_assignments a
  JOIN public.employees e ON e.id=a.employee_id AND e.profile_id=p_actor_id
  WHERE a.status='active'
    AND lower(coalesce(e.status,''))='active'
  LIMIT 1;

  SELECT * INTO v_order
  FROM public.orders WHERE id=p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status<>'ready_for_pickup' OR v_order.rider_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an unassigned order marked Ready for Pickup can be dispatched across zones.';
  END IF;

  IF coalesce(v_order.payment_status,'')<>'paid'
     AND lower(coalesce(v_order.payment_method,'')) NOT IN ('cash_on_delivery','cod') THEN
    RAISE EXCEPTION 'The order must be paid before rider dispatch.';
  END IF;

  -- Expired offers no longer hold the order's unique active-offer slot.
  FOR v_pending_offer IN
    UPDATE public.rider_dispatch_offers
    SET offer_status='expired',responded_at=now(),updated_at=now()
    WHERE order_id=p_order_id
      AND offer_status='offered'
      AND expires_at<=now()
    RETURNING id,rider_id,home_zone_id,vendor_zone_id
  LOOP
    INSERT INTO public.rider_dispatch_audit (
      order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
      action,actor_id,actor_role,reason
    )
    VALUES(
      p_order_id,v_pending_offer.id,v_pending_offer.rider_id,
      v_pending_offer.home_zone_id,v_pending_offer.vendor_zone_id,
      'expired',p_actor_id,'trm','Expired pickup offer closed before cross-zone dispatch.'
    );
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.rider_dispatch_offers
    WHERE order_id=p_order_id AND offer_status IN ('offered','accepted')
  ) THEN
    RAISE EXCEPTION 'A pickup offer is still active. Wait for the rider to respond or for it to expire.';
  END IF;

  SELECT count(*),min(zv.zone_id)
    INTO v_vendor_zone_count,v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id=zv.zone_id AND z.is_active=true
  WHERE zv.vendor_id=v_order.vendor_id
    AND zv.status='active'
    AND zv.unassigned_at IS NULL;

  IF v_vendor_zone_count<>1 THEN
    RAISE EXCEPTION 'The order vendor must have exactly one active zone assignment.';
  END IF;

  IF (SELECT territory_id FROM public.zones WHERE id=v_vendor_zone_id) IS DISTINCT FROM v_territory_id THEN
    RAISE EXCEPTION 'The order is outside your assigned territory.';
  END IF;

  SELECT h.home_zone_id INTO v_rider_zone_id
  FROM public.rider_home_zone_assignments h
  JOIN public.zones rz ON rz.id=h.home_zone_id AND rz.is_active=true
  JOIN public.profiles p ON p.id=h.rider_id
  WHERE h.rider_id=p_rider_id
    AND h.status='active' AND h.unassigned_at IS NULL
    AND h.availability_status='available'
    AND rz.territory_id=v_territory_id
    AND lower(coalesce(p.role,''))='rider'
    AND lower(coalesce(p.status,''))='active'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Select an active available rider whose permanent home zone is within your territory.';
  END IF;

  IF v_rider_zone_id=v_vendor_zone_id THEN
    RAISE EXCEPTION 'This rider belongs to the vendor zone. Use the automatic vendor-coverage dispatch instead.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.rider_locations rl
    WHERE rl.rider_id=p_rider_id AND rl.updated_at>=now()-interval '60 seconds'
  ) THEN
    RAISE EXCEPTION 'The selected rider does not have fresh GPS within 60 seconds.';
  END IF;

  IF NOT private.mkh_rider_is_dispatch_eligible(p_rider_id) THEN
    RAISE EXCEPTION 'The selected rider is not available for another delivery.';
  END IF;

  -- Allow fallback after every designated rider has been offered and declined,
  -- expired or is otherwise not dispatch-eligible.
  IF EXISTS (
    SELECT 1
    FROM public.vendor_riders vr
    JOIN public.rider_home_zone_assignments h ON h.rider_id=vr.rider_id
    JOIN public.rider_locations rl ON rl.rider_id=vr.rider_id
    WHERE vr.vendor_id=v_order.vendor_id
      AND vr.status='active' AND vr.unassigned_at IS NULL
      AND h.status='active' AND h.unassigned_at IS NULL
      AND h.home_zone_id=v_vendor_zone_id
      AND h.availability_status='available'
      AND rl.updated_at>=now()-interval '60 seconds'
      AND private.mkh_rider_is_dispatch_eligible(vr.rider_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers prior
        WHERE prior.order_id=p_order_id AND prior.rider_id=vr.rider_id
      )
  ) THEN
    RAISE EXCEPTION 'A designated vendor rider has not yet received a pickup offer. Allow vendor-coverage dispatch first.';
  END IF;

  SELECT latitude,longitude
  INTO v_vendor_lat,v_vendor_lng
  FROM public.vendor_business_locations
  WHERE vendor_id=v_order.vendor_id
    AND address_verification_status='verified'
    AND locality_match_status='matched'
    AND locality_id IS NOT NULL
    AND google_place_id IS NOT NULL
    AND latitude BETWEEN -90 AND 90
    AND longitude BETWEEN -180 AND 180
  ORDER BY verified_at DESC NULLS LAST
  LIMIT 1;

  IF v_vendor_lat IS NULL OR v_vendor_lng IS NULL THEN
    RAISE EXCEPTION 'The vendor has no Admin-verified Google delivery origin for dispatch distance.';
  END IF;

  SELECT round(6371008.8 * 2 * asin(sqrt(least(1,
      power(sin(radians(rl.latitude-v_vendor_lat)/2),2)
      + cos(radians(v_vendor_lat))*cos(radians(rl.latitude))
        * power(sin(radians(rl.longitude-v_vendor_lng)/2),2)
  ))))::integer
  INTO v_distance
  FROM public.rider_locations rl
  WHERE rl.rider_id=p_rider_id
    AND rl.updated_at>=now()-interval '60 seconds';

  IF v_distance IS NULL THEN
    RAISE EXCEPTION 'The selected rider has no fresh GPS location.';
  END IF;

  INSERT INTO public.rider_dispatch_offers (
    order_id,vendor_id,rider_id,home_zone_id,vendor_zone_id,
    dispatch_mode,distance_meters,offer_status,offered_by,
    authorization_reason,offered_at,expires_at
  )
  VALUES (
    p_order_id,v_order.vendor_id,p_rider_id,v_rider_zone_id,v_vendor_zone_id,
    'trm_cross_zone',v_distance,'offered',p_actor_id,
    btrim(p_reason),now(),now()+interval '30 seconds'
  )
  RETURNING id INTO v_offer_id;

  INSERT INTO public.rider_dispatch_audit (
    order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
    action,actor_id,actor_role,reason,distance_meters,details
  )
  VALUES (
    p_order_id,v_offer_id,p_rider_id,v_rider_zone_id,v_vendor_zone_id,
    'cross_zone_offer',p_actor_id,'trm',btrim(p_reason),v_distance,
    jsonb_build_object('trm_employee_id',v_trm_employee_id,'territory_id',v_territory_id)
  );

  RETURN jsonb_build_object(
    'success',true,'offer_id',v_offer_id,'order_id',p_order_id,
    'rider_id',p_rider_id,'home_zone_id',v_rider_zone_id,
    'vendor_zone_id',v_vendor_zone_id,'dispatch_mode','trm_cross_zone',
    'distance_meters',v_distance,'expires_at',now()+interval '30 seconds'
  );
END;
$function$;

COMMIT;
