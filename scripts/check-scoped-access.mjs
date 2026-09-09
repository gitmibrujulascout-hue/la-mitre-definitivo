// Motor aislado de prueba; instalar según specs/SEC-FIN-006-roles-and-scholarships.md.
import { PGlite } from '../test-artifacts/pg-check/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
process.on('uncaughtException',error => { console.error(error.message, error.detail || '', error.where || ''); process.exit(1); });
const db = new PGlite();
const tenantA='00000000-0000-4000-8000-000000000001',tenantB='00000000-0000-4000-8000-000000000002';
const admin='00000000-0000-4000-8000-000000000011',branch='00000000-0000-4000-8000-000000000012',treasury='00000000-0000-4000-8000-000000000013';
const p1='00000000-0000-4000-8000-000000000021',p2='00000000-0000-4000-8000-000000000022',p3='00000000-0000-4000-8000-000000000023';
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
create table tenants(id uuid primary key,active boolean default true);
create table tenant_memberships(tenant_id uuid,user_id uuid,role text,status text,primary key(tenant_id,user_id));
create table tenant_membership_roles(tenant_id uuid,user_id uuid,role text,primary key(tenant_id,user_id,role));
create table tenant_access_audit(id uuid default gen_random_uuid(),tenant_id uuid,actor_user_id uuid,target_user_id uuid,action text,previous_value jsonb,next_value jsonb);
create function is_super_admin() returns boolean language sql stable as $$select false$$;
create function assert_valid_tenant_roles(requested_roles text[]) returns void language plpgsql as $$begin if cardinality(requested_roles)=0 then raise exception 'INVALID_ROLES'; end if; end$$;
`);
// Reutilizar tablas y funciones reales; sólo auth.uid y superadmin son fixtures.
let initial=await readFile('supabase/migrations/0002_base44_entities.sql','utf8');
initial=initial.replace(/create extension if not exists pgcrypto;/gi,'');
await db.exec(initial);
const access=await readFile('supabase/migrations/202609070001_tenant_access_roles_invitations.sql','utf8');
for(const name of ['has_tenant_role','can_access_tenant','can_manage_tenant_users','set_tenant_member_roles']) {
 const start=access.indexOf(`create or replace function public.${name}(`),end=access.indexOf('$$;',access.indexOf('as $$',start));
 await db.exec(access.slice(start,end+3));
}
await db.exec(`alter table beneficiario add column tenant_id uuid;
insert into tenants(id) values('${tenantA}'),('${tenantB}');
insert into tenant_memberships values('${tenantA}','${admin}','admin','active'),('${tenantA}','${branch}','member','active'),('${tenantA}','${treasury}','member','active');
insert into tenant_membership_roles values('${tenantA}','${admin}','tenant_admin'),('${tenantA}','${branch}','branch_leader'),('${tenantA}','${treasury}','treasury');
insert into beneficiario(id,tenant_id,nombre,rama,tipo,becado,contacto_emergencia_telefono,alergias) values
('${p1}','${tenantA}','Persona A','Rovers','Beneficiario',false,'contacto ficticio','dato privado'),
('${p2}','${tenantA}','Persona B','Tropa','Beneficiario',false,'otro contacto','otro dato'),
('${p3}','${tenantB}','Persona C','Rovers','Beneficiario',false,'fuera tenant','privado');
grant usage on schema public to authenticated,anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
create policy legacy_all on beneficiario for all to authenticated using(true) with check(true);
`);
// Las tablas operativas de la fixture reciben tenant_id como en 0003.
const tables=await db.query("select tablename from pg_tables where schemaname='public'");
for(const {tablename} of tables.rows) if(!['tenants','tenant_memberships','tenant_membership_roles','tenant_access_audit','beneficiario'].includes(tablename)) await db.exec(`alter table "${tablename}" add column if not exists tenant_id uuid`);
const migration=await readFile('supabase/migrations/202609090002_scoped_roles_and_scholarships.sql','utf8');
await db.exec(migration);
async function asUser(id){await db.exec(`reset role;set test.uid='${id}';set role authenticated;`);}
await asUser(admin);
await db.query('select save_tenant_scholarship_policy($1,$2)',[tenantA,['Rovers']]);
let rows=(await db.query('select id,becado from beneficiario order by id')).rows;
assert.equal(rows.length,2);assert.equal(rows.find(p=>p.id===p1).becado,true);assert.equal(rows.find(p=>p.id===p2).becado,false);
await db.query('update beneficiario set beca_override=false where id=$1',[p1]);
await db.query('select save_tenant_scholarship_policy($1,$2)',[tenantA,[]]);
await db.query('select save_tenant_scholarship_policy($1,$2)',[tenantA,['Rovers']]);
assert.equal((await db.query('select becado from beneficiario where id=$1',[p1])).rows[0].becado,false);
await db.query('update beneficiario set beca_override=null where id=$1',[p1]);
assert.equal((await db.query('select becado from beneficiario where id=$1',[p1])).rows[0].becado,true);
await db.query('select set_tenant_member_access($1,$2,$3,$4)',[tenantA,branch,['branch_leader'],['Rovers']]);
await asUser(branch);
assert.equal((await db.query('select * from beneficiario')).rows.length,0);
let projected=(await db.query('select list_tenant_people($1) as people',[tenantA])).rows[0].people;
assert.equal(projected.length,1);assert.equal(projected[0].id,p1);assert.equal(projected[0].contacto_emergencia_telefono,'contacto ficticio');assert.equal(projected[0].alergias,undefined);
await assert.rejects(db.query('select list_tenant_people($1)',[tenantB]));
await assert.rejects(db.query('select save_tenant_scholarship_policy($1,$2)',[tenantA,['Tropa']]));
assert.equal((await db.query('update beneficiario set becado=false returning id')).rows.length,0);
await asUser(treasury);
projected=(await db.query('select list_tenant_people($1) as people',[tenantA])).rows[0].people;
assert.equal(projected.length,2);assert.equal(projected[0].alergias,undefined);assert.equal(projected[0].contacto_emergencia_telefono,undefined);
assert.equal((await db.query('select * from beneficiario')).rows.length,0);
await asUser(admin);
await db.query('select set_tenant_member_access($1,$2,$3,$4)',[tenantA,branch,['branch_leader','treasury'],['Rovers']]);
await asUser(branch);
projected=(await db.query('select list_tenant_people($1) as people',[tenantA])).rows[0].people;
assert.equal(projected.length,2);
assert.equal(projected.find(p=>p.id===p1).contacto_emergencia_telefono,'contacto ficticio');
assert.equal(projected.find(p=>p.id===p2).contacto_emergencia_telefono,undefined);
assert.equal(projected.some(p=>Object.hasOwn(p,'alergias')),false);
await asUser(admin);
await db.query('select set_tenant_member_access($1,$2,$3,$4)',[tenantA,branch,['viewer'],[]]);
await asUser(branch);await assert.rejects(db.query('select list_tenant_people($1)',[tenantA]));
await db.exec('reset role');
assert.equal((await db.query('select becado from beneficiario where id=$1',[p3])).rows[0].becado,false);
assert.equal((await db.query('select * from tenant_branch_scopes')).rows.length,0);
await db.exec(migration); // idempotencia: no convertir becas heredadas en individuales.
assert.equal((await db.query('select beca_override from beneficiario where id=$1',[p1])).rows[0].beca_override,null);
console.log('PostgreSQL OK: migración idempotente, RLS restrictiva, dos tenants, ramas y contactos, finanzas sin salud, revocación y excepciones de beca.');
await db.close();
