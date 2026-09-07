export const TENANT_ROLES = Object.freeze({
  tenantAdmin: 'tenant_admin',
  groupLeadership: 'group_leadership',
  administration: 'administration',
  treasury: 'treasury',
  branchLeader: 'branch_leader',
  support: 'support',
  institutional: 'institutional',
  family: 'family',
  youth: 'youth',
  viewer: 'viewer'
});

export const TENANT_ROLE_OPTIONS = Object.freeze([
  {
    value: TENANT_ROLES.tenantAdmin,
    label: 'Administrador del tenant',
    shortLabel: 'Administrador',
    description: 'Acceso completo al grupo, incluida la administración de usuarios.'
  },
  {
    value: TENANT_ROLES.groupLeadership,
    label: 'Jefatura de grupo',
    shortLabel: 'Jefatura',
    description: 'Gestiona miembros, campamentos, emergencias, reportes y accesos.'
  },
  {
    value: TENANT_ROLES.administration,
    label: 'Administración',
    shortLabel: 'Administración',
    description: 'Gestiona miembros, configuración, afiliaciones y usuarios.'
  },
  {
    value: TENANT_ROLES.treasury,
    label: 'Tesorería',
    shortLabel: 'Tesorería',
    description: 'Gestiona pagos, gastos, caja, cuotas, tienda y reportes financieros.'
  },
  {
    value: TENANT_ROLES.branchLeader,
    label: 'Responsable de rama',
    shortLabel: 'Rama',
    description: 'Rol reservado para las próximas pantallas específicas de rama.'
  },
  {
    value: TENANT_ROLES.support,
    label: 'Equipo de apoyo',
    shortLabel: 'Apoyo',
    description: 'Rol reservado para las próximas herramientas del equipo de apoyo.'
  },
  {
    value: TENANT_ROLES.institutional,
    label: 'Relaciones institucionales',
    shortLabel: 'Institucional',
    description: 'Rol reservado para el futuro módulo institucional.'
  },
  {
    value: TENANT_ROLES.family,
    label: 'Familia',
    shortLabel: 'Familia',
    description: 'Acceso futuro al portal privado de la familia.'
  },
  {
    value: TENANT_ROLES.youth,
    label: 'Miembro juvenil',
    shortLabel: 'Juvenil',
    description: 'Acceso futuro al espacio juvenil.'
  },
  {
    value: TENANT_ROLES.viewer,
    label: 'Sólo consulta',
    shortLabel: 'Consulta',
    description: 'Rol reservado para vistas de lectura que todavía no están disponibles.'
  }
]);

export const PERMISSIONS = Object.freeze({
  dashboardView: 'dashboard.view',
  membersManage: 'members.manage',
  paymentsManage: 'payments.manage',
  expensesManage: 'expenses.manage',
  campsManage: 'camps.manage',
  accountsManage: 'accounts.manage',
  cashManage: 'cash.manage',
  feesManage: 'fees.manage',
  storeManage: 'store.manage',
  fundraisingManage: 'fundraising.manage',
  reportsView: 'reports.view',
  affiliationsManage: 'affiliations.manage',
  assistantUse: 'assistant.use',
  emergencyView: 'emergency.view',
  familyQueriesView: 'family-queries.view',
  usersManage: 'users.manage'
});

const ALL_TENANT_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const ROLE_PERMISSION_MAP = Object.freeze({
  [TENANT_ROLES.tenantAdmin]: ALL_TENANT_PERMISSIONS,
  [TENANT_ROLES.groupLeadership]: Object.freeze([
    PERMISSIONS.dashboardView,
    PERMISSIONS.membersManage,
    PERMISSIONS.campsManage,
    PERMISSIONS.reportsView,
    PERMISSIONS.emergencyView,
    PERMISSIONS.familyQueriesView,
    PERMISSIONS.usersManage
  ]),
  [TENANT_ROLES.administration]: Object.freeze([
    PERMISSIONS.dashboardView,
    PERMISSIONS.membersManage,
    PERMISSIONS.campsManage,
    PERMISSIONS.accountsManage,
    PERMISSIONS.feesManage,
    PERMISSIONS.reportsView,
    PERMISSIONS.affiliationsManage,
    PERMISSIONS.assistantUse,
    PERMISSIONS.emergencyView,
    PERMISSIONS.familyQueriesView,
    PERMISSIONS.usersManage
  ]),
  [TENANT_ROLES.treasury]: Object.freeze([
    PERMISSIONS.dashboardView,
    PERMISSIONS.paymentsManage,
    PERMISSIONS.expensesManage,
    PERMISSIONS.campsManage,
    PERMISSIONS.accountsManage,
    PERMISSIONS.cashManage,
    PERMISSIONS.feesManage,
    PERMISSIONS.storeManage,
    PERMISSIONS.fundraisingManage,
    PERMISSIONS.reportsView,
    PERMISSIONS.affiliationsManage,
    PERMISSIONS.assistantUse,
    PERMISSIONS.familyQueriesView
  ]),
  [TENANT_ROLES.branchLeader]: Object.freeze([]),
  [TENANT_ROLES.support]: Object.freeze([]),
  [TENANT_ROLES.institutional]: Object.freeze([]),
  [TENANT_ROLES.family]: Object.freeze([]),
  [TENANT_ROLES.youth]: Object.freeze([]),
  [TENANT_ROLES.viewer]: Object.freeze([])
});

const LEGACY_ROLE_MAP = Object.freeze({
  admin: TENANT_ROLES.tenantAdmin,
  member: TENANT_ROLES.viewer,
  user: TENANT_ROLES.viewer
});

export const ROUTE_PERMISSIONS = Object.freeze({
  '/app': PERMISSIONS.dashboardView,
  '/beneficiarios': PERMISSIONS.membersManage,
  '/pagos': PERMISSIONS.paymentsManage,
  '/gastos': PERMISSIONS.expensesManage,
  '/campamentos': PERMISSIONS.campsManage,
  '/cuenta-corriente': PERMISSIONS.accountsManage,
  '/caja': PERMISSIONS.cashManage,
  '/tienda': PERMISSIONS.storeManage,
  '/config-cuotas': PERMISSIONS.feesManage,
  '/actividades': PERMISSIONS.fundraisingManage,
  '/reporte-pagos': PERMISSIONS.reportsView,
  '/reporte-creditos': PERMISSIONS.reportsView,
  '/reporte-beneficiarios': PERMISSIONS.reportsView,
  '/afiliaciones': PERMISSIONS.affiliationsManage,
  '/agente-scout': PERMISSIONS.assistantUse,
  '/directorio-emergencias': PERMISSIONS.emergencyView,
  '/consultas-familias': PERMISSIONS.familyQueriesView,
  '/usuarios': PERMISSIONS.usersManage
});

const VALID_ROLES = new Set(Object.values(TENANT_ROLES));

export function normalizeTenantRoles(roles = [], legacyRole) {
  const normalized = Array.from(new Set(
    (Array.isArray(roles) ? roles : [])
      .map((role) => String(role || '').trim())
      .filter((role) => VALID_ROLES.has(role))
  ));

  if (normalized.length) return normalized;
  const fallback = LEGACY_ROLE_MAP[String(legacyRole || '').trim()];
  return fallback ? [fallback] : [];
}

export function permissionsForRoles(roles = [], isSuperAdmin = false) {
  if (isSuperAdmin) return [...ALL_TENANT_PERMISSIONS];
  const permissions = normalizeTenantRoles(roles)
    .flatMap((role) => ROLE_PERMISSION_MAP[role] || []);
  return Array.from(new Set(permissions));
}

export function hasPermission(user, permission) {
  if (!user || !permission) return false;
  if (user.is_super_admin) return true;
  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : permissionsForRoles(normalizeTenantRoles(user.tenant_roles, user.role), false);
  return permissions.includes(permission);
}

export function canAccessTenantWorkspace(user) {
  return Boolean(user?.tenant_id && hasPermission(user, PERMISSIONS.dashboardView));
}

export function permissionForPath(pathname) {
  if (!pathname) return undefined;
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  return ROUTE_PERMISSIONS[normalized];
}

export function canAccessPath(user, pathname) {
  const permission = permissionForPath(pathname);
  return permission ? hasPermission(user, permission) : false;
}

export function roleLabel(role) {
  return TENANT_ROLE_OPTIONS.find((option) => option.value === role)?.shortLabel || role;
}

export function roleLabels(roles = []) {
  const normalized = normalizeTenantRoles(roles);
  return normalized.length ? normalized.map(roleLabel).join(', ') : 'Sin rol operativo';
}

export function isValidTenantRole(role) {
  return VALID_ROLES.has(role);
}
