import { supabase } from './supabaseClient';

// La sesión conserva el tenant activo para que el mismo usuario pueda operar
// en varios tenants sin mezclar información entre ellos.
const ACTIVE_TENANT_KEY = 'mibrujula_active_tenant';

export async function getActiveTenantId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const saved = window.localStorage.getItem(ACTIVE_TENANT_KEY);
  if (saved) return saved;
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.tenant_id) window.localStorage.setItem(ACTIVE_TENANT_KEY, data.tenant_id);
  return data?.tenant_id || null;
}

export function setActiveTenantId(tenantId) {
  if (tenantId) window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  else window.localStorage.removeItem(ACTIVE_TENANT_KEY);
}
