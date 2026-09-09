import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessPath, hasPermission, PERMISSIONS } from './permissions.js';
import { readEmergencyPeople } from './tenantPeople.js';

test('equipo adulto puede consultar emergencias de todas las ramas', () => {
  for (const role of ['tenant_admin','administration','group_leadership','treasury','branch_leader','support','institutional']) {
    const user = { tenant_roles:[role] };
    assert.equal(canAccessPath(user,'/directorio-emergencias'),true,role);
    assert.equal(canAccessPath(user,'/ficha-emergencia'),true,role);
  }
  for (const role of ['family','youth','viewer']) assert.equal(canAccessPath({tenant_roles:[role]},'/directorio-emergencias'),false);
  assert.equal(canAccessPath(null,'/directorio-emergencias'),false);
  assert.equal(canAccessPath({tipo:'Voluntario',role:'admin'},'/directorio-emergencias'),false);
  for (const permission of [PERMISSIONS.membersManage,PERMISSIONS.cashManage,PERMISSIONS.usersManage]) assert.equal(hasPermission({tenant_roles:['support']},permission),false);
});

test('emergencias usa su proyección exclusiva y rechaza errores y tenants ajenos', async () => {
  const tenant='00000000-0000-4000-8000-000000000001';
  const client={rpc:async (name,args)=>{assert.equal(name,'list_tenant_emergency_people');assert.equal(args.target_tenant_id,tenant);return {data:[]};}};
  assert.deepEqual(await readEmergencyPeople(client,tenant),[]);
  await assert.rejects(readEmergencyPeople({rpc:async()=>({error:true})},tenant));
  await assert.rejects(readEmergencyPeople({rpc:async()=>({data:[{id:tenant,tenant_id:'00000000-0000-4000-8000-000000000002'}]})},tenant));
});
