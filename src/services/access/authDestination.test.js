import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTH_PATHS,
  canAccessAdministration,
  getAuthenticatedHome,
  isSuperAdmin
} from './authDestination.js';

test('a superadmin with a tenant role enters the global console', () => {
  const user = { role: 'admin', is_super_admin: true, tenant_id: 'tenant-1' };

  assert.equal(isSuperAdmin(user), true);
  assert.equal(canAccessAdministration(user), true);
  assert.equal(getAuthenticatedHome(user), AUTH_PATHS.superAdmin);
});

test('a tenant admin without global privileges enters the tenant dashboard', () => {
  const user = { role: 'admin', is_super_admin: false, tenant_id: 'tenant-1' };

  assert.equal(isSuperAdmin(user), false);
  assert.equal(canAccessAdministration(user), true);
  assert.equal(getAuthenticatedHome(user), AUTH_PATHS.tenantAdmin);
});

test('a non-admin account cannot access administration', () => {
  const user = { role: 'member', is_super_admin: false };

  assert.equal(canAccessAdministration(user), false);
});

test('an anonymous visitor is sent to login', () => {
  assert.equal(canAccessAdministration(null), false);
  assert.equal(getAuthenticatedHome(null), AUTH_PATHS.login);
});
