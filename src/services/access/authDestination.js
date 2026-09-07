export const AUTH_PATHS = Object.freeze({
  login: '/login',
  superAdmin: '/super-admin',
  tenantAdmin: '/app'
});

export function isSuperAdmin(user) {
  return Boolean(user?.is_super_admin);
}

export function canAccessAdministration(user) {
  return Boolean(user && (isSuperAdmin(user) || user.role === 'admin'));
}

export function getAuthenticatedHome(user) {
  if (!user) return AUTH_PATHS.login;
  return isSuperAdmin(user) ? AUTH_PATHS.superAdmin : AUTH_PATHS.tenantAdmin;
}
