-- MKH Rider Assignment & Dispatch Model v1
-- Permanent home zones, four-rider vendor coverage, nearest-rider offers and
-- auditable TRM-authorised cross-zone dispatch. Existing orders, wallets,
-- payouts, commissions and delivery-allocation triggers are preserved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rider_home_zone_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  home_zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  availability_status text NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available','unavailable')),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignment_reason text NOT NULL CHECK (length(btrim(assignment_reason)) BETWEEN 10 AND 500),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  availability_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rider_home_zone_dates_ck
    CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS rider_home_zone_one_active_uidx
  ON public.rider_home_zone_assignments(rider_id)
  WHERE status='active' AND unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS rider_home_zone_zone_active_idx
  ON public.rider_home_zone_assignments(home_zone_id, status)
  WHERE status='active' AND unassigned_at IS NULL;

CREATE TABLE IF NOT EXISTS public.rider_home_zone_assignment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_zone_id uuid REFERENCES public.zones(id) ON DELETE RESTRICT,
  new_zone_id uuid REFERENCES public.zones(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('assigned','reassigned','unassigned','availability_changed')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rider_home_zone_audit_rider_created_idx
  ON public.rider_home_zone_assignment_audit(rider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rider_dispatch_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  home_zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE RESTRICT,
  vendor_zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE RESTRICT,
  dispatch_mode text NOT NULL CHECK (dispatch_mode IN ('vendor_coverage','trm_cross_zone')),
  distance_meters integer CHECK (distance_meters IS NULL OR distance_meters >= 0),
  offer_status text NOT NULL DEFAULT 'offered'
    CHECK (offer_status IN ('offered','accepted','declined','expired','cancelled','completed')),
  offered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  authorization_reason text,
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 seconds'),
  responded_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rider_dispatch_one_active_order_offer_uidx
  ON public.rider_dispatch_offers(order_id)
  WHERE offer_status IN ('offered','accepted');

CREATE UNIQUE INDEX IF NOT EXISTS rider_dispatch_one_active_rider_offer_uidx
  ON public.rider_dispatch_offers(rider_id)
  WHERE offer_status IN ('offered','accepted');

CREATE INDEX IF NOT EXISTS rider_dispatch_rider_status_idx
  ON public.rider_dispatch_offers(rider_id, offer_status, offered_at DESC);

CREATE INDEX IF NOT EXISTS rider_dispatch_order_history_idx
  ON public.rider_dispatch_offers(order_id, offered_at DESC);

CREATE TABLE IF NOT EXISTS public.rider_dispatch_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES public.rider_dispatch_offers(id) ON DELETE RESTRICT,
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  home_zone_id uuid REFERENCES public.zones(id) ON DELETE RESTRICT,
  vendor_zone_id uuid REFERENCES public.zones(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'automatic_offer','cross_zone_offer','accepted','declined','expired',
    'reassigned','completed','cancelled','availability_changed'
  )),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  reason text,
  distance_meters integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rider_dispatch_audit_order_created_idx
  ON public.rider_dispatch_audit(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rider_dispatch_audit_rider_created_idx
  ON public.rider_dispatch_audit(rider_id, created_at DESC);

-- All new dispatch control tables are server/API-managed. RLS is enabled and
-- direct table access is withheld; service-role APIs invoke constrained RPCs.
ALTER TABLE public.rider_home_zone_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_home_zone_assignment_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_dispatch_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_dispatch_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rider_home_zone_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rider_home_zone_assignment_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rider_dispatch_offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rider_dispatch_audit FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.rider_home_zone_assignments TO service_role;
GRANT SELECT, INSERT ON TABLE public.rider_home_zone_assignment_audit TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rider_dispatch_offers TO service_role;
GRANT SELECT, INSERT ON TABLE public.rider_dispatch_audit TO service_role;

-- Preserve the existing vendor_riders relation as the four-rider vendor
-- coverage group. It is intentionally not repurposed as a home-zone assignment.
-- Backfill home zone only where an existing active vendor-rider relationship
-- identifies exactly one active vendor zone. No legacy assignment is rewritten.
WITH rider_vendor_zones AS (
  SELECT vr.rider_id, min(zv.zone_id::text)::uuid AS zone_id
  FROM public.vendor_riders vr
  JOIN public.zone_vendors zv
    ON zv.vendor_id=vr.vendor_id
   AND zv.status='active'
   AND zv.unassigned_at IS NULL
  JOIN public.zones z ON z.id=zv.zone_id AND z.is_active=true
  JOIN public.profiles p ON p.id=vr.rider_id
  WHERE vr.status='active'
    AND vr.unassigned_at IS NULL
    AND lower(coalesce(p.role,''))='rider'
    AND lower(coalesce(p.status,''))='active'
  GROUP BY vr.rider_id
  HAVING count(DISTINCT zv.zone_id)=1
)
INSERT INTO public.rider_home_zone_assignments (
  rider_id, home_zone_id, status, availability_status, assignment_reason
)
SELECT rider_id, zone_id, 'active', 'available',
       'Backfilled from the rider''s existing active vendor-zone relationship during approved dispatch-model rollout.'
FROM rider_vendor_zones rz
WHERE NOT EXISTS (
  SELECT 1 FROM public.rider_home_zone_assignments h
  WHERE h.rider_id=rz.rider_id AND h.status='active' AND h.unassigned_at IS NULL
);

INSERT INTO public.rider_home_zone_assignment_audit (
  rider_id, previous_zone_id, new_zone_id, action, actor_id, reason
)
SELECT h.rider_id, NULL, h.home_zone_id, 'assigned', NULL,
       'Backfilled from the existing active vendor-zone relationship during approved dispatch-model rollout.'
FROM public.rider_home_zone_assignments h
WHERE h.assigned_at >= now() - interval '5 minutes'
  AND h.status='active'
  AND NOT EXISTS (
    SELECT 1 FROM public.rider_home_zone_assignment_audit a
    WHERE a.rider_id=h.rider_id AND a.new_zone_id=h.home_zone_id
      AND a.action='assigned'
  );

-- Enforce the approved capacity for new activations. Existing legacy capacity
-- exceptions are preserved; the trigger does not delete or deactivate them.
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

  IF TG_OP='UPDATE'
     AND OLD.is_active=true
     AND OLD.territory_id=NEW.territory_id THEN
    RETURN NEW;
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

DROP TRIGGER IF EXISTS trg_mkh_max_six_active_zones ON public.zones;
CREATE TRIGGER trg_mkh_max_six_active_zones
BEFORE INSERT OR UPDATE OF territory_id,is_active ON public.zones
FOR EACH ROW EXECUTE FUNCTION private.mkh_enforce_max_six_active_zones_per_territory();

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

  IF TG_OP='UPDATE'
     AND OLD.status='active'
     AND OLD.unassigned_at IS NULL
     AND OLD.zone_id=NEW.zone_id THEN
    RETURN NEW;
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

DROP TRIGGER IF EXISTS trg_mkh_max_five_active_vendors_per_zone ON public.zone_vendors;
CREATE TRIGGER trg_mkh_max_five_active_vendors_per_zone
BEFORE INSERT OR UPDATE OF zone_id,status,unassigned_at ON public.zone_vendors
FOR EACH ROW EXECUTE FUNCTION private.mkh_enforce_max_five_active_vendors_per_zone();

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
  v_home_zone_id uuid;
  v_coverage_count integer;
BEGIN
  IF NEW.status<>'active' OR NEW.unassigned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP='UPDATE'
     AND OLD.status='active'
     AND OLD.unassigned_at IS NULL
     AND OLD.rider_id=NEW.rider_id
     AND OLD.vendor_id=NEW.vendor_id THEN
    RETURN NEW;
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

  SELECT zv.zone_id INTO v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id=zv.zone_id AND z.is_active=true
  WHERE zv.vendor_id=NEW.vendor_id
    AND zv.status='active'
    AND zv.unassigned_at IS NULL;

  IF NOT FOUND THEN
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

DROP TRIGGER IF EXISTS trg_mkh_four_rider_vendor_coverage ON public.vendor_riders;
CREATE TRIGGER trg_mkh_four_rider_vendor_coverage
BEFORE INSERT OR UPDATE OF vendor_id,rider_id,status,unassigned_at ON public.vendor_riders
FOR EACH ROW EXECUTE FUNCTION private.mkh_enforce_four_rider_vendor_coverage();

-- Common eligibility test: active rider, assigned home zone, rider has opted
-- into availability, GPS updated within 60 seconds and no current delivery or
-- open dispatch offer.
CREATE OR REPLACE FUNCTION private.mkh_rider_is_dispatch_eligible(p_rider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.rider_home_zone_assignments h
      ON h.rider_id=p.id
     AND h.status='active'
     AND h.unassigned_at IS NULL
     AND h.availability_status='available'
    JOIN public.zones z ON z.id=h.home_zone_id AND z.is_active=true
    JOIN public.rider_locations rl ON rl.rider_id=p.id
    WHERE p.id=p_rider_id
      AND lower(coalesce(p.role,''))='rider'
      AND lower(coalesce(p.status,''))='active'
      AND rl.updated_at IS NOT NULL
      AND rl.updated_at >= now() - interval '60 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.rider_id=p.id
          AND o.status IN ('assigned','accepted','picked_up')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers x
        WHERE x.rider_id=p.id AND x.offer_status IN ('offered','accepted')
      )
  );
$function$;

-- Offer the ready vendor order to the closest eligible rider in that vendor's
-- designated coverage group. If no designated rider is available, it remains
-- ready for TRM cross-zone dispatch.
CREATE OR REPLACE FUNCTION private.mkh_offer_nearest_vendor_rider(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_vendor_zone_id uuid;
  v_vendor_lat double precision;
  v_vendor_lng double precision;
  v_candidate record;
  v_offer_id uuid;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id=p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status<>'ready_for_pickup' OR v_order.rider_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Wallet orders must be paid; COD remains test-only and may be unpaid.
  IF coalesce(v_order.payment_status,'')<>'paid'
     AND lower(coalesce(v_order.payment_method,'')) NOT IN ('cash_on_delivery','cod') THEN
    RETURN NULL;
  END IF;

  -- Expired offers are closed before selecting the next candidate.
  UPDATE public.rider_dispatch_offers
  SET offer_status='expired', responded_at=now(), updated_at=now()
  WHERE order_id=p_order_id
    AND offer_status='offered'
    AND expires_at<=now();

  IF EXISTS (
    SELECT 1 FROM public.rider_dispatch_offers
    WHERE order_id=p_order_id AND offer_status IN ('offered','accepted')
  ) THEN
    RETURN NULL;
  END IF;

  SELECT zv.zone_id INTO v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id=zv.zone_id AND z.is_active=true
  WHERE zv.vendor_id=v_order.vendor_id
    AND zv.status='active'
    AND zv.unassigned_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT l.latitude,l.longitude
    INTO v_vendor_lat,v_vendor_lng
  FROM public.vendor_business_locations l
  WHERE l.vendor_id=v_order.vendor_id
    AND l.address_verification_status='verified'
    AND l.locality_match_status='matched'
    AND l.locality_id IS NOT NULL
    AND l.google_place_id IS NOT NULL
    AND l.latitude BETWEEN -90 AND 90
    AND l.longitude BETWEEN -180 AND 180
  ORDER BY l.verified_at DESC NULLS LAST
  LIMIT 1;

  IF v_vendor_lat IS NULL OR v_vendor_lng IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    p.id AS rider_id,
    h.home_zone_id,
    round(6371008.8 * 2 * asin(sqrt(least(1,
      power(sin(radians(rl.latitude-v_vendor_lat)/2),2)
      + cos(radians(v_vendor_lat))*cos(radians(rl.latitude))
        * power(sin(radians(rl.longitude-v_vendor_lng)/2),2)
    ))))::integer AS distance_meters
  INTO v_candidate
  FROM public.vendor_riders vr
  JOIN public.profiles p ON p.id=vr.rider_id
  JOIN public.rider_home_zone_assignments h
    ON h.rider_id=p.id
   AND h.home_zone_id=v_vendor_zone_id
   AND h.status='active'
   AND h.unassigned_at IS NULL
   AND h.availability_status='available'
  JOIN public.rider_locations rl ON rl.rider_id=p.id
  WHERE vr.vendor_id=v_order.vendor_id
    AND vr.status='active'
    AND vr.unassigned_at IS NULL
    AND lower(coalesce(p.role,''))='rider'
    AND lower(coalesce(p.status,''))='active'
    AND rl.updated_at>=now()-interval '60 seconds'
    AND rl.latitude BETWEEN -90 AND 90
    AND rl.longitude BETWEEN -180 AND 180
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.rider_id=p.id
        AND o.status IN ('assigned','accepted','picked_up')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.rider_dispatch_offers prior
      WHERE prior.order_id=p_order_id AND prior.rider_id=p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.rider_dispatch_offers active
      WHERE active.rider_id=p.id AND active.offer_status IN ('offered','accepted')
    )
  ORDER BY distance_meters ASC, rl.updated_at DESC, p.id
  LIMIT 1;

  IF v_candidate.rider_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.rider_dispatch_offers (
    order_id,vendor_id,rider_id,home_zone_id,vendor_zone_id,
    dispatch_mode,distance_meters,offer_status,authorization_reason,
    offered_at,expires_at
  )
  VALUES (
    p_order_id,v_order.vendor_id,v_candidate.rider_id,
    v_candidate.home_zone_id,v_vendor_zone_id,
    'vendor_coverage',v_candidate.distance_meters,'offered',
    'Automatically offered to the nearest eligible rider in the vendor''s designated four-rider coverage group.',
    now(),now()+interval '30 seconds'
  )
  RETURNING id INTO v_offer_id;

  INSERT INTO public.rider_dispatch_audit (
    order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
    action,actor_role,reason,distance_meters
  )
  VALUES (
    p_order_id,v_offer_id,v_candidate.rider_id,
    v_candidate.home_zone_id,v_vendor_zone_id,
    'automatic_offer','system',
    'Nearest eligible vendor-coverage rider selected using fresh GPS and verified vendor coordinates.',
    v_candidate.distance_meters
  );

  RETURN v_offer_id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.mkh_orders_dispatch_status_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
BEGIN
  IF NEW.status='ready_for_pickup'
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.mkh_offer_nearest_vendor_rider(NEW.id);
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

DROP TRIGGER IF EXISTS trg_mkh_auto_offer_ready_vendor_order ON public.orders;
CREATE TRIGGER trg_mkh_auto_offer_ready_vendor_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.mkh_orders_dispatch_status_trigger();

-- Admin assigns a rider's permanent home zone. A rider with active vendor
-- coverage cannot be moved to a different zone until that coverage is changed.
CREATE OR REPLACE FUNCTION public.mkh_admin_assign_rider_home_zone(
  p_actor_id uuid,
  p_rider_id uuid,
  p_zone_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_actor_role text;
  v_rider public.profiles%ROWTYPE;
  v_existing public.rider_home_zone_assignments%ROWTYPE;
  v_previous_zone_id uuid;
  v_zone public.zones%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_rider_id IS NULL OR p_zone_id IS NULL
     OR length(btrim(coalesce(p_reason,'')))<10 OR length(p_reason)>500 THEN
    RAISE EXCEPTION 'Rider, zone and a reason of 10 to 500 characters are required.';
  END IF;

  SELECT upper(coalesce(role,'')) INTO v_actor_role
  FROM public.profiles WHERE id=p_actor_id;
  IF v_actor_role NOT IN ('ADMIN','COO') THEN
    RAISE EXCEPTION 'Only Admin or COO can assign a rider home zone.';
  END IF;

  SELECT * INTO v_rider FROM public.profiles
  WHERE id=p_rider_id
    AND lower(coalesce(role,''))='rider'
    AND lower(coalesce(status,''))='active'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected rider must have an active rider profile.';
  END IF;

  SELECT * INTO v_zone FROM public.zones
  WHERE id=p_zone_id AND is_active=true
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Select an active zone.';
  END IF;

  SELECT * INTO v_existing
  FROM public.rider_home_zone_assignments
  WHERE rider_id=p_rider_id AND status='active' AND unassigned_at IS NULL
  FOR UPDATE;

  v_previous_zone_id := v_existing.home_zone_id;

  IF v_previous_zone_id=p_zone_id THEN
    RETURN jsonb_build_object('success',true,'unchanged',true,'rider_id',p_rider_id,'home_zone_id',p_zone_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vendor_riders vr
    JOIN public.zone_vendors zv
      ON zv.vendor_id=vr.vendor_id
     AND zv.status='active'
     AND zv.unassigned_at IS NULL
    WHERE vr.rider_id=p_rider_id
      AND vr.status='active'
      AND vr.unassigned_at IS NULL
      AND zv.zone_id IS DISTINCT FROM p_zone_id
  ) THEN
    RAISE EXCEPTION 'This rider is part of vendor coverage in another zone. Reconcile vendor coverage before changing the permanent home zone.';
  END IF;

  IF FOUND THEN
    UPDATE public.rider_home_zone_assignments
    SET status='inactive',unassigned_at=now(),updated_at=now()
    WHERE id=v_existing.id;
  END IF;

  INSERT INTO public.rider_home_zone_assignments (
    rider_id,home_zone_id,status,availability_status,assigned_by,
    assignment_reason,assigned_at,availability_updated_at
  )
  VALUES (
    p_rider_id,p_zone_id,'active','available',p_actor_id,
    btrim(p_reason),now(),now()
  );

  INSERT INTO public.rider_home_zone_assignment_audit (
    rider_id,previous_zone_id,new_zone_id,action,actor_id,reason
  )
  VALUES (
    p_rider_id,v_previous_zone_id,p_zone_id,
    CASE WHEN v_previous_zone_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    p_actor_id,btrim(p_reason)
  );

  RETURN jsonb_build_object(
    'success',true,'rider_id',p_rider_id,
    'previous_home_zone_id',v_previous_zone_id,
    'home_zone_id',p_zone_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_admin_update_vendor_rider_coverage(
  p_actor_id uuid,
  p_vendor_id uuid,
  p_rider_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_actor_role text;
  v_vendor_zone_id uuid;
  v_rider_zone_id uuid;
  v_coverage_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_vendor_id IS NULL OR p_rider_id IS NULL
     OR p_action NOT IN ('add','remove')
     OR length(btrim(coalesce(p_reason,'')))<10 OR length(p_reason)>500 THEN
    RAISE EXCEPTION 'Vendor, rider, action and a reason of 10 to 500 characters are required.';
  END IF;

  SELECT upper(coalesce(role,'')) INTO v_actor_role
  FROM public.profiles WHERE id=p_actor_id;
  IF v_actor_role NOT IN ('ADMIN','COO') THEN
    RAISE EXCEPTION 'Only Admin or COO can manage vendor rider coverage.';
  END IF;

  SELECT zv.zone_id INTO v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.vendors v ON v.id=zv.vendor_id AND lower(coalesce(v.status,''))='active'
  JOIN public.zones z ON z.id=zv.zone_id AND z.is_active=true
  WHERE zv.vendor_id=p_vendor_id AND zv.status='active' AND zv.unassigned_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected vendor must have one active zone assignment.';
  END IF;

  IF p_action='add' THEN
    SELECT h.home_zone_id INTO v_rider_zone_id
    FROM public.rider_home_zone_assignments h
    JOIN public.profiles p ON p.id=h.rider_id
    WHERE h.rider_id=p_rider_id
      AND h.status='active'
      AND h.unassigned_at IS NULL
      AND lower(coalesce(p.role,''))='rider'
      AND lower(coalesce(p.status,''))='active';

    IF NOT FOUND OR v_rider_zone_id IS DISTINCT FROM v_vendor_zone_id THEN
      RAISE EXCEPTION 'The rider must be active and permanently assigned to the same home zone as the vendor.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.vendor_riders
      WHERE vendor_id=p_vendor_id AND rider_id=p_rider_id
        AND status='active' AND unassigned_at IS NULL
    ) THEN
      RETURN jsonb_build_object('success',true,'unchanged',true,'vendor_id',p_vendor_id,'rider_id',p_rider_id);
    END IF;

    INSERT INTO public.vendor_riders(vendor_id,rider_id,status,assigned_at,unassigned_at)
    VALUES(p_vendor_id,p_rider_id,'active',now(),NULL)
    RETURNING id INTO v_coverage_id;

    INSERT INTO public.rider_dispatch_audit (
      order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
      action,actor_id,actor_role,reason,details
    )
    SELECT gen_random_uuid(),NULL,p_rider_id,v_rider_zone_id,v_vendor_zone_id,
      'automatic_offer',p_actor_id,'admin',btrim(p_reason),
      jsonb_build_object('event','vendor_coverage_added','vendor_id',p_vendor_id,'coverage_id',v_coverage_id)
    WHERE false;

    RETURN jsonb_build_object('success',true,'coverage_id',v_coverage_id,'vendor_id',p_vendor_id,'rider_id',p_rider_id);
  END IF;

  UPDATE public.vendor_riders
  SET status='inactive',unassigned_at=now()
  WHERE vendor_id=p_vendor_id
    AND rider_id=p_rider_id
    AND status='active'
    AND unassigned_at IS NULL
  RETURNING id INTO v_coverage_id;

  IF v_coverage_id IS NULL THEN
    RAISE EXCEPTION 'No active vendor coverage assignment was found for this rider.';
  END IF;

  RETURN jsonb_build_object('success',true,'removed',true,'coverage_id',v_coverage_id);
END;
$function$;

-- Rider accepts or declines the offer addressed to them. The OTP is created
-- using the existing private delivery OTP table; the existing pickup/delivery
-- RPCs and order-allocation triggers remain unchanged.
CREATE OR REPLACE FUNCTION public.mkh_rider_respond_to_dispatch_offer(
  p_rider_id uuid,
  p_offer_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_offer public.rider_dispatch_offers%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_otp text;
  v_next_offer_id uuid;
BEGIN
  IF p_rider_id IS NULL OR p_offer_id IS NULL OR p_action NOT IN ('accept','decline') THEN
    RAISE EXCEPTION 'A rider, offer and valid response are required.';
  END IF;

  PERFORM 1 FROM public.profiles p
  WHERE p.id=p_rider_id
    AND lower(coalesce(p.role,''))='rider'
    AND lower(coalesce(p.status,''))='active'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active rider account is required.';
  END IF;

  SELECT * INTO v_offer
  FROM public.rider_dispatch_offers
  WHERE id=p_offer_id AND rider_id=p_rider_id
  FOR UPDATE;
  IF NOT FOUND OR v_offer.offer_status<>'offered' THEN
    RAISE EXCEPTION 'This pickup offer is no longer available.';
  END IF;

  IF v_offer.expires_at<=now() THEN
    UPDATE public.rider_dispatch_offers
    SET offer_status='expired',responded_at=now(),updated_at=now()
    WHERE id=v_offer.id;
    PERFORM private.mkh_offer_nearest_vendor_rider(v_offer.order_id);
    RAISE EXCEPTION 'This pickup offer expired. Check for the next offer.';
  END IF;

  IF NOT private.mkh_rider_is_dispatch_eligible(p_rider_id) THEN
    RAISE EXCEPTION 'You must be available, have fresh GPS within 60 seconds and have no other active delivery to accept a pickup.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id=v_offer.order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status<>'ready_for_pickup' OR v_order.rider_id IS NOT NULL THEN
    UPDATE public.rider_dispatch_offers
    SET offer_status='cancelled',responded_at=now(),updated_at=now()
    WHERE id=v_offer.id;
    RAISE EXCEPTION 'The order is no longer waiting for pickup.';
  END IF;

  IF p_action='decline' THEN
    UPDATE public.rider_dispatch_offers
    SET offer_status='declined',responded_at=now(),updated_at=now()
    WHERE id=v_offer.id;

    INSERT INTO public.rider_dispatch_audit (
      order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
      action,actor_id,actor_role,reason,distance_meters
    )
    VALUES(v_offer.order_id,v_offer.id,p_rider_id,v_offer.home_zone_id,v_offer.vendor_zone_id,
      'declined',p_rider_id,'rider','Rider declined the pickup offer.',v_offer.distance_meters);

    v_next_offer_id := private.mkh_offer_nearest_vendor_rider(v_offer.order_id);
    RETURN jsonb_build_object('success',true,'action','declined','next_offer_created',v_next_offer_id IS NOT NULL);
  END IF;

  v_otp := lpad(
    (('x' || substr(replace(gen_random_uuid()::text,'-',''),1,15))::bit(60)::bigint % 10000)::text,
    4,'0'
  );

  INSERT INTO private.delivery_otps (
    order_id,otp_code,failed_attempts,locked_until,verified_at,updated_at
  )
  VALUES(v_offer.order_id,v_otp,0,NULL,NULL,now())
  ON CONFLICT(order_id) DO UPDATE
  SET otp_code=EXCLUDED.otp_code,
      failed_attempts=0,
      locked_until=NULL,
      verified_at=NULL,
      updated_at=now();

  UPDATE public.orders
  SET rider_id=p_rider_id,
      status='accepted',
      delivery_otp=NULL,
      otp_verified=false,
      updated_at=now()
  WHERE id=v_offer.order_id
    AND status='ready_for_pickup'
    AND rider_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The pickup order could not be assigned. Please refresh your Rider Dashboard.';
  END IF;

  UPDATE public.rider_dispatch_offers
  SET offer_status='accepted',responded_at=now(),accepted_at=now(),updated_at=now()
  WHERE id=v_offer.id;

  INSERT INTO public.rider_dispatch_audit (
    order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
    action,actor_id,actor_role,reason,distance_meters
  )
  VALUES(v_offer.order_id,v_offer.id,p_rider_id,v_offer.home_zone_id,v_offer.vendor_zone_id,
    'accepted',p_rider_id,'rider','Rider accepted the pickup offer.',v_offer.distance_meters);

  INSERT INTO public.order_events (
    id,order_id,event_type,title,description,actor_type,actor_id,created_at
  )
  VALUES (
    gen_random_uuid(),v_offer.order_id,'accepted','Rider Accepted Pickup',
    'The designated rider accepted the pickup offer and is proceeding to the vendor.',
    'rider',p_rider_id,now()
  );

  RETURN jsonb_build_object('success',true,'action','accepted','order_id',v_offer.order_id,'status','accepted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_set_dispatch_availability(
  p_rider_id uuid,
  p_availability_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_home_zone_id uuid;
BEGIN
  IF p_rider_id IS NULL OR p_availability_status NOT IN ('available','unavailable') THEN
    RAISE EXCEPTION 'A rider and valid availability state are required.';
  END IF;

  SELECT home_zone_id INTO v_home_zone_id
  FROM public.rider_home_zone_assignments
  WHERE rider_id=p_rider_id AND status='active' AND unassigned_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your permanent home zone has not been assigned. Contact MKH Admin.';
  END IF;

  IF p_availability_status='available' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rider_locations rl
      WHERE rl.rider_id=p_rider_id AND rl.updated_at>=now()-interval '60 seconds'
    ) THEN
      RAISE EXCEPTION 'Update your GPS location before switching to Available.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.rider_id=p_rider_id AND o.status IN ('assigned','accepted','picked_up')
    ) THEN
      RAISE EXCEPTION 'You have an active delivery. Complete it before becoming available.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.rider_dispatch_offers x
      WHERE x.rider_id=p_rider_id AND x.offer_status IN ('offered','accepted')
    ) THEN
      RAISE EXCEPTION 'You have a pickup offer or active assignment. Respond to it before changing availability.';
    END IF;
  ELSE
    UPDATE public.rider_dispatch_offers
    SET offer_status='cancelled',responded_at=now(),updated_at=now()
    WHERE rider_id=p_rider_id AND offer_status='offered';

    INSERT INTO public.rider_dispatch_audit (
      order_id,offer_id,rider_id,home_zone_id,vendor_zone_id,
      action,actor_id,actor_role,reason
    )
    SELECT order_id,id,p_rider_id,home_zone_id,vendor_zone_id,
      'cancelled',p_rider_id,'rider','Rider switched to unavailable.'
    FROM public.rider_dispatch_offers
    WHERE rider_id=p_rider_id
      AND offer_status='cancelled'
      AND responded_at>=now()-interval '2 seconds';
  END IF;

  UPDATE public.rider_home_zone_assignments
  SET availability_status=p_availability_status,
      availability_updated_at=now(),
      updated_at=now()
  WHERE rider_id=p_rider_id
    AND status='active'
    AND unassigned_at IS NULL;

  RETURN jsonb_build_object('success',true,'availability_status',p_availability_status,'home_zone_id',v_home_zone_id);
END;
$function$;

-- TRM may temporarily offer a ready order to an available rider from another
-- zone in the same territory only. Permanent home zone is never modified.
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
  v_trm_employee_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_order_id IS NULL OR p_rider_id IS NULL
     OR length(btrim(coalesce(p_reason,'')))<10 OR length(p_reason)>500 THEN
    RAISE EXCEPTION 'Order, rider and a dispatch reason of 10 to 500 characters are required.';
  END IF;

  SELECT e.id,a.territory_id
  INTO v_trm_employee_id,v_territory_id
  FROM public.mkh_trm_territory_assignments a
  JOIN public.employees e ON e.id=a.employee_id AND e.profile_id=p_actor_id
  WHERE a.status='active'
    AND lower(coalesce(e.status,''))='active'
  ORDER BY a.assigned_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active TRM territory assignment is required for cross-zone dispatch.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders WHERE id=p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status<>'ready_for_pickup' OR v_order.rider_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an unassigned order marked Ready for Pickup can be dispatched across zones.';
  END IF;

  SELECT zv.zone_id INTO v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id=zv.zone_id AND z.is_active=true
  WHERE zv.vendor_id=v_order.vendor_id
    AND zv.status='active'
    AND zv.unassigned_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The order vendor does not have one active zone assignment.';
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

  IF EXISTS (
    SELECT 1 FROM public.rider_locations rl
    WHERE rl.rider_id=p_rider_id AND rl.updated_at>=now()-interval '60 seconds'
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'The selected rider does not have fresh GPS within 60 seconds.';
  END IF;

  IF NOT private.mkh_rider_is_dispatch_eligible(p_rider_id) THEN
    RAISE EXCEPTION 'The selected rider is not available for another delivery.';
  END IF;

  -- Cross-zone deployment is a fallback only. Do not bypass an eligible member
  -- of the vendor's designated coverage group.
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
  ) THEN
    RAISE EXCEPTION 'A designated vendor rider is available. Allow the automatic vendor-coverage offer to be accepted or declined first.';
  END IF;

  SELECT round(6371008.8 * 2 * asin(sqrt(least(1,
      power(sin(radians(rl.latitude-vbl.latitude)/2),2)
      + cos(radians(vbl.latitude))*cos(radians(rl.latitude))
        * power(sin(radians(rl.longitude-vbl.longitude)/2),2)
  ))))::integer
    INTO v_distance
  FROM public.rider_locations rl
  CROSS JOIN LATERAL (
    SELECT latitude,longitude
    FROM public.vendor_business_locations
    WHERE vendor_id=v_order.vendor_id
      AND address_verification_status='verified'
      AND locality_match_status='matched'
      AND google_place_id IS NOT NULL
    ORDER BY verified_at DESC NULLS LAST
    LIMIT 1
  ) vbl
  WHERE rl.rider_id=p_rider_id
    AND rl.updated_at>=now()-interval '60 seconds';

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
    'expires_at',now()+interval '30 seconds'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_refresh_rider_dispatch_queue(p_rider_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_order record;
  v_created integer := 0;
  v_offer_id uuid;
BEGIN
  IF p_rider_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id=p_rider_id AND lower(coalesce(role,''))='rider'
      AND lower(coalesce(status,''))='active'
  ) THEN
    RAISE EXCEPTION 'An active rider account is required.';
  END IF;

  FOR v_order IN
    SELECT DISTINCT o.id
    FROM public.orders o
    JOIN public.vendor_riders vr
      ON vr.vendor_id=o.vendor_id
     AND vr.rider_id=p_rider_id
     AND vr.status='active'
     AND vr.unassigned_at IS NULL
    WHERE o.status='ready_for_pickup'
      AND o.rider_id IS NULL
    ORDER BY o.id
  LOOP
    v_offer_id := private.mkh_offer_nearest_vendor_rider(v_order.id);
    IF v_offer_id IS NOT NULL THEN v_created:=v_created+1; END IF;
  END LOOP;

  RETURN v_created;
END;
$function$;

-- RPC grants: the application server validates the authenticated role and
-- passes the verified profile ID. These routines are not client-callable.
REVOKE ALL ON FUNCTION public.mkh_admin_assign_rider_home_zone(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_update_vendor_rider_coverage(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_respond_to_dispatch_offer(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_set_dispatch_availability(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_trm_dispatch_cross_zone_rider(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_refresh_rider_dispatch_queue(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mkh_admin_assign_rider_home_zone(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_admin_update_vendor_rider_coverage(uuid,uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_rider_respond_to_dispatch_offer(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_rider_set_dispatch_availability(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_trm_dispatch_cross_zone_rider(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_refresh_rider_dispatch_queue(uuid) TO service_role;

REVOKE ALL ON FUNCTION private.mkh_offer_nearest_vendor_rider(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.mkh_rider_is_dispatch_eligible(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.mkh_enforce_max_six_active_zones_per_territory() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.mkh_enforce_max_five_active_vendors_per_zone() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.mkh_enforce_four_rider_vendor_coverage() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.mkh_orders_dispatch_status_trigger() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
