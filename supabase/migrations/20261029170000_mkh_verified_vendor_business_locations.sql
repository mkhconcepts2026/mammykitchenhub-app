-- MKH: Admin-verified vendor business locations for precise delivery-route origins.
-- TEST FIRST. This additive migration does not edit vendors, vendor applications,
-- KYC decisions, orders, payments, wallets, payout allocations, or settlement functions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_business_locations (
    vendor_id uuid PRIMARY KEY
        REFERENCES public.vendors(id) ON DELETE RESTRICT,
    business_address text NOT NULL
        CHECK (length(btrim(business_address)) >= 8),
    google_place_id text NOT NULL
        CHECK (length(btrim(google_place_id)) BETWEEN 1 AND 512),
    latitude double precision NOT NULL
        CHECK (latitude >= -90 AND latitude <= 90),
    longitude double precision NOT NULL
        CHECK (longitude >= -180 AND longitude <= 180),
    locality_id uuid NOT NULL
        REFERENCES public.localities(id) ON DELETE RESTRICT,
    locality_name_snapshot text NOT NULL,
    lcda_name_snapshot text NULL,
    lga_name_snapshot text NULL,
    verified_by uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
    verified_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_business_locations_locality_idx
    ON public.vendor_business_locations(locality_id);
CREATE INDEX IF NOT EXISTS vendor_business_locations_verified_idx
    ON public.vendor_business_locations(verified_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_business_location_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id uuid NOT NULL
        REFERENCES public.vendors(id) ON DELETE RESTRICT,
    previous_values jsonb NULL,
    new_values jsonb NOT NULL,
    changed_by uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
    change_reason text NOT NULL
        CHECK (length(btrim(change_reason)) >= 10 AND length(change_reason) <= 500),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_business_location_audit_vendor_idx
    ON public.vendor_business_location_audit(vendor_id, created_at DESC);

ALTER TABLE public.vendor_business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_business_location_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vendor_business_locations FROM anon, authenticated;
REVOKE ALL ON TABLE public.vendor_business_location_audit FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_business_locations TO service_role;
GRANT SELECT ON TABLE public.vendor_business_location_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.vendor_business_location_audit_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.mkh_admin_save_vendor_business_location(
    p_vendor_id uuid,
    p_business_address text,
    p_google_place_id text,
    p_latitude double precision,
    p_longitude double precision,
    p_locality_id uuid,
    p_locality_name_snapshot text,
    p_lcda_name_snapshot text,
    p_lga_name_snapshot text,
    p_verified_by uuid,
    p_change_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_old public.vendor_business_locations%ROWTYPE;
    v_saved public.vendor_business_locations%ROWTYPE;
    v_had_old boolean := false;
    v_before jsonb := NULL;
    v_role text;
BEGIN
    IF p_vendor_id IS NULL OR p_locality_id IS NULL OR p_verified_by IS NULL THEN
        RAISE EXCEPTION 'Vendor, locality and verifying Admin are required';
    END IF;
    IF length(btrim(COALESCE(p_business_address, ''))) < 8 THEN
        RAISE EXCEPTION 'A complete Google Maps business address is required';
    END IF;
    IF length(btrim(COALESCE(p_google_place_id, ''))) NOT BETWEEN 1 AND 512 THEN
        RAISE EXCEPTION 'A valid Google place ID is required';
    END IF;
    IF p_latitude IS NULL OR p_latitude < -90 OR p_latitude > 90
       OR p_longitude IS NULL OR p_longitude < -180 OR p_longitude > 180 THEN
        RAISE EXCEPTION 'Valid Google Maps coordinates are required';
    END IF;
    IF length(btrim(COALESCE(p_change_reason, ''))) < 10
       OR length(p_change_reason) > 500 THEN
        RAISE EXCEPTION 'A verification reason between 10 and 500 characters is required';
    END IF;

    SELECT lower(COALESCE(role, ''))
      INTO v_role
      FROM public.profiles
     WHERE id = p_verified_by;
    IF COALESCE(v_role, '') NOT IN ('admin', 'coo') THEN
        RAISE EXCEPTION 'Only MKH Admin or COO may verify vendor business locations';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.vendors
        WHERE id = p_vendor_id AND lower(COALESCE(status, '')) = 'active'
    ) THEN
        RAISE EXCEPTION 'Only an active vendor can have a delivery origin verified';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.localities
        WHERE id = p_locality_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'The selected MKH locality is missing or inactive';
    END IF;

    SELECT * INTO v_old
      FROM public.vendor_business_locations
     WHERE vendor_id = p_vendor_id
     FOR UPDATE;
    v_had_old := FOUND;
    IF v_had_old THEN
        v_before := to_jsonb(v_old);
    END IF;

    INSERT INTO public.vendor_business_locations (
        vendor_id, business_address, google_place_id, latitude, longitude,
        locality_id, locality_name_snapshot, lcda_name_snapshot,
        lga_name_snapshot, verified_by, verified_at, created_at, updated_at
    ) VALUES (
        p_vendor_id, btrim(p_business_address), btrim(p_google_place_id),
        p_latitude, p_longitude, p_locality_id,
        btrim(p_locality_name_snapshot), NULLIF(btrim(COALESCE(p_lcda_name_snapshot, '')), ''),
        NULLIF(btrim(COALESCE(p_lga_name_snapshot, '')), ''),
        p_verified_by, now(), now(), now()
    )
    ON CONFLICT (vendor_id) DO UPDATE SET
        business_address = EXCLUDED.business_address,
        google_place_id = EXCLUDED.google_place_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        locality_id = EXCLUDED.locality_id,
        locality_name_snapshot = EXCLUDED.locality_name_snapshot,
        lcda_name_snapshot = EXCLUDED.lcda_name_snapshot,
        lga_name_snapshot = EXCLUDED.lga_name_snapshot,
        verified_by = EXCLUDED.verified_by,
        verified_at = now(),
        updated_at = now()
    RETURNING * INTO v_saved;

    INSERT INTO public.vendor_business_location_audit (
        vendor_id, previous_values, new_values, changed_by, change_reason
    ) VALUES (
        p_vendor_id, v_before, to_jsonb(v_saved), p_verified_by, btrim(p_change_reason)
    );

    RETURN to_jsonb(v_saved);
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_admin_save_vendor_business_location(
    uuid, text, text, double precision, double precision, uuid, text, text, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_save_vendor_business_location(
    uuid, text, text, double precision, double precision, uuid, text, text, text, uuid, text
) TO service_role;

COMMENT ON TABLE public.vendor_business_locations IS
    'Admin-verified operational vendor origin for delivery routing; independent from KYC application history and settlement data.';
COMMENT ON TABLE public.vendor_business_location_audit IS
    'Append-only snapshots of vendor business-location edits with Admin identity and reason.';

COMMIT;

-- Read-only verification after applying in MKH TEST:
-- SELECT to_regclass('public.vendor_business_locations'), to_regclass('public.vendor_business_location_audit');
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_business_locations' ORDER BY ordinal_position;
-- SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid=pg_proc.pronamespace WHERE n.nspname='public' AND proname='mkh_admin_save_vendor_business_location';
