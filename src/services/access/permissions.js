export const TENANT_ROLES = Object.freeze({
  tenantAdmin: 'tenant_admin',
  groupLeadership: 'group_leadership',
  administration: 'administration',
  treasury: 'treasury',
  branchLeader: 'branch_leader',
  branchDeputy: 'branch_deputy',
  branchAssistant: 'branch_assistant',
  volunteer: 'volunteer',
  associationPresident: 'association_president',
  associationLegal: 'association_legal',
  associationSecretary: 'association_secretary',
  associationBoard: 'association_board',
  parentRepresentative: 'parent_representative',
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
    description: 'Gestiona miembros y afiliaciones. No asigna accesos.'
  },
  {
    value: TENANT_ROLES.treasury,
    label: 'Tesorería',
    shortLabel: 'Tesorería',
    description: 'Gestiona pagos, gastos, caja, cuotas, tienda y reportes financieros.'
  },
  {
    value: TENANT_ROLES.branchLeader,
    label: 'Jefe de rama',
    shortLabel: 'Rama',
    description: 'Responsable único de una rama: equipo, personas, fichas médicas, actividades y caja de su rama.'
  },
  {
    value: TENANT_ROLES.support,
    label: 'Equipo de apoyo',
    shortLabel: 'Apoyo',
    description: 'Consulta contactos, alergias, medicación y alertas de emergencia; sin ficha médica completa.'
  },
  {
    value: TENANT_ROLES.institutional,
    label: 'Relaciones institucionales',
    shortLabel: 'Institucional',
    description: 'Consulta contactos y resumen de emergencia, sin ficha médica completa.'
  },
  {
    value: TENANT_ROLES.family,
    label: 'Familia',
    shortLabel: 'Familia',
    description: 'Consulta sus hijos vinculados y confirma la ficha digitalizada. Vota cuando es habilitado.'
  },
  {
    value: TENANT_ROLES.youth,
    label: 'Miembro juvenil',
    shortLabel: 'Juvenil',
    description: 'Caminantes y Rover: cuenta individual, caja de su rama, calendario y votaciones habilitadas.'
  },
  {
    value: TENANT_ROLES.viewer,
    label: 'Sólo consulta',
    shortLabel: 'Consulta',
    description: 'Rol reservado para vistas de lectura que todavía no están disponibles.'
  }
  , ...[
    ['branch_deputy','Subjefe de rama','Educador. Personas y actividades de su rama; otras acciones por delegación del jefe.'],
    ['branch_assistant','Ayudante de rama','Educador. Personas y actividades de su rama; otras acciones por delegación del jefe.'],
    ['volunteer','Voluntario','Contactos y resumen de emergencia del grupo.'],
    ['association_president','Presidente de la asociación','Consulta cajas y resumen de emergencia. Cargo con mandato.'],
    ['association_legal','Representante legal','Consulta cajas y resumen de emergencia. Cargo con mandato.'],
    ['association_secretary','Secretario de la asociación','Consulta cajas y resumen de emergencia. Cargo con mandato.'],
    ['association_board','Vocal de la asociación','Consulta cajas y resumen de emergencia. Cargo con mandato.'],
    ['parent_representative','Representante de padres','Participa en asambleas cuando se lo habilita. No administra personas.']
  ].map(([value,label,description])=>({value,label,shortLabel:label,description}))
]);

export const PERMISSIONS = Object.freeze({
  groupWorkspace: 'group.workspace',
  healthDigitize: 'health.digitize',
  branchView: 'branch.view',
  financialReportsView: 'financial-reports.view',
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
    PERMISSIONS.groupWorkspace,
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
    PERMISSIONS.feesManage,
    PERMISSIONS.reportsView,
    PERMISSIONS.affiliationsManage,
    PERMISSIONS.assistantUse,
    PERMISSIONS.emergencyView,
    PERMISSIONS.familyQueriesView
  ]),
  [TENANT_ROLES.treasury]: Object.freeze([
    PERMISSIONS.groupWorkspace,
    PERMISSIONS.emergencyView,
    PERMISSIONS.financialReportsView,
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
  [TENANT_ROLES.branchLeader]: Object.freeze([PERMISSIONS.dashboardView, PERMISSIONS.groupWorkspace, PERMISSIONS.branchView, PERMISSIONS.emergencyView, PERMISSIONS.healthDigitize]),
  [TENANT_ROLES.branchDeputy]: Object.freeze([PERMISSIONS.dashboardView, PERMISSIONS.groupWorkspace, PERMISSIONS.branchView, PERMISSIONS.emergencyView]),
  [TENANT_ROLES.branchAssistant]: Object.freeze([PERMISSIONS.dashboardView, PERMISSIONS.groupWorkspace, PERMISSIONS.branchView, PERMISSIONS.emergencyView]),
  [TENANT_ROLES.volunteer]: Object.freeze([PERMISSIONS.dashboardView, PERMISSIONS.emergencyView, PERMISSIONS.groupWorkspace]),
  ...Object.fromEntries(['association_president','association_legal','association_secretary','association_board'].map(role=>[role,Object.freeze([PERMISSIONS.dashboardView,PERMISSIONS.groupWorkspace,PERMISSIONS.emergencyView])])),
  [TENANT_ROLES.parentRepresentative]: Object.freeze([PERMISSIONS.dashboardView,PERMISSIONS.groupWorkspace]),
  [TENANT_ROLES.support]: Object.freeze([PERMISSIONS.dashboardView, PERMISSIONS.groupWorkspace, PERMISSIONS.emergencyView]),
  [TENANT_ROLES.institutional]: Object.freeze([PERMISSIONS.dashboardView, PERMISSIONS.groupWorkspace, PERMISSIONS.emergencyView]),
  [TENANT_ROLES.family]: Object.freeze([PERMISSIONS.dashboardView,PERMISSIONS.groupWorkspace]),
  [TENANT_ROLES.youth]: Object.freeze([PERMISSIONS.dashboardView,PERMISSIONS.groupWorkspace]),
  [TENANT_ROLES.viewer]: Object.freeze([])
});

const LEGACY_ROLE_MAP = Object.freeze({
  admin: TENANT_ROLES.tenantAdmin,
  member: TENANT_ROLES.viewer,
  user: TENANT_ROLES.viewer
});

export const ROUTE_PERMISSIONS = Object.freeze({
  '/mi-grupo': PERMISSIONS.groupWorkspace,
  '/mi-rama': PERMISSIONS.branchView,
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
  '/reporte-pagos': PERMISSIONS.financialReportsView,
  '/reporte-creditos': PERMISSIONS.financialReportsView,
  '/reporte-beneficiarios': PERMISSIONS.reportsView,
  '/afiliaciones': PERMISSIONS.affiliationsManage,
  '/agente-scout': PERMISSIONS.assistantUse,
  '/directorio-emergencias': PERMISSIONS.emergencyView,
  '/ficha-emergencia': PERMISSIONS.emergencyView,
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
  const permissions = permissionsForRoles(normalizeTenantRoles(user.tenant_roles), false);
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
