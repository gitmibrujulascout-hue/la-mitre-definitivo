import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveScholarship, scholarshipWrite } from './scholarships.js';
import { hasPermission, PERMISSIONS } from './permissions.js';
import { readTenantPeople } from './tenantPeople.js';

test('becas por grupo con excepciones explícitas y sin regla Rover global', () => {
  const member = { rama: 'Rovers', tipo: 'Beneficiario', beca_override: null };
  assert.equal(effectiveScholarship(member), false);
  assert.equal(effectiveScholarship(member, ['Rovers']), true);
  assert.equal(effectiveScholarship({ ...member, beca_override: false }, ['Rovers']), false);
  assert.equal(effectiveScholarship({ ...member, beca_override: true }, []), true);
  assert.equal(effectiveScholarship({ ...member, tipo: 'Voluntario' }, ['Rovers']), false);
  assert.deepEqual(scholarshipWrite({ becado: false }), { beca_override: false });
  assert.deepEqual(scholarshipWrite({ beca_override: null, becado: true }), { beca_override: null });
  assert.throws(() => scholarshipWrite({ beca_override: 'false' }));
});

test('rama permite su espacio y emergencias, pero deniega gestión, finanzas y usuarios', () => {
  const user = { tenant_roles: ['branch_leader'], permissions: Object.values(PERMISSIONS), role: 'admin' };
  assert.equal(hasPermission(user, PERMISSIONS.branchView), true);
  assert.equal(hasPermission(user, PERMISSIONS.emergencyView), true);
  for (const permission of [PERMISSIONS.membersManage, PERMISSIONS.cashManage, PERMISSIONS.usersManage]) assert.equal(hasPermission(user, permission), false);
  const multiple = { tenant_roles: ['branch_leader', 'treasury'] };
  assert.equal(hasPermission(multiple, PERMISSIONS.branchView), true);
  assert.equal(hasPermission(multiple, PERMISSIONS.cashManage), true);
  assert.equal(hasPermission(multiple, PERMISSIONS.emergencyView), true);
});

test('lectura rechaza datos cruzados y no recurre a tablas completas si falla la proyección', async () => {
  const tenant = '00000000-0000-4000-8000-000000000001';
  await assert.rejects(readTenantPeople({ rpc: async () => ({ error: true }) }, tenant));
  await assert.rejects(readTenantPeople({ rpc: async () => ({ data: [{ id: tenant, tenant_id: '00000000-0000-4000-8000-000000000002' }] }) }, tenant));
  assert.deepEqual(await readTenantPeople({ rpc: async () => ({ data: [] }) }, tenant), []);
});
