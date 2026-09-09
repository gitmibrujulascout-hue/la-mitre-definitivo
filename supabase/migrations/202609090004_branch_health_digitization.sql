begin;
create table if not exists public.health_digitizations (
  member_id uuid primary key references public.beneficiario(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null
);
alter table public.health_digitizations enable row level security;
revoke all on public.health_digitizations from anon,authenticated;

create or replace function public.can_digitize_health(target_tenant_id uuid,target_member_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.can_access_tenant(target_tenant_id) and exists(
    select 1 from public.beneficiario b where b.id=target_member_id and b.tenant_id=target_tenant_id
      and b.activo is distinct from false and coalesce(b.tipo,'Beneficiario')<>'Voluntario'
      and coalesce(b.rama,'') not in ('Voluntario','Educador')
      and (public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','administration','group_leadership'])
        or (public.has_tenant_role(target_tenant_id,array['branch_leader']) and exists(
          select 1 from public.tenant_branch_scopes s where s.tenant_id=b.tenant_id and s.user_id=auth.uid() and s.branch=b.rama)))
  );
$$;
create or replace function public.member_health_payload(target_member_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select (select jsonb_object_agg(e.key,e.value) from jsonb_each(to_jsonb(b)) e
    where e.key=any(array['grupo_sanguineo','factor_rh','peso_kg','talla_m','alergias','condicion_medica','medicacion_habitual','regimen_dietario','anticoagulacion','salud_mental','discapacidad','obra_social','numero_obra_social','contacto_emergencia_nombre','contacto_emergencia_telefono','contacto_emergencia_relacion','observaciones_salud']))
  from public.beneficiario b where b.id=target_member_id;
$$;
revoke all on function public.member_health_payload(uuid) from public,anon,authenticated;

create or replace function public.get_member_health_draft(target_tenant_id uuid,target_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare health jsonb; result jsonb;
begin
  if not public.can_digitize_health(target_tenant_id,target_member_id) then raise exception 'ACCESS_DENIED'; end if;
  health:=public.member_health_payload(target_member_id);
  select jsonb_build_object('id',b.id,'nombre',b.nombre,'dni',b.dni,'rama',b.rama,
    'health',health,'revision',md5(health::text)) into result from public.beneficiario b where b.id=target_member_id;
  return result;
end $$;

create or replace function public.list_health_digitization_queue(target_tenant_id uuid,target_offset integer default 0,target_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.can_access_tenant(target_tenant_id) or not (public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','administration','group_leadership','branch_leader'])) then raise exception 'ACCESS_DENIED'; end if;
  if target_offset is null or target_limit is null or target_offset<0 or target_limit<1 or target_limit>500 then raise exception 'INVALID_PAGE'; end if;
  select coalesce(jsonb_agg(q.item),'[]'::jsonb) into result from(
    select jsonb_build_object('id',b.id,'tenant_id',b.tenant_id,'nombre',b.nombre,'rama',b.rama,'reviewed_at',d.reviewed_at) item
    from public.beneficiario b left join public.health_digitizations d on d.member_id=b.id and d.tenant_id=b.tenant_id
    where b.tenant_id=target_tenant_id and public.can_digitize_health(target_tenant_id,b.id)
    order by b.id offset target_offset limit target_limit
  ) q;
  return result;
end $$;

create or replace function public.save_member_health_digitization(
 target_tenant_id uuid,target_member_id uuid,target_revision text,target_patch jsonb,target_reviewed boolean
) returns void language plpgsql security definer set search_path=public as $$
declare health jsonb; merged public.beneficiario%rowtype; e record;
begin
  if target_reviewed is distinct from true then raise exception 'REVIEW_REQUIRED'; end if;
  perform 1 from public.beneficiario where id=target_member_id and tenant_id=target_tenant_id for update;
  if not public.can_digitize_health(target_tenant_id,target_member_id) then raise exception 'ACCESS_DENIED'; end if;
  if target_patch is null or jsonb_typeof(target_patch)<>'object' or octet_length(target_patch::text)>32768 then raise exception 'INVALID_HEALTH'; end if;
  for e in select * from jsonb_each(target_patch) loop
    if not e.key=any(array['grupo_sanguineo','factor_rh','peso_kg','talla_m','alergias','condicion_medica','medicacion_habitual','regimen_dietario','anticoagulacion','salud_mental','discapacidad','obra_social','numero_obra_social','contacto_emergencia_nombre','contacto_emergencia_telefono','contacto_emergencia_relacion','observaciones_salud']) then raise exception 'INVALID_FIELD'; end if;
    if e.key in ('peso_kg','talla_m') then
      if jsonb_typeof(e.value) not in ('number','null') then raise exception 'INVALID_NUMBER'; end if;
      if e.value<>'null'::jsonb and ((e.value::text)::numeric<=0 or (e.value::text)::numeric>case when e.key='peso_kg' then 500 else 3 end) then raise exception 'INVALID_NUMBER'; end if;
    elsif jsonb_typeof(e.value) not in ('string','null') or length(e.value::text)>4000 then raise exception 'INVALID_VALUE';
    end if;
  end loop;
  health:=public.member_health_payload(target_member_id);
  if target_revision is null or target_revision<>md5(health::text) then raise exception 'HEALTH_CHANGED'; end if;
  if not exists(select 1 from jsonb_each(health||target_patch) item where item.value<>'null'::jsonb and item.value<>'""'::jsonb) then raise exception 'EMPTY_HEALTH'; end if;
  select * into merged from jsonb_populate_record(null::public.beneficiario,health||target_patch);
  update public.beneficiario set grupo_sanguineo=merged.grupo_sanguineo,factor_rh=merged.factor_rh,peso_kg=merged.peso_kg,talla_m=merged.talla_m,alergias=merged.alergias,condicion_medica=merged.condicion_medica,medicacion_habitual=merged.medicacion_habitual,regimen_dietario=merged.regimen_dietario,anticoagulacion=merged.anticoagulacion,salud_mental=merged.salud_mental,discapacidad=merged.discapacidad,obra_social=merged.obra_social,numero_obra_social=merged.numero_obra_social,contacto_emergencia_nombre=merged.contacto_emergencia_nombre,contacto_emergencia_telefono=merged.contacto_emergencia_telefono,contacto_emergencia_relacion=merged.contacto_emergencia_relacion,observaciones_salud=merged.observaciones_salud, updated_at=now() where id=target_member_id and tenant_id=target_tenant_id;
  insert into public.health_digitizations(member_id,tenant_id,reviewed_by) values(target_member_id,target_tenant_id,auth.uid())
    on conflict(member_id) do update set reviewed_at=now(),reviewed_by=auth.uid(),tenant_id=excluded.tenant_id;
  insert into public.tenant_access_audit(tenant_id,actor_user_id,target_user_id,action,next_value)
    values(target_tenant_id,auth.uid(),null,'health_digitization_reviewed',jsonb_build_object('member_id',target_member_id));
end $$;
revoke all on function public.can_digitize_health(uuid,uuid),public.get_member_health_draft(uuid,uuid),public.list_health_digitization_queue(uuid,integer,integer),public.save_member_health_digitization(uuid,uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.can_digitize_health(uuid,uuid),public.get_member_health_draft(uuid,uuid),public.list_health_digitization_queue(uuid,integer,integer),public.save_member_health_digitization(uuid,uuid,text,jsonb,boolean) to authenticated;
commit;
