begin;

alter table public.tenant_membership_roles drop constraint if exists tenant_membership_roles_role_check;
alter table public.tenant_membership_roles add constraint tenant_membership_roles_role_check check(role in (
 'tenant_admin','group_leadership','administration','treasury','branch_leader','branch_deputy','branch_assistant',
 'support','volunteer','institutional','association_president','association_legal','association_secretary','association_board','parent_representative','family','youth','viewer'));

create or replace function public.assert_valid_tenant_roles(requested_roles text[]) returns void
language plpgsql immutable set search_path=public as $$ begin
 if requested_roles is null or cardinality(requested_roles)=0 or array_position(requested_roles,null) is not null
 or not requested_roles <@ array['tenant_admin','group_leadership','administration','treasury','branch_leader','branch_deputy','branch_assistant','support','volunteer','institutional','association_president','association_legal','association_secretary','association_board','parent_representative','family','youth','viewer']::text[] then raise exception 'INVALID_ROLE'; end if;
end $$;

create or replace function public.can_manage_tenant_users(target_tenant_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.can_access_tenant(target_tenant_id) and (public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','group_leadership']));
$$;

alter table public.tenant_branch_scopes drop constraint if exists tenant_branch_scopes_role_check;
alter table public.tenant_branch_scopes add constraint tenant_branch_scopes_role_check check(role in ('branch_leader','branch_deputy','branch_assistant'));
alter table public.tenant_branch_scopes add column if not exists capabilities text[] not null default '{}';
alter table public.tenant_branch_scopes add constraint branch_capabilities_check check(capabilities <@ array['edit','inactivate','transfer']::text[]);
-- No elegir ni degradar responsables reales automáticamente durante un despliegue.
do $$ begin
 if exists(select 1 from public.tenant_branch_scopes where role='branch_leader' group by tenant_id,branch having count(*)>1)
 or exists(select 1 from public.tenant_branch_scopes where role='branch_leader' group by tenant_id,user_id having count(*)>1) then
 raise exception 'REVIEW_EXISTING_BRANCH_ASSIGNMENTS';
 end if;
end $$;
create unique index one_leader_per_branch on public.tenant_branch_scopes(tenant_id,branch) where role='branch_leader';
create unique index one_led_branch_per_person on public.tenant_branch_scopes(tenant_id,user_id) where role='branch_leader';

create table public.group_governance_settings(
 tenant_id uuid primary key references public.tenants(id), association_enabled boolean not null default false,
 updated_at timestamptz not null default now());
create table public.role_terms(
 tenant_id uuid not null,user_id uuid not null,role text not null,ends_on date,extension_reason text,
 updated_at timestamptz not null default now(),primary key(tenant_id,user_id,role),
 foreign key(tenant_id,user_id,role) references public.tenant_membership_roles(tenant_id,user_id,role) on delete cascade);
create table public.youth_accounts(
 tenant_id uuid not null,user_id uuid not null,member_id uuid not null references public.beneficiario(id),
 primary key(tenant_id,user_id),unique(tenant_id,member_id),
 foreign key(tenant_id,user_id) references public.tenant_memberships(tenant_id,user_id) on delete cascade);
create table public.health_family_reviews(
 tenant_id uuid not null,member_id uuid not null references public.beneficiario(id),user_id uuid not null,
 revision timestamptz not null,status text not null check(status in ('confirmed','error')),reviewed_at timestamptz not null default now(),
 primary key(tenant_id,member_id,user_id));
create table public.branch_tasks(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),branch text not null,
 title text not null check(length(title) between 3 and 200),assigned_to uuid not null,done boolean not null default false,
 created_by uuid not null,created_at timestamptz not null default now(),
 foreign key(tenant_id,assigned_to) references public.tenant_memberships(tenant_id,user_id));

create or replace function public.governance_branch(target_tenant_id uuid,target_branch text,operation text default 'view') returns boolean
language sql stable security definer set search_path=public as $$
 select public.can_access_tenant(target_tenant_id) and (public.can_manage_tenant_users(target_tenant_id) or exists(
 select 1 from public.tenant_branch_scopes s join public.tenant_membership_roles r using(tenant_id,user_id,role)
 where s.tenant_id=target_tenant_id and s.user_id=auth.uid() and s.branch=target_branch
 and (s.role='branch_leader' or operation in ('view','activities') or operation=any(s.capabilities))));
$$;
create or replace function public.governance_leader(target_tenant_id uuid,target_branch text) returns boolean
language sql stable security definer set search_path=public as $$
 select public.can_access_tenant(target_tenant_id) and exists(select 1 from public.tenant_branch_scopes s
 where s.tenant_id=target_tenant_id and s.user_id=auth.uid() and s.branch=target_branch and s.role='branch_leader'
 and public.has_tenant_role(target_tenant_id,array['branch_leader']));
$$;
create or replace function public.governance_audit(t uuid,operation text,target uuid default null,details jsonb default '{}') returns void
language sql security definer set search_path=public as $$
 insert into public.tenant_access_audit(tenant_id,actor_user_id,target_user_id,action,next_value) values(t,auth.uid(),target,operation,details);
$$;
revoke all on function public.governance_audit(uuid,text,uuid,jsonb) from public,anon,authenticated;

-- Operaciones de cargos no borran asignaciones conservadas ni mandatos de otros roles.
create or replace function public.set_tenant_member_roles(target_tenant_id uuid,target_user_id uuid,requested_roles text[]) returns void
language plpgsql security definer set search_path=public as $$
declare previous_roles text[];
begin
 if not public.can_manage_tenant_users(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
 perform public.assert_valid_tenant_roles(requested_roles);
 perform 1 from public.tenants where id=target_tenant_id for update;
 if target_user_id=auth.uid() and not public.is_super_admin() then raise exception 'SELF_ROLE_CHANGE_NOT_ALLOWED'; end if;
 if not exists(select 1 from public.tenant_memberships where tenant_id=target_tenant_id and user_id=target_user_id) then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
 select coalesce(array_agg(role),'{}') into previous_roles from public.tenant_membership_roles where tenant_id=target_tenant_id and user_id=target_user_id;
 if ('tenant_admin'=any(requested_roles) or 'tenant_admin'=any(previous_roles)) and not(public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin'])) then raise exception 'TENANT_ADMIN_REQUIRED'; end if;
 if 'tenant_admin'=any(previous_roles) and not 'tenant_admin'=any(requested_roles) and not exists(
 select 1 from public.tenant_membership_roles r join public.tenant_memberships m using(tenant_id,user_id)
 where r.tenant_id=target_tenant_id and r.user_id<>target_user_id and r.role='tenant_admin' and m.status='active') then raise exception 'LAST_TENANT_ADMIN'; end if;
 if requested_roles && array['association_president','association_legal','association_secretary','association_board'] and not exists(select 1 from public.group_governance_settings where tenant_id=target_tenant_id and association_enabled) then raise exception 'ASSOCIATION_DISABLED'; end if;
 delete from public.tenant_membership_roles where tenant_id=target_tenant_id and user_id=target_user_id and not(role=any(requested_roles));
 insert into public.tenant_membership_roles(tenant_id,user_id,role) select target_tenant_id,target_user_id,r from unnest(requested_roles) r on conflict do nothing;
 perform public.governance_audit(target_tenant_id,'roles_updated',target_user_id,jsonb_build_object('roles',requested_roles));
end $$;

create or replace function public.set_tenant_member_access(target_tenant_id uuid,target_user_id uuid,requested_roles text[],requested_branches text[]) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.can_manage_tenant_users(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
 if requested_branches is null or array_position(requested_branches,null) is not null or not requested_branches <@ array['Lobatos','Tropa','KM','Rovers']::text[] then raise exception 'INVALID_BRANCHES'; end if;
 if 'branch_leader'=any(requested_roles) and cardinality(requested_branches)<>1 then raise exception 'ONE_BRANCH_REQUIRED'; end if;
 perform public.set_tenant_member_roles(target_tenant_id,target_user_id,requested_roles);
 delete from public.tenant_branch_scopes where tenant_id=target_tenant_id and user_id=target_user_id and role='branch_leader';
 if 'branch_leader'=any(requested_roles) then
 insert into public.tenant_branch_scopes(tenant_id,user_id,role,branch) values(target_tenant_id,target_user_id,'branch_leader',requested_branches[1]) on conflict(tenant_id,user_id,branch) do update set role='branch_leader',capabilities='{}';
 end if;
end $$;

create or replace function public.save_branch_assignment(target_tenant_id uuid,target_user_id uuid,target_branch text,target_role text,target_capabilities text[] default '{}') returns void
language plpgsql security definer set search_path=public as $$ begin
 perform 1 from public.tenants where id=target_tenant_id for update;
 if not(public.can_manage_tenant_users(target_tenant_id) or public.governance_leader(target_tenant_id,target_branch)) then raise exception 'ACCESS_DENIED'; end if;
 if target_branch is null or target_branch not in ('Lobatos','Tropa','KM','Rovers') or target_role is null or target_role not in ('branch_leader','branch_deputy','branch_assistant','remove') then raise exception 'INVALID_ASSIGNMENT'; end if;
 if not public.can_manage_tenant_users(target_tenant_id) and (target_user_id=auth.uid() or target_role='branch_leader' or exists(select 1 from public.tenant_branch_scopes where tenant_id=target_tenant_id and user_id=target_user_id and branch=target_branch and role='branch_leader')) then raise exception 'ACCESS_DENIED'; end if;
 if target_capabilities is null or array_position(target_capabilities,null) is not null or not target_capabilities <@ array['edit','inactivate','transfer']::text[] then raise exception 'INVALID_CAPABILITIES'; end if;
 if not exists(select 1 from public.tenant_memberships m where m.tenant_id=target_tenant_id and m.user_id=target_user_id and m.status='active')
 or exists(select 1 from public.tenant_membership_roles where tenant_id=target_tenant_id and user_id=target_user_id and role='youth') then raise exception 'EXISTING_ADULT_REQUIRED'; end if;
 delete from public.tenant_branch_scopes where tenant_id=target_tenant_id and user_id=target_user_id and branch=target_branch;
 if target_role<>'remove' then
 insert into public.tenant_membership_roles values(target_tenant_id,target_user_id,target_role,now()) on conflict do nothing;
 insert into public.tenant_branch_scopes(tenant_id,user_id,branch,role,capabilities) values(target_tenant_id,target_user_id,target_branch,target_role,target_capabilities);
 end if;
 delete from public.tenant_membership_roles r where r.tenant_id=target_tenant_id and r.user_id=target_user_id
 and r.role in ('branch_leader','branch_deputy','branch_assistant') and not exists(select 1 from public.tenant_branch_scopes s where s.tenant_id=r.tenant_id and s.user_id=r.user_id and s.role=r.role);
 perform public.governance_audit(target_tenant_id,'branch_assignment_updated',target_user_id,jsonb_build_object('branch',target_branch,'role',target_role,'capabilities',target_capabilities));
end $$;

create or replace function public.save_governance_setting(target_tenant_id uuid,enabled boolean) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.can_manage_tenant_users(target_tenant_id) or enabled is null then raise exception 'ACCESS_DENIED'; end if;
 if not enabled and exists(select 1 from public.tenant_membership_roles where tenant_id=target_tenant_id and role like 'association_%') then raise exception 'ASSOCIATION_HAS_OFFICERS'; end if;
 insert into public.group_governance_settings values(target_tenant_id,enabled,now()) on conflict(tenant_id) do update set association_enabled=excluded.association_enabled,updated_at=now();
 perform public.governance_audit(target_tenant_id,'association_setting',null,jsonb_build_object('enabled',enabled));
end $$;
create or replace function public.save_role_term(target_tenant_id uuid,target_user_id uuid,target_role text,target_end date,reason text default '') returns void
language plpgsql security definer set search_path=public as $$
declare old_end date;
begin
 if not public.can_manage_tenant_users(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
 if target_end is null then raise exception 'END_DATE_REQUIRED'; end if;
 select ends_on into old_end from public.role_terms where tenant_id=target_tenant_id and user_id=target_user_id and role=target_role for update;
 if old_end is not null and target_end>old_end and length(trim(coalesce(reason,'')))<5 then raise exception 'EXTENSION_REASON_REQUIRED'; end if;
 insert into public.role_terms values(target_tenant_id,target_user_id,target_role,target_end,nullif(trim(reason),''),now()) on conflict(tenant_id,user_id,role) do update set ends_on=excluded.ends_on,extension_reason=excluded.extension_reason,updated_at=now();
 perform public.governance_audit(target_tenant_id,'term_updated',target_user_id,jsonb_build_object('role',target_role,'ends_on',target_end,'reason',reason));
end $$;

-- El portal anterior ya no autoriza vínculos por datos conocidos del menor.
create or replace function public.request_family_link(target_tenant_id uuid,child_dni text,child_full_name text,child_birth_date date)
returns table(linked boolean,result_code text,linked_beneficiario_id uuid) language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 return query select false,'MANUAL_APPROVAL_REQUIRED'::text,null::uuid;
end $$;
create or replace function public.set_person_account(target_tenant_id uuid,target_user_id uuid,target_member_id uuid,kind text,enabled boolean default true) returns void
language plpgsql security definer set search_path=public as $$
declare b public.beneficiario%rowtype;
begin
 select * into b from public.beneficiario where tenant_id=target_tenant_id and id=target_member_id for update;
 if b.id is null or not(public.can_manage_tenant_users(target_tenant_id) or public.governance_leader(target_tenant_id,b.rama)) then raise exception 'ACCESS_DENIED'; end if;
 if kind is null or kind not in ('family','youth') or enabled is null then raise exception 'INVALID_LINK'; end if;
 if not exists(select 1 from public.tenant_memberships where tenant_id=target_tenant_id and user_id=target_user_id and status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
 if kind='youth' then
 if b.rama not in ('KM','Rovers') or b.activo=false then raise exception 'YOUTH_BRANCH_REQUIRED'; end if;
 if enabled then insert into public.youth_accounts values(target_tenant_id,target_user_id,target_member_id) on conflict(tenant_id,user_id) do update set member_id=excluded.member_id;
 else delete from public.youth_accounts where tenant_id=target_tenant_id and user_id=target_user_id and member_id=target_member_id; end if;
 else
 if enabled then insert into public.family_links(tenant_id,user_id,beneficiario_id) values(target_tenant_id,target_user_id,target_member_id) on conflict(tenant_id,user_id,beneficiario_id) do update set status='active',revoked_at=null;
 else update public.family_links set status='revoked',revoked_at=now() where tenant_id=target_tenant_id and user_id=target_user_id and beneficiario_id=target_member_id; end if;
 end if;
 if enabled then insert into public.tenant_membership_roles(tenant_id,user_id,role) values(target_tenant_id,target_user_id,kind) on conflict do nothing; end if;
 perform public.governance_audit(target_tenant_id,'person_account_updated',target_user_id,jsonb_build_object('member_id',target_member_id,'kind',kind,'enabled',enabled));
end $$;

create or replace function public.can_digitize_health(target_tenant_id uuid,target_member_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.beneficiario b where b.tenant_id=target_tenant_id and b.id=target_member_id and b.activo is distinct from false
 and coalesce(b.tipo,'Beneficiario')<>'Voluntario' and b.rama in ('Lobatos','Tropa','KM','Rovers')
 and public.governance_leader(target_tenant_id,b.rama));
$$;
create or replace function public.review_family_health(target_tenant_id uuid,target_member_id uuid,target_revision timestamptz,result text) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.can_access_tenant(target_tenant_id) or not exists(select 1 from public.family_links where tenant_id=target_tenant_id and user_id=auth.uid() and beneficiario_id=target_member_id and status='active') then raise exception 'ACCESS_DENIED'; end if;
 if result is null or result not in ('confirmed','error') then raise exception 'INVALID_REVIEW'; end if;
 perform 1 from public.health_digitizations where tenant_id=target_tenant_id and member_id=target_member_id and reviewed_at=target_revision for update;
 if not found then raise exception 'HEALTH_CHANGED'; end if;
 insert into public.health_family_reviews values(target_tenant_id,target_member_id,auth.uid(),target_revision,result,now()) on conflict(tenant_id,member_id,user_id) do update set revision=excluded.revision,status=excluded.status,reviewed_at=now();
 perform public.governance_audit(target_tenant_id,'family_health_review',auth.uid(),jsonb_build_object('member_id',target_member_id,'result',result));
end $$;

-- Emergencia resumida para apoyo/asociación; ficha completa sólo para educadores y jefatura.
create or replace function public.list_tenant_emergency_people(target_tenant_id uuid,target_offset integer default 0,target_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare full_health boolean; result jsonb; fields text[];
begin
 if not public.can_access_tenant(target_tenant_id) or not(public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','group_leadership','administration','treasury','branch_leader','branch_deputy','branch_assistant','support','volunteer','institutional','association_president','association_legal','association_secretary','association_board'])) then raise exception 'ACCESS_DENIED'; end if;
 if target_offset is null or target_limit is null or target_offset<0 or target_limit<1 or target_limit>500 then raise exception 'INVALID_PAGE'; end if;
 full_health:=public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','group_leadership']) or exists(select 1 from public.tenant_branch_scopes where tenant_id=target_tenant_id and user_id=auth.uid());
 fields:=array['id','tenant_id','nombre','rama','activo','telefono_contacto','telefono_contacto_2','contacto_emergencia_nombre','contacto_emergencia_telefono','contacto_emergencia_relacion','alergias','medicacion_habitual','condicion_medica'];
 if full_health then fields:=fields||array['dni','tipo','fecha_nacimiento','sexo','nacionalidad','email_contacto','calle','localidad','provincia','codigo_postal','grupo_sanguineo','factor_rh','peso_kg','talla_m','regimen_dietario','anticoagulacion','salud_mental','discapacidad','detalle_discapacidad','obra_social','numero_obra_social','observaciones_salud']; end if;
 select coalesce(jsonb_agg(q.payload),'[]') into result from(select (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(b)) where key=any(fields))||jsonb_build_object('health_access',case when full_health then 'full' else 'emergency' end) payload
 from public.beneficiario b where tenant_id=target_tenant_id and activo is distinct from false and rama in ('Lobatos','Tropa','KM','Rovers') and coalesce(tipo,'Beneficiario')<>'Voluntario' order by id offset target_offset limit target_limit) q;
 return result;
end $$;

-- Todas las tablas nuevas se consultan mediante proyecciones y comandos con alcance explícito.
do $$ declare t text; begin foreach t in array array['group_governance_settings','role_terms','youth_accounts','health_family_reviews','branch_tasks'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
end loop; end $$;
revoke all on function public.governance_branch(uuid,text,text),public.governance_leader(uuid,text),public.save_branch_assignment(uuid,uuid,text,text,text[]),public.save_governance_setting(uuid,boolean),public.save_role_term(uuid,uuid,text,date,text),public.set_person_account(uuid,uuid,uuid,text,boolean),public.review_family_health(uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.governance_branch(uuid,text,text),public.governance_leader(uuid,text),public.save_branch_assignment(uuid,uuid,text,text,text[]),public.save_governance_setting(uuid,boolean),public.save_role_term(uuid,uuid,text,date,text),public.set_person_account(uuid,uuid,uuid,text,boolean),public.review_family_health(uuid,uuid,timestamptz,text) to authenticated;
commit;
