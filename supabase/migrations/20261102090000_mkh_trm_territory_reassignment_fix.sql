-- MKH TRM territory reassignment correction
-- Review-only migration. Apply manually in the intended Supabase project after approval.
-- Preserves roles, financial data, assignment history, and geographic integrity.

BEGIN;


-- TRM employee/profile territory equality must be checked after both rows
-- have been updated, not before each individual row update. This keeps the
-- integrity rule while allowing the Admin RPC to update both sides atomically.
CREATE OR REPLACE FUNCTION public.enforce_employee_profile_territory_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_profile_role text;
    v_employee_territory_id uuid;
    v_profile_territory_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'employees' THEN
        SELECT p.role, p.territory_id, e.territory_id
          INTO v_profile_role, v_profile_territory_id, v_employee_territory_id
          FROM public.employees e
          JOIN public.profiles p ON p.id = e.profile_id
         WHERE e.id = NEW.id;

        IF FOUND
           AND regexp_replace(lower(trim(COALESCE(v_profile_role, ''))), '[^a-z0-9]', '', 'g')
               IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
           AND v_employee_territory_id IS DISTINCT FROM v_profile_territory_id THEN
            RAISE EXCEPTION 'TERRITORY profile Territory must match employee Territory';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'profiles' THEN
        IF EXISTS (
            SELECT 1
              FROM public.profiles p
              JOIN public.employees e ON e.profile_id = p.id
             WHERE p.id = NEW.id
               AND regexp_replace(lower(trim(COALESCE(p.role, ''))), '[^a-z0-9]', '', 'g')
                   IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
               AND e.territory_id IS NOT NULL
               AND e.territory_id IS DISTINCT FROM p.territory_id
        ) THEN
            RAISE EXCEPTION 'TERRITORY profile Territory must match employee Territory';
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_employee_profile_territory ON public.employees;
DROP TRIGGER IF EXISTS trg_enforce_profile_employee_territory ON public.profiles;

CREATE CONSTRAINT TRIGGER trg_enforce_employee_profile_territory
AFTER INSERT OR UPDATE OF profile_id, territory_id
ON public.employees
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_employee_profile_territory_integrity();

CREATE CONSTRAINT TRIGGER trg_enforce_profile_employee_territory
AFTER INSERT OR UPDATE OF territory_id, role
ON public.profiles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_employee_profile_territory_integrity();

CREATE OR REPLACE FUNCTION public.mkh_admin_assign_trm_to_territory(
    p_employee_id uuid,
    p_territory_id uuid,
    p_assigned_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
    v_profile_id uuid;
    v_role text;
    v_profile_role text;
    v_old_territory uuid;
    v_previous_reference uuid;
    v_territory_active boolean;
    v_territory_lga_id uuid;
    v_territory_state_id uuid;
BEGIN
    IF p_employee_id IS NULL OR p_territory_id IS NULL OR p_assigned_by IS NULL THEN
        RAISE EXCEPTION 'Employee, territory and assigning administrator are required.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_assigned_by) THEN
        RAISE EXCEPTION 'The assigning administrator profile could not be confirmed.';
    END IF;

    SELECT e.profile_id,
           regexp_replace(lower(trim(COALESCE(er.system_role, ''))), '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(trim(COALESCE(p.role, ''))), '[^a-z0-9]', '', 'g'),
           (SELECT a.territory_id
              FROM public.mkh_trm_territory_assignments a
             WHERE a.employee_id = e.id AND a.status = 'active'
             ORDER BY a.assigned_at DESC
             LIMIT 1),
           COALESCE(
               (SELECT a.territory_id
                  FROM public.mkh_trm_territory_assignments a
                 WHERE a.employee_id = e.id AND a.status = 'active'
                 ORDER BY a.assigned_at DESC
                 LIMIT 1),
               e.territory_id,
               p.territory_id
           )
      INTO v_profile_id, v_role, v_profile_role, v_old_territory, v_previous_reference
      FROM public.employees e
      JOIN public.employee_roles er ON er.id = e.role_id
      JOIN public.profiles p ON p.id = e.profile_id
     WHERE e.id = p_employee_id
     FOR UPDATE OF e, p;

    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Employee not found.'; END IF;
    IF COALESCE(v_role, '') NOT IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
       OR COALESCE(v_profile_role, '') NOT IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager') THEN
        RAISE EXCEPTION 'Only a genuine TRM/Territory role can receive a territory assignment. Resolve role mismatches first.';
    END IF;
    PERFORM public.mkh_assert_employee_operational_role(p_employee_id, 'trm');

    SELECT t.is_active, t.lga_id, lg.state_id
      INTO v_territory_active, v_territory_lga_id, v_territory_state_id
      FROM public.territories t
      LEFT JOIN public.local_governments lg ON lg.id = t.lga_id
     WHERE t.id = p_territory_id
     FOR UPDATE OF t;

    IF v_territory_active IS DISTINCT FROM TRUE
       OR v_territory_lga_id IS NULL
       OR v_territory_state_id IS NULL THEN
        RAISE EXCEPTION 'Selected territory is missing, inactive, or has no valid LGA/State mapping.';
    END IF;

    -- The active assignment-history table alone determines territory ownership.
    -- Legacy employee/profile territory references are not treated as active assignments.
    IF EXISTS (
        SELECT 1 FROM public.mkh_trm_territory_assignments a
        WHERE a.territory_id = p_territory_id AND a.status = 'active'
          AND a.employee_id <> p_employee_id
    ) THEN
        RAISE EXCEPTION 'This territory is already assigned to another TRM.';
    END IF;

    -- Do not move a TRM while active ZM/vendor coverage remains under the old territory.
    IF v_old_territory IS NOT NULL AND v_old_territory <> p_territory_id
       AND (
          EXISTS (
              SELECT 1
              FROM public.zonal_manager_zones zm
              JOIN public.zones z ON z.id = zm.zone_id
              WHERE z.territory_id = v_old_territory
                AND zm.status = 'active' AND zm.unassigned_at IS NULL
          )
          OR EXISTS (
              SELECT 1
              FROM public.zone_vendors zv
              JOIN public.zones z ON z.id = zv.zone_id
              WHERE z.territory_id = v_old_territory
                AND zv.status = 'active' AND zv.unassigned_at IS NULL
          )
       ) THEN
        RAISE EXCEPTION 'This TRM currently covers a territory with assigned zones or vendors. Move/reassign that coverage before moving the TRM.';
    END IF;

    -- Keep a same-territory assignment idempotent, while repairing geography/profile sync.
    IF EXISTS (
        SELECT 1 FROM public.mkh_trm_territory_assignments a
        WHERE a.employee_id = p_employee_id
          AND a.territory_id = p_territory_id
          AND a.status = 'active'
    ) THEN
        UPDATE public.employees
           SET state_id = v_territory_state_id,
               lga_id = v_territory_lga_id,
               territory_id = p_territory_id,
               updated_at = now()
         WHERE id = p_employee_id;
        UPDATE public.profiles SET territory_id = p_territory_id WHERE id = v_profile_id;
        RETURN;
    END IF;

    -- Close the previous history row and create the new one in this same transaction.
    UPDATE public.mkh_trm_territory_assignments
       SET status = 'inactive', deactivated_at = now()
     WHERE employee_id = p_employee_id AND status = 'active';

    INSERT INTO public.mkh_trm_territory_assignments(employee_id, territory_id, status, assigned_by)
    VALUES (p_employee_id, p_territory_id, 'active', p_assigned_by);

    -- State, LGA and territory are updated together so the geographic trigger
    -- validates the destination's real administrative hierarchy.
    UPDATE public.employees
       SET state_id = v_territory_state_id,
           lga_id = v_territory_lga_id,
           territory_id = p_territory_id,
           updated_at = now()
     WHERE id = p_employee_id;

    UPDATE public.profiles SET territory_id = p_territory_id WHERE id = v_profile_id;

    INSERT INTO public.mkh_operational_assignment_audit(
        employee_id, assignment_type, previous_target_id, new_target_id, assigned_by
    ) VALUES (p_employee_id, 'trm_territory', v_previous_reference, p_territory_id, p_assigned_by);
END;
$fn$;

COMMIT;
