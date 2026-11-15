-- MKH HR: safe employee account reactivation.
-- Adds an isolated activation RPC; does not replace or modify the existing
-- hr_deactivate_employee_safely or employee approval functions.
-- The API unbans the Auth user first, then calls this transaction. The profile
-- remains inactive if this function rejects the transition.

BEGIN;

CREATE OR REPLACE FUNCTION public.hr_activate_employee_safely(
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
    v_profile_status text;
BEGIN
    IF p_employee_id IS NULL OR p_actor_id IS NULL THEN
        RAISE EXCEPTION 'Employee and acting HR user are required.';
    END IF;

    -- Mirror the existing safe-deactivation actor guard. The API additionally
    -- checks current_effective_app_role() = HR in the authenticated session.
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

    IF v_employee.profile_id IS NULL THEN
        RAISE EXCEPTION 'Employee has no linked login profile.';
    END IF;

    SELECT lower(COALESCE(p.status, ''))
    INTO v_profile_status
    FROM public.profiles p
    WHERE p.id = v_employee.profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked employee profile was not found.';
    END IF;

    -- Safe retry: do not create a duplicate audit event if the employee is
    -- already active in all three lifecycle fields.
    IF lower(COALESCE(v_employee.status, '')) = 'active'
       AND lower(COALESCE(v_employee.employment_status, '')) = 'active'
       AND v_profile_status = 'active'
    THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_active', true,
            'employee_id', v_employee.id,
            'profile_id', v_employee.profile_id,
            'historical_record_retained', true,
            'assignments_changed', false
        );
    END IF;

    -- Only reverse the exact state written by the certified safe-deactivation
    -- workflow. Onboarding/pending/rejected records are deliberately excluded
    -- and remain under the existing HR approval workflow.
    IF lower(COALESCE(v_employee.status, '')) <> 'inactive'
       OR lower(COALESCE(v_employee.employment_status, '')) <> 'terminated'
       OR v_profile_status <> 'inactive'
    THEN
        RAISE EXCEPTION
            'Only an employee in the inactive/terminated state with an inactive profile can be reactivated.';
    END IF;

    UPDATE public.employees
    SET status = 'active',
        employment_status = 'Active',
        updated_at = now()
    WHERE id = v_employee.id;

    UPDATE public.profiles
    SET status = 'active'
    WHERE id = v_employee.profile_id;

    -- Important: do not reactivate employee_access_assignments, change the
    -- employee/profile role, or change TRM/ZM/VHA operational assignments.
    -- Admin's existing role/operational assignment workflow remains authoritative.
    INSERT INTO public.employee_audit_logs (
        employee_id,
        performed_by,
        action,
        description
    )
    VALUES (
        v_employee.id,
        p_actor_id,
        'EMPLOYEE_ACTIVATED',
        'Employee account reactivated by HR. Employee and profile statuses were restored; role identity, employee access assignments, operational assignments, and their histories were not changed.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'employee_id', v_employee.id,
        'profile_id', v_employee.profile_id,
        'historical_record_retained', true,
        'assignments_changed', false,
        'reactivated_access_assignments', 0
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.hr_activate_employee_safely(uuid, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hr_activate_employee_safely(uuid, uuid)
    TO service_role;

COMMIT;
