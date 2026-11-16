-- MKH Rider Assignment & Dispatch Model v1.0
-- Additive rollout only. Existing vendor links remain unverified until Admin review.
-- No existing vendor, order, rider, wallet, payout or financial records are moved/deleted.

BEGIN;

ALTER TABLE public.vendor_riders
  ADD COLUMN IF NOT EXISTS coverage_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coverage_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS coverage_verified_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS coverage_verification_reason text;

COMMENT ON COLUMN public.vendor_riders.coverage_verified IS
  'True only after Admin/Operations explicitly confirms this relationship as part of the four-rider vendor coverage group. Legacy rows default false.';

-- Preserve existing audit actions and allow explicit legacy verification/removal events.
ALTER TABLE public.vendor_rider_coverage_audit
  DROP CONSTRAINT IF EXISTS vendor_rider_coverage_audit_action_check;
ALTER TABLE public.vendor_rider_coverage_audit
  ADD CONSTRAINT vendor_rider_coverage_audit_action_check
  CHECK (action = ANY (ARRAY[
    'assigned'::text,
    'unassigned'::text,
    'legacy_link_verified'::text,
    'removed'::text
  ]));

CREATE UNIQUE INDEX IF NOT EXISTS vendor_riders_one_verified_vendor_per_rider_uidx
  ON public.vendor_riders (rider_id)
  WHERE status = 'active'
    AND unassigned_at IS NULL
    AND coverage_verified IS TRUE;

-- Validate only confirmed coverage rows; legacy rows are retained but are not dispatchable.
CREATE OR REPLACE FUNCTION private.mkh_enforce_four_rider_vendor_coverage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
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
  IF NEW.status <> 'active'
     OR NEW.unassigned_at IS NOT NULL
     OR NEW.coverage_verified IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active'
       AND OLD.unassigned_at IS NULL
       AND OLD.rider_id = NEW.rider_id
       AND OLD.vendor_id = NEW.vendor_id
       AND OLD.coverage_verified IS NOT DISTINCT FROM NEW.coverage_verified THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT lower(coalesce(role, '')), lower(coalesce(status, ''))
    INTO v_rider_role, v_rider_status
  FROM public.profiles
  WHERE id = NEW.rider_id
  FOR SHARE;

  IF NOT FOUND OR v_rider_role <> 'rider' OR v_rider_status <> 'active' THEN
    RAISE EXCEPTION 'Vendor coverage may only include an active rider account.';
  END IF;

  SELECT lower(coalesce(status, ''))
    INTO v_vendor_status
  FROM public.vendors
  WHERE id = NEW.vendor_id
  FOR UPDATE;

  IF NOT FOUND OR v_vendor_status <> 'active' THEN
    RAISE EXCEPTION 'Vendor coverage may only be assigned to an active vendor.';
  END IF;

  SELECT count(*), (array_agg(zv.zone_id))[1]
    INTO v_vendor_zone_count, v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active = true
  WHERE zv.vendor_id = NEW.vendor_id
    AND zv.status = 'active'
    AND zv.unassigned_at IS NULL;

  IF v_vendor_zone_count <> 1 THEN
    RAISE EXCEPTION 'The vendor must have exactly one active zone assignment before rider coverage is added.';
  END IF;

  SELECT h.home_zone_id
    INTO v_home_zone_id
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id = h.home_zone_id AND z.is_active = true
  WHERE h.rider_id = NEW.rider_id
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  FOR SHARE;

  IF NOT FOUND OR v_home_zone_id IS DISTINCT FROM v_vendor_zone_id THEN
    RAISE EXCEPTION 'A vendor''s four designated riders must have the same permanent home zone as that vendor.';
  END IF;

  SELECT count(*)
    INTO v_coverage_count
  FROM public.vendor_riders vr
  WHERE vr.vendor_id = NEW.vendor_id
    AND vr.status = 'active'
    AND vr.unassigned_at IS NULL
    AND vr.coverage_verified IS TRUE
    AND (TG_OP = 'INSERT' OR vr.id <> NEW.id);

  IF v_coverage_count >= 4 THEN
    RAISE EXCEPTION 'A vendor may have a maximum of four active designated riders.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mkh_four_rider_vendor_coverage ON public.vendor_riders;
CREATE TRIGGER trg_mkh_four_rider_vendor_coverage
BEFORE INSERT OR UPDATE OF vendor_id, rider_id, status, unassigned_at, coverage_verified
ON public.vendor_riders
FOR EACH ROW
EXECUTE FUNCTION private.mkh_enforce_four_rider_vendor_coverage();

-- Keep the existing dispatch algorithms, but exclude unverified legacy links.
DO $patch$
DECLARE
  v_definition text;
  v_original text;
  v_target regprocedure;
BEGIN
  v_target := 'private.mkh_offer_nearest_vendor_rider(uuid)'::regprocedure;
  v_original := pg_get_functiondef(v_target);
  IF position('coverage_verified IS TRUE' IN v_original) = 0 THEN
    v_definition := replace(
      v_original,
      'WHERE vr.vendor_id=v_order.vendor_id',
      E'WHERE vr.vendor_id=v_order.vendor_id\n    AND vr.coverage_verified IS TRUE'
    );
    IF v_definition = v_original THEN
      RAISE EXCEPTION 'Could not safely patch the existing vendor-coverage dispatch function.';
    END IF;
    EXECUTE v_definition;
  END IF;

  v_target := 'public.mkh_trm_dispatch_cross_zone_rider(uuid,uuid,uuid,text)'::regprocedure;
  v_original := pg_get_functiondef(v_target);
  IF position('coverage_verified IS TRUE' IN v_original) = 0 THEN
    v_definition := replace(
      v_original,
      'WHERE vr.vendor_id=v_order.vendor_id',
      E'WHERE vr.vendor_id=v_order.vendor_id\n      AND vr.coverage_verified IS TRUE'
    );
    IF v_definition = v_original THEN
      RAISE EXCEPTION 'Could not safely patch the existing TRM cross-zone fallback guard.';
    END IF;
    EXECUTE v_definition;
  END IF;
END;
$patch$;

-- Emit realtime-safe order events when a new targeted pickup offer is created.
-- order_events is already in supabase_realtime; clients can refresh without direct access to dispatch tables.
DO $realtime$
DECLARE
  v_target regprocedure;
  v_original text;
  v_definition text;
BEGIN
  v_target := 'private.mkh_offer_nearest_vendor_rider(uuid)'::regprocedure;
  v_original := pg_get_functiondef(v_target);
  IF position('rider_dispatch_offer' IN v_original) = 0 THEN
    v_definition := replace(
      v_original,
      E'  RETURN v_offer_id;\nEND;\n$function without deactivating existing over-capacity records.
CREATE OR REPLACE FUNCTION private.mkh_enforce_rider_model_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF TG_TABLE_NAME = 'zones' THEN
    IF NEW.is_active IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.is_active IS TRUE
       AND OLD.territory_id = NEW.territory_id THEN
      RETURN NEW;
    END IF;

    PERFORM 1
    FROM public.territories
    WHERE id = NEW.territory_id
    FOR UPDATE;

    SELECT count(*)::integer
      INTO v_count
    FROM public.zones z
    WHERE z.territory_id = NEW.territory_id
      AND z.is_active IS TRUE
      AND (TG_OP = 'INSERT' OR z.id <> NEW.id);

    IF v_count >= 6 THEN
      RAISE EXCEPTION 'A territory may have a maximum of six active zones.';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'zone_vendors' THEN
    IF NEW.status <> 'active' OR NEW.unassigned_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.status = 'active'
       AND OLD.unassigned_at IS NULL
       AND OLD.zone_id = NEW.zone_id
       AND OLD.vendor_id = NEW.vendor_id THEN
      RETURN NEW;
    END IF;

    PERFORM 1
    FROM public.zones
    WHERE id = NEW.zone_id
    FOR UPDATE;

    SELECT count(*)::integer
      INTO v_count
    FROM public.zone_vendors zv
    WHERE zv.zone_id = NEW.zone_id
      AND zv.status = 'active'
      AND zv.unassigned_at IS NULL
      AND (TG_OP = 'INSERT' OR zv.id <> NEW.id);

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'A zone may have a maximum of five active vendors. Existing capacity exceptions require management reconciliation.';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mkh_enforce_six_active_zones ON public.zones;
CREATE TRIGGER trg_mkh_enforce_six_active_zones
BEFORE INSERT OR UPDATE OF territory_id, is_active
ON public.zones
FOR EACH ROW
EXECUTE FUNCTION private.mkh_enforce_rider_model_capacity();

DROP TRIGGER IF EXISTS trg_mkh_enforce_five_active_vendors_per_zone ON public.zone_vendors;
CREATE TRIGGER trg_mkh_enforce_five_active_vendors_per_zone
BEFORE INSERT OR UPDATE OF vendor_id, zone_id, status, unassigned_at
ON public.zone_vendors
FOR EACH ROW
EXECUTE FUNCTION private.mkh_enforce_rider_model_capacity();

-- Admin/Operations: read the assignment baseline and manage permanent assignments.
CREATE OR REPLACE FUNCTION public.mkh_admin_get_rider_assignment_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may view rider assignment controls.'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'territories',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'is_active', t.is_active,
        'active_zone_count', (
          SELECT count(*)::integer FROM public.zones z
          WHERE z.territory_id = t.id AND z.is_active IS TRUE
        )
      ) ORDER BY t.name)
      FROM public.territories t
      WHERE t.is_active IS TRUE
    ), '[]'::jsonb),

    'zones',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', z.id,
        'name', z.name,
        'territory_id', z.territory_id,
        'territory_name', t.name,
        'active_vendor_count', (
          SELECT count(*)::integer FROM public.zone_vendors zv
          WHERE zv.zone_id = z.id
            AND zv.status = 'active'
            AND zv.unassigned_at IS NULL
        ),
        'capacity_exception', (
          SELECT count(*) FROM public.zone_vendors zv
          WHERE zv.zone_id = z.id
            AND zv.status = 'active'
            AND zv.unassigned_at IS NULL
        ) > 5
      ) ORDER BY t.name, z.name)
      FROM public.zones z
      JOIN public.territories t ON t.id = z.territory_id
      WHERE z.is_active IS TRUE AND t.is_active IS TRUE
    ), '[]'::jsonb),

    'riders',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'status', p.status,
        'home_zone_id', h.home_zone_id,
        'home_zone_name', z.name,
        'availability_status', h.availability_status,
        'gps_updated_at', rl.updated_at,
        'gps_fresh', coalesce(rl.updated_at >= now() - interval '60 seconds', false),
        'active_order_count', (
          SELECT count(*)::integer FROM public.orders o
          WHERE o.rider_id = p.id
            AND o.status IN ('assigned', 'accepted', 'picked_up')
        ),
        'active_offer_count', (
          SELECT count(*)::integer FROM public.rider_dispatch_offers x
          WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
        ),
        'verified_vendor_ids', coalesce((
          SELECT jsonb_agg(vr.vendor_id)
          FROM public.vendor_riders vr
          WHERE vr.rider_id = p.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS TRUE
        ), '[]'::jsonb)
      ) ORDER BY p.full_name)
      FROM public.profiles p
      LEFT JOIN public.rider_home_zone_assignments h
        ON h.rider_id = p.id AND h.status = 'active' AND h.unassigned_at IS NULL
      LEFT JOIN public.zones z ON z.id = h.home_zone_id
      LEFT JOIN LATERAL (
        SELECT l.updated_at
        FROM public.rider_locations l
        WHERE l.rider_id = p.id
        ORDER BY l.updated_at DESC
        LIMIT 1
      ) rl ON true
      WHERE lower(coalesce(p.role, '')) = 'rider'
        AND lower(coalesce(p.status, '')) = 'active'
    ), '[]'::jsonb),

    'vendors',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'status', v.status,
        'zone_id', z.id,
        'zone_name', z.name,
        'territory_id', t.id,
        'territory_name', t.name,
        'active_vendor_count', (
          SELECT count(*)::integer FROM public.zone_vendors zv2
          WHERE zv2.zone_id = z.id
            AND zv2.status = 'active'
            AND zv2.unassigned_at IS NULL
        ),
        'coverage_count', (
          SELECT count(*)::integer FROM public.vendor_riders vr
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS TRUE
        ),
        'legacy_unverified_count', (
          SELECT count(*)::integer FROM public.vendor_riders vr
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS NOT TRUE
        ),
        'coverage_riders', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'link_id', vr.id,
            'rider_id', rp.id,
            'rider_name', rp.full_name,
            'verified', vr.coverage_verified,
            'assigned_at', vr.assigned_at,
            'verification_reason', vr.coverage_verification_reason
          ) ORDER BY rp.full_name)
          FROM public.vendor_riders vr
          JOIN public.profiles rp ON rp.id = vr.rider_id
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
        ), '[]'::jsonb)
      ) ORDER BY t.name, z.name, v.name)
      FROM public.vendors v
      JOIN public.zone_vendors zv
        ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
      JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
      JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
      WHERE lower(coalesce(v.status, '')) = 'active'
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_admin_set_rider_home_zone(
  p_rider_id uuid,
  p_home_zone_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_previous_zone_id uuid;
  v_assignment_id uuid;
  v_territory_active boolean;
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may change a rider''s permanent home zone.'
      USING ERRCODE = '42501';
  END IF;

  IF p_rider_id IS NULL OR p_home_zone_id IS NULL
     OR length(btrim(coalesce(p_reason, ''))) < 10
     OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'A rider, active home zone and reason of 10 to 500 characters are required.';
  END IF;

  PERFORM 1 FROM public.profiles
  WHERE id = p_rider_id
    AND lower(coalesce(role, '')) = 'rider'
    AND lower(coalesce(status, '')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected rider account is not active.';
  END IF;

  SELECT t.is_active
    INTO v_territory_active
  FROM public.zones z
  JOIN public.territories t ON t.id = z.territory_id
  WHERE z.id = p_home_zone_id AND z.is_active IS TRUE;

  IF NOT FOUND OR v_territory_active IS NOT TRUE THEN
    RAISE EXCEPTION 'The selected home zone and its territory must both be active.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.rider_id = p_rider_id
      AND o.status IN ('assigned', 'accepted', 'picked_up')
  ) OR EXISTS (
    SELECT 1 FROM public.rider_dispatch_offers x
    WHERE x.rider_id = p_rider_id
      AND x.offer_status IN ('offered', 'accepted')
  ) THEN
    RAISE EXCEPTION 'The rider has an active order or dispatch reservation. Release it before changing the permanent home zone.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_riders vr
    WHERE vr.rider_id = p_rider_id
      AND vr.status = 'active'
      AND vr.unassigned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Review or remove the rider''s active vendor coverage link before changing the permanent home zone.';
  END IF;

  SELECT h.home_zone_id, h.id
    INTO v_previous_zone_id, v_assignment_id
  FROM public.rider_home_zone_assignments h
  WHERE h.rider_id = p_rider_id
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  FOR UPDATE;

  IF v_assignment_id IS NOT NULL AND v_previous_zone_id = p_home_zone_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'unchanged',
      'rider_id', p_rider_id,
      'home_zone_id', p_home_zone_id
    );
  END IF;

  IF v_assignment_id IS NOT NULL THEN
    UPDATE public.rider_home_zone_assignments
    SET status = 'inactive',
        unassigned_at = now(),
        updated_at = now()
    WHERE id = v_assignment_id;
  END IF;

  INSERT INTO public.rider_home_zone_assignments (
    rider_id, home_zone_id, status, availability_status,
    assigned_by, assignment_reason, assigned_at, unassigned_at,
    availability_updated_at, created_at, updated_at
  )
  VALUES (
    p_rider_id, p_home_zone_id, 'active', 'unavailable',
    v_actor, btrim(p_reason), now(), NULL, now(), now(), now()
  )
  RETURNING id INTO v_assignment_id;

  INSERT INTO public.rider_home_zone_assignment_audit (
    rider_id, previous_zone_id, new_zone_id, action, actor_id, reason, created_at
  )
  VALUES (
    p_rider_id, v_previous_zone_id, p_home_zone_id,
    CASE WHEN v_previous_zone_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    v_actor, btrim(p_reason), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', CASE WHEN v_previous_zone_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    'rider_id', p_rider_id,
    'previous_zone_id', v_previous_zone_id,
    'home_zone_id', p_home_zone_id,
    'availability_status', 'unavailable'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_admin_set_vendor_rider_coverage(
  p_vendor_id uuid,
  p_rider_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_vendor_zone_id uuid;
  v_vendor_zone_count integer;
  v_rider_home_zone_id uuid;
  v_home_zone_found boolean := false;
  v_link_id uuid;
  v_link_verified boolean;
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may manage vendor rider coverage.'
      USING ERRCODE = '42501';
  END IF;

  IF p_vendor_id IS NULL OR p_rider_id IS NULL
     OR p_action IS NULL
     OR p_action NOT IN ('add', 'verify', 'remove')
     OR length(btrim(coalesce(p_reason, ''))) < 10
     OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Vendor, rider, valid action and reason of 10 to 500 characters are required.';
  END IF;

  SELECT count(*)::integer, (array_agg(zv.zone_id))[1]
    INTO v_vendor_zone_count, v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
  WHERE zv.vendor_id = p_vendor_id
    AND zv.status = 'active'
    AND zv.unassigned_at IS NULL;

  IF v_vendor_zone_count <> 1 THEN
    RAISE EXCEPTION 'The vendor must have exactly one active MKH zone assignment before coverage is managed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND lower(coalesce(v.status, '')) = 'active'
  ) THEN
    RAISE EXCEPTION 'The vendor account is not active.';
  END IF;

  PERFORM 1 FROM public.profiles p
  WHERE p.id = p_rider_id
    AND lower(coalesce(p.role, '')) = 'rider'
    AND lower(coalesce(p.status, '')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected rider account is not active.';
  END IF;

  SELECT h.home_zone_id
    INTO v_rider_home_zone_id
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id = h.home_zone_id AND z.is_active IS TRUE
  WHERE h.rider_id = p_rider_id
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  FOR SHARE;

  v_home_zone_found := FOUND;

  SELECT vr.id, vr.coverage_verified
    INTO v_link_id, v_link_verified
  FROM public.vendor_riders vr
  WHERE vr.vendor_id = p_vendor_id
    AND vr.rider_id = p_rider_id
    AND vr.status = 'active'
    AND vr.unassigned_at IS NULL
  FOR UPDATE;

  IF p_action = 'remove' THEN
    IF v_link_id IS NULL THEN
      RAISE EXCEPTION 'No active vendor coverage link exists for this rider.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.rider_id = p_rider_id
        AND o.status IN ('assigned', 'accepted', 'picked_up')
    ) OR EXISTS (
      SELECT 1 FROM public.rider_dispatch_offers x
      WHERE x.rider_id = p_rider_id
        AND x.offer_status IN ('offered', 'accepted')
    ) THEN
      RAISE EXCEPTION 'The rider has an active order or dispatch reservation. Release it before removing coverage.';
    END IF;

    UPDATE public.vendor_riders
    SET status = 'inactive',
        unassigned_at = now()
    WHERE id = v_link_id;

    INSERT INTO public.vendor_rider_coverage_audit (
      vendor_id, rider_id, action, actor_id, reason, created_at
    )
    VALUES (p_vendor_id, p_rider_id, 'removed', v_actor, btrim(p_reason), now());

    RETURN jsonb_build_object('success', true, 'action', 'removed', 'vendor_id', p_vendor_id, 'rider_id', p_rider_id);
  END IF;

  IF NOT v_home_zone_found OR v_rider_home_zone_id IS DISTINCT FROM v_vendor_zone_id THEN
    RAISE EXCEPTION 'The rider must have a permanent home-zone assignment matching the vendor''s zone before joining its coverage group.';
  END IF;

  IF p_action = 'verify' AND (v_link_id IS NULL OR v_link_verified IS TRUE) THEN
    RAISE EXCEPTION 'Only an existing active unverified legacy link can be verified.';
  END IF;

  IF p_action = 'add' AND v_link_id IS NOT NULL AND v_link_verified IS TRUE THEN
    RAISE EXCEPTION 'This rider is already a verified member of this vendor coverage group.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_riders vr
    WHERE vr.rider_id = p_rider_id
      AND vr.vendor_id <> p_vendor_id
      AND vr.status = 'active'
      AND vr.unassigned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This rider already has an active vendor link. Shared coverage is not enabled without a separately recorded Operations approval.';
  END IF;

  IF v_link_id IS NOT NULL THEN
    UPDATE public.vendor_riders
    SET coverage_verified = true,
        coverage_verified_at = now(),
        coverage_verified_by = v_actor,
        coverage_verification_reason = btrim(p_reason)
    WHERE id = v_link_id;
  ELSE
    INSERT INTO public.vendor_riders (
      vendor_id, rider_id, status, assigned_at, unassigned_at, created_at,
      coverage_verified, coverage_verified_at, coverage_verified_by,
      coverage_verification_reason
    )
    VALUES (
      p_vendor_id, p_rider_id, 'active', now(), NULL, now(),
      true, now(), v_actor, btrim(p_reason)
    )
    RETURNING id INTO v_link_id;
  END IF;

  INSERT INTO public.vendor_rider_coverage_audit (
    vendor_id, rider_id, action, actor_id, reason, created_at
  )
  VALUES (
    p_vendor_id, p_rider_id,
    CASE WHEN v_link_verified IS FALSE THEN 'legacy_link_verified' ELSE 'assigned' END,
    v_actor, btrim(p_reason), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', CASE WHEN v_link_verified IS FALSE THEN 'verified' ELSE 'assigned' END,
    'vendor_id', p_vendor_id,
    'rider_id', p_rider_id,
    'coverage_link_id', v_link_id
  );
END;
$function$;

-- Rider app: expose only the authenticated rider's current offer and availability.
CREATE OR REPLACE FUNCTION public.mkh_rider_get_my_dispatch_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_home_zone_id uuid;
  v_home_zone_name text;
  v_availability text;
  v_gps_updated_at timestamptz;
  v_offers jsonb;
BEGIN
  IF v_actor IS NULL OR v_role IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.mkh_refresh_rider_dispatch_queue(v_actor);

  SELECT h.home_zone_id, z.name, h.availability_status
    INTO v_home_zone_id, v_home_zone_name, v_availability
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id = h.home_zone_id AND z.is_active IS TRUE
  JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
  WHERE h.rider_id = v_actor
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  LIMIT 1;

  SELECT rl.updated_at
    INTO v_gps_updated_at
  FROM public.rider_locations rl
  WHERE rl.rider_id = v_actor
  ORDER BY rl.updated_at DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'dispatch_mode', x.dispatch_mode,
    'distance_meters', x.distance_meters,
    'offered_at', x.offered_at,
    'expires_at', x.expires_at,
    'order', jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'total', o.total,
      'food_amount', o.food_amount,
      'delivery_fee', o.delivery_fee,
      'platform_fee', o.platform_fee,
      'rider_amount', o.rider_amount,
      'created_at', o.created_at,
      'delivery_address', o.delivery_address,
      'customer_notes', o.customer_notes,
      'payment_status', o.payment_status,
      'profiles', (
        SELECT jsonb_build_object('full_name', cp.full_name, 'email', cp.email, 'phone', cp.phone)
        FROM public.profiles cp
        WHERE cp.id = o.user_id
      ),
      'vendors', jsonb_build_object('name', v.name, 'location', v.location)
    )
  ) ORDER BY x.offered_at), '[]'::jsonb)
    INTO v_offers
  FROM public.rider_dispatch_offers x
  JOIN public.orders o ON o.id = x.order_id
  JOIN public.vendors v ON v.id = x.vendor_id
  WHERE x.rider_id = v_actor
    AND x.offer_status = 'offered'
    AND x.expires_at > now()
    AND o.status = 'ready_for_pickup'
    AND o.rider_id IS NULL;

  RETURN jsonb_build_object(
    'home_zone_id', v_home_zone_id,
    'home_zone_name', v_home_zone_name,
    'availability_status', coalesce(v_availability, 'unassigned'),
    'gps_updated_at', v_gps_updated_at,
    'gps_fresh', coalesce(v_gps_updated_at >= now() - interval '60 seconds', false),
    'offers', v_offers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(
  p_offer_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_rider_respond_to_dispatch_offer(v_actor, p_offer_id, p_action);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_set_my_dispatch_availability(
  p_availability_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_rider_set_dispatch_availability(v_actor, p_availability_status);
END;
$function$;

-- TRM: return only the authenticated TRM's assigned territory and allow only temporary cross-zone dispatch.
CREATE OR REPLACE FUNCTION public.mkh_trm_get_dispatch_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_assignment_count integer;
  v_territory_id uuid;
  v_territory_name text;
  v_zones jsonb;
  v_riders jsonb;
  v_vendors jsonb;
  v_ready_orders jsonb;
  v_active_offers jsonb;
BEGIN
  IF v_actor IS NULL OR v_role IS DISTINCT FROM 'TERRITORY' THEN
    RAISE EXCEPTION 'An authenticated Territory Relationship Manager account is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer, (array_agg(a.territory_id))[1]
    INTO v_assignment_count, v_territory_id
  FROM public.mkh_trm_territory_assignments a
  JOIN public.employees e ON e.id = a.employee_id
  JOIN public.profiles p ON p.id = e.profile_id
  WHERE e.profile_id = v_actor
    AND lower(coalesce(e.status, '')) = 'active'
    AND lower(coalesce(p.status, '')) = 'active'
    AND a.status = 'active';

  IF v_assignment_count <> 1 THEN
    RAISE EXCEPTION 'The TRM must have exactly one active territory assignment to manage dispatch.'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_territory_name
  FROM public.territories
  WHERE id = v_territory_id AND is_active IS TRUE;

  IF v_territory_name IS NULL THEN
    RAISE EXCEPTION 'The TRM territory is inactive or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', z.id,
    'name', z.name,
    'active_vendor_count', (
      SELECT count(*)::integer FROM public.zone_vendors zv
      WHERE zv.zone_id = z.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
    )
  ) ORDER BY z.name), '[]'::jsonb)
  INTO v_zones
  FROM public.zones z
  WHERE z.territory_id = v_territory_id AND z.is_active IS TRUE;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'home_zone_id', h.home_zone_id,
    'home_zone_name', z.name,
    'availability_status', h.availability_status,
    'gps_updated_at', rl.updated_at,
    'gps_fresh', coalesce(rl.updated_at >= now() - interval '60 seconds', false),
    'active_order_count', (
      SELECT count(*)::integer FROM public.orders o
      WHERE o.rider_id = p.id AND o.status IN ('assigned', 'accepted', 'picked_up')
    ),
    'active_offer_count', (
      SELECT count(*)::integer FROM public.rider_dispatch_offers x
      WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
    ),
    'dispatch_eligible', (
      h.availability_status = 'available'
      AND rl.updated_at >= now() - interval '60 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.rider_id = p.id AND o.status IN ('assigned', 'accepted', 'picked_up')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers x
        WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
      )
    )
  ) ORDER BY p.full_name), '[]'::jsonb)
  INTO v_riders
  FROM public.profiles p
  JOIN public.rider_home_zone_assignments h
    ON h.rider_id = p.id AND h.status = 'active' AND h.unassigned_at IS NULL
  JOIN public.zones z
    ON z.id = h.home_zone_id AND z.is_active IS TRUE
  JOIN public.territories t
    ON t.id = z.territory_id AND t.is_active IS TRUE
  LEFT JOIN LATERAL (
    SELECT l.updated_at
    FROM public.rider_locations l
    WHERE l.rider_id = p.id
    ORDER BY l.updated_at DESC
    LIMIT 1
  ) rl ON true
  WHERE lower(coalesce(p.role, '')) = 'rider'
    AND lower(coalesce(p.status, '')) = 'active'
    AND t.id = v_territory_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'zone_id', z.id,
    'zone_name', z.name,
    'coverage_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS TRUE
    ),
    'legacy_unverified_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS NOT TRUE
    )
  ) ORDER BY z.name, v.name), '[]'::jsonb)
  INTO v_vendors
  FROM public.vendors v
  JOIN public.zone_vendors zv
    ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  WHERE lower(coalesce(v.status, '')) = 'active'
    AND z.territory_id = v_territory_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'payment_status', o.payment_status,
    'payment_eligible', (
      coalesce(o.payment_status, '') = 'paid'
      OR lower(coalesce(o.payment_method, '')) IN ('cash_on_delivery', 'cod')
    ),
    'vendor_id', v.id,
    'vendor_name', v.name,
    'zone_id', z.id,
    'zone_name', z.name,
    'coverage_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS TRUE
    ),
    'active_offer', (
      SELECT jsonb_build_object(
        'id', x.id,
        'rider_id', x.rider_id,
        'rider_name', rp.full_name,
        'offer_status', x.offer_status,
        'dispatch_mode', x.dispatch_mode,
        'distance_meters', x.distance_meters,
        'expires_at', x.expires_at
      )
      FROM public.rider_dispatch_offers x
      JOIN public.profiles rp ON rp.id = x.rider_id
      WHERE x.order_id = o.id AND x.offer_status IN ('offered', 'accepted')
      ORDER BY x.offered_at DESC
      LIMIT 1
    ),
    'cross_zone_fallback_ready', (
      (
        coalesce(o.payment_status, '') = 'paid'
        OR lower(coalesce(o.payment_method, '')) IN ('cash_on_delivery', 'cod')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers x
        WHERE x.order_id = o.id AND x.offer_status IN ('offered', 'accepted')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.vendor_riders vr
        JOIN public.rider_home_zone_assignments h
          ON h.rider_id = vr.rider_id
         AND h.status = 'active'
         AND h.unassigned_at IS NULL
         AND h.home_zone_id = z.id
         AND h.availability_status = 'available'
        JOIN public.rider_locations rl ON rl.rider_id = vr.rider_id
        WHERE vr.vendor_id = v.id
          AND vr.status = 'active'
          AND vr.unassigned_at IS NULL
          AND vr.coverage_verified IS TRUE
          AND rl.updated_at >= now() - interval '60 seconds'
          AND private.mkh_rider_is_dispatch_eligible(vr.rider_id)
          AND NOT EXISTS (
            SELECT 1 FROM public.rider_dispatch_offers prior
            WHERE prior.order_id = o.id AND prior.rider_id = vr.rider_id
          )
      )
    )
  ) ORDER BY o.created_at), '[]'::jsonb)
  INTO v_ready_orders
  FROM public.orders o
  JOIN public.vendors v ON v.id = o.vendor_id
  JOIN public.zone_vendors zv
    ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  WHERE z.territory_id = v_territory_id
    AND o.status = 'ready_for_pickup'
    AND o.rider_id IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'order_id', x.order_id,
    'order_number', o.order_number,
    'vendor_id', v.id,
    'vendor_name', v.name,
    'rider_id', x.rider_id,
    'rider_name', rp.full_name,
    'home_zone_id', x.home_zone_id,
    'vendor_zone_id', x.vendor_zone_id,
    'dispatch_mode', x.dispatch_mode,
    'distance_meters', x.distance_meters,
    'offer_status', x.offer_status,
    'offered_at', x.offered_at,
    'expires_at', x.expires_at
  ) ORDER BY x.offered_at DESC), '[]'::jsonb)
  INTO v_active_offers
  FROM public.rider_dispatch_offers x
  JOIN public.orders o ON o.id = x.order_id
  JOIN public.vendors v ON v.id = x.vendor_id
  JOIN public.profiles rp ON rp.id = x.rider_id
  JOIN public.zones z ON z.id = x.vendor_zone_id
  WHERE z.territory_id = v_territory_id
    AND x.offer_status IN ('offered', 'accepted');

  RETURN jsonb_build_object(
    'territory_id', v_territory_id,
    'territory_name', v_territory_name,
    'zones', v_zones,
    'riders', v_riders,
    'vendors', v_vendors,
    'ready_orders', v_ready_orders,
    'active_offers', v_active_offers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(
  p_order_id uuid,
  p_rider_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'TERRITORY' THEN
    RAISE EXCEPTION 'Only an authenticated Territory Relationship Manager may request cross-zone dispatch.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_trm_dispatch_cross_zone_rider(v_actor, p_order_id, p_rider_id, p_reason);
END;
$function$;

-- New RPC surface is authenticated only; all identities/roles are derived from auth.uid().
REVOKE ALL ON FUNCTION public.mkh_admin_get_rider_assignment_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_set_rider_home_zone(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_set_vendor_rider_coverage(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_get_my_dispatch_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_set_my_dispatch_availability(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_trm_get_dispatch_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mkh_admin_get_rider_assignment_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_set_rider_home_zone(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_set_vendor_rider_coverage(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_get_my_dispatch_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_set_my_dispatch_availability(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_trm_get_dispatch_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
,
      E'  INSERT INTO public.order_events (id,order_id,event_type,title,description,actor_type,actor_id,created_at)\n  VALUES (gen_random_uuid(),p_order_id,''rider_dispatch_offer'',''Pickup offer created'',''MKH sent a pickup offer to an eligible rider.'',''system'',NULL,now());\n\n  RETURN v_offer_id;\nEND;\n$function without deactivating existing over-capacity records.
CREATE OR REPLACE FUNCTION private.mkh_enforce_rider_model_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF TG_TABLE_NAME = 'zones' THEN
    IF NEW.is_active IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.is_active IS TRUE
       AND OLD.territory_id = NEW.territory_id THEN
      RETURN NEW;
    END IF;

    PERFORM 1
    FROM public.territories
    WHERE id = NEW.territory_id
    FOR UPDATE;

    SELECT count(*)::integer
      INTO v_count
    FROM public.zones z
    WHERE z.territory_id = NEW.territory_id
      AND z.is_active IS TRUE
      AND (TG_OP = 'INSERT' OR z.id <> NEW.id);

    IF v_count >= 6 THEN
      RAISE EXCEPTION 'A territory may have a maximum of six active zones.';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'zone_vendors' THEN
    IF NEW.status <> 'active' OR NEW.unassigned_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.status = 'active'
       AND OLD.unassigned_at IS NULL
       AND OLD.zone_id = NEW.zone_id
       AND OLD.vendor_id = NEW.vendor_id THEN
      RETURN NEW;
    END IF;

    PERFORM 1
    FROM public.zones
    WHERE id = NEW.zone_id
    FOR UPDATE;

    SELECT count(*)::integer
      INTO v_count
    FROM public.zone_vendors zv
    WHERE zv.zone_id = NEW.zone_id
      AND zv.status = 'active'
      AND zv.unassigned_at IS NULL
      AND (TG_OP = 'INSERT' OR zv.id <> NEW.id);

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'A zone may have a maximum of five active vendors. Existing capacity exceptions require management reconciliation.';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mkh_enforce_six_active_zones ON public.zones;
CREATE TRIGGER trg_mkh_enforce_six_active_zones
BEFORE INSERT OR UPDATE OF territory_id, is_active
ON public.zones
FOR EACH ROW
EXECUTE FUNCTION private.mkh_enforce_rider_model_capacity();

DROP TRIGGER IF EXISTS trg_mkh_enforce_five_active_vendors_per_zone ON public.zone_vendors;
CREATE TRIGGER trg_mkh_enforce_five_active_vendors_per_zone
BEFORE INSERT OR UPDATE OF vendor_id, zone_id, status, unassigned_at
ON public.zone_vendors
FOR EACH ROW
EXECUTE FUNCTION private.mkh_enforce_rider_model_capacity();

-- Admin/Operations: read the assignment baseline and manage permanent assignments.
CREATE OR REPLACE FUNCTION public.mkh_admin_get_rider_assignment_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may view rider assignment controls.'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'territories',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'is_active', t.is_active,
        'active_zone_count', (
          SELECT count(*)::integer FROM public.zones z
          WHERE z.territory_id = t.id AND z.is_active IS TRUE
        )
      ) ORDER BY t.name)
      FROM public.territories t
      WHERE t.is_active IS TRUE
    ), '[]'::jsonb),

    'zones',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', z.id,
        'name', z.name,
        'territory_id', z.territory_id,
        'territory_name', t.name,
        'active_vendor_count', (
          SELECT count(*)::integer FROM public.zone_vendors zv
          WHERE zv.zone_id = z.id
            AND zv.status = 'active'
            AND zv.unassigned_at IS NULL
        ),
        'capacity_exception', (
          SELECT count(*) FROM public.zone_vendors zv
          WHERE zv.zone_id = z.id
            AND zv.status = 'active'
            AND zv.unassigned_at IS NULL
        ) > 5
      ) ORDER BY t.name, z.name)
      FROM public.zones z
      JOIN public.territories t ON t.id = z.territory_id
      WHERE z.is_active IS TRUE AND t.is_active IS TRUE
    ), '[]'::jsonb),

    'riders',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'status', p.status,
        'home_zone_id', h.home_zone_id,
        'home_zone_name', z.name,
        'availability_status', h.availability_status,
        'gps_updated_at', rl.updated_at,
        'gps_fresh', coalesce(rl.updated_at >= now() - interval '60 seconds', false),
        'active_order_count', (
          SELECT count(*)::integer FROM public.orders o
          WHERE o.rider_id = p.id
            AND o.status IN ('assigned', 'accepted', 'picked_up')
        ),
        'active_offer_count', (
          SELECT count(*)::integer FROM public.rider_dispatch_offers x
          WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
        ),
        'verified_vendor_ids', coalesce((
          SELECT jsonb_agg(vr.vendor_id)
          FROM public.vendor_riders vr
          WHERE vr.rider_id = p.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS TRUE
        ), '[]'::jsonb)
      ) ORDER BY p.full_name)
      FROM public.profiles p
      LEFT JOIN public.rider_home_zone_assignments h
        ON h.rider_id = p.id AND h.status = 'active' AND h.unassigned_at IS NULL
      LEFT JOIN public.zones z ON z.id = h.home_zone_id
      LEFT JOIN LATERAL (
        SELECT l.updated_at
        FROM public.rider_locations l
        WHERE l.rider_id = p.id
        ORDER BY l.updated_at DESC
        LIMIT 1
      ) rl ON true
      WHERE lower(coalesce(p.role, '')) = 'rider'
        AND lower(coalesce(p.status, '')) = 'active'
    ), '[]'::jsonb),

    'vendors',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'status', v.status,
        'zone_id', z.id,
        'zone_name', z.name,
        'territory_id', t.id,
        'territory_name', t.name,
        'active_vendor_count', (
          SELECT count(*)::integer FROM public.zone_vendors zv2
          WHERE zv2.zone_id = z.id
            AND zv2.status = 'active'
            AND zv2.unassigned_at IS NULL
        ),
        'coverage_count', (
          SELECT count(*)::integer FROM public.vendor_riders vr
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS TRUE
        ),
        'legacy_unverified_count', (
          SELECT count(*)::integer FROM public.vendor_riders vr
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS NOT TRUE
        ),
        'coverage_riders', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'link_id', vr.id,
            'rider_id', rp.id,
            'rider_name', rp.full_name,
            'verified', vr.coverage_verified,
            'assigned_at', vr.assigned_at,
            'verification_reason', vr.coverage_verification_reason
          ) ORDER BY rp.full_name)
          FROM public.vendor_riders vr
          JOIN public.profiles rp ON rp.id = vr.rider_id
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
        ), '[]'::jsonb)
      ) ORDER BY t.name, z.name, v.name)
      FROM public.vendors v
      JOIN public.zone_vendors zv
        ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
      JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
      JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
      WHERE lower(coalesce(v.status, '')) = 'active'
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_admin_set_rider_home_zone(
  p_rider_id uuid,
  p_home_zone_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_previous_zone_id uuid;
  v_assignment_id uuid;
  v_territory_active boolean;
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may change a rider''s permanent home zone.'
      USING ERRCODE = '42501';
  END IF;

  IF p_rider_id IS NULL OR p_home_zone_id IS NULL
     OR length(btrim(coalesce(p_reason, ''))) < 10
     OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'A rider, active home zone and reason of 10 to 500 characters are required.';
  END IF;

  PERFORM 1 FROM public.profiles
  WHERE id = p_rider_id
    AND lower(coalesce(role, '')) = 'rider'
    AND lower(coalesce(status, '')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected rider account is not active.';
  END IF;

  SELECT t.is_active
    INTO v_territory_active
  FROM public.zones z
  JOIN public.territories t ON t.id = z.territory_id
  WHERE z.id = p_home_zone_id AND z.is_active IS TRUE;

  IF NOT FOUND OR v_territory_active IS NOT TRUE THEN
    RAISE EXCEPTION 'The selected home zone and its territory must both be active.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.rider_id = p_rider_id
      AND o.status IN ('assigned', 'accepted', 'picked_up')
  ) OR EXISTS (
    SELECT 1 FROM public.rider_dispatch_offers x
    WHERE x.rider_id = p_rider_id
      AND x.offer_status IN ('offered', 'accepted')
  ) THEN
    RAISE EXCEPTION 'The rider has an active order or dispatch reservation. Release it before changing the permanent home zone.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_riders vr
    WHERE vr.rider_id = p_rider_id
      AND vr.status = 'active'
      AND vr.unassigned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Review or remove the rider''s active vendor coverage link before changing the permanent home zone.';
  END IF;

  SELECT h.home_zone_id, h.id
    INTO v_previous_zone_id, v_assignment_id
  FROM public.rider_home_zone_assignments h
  WHERE h.rider_id = p_rider_id
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  FOR UPDATE;

  IF v_assignment_id IS NOT NULL AND v_previous_zone_id = p_home_zone_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'unchanged',
      'rider_id', p_rider_id,
      'home_zone_id', p_home_zone_id
    );
  END IF;

  IF v_assignment_id IS NOT NULL THEN
    UPDATE public.rider_home_zone_assignments
    SET status = 'inactive',
        unassigned_at = now(),
        updated_at = now()
    WHERE id = v_assignment_id;
  END IF;

  INSERT INTO public.rider_home_zone_assignments (
    rider_id, home_zone_id, status, availability_status,
    assigned_by, assignment_reason, assigned_at, unassigned_at,
    availability_updated_at, created_at, updated_at
  )
  VALUES (
    p_rider_id, p_home_zone_id, 'active', 'unavailable',
    v_actor, btrim(p_reason), now(), NULL, now(), now(), now()
  )
  RETURNING id INTO v_assignment_id;

  INSERT INTO public.rider_home_zone_assignment_audit (
    rider_id, previous_zone_id, new_zone_id, action, actor_id, reason, created_at
  )
  VALUES (
    p_rider_id, v_previous_zone_id, p_home_zone_id,
    CASE WHEN v_previous_zone_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    v_actor, btrim(p_reason), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', CASE WHEN v_previous_zone_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    'rider_id', p_rider_id,
    'previous_zone_id', v_previous_zone_id,
    'home_zone_id', p_home_zone_id,
    'availability_status', 'unavailable'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_admin_set_vendor_rider_coverage(
  p_vendor_id uuid,
  p_rider_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_vendor_zone_id uuid;
  v_vendor_zone_count integer;
  v_rider_home_zone_id uuid;
  v_home_zone_found boolean := false;
  v_link_id uuid;
  v_link_verified boolean;
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may manage vendor rider coverage.'
      USING ERRCODE = '42501';
  END IF;

  IF p_vendor_id IS NULL OR p_rider_id IS NULL
     OR p_action IS NULL
     OR p_action NOT IN ('add', 'verify', 'remove')
     OR length(btrim(coalesce(p_reason, ''))) < 10
     OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Vendor, rider, valid action and reason of 10 to 500 characters are required.';
  END IF;

  SELECT count(*)::integer, (array_agg(zv.zone_id))[1]
    INTO v_vendor_zone_count, v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
  WHERE zv.vendor_id = p_vendor_id
    AND zv.status = 'active'
    AND zv.unassigned_at IS NULL;

  IF v_vendor_zone_count <> 1 THEN
    RAISE EXCEPTION 'The vendor must have exactly one active MKH zone assignment before coverage is managed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND lower(coalesce(v.status, '')) = 'active'
  ) THEN
    RAISE EXCEPTION 'The vendor account is not active.';
  END IF;

  PERFORM 1 FROM public.profiles p
  WHERE p.id = p_rider_id
    AND lower(coalesce(p.role, '')) = 'rider'
    AND lower(coalesce(p.status, '')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected rider account is not active.';
  END IF;

  SELECT h.home_zone_id
    INTO v_rider_home_zone_id
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id = h.home_zone_id AND z.is_active IS TRUE
  WHERE h.rider_id = p_rider_id
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  FOR SHARE;

  v_home_zone_found := FOUND;

  SELECT vr.id, vr.coverage_verified
    INTO v_link_id, v_link_verified
  FROM public.vendor_riders vr
  WHERE vr.vendor_id = p_vendor_id
    AND vr.rider_id = p_rider_id
    AND vr.status = 'active'
    AND vr.unassigned_at IS NULL
  FOR UPDATE;

  IF p_action = 'remove' THEN
    IF v_link_id IS NULL THEN
      RAISE EXCEPTION 'No active vendor coverage link exists for this rider.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.rider_id = p_rider_id
        AND o.status IN ('assigned', 'accepted', 'picked_up')
    ) OR EXISTS (
      SELECT 1 FROM public.rider_dispatch_offers x
      WHERE x.rider_id = p_rider_id
        AND x.offer_status IN ('offered', 'accepted')
    ) THEN
      RAISE EXCEPTION 'The rider has an active order or dispatch reservation. Release it before removing coverage.';
    END IF;

    UPDATE public.vendor_riders
    SET status = 'inactive',
        unassigned_at = now()
    WHERE id = v_link_id;

    INSERT INTO public.vendor_rider_coverage_audit (
      vendor_id, rider_id, action, actor_id, reason, created_at
    )
    VALUES (p_vendor_id, p_rider_id, 'removed', v_actor, btrim(p_reason), now());

    RETURN jsonb_build_object('success', true, 'action', 'removed', 'vendor_id', p_vendor_id, 'rider_id', p_rider_id);
  END IF;

  IF NOT v_home_zone_found OR v_rider_home_zone_id IS DISTINCT FROM v_vendor_zone_id THEN
    RAISE EXCEPTION 'The rider must have a permanent home-zone assignment matching the vendor''s zone before joining its coverage group.';
  END IF;

  IF p_action = 'verify' AND (v_link_id IS NULL OR v_link_verified IS TRUE) THEN
    RAISE EXCEPTION 'Only an existing active unverified legacy link can be verified.';
  END IF;

  IF p_action = 'add' AND v_link_id IS NOT NULL AND v_link_verified IS TRUE THEN
    RAISE EXCEPTION 'This rider is already a verified member of this vendor coverage group.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_riders vr
    WHERE vr.rider_id = p_rider_id
      AND vr.vendor_id <> p_vendor_id
      AND vr.status = 'active'
      AND vr.unassigned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This rider already has an active vendor link. Shared coverage is not enabled without a separately recorded Operations approval.';
  END IF;

  IF v_link_id IS NOT NULL THEN
    UPDATE public.vendor_riders
    SET coverage_verified = true,
        coverage_verified_at = now(),
        coverage_verified_by = v_actor,
        coverage_verification_reason = btrim(p_reason)
    WHERE id = v_link_id;
  ELSE
    INSERT INTO public.vendor_riders (
      vendor_id, rider_id, status, assigned_at, unassigned_at, created_at,
      coverage_verified, coverage_verified_at, coverage_verified_by,
      coverage_verification_reason
    )
    VALUES (
      p_vendor_id, p_rider_id, 'active', now(), NULL, now(),
      true, now(), v_actor, btrim(p_reason)
    )
    RETURNING id INTO v_link_id;
  END IF;

  INSERT INTO public.vendor_rider_coverage_audit (
    vendor_id, rider_id, action, actor_id, reason, created_at
  )
  VALUES (
    p_vendor_id, p_rider_id,
    CASE WHEN v_link_verified IS FALSE THEN 'legacy_link_verified' ELSE 'assigned' END,
    v_actor, btrim(p_reason), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', CASE WHEN v_link_verified IS FALSE THEN 'verified' ELSE 'assigned' END,
    'vendor_id', p_vendor_id,
    'rider_id', p_rider_id,
    'coverage_link_id', v_link_id
  );
END;
$function$;

-- Rider app: expose only the authenticated rider's current offer and availability.
CREATE OR REPLACE FUNCTION public.mkh_rider_get_my_dispatch_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_home_zone_id uuid;
  v_home_zone_name text;
  v_availability text;
  v_gps_updated_at timestamptz;
  v_offers jsonb;
BEGIN
  IF v_actor IS NULL OR v_role IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.mkh_refresh_rider_dispatch_queue(v_actor);

  SELECT h.home_zone_id, z.name, h.availability_status
    INTO v_home_zone_id, v_home_zone_name, v_availability
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id = h.home_zone_id AND z.is_active IS TRUE
  JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
  WHERE h.rider_id = v_actor
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  LIMIT 1;

  SELECT rl.updated_at
    INTO v_gps_updated_at
  FROM public.rider_locations rl
  WHERE rl.rider_id = v_actor
  ORDER BY rl.updated_at DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'dispatch_mode', x.dispatch_mode,
    'distance_meters', x.distance_meters,
    'offered_at', x.offered_at,
    'expires_at', x.expires_at,
    'order', jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'total', o.total,
      'food_amount', o.food_amount,
      'delivery_fee', o.delivery_fee,
      'platform_fee', o.platform_fee,
      'rider_amount', o.rider_amount,
      'created_at', o.created_at,
      'delivery_address', o.delivery_address,
      'customer_notes', o.customer_notes,
      'payment_status', o.payment_status,
      'profiles', (
        SELECT jsonb_build_object('full_name', cp.full_name, 'email', cp.email, 'phone', cp.phone)
        FROM public.profiles cp
        WHERE cp.id = o.user_id
      ),
      'vendors', jsonb_build_object('name', v.name, 'location', v.location)
    )
  ) ORDER BY x.offered_at), '[]'::jsonb)
    INTO v_offers
  FROM public.rider_dispatch_offers x
  JOIN public.orders o ON o.id = x.order_id
  JOIN public.vendors v ON v.id = x.vendor_id
  WHERE x.rider_id = v_actor
    AND x.offer_status = 'offered'
    AND x.expires_at > now()
    AND o.status = 'ready_for_pickup'
    AND o.rider_id IS NULL;

  RETURN jsonb_build_object(
    'home_zone_id', v_home_zone_id,
    'home_zone_name', v_home_zone_name,
    'availability_status', coalesce(v_availability, 'unassigned'),
    'gps_updated_at', v_gps_updated_at,
    'gps_fresh', coalesce(v_gps_updated_at >= now() - interval '60 seconds', false),
    'offers', v_offers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(
  p_offer_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_rider_respond_to_dispatch_offer(v_actor, p_offer_id, p_action);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_set_my_dispatch_availability(
  p_availability_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_rider_set_dispatch_availability(v_actor, p_availability_status);
END;
$function$;

-- TRM: return only the authenticated TRM's assigned territory and allow only temporary cross-zone dispatch.
CREATE OR REPLACE FUNCTION public.mkh_trm_get_dispatch_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_assignment_count integer;
  v_territory_id uuid;
  v_territory_name text;
  v_zones jsonb;
  v_riders jsonb;
  v_vendors jsonb;
  v_ready_orders jsonb;
  v_active_offers jsonb;
BEGIN
  IF v_actor IS NULL OR v_role IS DISTINCT FROM 'TERRITORY' THEN
    RAISE EXCEPTION 'An authenticated Territory Relationship Manager account is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer, (array_agg(a.territory_id))[1]
    INTO v_assignment_count, v_territory_id
  FROM public.mkh_trm_territory_assignments a
  JOIN public.employees e ON e.id = a.employee_id
  JOIN public.profiles p ON p.id = e.profile_id
  WHERE e.profile_id = v_actor
    AND lower(coalesce(e.status, '')) = 'active'
    AND lower(coalesce(p.status, '')) = 'active'
    AND a.status = 'active';

  IF v_assignment_count <> 1 THEN
    RAISE EXCEPTION 'The TRM must have exactly one active territory assignment to manage dispatch.'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_territory_name
  FROM public.territories
  WHERE id = v_territory_id AND is_active IS TRUE;

  IF v_territory_name IS NULL THEN
    RAISE EXCEPTION 'The TRM territory is inactive or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', z.id,
    'name', z.name,
    'active_vendor_count', (
      SELECT count(*)::integer FROM public.zone_vendors zv
      WHERE zv.zone_id = z.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
    )
  ) ORDER BY z.name), '[]'::jsonb)
  INTO v_zones
  FROM public.zones z
  WHERE z.territory_id = v_territory_id AND z.is_active IS TRUE;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'home_zone_id', h.home_zone_id,
    'home_zone_name', z.name,
    'availability_status', h.availability_status,
    'gps_updated_at', rl.updated_at,
    'gps_fresh', coalesce(rl.updated_at >= now() - interval '60 seconds', false),
    'active_order_count', (
      SELECT count(*)::integer FROM public.orders o
      WHERE o.rider_id = p.id AND o.status IN ('assigned', 'accepted', 'picked_up')
    ),
    'active_offer_count', (
      SELECT count(*)::integer FROM public.rider_dispatch_offers x
      WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
    ),
    'dispatch_eligible', (
      h.availability_status = 'available'
      AND rl.updated_at >= now() - interval '60 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.rider_id = p.id AND o.status IN ('assigned', 'accepted', 'picked_up')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers x
        WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
      )
    )
  ) ORDER BY p.full_name), '[]'::jsonb)
  INTO v_riders
  FROM public.profiles p
  JOIN public.rider_home_zone_assignments h
    ON h.rider_id = p.id AND h.status = 'active' AND h.unassigned_at IS NULL
  JOIN public.zones z
    ON z.id = h.home_zone_id AND z.is_active IS TRUE
  JOIN public.territories t
    ON t.id = z.territory_id AND t.is_active IS TRUE
  LEFT JOIN LATERAL (
    SELECT l.updated_at
    FROM public.rider_locations l
    WHERE l.rider_id = p.id
    ORDER BY l.updated_at DESC
    LIMIT 1
  ) rl ON true
  WHERE lower(coalesce(p.role, '')) = 'rider'
    AND lower(coalesce(p.status, '')) = 'active'
    AND t.id = v_territory_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'zone_id', z.id,
    'zone_name', z.name,
    'coverage_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS TRUE
    ),
    'legacy_unverified_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS NOT TRUE
    )
  ) ORDER BY z.name, v.name), '[]'::jsonb)
  INTO v_vendors
  FROM public.vendors v
  JOIN public.zone_vendors zv
    ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  WHERE lower(coalesce(v.status, '')) = 'active'
    AND z.territory_id = v_territory_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'payment_status', o.payment_status,
    'payment_eligible', (
      coalesce(o.payment_status, '') = 'paid'
      OR lower(coalesce(o.payment_method, '')) IN ('cash_on_delivery', 'cod')
    ),
    'vendor_id', v.id,
    'vendor_name', v.name,
    'zone_id', z.id,
    'zone_name', z.name,
    'coverage_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS TRUE
    ),
    'active_offer', (
      SELECT jsonb_build_object(
        'id', x.id,
        'rider_id', x.rider_id,
        'rider_name', rp.full_name,
        'offer_status', x.offer_status,
        'dispatch_mode', x.dispatch_mode,
        'distance_meters', x.distance_meters,
        'expires_at', x.expires_at
      )
      FROM public.rider_dispatch_offers x
      JOIN public.profiles rp ON rp.id = x.rider_id
      WHERE x.order_id = o.id AND x.offer_status IN ('offered', 'accepted')
      ORDER BY x.offered_at DESC
      LIMIT 1
    ),
    'cross_zone_fallback_ready', (
      (
        coalesce(o.payment_status, '') = 'paid'
        OR lower(coalesce(o.payment_method, '')) IN ('cash_on_delivery', 'cod')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers x
        WHERE x.order_id = o.id AND x.offer_status IN ('offered', 'accepted')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.vendor_riders vr
        JOIN public.rider_home_zone_assignments h
          ON h.rider_id = vr.rider_id
         AND h.status = 'active'
         AND h.unassigned_at IS NULL
         AND h.home_zone_id = z.id
         AND h.availability_status = 'available'
        JOIN public.rider_locations rl ON rl.rider_id = vr.rider_id
        WHERE vr.vendor_id = v.id
          AND vr.status = 'active'
          AND vr.unassigned_at IS NULL
          AND vr.coverage_verified IS TRUE
          AND rl.updated_at >= now() - interval '60 seconds'
          AND private.mkh_rider_is_dispatch_eligible(vr.rider_id)
          AND NOT EXISTS (
            SELECT 1 FROM public.rider_dispatch_offers prior
            WHERE prior.order_id = o.id AND prior.rider_id = vr.rider_id
          )
      )
    )
  ) ORDER BY o.created_at), '[]'::jsonb)
  INTO v_ready_orders
  FROM public.orders o
  JOIN public.vendors v ON v.id = o.vendor_id
  JOIN public.zone_vendors zv
    ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  WHERE z.territory_id = v_territory_id
    AND o.status = 'ready_for_pickup'
    AND o.rider_id IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'order_id', x.order_id,
    'order_number', o.order_number,
    'vendor_id', v.id,
    'vendor_name', v.name,
    'rider_id', x.rider_id,
    'rider_name', rp.full_name,
    'home_zone_id', x.home_zone_id,
    'vendor_zone_id', x.vendor_zone_id,
    'dispatch_mode', x.dispatch_mode,
    'distance_meters', x.distance_meters,
    'offer_status', x.offer_status,
    'offered_at', x.offered_at,
    'expires_at', x.expires_at
  ) ORDER BY x.offered_at DESC), '[]'::jsonb)
  INTO v_active_offers
  FROM public.rider_dispatch_offers x
  JOIN public.orders o ON o.id = x.order_id
  JOIN public.vendors v ON v.id = x.vendor_id
  JOIN public.profiles rp ON rp.id = x.rider_id
  JOIN public.zones z ON z.id = x.vendor_zone_id
  WHERE z.territory_id = v_territory_id
    AND x.offer_status IN ('offered', 'accepted');

  RETURN jsonb_build_object(
    'territory_id', v_territory_id,
    'territory_name', v_territory_name,
    'zones', v_zones,
    'riders', v_riders,
    'vendors', v_vendors,
    'ready_orders', v_ready_orders,
    'active_offers', v_active_offers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(
  p_order_id uuid,
  p_rider_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'TERRITORY' THEN
    RAISE EXCEPTION 'Only an authenticated Territory Relationship Manager may request cross-zone dispatch.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_trm_dispatch_cross_zone_rider(v_actor, p_order_id, p_rider_id, p_reason);
END;
$function$;

-- New RPC surface is authenticated only; all identities/roles are derived from auth.uid().
REVOKE ALL ON FUNCTION public.mkh_admin_get_rider_assignment_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_set_rider_home_zone(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_set_vendor_rider_coverage(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_get_my_dispatch_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_set_my_dispatch_availability(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_trm_get_dispatch_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mkh_admin_get_rider_assignment_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_set_rider_home_zone(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_set_vendor_rider_coverage(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_get_my_dispatch_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_set_my_dispatch_availability(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_trm_get_dispatch_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

    );
    IF v_definition = v_original THEN
      RAISE EXCEPTION 'Could not safely add the dispatch-offer realtime event to the automatic dispatch function.';
    END IF;
    EXECUTE v_definition;
  END IF;

  v_target := 'public.mkh_trm_dispatch_cross_zone_rider(uuid,uuid,uuid,text)'::regprocedure;
  v_original := pg_get_functiondef(v_target);
  IF position('rider_dispatch_offer' IN v_original) = 0 THEN
    v_definition := replace(
      v_original,
      E'  RETURN jsonb_build_object(\n    ''success'',true,''offer_id'',v_offer_id',
      E'  INSERT INTO public.order_events (id,order_id,event_type,title,description,actor_type,actor_id,created_at)\n  VALUES (gen_random_uuid(),p_order_id,''rider_dispatch_offer'',''Temporary pickup offer created'',''MKH sent a temporary rider pickup offer for this order.'',''trm'',p_actor_id,now());\n\n  RETURN jsonb_build_object(\n    ''success'',true,''offer_id'',v_offer_id'
    );
    IF v_definition = v_original THEN
      RAISE EXCEPTION 'Could not safely add the dispatch-offer realtime event to the TRM dispatch function.';
    END IF;
    EXECUTE v_definition;
  END IF;
END;
$realtime$;

-- Enforce future capacity additions without deactivating existing over-capacity records.
CREATE OR REPLACE FUNCTION private.mkh_enforce_rider_model_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF TG_TABLE_NAME = 'zones' THEN
    IF NEW.is_active IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.is_active IS TRUE
       AND OLD.territory_id = NEW.territory_id THEN
      RETURN NEW;
    END IF;

    PERFORM 1
    FROM public.territories
    WHERE id = NEW.territory_id
    FOR UPDATE;

    SELECT count(*)::integer
      INTO v_count
    FROM public.zones z
    WHERE z.territory_id = NEW.territory_id
      AND z.is_active IS TRUE
      AND (TG_OP = 'INSERT' OR z.id <> NEW.id);

    IF v_count >= 6 THEN
      RAISE EXCEPTION 'A territory may have a maximum of six active zones.';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'zone_vendors' THEN
    IF NEW.status <> 'active' OR NEW.unassigned_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.status = 'active'
       AND OLD.unassigned_at IS NULL
       AND OLD.zone_id = NEW.zone_id
       AND OLD.vendor_id = NEW.vendor_id THEN
      RETURN NEW;
    END IF;

    PERFORM 1
    FROM public.zones
    WHERE id = NEW.zone_id
    FOR UPDATE;

    SELECT count(*)::integer
      INTO v_count
    FROM public.zone_vendors zv
    WHERE zv.zone_id = NEW.zone_id
      AND zv.status = 'active'
      AND zv.unassigned_at IS NULL
      AND (TG_OP = 'INSERT' OR zv.id <> NEW.id);

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'A zone may have a maximum of five active vendors. Existing capacity exceptions require management reconciliation.';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mkh_enforce_six_active_zones ON public.zones;
CREATE TRIGGER trg_mkh_enforce_six_active_zones
BEFORE INSERT OR UPDATE OF territory_id, is_active
ON public.zones
FOR EACH ROW
EXECUTE FUNCTION private.mkh_enforce_rider_model_capacity();

DROP TRIGGER IF EXISTS trg_mkh_enforce_five_active_vendors_per_zone ON public.zone_vendors;
CREATE TRIGGER trg_mkh_enforce_five_active_vendors_per_zone
BEFORE INSERT OR UPDATE OF vendor_id, zone_id, status, unassigned_at
ON public.zone_vendors
FOR EACH ROW
EXECUTE FUNCTION private.mkh_enforce_rider_model_capacity();

-- Admin/Operations: read the assignment baseline and manage permanent assignments.
CREATE OR REPLACE FUNCTION public.mkh_admin_get_rider_assignment_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may view rider assignment controls.'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'territories',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'is_active', t.is_active,
        'active_zone_count', (
          SELECT count(*)::integer FROM public.zones z
          WHERE z.territory_id = t.id AND z.is_active IS TRUE
        )
      ) ORDER BY t.name)
      FROM public.territories t
      WHERE t.is_active IS TRUE
    ), '[]'::jsonb),

    'zones',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', z.id,
        'name', z.name,
        'territory_id', z.territory_id,
        'territory_name', t.name,
        'active_vendor_count', (
          SELECT count(*)::integer FROM public.zone_vendors zv
          WHERE zv.zone_id = z.id
            AND zv.status = 'active'
            AND zv.unassigned_at IS NULL
        ),
        'capacity_exception', (
          SELECT count(*) FROM public.zone_vendors zv
          WHERE zv.zone_id = z.id
            AND zv.status = 'active'
            AND zv.unassigned_at IS NULL
        ) > 5
      ) ORDER BY t.name, z.name)
      FROM public.zones z
      JOIN public.territories t ON t.id = z.territory_id
      WHERE z.is_active IS TRUE AND t.is_active IS TRUE
    ), '[]'::jsonb),

    'riders',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'status', p.status,
        'home_zone_id', h.home_zone_id,
        'home_zone_name', z.name,
        'availability_status', h.availability_status,
        'gps_updated_at', rl.updated_at,
        'gps_fresh', coalesce(rl.updated_at >= now() - interval '60 seconds', false),
        'active_order_count', (
          SELECT count(*)::integer FROM public.orders o
          WHERE o.rider_id = p.id
            AND o.status IN ('assigned', 'accepted', 'picked_up')
        ),
        'active_offer_count', (
          SELECT count(*)::integer FROM public.rider_dispatch_offers x
          WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
        ),
        'verified_vendor_ids', coalesce((
          SELECT jsonb_agg(vr.vendor_id)
          FROM public.vendor_riders vr
          WHERE vr.rider_id = p.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS TRUE
        ), '[]'::jsonb)
      ) ORDER BY p.full_name)
      FROM public.profiles p
      LEFT JOIN public.rider_home_zone_assignments h
        ON h.rider_id = p.id AND h.status = 'active' AND h.unassigned_at IS NULL
      LEFT JOIN public.zones z ON z.id = h.home_zone_id
      LEFT JOIN LATERAL (
        SELECT l.updated_at
        FROM public.rider_locations l
        WHERE l.rider_id = p.id
        ORDER BY l.updated_at DESC
        LIMIT 1
      ) rl ON true
      WHERE lower(coalesce(p.role, '')) = 'rider'
        AND lower(coalesce(p.status, '')) = 'active'
    ), '[]'::jsonb),

    'vendors',
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'status', v.status,
        'zone_id', z.id,
        'zone_name', z.name,
        'territory_id', t.id,
        'territory_name', t.name,
        'active_vendor_count', (
          SELECT count(*)::integer FROM public.zone_vendors zv2
          WHERE zv2.zone_id = z.id
            AND zv2.status = 'active'
            AND zv2.unassigned_at IS NULL
        ),
        'coverage_count', (
          SELECT count(*)::integer FROM public.vendor_riders vr
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS TRUE
        ),
        'legacy_unverified_count', (
          SELECT count(*)::integer FROM public.vendor_riders vr
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
            AND vr.coverage_verified IS NOT TRUE
        ),
        'coverage_riders', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'link_id', vr.id,
            'rider_id', rp.id,
            'rider_name', rp.full_name,
            'verified', vr.coverage_verified,
            'assigned_at', vr.assigned_at,
            'verification_reason', vr.coverage_verification_reason
          ) ORDER BY rp.full_name)
          FROM public.vendor_riders vr
          JOIN public.profiles rp ON rp.id = vr.rider_id
          WHERE vr.vendor_id = v.id
            AND vr.status = 'active'
            AND vr.unassigned_at IS NULL
        ), '[]'::jsonb)
      ) ORDER BY t.name, z.name, v.name)
      FROM public.vendors v
      JOIN public.zone_vendors zv
        ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
      JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
      JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
      WHERE lower(coalesce(v.status, '')) = 'active'
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_admin_set_rider_home_zone(
  p_rider_id uuid,
  p_home_zone_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_previous_zone_id uuid;
  v_assignment_id uuid;
  v_territory_active boolean;
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may change a rider''s permanent home zone.'
      USING ERRCODE = '42501';
  END IF;

  IF p_rider_id IS NULL OR p_home_zone_id IS NULL
     OR length(btrim(coalesce(p_reason, ''))) < 10
     OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'A rider, active home zone and reason of 10 to 500 characters are required.';
  END IF;

  PERFORM 1 FROM public.profiles
  WHERE id = p_rider_id
    AND lower(coalesce(role, '')) = 'rider'
    AND lower(coalesce(status, '')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected rider account is not active.';
  END IF;

  SELECT t.is_active
    INTO v_territory_active
  FROM public.zones z
  JOIN public.territories t ON t.id = z.territory_id
  WHERE z.id = p_home_zone_id AND z.is_active IS TRUE;

  IF NOT FOUND OR v_territory_active IS NOT TRUE THEN
    RAISE EXCEPTION 'The selected home zone and its territory must both be active.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.rider_id = p_rider_id
      AND o.status IN ('assigned', 'accepted', 'picked_up')
  ) OR EXISTS (
    SELECT 1 FROM public.rider_dispatch_offers x
    WHERE x.rider_id = p_rider_id
      AND x.offer_status IN ('offered', 'accepted')
  ) THEN
    RAISE EXCEPTION 'The rider has an active order or dispatch reservation. Release it before changing the permanent home zone.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_riders vr
    WHERE vr.rider_id = p_rider_id
      AND vr.status = 'active'
      AND vr.unassigned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Review or remove the rider''s active vendor coverage link before changing the permanent home zone.';
  END IF;

  SELECT h.home_zone_id, h.id
    INTO v_previous_zone_id, v_assignment_id
  FROM public.rider_home_zone_assignments h
  WHERE h.rider_id = p_rider_id
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  FOR UPDATE;

  IF v_assignment_id IS NOT NULL AND v_previous_zone_id = p_home_zone_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'unchanged',
      'rider_id', p_rider_id,
      'home_zone_id', p_home_zone_id
    );
  END IF;

  IF v_assignment_id IS NOT NULL THEN
    UPDATE public.rider_home_zone_assignments
    SET status = 'inactive',
        unassigned_at = now(),
        updated_at = now()
    WHERE id = v_assignment_id;
  END IF;

  INSERT INTO public.rider_home_zone_assignments (
    rider_id, home_zone_id, status, availability_status,
    assigned_by, assignment_reason, assigned_at, unassigned_at,
    availability_updated_at, created_at, updated_at
  )
  VALUES (
    p_rider_id, p_home_zone_id, 'active', 'unavailable',
    v_actor, btrim(p_reason), now(), NULL, now(), now(), now()
  )
  RETURNING id INTO v_assignment_id;

  INSERT INTO public.rider_home_zone_assignment_audit (
    rider_id, previous_zone_id, new_zone_id, action, actor_id, reason, created_at
  )
  VALUES (
    p_rider_id, v_previous_zone_id, p_home_zone_id,
    CASE WHEN v_previous_zone_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    v_actor, btrim(p_reason), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', CASE WHEN v_previous_zone_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    'rider_id', p_rider_id,
    'previous_zone_id', v_previous_zone_id,
    'home_zone_id', p_home_zone_id,
    'availability_status', 'unavailable'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_admin_set_vendor_rider_coverage(
  p_vendor_id uuid,
  p_rider_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_vendor_zone_id uuid;
  v_vendor_zone_count integer;
  v_rider_home_zone_id uuid;
  v_home_zone_found boolean := false;
  v_link_id uuid;
  v_link_verified boolean;
BEGIN
  IF v_actor IS NULL OR v_role NOT IN ('ADMIN', 'COO') THEN
    RAISE EXCEPTION 'Only Admin/Operations may manage vendor rider coverage.'
      USING ERRCODE = '42501';
  END IF;

  IF p_vendor_id IS NULL OR p_rider_id IS NULL
     OR p_action IS NULL
     OR p_action NOT IN ('add', 'verify', 'remove')
     OR length(btrim(coalesce(p_reason, ''))) < 10
     OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Vendor, rider, valid action and reason of 10 to 500 characters are required.';
  END IF;

  SELECT count(*)::integer, (array_agg(zv.zone_id))[1]
    INTO v_vendor_zone_count, v_vendor_zone_id
  FROM public.zone_vendors zv
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
  WHERE zv.vendor_id = p_vendor_id
    AND zv.status = 'active'
    AND zv.unassigned_at IS NULL;

  IF v_vendor_zone_count <> 1 THEN
    RAISE EXCEPTION 'The vendor must have exactly one active MKH zone assignment before coverage is managed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND lower(coalesce(v.status, '')) = 'active'
  ) THEN
    RAISE EXCEPTION 'The vendor account is not active.';
  END IF;

  PERFORM 1 FROM public.profiles p
  WHERE p.id = p_rider_id
    AND lower(coalesce(p.role, '')) = 'rider'
    AND lower(coalesce(p.status, '')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected rider account is not active.';
  END IF;

  SELECT h.home_zone_id
    INTO v_rider_home_zone_id
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id = h.home_zone_id AND z.is_active IS TRUE
  WHERE h.rider_id = p_rider_id
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  FOR SHARE;

  v_home_zone_found := FOUND;

  SELECT vr.id, vr.coverage_verified
    INTO v_link_id, v_link_verified
  FROM public.vendor_riders vr
  WHERE vr.vendor_id = p_vendor_id
    AND vr.rider_id = p_rider_id
    AND vr.status = 'active'
    AND vr.unassigned_at IS NULL
  FOR UPDATE;

  IF p_action = 'remove' THEN
    IF v_link_id IS NULL THEN
      RAISE EXCEPTION 'No active vendor coverage link exists for this rider.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.rider_id = p_rider_id
        AND o.status IN ('assigned', 'accepted', 'picked_up')
    ) OR EXISTS (
      SELECT 1 FROM public.rider_dispatch_offers x
      WHERE x.rider_id = p_rider_id
        AND x.offer_status IN ('offered', 'accepted')
    ) THEN
      RAISE EXCEPTION 'The rider has an active order or dispatch reservation. Release it before removing coverage.';
    END IF;

    UPDATE public.vendor_riders
    SET status = 'inactive',
        unassigned_at = now()
    WHERE id = v_link_id;

    INSERT INTO public.vendor_rider_coverage_audit (
      vendor_id, rider_id, action, actor_id, reason, created_at
    )
    VALUES (p_vendor_id, p_rider_id, 'removed', v_actor, btrim(p_reason), now());

    RETURN jsonb_build_object('success', true, 'action', 'removed', 'vendor_id', p_vendor_id, 'rider_id', p_rider_id);
  END IF;

  IF NOT v_home_zone_found OR v_rider_home_zone_id IS DISTINCT FROM v_vendor_zone_id THEN
    RAISE EXCEPTION 'The rider must have a permanent home-zone assignment matching the vendor''s zone before joining its coverage group.';
  END IF;

  IF p_action = 'verify' AND (v_link_id IS NULL OR v_link_verified IS TRUE) THEN
    RAISE EXCEPTION 'Only an existing active unverified legacy link can be verified.';
  END IF;

  IF p_action = 'add' AND v_link_id IS NOT NULL AND v_link_verified IS TRUE THEN
    RAISE EXCEPTION 'This rider is already a verified member of this vendor coverage group.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_riders vr
    WHERE vr.rider_id = p_rider_id
      AND vr.vendor_id <> p_vendor_id
      AND vr.status = 'active'
      AND vr.unassigned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This rider already has an active vendor link. Shared coverage is not enabled without a separately recorded Operations approval.';
  END IF;

  IF v_link_id IS NOT NULL THEN
    UPDATE public.vendor_riders
    SET coverage_verified = true,
        coverage_verified_at = now(),
        coverage_verified_by = v_actor,
        coverage_verification_reason = btrim(p_reason)
    WHERE id = v_link_id;
  ELSE
    INSERT INTO public.vendor_riders (
      vendor_id, rider_id, status, assigned_at, unassigned_at, created_at,
      coverage_verified, coverage_verified_at, coverage_verified_by,
      coverage_verification_reason
    )
    VALUES (
      p_vendor_id, p_rider_id, 'active', now(), NULL, now(),
      true, now(), v_actor, btrim(p_reason)
    )
    RETURNING id INTO v_link_id;
  END IF;

  INSERT INTO public.vendor_rider_coverage_audit (
    vendor_id, rider_id, action, actor_id, reason, created_at
  )
  VALUES (
    p_vendor_id, p_rider_id,
    CASE WHEN v_link_verified IS FALSE THEN 'legacy_link_verified' ELSE 'assigned' END,
    v_actor, btrim(p_reason), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', CASE WHEN v_link_verified IS FALSE THEN 'verified' ELSE 'assigned' END,
    'vendor_id', p_vendor_id,
    'rider_id', p_rider_id,
    'coverage_link_id', v_link_id
  );
END;
$function$;

-- Rider app: expose only the authenticated rider's current offer and availability.
CREATE OR REPLACE FUNCTION public.mkh_rider_get_my_dispatch_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_home_zone_id uuid;
  v_home_zone_name text;
  v_availability text;
  v_gps_updated_at timestamptz;
  v_offers jsonb;
BEGIN
  IF v_actor IS NULL OR v_role IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.mkh_refresh_rider_dispatch_queue(v_actor);

  SELECT h.home_zone_id, z.name, h.availability_status
    INTO v_home_zone_id, v_home_zone_name, v_availability
  FROM public.rider_home_zone_assignments h
  JOIN public.zones z ON z.id = h.home_zone_id AND z.is_active IS TRUE
  JOIN public.territories t ON t.id = z.territory_id AND t.is_active IS TRUE
  WHERE h.rider_id = v_actor
    AND h.status = 'active'
    AND h.unassigned_at IS NULL
  LIMIT 1;

  SELECT rl.updated_at
    INTO v_gps_updated_at
  FROM public.rider_locations rl
  WHERE rl.rider_id = v_actor
  ORDER BY rl.updated_at DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'dispatch_mode', x.dispatch_mode,
    'distance_meters', x.distance_meters,
    'offered_at', x.offered_at,
    'expires_at', x.expires_at,
    'order', jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'total', o.total,
      'food_amount', o.food_amount,
      'delivery_fee', o.delivery_fee,
      'platform_fee', o.platform_fee,
      'rider_amount', o.rider_amount,
      'created_at', o.created_at,
      'delivery_address', o.delivery_address,
      'customer_notes', o.customer_notes,
      'payment_status', o.payment_status,
      'profiles', (
        SELECT jsonb_build_object('full_name', cp.full_name, 'email', cp.email, 'phone', cp.phone)
        FROM public.profiles cp
        WHERE cp.id = o.user_id
      ),
      'vendors', jsonb_build_object('name', v.name, 'location', v.location)
    )
  ) ORDER BY x.offered_at), '[]'::jsonb)
    INTO v_offers
  FROM public.rider_dispatch_offers x
  JOIN public.orders o ON o.id = x.order_id
  JOIN public.vendors v ON v.id = x.vendor_id
  WHERE x.rider_id = v_actor
    AND x.offer_status = 'offered'
    AND x.expires_at > now()
    AND o.status = 'ready_for_pickup'
    AND o.rider_id IS NULL;

  RETURN jsonb_build_object(
    'home_zone_id', v_home_zone_id,
    'home_zone_name', v_home_zone_name,
    'availability_status', coalesce(v_availability, 'unassigned'),
    'gps_updated_at', v_gps_updated_at,
    'gps_fresh', coalesce(v_gps_updated_at >= now() - interval '60 seconds', false),
    'offers', v_offers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(
  p_offer_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_rider_respond_to_dispatch_offer(v_actor, p_offer_id, p_action);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_rider_set_my_dispatch_availability(
  p_availability_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'RIDER' THEN
    RAISE EXCEPTION 'An authenticated active rider account is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_rider_set_dispatch_availability(v_actor, p_availability_status);
END;
$function$;

-- TRM: return only the authenticated TRM's assigned territory and allow only temporary cross-zone dispatch.
CREATE OR REPLACE FUNCTION public.mkh_trm_get_dispatch_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.current_effective_app_role();
  v_assignment_count integer;
  v_territory_id uuid;
  v_territory_name text;
  v_zones jsonb;
  v_riders jsonb;
  v_vendors jsonb;
  v_ready_orders jsonb;
  v_active_offers jsonb;
BEGIN
  IF v_actor IS NULL OR v_role IS DISTINCT FROM 'TERRITORY' THEN
    RAISE EXCEPTION 'An authenticated Territory Relationship Manager account is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer, (array_agg(a.territory_id))[1]
    INTO v_assignment_count, v_territory_id
  FROM public.mkh_trm_territory_assignments a
  JOIN public.employees e ON e.id = a.employee_id
  JOIN public.profiles p ON p.id = e.profile_id
  WHERE e.profile_id = v_actor
    AND lower(coalesce(e.status, '')) = 'active'
    AND lower(coalesce(p.status, '')) = 'active'
    AND a.status = 'active';

  IF v_assignment_count <> 1 THEN
    RAISE EXCEPTION 'The TRM must have exactly one active territory assignment to manage dispatch.'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_territory_name
  FROM public.territories
  WHERE id = v_territory_id AND is_active IS TRUE;

  IF v_territory_name IS NULL THEN
    RAISE EXCEPTION 'The TRM territory is inactive or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', z.id,
    'name', z.name,
    'active_vendor_count', (
      SELECT count(*)::integer FROM public.zone_vendors zv
      WHERE zv.zone_id = z.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
    )
  ) ORDER BY z.name), '[]'::jsonb)
  INTO v_zones
  FROM public.zones z
  WHERE z.territory_id = v_territory_id AND z.is_active IS TRUE;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'home_zone_id', h.home_zone_id,
    'home_zone_name', z.name,
    'availability_status', h.availability_status,
    'gps_updated_at', rl.updated_at,
    'gps_fresh', coalesce(rl.updated_at >= now() - interval '60 seconds', false),
    'active_order_count', (
      SELECT count(*)::integer FROM public.orders o
      WHERE o.rider_id = p.id AND o.status IN ('assigned', 'accepted', 'picked_up')
    ),
    'active_offer_count', (
      SELECT count(*)::integer FROM public.rider_dispatch_offers x
      WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
    ),
    'dispatch_eligible', (
      h.availability_status = 'available'
      AND rl.updated_at >= now() - interval '60 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.rider_id = p.id AND o.status IN ('assigned', 'accepted', 'picked_up')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers x
        WHERE x.rider_id = p.id AND x.offer_status IN ('offered', 'accepted')
      )
    )
  ) ORDER BY p.full_name), '[]'::jsonb)
  INTO v_riders
  FROM public.profiles p
  JOIN public.rider_home_zone_assignments h
    ON h.rider_id = p.id AND h.status = 'active' AND h.unassigned_at IS NULL
  JOIN public.zones z
    ON z.id = h.home_zone_id AND z.is_active IS TRUE
  JOIN public.territories t
    ON t.id = z.territory_id AND t.is_active IS TRUE
  LEFT JOIN LATERAL (
    SELECT l.updated_at
    FROM public.rider_locations l
    WHERE l.rider_id = p.id
    ORDER BY l.updated_at DESC
    LIMIT 1
  ) rl ON true
  WHERE lower(coalesce(p.role, '')) = 'rider'
    AND lower(coalesce(p.status, '')) = 'active'
    AND t.id = v_territory_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'zone_id', z.id,
    'zone_name', z.name,
    'coverage_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS TRUE
    ),
    'legacy_unverified_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS NOT TRUE
    )
  ) ORDER BY z.name, v.name), '[]'::jsonb)
  INTO v_vendors
  FROM public.vendors v
  JOIN public.zone_vendors zv
    ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  WHERE lower(coalesce(v.status, '')) = 'active'
    AND z.territory_id = v_territory_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'payment_status', o.payment_status,
    'payment_eligible', (
      coalesce(o.payment_status, '') = 'paid'
      OR lower(coalesce(o.payment_method, '')) IN ('cash_on_delivery', 'cod')
    ),
    'vendor_id', v.id,
    'vendor_name', v.name,
    'zone_id', z.id,
    'zone_name', z.name,
    'coverage_count', (
      SELECT count(*)::integer FROM public.vendor_riders vr
      WHERE vr.vendor_id = v.id
        AND vr.status = 'active'
        AND vr.unassigned_at IS NULL
        AND vr.coverage_verified IS TRUE
    ),
    'active_offer', (
      SELECT jsonb_build_object(
        'id', x.id,
        'rider_id', x.rider_id,
        'rider_name', rp.full_name,
        'offer_status', x.offer_status,
        'dispatch_mode', x.dispatch_mode,
        'distance_meters', x.distance_meters,
        'expires_at', x.expires_at
      )
      FROM public.rider_dispatch_offers x
      JOIN public.profiles rp ON rp.id = x.rider_id
      WHERE x.order_id = o.id AND x.offer_status IN ('offered', 'accepted')
      ORDER BY x.offered_at DESC
      LIMIT 1
    ),
    'cross_zone_fallback_ready', (
      (
        coalesce(o.payment_status, '') = 'paid'
        OR lower(coalesce(o.payment_method, '')) IN ('cash_on_delivery', 'cod')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.rider_dispatch_offers x
        WHERE x.order_id = o.id AND x.offer_status IN ('offered', 'accepted')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.vendor_riders vr
        JOIN public.rider_home_zone_assignments h
          ON h.rider_id = vr.rider_id
         AND h.status = 'active'
         AND h.unassigned_at IS NULL
         AND h.home_zone_id = z.id
         AND h.availability_status = 'available'
        JOIN public.rider_locations rl ON rl.rider_id = vr.rider_id
        WHERE vr.vendor_id = v.id
          AND vr.status = 'active'
          AND vr.unassigned_at IS NULL
          AND vr.coverage_verified IS TRUE
          AND rl.updated_at >= now() - interval '60 seconds'
          AND private.mkh_rider_is_dispatch_eligible(vr.rider_id)
          AND NOT EXISTS (
            SELECT 1 FROM public.rider_dispatch_offers prior
            WHERE prior.order_id = o.id AND prior.rider_id = vr.rider_id
          )
      )
    )
  ) ORDER BY o.created_at), '[]'::jsonb)
  INTO v_ready_orders
  FROM public.orders o
  JOIN public.vendors v ON v.id = o.vendor_id
  JOIN public.zone_vendors zv
    ON zv.vendor_id = v.id AND zv.status = 'active' AND zv.unassigned_at IS NULL
  JOIN public.zones z ON z.id = zv.zone_id AND z.is_active IS TRUE
  WHERE z.territory_id = v_territory_id
    AND o.status = 'ready_for_pickup'
    AND o.rider_id IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'order_id', x.order_id,
    'order_number', o.order_number,
    'vendor_id', v.id,
    'vendor_name', v.name,
    'rider_id', x.rider_id,
    'rider_name', rp.full_name,
    'home_zone_id', x.home_zone_id,
    'vendor_zone_id', x.vendor_zone_id,
    'dispatch_mode', x.dispatch_mode,
    'distance_meters', x.distance_meters,
    'offer_status', x.offer_status,
    'offered_at', x.offered_at,
    'expires_at', x.expires_at
  ) ORDER BY x.offered_at DESC), '[]'::jsonb)
  INTO v_active_offers
  FROM public.rider_dispatch_offers x
  JOIN public.orders o ON o.id = x.order_id
  JOIN public.vendors v ON v.id = x.vendor_id
  JOIN public.profiles rp ON rp.id = x.rider_id
  JOIN public.zones z ON z.id = x.vendor_zone_id
  WHERE z.territory_id = v_territory_id
    AND x.offer_status IN ('offered', 'accepted');

  RETURN jsonb_build_object(
    'territory_id', v_territory_id,
    'territory_name', v_territory_name,
    'zones', v_zones,
    'riders', v_riders,
    'vendors', v_vendors,
    'ready_orders', v_ready_orders,
    'active_offers', v_active_offers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(
  p_order_id uuid,
  p_rider_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR public.current_effective_app_role() IS DISTINCT FROM 'TERRITORY' THEN
    RAISE EXCEPTION 'Only an authenticated Territory Relationship Manager may request cross-zone dispatch.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.mkh_trm_dispatch_cross_zone_rider(v_actor, p_order_id, p_rider_id, p_reason);
END;
$function$;

-- New RPC surface is authenticated only; all identities/roles are derived from auth.uid().
REVOKE ALL ON FUNCTION public.mkh_admin_get_rider_assignment_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_set_rider_home_zone(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_set_vendor_rider_coverage(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_get_my_dispatch_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_rider_set_my_dispatch_availability(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_trm_get_dispatch_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mkh_admin_get_rider_assignment_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_set_rider_home_zone(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_set_vendor_rider_coverage(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_get_my_dispatch_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_respond_to_my_dispatch_offer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_rider_set_my_dispatch_availability(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_trm_get_dispatch_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_trm_create_cross_zone_dispatch_offer(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
