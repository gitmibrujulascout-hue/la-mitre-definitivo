begin;
create or replace function public.get_group_workspace(target_tenant_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb; manager boolean; branch_manager boolean; ledger boolean; roles text[]; own_ids uuid[];
begin
 if not public.can_access_tenant(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
 manager:=public.can_manage_tenant_users(target_tenant_id);
 branch_manager:=exists(select 1 from public.tenant_branch_scopes where tenant_id=target_tenant_id and user_id=auth.uid() and role='branch_leader');
 ledger:=manager or public.has_tenant_role(target_tenant_id,array['treasury']);
 select coalesce(array_agg(role),'{}') into roles from public.tenant_membership_roles where tenant_id=target_tenant_id and user_id=auth.uid();
 select coalesce(array_agg(id),'{}') into own_ids from public.beneficiario b where b.tenant_id=target_tenant_id and (
 exists(select 1 from public.family_links l where l.tenant_id=b.tenant_id and l.beneficiario_id=b.id and l.user_id=auth.uid() and l.status='active')
 or (b.rama in ('KM','Rovers') and b.activo is distinct from false and exists(select 1 from public.youth_accounts a where a.tenant_id=b.tenant_id and a.member_id=b.id and a.user_id=auth.uid())));
 result:=jsonb_build_object('tenant_id',target_tenant_id,'roles',roles,'manager',manager,'branch_manager',branch_manager,'ledger',ledger,
 'association_enabled',coalesce((select association_enabled from public.group_governance_settings where tenant_id=target_tenant_id),false));
 result:=result||jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',coalesce(p.full_name,'Sin nombre'),'roles',(select coalesce(jsonb_agg(r.role),'[]') from public.tenant_membership_roles r where r.tenant_id=m.tenant_id and r.user_id=m.user_id)))
 from public.tenant_memberships m left join public.profiles p on p.id=m.user_id where m.tenant_id=target_tenant_id and m.status='active' and (manager or branch_manager)),'[]'));
 result:=result||jsonb_build_object('assignments',coalesce((select jsonb_agg(to_jsonb(s)) from public.tenant_branch_scopes s where s.tenant_id=target_tenant_id and (manager or s.user_id=auth.uid() or public.governance_leader(target_tenant_id,s.branch))),'[]'));
 result:=result||jsonb_build_object('terms',coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'role',r.role,'name',p.full_name,'ends_on',t.ends_on,'extension_reason',t.extension_reason))
 from public.tenant_membership_roles r left join public.role_terms t using(tenant_id,user_id,role) left join public.profiles p on p.id=r.user_id
 where r.tenant_id=target_tenant_id and (r.role='group_leadership' or r.role like 'association_%') and (manager or r.user_id=auth.uid())),'[]'));
 result:=result||jsonb_build_object('people',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.nombre,'branch',b.rama,'active',b.activo,'family',b.grupo_familiar,
 'phone',b.telefono_contacto,'email',b.email_contacto,'can_edit',public.governance_branch(target_tenant_id,b.rama,'edit'),
 'can_inactivate',public.governance_branch(target_tenant_id,b.rama,'inactivate'),'can_transfer',public.governance_branch(target_tenant_id,b.rama,'transfer')))
 from public.beneficiario b where b.tenant_id=target_tenant_id and (ledger or public.governance_branch(target_tenant_id,b.rama,'view'))),'[]'));
 result:=result||jsonb_build_object('links',coalesce((select jsonb_agg(jsonb_build_object('user_id',l.user_id,'member_id',l.beneficiario_id,'kind','family')) from public.family_links l join public.beneficiario b on b.id=l.beneficiario_id and b.tenant_id=l.tenant_id
 where l.tenant_id=target_tenant_id and l.status='active' and (manager or public.governance_leader(target_tenant_id,b.rama))),'[]')
 ||coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'member_id',a.member_id,'kind','youth')) from public.youth_accounts a join public.beneficiario b on b.id=a.member_id and b.tenant_id=a.tenant_id where a.tenant_id=target_tenant_id and (manager or public.governance_leader(target_tenant_id,b.rama))),'[]'));
 result:=result||jsonb_build_object('health',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.nombre,'revision',d.reviewed_at,'health',public.member_health_payload(b.id),'review',r.status))
 from public.beneficiario b join public.family_links l on l.beneficiario_id=b.id and l.tenant_id=b.tenant_id and l.user_id=auth.uid() and l.status='active'
 left join public.health_digitizations d on d.member_id=b.id and d.tenant_id=b.tenant_id left join public.health_family_reviews r on r.member_id=b.id and r.tenant_id=b.tenant_id and r.user_id=auth.uid() and r.revision=d.reviewed_at where b.tenant_id=target_tenant_id),'[]'));
 result:=result||jsonb_build_object('health_errors',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.nombre)) from public.health_family_reviews r join public.beneficiario b on b.id=r.member_id and b.tenant_id=r.tenant_id join public.health_digitizations d on d.member_id=b.id and d.reviewed_at=r.revision
 where r.tenant_id=target_tenant_id and r.status='error' and public.governance_leader(target_tenant_id,b.rama)),'[]'));
 result:=result||jsonb_build_object('boxes',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('can_manage',public.has_tenant_role(target_tenant_id,array['treasury']) or public.governance_leader(target_tenant_id,b.branch),'balance',coalesce((select sum(e.amount) from public.branch_cash_entries e where e.box_id=b.id and e.tenant_id=b.tenant_id),0))) from public.branch_cash_boxes b where b.tenant_id=target_tenant_id and public.can_read_branch_cash(target_tenant_id,b.branch)),'[]'));
 result:=result||jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'box_id',e.box_id,'amount',e.amount,'description',e.description,'created_at',e.created_at)) from public.branch_cash_entries e join public.branch_cash_boxes b on b.id=e.box_id and b.tenant_id=e.tenant_id where b.tenant_id=target_tenant_id and public.can_read_branch_cash(target_tenant_id,b.branch)),'[]'));
 -- Para solicitar una transferencia sólo se exponen identificador y nombre del destino, no su saldo.
 result:=result||jsonb_build_object('cash_destinations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'branch',branch)) from public.branch_cash_boxes where tenant_id=target_tenant_id and (ledger or branch_manager)),'[]'));
 result:=result||jsonb_build_object('transfers',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('can_source',public.governance_leader(target_tenant_id,s.branch),'can_destination',public.governance_leader(target_tenant_id,d.branch))) from public.branch_cash_transfers t join public.branch_cash_boxes s on s.id=t.source_id join public.branch_cash_boxes d on d.id=t.destination_id where t.tenant_id=target_tenant_id and (public.can_read_branch_cash(target_tenant_id,s.branch) or public.can_read_branch_cash(target_tenant_id,d.branch))),'[]'));
 result:=result||jsonb_build_object('polls',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'options',p.options,'closes_at',p.closes_at,'voted',e.voted,'eligible',e.user_id is not null,
 'totals',case when p.closes_at<=now() then (select jsonb_agg(jsonb_build_object('option',option_index,'votes',votes) order by option_index) from public.poll_totals where poll_id=p.id) else null end)) from public.group_polls p left join public.poll_electors e on e.poll_id=p.id and e.user_id=auth.uid() where p.tenant_id=target_tenant_id and (e.user_id is not null or public.has_tenant_role(target_tenant_id,array['group_leadership']))),'[]'));
 result:=result||jsonb_build_object('activities',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.nombre,'date',e.fecha,'description',e.descripcion,'location',e.ubicacion)) from public.evento_calendario e
 where e.tenant_id=target_tenant_id and (manager or e.todo_el_grupo is true or exists(select 1 from public.tenant_branch_scopes s where s.tenant_id=e.tenant_id and s.user_id=auth.uid() and e.ramas_participantes ? s.branch) or exists(select 1 from public.beneficiario b where b.id=any(own_ids) and e.ramas_participantes ? b.rama))),'[]'));
 result:=result||jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(t)) from public.branch_tasks t where t.tenant_id=target_tenant_id and (t.assigned_to=auth.uid() or public.governance_leader(target_tenant_id,t.branch))),'[]'));
 result:=result||jsonb_build_object('scholarships',coalesce((select jsonb_agg(to_jsonb(s)) from public.period_scholarships s where s.tenant_id=target_tenant_id and ledger),'[]'),
 'special_activities',coalesce((select jsonb_agg(x) from(select id,nombre as name,'camp' as concept from public.campamento where tenant_id=target_tenant_id and ledger union all select id,nombre,'activity' from public.actividad_economica where tenant_id=target_tenant_id and ledger) x),'[]'));
 result:=result||jsonb_build_object('accounts',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.nombre,'branch',b.rama,
 'billing',public.private_member_billing(target_tenant_id,b.id),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('date',p.fecha_pago,'amount',p.monto,'concept',p.tipo_pago,'months',p.meses,'year',p.anio)) from public.pago p where p.tenant_id=b.tenant_id and p.beneficiario_id=b.id::text),'[]'),
 'affiliations',coalesce((select jsonb_agg(jsonb_build_object('year',a.anio,'amount',a.monto,'paid',a.monto_pagado)) from public.afiliacion a where a.tenant_id=b.tenant_id and a.beneficiario_id=b.id::text),'[]'),
 'credit',coalesce((select sum(c.monto_disponible) from public.credito_beneficiario c where c.tenant_id=b.tenant_id and c.beneficiario_id=b.id::text),0))) from public.beneficiario b where b.tenant_id=target_tenant_id and b.id=any(own_ids)),'[]'));
 return result;
end $$;

-- Extender las proyecciones existentes con historial, sin conceder SELECT médico a roles nuevos.
alter function public.list_tenant_people(uuid,integer,integer) rename to list_tenant_people_legacy;
revoke all on function public.list_tenant_people_legacy(uuid,integer,integer) from public,anon,authenticated;
create or replace function public.list_tenant_people(target_tenant_id uuid,target_offset integer default 0,target_limit integer default 500) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.can_access_tenant(target_tenant_id) then raise exception 'ACCESS_DENIED'; end if;
 if public.has_tenant_role(target_tenant_id,array['branch_deputy','branch_assistant']) and not(public.is_super_admin() or public.has_tenant_role(target_tenant_id,array['tenant_admin','administration','group_leadership','treasury','branch_leader'])) then
 if target_offset is null or target_limit is null or target_offset<0 or target_limit not between 1 and 500 then raise exception 'INVALID_PAGE'; end if;
 select coalesce(jsonb_agg(p),'[]') into result from(select jsonb_build_object('id',b.id,'tenant_id',b.tenant_id,'nombre',b.nombre,'rama',b.rama,'activo',b.activo) p from public.beneficiario b where b.tenant_id=target_tenant_id and public.governance_branch(target_tenant_id,b.rama,'view') order by b.id offset target_offset limit target_limit) q;
 else result:=public.list_tenant_people_legacy(target_tenant_id,target_offset,target_limit); end if;
 return coalesce((select jsonb_agg(p||jsonb_build_object('scholarship_periods',coalesce((select jsonb_agg(jsonb_build_object('member_id',s.member_id,'branch',s.branch,'percentage',s.percentage,'starts_on',s.starts_on,'ends_on',s.ends_on,'concept',s.concept,'activity_id',s.activity_id)) from public.period_scholarships s where s.tenant_id=target_tenant_id and (s.member_id=(p->>'id')::uuid or s.branch=p->>'rama') and (s.concept='fee' or s.approvals ?& array['treasury','group_leadership'])),'[]'),
 'inactive_periods',coalesce((select jsonb_agg(jsonb_build_object('starts_on',i.starts_on,'ends_on',i.ends_on)) from public.member_inactive_periods i where i.tenant_id=target_tenant_id and i.member_id=(p->>'id')::uuid),'[]'))) from jsonb_array_elements(result) p),'[]');
end $$;
revoke all on function public.get_group_workspace(uuid),public.list_tenant_people(uuid,integer,integer) from public,anon;
grant execute on function public.get_group_workspace(uuid),public.list_tenant_people(uuid,integer,integer) to authenticated;
commit;
