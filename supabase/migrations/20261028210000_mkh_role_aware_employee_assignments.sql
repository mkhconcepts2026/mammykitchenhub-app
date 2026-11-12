-- MKH role-aware operational assignment workflow
-- TRM -> Territory; ZM -> Zone; VHA -> Vendor.
-- Admin/COO authorization is enforced by the server route; RPC execution is service_role-only.
-- Role identity is never changed here. Assignment history is retained. No financial rows or balances are touched.

BEGIN;

-- 1. Keep an explicit, historical record of TRM-to-territory assignments.
CREATE TABLE IF NOT EXISTS public.mkh_trm_territory_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    assigned_by uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    deactivated_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mkh_trm_one_active_employee_idx
    ON public.mkh_trm_territory_assignments(employee_id)
    WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS mkh_trm_one_active_territory_idx
    ON public.mkh_trm_territory_assignments(territory_id)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS mkh_trm_assignment_history_idx
    ON public.mkh_trm_territory_assignments(territory_id, assigned_at DESC);
ALTER TABLE public.mkh_trm_territory_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mkh_trm_territory_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkh_trm_territory_assignments TO service_role;

-- Existing VHA assignment table is reused if Phase 2 already created it.
CREATE TABLE IF NOT EXISTS public.vendor_hub_agent_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    assigned_by uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    deactivated_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_hub_agent_one_active_vendor_idx
    ON public.vendor_hub_agent_assignments(vendor_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS vendor_hub_agent_one_active_employee_idx
    ON public.vendor_hub_agent_assignments(employee_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS vendor_hub_agent_assignment_history_idx
    ON public.vendor_hub_agent_assignments(vendor_id, assigned_at DESC);
ALTER TABLE public.vendor_hub_agent_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_hub_agent_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_hub_agent_assignments TO service_role;

-- 2. One audit trail for admin assignment transitions (no KYC or financial data).
CREATE TABLE IF NOT EXISTS public.mkh_operational_assignment_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    assignment_type text NOT NULL CHECK (assignment_type IN ('trm_territory', 'zm_zone', 'vha_vendor')),
    previous_target_id uuid NULL,
    new_target_id uuid NULL,
    assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkh_operational_assignment_audit_employee_idx
    ON public.mkh_operational_assignment_audit(employee_id, created_at DESC);
ALTER TABLE public.mkh_operational_assignment_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mkh_operational_assignment_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.mkh_operational_assignment_audit TO service_role;

-- 3. Seed unambiguous existing TRM territory values into the new history table.
-- Ambiguous legacy territories are deliberately left for an explicit Admin correction.
INSERT INTO public.mkh_trm_territory_assignments (employee_id, territory_id, status, assigned_at)
SELECT e.id, e.territory_id, 'active', COALESCE(e.updated_at, e.created_at, now())
FROM public.employees e
JOIN public.employee_roles er ON er.id = e.role_id
JOIN public.profiles p ON p.id = e.profile_id
JOIN public.territories t ON t.id = e.territory_id AND t.is_active IS TRUE
WHERE e.territory_id IS NOT NULL
  AND p.territory_id = e.territory_id
  AND regexp_replace(lower(trim(COALESCE(er.system_role, ''))), '[^a-z0-9]', '', 'g')
      IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
  AND regexp_replace(lower(trim(COALESCE(p.role, ''))), '[^a-z0-9]', '', 'g')
      IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
  AND (
      SELECT count(*)
      FROM public.employees e2
      JOIN public.employee_roles er2 ON er2.id = e2.role_id
      WHERE e2.territory_id = e.territory_id
        AND regexp_replace(lower(trim(COALESCE(er2.system_role, ''))), '[^a-z0-9]', '', 'g')
            IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
  ) = 1
  AND NOT EXISTS (
      SELECT 1 FROM public.mkh_trm_territory_assignments a
      WHERE a.employee_id = e.id AND a.status = 'active'
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.mkh_trm_territory_assignments a
      WHERE a.territory_id = e.territory_id AND a.status = 'active'
  );

-- Shared guard: employee role, profile role and any currently effective app roles must agree.
CREATE OR REPLACE FUNCTION public.mkh_assert_employee_operational_role(
    p_employee_id uuid,
    p_expected_role text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
    v_profile_id uuid;
    v_role text;
    v_profile_role text;
    v_role_status text;
    v_allowed text[];
BEGIN
    CASE p_expected_role
      WHEN 'trm' THEN v_allowed := ARRAY['territory','trm','territoryrelationshipmanager','territorymanager'];
      WHEN 'zm'  THEN v_allowed := ARRAY['zm','zonemanager','zonalmanager'];
      WHEN 'vha' THEN v_allowed := ARRAY['vha','vendorhubagent'];
      ELSE RAISE EXCEPTION 'Unsupported operational role type.';
    END CASE;

    SELECT e.profile_id,
           regexp_replace(lower(trim(COALESCE(er.system_role,''))), '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(trim(COALESCE(p.role,''))), '[^a-z0-9]', '', 'g'),
           lower(trim(COALESCE(er.status,'')))
      INTO v_profile_id, v_role, v_profile_role, v_role_status
      FROM public.employees e
      JOIN public.employee_roles er ON er.id=e.role_id
      JOIN public.profiles p ON p.id=e.profile_id
     WHERE e.id=p_employee_id;

    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Employee profile or role record was not found.'; END IF;
    IF COALESCE(v_role_status, '') <> 'active' OR COALESCE(v_role, '') <> ALL(v_allowed) OR COALESCE(v_profile_role, '') <> ALL(v_allowed) THEN
      RAISE EXCEPTION 'Employee role, profile role, and requested assignment type do not match. Backend roles cannot be reassigned to frontline operational roles.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.employee_access_assignments ea
      JOIN public.employee_roles ar ON ar.id=ea.role_id
      WHERE (ea.employee_id=p_employee_id OR ea.profile_id=v_profile_id)
        AND ea.is_active IS TRUE
        AND (ea.effective_from IS NULL OR ea.effective_from <= now())
        AND (ea.effective_until IS NULL OR ea.effective_until > now())
        AND regexp_replace(lower(trim(COALESCE(ar.system_role,''))), '[^a-z0-9]', '', 'g') <> ALL(v_allowed)
    ) THEN
      RAISE EXCEPTION 'Employee has a conflicting effective app role. Resolve the role assignment through the approved role-change workflow first.';
    END IF;

    RETURN v_profile_id;
END;
$fn$;

-- 4. TRM -> Territory assignment (role identity must agree in both role sources).
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
    v_territory_active boolean;
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
           COALESCE(e.territory_id, p.territory_id)
      INTO v_profile_id, v_role, v_profile_role, v_old_territory
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

    SELECT is_active INTO v_territory_active FROM public.territories WHERE id = p_territory_id FOR UPDATE;
    IF v_territory_active IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Selected territory is missing or inactive.'; END IF;

    IF EXISTS (
        SELECT 1 FROM public.employees e2
        JOIN public.employee_roles er2 ON er2.id = e2.role_id
        WHERE e2.id <> p_employee_id
          AND e2.territory_id = p_territory_id
          AND regexp_replace(lower(trim(COALESCE(er2.system_role, ''))), '[^a-z0-9]', '', 'g')
              IN ('territory', 'trm', 'territoryrelationshipmanager', 'territorymanager')
    ) OR EXISTS (
        SELECT 1 FROM public.mkh_trm_territory_assignments a
        WHERE a.territory_id = p_territory_id AND a.status = 'active'
          AND a.employee_id <> p_employee_id
    ) THEN
        RAISE EXCEPTION 'This territory is already referenced by another TRM. Reassign or unassign that record first.';
    END IF;

    IF v_old_territory IS NOT NULL AND v_old_territory <> p_territory_id
       AND (
          EXISTS (
              SELECT 1 FROM public.zonal_manager_zones zm
              JOIN public.zones z ON z.id = zm.zone_id
              WHERE z.territory_id = v_old_territory AND zm.status = 'active'
                AND zm.unassigned_at IS NULL
          )
          OR EXISTS (
              SELECT 1 FROM public.zone_vendors zv
              JOIN public.zones z ON z.id = zv.zone_id
              WHERE z.territory_id = v_old_territory
                AND zv.status = 'active' AND zv.unassigned_at IS NULL
          )
       ) THEN
        RAISE EXCEPTION 'This TRM currently covers a territory with assigned zones or vendors. Move/reassign that coverage before moving the TRM.';
    END IF;

    IF v_old_territory = p_territory_id AND EXISTS (
        SELECT 1 FROM public.mkh_trm_territory_assignments a
        WHERE a.employee_id = p_employee_id AND a.territory_id = p_territory_id AND a.status = 'active'
    ) THEN
        UPDATE public.employees SET territory_id = p_territory_id, updated_at = now() WHERE id = p_employee_id;
        UPDATE public.profiles SET territory_id = p_territory_id WHERE id = v_profile_id;
        RETURN;
    END IF;

    UPDATE public.mkh_trm_territory_assignments
       SET status = 'inactive', deactivated_at = now()
     WHERE employee_id = p_employee_id AND status = 'active';

    INSERT INTO public.mkh_trm_territory_assignments(employee_id, territory_id, status, assigned_by)
    VALUES (p_employee_id, p_territory_id, 'active', p_assigned_by);

    UPDATE public.employees SET territory_id = p_territory_id, updated_at = now() WHERE id = p_employee_id;
    UPDATE public.profiles SET territory_id = p_territory_id WHERE id = v_profile_id;

    INSERT INTO public.mkh_operational_assignment_audit(
        employee_id, assignment_type, previous_target_id, new_target_id, assigned_by
    ) VALUES (p_employee_id, 'trm_territory', v_old_territory, p_territory_id, p_assigned_by);

    RETURN;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mkh_admin_unassign_trm_from_territory(
    p_employee_id uuid,
    p_assigned_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE v_profile_id uuid; v_role text; v_profile_role text; v_old_territory uuid;
BEGIN
    SELECT e.profile_id,
           regexp_replace(lower(trim(COALESCE(er.system_role, ''))), '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(trim(COALESCE(p.role, ''))), '[^a-z0-9]', '', 'g'),
           COALESCE(e.territory_id, p.territory_id)
      INTO v_profile_id, v_role, v_profile_role, v_old_territory
      FROM public.employees e JOIN public.employee_roles er ON er.id=e.role_id
      JOIN public.profiles p ON p.id=e.profile_id
     WHERE e.id=p_employee_id FOR UPDATE OF e,p;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Employee not found.'; END IF;
    IF COALESCE(v_role,'') NOT IN ('territory','trm','territoryrelationshipmanager','territorymanager')
       OR COALESCE(v_profile_role,'') NOT IN ('territory','trm','territoryrelationshipmanager','territorymanager') THEN
      RAISE EXCEPTION 'Only a genuine TRM/Territory role can be unassigned.';
    END IF;
    PERFORM public.mkh_assert_employee_operational_role(p_employee_id, 'trm');
    IF EXISTS (
      SELECT 1 FROM public.zones z
      WHERE z.territory_id=v_old_territory AND (
        EXISTS (SELECT 1 FROM public.zonal_manager_zones zm WHERE zm.zone_id=z.id AND zm.status='active' AND zm.unassigned_at IS NULL)
        OR EXISTS (SELECT 1 FROM public.zone_vendors zv WHERE zv.zone_id=z.id AND zv.status='active' AND zv.unassigned_at IS NULL)
      )
    ) THEN RAISE EXCEPTION 'Move or unassign zone/vendor coverage before unassigning this TRM.'; END IF;

    UPDATE public.mkh_trm_territory_assignments SET status='inactive', deactivated_at=now()
     WHERE employee_id=p_employee_id AND status='active';
    UPDATE public.employees SET territory_id=NULL, updated_at=now() WHERE id=p_employee_id;
    UPDATE public.profiles SET territory_id=NULL WHERE id=v_profile_id;
    IF v_old_territory IS NOT NULL THEN
      INSERT INTO public.mkh_operational_assignment_audit(employee_id,assignment_type,previous_target_id,new_target_id,assigned_by)
      VALUES(p_employee_id,'trm_territory',v_old_territory,NULL,p_assigned_by);
    END IF;
    RETURN;
END;
$fn$;

-- 5. ZM -> Zone assignment uses zonal_manager_zones as the authoritative relation.
-- The ZM's territory is derived from the selected zone; wallet/beneficiary identity is untouched.
CREATE OR REPLACE FUNCTION public.mkh_admin_assign_zm_to_zone(
    p_employee_id uuid,
    p_zone_id uuid,
    p_assigned_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE v_profile_id uuid; v_role text; v_profile_role text; v_old_zone uuid; v_zone_territory uuid;
BEGIN
    IF p_employee_id IS NULL OR p_zone_id IS NULL OR p_assigned_by IS NULL THEN
      RAISE EXCEPTION 'Employee, zone and assigning administrator are required.';
    END IF;
    SELECT e.profile_id,
           regexp_replace(lower(trim(COALESCE(er.system_role,''))), '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(trim(COALESCE(p.role,''))), '[^a-z0-9]', '', 'g'),
           COALESCE((SELECT zmz.zone_id FROM public.zonal_manager_zones zmz WHERE zmz.employee_id=e.id AND zmz.status='active' AND zmz.unassigned_at IS NULL ORDER BY zmz.assigned_at DESC NULLS LAST LIMIT 1),e.zone_id)
      INTO v_profile_id,v_role,v_profile_role,v_old_zone
      FROM public.employees e JOIN public.employee_roles er ON er.id=e.role_id
      JOIN public.profiles p ON p.id=e.profile_id
     WHERE e.id=p_employee_id FOR UPDATE OF e,p;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Employee not found.'; END IF;
    IF COALESCE(v_role,'') NOT IN ('zm','zonemanager','zonalmanager') OR COALESCE(v_profile_role,'') NOT IN ('zm','zonemanager','zonalmanager') THEN
      RAISE EXCEPTION 'Only a genuine ZM/Zonal Manager role can receive a zone assignment. Resolve role mismatches first.';
    END IF;
    PERFORM public.mkh_assert_employee_operational_role(p_employee_id, 'zm');
    SELECT territory_id INTO v_zone_territory FROM public.zones WHERE id=p_zone_id AND is_active IS TRUE FOR UPDATE;
    IF v_zone_territory IS NULL THEN RAISE EXCEPTION 'Selected zone is missing or inactive.'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.mkh_trm_territory_assignments ta
      JOIN public.employees te ON te.id=ta.employee_id
      JOIN public.employee_roles ter ON ter.id=te.role_id
      JOIN public.profiles tp ON tp.id=te.profile_id
      WHERE ta.territory_id=v_zone_territory AND ta.status='active'
        AND regexp_replace(lower(trim(COALESCE(ter.system_role,''))), '[^a-z0-9]', '', 'g') IN ('territory','trm','territoryrelationshipmanager','territorymanager')
        AND regexp_replace(lower(trim(COALESCE(tp.role,''))), '[^a-z0-9]', '', 'g') IN ('territory','trm','territoryrelationshipmanager','territorymanager')
    ) THEN RAISE EXCEPTION 'Assign a TRM to this territory before assigning a ZM.'; END IF;
    IF EXISTS (SELECT 1 FROM public.zonal_manager_zones WHERE zone_id=p_zone_id AND status='active' AND unassigned_at IS NULL AND employee_id<>p_employee_id) THEN
      RAISE EXCEPTION 'This zone already has another active ZM. Reassign that ZM first.';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.zonal_manager_zones current_zm
      JOIN public.zone_vendors zv ON zv.zone_id=current_zm.zone_id
      WHERE current_zm.employee_id=p_employee_id
        AND current_zm.status='active' AND current_zm.unassigned_at IS NULL
        AND current_zm.zone_id<>p_zone_id
        AND zv.status='active' AND zv.unassigned_at IS NULL
    ) THEN RAISE EXCEPTION 'Reassign vendors from the ZM''s current zone before moving this ZM; this avoids leaving vendors without zone coverage.'; END IF;

    IF EXISTS (SELECT 1 FROM public.zonal_manager_zones WHERE employee_id=p_employee_id AND zone_id=p_zone_id AND status='active' AND unassigned_at IS NULL) THEN
      UPDATE public.employees SET zone_id=p_zone_id, territory_id=v_zone_territory, updated_at=now() WHERE id=p_employee_id;
      UPDATE public.profiles SET territory_id=v_zone_territory WHERE id=v_profile_id;
      RETURN;
    END IF;

    UPDATE public.zonal_manager_zones SET status='inactive', unassigned_at=COALESCE(unassigned_at,now())
     WHERE status='active' AND (employee_id=p_employee_id OR zone_id=p_zone_id);
    INSERT INTO public.zonal_manager_zones(employee_id,zone_id,status,assigned_at,unassigned_at)
    VALUES(p_employee_id,p_zone_id,'active',now(),NULL);
    UPDATE public.employees SET zone_id=p_zone_id, territory_id=v_zone_territory, updated_at=now() WHERE id=p_employee_id;
    UPDATE public.profiles SET territory_id=v_zone_territory WHERE id=v_profile_id;
    INSERT INTO public.mkh_operational_assignment_audit(employee_id,assignment_type,previous_target_id,new_target_id,assigned_by)
    VALUES(p_employee_id,'zm_zone',v_old_zone,p_zone_id,p_assigned_by);
    RETURN;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mkh_admin_unassign_zm_from_zone(
    p_employee_id uuid,
    p_assigned_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE v_profile_id uuid; v_role text; v_profile_role text; v_old_zone uuid;
BEGIN
    SELECT e.profile_id,
           regexp_replace(lower(trim(COALESCE(er.system_role,''))), '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(trim(COALESCE(p.role,''))), '[^a-z0-9]', '', 'g'),
           COALESCE((SELECT zmz.zone_id FROM public.zonal_manager_zones zmz WHERE zmz.employee_id=e.id AND zmz.status='active' AND zmz.unassigned_at IS NULL ORDER BY zmz.assigned_at DESC NULLS LAST LIMIT 1),e.zone_id)
      INTO v_profile_id,v_role,v_profile_role,v_old_zone
      FROM public.employees e JOIN public.employee_roles er ON er.id=e.role_id
      JOIN public.profiles p ON p.id=e.profile_id
     WHERE e.id=p_employee_id FOR UPDATE OF e,p;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Employee not found.'; END IF;
    IF COALESCE(v_role,'') NOT IN ('zm','zonemanager','zonalmanager') OR COALESCE(v_profile_role,'') NOT IN ('zm','zonemanager','zonalmanager') THEN
      RAISE EXCEPTION 'Only a genuine ZM/Zonal Manager role can be unassigned.';
    END IF;
    PERFORM public.mkh_assert_employee_operational_role(p_employee_id, 'zm');
    IF EXISTS (
      SELECT 1
      FROM public.zonal_manager_zones current_zm
      JOIN public.zone_vendors zv ON zv.zone_id=current_zm.zone_id
      WHERE current_zm.employee_id=p_employee_id
        AND current_zm.status='active' AND current_zm.unassigned_at IS NULL
        AND zv.status='active' AND zv.unassigned_at IS NULL
    ) THEN RAISE EXCEPTION 'Reassign vendors from this zone before unassigning its ZM.'; END IF;
    UPDATE public.zonal_manager_zones SET status='inactive', unassigned_at=COALESCE(unassigned_at,now())
     WHERE employee_id=p_employee_id AND status='active' AND unassigned_at IS NULL;
    UPDATE public.employees SET zone_id=NULL, updated_at=now() WHERE id=p_employee_id;
    INSERT INTO public.mkh_operational_assignment_audit(employee_id,assignment_type,previous_target_id,new_target_id,assigned_by)
    VALUES(p_employee_id,'zm_zone',v_old_zone,NULL,p_assigned_by);
    RETURN;
END;
$fn$;

-- 6. VHA -> Vendor assignment uses vendor_hub_agent_assignments as authoritative history.
CREATE OR REPLACE FUNCTION public.mkh_admin_assign_vha_to_vendor(
    p_employee_id uuid,
    p_vendor_id uuid,
    p_assigned_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE v_profile_id uuid; v_role text; v_profile_role text; v_old_vendor uuid; v_zone_id uuid; v_territory_id uuid;
BEGIN
    IF p_employee_id IS NULL OR p_vendor_id IS NULL OR p_assigned_by IS NULL THEN
      RAISE EXCEPTION 'Employee, vendor and assigning administrator are required.';
    END IF;
    SELECT e.profile_id,
           regexp_replace(lower(trim(COALESCE(er.system_role,''))), '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(trim(COALESCE(p.role,''))), '[^a-z0-9]', '', 'g'),
           COALESCE((SELECT a.vendor_id FROM public.vendor_hub_agent_assignments a WHERE a.employee_id=e.id AND a.status='active' ORDER BY a.assigned_at DESC LIMIT 1), e.assigned_vendor_id)
      INTO v_profile_id,v_role,v_profile_role,v_old_vendor
      FROM public.employees e JOIN public.employee_roles er ON er.id=e.role_id
      JOIN public.profiles p ON p.id=e.profile_id
     WHERE e.id=p_employee_id FOR UPDATE OF e,p;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Employee not found.'; END IF;
    IF COALESCE(v_role,'') NOT IN ('vha','vendorhubagent') OR COALESCE(v_profile_role,'') NOT IN ('vha','vendorhubagent') THEN
      RAISE EXCEPTION 'Only a genuine VHA/Vendor Hub Agent role can receive a vendor assignment. Resolve role mismatches first.';
    END IF;
    PERFORM public.mkh_assert_employee_operational_role(p_employee_id, 'vha');
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id=p_vendor_id AND lower(trim(COALESCE(status,'')))='active') THEN
      RAISE EXCEPTION 'Selected vendor is missing or inactive.';
    END IF;
    SELECT z.id,z.territory_id INTO v_zone_id,v_territory_id
      FROM public.zone_vendors zv JOIN public.zones z ON z.id=zv.zone_id AND z.is_active IS TRUE
     WHERE zv.vendor_id=p_vendor_id AND lower(trim(COALESCE(zv.status,'')))='active' AND zv.unassigned_at IS NULL
     ORDER BY zv.assigned_at DESC NULLS LAST LIMIT 1;
    IF v_zone_id IS NULL OR v_territory_id IS NULL THEN RAISE EXCEPTION 'Assign this vendor to an active zone before assigning a VHA.'; END IF;
    IF (SELECT count(DISTINCT zv.zone_id) FROM public.zone_vendors zv JOIN public.zones z ON z.id=zv.zone_id AND z.is_active IS TRUE WHERE zv.vendor_id=p_vendor_id AND lower(trim(COALESCE(zv.status,'')))='active' AND zv.unassigned_at IS NULL) <> 1 THEN
      RAISE EXCEPTION 'Vendor has ambiguous active zone assignments. Resolve that before assigning a VHA.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.mkh_trm_territory_assignments ta
      JOIN public.employees te ON te.id=ta.employee_id JOIN public.employee_roles ter ON ter.id=te.role_id
      JOIN public.profiles tp ON tp.id=te.profile_id
      WHERE ta.territory_id=v_territory_id AND ta.status='active'
        AND regexp_replace(lower(trim(COALESCE(ter.system_role,''))), '[^a-z0-9]', '', 'g') IN ('territory','trm','territoryrelationshipmanager','territorymanager')
        AND regexp_replace(lower(trim(COALESCE(tp.role,''))), '[^a-z0-9]', '', 'g') IN ('territory','trm','territoryrelationshipmanager','territorymanager')
    ) THEN RAISE EXCEPTION 'Assign a TRM to the vendor''s territory before assigning a VHA.'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.zonal_manager_zones zmz JOIN public.employees ze ON ze.id=zmz.employee_id
      JOIN public.employee_roles zer ON zer.id=ze.role_id JOIN public.profiles zp ON zp.id=ze.profile_id
      WHERE zmz.zone_id=v_zone_id AND zmz.status='active' AND zmz.unassigned_at IS NULL
        AND regexp_replace(lower(trim(COALESCE(zer.system_role,''))), '[^a-z0-9]', '', 'g') IN ('zm','zonemanager','zonalmanager')
        AND regexp_replace(lower(trim(COALESCE(zp.role,''))), '[^a-z0-9]', '', 'g') IN ('zm','zonemanager','zonalmanager')
    ) THEN RAISE EXCEPTION 'Assign a ZM to the vendor''s zone before assigning a VHA.'; END IF;

    IF EXISTS (SELECT 1 FROM public.vendor_hub_agent_assignments WHERE employee_id=p_employee_id AND vendor_id=p_vendor_id AND status='active') THEN
      UPDATE public.employees SET assigned_vendor_id=p_vendor_id, updated_at=now() WHERE id=p_employee_id;
      RETURN;
    END IF;

    -- A VHA may cover one vendor at a time. Old rows are retained as inactive history.
    UPDATE public.vendor_hub_agent_assignments SET status='inactive', deactivated_at=COALESCE(deactivated_at,now())
     WHERE status='active' AND (employee_id=p_employee_id OR vendor_id=p_vendor_id);
    UPDATE public.employees e SET assigned_vendor_id=NULL, updated_at=now()
     WHERE e.id=p_employee_id OR (e.assigned_vendor_id=p_vendor_id AND EXISTS (
       SELECT 1 FROM public.employee_roles er2
       WHERE er2.id=e.role_id
         AND regexp_replace(lower(trim(COALESCE(er2.system_role,''))), '[^a-z0-9]', '', 'g') IN ('vha','vendorhubagent')
     ));
    INSERT INTO public.vendor_hub_agent_assignments(employee_id,vendor_id,status,assigned_by,assigned_at,deactivated_at)
    VALUES(p_employee_id,p_vendor_id,'active',p_assigned_by,now(),NULL);
    UPDATE public.employees SET assigned_vendor_id=p_vendor_id, updated_at=now() WHERE id=p_employee_id;
    INSERT INTO public.mkh_operational_assignment_audit(employee_id,assignment_type,previous_target_id,new_target_id,assigned_by)
    VALUES(p_employee_id,'vha_vendor',v_old_vendor,p_vendor_id,p_assigned_by);
    RETURN;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mkh_admin_unassign_vha_from_vendor(
    p_employee_id uuid,
    p_vendor_id uuid,
    p_assigned_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE v_profile_id uuid; v_changed boolean := false; v_rows integer := 0;
BEGIN
    SELECT e.profile_id INTO v_profile_id
      FROM public.employees e
     WHERE e.id=p_employee_id FOR UPDATE;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Employee not found.'; END IF;
    PERFORM public.mkh_assert_employee_operational_role(p_employee_id, 'vha');

    UPDATE public.vendor_hub_agent_assignments
       SET status='inactive', deactivated_at=COALESCE(deactivated_at,now())
     WHERE employee_id=p_employee_id AND vendor_id=p_vendor_id AND status='active';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_changed := v_rows > 0;
    UPDATE public.employees SET assigned_vendor_id=NULL, updated_at=now()
     WHERE id=p_employee_id AND assigned_vendor_id=p_vendor_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_changed := v_changed OR v_rows > 0;
    IF v_changed THEN
      INSERT INTO public.mkh_operational_assignment_audit(employee_id,assignment_type,previous_target_id,new_target_id,assigned_by)
      VALUES(p_employee_id,'vha_vendor',p_vendor_id,NULL,p_assigned_by);
    END IF;
    RETURN;
END;
$fn$;

-- Only the protected server route can invoke these SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION public.mkh_assert_employee_operational_role(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_assert_employee_operational_role(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.mkh_admin_assign_trm_to_territory(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_unassign_trm_from_territory(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_assign_zm_to_zone(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_unassign_zm_from_zone(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_assign_vha_to_vendor(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkh_admin_unassign_vha_from_vendor(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkh_admin_assign_trm_to_territory(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_admin_unassign_trm_from_territory(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_admin_assign_zm_to_zone(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_admin_unassign_zm_from_zone(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_admin_assign_vha_to_vendor(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mkh_admin_unassign_vha_from_vendor(uuid,uuid,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
