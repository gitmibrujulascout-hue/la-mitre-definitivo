begin;
create table public.branch_cash_boxes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 name text not null check(length(trim(name)) between 3 and 100),branch text check(branch in ('Lobatos','Tropa','KM','Rovers')),
 activity text,created_by uuid not null,created_at timestamptz not null default now(),unique(tenant_id,id));
create table public.branch_cash_transfers(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),source_id uuid not null,destination_id uuid not null,
 amount numeric(14,2) not null check(amount>0),description text not null check(length(trim(description)) between 3 and 200),
 approvals jsonb not null default '{}',status text not null default 'pending' check(status in ('pending','posted')),
 created_by uuid not null,created_at timestamptz not null default now(),check(source_id<>destination_id),
 foreign key(tenant_id,source_id) references public.branch_cash_boxes(tenant_id,id),foreign key(tenant_id,destination_id) references public.branch_cash_boxes(tenant_id,id));
create table public.branch_cash_entries(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,box_id uuid not null,
 amount numeric(14,2) not null check(amount<>0),description text not null check(length(trim(description)) between 3 and 200),
 transfer_id uuid references public.branch_cash_transfers(id),created_by uuid not null,created_at timestamptz not null default now(),
 foreign key(tenant_id,box_id) references public.branch_cash_boxes(tenant_id,id),unique(transfer_id,box_id));
create table public.group_polls(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),title text not null check(length(trim(title)) between 3 and 200),
 options jsonb not null,closes_at timestamptz not null,created_by uuid not null,created_at timestamptz not null default now(),unique(tenant_id,id));
create table public.poll_electors(
 tenant_id uuid not null,poll_id uuid not null,user_id uuid not null,voted boolean not null default false,
 primary key(poll_id,user_id),foreign key(tenant_id,poll_id) references public.group_polls(tenant_id,id),
 foreign key(tenant_id,user_id) references public.tenant_memberships(tenant_id,user_id));
-- Sólo totales agregados: no existe columna que vincule una opción con un votante.
create table public.poll_totals(poll_id uuid not null references public.group_polls(id),option_index integer not null,votes integer not null default 0,primary key(poll_id,option_index));
create table public.member_inactive_periods(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),member_id uuid not null references public.beneficiario(id),
 starts_on date not null,ends_on date,check(ends_on is null or ends_on>=starts_on));
create unique index member_one_inactive_period on public.member_inactive_periods(tenant_id,member_id) where ends_on is null;
create table public.period_scholarships(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),member_id uuid references public.beneficiario(id),
 branch text check(branch in ('Lobatos','Tropa','KM','Rovers')),percentage numeric(5,2) not null check(percentage between 0 and 100),
 starts_on date not null,ends_on date not null,concept text not null check(concept in ('fee','camp','activity')),activity_id uuid,
 approvals jsonb not null default '{}',created_by uuid not null,created_at timestamptz not null default now(),
 check((member_id is null)<>(branch is null)),check(ends_on>=starts_on),check(concept='fee' or activity_id is not null));

create or replace function public.can_read_branch_cash(t uuid,b text) returns boolean language sql stable security definer set search_path=public as $$
 select public.can_access_tenant(t) and (public.can_manage_tenant_users(t) or public.has_tenant_role(t,array['treasury','association_president','association_legal','association_secretary','association_board'])
 or public.governance_leader(t,b) or exists(select 1 from public.youth_accounts a join public.beneficiario p on p.id=a.member_id and p.tenant_id=a.tenant_id where a.tenant_id=t and a.user_id=auth.uid() and p.activo is distinct from false and p.rama=b and p.rama in ('KM','Rovers')));
$$;
create or replace function public.manage_branch_cash(target_tenant_id uuid,command text,payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare box public.branch_cash_boxes%rowtype; destination public.branch_cash_boxes%rowtype; tr public.branch_cash_transfers%rowtype; v_approvals jsonb; key text; required text[]; amount numeric;
begin
 if not public.can_access_tenant(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
 perform 1 from public.tenants where id=target_tenant_id for update;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>8192 then raise exception 'INVALID_PAYLOAD'; end if;
 if command='create' then
 if not(public.has_tenant_role(target_tenant_id,array['treasury','tenant_admin']) or public.governance_leader(target_tenant_id,payload->>'branch')) then raise exception 'ACCESS_DENIED'; end if;
 insert into public.branch_cash_boxes(tenant_id,name,branch,activity,created_by) values(target_tenant_id,payload->>'name',nullif(payload->>'branch',''),nullif(payload->>'activity',''),auth.uid());
 else
 if command='approve' then
 select * into tr from public.branch_cash_transfers where tenant_id=target_tenant_id and id=(payload->>'id')::uuid for update;
 if tr.id is null then raise exception 'NOT_FOUND'; end if;
 select * into box from public.branch_cash_boxes where tenant_id=target_tenant_id and id=tr.source_id;
 select * into destination from public.branch_cash_boxes where tenant_id=target_tenant_id and id=tr.destination_id;
 if tr.status='posted' then raise exception 'ALREADY_POSTED'; end if;
 key:=payload->>'as';
 if key='treasury' then
 if not public.has_tenant_role(target_tenant_id,array['treasury']) then raise exception 'ACCESS_DENIED'; end if;
 elsif key='source' then
 if box.branch is null or not public.governance_leader(target_tenant_id,box.branch) then raise exception 'ACCESS_DENIED'; end if;
 elsif key='destination' then
 if destination.branch is null or not public.governance_leader(target_tenant_id,destination.branch) then raise exception 'ACCESS_DENIED'; end if;
 else raise exception 'INVALID_APPROVAL'; end if;
 -- Un cargo revocado no conserva una aprobación financiera pendiente.
 select coalesce(jsonb_object_agg(a.key,a.value),'{}') into v_approvals
 from jsonb_each(tr.approvals) a
 where exists(select 1 from public.tenant_memberships m where m.tenant_id=target_tenant_id and m.user_id=(a.value#>>'{}')::uuid and m.status='active')
 and (a.key='treasury' and exists(select 1 from public.tenant_membership_roles r where r.tenant_id=target_tenant_id and r.user_id=(a.value#>>'{}')::uuid and r.role='treasury')
 or a.key in ('source','destination') and exists(select 1 from public.tenant_branch_scopes s where s.tenant_id=target_tenant_id and s.user_id=(a.value#>>'{}')::uuid and s.role='branch_leader' and s.branch=case when a.key='source' then box.branch else destination.branch end));
 v_approvals:=v_approvals||jsonb_build_object(key,auth.uid());
 required:=array['treasury'];
 if box.branch is not null then required:=array_append(required,'source'); end if;
 if destination.branch is not null then required:=array_append(required,'destination'); end if;
 if v_approvals ?& required then
 if coalesce((select sum(e.amount) from public.branch_cash_entries e where e.tenant_id=target_tenant_id and e.box_id=box.id),0)<tr.amount then raise exception 'INSUFFICIENT_BALANCE'; end if;
 insert into public.branch_cash_entries(tenant_id,box_id,amount,description,transfer_id,created_by) values
 (target_tenant_id,box.id,-tr.amount,tr.description,tr.id,auth.uid()),(target_tenant_id,destination.id,tr.amount,tr.description,tr.id,auth.uid());
 update public.branch_cash_transfers set status='posted' where id=tr.id;
 end if;
 update public.branch_cash_transfers x set approvals=v_approvals where x.id=tr.id;
 else
 select * into box from public.branch_cash_boxes where tenant_id=target_tenant_id and id=(payload->>'box_id')::uuid;
 if box.id is null or not(public.has_tenant_role(target_tenant_id,array['treasury']) or public.governance_leader(target_tenant_id,box.branch)) then raise exception 'ACCESS_DENIED'; end if;
 amount:=(payload->>'amount')::numeric;
 if command='entry' then insert into public.branch_cash_entries(tenant_id,box_id,amount,description,created_by) values(target_tenant_id,box.id,amount,payload->>'description',auth.uid());
 elsif command='transfer' then insert into public.branch_cash_transfers(tenant_id,source_id,destination_id,amount,description,created_by) values(target_tenant_id,box.id,(payload->>'destination_id')::uuid,amount,payload->>'description',auth.uid());
 else raise exception 'INVALID_COMMAND'; end if;
 end if;
 end if;
 perform public.governance_audit(target_tenant_id,'cash_'||command);
end $$;

create or replace function public.create_group_poll(target_tenant_id uuid,title text,options jsonb,closes_at timestamptz,electors uuid[]) returns uuid
language plpgsql security definer set search_path=public as $$
declare poll uuid; u uuid;
begin
 if not public.can_access_tenant(target_tenant_id) or not public.has_tenant_role(target_tenant_id,array['group_leadership']) then raise exception 'ACCESS_DENIED'; end if;
 if options is null or jsonb_typeof(options)<>'array' or jsonb_array_length(options) not between 2 and 10 or closes_at is null or closes_at<=now()
 or electors is null or cardinality(electors) not between 1 and 5000 then raise exception 'INVALID_POLL'; end if;
 if exists(select 1 from jsonb_array_elements(options) e where jsonb_typeof(e)<>'string' or length(trim(e#>>'{}')) not between 1 and 100)
 or (select count(distinct e) from jsonb_array_elements_text(options) e)<>jsonb_array_length(options) then raise exception 'INVALID_OPTIONS'; end if;
 foreach u in array electors loop
 if u is null or not exists(select 1 from public.tenant_memberships m where m.tenant_id=target_tenant_id and m.user_id=u and m.status='active') then raise exception 'INVALID_ELECTOR'; end if;
 if exists(select 1 from public.tenant_membership_roles r where r.tenant_id=target_tenant_id and r.user_id=u and r.role='youth') and not exists(select 1 from public.youth_accounts a join public.beneficiario b on b.id=a.member_id and b.tenant_id=a.tenant_id where a.tenant_id=target_tenant_id and a.user_id=u and b.rama in ('KM','Rovers') and b.activo is distinct from false) then raise exception 'INVALID_ELECTOR'; end if;
 end loop;
 insert into public.group_polls(tenant_id,title,options,closes_at,created_by) values(target_tenant_id,title,options,closes_at,auth.uid()) returning id into poll;
 insert into public.poll_electors(tenant_id,poll_id,user_id) select target_tenant_id,poll,q.elector from(select distinct unnest(electors) elector) q;
 insert into public.poll_totals(poll_id,option_index) select poll,generate_series(0,jsonb_array_length(options)-1);
 perform public.governance_audit(target_tenant_id,'poll_created'); return poll;
end $$;
create or replace function public.cast_group_vote(target_tenant_id uuid,target_poll_id uuid,choice integer) returns void
language plpgsql security definer set search_path=public as $$ declare p public.group_polls%rowtype; begin
 if not public.can_access_tenant(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
 if public.has_tenant_role(target_tenant_id,array['youth']) and not exists(select 1 from public.youth_accounts a join public.beneficiario b on b.id=a.member_id and b.tenant_id=a.tenant_id where a.tenant_id=target_tenant_id and a.user_id=auth.uid() and b.activo is distinct from false and b.rama in ('KM','Rovers')) then raise exception 'VOTE_NOT_AVAILABLE'; end if;
 select * into p from public.group_polls where tenant_id=target_tenant_id and id=target_poll_id for update;
 if p.id is null or p.closes_at<=now() or choice is null or choice<0 or choice>=jsonb_array_length(p.options) then raise exception 'VOTE_NOT_AVAILABLE'; end if;
 update public.poll_electors set voted=true where tenant_id=target_tenant_id and poll_id=p.id and user_id=auth.uid() and not voted;
 if not found then raise exception 'VOTE_NOT_AVAILABLE'; end if;
 update public.poll_totals set votes=votes+1 where poll_id=p.id and option_index=choice;
 -- No guardar opción, hora individual ni identificador de usuario en auditoría de votos.
end $$;

create or replace function public.save_period_scholarship(target_tenant_id uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare s public.period_scholarships%rowtype; approval text; from_day date; to_day date; valid_approvals jsonb;
begin
 if not public.can_access_tenant(target_tenant_id) or not(public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','treasury','group_leadership'])) then raise exception 'ACCESS_DENIED'; end if;
 perform 1 from public.tenants where id=target_tenant_id for update;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>8192 then raise exception 'INVALID_PAYLOAD'; end if;
 if payload ? 'id' then
 select * into s from public.period_scholarships where tenant_id=target_tenant_id and id=(payload->>'id')::uuid for update;
 approval:=payload->>'as';
 if s.id is null or s.concept='fee' or approval is null or approval not in ('treasury','group_leadership') or not public.has_tenant_role(target_tenant_id,array[approval]) then raise exception 'ACCESS_DENIED'; end if;
 if s.approvals ?& array['treasury','group_leadership'] then raise exception 'ALREADY_APPROVED'; end if;
 select coalesce(jsonb_object_agg(a.key,a.value),'{}') into valid_approvals from jsonb_each(s.approvals) a
 where exists(select 1 from public.tenant_memberships m join public.tenant_membership_roles r using(tenant_id,user_id) where m.tenant_id=target_tenant_id and m.user_id=(a.value#>>'{}')::uuid and m.status='active' and r.role=a.key);
 update public.period_scholarships set approvals=valid_approvals||jsonb_build_object(approval,auth.uid()) where id=s.id;
 else
 from_day:=(payload->>'starts_on')::date; to_day:=(payload->>'ends_on')::date;
 if payload->>'concept'='affiliation' then raise exception 'AFFILIATION_NOT_SCHOLARSHIPPABLE'; end if;
 if nullif(payload->>'member_id','') is not null and not exists(select 1 from public.beneficiario where tenant_id=target_tenant_id and id=(payload->>'member_id')::uuid) then raise exception 'ACCESS_DENIED'; end if;
 if payload->>'concept'='camp' and not exists(select 1 from public.campamento where tenant_id=target_tenant_id and id=(payload->>'activity_id')::uuid) then raise exception 'INVALID_ACTIVITY'; end if;
 if payload->>'concept'='activity' and not exists(select 1 from public.actividad_economica where tenant_id=target_tenant_id and id=(payload->>'activity_id')::uuid) then raise exception 'INVALID_ACTIVITY'; end if;
 if exists(select 1 from public.period_scholarships x where x.tenant_id=target_tenant_id and x.concept=payload->>'concept'
 and x.member_id is not distinct from nullif(payload->>'member_id','')::uuid and x.branch is not distinct from nullif(payload->>'branch','')
 and x.activity_id is not distinct from nullif(payload->>'activity_id','')::uuid and x.starts_on<=to_day and x.ends_on>=from_day) then raise exception 'OVERLAPPING_PERIOD'; end if;
 insert into public.period_scholarships(tenant_id,member_id,branch,percentage,starts_on,ends_on,concept,activity_id,approvals,created_by)
 values(target_tenant_id,nullif(payload->>'member_id','')::uuid,nullif(payload->>'branch',''),(payload->>'percentage')::numeric,from_day,to_day,payload->>'concept',nullif(payload->>'activity_id','')::uuid,
 case when payload->>'concept'='fee' then jsonb_build_object('fee',auth.uid()) else '{}' end,auth.uid());
 end if;
 perform public.governance_audit(target_tenant_id,'scholarship_updated');
end $$;

create or replace function public.update_branch_person(target_tenant_id uuid,target_member_id uuid,patch jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare b public.beneficiario%rowtype; merged public.beneficiario%rowtype; k text; action text; effective date;
begin
 select * into b from public.beneficiario where id=target_member_id and tenant_id=target_tenant_id for update;
 if b.id is null or patch is null or jsonb_typeof(patch)<>'object' or octet_length(patch::text)>8192 then raise exception 'INVALID_PERSON'; end if;
 for k in select jsonb_object_keys(patch) loop
 if k not in ('nombre','telefono_contacto','telefono_contacto_2','email_contacto','calle','localidad','provincia','codigo_postal','rama','activo','effective_date','grupo_familiar') then raise exception 'INVALID_FIELD'; end if;
 action:=case when k='rama' then 'transfer' when k in ('activo','effective_date') then 'inactivate' else 'edit' end;
 if not public.governance_branch(target_tenant_id,b.rama,action) and not(k='rama' and public.governance_branch(target_tenant_id,patch->>'rama','transfer')) then raise exception 'ACCESS_DENIED'; end if;
 end loop;
 if patch ? 'rama' and (patch->>'rama' is null or patch->>'rama' not in ('Lobatos','Tropa','KM','Rovers')) then raise exception 'INVALID_BRANCH'; end if;
 if patch ? 'activo' and jsonb_typeof(patch->'activo')<>'boolean' then raise exception 'INVALID_STATUS'; end if;
 select * into merged from jsonb_populate_record(b,patch-'effective_date');
 if merged.activo is distinct from b.activo then
 effective:=(patch->>'effective_date')::date;
 if effective is null or effective>current_date then raise exception 'INVALID_EFFECTIVE_DATE'; end if;
 if merged.activo=false then
 insert into public.member_inactive_periods(tenant_id,member_id,starts_on) values(target_tenant_id,b.id,effective);
 merged.fecha_baja:=effective::text; merged.fecha_reingreso:=null;
 else
 update public.member_inactive_periods set ends_on=effective where tenant_id=target_tenant_id and member_id=b.id and ends_on is null;
 merged.fecha_reingreso:=effective::text;
 end if;
 end if;
 update public.beneficiario set nombre=merged.nombre,telefono_contacto=merged.telefono_contacto,telefono_contacto_2=merged.telefono_contacto_2,email_contacto=merged.email_contacto,calle=merged.calle,localidad=merged.localidad,provincia=merged.provincia,codigo_postal=merged.codigo_postal,rama=merged.rama,activo=merged.activo,fecha_baja=merged.fecha_baja,fecha_reingreso=merged.fecha_reingreso,grupo_familiar=merged.grupo_familiar,updated_at=now() where id=b.id;
 perform public.governance_audit(target_tenant_id,'person_updated',null,jsonb_build_object('member_id',b.id,'fields',(select jsonb_agg(key) from jsonb_object_keys(patch) key)));
end $$;

create or replace function public.save_branch_activity(target_tenant_id uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.governance_branch(target_tenant_id,payload->>'branch','activities') then raise exception 'ACCESS_DENIED'; end if;
 if length(trim(coalesce(payload->>'name','')))<3 or (payload->>'date')::date is null then raise exception 'INVALID_ACTIVITY'; end if;
 insert into public.evento_calendario(tenant_id,nombre,descripcion,fecha,tipo,todo_el_grupo,ramas_participantes,ubicacion)
 values(target_tenant_id,payload->>'name',payload->>'description',((payload->>'date')::date)::text,'Actividad',false,jsonb_build_array(payload->>'branch'),payload->>'location');
 perform public.governance_audit(target_tenant_id,'branch_activity_created');
end $$;
create or replace function public.save_branch_task(target_tenant_id uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public as $$ declare task public.branch_tasks%rowtype; begin
 if payload ? 'id' then
 select * into task from public.branch_tasks where tenant_id=target_tenant_id and id=(payload->>'id')::uuid for update;
 if task.id is null or not public.can_access_tenant(target_tenant_id) or not(task.assigned_to=auth.uid() or public.governance_leader(target_tenant_id,task.branch)) then raise exception 'ACCESS_DENIED'; end if;
 update public.branch_tasks set done=(payload->>'done')::boolean where id=task.id;
 else
 if not public.governance_leader(target_tenant_id,payload->>'branch') then raise exception 'ACCESS_DENIED'; end if;
 if not exists(select 1 from public.tenant_branch_scopes where tenant_id=target_tenant_id and user_id=(payload->>'assigned_to')::uuid and branch=payload->>'branch' and role in ('branch_deputy','branch_assistant')) then raise exception 'INVALID_ASSIGNEE'; end if;
 insert into public.branch_tasks(tenant_id,branch,title,assigned_to,created_by) values(target_tenant_id,payload->>'branch',payload->>'title',(payload->>'assigned_to')::uuid,auth.uid());
 end if;
end $$;

do $$ declare t text; begin foreach t in array array['branch_cash_boxes','branch_cash_transfers','branch_cash_entries','group_polls','poll_electors','poll_totals','member_inactive_periods','period_scholarships'] loop
 execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon,authenticated',t);
end loop; end $$;
revoke all on function public.can_read_branch_cash(uuid,text),public.manage_branch_cash(uuid,text,jsonb),public.create_group_poll(uuid,text,jsonb,timestamptz,uuid[]),public.cast_group_vote(uuid,uuid,integer),public.save_period_scholarship(uuid,jsonb),public.update_branch_person(uuid,uuid,jsonb),public.save_branch_activity(uuid,jsonb),public.save_branch_task(uuid,jsonb) from public,anon;
grant execute on function public.can_read_branch_cash(uuid,text),public.manage_branch_cash(uuid,text,jsonb),public.create_group_poll(uuid,text,jsonb,timestamptz,uuid[]),public.cast_group_vote(uuid,uuid,integer),public.save_period_scholarship(uuid,jsonb),public.update_branch_person(uuid,uuid,jsonb),public.save_branch_activity(uuid,jsonb),public.save_branch_task(uuid,jsonb) to authenticated;
commit;
