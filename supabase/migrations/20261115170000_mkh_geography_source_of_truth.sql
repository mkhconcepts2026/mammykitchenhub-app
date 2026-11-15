-- MKH geography source-of-truth separation
-- Additive and TEST-first. Google Maps remains the source for address evidence
-- and customer road-distance calculation; MKH locality/territory records govern
-- vendor operational coverage. No historical vendor assignments are rewritten.
-- No customer orders, payments, wallets, payout rules, allocation ledgers or
-- settlement records are changed by this migration.

BEGIN;

-- The relationship is intentionally many-to-many: an MKH locality may be
-- covered by more than one MKH territory where the operational boundary requires it.
-- Prevent duplicate ACTIVE links without forcing a locality into one territory.
CREATE UNIQUE INDEX IF NOT EXISTS territory_localities_active_pair_uidx
    ON public.territory_localities(locality_id, territory_id)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.territory_locality_mapping_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    territory_locality_id uuid NOT NULL
        REFERENCES public.territory_localities(id) ON DELETE RESTRICT,
    locality_id uuid NOT NULL
        REFERENCES public.localities(id) ON DELETE RESTRICT,
    territory_id uuid NOT NULL
        REFERENCES public.territories(id) ON DELETE RESTRICT,
    action text NOT NULL CHECK (action IN ('assigned', 'unassigned')),
    changed_by uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
    change_reason text NOT NULL
        CHECK (length(btrim(change_reason)) BETWEEN 10 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS territory_locality_mapping_audit_locality_idx
    ON public.territory_locality_mapping_audit(locality_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_zone_assignment_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id uuid NOT NULL
        REFERENCES public.vendors(id) ON DELETE RESTRICT,
    locality_id uuid NOT NULL
        REFERENCES public.localities(id) ON DELETE RESTRICT,
    previous_zone_vendor_id uuid NULL
        REFERENCES public.zone_vendors(id) ON DELETE RESTRICT,
    previous_zone_id uuid NULL
        REFERENCES public.zones(id) ON DELETE RESTRICT,
    new_zone_vendor_id uuid NOT NULL
        REFERENCES public.zone_vendors(id) ON DELETE RESTRICT,
    new_zone_id uuid NOT NULL
        REFERENCES public.zones(id) ON DELETE RESTRICT,
    changed_by uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
    change_reason text NOT NULL
        CHECK (length(btrim(change_reason)) BETWEEN 10 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_zone_assignment_audit_vendor_idx
    ON public.vendor_zone_assignment_audit(vendor_id, created_at DESC);

ALTER TABLE public.territory_locality_mapping_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_zone_assignment_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.territory_locality_mapping_audit FROM anon, authenticated;
REVOKE ALL ON TABLE public.vendor_zone_assignment_audit FROM anon, authenticated;
GRANT SELECT ON TABLE public.territory_locality_mapping_audit TO service_role;
GRANT SELECT ON TABLE public.vendor_zone_assignment_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.territory_locality_mapping_audit_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.vendor_zone_assignment_audit_id_seq TO service_role;

-- Admin/COO-controlled mapping of MKH localities into MKH territories.
-- The existing same-LGA trigger remains in force; this RPC also checks it
-- explicitly and retains old links as inactive rows instead of deleting them.
CREATE OR REPLACE FUNCTION public.mkh_admin_set_territory_locality(
    p_locality_id uuid,
    p_territory_id uuid,
    p_action text,
    p_changed_by uuid,
    p_change_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_role text;
    v_locality_lga_id uuid;
    v_territory_lga_id uuid;
    v_existing_id uuid;
    v_mapping_id uuid;
BEGIN
    IF p_locality_id IS NULL OR p_territory_id IS NULL OR p_changed_by IS NULL THEN
        RAISE EXCEPTION 'Locality, territory and responsible Admin are required';
    END IF;
    IF p_action IS NULL OR p_action NOT IN ('assign', 'unassign') THEN
        RAISE EXCEPTION 'Choose a valid mapping action';
    END IF;
    IF length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 10 AND 500 THEN
        RAISE EXCEPTION 'Enter a mapping reason between 10 and 500 characters';
    END IF;

    SELECT lower(btrim(COALESCE(role, '')))
      INTO v_role
      FROM public.profiles
     WHERE id = p_changed_by;
    IF COALESCE(v_role, '') NOT IN ('admin', 'coo') THEN
        RAISE EXCEPTION 'Only MKH Admin or COO can manage territory coverage';
    END IF;

    -- Serialize mapping operations for this locality.
    SELECT lga_id
      INTO v_locality_lga_id
      FROM public.localities
     WHERE id = p_locality_id
       AND is_active = true
     FOR UPDATE;
    IF NOT FOUND OR v_locality_lga_id IS NULL THEN
        RAISE EXCEPTION 'The selected MKH locality is missing, inactive or has no LGA';
    END IF;

    SELECT lga_id
      INTO v_territory_lga_id
      FROM public.territories
     WHERE id = p_territory_id
       AND is_active = true
     FOR UPDATE;
    IF NOT FOUND OR v_territory_lga_id IS NULL THEN
        RAISE EXCEPTION 'The selected MKH territory is missing, inactive or has no LGA';
    END IF;

    IF v_locality_lga_id IS DISTINCT FROM v_territory_lga_id THEN
        RAISE EXCEPTION 'The MKH locality and territory must belong to the same LGA';
    END IF;

    SELECT id
      INTO v_existing_id
      FROM public.territory_localities
     WHERE locality_id = p_locality_id
       AND territory_id = p_territory_id
       AND status = 'active'
     FOR UPDATE;

    IF p_action = 'assign' THEN
        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'unchanged', true,
                'mapping_id', v_existing_id,
                'locality_id', p_locality_id,
                'territory_id', p_territory_id
            );
        END IF;

        INSERT INTO public.territory_localities (
            territory_id, locality_id, status, assigned_at, unassigned_at
        ) VALUES (
            p_territory_id, p_locality_id, 'active', now(), NULL
        )
        RETURNING id INTO v_mapping_id;

        INSERT INTO public.territory_locality_mapping_audit (
            territory_locality_id, locality_id, territory_id,
            action, changed_by, change_reason
        ) VALUES (
            v_mapping_id, p_locality_id, p_territory_id,
            'assigned', p_changed_by, btrim(p_change_reason)
        );

        RETURN jsonb_build_object(
            'success', true,
            'unchanged', false,
            'mapping_id', v_mapping_id,
            'locality_id', p_locality_id,
            'territory_id', p_territory_id
        );
    END IF;

    IF v_existing_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'unchanged', true,
            'already_unassigned', true,
            'locality_id', p_locality_id,
            'territory_id', p_territory_id
        );
    END IF;

    -- Never remove coverage that an active vendor currently depends on.
    IF EXISTS (
        SELECT 1
          FROM public.zone_vendors zv
          JOIN public.zones z ON z.id = zv.zone_id
          JOIN public.vendor_business_locations vbl ON vbl.vendor_id = zv.vendor_id
         WHERE zv.status = 'active'
           AND z.territory_id = p_territory_id
           AND vbl.locality_id = p_locality_id
    ) THEN
        RAISE EXCEPTION 'This locality/territory link is used by an actively assigned vendor. Reconcile that vendor assignment before removing the coverage link.';
    END IF;

    UPDATE public.territory_localities
       SET status = 'inactive',
           unassigned_at = now()
     WHERE id = v_existing_id;

    INSERT INTO public.territory_locality_mapping_audit (
        territory_locality_id, locality_id, territory_id,
        action, changed_by, change_reason
    ) VALUES (
        v_existing_id, p_locality_id, p_territory_id,
        'unassigned', p_changed_by, btrim(p_change_reason)
    );

    RETURN jsonb_build_object(
        'success', true,
        'unchanged', false,
        'unassigned', true,
        'mapping_id', v_existing_id,
        'locality_id', p_locality_id,
        'territory_id', p_territory_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_admin_set_territory_locality(uuid, uuid, text, uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_set_territory_locality(uuid, uuid, text, uuid, text)
    TO service_role;

-- Database-level guard: every NEW or reactivated vendor-zone assignment must
-- satisfy the existing address verification checks and an explicit active
-- MKH locality-to-territory link. Existing historical rows are not rewritten.
CREATE OR REPLACE FUNCTION public.mkh_validate_vendor_zone_geography()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_vendor_status text;
    v_address_status text;
    v_locality_status text;
    v_locality_id uuid;
    v_locality_active boolean;
    v_locality_lga_id uuid;
    v_zone_territory_id uuid;
    v_territory_lga_id uuid;
    v_mapping_id uuid;
BEGIN
    IF NEW.status <> 'active' THEN
        RETURN NEW;
    END IF;

    SELECT lower(btrim(COALESCE(v.status, '')))
      INTO v_vendor_status
      FROM public.vendors v
     WHERE v.id = NEW.vendor_id;
    IF NOT FOUND OR v_vendor_status <> 'active' THEN
        RAISE EXCEPTION 'Only an active MKH vendor can be assigned to a zone';
    END IF;

    SELECT vbl.address_verification_status,
           vbl.locality_match_status,
           vbl.locality_id
      INTO v_address_status, v_locality_status, v_locality_id
      FROM public.vendor_business_locations vbl
     WHERE vbl.vendor_id = NEW.vendor_id;

    IF NOT FOUND
       OR v_address_status IS DISTINCT FROM 'verified'
       OR v_locality_status IS DISTINCT FROM 'matched'
       OR v_locality_id IS NULL THEN
        RAISE EXCEPTION 'Vendor address verification and MKH locality matching must be complete before zone assignment';
    END IF;

    SELECT is_active, lga_id
      INTO v_locality_active, v_locality_lga_id
      FROM public.localities
     WHERE id = v_locality_id;
    IF NOT FOUND OR v_locality_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'The vendor verified MKH locality is missing or inactive';
    END IF;

    SELECT z.territory_id, t.lga_id
      INTO v_zone_territory_id, v_territory_lga_id
      FROM public.zones z
      JOIN public.territories t ON t.id = z.territory_id
     WHERE z.id = NEW.zone_id
       AND z.is_active = true
       AND t.is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected zone or its MKH territory is missing or inactive';
    END IF;
    IF v_locality_lga_id IS DISTINCT FROM v_territory_lga_id THEN
        RAISE EXCEPTION 'Vendor locality and selected zone territory do not belong to the same MKH LGA';
    END IF;

    SELECT tl.id
      INTO v_mapping_id
      FROM public.territory_localities tl
     WHERE tl.locality_id = v_locality_id
       AND tl.territory_id = v_zone_territory_id
       AND tl.status = 'active'
     FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The vendor verified MKH locality is not mapped to the selected zone territory';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mkh_validate_vendor_zone_geography ON public.zone_vendors;
CREATE TRIGGER trg_mkh_validate_vendor_zone_geography
BEFORE INSERT OR UPDATE OF zone_id, status
ON public.zone_vendors
FOR EACH ROW
EXECUTE FUNCTION public.mkh_validate_vendor_zone_geography();

REVOKE ALL ON FUNCTION public.mkh_validate_vendor_zone_geography() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_validate_vendor_zone_geography() TO service_role;

-- A new verified locality must not strand an existing vendor-zone assignment
-- outside the coverage of that vendor's newly verified MKH locality.
-- Pending/rejected address updates remain possible and continue to be blocked
-- by the existing delivery-quote safeguards.
CREATE OR REPLACE FUNCTION public.mkh_validate_vendor_location_zone_coverage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_locality_lga_id uuid;
    v_locality_active boolean;
    v_zone_territory_id uuid;
    v_territory_lga_id uuid;
    v_territory_active boolean;
    v_mapping_id uuid;
    v_assignment record;
BEGIN
    IF NEW.address_verification_status IS DISTINCT FROM 'verified'
       OR NEW.locality_match_status IS DISTINCT FROM 'matched'
       OR NEW.locality_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT is_active, lga_id
      INTO v_locality_active, v_locality_lga_id
      FROM public.localities
     WHERE id = NEW.locality_id;
    IF NOT FOUND OR v_locality_active IS DISTINCT FROM true OR v_locality_lga_id IS NULL THEN
        RAISE EXCEPTION 'A verified vendor business location must reference an active MKH locality with a valid LGA';
    END IF;

    FOR v_assignment IN
        SELECT z.territory_id
          FROM public.zone_vendors zv
          JOIN public.zones z ON z.id = zv.zone_id
         WHERE zv.vendor_id = NEW.vendor_id
           AND zv.status = 'active'
    LOOP
        v_zone_territory_id := v_assignment.territory_id;
        SELECT is_active, lga_id
          INTO v_territory_active, v_territory_lga_id
          FROM public.territories
         WHERE id = v_zone_territory_id;

        IF NOT FOUND OR v_territory_active IS DISTINCT FROM true OR v_territory_lga_id IS NULL THEN
            RAISE EXCEPTION 'The vendor has an active zone assignment with an inactive or invalid MKH territory';
        END IF;
        IF v_locality_lga_id IS DISTINCT FROM v_territory_lga_id THEN
            RAISE EXCEPTION 'The new verified MKH locality belongs to a different LGA from the vendor''s active zone territory';
        END IF;
        SELECT tl.id
          INTO v_mapping_id
          FROM public.territory_localities tl
         WHERE tl.locality_id = NEW.locality_id
           AND tl.territory_id = v_zone_territory_id
           AND tl.status = 'active'
         FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Map the new verified MKH locality to the vendor''s active zone territory before completing this location change';
        END IF;
    END LOOP;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mkh_validate_vendor_location_zone_coverage ON public.vendor_business_locations;
CREATE TRIGGER trg_mkh_validate_vendor_location_zone_coverage
BEFORE INSERT OR UPDATE OF locality_id, address_verification_status, locality_match_status
ON public.vendor_business_locations
FOR EACH ROW
EXECUTE FUNCTION public.mkh_validate_vendor_location_zone_coverage();

REVOKE ALL ON FUNCTION public.mkh_validate_vendor_location_zone_coverage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_validate_vendor_location_zone_coverage() TO service_role;

-- Atomic Admin/COO reassignment. The old zone_vendors row is retained as
-- inactive history; the new row and audit record are committed together.
CREATE OR REPLACE FUNCTION public.mkh_admin_assign_vendor_to_zone(
    p_vendor_id uuid,
    p_zone_id uuid,
    p_assigned_by uuid,
    p_change_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_role text;
    v_vendor_status text;
    v_address_status text;
    v_locality_status text;
    v_locality_id uuid;
    v_locality_active boolean;
    v_locality_lga_id uuid;
    v_zone_territory_id uuid;
    v_territory_lga_id uuid;
    v_mapping_id uuid;
    v_active_count integer;
    v_previous_id uuid;
    v_previous_zone_id uuid;
    v_new_assignment_id uuid;
BEGIN
    IF p_vendor_id IS NULL OR p_zone_id IS NULL OR p_assigned_by IS NULL THEN
        RAISE EXCEPTION 'Vendor, zone and responsible Admin are required';
    END IF;
    IF length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 10 AND 500 THEN
        RAISE EXCEPTION 'Enter an assignment reason between 10 and 500 characters';
    END IF;

    SELECT lower(btrim(COALESCE(role, '')))
      INTO v_role
      FROM public.profiles
     WHERE id = p_assigned_by;
    IF COALESCE(v_role, '') NOT IN ('admin', 'coo') THEN
        RAISE EXCEPTION 'Only MKH Admin or COO can assign a vendor to a zone';
    END IF;

    -- Lock the vendor to serialize assignment changes for this vendor.
    SELECT lower(btrim(COALESCE(status, '')))
      INTO v_vendor_status
      FROM public.vendors
     WHERE id = p_vendor_id
     FOR UPDATE;
    IF NOT FOUND OR v_vendor_status <> 'active' THEN
        RAISE EXCEPTION 'Only an active MKH vendor can be assigned to a zone';
    END IF;

    SELECT address_verification_status, locality_match_status, locality_id
      INTO v_address_status, v_locality_status, v_locality_id
      FROM public.vendor_business_locations
     WHERE vendor_id = p_vendor_id
     FOR UPDATE;
    IF NOT FOUND
       OR v_address_status IS DISTINCT FROM 'verified'
       OR v_locality_status IS DISTINCT FROM 'matched'
       OR v_locality_id IS NULL THEN
        RAISE EXCEPTION 'Complete Admin address verification and MKH locality matching before assigning this vendor';
    END IF;

    SELECT is_active, lga_id
      INTO v_locality_active, v_locality_lga_id
      FROM public.localities
     WHERE id = v_locality_id
     FOR SHARE;
    IF NOT FOUND OR v_locality_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'The vendor verified MKH locality is missing or inactive';
    END IF;

    SELECT z.territory_id, t.lga_id
      INTO v_zone_territory_id, v_territory_lga_id
      FROM public.zones z
      JOIN public.territories t ON t.id = z.territory_id
     WHERE z.id = p_zone_id
       AND z.is_active = true
       AND t.is_active = true
     FOR SHARE OF z, t;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected zone or its MKH territory is missing or inactive';
    END IF;
    IF v_locality_lga_id IS DISTINCT FROM v_territory_lga_id THEN
        RAISE EXCEPTION 'Vendor locality and selected zone territory do not belong to the same MKH LGA';
    END IF;

    SELECT tl.id
      INTO v_mapping_id
      FROM public.territory_localities tl
     WHERE tl.locality_id = v_locality_id
       AND tl.territory_id = v_zone_territory_id
       AND tl.status = 'active'
     FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected zone is outside the territory coverage mapped to this vendor''s verified MKH locality';
    END IF;

    SELECT count(*)
      INTO v_active_count
      FROM public.zone_vendors
     WHERE vendor_id = p_vendor_id
       AND status = 'active';
    IF v_active_count > 1 THEN
        RAISE EXCEPTION 'This vendor has multiple active zone assignments. Resolve the existing assignment records before making a change.';
    END IF;

    SELECT id, zone_id
      INTO v_previous_id, v_previous_zone_id
      FROM public.zone_vendors
     WHERE vendor_id = p_vendor_id
       AND status = 'active'
     FOR UPDATE;

    IF v_previous_id IS NOT NULL AND v_previous_zone_id = p_zone_id THEN
        RETURN jsonb_build_object(
            'success', true,
            'unchanged', true,
            'assignment_id', v_previous_id,
            'zone_id', p_zone_id,
            'territory_id', v_zone_territory_id,
            'locality_id', v_locality_id
        );
    END IF;

    IF v_previous_id IS NOT NULL THEN
        UPDATE public.zone_vendors
           SET status = 'inactive',
               unassigned_at = now()
         WHERE id = v_previous_id;
    END IF;

    INSERT INTO public.zone_vendors (
        vendor_id, zone_id, status, assigned_at, unassigned_at
    ) VALUES (
        p_vendor_id, p_zone_id, 'active', now(), NULL
    )
    RETURNING id INTO v_new_assignment_id;

    INSERT INTO public.vendor_zone_assignment_audit (
        vendor_id, locality_id, previous_zone_vendor_id, previous_zone_id,
        new_zone_vendor_id, new_zone_id, changed_by, change_reason
    ) VALUES (
        p_vendor_id, v_locality_id, v_previous_id, v_previous_zone_id,
        v_new_assignment_id, p_zone_id, p_assigned_by, btrim(p_change_reason)
    );

    RETURN jsonb_build_object(
        'success', true,
        'unchanged', false,
        'assignment_id', v_new_assignment_id,
        'previous_assignment_id', v_previous_id,
        'previous_zone_id', v_previous_zone_id,
        'zone_id', p_zone_id,
        'territory_id', v_zone_territory_id,
        'locality_id', v_locality_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_admin_assign_vendor_to_zone(uuid, uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_assign_vendor_to_zone(uuid, uuid, uuid, text)
    TO service_role;

COMMENT ON TABLE public.territory_locality_mapping_audit IS
    'Append-only Admin/COO audit for MKH locality-to-territory coverage changes.';
COMMENT ON TABLE public.vendor_zone_assignment_audit IS
    'Append-only Admin/COO audit for vendor-to-zone assignment changes; zone_vendors retains the operational assignment history.';
COMMENT ON FUNCTION public.mkh_validate_vendor_zone_geography() IS
    'Requires every new active vendor-zone assignment to match verified vendor locality and active MKH territory coverage.';

COMMIT;

-- READ-ONLY verification after applying to MKH-TEST:
-- SELECT to_regclass('public.territory_locality_mapping_audit'),
--        to_regclass('public.vendor_zone_assignment_audit');
-- SELECT indexname FROM pg_indexes WHERE schemaname='public'
--   AND indexname='territory_localities_active_pair_uidx';
-- SELECT tgname FROM pg_trigger
--   WHERE tgrelid='public.zone_vendors'::regclass
--     AND tgname='trg_mkh_validate_vendor_zone_geography';
-- SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid=pg_proc.pronamespace
--   WHERE n.nspname='public'
--     AND proname IN ('mkh_admin_set_territory_locality',
--                     'mkh_admin_assign_vendor_to_zone');
