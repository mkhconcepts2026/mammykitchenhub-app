-- MKH: Reconcile legacy TRM territory fields into the authoritative assignment table.
-- Purpose: existing assignment UI can show employees.territory_id/profile.territory_id
-- while ZM/VHA RPCs correctly require an active mkh_trm_territory_assignments row.
-- This migration backfills only unambiguous, active, role-consistent TRM mappings.
-- Ambiguous territories (multiple eligible TRMs) are deliberately skipped.
-- No employee roles, wallet records, financial records, or payout logic are changed.

BEGIN;

DO $migration$
DECLARE
    v_inserted integer := 0;
BEGIN
    IF to_regclass('public.mkh_trm_territory_assignments') IS NULL THEN
        RAISE EXCEPTION 'Required table public.mkh_trm_territory_assignments is missing. Apply the role-aware employee assignment migration first.';
    END IF;

    WITH role_candidates AS (
        SELECT
            e.id AS employee_id,
            e.profile_id,
            COALESCE(e.territory_id, p.territory_id) AS territory_id,
            COALESCE(e.updated_at, e.created_at, now()) AS assigned_at
        FROM public.employees e
        JOIN public.employee_roles er ON er.id = e.role_id
        JOIN public.profiles p ON p.id = e.profile_id
        WHERE lower(trim(COALESCE(e.status, ''))) = 'active'
          AND lower(trim(COALESCE(e.employment_status, ''))) = 'active'
          AND lower(trim(COALESCE(p.status, ''))) = 'active'
          AND lower(trim(COALESCE(er.status, ''))) = 'active'
          AND regexp_replace(lower(trim(COALESCE(er.system_role, ''))), '[^a-z0-9]', '', 'g')
              IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
          AND regexp_replace(lower(trim(COALESCE(p.role, ''))), '[^a-z0-9]', '', 'g')
              IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
          AND (e.territory_id IS NOT NULL OR p.territory_id IS NOT NULL)
          -- Do not seed a legacy assignment if the employee has another effective app role.
          AND NOT EXISTS (
              SELECT 1
              FROM public.employee_access_assignments ea
              JOIN public.employee_roles ar ON ar.id = ea.role_id
              WHERE (ea.employee_id = e.id OR ea.profile_id = e.profile_id)
                AND ea.is_active IS TRUE
                AND (ea.effective_from IS NULL OR ea.effective_from <= now())
                AND (ea.effective_until IS NULL OR ea.effective_until > now())
                AND regexp_replace(lower(trim(COALESCE(ar.system_role, ''))), '[^a-z0-9]', '', 'g')
                    NOT IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
          )
    ),
    valid_candidates AS (
        SELECT
            c.employee_id,
            c.profile_id,
            c.territory_id,
            c.assigned_at,
            COUNT(*) OVER (PARTITION BY c.territory_id) AS trm_count_for_territory
        FROM role_candidates c
        JOIN public.territories t
          ON t.id = c.territory_id
         AND t.is_active IS TRUE
    ),
    inserted AS (
        INSERT INTO public.mkh_trm_territory_assignments (
            employee_id,
            territory_id,
            status,
            assigned_by,
            assigned_at
        )
        SELECT
            c.employee_id,
            c.territory_id,
            'active',
            NULL,
            c.assigned_at
        FROM valid_candidates c
        WHERE c.trm_count_for_territory = 1
          -- Do not overwrite or duplicate any existing active employee/territory mapping.
          AND NOT EXISTS (
              SELECT 1
              FROM public.mkh_trm_territory_assignments existing
              WHERE existing.status = 'active'
                AND (
                    existing.employee_id = c.employee_id
                    OR existing.territory_id = c.territory_id
                )
          )
        ON CONFLICT DO NOTHING
        RETURNING employee_id
    )
    SELECT COUNT(*) INTO v_inserted FROM inserted;

    RAISE NOTICE 'MKH TRM reconciliation completed: % unambiguous legacy assignment(s) added. Ambiguous or conflicting assignments were left unchanged.', v_inserted;
END;
$migration$;

COMMIT;

-- Return the authoritative active TRM assignments for immediate review.
SELECT
    e.id AS employee_id,
    concat_ws(' ', e.first_name, e.last_name) AS trm_name,
    t.id AS territory_id,
    t.name AS territory_name,
    a.status AS assignment_status,
    a.assigned_at
FROM public.mkh_trm_territory_assignments a
JOIN public.employees e ON e.id = a.employee_id
JOIN public.territories t ON t.id = a.territory_id
WHERE a.status = 'active'
ORDER BY t.name, trm_name;
