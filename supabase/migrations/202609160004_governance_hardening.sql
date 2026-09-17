begin;
-- Cambiar una beca conserva su tramo pasado y vuelve a pedir aprobaciones especiales.
create or replace function public.revise_period_scholarship(target_tenant_id uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare previous public.period_scholarships%rowtype; effective date; finish date; percentage_value numeric;
begin
 if not public.can_access_tenant(target_tenant_id) or not(public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','treasury','group_leadership'])) then raise exception 'ACCESS_DENIED'; end if;
 perform 1 from public.tenants where id=target_tenant_id for update;
 select * into previous from public.period_scholarships where tenant_id=target_tenant_id and id=(payload->>'id')::uuid for update;
 effective:=(payload->>'starts_on')::date;finish:=(payload->>'ends_on')::date;percentage_value:=(payload->>'percentage')::numeric;
 if previous.id is null or effective is null or effective<greatest(current_date,previous.starts_on) or effective>previous.ends_on or finish is null or finish<effective or percentage_value is null or percentage_value not between 0 and 100 then raise exception 'INVALID_SCHOLARSHIP_REVISION'; end if;
 if exists(select 1 from public.period_scholarships s where s.tenant_id=target_tenant_id and s.id<>previous.id and s.member_id is not distinct from previous.member_id and s.branch is not distinct from previous.branch and s.concept=previous.concept and s.activity_id is not distinct from previous.activity_id and s.starts_on<=finish and s.ends_on>=effective) then raise exception 'OVERLAPPING_PERIOD'; end if;
 if effective=previous.starts_on then
 update public.period_scholarships set percentage=percentage_value,ends_on=finish,approvals=case when concept='fee' then jsonb_build_object('fee',auth.uid()) else '{}' end where id=previous.id;
 else
 update public.period_scholarships set ends_on=effective-1 where id=previous.id;
 perform public.save_period_scholarship(target_tenant_id,jsonb_build_object('member_id',previous.member_id,'branch',previous.branch,'percentage',percentage_value,'starts_on',effective,'ends_on',finish,'concept',previous.concept,'activity_id',previous.activity_id));
 end if;
 insert into public.tenant_access_audit(tenant_id,actor_user_id,action,previous_value,next_value) values(target_tenant_id,auth.uid(),'scholarship_revised',to_jsonb(previous),payload);
end $$;
revoke all on function public.revise_period_scholarship(uuid,jsonb) from public,anon;
grant execute on function public.revise_period_scholarship(uuid,jsonb) to authenticated;

alter table public.branch_cash_entries add constraint cash_amount_finite check(amount<>'NaN'::numeric);
alter table public.branch_cash_transfers add constraint transfer_amount_finite check(amount<>'NaN'::numeric);

create or replace function public.find_branch_transfer_candidates(target_tenant_id uuid,search text) returns jsonb
language plpgsql stable security definer set search_path=public as $$ begin
 if not public.can_access_tenant(target_tenant_id) or not(public.can_manage_tenant_users(target_tenant_id) or exists(select 1 from public.tenant_branch_scopes s where s.tenant_id=target_tenant_id and s.user_id=auth.uid() and (s.role='branch_leader' or 'transfer'=any(s.capabilities)))) then raise exception 'ACCESS_DENIED'; end if;
 if length(trim(coalesce(search,'')))<3 then return '[]'; end if;
 return coalesce((select jsonb_agg(q) from(select id,nombre as name,rama as branch from public.beneficiario where tenant_id=target_tenant_id and activo is distinct from false and rama in ('Lobatos','Tropa','KM','Rovers') and strpos(lower(nombre),lower(trim(search)))>0 order by nombre limit 30) q),'[]');
end $$;
revoke all on function public.find_branch_transfer_candidates(uuid,text) from public,anon;
grant execute on function public.find_branch_transfer_candidates(uuid,text) to authenticated;
create or replace function public.private_member_billing(t uuid,member uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('member',jsonb_build_object('id',b.id,'rama',b.rama,'tipo',b.tipo,'activo',b.activo,'becado',b.becado,'fecha_baja',b.fecha_baja,'fecha_reingreso',b.fecha_reingreso,'fecha_primer_afiliacion',b.fecha_primer_afiliacion,'grupo_familiar',b.grupo_familiar,
 'scholarship_periods',coalesce((select jsonb_agg(to_jsonb(s)-'approvals'-'created_by') from public.period_scholarships s where s.tenant_id=t and (s.member_id=b.id or s.branch=b.rama) and (s.concept='fee' or s.approvals ?& array['treasury','group_leadership'])),'[]'),
 'inactive_periods',coalesce((select jsonb_agg(jsonb_build_object('starts_on',i.starts_on,'ends_on',i.ends_on)) from public.member_inactive_periods i where i.tenant_id=t and i.member_id=b.id),'[]')),
 'family_count',(select count(*) from public.beneficiario siblings where siblings.tenant_id=t and b.grupo_familiar is not null and siblings.grupo_familiar=b.grupo_familiar and siblings.activo is distinct from false and siblings.tipo is distinct from 'Voluntario' and not coalesce(siblings.becado,false)),
 'fees',coalesce((select jsonb_agg(jsonb_build_object('mes',c.mes,'anio',c.anio,'monto_efectivo',c.monto_efectivo,'monto_transferencia',c.monto_transferencia)) from public.config_cuota c where c.tenant_id=t),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p)-'observaciones'-'beneficiario_nombre') from public.pago p where p.tenant_id=t and p.beneficiario_id=b.id::text),'[]'),
 'affiliations',coalesce((select jsonb_agg(to_jsonb(a)-'observaciones'-'beneficiario_nombre'-'beneficiario_dni') from public.afiliacion a where a.tenant_id=t and a.beneficiario_id=b.id::text),'[]'),
 'camps',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.nombre,'date',c.fecha_inicio,'amount',coalesce((c.costos_individuales->>b.id::text)::numeric,c.costo_por_persona))) from public.campamento c where c.tenant_id=t and c.beneficiarios_ids ? b.id::text),'[]'))
 from public.beneficiario b where b.tenant_id=t and b.id=member;
$$;
revoke all on function public.private_member_billing(uuid,uuid) from public,anon,authenticated;
-- Se reemplazó el portal anterior: ninguna consulta familiar omite la membresía activa.
revoke execute on function public.get_family_children(uuid) from public,anon,authenticated;

create table public.family_invitation_targets(
 invitation_id uuid primary key references public.tenant_invitations(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id),member_id uuid not null references public.beneficiario(id));
alter table public.family_invitation_targets enable row level security;
revoke all on public.family_invitation_targets from anon,authenticated;

create or replace function public.invite_member_parent(target_tenant_id uuid,target_member_id uuid,parent_name text,parent_email text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.beneficiario%rowtype; invitation uuid; token text;
begin
 select * into b from public.beneficiario where tenant_id=target_tenant_id and id=target_member_id;
 if b.id is null or not(public.can_manage_tenant_users(target_tenant_id) or public.governance_leader(target_tenant_id,b.rama)) then raise exception 'ACCESS_DENIED'; end if;
 if length(trim(coalesce(parent_name,'')))<3 or coalesce(parent_email,'') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'INVALID_INVITATION'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.tenant_invitations(tenant_id,email,full_name,roles,token_hash,invited_by)
 values(target_tenant_id,lower(trim(parent_email)),trim(parent_name),array['family'],encode(extensions.digest(token,'sha256'),'hex'),auth.uid()) returning id into invitation;
 insert into public.family_invitation_targets values(invitation,target_tenant_id,target_member_id);
 perform public.governance_audit(target_tenant_id,'parent_invited',null,jsonb_build_object('member_id',target_member_id));
 return jsonb_build_object('token',token);
end $$;

create or replace function public.accept_tenant_invitation(invitation_token text) returns uuid
language plpgsql security definer set search_path=public as $$
declare i public.tenant_invitations%rowtype; link public.family_invitation_targets%rowtype; email text:=lower(coalesce(auth.jwt()->>'email','')); inviter_active boolean;
begin
 if auth.uid() is null or email='' then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 select * into i from public.tenant_invitations where token_hash=encode(extensions.digest(invitation_token,'sha256'),'hex') for update;
 if i.id is null or i.status<>'pending' or i.expires_at<=now() then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
 if lower(i.email)<>email then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;
 if not exists(select 1 from public.tenants where id=i.tenant_id and active) then raise exception 'ACCESS_DENIED'; end if;
 select * into link from public.family_invitation_targets where invitation_id=i.id;
 select exists(select 1 from public.tenant_memberships m where m.tenant_id=i.tenant_id and m.user_id=i.invited_by and m.status='active') into inviter_active;
 if link.invitation_id is not null then
 if not inviter_active or not exists(select 1 from public.beneficiario b where b.id=link.member_id and b.tenant_id=i.tenant_id and (
 exists(select 1 from public.tenant_membership_roles r where r.tenant_id=i.tenant_id and r.user_id=i.invited_by and r.role in ('tenant_admin','group_leadership'))
 or exists(select 1 from public.tenant_branch_scopes s where s.tenant_id=i.tenant_id and s.user_id=i.invited_by and s.role='branch_leader' and s.branch=b.rama))) then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
 else
 if not exists(select 1 from public.profiles p where p.id=i.invited_by and p.is_super_admin) and not(inviter_active and exists(select 1 from public.tenant_membership_roles r where r.tenant_id=i.tenant_id and r.user_id=i.invited_by and r.role in ('tenant_admin','group_leadership'))) then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
 end if;
 perform public.assert_valid_tenant_roles(i.roles);
 if 'tenant_admin'=any(i.roles) and not exists(select 1 from public.profiles p where p.id=i.invited_by and p.is_super_admin)
 and not(inviter_active and exists(select 1 from public.tenant_membership_roles r where r.tenant_id=i.tenant_id and r.user_id=i.invited_by and r.role='tenant_admin')) then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
 if exists(select 1 from unnest(i.roles) role where role like 'association_%') and not exists(select 1 from public.group_governance_settings s where s.tenant_id=i.tenant_id and s.association_enabled) then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
 insert into public.tenant_memberships(tenant_id,user_id,role,status) values(i.tenant_id,auth.uid(),'member','active') on conflict(tenant_id,user_id) do nothing;
 if not exists(select 1 from public.tenant_memberships where tenant_id=i.tenant_id and user_id=auth.uid() and status='active') then raise exception 'ACCESS_DENIED'; end if;
 insert into public.tenant_membership_roles(tenant_id,user_id,role) select i.tenant_id,auth.uid(),r from unnest(i.roles) r on conflict do nothing;
 if link.invitation_id is not null then
 insert into public.family_links(tenant_id,user_id,beneficiario_id) values(i.tenant_id,auth.uid(),link.member_id) on conflict(tenant_id,user_id,beneficiario_id) do update set status='active',revoked_at=null;
 end if;
 update public.tenant_invitations set status='accepted',accepted_user_id=auth.uid(),accepted_at=now(),updated_at=now() where id=i.id;
 perform public.governance_audit(i.tenant_id,'invitation_accepted',auth.uid());
 return i.tenant_id;
end $$;

-- Las modificaciones desde formularios anteriores también preservan períodos de inactividad.
do $$ declare b record; start_day date; end_day date; begin
 for b in select id,tenant_id,fecha_baja,fecha_reingreso from public.beneficiario where nullif(fecha_baja,'') is not null loop
 begin start_day:=b.fecha_baja::date;end_day:=nullif(b.fecha_reingreso,'')::date;
 exception when others then raise exception 'REVIEW_LEGACY_ACTIVITY_DATES'; end;
 if end_day is not null and end_day<start_day then raise exception 'REVIEW_LEGACY_ACTIVITY_DATES'; end if;
 insert into public.member_inactive_periods(tenant_id,member_id,starts_on,ends_on) values(b.tenant_id,b.id,start_day,end_day);
 end loop;
end $$;
create or replace function public.track_member_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare effective date;
begin
 if old.activo is distinct from new.activo then
 if new.activo=false then
 effective:=coalesce(nullif(new.fecha_baja,'')::date,current_date);
 insert into public.member_inactive_periods(tenant_id,member_id,starts_on) values(new.tenant_id,new.id,effective) on conflict(tenant_id,member_id) where ends_on is null do nothing;
 else
 effective:=coalesce(nullif(new.fecha_reingreso,'')::date,current_date);
 update public.member_inactive_periods set ends_on=effective where tenant_id=new.tenant_id and member_id=new.id and ends_on is null;
 end if;
 end if;
 return new;
end $$;
create trigger member_activity_history after update of activo on public.beneficiario for each row execute function public.track_member_activity();

-- Becas heredadas se mantienen; sólo los responsables financieros pueden cambiarlas.
create or replace function public.guard_scholarship_changes() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is not null and ((TG_OP='UPDATE' and (new.beca_override is distinct from old.beca_override or new.becado is distinct from old.becado)) or (TG_OP='INSERT' and (new.beca_override is not null or new.becado is true)))
 and not(public.is_super_admin() or public.has_tenant_role(new.tenant_id,array['tenant_admin','group_leadership','treasury'])) then raise exception 'ACCESS_DENIED'; end if;
 return new;
end $$;
create trigger a_scholarship_permissions before insert or update on public.beneficiario for each row execute function public.guard_scholarship_changes();
create or replace function public.save_tenant_scholarship_policy(target_tenant_id uuid,requested_branches text[]) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.can_access_tenant(target_tenant_id) or not(public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','group_leadership','treasury'])) then raise exception 'ACCESS_DENIED'; end if;
 if requested_branches is null or array_position(requested_branches,null) is not null or not requested_branches <@ array['Lobatos','Tropa','KM','Rovers']::text[] then raise exception 'INVALID_BRANCHES'; end if;
 perform 1 from public.tenants where id=target_tenant_id for update;
 insert into public.tenant_scholarship_policy(tenant_id,branches) values(target_tenant_id,requested_branches) on conflict(tenant_id) do update set branches=excluded.branches,updated_at=now();
 update public.beneficiario set updated_at=now() where tenant_id=target_tenant_id and beca_override is null;
 perform public.governance_audit(target_tenant_id,'legacy_scholarship_policy');
end $$;
revoke all on function public.invite_member_parent(uuid,uuid,text,text),public.track_member_activity(),public.guard_scholarship_changes() from public,anon;
grant execute on function public.invite_member_parent(uuid,uuid,text,text) to authenticated;
commit;
