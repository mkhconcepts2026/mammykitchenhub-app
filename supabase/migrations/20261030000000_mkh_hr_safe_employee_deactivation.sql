-- MKH HR: safe employee deactivation instead of destructive hard deletion.
-- Run only in the intended TEST Supabase project first.
-- The function keeps the employee row and historical references, while
-- removing active access and recording the action within one DB transaction.

CREATE OR REPLACE FUNCTION public.hr_deactivate_employee_safely(
    p_employee_id uuid,
    p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_employee public.employees%ROWTYPE;
    v_deactivated_assignments integer := 0;
BEGIN
    IF p_employee_id IS NULL OR p_actor_id IS NULL THEN
        RAISE EXCEPTION 'Employee and acting HR user are required.';
    END IF;

    -- Ensure the actor is still an active HR profile. The API also checks
    -- current_effective_app_role() in the caller's authenticated session.
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_actor_id
          AND lower(COALESCE(p.status, '')) = 'active'
    ) THEN
        RAISE EXCEPTION 'The acting HR profile is not active.';
    END IF;

    SELECT *
    INTO v_employee
    FROM public.employees e
    WHERE e.id = p_employee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee not found.';
    END IF;

    -- If already inactive, still ensure any lingering assignments are disabled.
    UPDATE public.employee_access_assignments
    SET is_active = false,
        effective_until = COALESCE(effective_until, now())
    WHERE employee_id = v_employee.id
      AND is_active = true;

    GET DIAGNOSTICS v_deactivated_assignments = ROW_COUNT;

    UPDATE public.employees
    SET status = 'inactive',
        employment_status = 'Terminated',
        updated_at = now()
    WHERE id = v_employee.id;

    IF v_employee.profile_id IS NOT NULL THEN
        UPDATE public.profiles
        SET status = 'inactive'
        WHERE id = v_employee.profile_id;
    END IF;

    INSERT INTO public.employee_audit_logs (
        employee_id,
        performed_by,
        action,
        description
    )
    VALUES (
        v_employee.id,
        p_actor_id,
        'EMPLOYEE_DEACTIVATED',
        'Employee removed from the active roster by HR. Active access assignments were revoked; historical employee and audit references were retained.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'employee_id', v_employee.id,
        'profile_id', v_employee.profile_id,
        'deactivated_assignments', v_deactivated_assignments,
        'historical_record_retained', true
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.hr_deactivate_employee_safely(uuid, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hr_deactivate_employee_safely(uuid, uuid)
    TO service_role;
