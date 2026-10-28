-- MKH Admin Reassignment atomic persistence repair
-- REVIEWED REVISION: stage only; do not execute until approved.
-- Keeps the employee zone field, active relationship, and audit trail consistent.

begin;

create or replace function public.admin_set_zm_zone_assignment(
  p_employee_id uuid,
  p_zone_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role text;
  v_zone_name text;
  v_occupied_employee uuid;
  v_now timestamptz := now();
  v_existing_zone uuid;
  v_employee_zone uuid;
  v_role_found boolean := false;
begin
  if p_employee_id is null or p_actor_id is null then
    raise exception 'Employee and administrator IDs are required';
  end if;

  -- Lock the employee row and read its canonical employee role first.
  select upper(regexp_replace(coalesce(er.system_role, ''), '[^A-Z0-9]', '', 'g')),
         e.zone_id
    into v_role, v_employee_zone
  from public.employees e
  left join public.employee_roles er on er.id = e.role_id
  where e.id = p_employee_id
  for update of e;

  if not found then
    raise exception 'Employee not found';
  end if;

  -- Explicit accepted role tokens; do not use substring '%ZM%' matching.
  v_role_found := coalesce(v_role, '') in (
    'ZM', 'ZONEMANAGER', 'ZONALMANAGER', 'ZONAL_MANAGER'
  );

  -- Compatibility fallback only when the employee-role value is empty.
  if not v_role_found and coalesce(v_role, '') = '' then
    select upper(regexp_replace(coalesce(p.role, ''), '[^A-Z0-9]', '', 'g'))
      into v_role
    from public.employees e
    left join public.profiles p on p.id = e.profile_id
    where e.id = p_employee_id;

    v_role_found := coalesce(v_role, '') in (
      'ZM', 'ZONEMANAGER', 'ZONALMANAGER', 'ZONAL_MANAGER'
    );
  end if;

  if not v_role_found then
    raise exception 'Employee role is not a Zone Manager';
  end if;

  -- Lock the target zone row. Concurrent assignments to the same zone serialize here.
  if p_zone_id is not null then
    select z.name into v_zone_name
    from public.zones z
    where z.id = p_zone_id and z.is_active = true
    for update;

    if not found then
      raise exception 'Selected zone was not found or is inactive';
    end if;

    select zmz.employee_id into v_occupied_employee
    from public.zonal_manager_zones zmz
    where zmz.zone_id = p_zone_id
      and zmz.status = 'active'
      and zmz.employee_id <> p_employee_id
    limit 1
    for update;

    if found then
      raise exception 'This zone already has an active Zone Manager assignment';
    end if;
  end if;

  -- Retire active assignments for other zones before setting the target.
  update public.zonal_manager_zones
    set status = 'inactive', unassigned_at = v_now
    where employee_id = p_employee_id
      and status = 'active'
      and (p_zone_id is null or zone_id <> p_zone_id);

  -- If requested target already exists, preserve its original assigned_at.
  select zmz.zone_id into v_existing_zone
  from public.zonal_manager_zones zmz
  where zmz.employee_id = p_employee_id
    and zmz.zone_id = p_zone_id
    and zmz.status = 'active'
  order by zmz.assigned_at desc
  limit 1
  for update;

  if p_zone_id is not null and v_existing_zone is null then
    insert into public.zonal_manager_zones
      (employee_id, zone_id, status, assigned_at, unassigned_at)
    values
      (p_employee_id, p_zone_id, 'active', v_now, null);
  end if;

  update public.employees
    set zone_id = p_zone_id, updated_at = v_now
    where id = p_employee_id;

  -- Audit actual changes, including repair of a mismatched employees.zone_id.
  if v_employee_zone is distinct from p_zone_id
     or v_existing_zone is distinct from p_zone_id then
    insert into public.employee_audit_logs
      (employee_id, action, description, performed_by)
    values
      (p_employee_id, 'ZONE_ASSIGNMENT_UPDATED',
       'Zone Manager zone assignment ' ||
         case when p_zone_id is null then 'cleared'
              else 'set to ' || coalesce(v_zone_name, 'zone') || ' (' || p_zone_id::text || ')' end ||
       ' by administrator.',
       p_actor_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'changed', (v_employee_zone is distinct from p_zone_id or v_existing_zone is distinct from p_zone_id)
  );
end;
$function$;

revoke all on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) from public;
revoke all on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) from anon;
revoke all on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) from authenticated;
grant execute on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) to service_role;

commit;
