import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),other=id(2),admin=id(11),leader=id(12),treasury=id(13),assistant=id(14),parent=id(15),youth=id(16),support=id(17),group=id(18),otherLeader=id(19),p1=id(21),p2=id(22);
const sql = name => readFile(new URL(`../../../supabase/migrations/${name}.sql`,import.meta.url),'utf8');

test('governance: real migrations, scope boundaries, secret vote, approvals and family review',async t=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('test.email',true))$$;
 create schema extensions;
 create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'hex')$$;
 create function extensions.digest(value text,algorithm text) returns bytea language sql as $$select decode(md5(value),'hex')$$;
 create table auth.users(id uuid primary key);
 create table tenants(id uuid primary key,active boolean default true);
 create table profiles(id uuid primary key,full_name text,email text);
 create table tenant_memberships(tenant_id uuid,user_id uuid,role text,status text,primary key(tenant_id,user_id));
 create table tenant_membership_roles(tenant_id uuid,user_id uuid,role text,created_at timestamptz default now(),primary key(tenant_id,user_id,role));
 create table tenant_access_audit(id uuid default gen_random_uuid(),tenant_id uuid,actor_user_id uuid,target_user_id uuid,action text,previous_value jsonb,next_value jsonb);
 create function is_super_admin() returns boolean language sql stable as $$select false$$;
 grant usage on schema auth,public to authenticated,anon;`);
 await db.exec((await sql('0002_base44_entities')).replace(/create extension if not exists pgcrypto;/gi,''));
 const access=await sql('202609070001_tenant_access_roles_invitations');
 const inviteStart=access.indexOf('create table if not exists public.tenant_invitations');
 await db.exec(access.slice(inviteStart,access.indexOf('create index if not exists tenant_invitations_tenant_status_idx',inviteStart)));
 for(const name of ['assert_valid_tenant_roles','has_tenant_role','can_access_tenant','can_manage_tenant_users','set_tenant_member_roles']){
 const start=access.indexOf(`create or replace function public.${name}(`),end=access.indexOf('$$;',access.indexOf('as $$',start));await db.exec(access.slice(start,end+3));}
 const tables=(await db.query("select tablename from pg_tables where schemaname='public'")).rows;
 for(const {tablename} of tables)if(!['tenants','profiles','tenant_memberships','tenant_membership_roles','tenant_access_audit'].includes(tablename))await db.exec(`alter table "${tablename}" add column if not exists tenant_id uuid`);
 await db.exec(`insert into tenants(id) values('${tenant}'),('${other}');
 insert into beneficiario(id,tenant_id,nombre,rama,tipo,activo,alergias,salud_mental) values('${p1}','${tenant}','Persona ficticia','Rovers','Beneficiario',true,'Resumen','Privado'),('${p2}','${tenant}','Otra persona','Tropa','Beneficiario',true,'Resumen','Privado');
 grant select,insert,update,delete on all tables in schema public to authenticated;
 create policy legacy on beneficiario for all to authenticated using(true) with check(true);`);
 for(const [uid,role] of [[admin,'tenant_admin'],[leader,'branch_leader'],[treasury,'treasury'],[assistant,'support'],[parent,'family'],[youth,'youth'],[support,'support'],[group,'group_leadership'],[otherLeader,'branch_leader']]){
 await db.query('insert into auth.users values($1)',[uid]);await db.query('insert into profiles values($1,$2,null)',[uid,`Prueba ${role}`]);
 await db.query("insert into tenant_memberships values($1,$2,'member','active')",[tenant,uid]);await db.query('insert into tenant_membership_roles(tenant_id,user_id,role) values($1,$2,$3)',[tenant,uid,role]);}
 await db.exec('alter table profiles add column is_super_admin boolean default false');
 for(const name of ['202609070003_family_google_linking','202609090002_scoped_roles_and_scholarships','202609090003_group_emergency_access','202609090004_branch_health_digitization','202609160001_scoped_governance','202609160002_governance_operations','202609160003_governance_projections','202609160004_governance_hardening'])await db.exec(await sql(name));
 const as=async uid=>db.exec(`reset role;set test.uid='${uid}';set role authenticated;`);
 const rpc=async(name,args=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
 await t.test('scoped appointments, uniqueness and deputy delegation',async()=>{
 await as(admin);await rpc('save_branch_assignment',[tenant,leader,'Rovers','branch_leader',[]]);await rpc('save_branch_assignment',[tenant,otherLeader,'Tropa','branch_leader',[]]);
 await assert.rejects(rpc('save_branch_assignment',[tenant,assistant,'Rovers','branch_leader',[]]));
 await assert.rejects(rpc('save_branch_assignment',[tenant,leader,'KM','branch_leader',[]]));
 await as(leader);await rpc('save_branch_assignment',[tenant,assistant,'Rovers','branch_assistant',['edit']]);
 await assert.rejects(rpc('save_branch_assignment',[tenant,assistant,'Tropa','branch_assistant',[]]));
 await assert.rejects(rpc('save_branch_assignment',[tenant,youth,'Rovers','branch_assistant',[]]));
 await as(assistant);await rpc('update_branch_person',[tenant,p1,{nombre:'Nombre corregido'}]);
 await assert.rejects(rpc('update_branch_person',[tenant,p2,{nombre:'No permitido'}]));
 await assert.rejects(rpc('update_branch_person',[tenant,p1,{activo:false,effective_date:'2026-09-01'}]));
 await assert.rejects(rpc('get_group_workspace',[other]));
 });
 await t.test('emergency projection and chief-only digitization',async()=>{
 await as(support);const emergency=await rpc('list_tenant_emergency_people',[tenant]);assert.equal(emergency[0].alergias,'Resumen');assert.equal(emergency[0].salud_mental,undefined);
 assert.equal(await rpc('can_digitize_health',[tenant,p1]),false);
 await as(assistant);assert.equal((await rpc('list_tenant_emergency_people',[tenant]))[0].salud_mental,'Privado');assert.equal(await rpc('can_digitize_health',[tenant,p1]),false);
 await as(leader);assert.equal(await rpc('can_digitize_health',[tenant,p1]),true);assert.equal(await rpc('can_digitize_health',[tenant,p2]),false);
 });
 await t.test('explicit family links, youth self account and review version',async()=>{
 await as(parent);await assert.rejects(rpc('set_person_account',[tenant,parent,p1,'family',true]));
 await as(leader);await rpc('set_person_account',[tenant,parent,p1,'family',true]);await rpc('set_person_account',[tenant,youth,p1,'youth',true]);
 await assert.rejects(rpc('set_person_account',[tenant,parent,p2,'family',true]));
 const draft=await rpc('get_member_health_draft',[tenant,p1]);await rpc('save_member_health_digitization',[tenant,p1,draft.revision,{alergias:'Confirmado'},true]);
 await as(parent);const snapshot=await rpc('get_group_workspace',[tenant]);assert.equal(snapshot.health.length,1);assert.equal(snapshot.accounts.length,1);
 await rpc('review_family_health',[tenant,p1,snapshot.health[0].revision,'confirmed']);await assert.rejects(rpc('review_family_health',[tenant,p2,snapshot.health[0].revision,'confirmed']));
 await as(youth);assert.equal((await rpc('get_group_workspace',[tenant])).health.length,0);
 });
 await t.test('cash transfer requires treasury and both branch chiefs, no double posting',async()=>{
 await as(leader);await rpc('manage_branch_cash',[tenant,'create',{name:'Caja Rover',branch:'Rovers'}]);
 const source=(await rpc('get_group_workspace',[tenant])).boxes[0].id;
 await rpc('manage_branch_cash',[tenant,'entry',{box_id:source,amount:100,description:'Ingreso documentado'}]);
 await as(otherLeader);await rpc('manage_branch_cash',[tenant,'create',{name:'Caja Tropa',branch:'Tropa'}]);
 const destination=(await rpc('get_group_workspace',[tenant])).boxes[0].id;
 await as(leader);await rpc('manage_branch_cash',[tenant,'transfer',{box_id:source,destination_id:destination,amount:25,description:'Transferencia de prueba'}]);
 const transfer=(await rpc('get_group_workspace',[tenant])).transfers[0].id;
 await rpc('manage_branch_cash',[tenant,'approve',{id:transfer,as:'source'}]);
 await assert.rejects(rpc('manage_branch_cash',[tenant,'approve',{id:transfer,as:'treasury'}]));
 await as(treasury);await rpc('manage_branch_cash',[tenant,'approve',{id:transfer,as:'treasury'}]);
 assert.equal((await rpc('get_group_workspace',[tenant])).transfers[0].status,'pending');
 await as(otherLeader);await rpc('manage_branch_cash',[tenant,'approve',{id:transfer,as:'destination'}]);
 assert.equal((await rpc('get_group_workspace',[tenant])).boxes[0].balance,25);
 await assert.rejects(rpc('manage_branch_cash',[tenant,'approve',{id:transfer,as:'destination'}]));
 await as(leader);await rpc('manage_branch_cash',[tenant,'transfer',{box_id:source,destination_id:destination,amount:10,description:'Revalidación de responsables'}]);
 const pending=(await rpc('get_group_workspace',[tenant])).transfers.find(x=>x.status==='pending').id;
 await rpc('manage_branch_cash',[tenant,'approve',{id:pending,as:'source'}]);
 await as(treasury);await rpc('manage_branch_cash',[tenant,'approve',{id:pending,as:'treasury'}]);
 await db.exec(`reset role;update tenant_memberships set status='suspended' where user_id='${leader}'`);
 await as(otherLeader);await rpc('manage_branch_cash',[tenant,'approve',{id:pending,as:'destination'}]);
 assert.equal((await rpc('get_group_workspace',[tenant])).transfers.find(x=>x.id===pending).status,'pending');
 await db.exec(`reset role;update tenant_memberships set status='active' where user_id='${leader}'`);
 await as(leader);await rpc('manage_branch_cash',[tenant,'approve',{id:pending,as:'source'}]);
 assert.equal((await rpc('get_group_workspace',[tenant])).transfers.find(x=>x.id===pending).status,'posted');
 });
 await t.test('secret vote only explicit electorate, duplicate rejected, totals hidden until close',async()=>{
 await as(group);const poll=await rpc('create_group_poll',[tenant,'Asamblea de prueba',['Sí','No'],'2099-01-01',[parent,parent,youth]]);
 await as(support);await assert.rejects(rpc('cast_group_vote',[tenant,poll,0]));
 await as(parent);await rpc('cast_group_vote',[tenant,poll,0]);await assert.rejects(rpc('cast_group_vote',[tenant,poll,1]));
 const state=await rpc('get_group_workspace',[tenant]);assert.equal(state.polls[0].totals,null);assert.equal(state.polls[0].voted,true);
 await assert.rejects(db.query('select * from poll_totals'));await assert.rejects(db.query('select * from poll_electors'));
 await as(leader);await rpc('update_branch_person',[tenant,p1,{rama:'Tropa'}]);
 await as(youth);await assert.rejects(rpc('cast_group_vote',[tenant,poll,1]));
 await as(leader);await rpc('update_branch_person',[tenant,p1,{rama:'Rovers'}]);
 await as(youth);await rpc('cast_group_vote',[tenant,poll,1]);
 });
 await t.test('period scholarships reject affiliation and overlaps; future term retains access',async()=>{
 await as(treasury);await rpc('save_period_scholarship',[tenant,{branch:'Rovers',percentage:50,starts_on:'2026-09-01',ends_on:'2026-10-31',concept:'fee'}]);
 await assert.rejects(rpc('save_period_scholarship',[tenant,{branch:'Rovers',percentage:50,starts_on:'2026-10-01',ends_on:'2026-10-31',concept:'fee'}]));
 await assert.rejects(rpc('save_period_scholarship',[tenant,{branch:'Rovers',percentage:50,starts_on:'2026-09-01',ends_on:'2026-10-31',concept:'affiliation'}]));
 await as(admin);await rpc('save_role_term',[tenant,group,'group_leadership','2020-01-01','']);await assert.rejects(rpc('save_role_term',[tenant,group,'group_leadership','2030-01-01','']));
 await as(group);assert.equal((await rpc('get_group_workspace',[tenant])).manager,true);
 });
 await t.test('editing scholarships preserves previous periods and requires current authority',async()=>{
 await as(treasury);await rpc('save_period_scholarship',[tenant,{member_id:p1,percentage:25,starts_on:'2090-01-01',ends_on:'2090-12-31',concept:'fee'}]);
 const grant=(await rpc('get_group_workspace',[tenant])).scholarships.find(s=>s.member_id===p1);
 await as(assistant);await assert.rejects(rpc('revise_period_scholarship',[tenant,{id:grant.id,percentage:100,starts_on:'2090-03-01',ends_on:'2090-12-31'}]));
 await as(treasury);await assert.rejects(rpc('revise_period_scholarship',[tenant,{id:grant.id,percentage:0,starts_on:'2000-03-01',ends_on:'2090-12-31'}]));
 await rpc('revise_period_scholarship',[tenant,{id:grant.id,percentage:0,starts_on:'2090-03-01',ends_on:'2090-12-31'}]);
 const records=(await rpc('get_group_workspace',[tenant])).scholarships.filter(s=>s.member_id===p1);
 assert.equal(records.find(s=>s.id===grant.id).ends_on,'2090-02-28');assert.equal(records.find(s=>s.starts_on==='2090-03-01').percentage,0);
 });
 await t.test('branch receiving search is minimal and family cannot enumerate',async()=>{
 await as(parent);await assert.rejects(rpc('find_branch_transfer_candidates',[tenant,'Otra']));
 await as(leader);const found=await rpc('find_branch_transfer_candidates',[tenant,'Otra']);assert.equal(found[0].id,p2);assert.deepEqual(Object.keys(found[0]).sort(),['branch','id','name']);
 });
 await t.test('chief creates family invitation only in own branch; acceptance preserves other roles',async()=>{
 await as(leader);await assert.rejects(rpc('invite_member_parent',[tenant,p2,'Padre ficticio','parent@example.local']));
 const invitation=await rpc('invite_member_parent',[tenant,p1,'Padre ficticio','parent@example.local']);
 await as(parent);await db.exec("set test.email='other@example.local'");await assert.rejects(rpc('accept_tenant_invitation',[invitation.token]));
 await db.exec("set test.email='parent@example.local'");assert.equal(await rpc('accept_tenant_invitation',[invitation.token]),tenant);
 await assert.rejects(rpc('accept_tenant_invitation',[invitation.token]));
 });
 }finally{await db.close();}
});
