import { supabase } from './supabaseClient';

// La sesión conserva el tenant activo para que el mismo usuario pueda operar
// en varios tenants sin mezclar información entre ellos.
const ACTIVE_TENANT_KEY = 'mibrujula_active_tenant';
let validatedContext = null;
let validationPromise = null;

export function getStoredActiveTenantId() {
  return window.localStorage.getItem(ACTIVE_TENANT_KEY);
}

export async function getActiveTenantId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const saved = getStoredActiveTenantId();

  if (validatedContext?.userId === user.id && validatedContext?.tenantId === saved) {
    return saved;
  }

  if (validationPromise) return validationPromise;
  validationPromise = resolveAuthorizedTenant(user.id, saved).finally(() => {
    validationPromise = null;
  });
  return validationPromise;
}

export function setActiveTenantId(tenantId) {
  if (tenantId) window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  else window.localStorage.removeItem(ACTIVE_TENANT_KEY);
  validatedContext = null;
}

export function trustActiveTenantId(userId, tenantId) {
  setActiveTenantId(tenantId);
  if (userId && tenantId) validatedContext = { userId, tenantId };
}

export function clearTenantContext() {
  setActiveTenantId(null);
  validationPromise = null;
}

async function resolveAuthorizedTenant(userId, requestedTenantId) {
  if (requestedTenantId && await canAccessRequestedTenant(requestedTenantId, userId)) {
    validatedContext = { userId, tenantId: requestedTenantId };
    return requestedTenantId;
  }

  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('No pudimos validar tu organización.');

  const fallbackTenantId = data?.tenant_id || null;
  if (fallbackTenantId) {
    window.localStorage.setItem(ACTIVE_TENANT_KEY, fallbackTenantId);
    validatedContext = { userId, tenantId: fallbackTenantId };
  } else {
    window.localStorage.removeItem(ACTIVE_TENANT_KEY);
    validatedContext = null;
  }
  return fallbackTenantId;
}

async function canAccessRequestedTenant(tenantId, userId) {
  const { data, error } = await supabase.rpc('can_access_tenant', {
    row_tenant_id: tenantId
  });
  if (!error) return Boolean(data);

  // Compatibilidad temporal hasta aplicar la migración SEC-001.
  const { data: membership, error: membershipError } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  return !membershipError && Boolean(membership?.tenant_id);
}
