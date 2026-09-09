begin;
-- Esquema la-mitre-definitivo; requiere migraciones SEC-001 y FAM-001.
do $$ begin
  if to_regclass('public.beneficiario') is null or to_regclass('public.tenant_membership_roles') is null then
    raise exception 'Esquema incompatible: requiere beneficiario y tenant_membership_roles';
  end if;
end $$;

create table if not exists public.tenant_scholarship_policy (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  branches text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (branches <@ array['Lobatos','Tropa','KM','Rovers']::text[])
);
alter table public.tenant_scholarship_policy enable row level security;
drop policy if exists scholarship_read on public.tenant_scholarship_policy;
create policy scholarship_read on public.tenant_scholarship_policy for select to authenticated
using (public.can_access_tenant(tenant_id) and (public.is_super_admin() or public.has_tenant_role(tenant_id,array['tenant_admin','administration','group_leadership','treasury'])));
revoke insert, update, delete on public.tenant_scholarship_policy from authenticated, anon;
grant select on public.tenant_scholarship_policy to authenticated;

do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='beneficiario' and column_name='beca_override') then
    alter table public.beneficiario add column beca_override boolean;
    update public.beneficiario set beca_override=true where becado=true;
  end if;
end $$;

create or replace function public.resolve_member_scholarship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Compatibilidad con clientes anteriores que todavía editan sólo becado.
  if TG_OP = 'UPDATE' and new.becado is distinct from old.becado
     and new.beca_override is not distinct from old.beca_override then
    new.beca_override := new.becado;
  end if;
  new.becado := coalesce(new.beca_override,
    exists(select 1 from public.tenant_scholarship_policy where tenant_id = new.tenant_id and new.rama = any(branches))
    and coalesce(new.tipo,'Beneficiario') <> 'Voluntario');
  return new;
end $$;
drop trigger if exists member_scholarship_resolver on public.beneficiario;
create trigger member_scholarship_resolver before insert or update on public.beneficiario
for each row execute function public.resolve_member_scholarship();

create or replace function public.save_tenant_scholarship_policy(target_tenant_id uuid, requested_branches text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_tenant(target_tenant_id) or not (public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','administration','treasury'])) then raise exception 'ACCESS_DENIED'; end if;
  if requested_branches is null or array_position(requested_branches,null) is not null
    or not requested_branches <@ array['Lobatos','Tropa','KM','Rovers']::text[] then raise exception 'INVALID_BRANCHES'; end if;
  perform 1 from public.tenants where id = target_tenant_id for update;
  insert into public.tenant_scholarship_policy(tenant_id,branches) values(target_tenant_id,requested_branches)
    on conflict(tenant_id) do update set branches=excluded.branches, updated_at=now();
  update public.beneficiario set updated_at=now() where tenant_id=target_tenant_id and beca_override is null;
  insert into public.tenant_access_audit(tenant_id,actor_user_id,action,next_value)
    values(target_tenant_id,auth.uid(),'scholarship_policy_updated',jsonb_build_object('branches',requested_branches));
end $$;

create table if not exists public.tenant_branch_scopes (
  tenant_id uuid not null,
  user_id uuid not null,
  role text not null default 'branch_leader' check(role='branch_leader'),
  branch text not null check(branch in ('Lobatos','Tropa','KM','Rovers')),
  primary key(tenant_id,user_id,branch),
  foreign key(tenant_id,user_id,role) references public.tenant_membership_roles(tenant_id,user_id,role) on delete cascade
);
alter table public.tenant_branch_scopes enable row level security;
drop policy if exists branch_scopes_read on public.tenant_branch_scopes;
create policy branch_scopes_read on public.tenant_branch_scopes for select to authenticated
using(public.can_access_tenant(tenant_id) and (user_id=auth.uid() or public.can_manage_tenant_users(tenant_id)));
revoke insert,update,delete on public.tenant_branch_scopes from authenticated,anon;
grant select on public.tenant_branch_scopes to authenticated;

create or replace function public.set_tenant_member_access(target_tenant_id uuid,target_user_id uuid,requested_roles text[],requested_branches text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_access_tenant(target_tenant_id) or not public.can_manage_tenant_users(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
  if requested_branches is null or array_position(requested_branches,null) is not null
    or not requested_branches <@ array['Lobatos','Tropa','KM','Rovers']::text[] then raise exception 'INVALID_BRANCHES'; end if;
  if 'branch_leader'=any(requested_roles) and cardinality(requested_branches)=0 then raise exception 'BRANCH_REQUIRED'; end if;
  perform 1 from public.tenants where id=target_tenant_id for update;
  perform public.set_tenant_member_roles(target_tenant_id,target_user_id,requested_roles);
  if 'branch_leader'=any(requested_roles) then
    insert into public.tenant_branch_scopes(tenant_id,user_id,branch)
      select target_tenant_id,target_user_id,b from unnest(requested_branches) b on conflict do nothing;
  end if;
  insert into public.tenant_access_audit(tenant_id,actor_user_id,target_user_id,action,next_value)
    values(target_tenant_id,auth.uid(),target_user_id,'branch_scopes_updated',jsonb_build_object('branches',requested_branches));
end $$;

-- Mantener tablas médicas fuera del alcance directo de Tesorería y Rama.
-- Restrictive AND: una política permisiva heredada no puede ampliar el permiso.
create or replace function public.can_operate_entity(target_tenant_id uuid, entity_name text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.can_access_tenant(target_tenant_id) and (public.is_super_admin() or public.has_tenant_role(target_tenant_id,
    case
      when entity_name in ('beneficiario','solicitud_cambio_salud') then array['tenant_admin','administration','group_leadership']
      when entity_name in ('campamento','acceso_campamento','evento_calendario','consulta_dni') then array['tenant_admin','administration','group_leadership','treasury']
      when entity_name in ('config_cuota','config_afiliacion','config_general','afiliacion','rendicion_afiliacion','consulta_dni') then array['tenant_admin','administration','treasury']
      else array['tenant_admin','treasury']
    end));
$$;
do $$ declare t text; begin
  foreach t in array array['beneficiario','solicitud_cambio_salud','acceso_campamento','campamento','evento_calendario','config_cuota','config_afiliacion','config_general','afiliacion','rendicion_afiliacion','consulta_dni','actividad_economica','caja_chica','credito_beneficiario','gasto','gasto_actividad','movimiento_banco','pago','pre_encargo_tienda','producto_actividad','producto_tienda','venta_actividad','venta_tienda'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists entity_role_boundary on public.%I',t);
      execute format('create policy entity_role_boundary on public.%I as restrictive for all to public using(public.can_operate_entity(tenant_id,%L)) with check(public.can_operate_entity(tenant_id,%L))',t,t,t);
    end if;
  end loop;
end $$;

create or replace function public.list_tenant_people(target_tenant_id uuid,target_offset integer default 0,target_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare manage boolean; finance boolean; branch_role boolean; result jsonb;
begin
  if not public.can_access_tenant(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
  manage := public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','administration','group_leadership']);
  finance := public.has_tenant_role(target_tenant_id,array['treasury']);
  branch_role := public.has_tenant_role(target_tenant_id,array['branch_leader']);
  if not (manage or finance or branch_role) then raise exception 'ACCESS_DENIED'; end if;
  if target_offset is null or target_limit is null or target_offset<0 or target_limit<1 or target_limit>500 then raise exception 'INVALID_PAGE'; end if;
  select coalesce(jsonb_agg(r.payload),'[]'::jsonb) into result from (
    select case when manage then to_jsonb(b) else
      jsonb_build_object('id',b.id,'tenant_id',b.tenant_id,'nombre',b.nombre,'rama',b.rama,'tipo',b.tipo,'activo',b.activo,'fecha_nacimiento',b.fecha_nacimiento)
      || case when finance then jsonb_build_object('dni',b.dni,'grupo_familiar',b.grupo_familiar,'becado',b.becado,'beca_override',b.beca_override,'fecha_baja',b.fecha_baja,'fecha_reingreso',b.fecha_reingreso,'fecha_primer_afiliacion',b.fecha_primer_afiliacion) else '{}'::jsonb end
      || case when branch_role and exists(select 1 from public.tenant_branch_scopes s where s.tenant_id=b.tenant_id and s.user_id=auth.uid() and s.branch=b.rama)
        then jsonb_build_object('contacto_emergencia_nombre',b.contacto_emergencia_nombre,'contacto_emergencia_telefono',b.contacto_emergencia_telefono,'contacto_emergencia_relacion',b.contacto_emergencia_relacion)
        else '{}'::jsonb end end as payload
    from public.beneficiario b where b.tenant_id=target_tenant_id and
      (manage or finance or (branch_role and exists(select 1 from public.tenant_branch_scopes s where s.tenant_id=b.tenant_id and s.user_id=auth.uid() and s.branch=b.rama)))
    order by b.id offset target_offset limit target_limit
  ) r;
  return result;
end $$;

create or replace function public.list_invitable_people(target_tenant_id uuid)
returns table(id uuid,nombre text,email_contacto text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.can_access_tenant(target_tenant_id) or not public.can_manage_tenant_users(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
  return query select b.id,b.nombre,b.email_contacto from public.beneficiario b
    where b.tenant_id=target_tenant_id and b.activo is distinct from false
      and b.tipo='Voluntario' and nullif(trim(b.email_contacto),'') is not null order by b.nombre;
end $$;

revoke all on function public.save_tenant_scholarship_policy(uuid,text[]), public.set_tenant_member_access(uuid,uuid,text[],text[]), public.list_tenant_people(uuid,integer,integer), public.list_invitable_people(uuid), public.can_operate_entity(uuid,text) from public,anon;
grant execute on function public.save_tenant_scholarship_policy(uuid,text[]), public.set_tenant_member_access(uuid,uuid,text[],text[]), public.list_tenant_people(uuid,integer,integer), public.list_invitable_people(uuid), public.can_operate_entity(uuid,text) to authenticated;
commit;
