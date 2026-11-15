BEGIN;

-- ============================================================
-- MKH FINANCE BENEFICIARY VERIFICATION
-- Explicit Admin / Finance / COO verification.
-- Wallet balances are never changed by this migration/function.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_beneficiary_verification_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_id uuid NOT NULL,
    beneficiary_type text NOT NULL
        CHECK (beneficiary_type IN ('trm', 'zm', 'vha')),
    profile_id uuid NOT NULL,
    wallet_id uuid NOT NULL,
    action text NOT NULL CHECK (action = 'verified'),
    performed_by uuid NOT NULL,
    reason text NOT NULL,
    before_state jsonb NOT NULL,
    after_state jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_beneficiary_verification_audit_created
    ON public.delivery_beneficiary_verification_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_beneficiary_verification_audit_profile
    ON public.delivery_beneficiary_verification_audit(profile_id, created_at DESC);

ALTER TABLE public.delivery_beneficiary_verification_audit
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.delivery_beneficiary_verification_audit
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.delivery_beneficiary_verification_audit
    TO service_role;


CREATE OR REPLACE FUNCTION public.mkh_verify_delivery_beneficiary(
    p_beneficiary_type text,
    p_profile_id uuid,
    p_actor_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
    v_type text;
    v_profile public.profiles%ROWTYPE;
    v_registry public.delivery_beneficiary_registry%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_employee public.employees%ROWTYPE;

    v_registry_count integer := 0;
    v_employee_count integer := 0;
    v_wallet_count integer := 0;
    v_assignment_count integer := 0;
    v_candidate_count integer := 0;

    v_profile_role text;
    v_expected_role text[];
    v_zone_id uuid;

    v_before jsonb;
    v_after jsonb;
    v_actor_status text;
BEGIN
    v_type := lower(trim(COALESCE(p_beneficiary_type, '')));

    IF v_type NOT IN ('trm', 'zm', 'vha') THEN
        RAISE EXCEPTION 'Unsupported beneficiary type.';
    END IF;

    IF p_profile_id IS NULL OR p_actor_id IS NULL THEN
        RAISE EXCEPTION 'Beneficiary and authorised verifier IDs are required.';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5
       OR length(trim(p_reason)) > 500 THEN
        RAISE EXCEPTION 'Verification reason must contain 5 to 500 characters.';
    END IF;

    -- The API supplies the authenticated user's ID after checking
    -- current_effective_app_role() and active profile status.
    SELECT status
      INTO v_actor_status
      FROM public.profiles
     WHERE id = p_actor_id;

    IF NOT FOUND OR lower(COALESCE(v_actor_status, '')) <> 'active' THEN
        RAISE EXCEPTION 'The verifying account is not active.';
    END IF;

    CASE v_type
        WHEN 'trm' THEN
            v_expected_role := ARRAY['trm', 'territory', 'territoryrelationshipmanager'];
        WHEN 'zm' THEN
            v_expected_role := ARRAY['zm', 'zonemanager', 'zonalmanager'];
        WHEN 'vha' THEN
            v_expected_role := ARRAY['vha', 'vendorhubagent'];
    END CASE;

    -- Lock the beneficiary profile and confirm the profile role.
    SELECT *
      INTO v_profile
      FROM public.profiles
     WHERE id = p_profile_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Beneficiary profile does not exist.';
    END IF;

    IF lower(COALESCE(v_profile.status, '')) <> 'active' THEN
        RAISE EXCEPTION 'Beneficiary profile must be active before verification.';
    END IF;

    v_profile_role := regexp_replace(
        lower(COALESCE(v_profile.role::text, '')),
        '[^a-z0-9]', '', 'g'
    );

    IF NOT (v_profile_role = ANY(v_expected_role)) THEN
        RAISE EXCEPTION 'Profile role does not match the selected beneficiary type.';
    END IF;

    -- Exactly one registry row is required.
    SELECT count(*)::integer
      INTO v_registry_count
      FROM public.delivery_beneficiary_registry
     WHERE beneficiary_type = v_type
       AND profile_id = p_profile_id;

    IF v_registry_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one beneficiary registry record; found %.',
            v_registry_count;
    END IF;

    SELECT *
      INTO v_registry
      FROM public.delivery_beneficiary_registry
     WHERE beneficiary_type = v_type
       AND profile_id = p_profile_id
     FOR UPDATE;

    IF v_registry.is_active IS TRUE
       AND v_registry.verified_at IS NOT NULL
       AND v_registry.verified_by IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_verified', true,
            'profile_id', p_profile_id,
            'beneficiary_type', v_type,
            'message', 'Beneficiary is already verified. No changes made.'
        );
    END IF;

    IF v_registry.is_active IS TRUE
       OR v_registry.verified_at IS NOT NULL
       OR v_registry.verified_by IS NOT NULL THEN
        RAISE EXCEPTION
            'Registry has an inconsistent or previously altered verification state. Manual reconciliation required.';
    END IF;

    IF v_registry.wallet_id IS NULL THEN
        RAISE EXCEPTION 'Beneficiary registry has no linked wallet.';
    END IF;

    -- Exactly one active employee assignment with a matching role.
    SELECT count(*)::integer
      INTO v_employee_count
      FROM public.employees e
      JOIN public.employee_roles er ON er.id = e.role_id
     WHERE e.profile_id = p_profile_id
       AND lower(COALESCE(e.status, '')) = 'active'
       AND lower(COALESCE(e.employment_status, '')) = 'active'
       AND lower(COALESCE(er.status, '')) = 'active'
       AND regexp_replace(
            lower(COALESCE(er.system_role, '')),
            '[^a-z0-9]', '', 'g'
       ) = ANY(v_expected_role);

    IF v_employee_count <> 1 THEN
        RAISE EXCEPTION
            'Exactly one active employee assignment with the matching role is required; found %.',
            v_employee_count;
    END IF;

    SELECT e.*
      INTO v_employee
      FROM public.employees e
      JOIN public.employee_roles er ON er.id = e.role_id
     WHERE e.profile_id = p_profile_id
       AND lower(COALESCE(e.status, '')) = 'active'
       AND lower(COALESCE(e.employment_status, '')) = 'active'
       AND lower(COALESCE(er.status, '')) = 'active'
       AND regexp_replace(
            lower(COALESCE(er.system_role, '')),
            '[^a-z0-9]', '', 'g'
       ) = ANY(v_expected_role)
     LIMIT 1;

    -- TRM must have an active territory assignment.
    -- The territory must resolve to exactly one eligible TRM.
    IF v_type = 'trm' THEN
        IF v_employee.territory_id IS NULL THEN
            RAISE EXCEPTION 'TRM must have a territory assignment.';
        END IF;

        SELECT count(DISTINCT e.profile_id)::integer
          INTO v_candidate_count
          FROM public.employees e
          JOIN public.employee_roles er ON er.id = e.role_id
          JOIN public.profiles p ON p.id = e.profile_id
         WHERE e.territory_id = v_employee.territory_id
           AND lower(COALESCE(e.status, '')) = 'active'
           AND lower(COALESCE(e.employment_status, '')) = 'active'
           AND lower(COALESCE(er.status, '')) = 'active'
           AND lower(COALESCE(p.status, '')) = 'active'
           AND regexp_replace(
                lower(COALESCE(er.system_role, '')),
                '[^a-z0-9]', '', 'g'
           ) = ANY(v_expected_role);

        IF v_candidate_count <> 1 THEN
            RAISE EXCEPTION
                'Territory must resolve to exactly one active TRM; found %.',
                v_candidate_count;
        END IF;
    END IF;

    -- ZM must be linked to at least one active zone.
    -- Each assigned active zone must resolve to exactly one active ZM.
    IF v_type = 'zm' THEN
        SELECT count(DISTINCT zmz.zone_id)::integer
          INTO v_assignment_count
          FROM public.zonal_manager_zones zmz
          JOIN public.zones z
            ON z.id = zmz.zone_id
           AND z.is_active IS TRUE
         WHERE zmz.employee_id = v_employee.id
           AND lower(COALESCE(zmz.status, '')) = 'active';

        IF v_assignment_count < 1 THEN
            RAISE EXCEPTION 'ZM must have at least one active zone assignment.';
        END IF;

        FOR v_zone_id IN
            SELECT DISTINCT zmz.zone_id
              FROM public.zonal_manager_zones zmz
              JOIN public.zones z
                ON z.id = zmz.zone_id
               AND z.is_active IS TRUE
             WHERE zmz.employee_id = v_employee.id
               AND lower(COALESCE(zmz.status, '')) = 'active'
        LOOP
            SELECT count(DISTINCT e.profile_id)::integer
              INTO v_candidate_count
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
               AND regexp_replace(
                    lower(COALESCE(er.system_role, '')),
                    '[^a-z0-9]', '', 'g'
               ) = ANY(v_expected_role);

            IF v_candidate_count <> 1 THEN
                RAISE EXCEPTION
                    'Zone % must resolve to exactly one active ZM; found %.',
                    v_zone_id,
                    v_candidate_count;
            END IF;
        END LOOP;
    END IF;

    -- VHA must have exactly one active assignment to its vendor.
    IF v_type = 'vha' THEN
        IF v_employee.assigned_vendor_id IS NULL THEN
            RAISE EXCEPTION 'VHA must be assigned to a vendor.';
        END IF;

        SELECT count(DISTINCT e.profile_id)::integer
          INTO v_candidate_count
          FROM public.employees e
          JOIN public.employee_roles er ON er.id = e.role_id
          JOIN public.profiles p ON p.id = e.profile_id
         WHERE e.assigned_vendor_id = v_employee.assigned_vendor_id
           AND lower(COALESCE(e.status, '')) = 'active'
           AND lower(COALESCE(e.employment_status, '')) = 'active'
           AND lower(COALESCE(er.status, '')) = 'active'
           AND lower(COALESCE(p.status, '')) = 'active'
           AND regexp_replace(
                lower(COALESCE(er.system_role, '')),
                '[^a-z0-9]', '', 'g'
           ) = ANY(v_expected_role);

        IF v_candidate_count <> 1 THEN
            RAISE EXCEPTION
                'Vendor must resolve to exactly one active VHA; found %.',
                v_candidate_count;
        END IF;
    END IF;

    -- Validate the existing wallet. Do not create, credit or reset it here.
    SELECT count(*)::integer
      INTO v_wallet_count
      FROM public.wallets
     WHERE owner_type = v_type
       AND owner_id = p_profile_id;

    IF v_wallet_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one existing % wallet for this profile; found %.',
            v_type,
            v_wallet_count;
    END IF;

    SELECT *
      INTO v_wallet
      FROM public.wallets
     WHERE owner_type = v_type
       AND owner_id = p_profile_id
     FOR UPDATE;

    IF v_wallet.id IS DISTINCT FROM v_registry.wallet_id THEN
        RAISE EXCEPTION
            'Registry wallet does not match the existing beneficiary wallet.';
    END IF;

    v_before := to_jsonb(v_registry);

    UPDATE public.delivery_beneficiary_registry
       SET is_active = true,
           verified_at = now(),
           verified_by = p_actor_id,
           notes = concat_ws(
               E'\n',
               NULLIF(notes, ''),
               'Verified by authorised Finance/Admin user. Reason: ' || trim(p_reason)
           ),
           updated_at = now()
     WHERE id = v_registry.id;

    SELECT *
      INTO v_registry
      FROM public.delivery_beneficiary_registry
     WHERE id = v_registry.id;

    v_after := to_jsonb(v_registry);

    INSERT INTO public.delivery_beneficiary_verification_audit (
        registry_id,
        beneficiary_type,
        profile_id,
        wallet_id,
        action,
        performed_by,
        reason,
        before_state,
        after_state
    )
    VALUES (
        v_registry.id,
        v_type,
        p_profile_id,
        v_wallet.id,
        'verified',
        p_actor_id,
        trim(p_reason),
        v_before,
        v_after
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_verified', false,
        'beneficiary_type', v_type,
        'profile_id', p_profile_id,
        'registry_id', v_registry.id,
        'wallet_id', v_wallet.id,
        'verified_at', v_registry.verified_at,
        'verified_by', p_actor_id,
        'wallet_balance_changed', false,
        'message', 'Beneficiary verification completed. No funds moved.'
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.mkh_verify_delivery_beneficiary(
    text, uuid, uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mkh_verify_delivery_beneficiary(
    text, uuid, uuid, text
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;