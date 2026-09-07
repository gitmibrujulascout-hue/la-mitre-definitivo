import { canAccessTenantWorkspace } from './permissions.js';

export const AUTH_PATHS = Object.freeze({
  login: '/login',
  superAdmin: '/super-admin',
  tenantAdmin: '/app',
  noAccess: '/sin-acceso'
});

export function isSuperAdmin(user) {
  return Boolean(user?.is_super_admin);
}

export function canAccessAdministration(user) {
  return Boolean(user && (isSuperAdmin(user) || canAccessTenantWorkspace(user)));
}

export function getAuthenticatedHome(user) {
  if (!user) return AUTH_PATHS.login;
  if (isSuperAdmin(user)) return AUTH_PATHS.superAdmin;
  return canAccessTenantWorkspace(user) ? AUTH_PATHS.tenantAdmin : AUTH_PATHS.noAccess;
}
