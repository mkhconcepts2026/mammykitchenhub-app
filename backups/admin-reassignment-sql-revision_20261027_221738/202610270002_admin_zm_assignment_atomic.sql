-- MKH Admin Reassignment atomic persistence repair
-- REVIEW ONLY: do not apply until reviewed and approved.
-- Keeps employees.zone_id, zonal_manager_zones and employee_audit_logs in one transaction.

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
begin
  if p_employee_id is null or p_actor_id is null then
    raise exception 'Employee and administrator IDs are required';
  end if;

  -- Serialize changes to this employee.
  select upper(regexp_replace(coalesce(er.system_role, p.role, ''), '[^A-Z0-9]', '', 'g'))
    into v_role
  from public.employees e
  left join public.employee_roles er on er.id = e.role_id
  left join public.profiles p on p.id = e.profile_id
  where e.id = p_employee_id
  for update of e;

  if not found then
    raise exception 'Employee not found';
  end if;

  if not (v_role like '%ZONALMANAGER%' or v_role like '%ZONEMANAGER%' or v_role like '%ZM%') then
    raise exception 'Employee role is not a Zone Manager';
  end if;

  -- Lock target zone and validate it before changing either table.
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

  select zmz.zone_id into v_existing_zone
  from public.zonal_manager_zones zmz
  where zmz.employee_id = p_employee_id and zmz.status = 'active'
  order by zmz.assigned_at desc
  limit 1
  for update;

  -- Idempotent save: ensure the employee field matches the active relationship.
  if v_existing_zone is not distinct from p_zone_id then
    update public.employees
      set zone_id = p_zone_id, updated_at = v_now
      where id = p_employee_id;
    return jsonb_build_object('success', true, 'changed', false);
  end if;

  update public.zonal_manager_zones
    set status = 'inactive', unassigned_at = v_now
    where employee_id = p_employee_id and status = 'active';

  if p_zone_id is not null then
    insert into public.zonal_manager_zones
      (employee_id, zone_id, status, assigned_at, unassigned_at)
    values
      (p_employee_id, p_zone_id, 'active', v_now, null);
  end if;

  update public.employees
    set zone_id = p_zone_id, updated_at = v_now
    where id = p_employee_id;

  insert into public.employee_audit_logs
    (employee_id, action, description, performed_by)
  values
    (p_employee_id, 'ZONE_ASSIGNMENT_UPDATED',
     'Zone Manager zone assignment ' ||
       case when p_zone_id is null then 'cleared'
            else 'set to ' || v_zone_name || ' (' || p_zone_id::text || ')' end ||
       ' by administrator.',
     p_actor_id);

  return jsonb_build_object('success', true, 'changed', true);
end;
$function$;

revoke all on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) from public;
revoke all on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) from anon;
revoke all on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) from authenticated;
grant execute on function public.admin_set_zm_zone_assignment(uuid, uuid, uuid) to service_role;

commit;
