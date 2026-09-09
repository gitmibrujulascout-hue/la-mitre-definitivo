import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { queryClientInstance } from '@/lib/query-client';
import {
  clearTenantContext,
  getStoredActiveTenantId,
  trustActiveTenantId
} from '@/api/tenantContext';
import {
  normalizeTenantRoles,
  permissionsForRoles
} from '@/services/access/permissions';

const AuthContext = createContext(null);

async function loadTenantMemberships(userId) {
  const extended = await supabase
    .from('tenant_memberships')
    .select('tenant_id, role, status, tenants(id, name, slug, active)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!extended.error) return extended;

  // Permite publicar el frontend antes de ejecutar SEC-001 sin bloquear el login.
  return supabase
    .from('tenant_memberships')
    .select('tenant_id, role, tenants(id, name, slug, active)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
}

export const AuthProvider = ({ children }) => {
  const [user, updateUser] = useState(null);
  const accessSignature = useRef('');
  const setUser = useCallback(next => {
    const signature = JSON.stringify([next?.id,next?.tenant_id,next?.tenant_roles,next?.branch_scopes,next?.is_super_admin]);
    if (signature !== accessSignature.current) queryClientInstance.clear();
    accessSignature.current = signature;
    updateUser(next);
  }, []);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) return null;
    const [profileResult, membershipsResult, superAdminResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
      loadTenantMemberships(authUser.id),
      supabase.rpc('is_super_admin')
    ]);

    if (membershipsResult.error) throw new Error('No pudimos cargar tu organización. Volvé a intentarlo.');

    const profile = profileResult.error ? null : profileResult.data;
    const isSuperAdmin = superAdminResult.error ? false : Boolean(superAdminResult.data);
    const memberships = (membershipsResult.data || []).filter((membership) => membership.status === 'active' && membership.tenants?.active === true);
    const rolesResult = memberships.length
      ? await supabase
        .from('tenant_membership_roles')
        .select('tenant_id, role')
        .eq('user_id', authUser.id)
      : { data: [], error: null };
    const rolesByTenant = new Map();
    if (rolesResult.error) throw new Error('No pudimos verificar tus permisos. Volvé a intentar.');

    if (!rolesResult.error) {
      for (const row of rolesResult.data || []) {
        const current = rolesByTenant.get(row.tenant_id) || [];
        current.push(row.role);
        rolesByTenant.set(row.tenant_id, current);
      }
    }

    const accessMemberships = memberships.map((membership) => ({
      ...membership,
      roles: normalizeTenantRoles(rolesByTenant.get(membership.tenant_id))
    }));
    const storedTenantId = getStoredActiveTenantId();
    const membership = accessMemberships.find((item) => item.tenant_id === storedTenantId)
      || accessMemberships[0]
      || null;
    const tenantRoles = membership?.roles || [];
    const scopesResult = membership?.tenant_id
      ? await supabase.from('tenant_branch_scopes').select('branch').eq('tenant_id', membership.tenant_id).eq('user_id', authUser.id)
      : { data: [], error: null };
    if (scopesResult.error) throw new Error('No pudimos verificar tus ramas asignadas. Volvé a intentar.');
    const branchScopes = (scopesResult.data || []).map(row => row.branch).sort();

    if (membership?.tenant_id) trustActiveTenantId(authUser.id, membership.tenant_id);
    else if (!isSuperAdmin) clearTenantContext();

    return {
      ...authUser,
      ...(profile || {}),
      role: profile?.role || membership?.role || 'user',
      is_super_admin: isSuperAdmin,
      tenant_id: membership?.tenant_id || null,
      tenant_role: tenantRoles[0] || null,
      tenant_roles: tenantRoles,
      branch_scopes: branchScopes,
      permissions: permissionsForRoles(tenantRoles, isSuperAdmin),
      memberships: accessMemberships,
      tenant: membership?.tenants || null
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try { if (mounted) { setUser(await loadProfile(session?.user)); setAuthError(null); } }
      catch (error) { if (mounted) { setUser(null); queryClientInstance.clear(); setAuthError(error); } }
      finally { if (mounted) setIsLoadingAuth(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try { if (mounted) { setUser(await loadProfile(session?.user)); setAuthError(null); } }
      catch (error) { if (mounted) { setUser(null); queryClientInstance.clear(); setAuthError(error); } }
      finally { if (mounted) setIsLoadingAuth(false); }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadProfile]);

  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try {
        const { data: { user: current } } = await supabase.auth.getUser();
        const next = await loadProfile(current);
        if(!live) return;
        setUser(next);
      } catch { if(live) { setUser(null);queryClientInstance.clear();setAuthError(new Error('No pudimos verificar tus permisos. Volvé a ingresar.')); } }
    };
    window.addEventListener('focus',refresh);
    const timer = window.setInterval(refresh,60000);
    return () => { live=false;window.removeEventListener('focus',refresh);window.clearInterval(timer); };
  },[loadProfile]);

  const login = async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const authenticatedUser = await loadProfile(data.user);
    setUser(authenticatedUser);
    return authenticatedUser;
  };
  const loginWithGoogle = async (redirectTo = `${window.location.origin}/familias`) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) throw error;
  };
  const refreshUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const refreshedUser = await loadProfile(authUser);
    setUser(refreshedUser);
    return refreshedUser;
  }, [loadProfile]);
  const logout = async () => {
    queryClientInstance.clear();
    await supabase.auth.signOut();
    clearTenantContext();
    setUser(null);
    setAuthError(null);
  };
  const navigateToLogin = () => window.location.assign('/login');

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoadingAuth, isLoadingPublicSettings: false, authError, authChecked: !isLoadingAuth, login, loginWithGoogle, logout, refreshUser, navigateToLogin, checkUserAuth: async () => {}, checkAppState: async () => {} }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
