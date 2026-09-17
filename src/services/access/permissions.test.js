import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PERMISSIONS,
  canAccessPath,
  canAccessTenantWorkspace,
  hasPermission,
  normalizeTenantRoles,
  permissionsForRoles
} from './permissions.js';

test('legacy administrators keep tenant administrator access', () => {
  assert.deepEqual(normalizeTenantRoles([], 'admin'), ['tenant_admin']);
  assert.equal(
    permissionsForRoles(normalizeTenantRoles([], 'admin')).includes(PERMISSIONS.usersManage),
    true
  );
});

test('multiple roles merge permissions without duplicates', () => {
  const permissions = permissionsForRoles(['administration', 'treasury']);

  assert.equal(permissions.includes(PERMISSIONS.membersManage), true);
  assert.equal(permissions.includes(PERMISSIONS.cashManage), true);
  assert.equal(new Set(permissions).size, permissions.length);
});

test('treasury can enter finance routes but cannot manage users', () => {
  const user = {
    tenant_id: 'tenant-1',
    tenant_roles: ['treasury'],
    permissions: permissionsForRoles(['treasury'])
  };

  assert.equal(canAccessTenantWorkspace(user), true);
  assert.equal(canAccessPath(user, '/caja'), true);
  assert.equal(canAccessPath(user, '/usuarios'), false);
});

test('administration can manage members but cannot assign access', () => {
  const user = {
    tenant_id: 'tenant-1',
    tenant_roles: ['administration'],
    permissions: permissionsForRoles(['administration'])
  };

  assert.equal(canAccessPath(user, '/beneficiarios'), true);
  assert.equal(canAccessPath(user, '/usuarios'), false);
  assert.equal(canAccessPath(user, '/caja'), false);
});

test('family enters only scoped tools', () => {
  const user = {
    tenant_id: 'tenant-1',
    tenant_roles: ['family'],
    permissions: permissionsForRoles(['family'])
  };

  assert.equal(canAccessTenantWorkspace(user), true);
  assert.equal(canAccessPath(user, '/mi-grupo'), true);
  assert.equal(canAccessPath(user, '/beneficiarios'), false);
});

test('super administrators bypass tenant route permissions', () => {
  const user = { is_super_admin: true, tenant_id: 'tenant-1', tenant_roles: [] };

  assert.equal(hasPermission(user, PERMISSIONS.usersManage), true);
  assert.equal(canAccessPath(user, '/usuarios'), true);
});
