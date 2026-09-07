import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
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
  const [user, setUser] = useState(null);
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
    const memberships = (membershipsResult.data || []).filter((membership) => membership.status !== 'suspended');
    const rolesResult = memberships.length
      ? await supabase
        .from('tenant_membership_roles')
        .select('tenant_id, role')
        .eq('user_id', authUser.id)
      : { data: [], error: null };
    const rolesByTenant = new Map();

    if (!rolesResult.error) {
      for (const row of rolesResult.data || []) {
        const current = rolesByTenant.get(row.tenant_id) || [];
        current.push(row.role);
        rolesByTenant.set(row.tenant_id, current);
      }
    }

    const accessMemberships = memberships.map((membership) => ({
      ...membership,
      roles: normalizeTenantRoles(rolesByTenant.get(membership.tenant_id), membership.role)
    }));
    const storedTenantId = getStoredActiveTenantId();
    const membership = accessMemberships.find((item) => item.tenant_id === storedTenantId)
      || accessMemberships[0]
      || null;
    const tenantRoles = membership?.roles || [];

    if (membership?.tenant_id) trustActiveTenantId(authUser.id, membership.tenant_id);
    else if (!isSuperAdmin) clearTenantContext();

    return {
      ...authUser,
      ...(profile || {}),
      role: profile?.role || membership?.role || 'user',
      is_super_admin: Boolean(profile?.is_super_admin || isSuperAdmin),
      tenant_id: membership?.tenant_id || null,
      tenant_role: tenantRoles[0] || null,
      tenant_roles: tenantRoles,
      permissions: permissionsForRoles(tenantRoles, isSuperAdmin),
      memberships: accessMemberships,
      tenant: membership?.tenants || null
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try { if (mounted) { setUser(await loadProfile(session?.user)); setAuthError(null); } }
      catch (error) { if (mounted) setAuthError(error); }
      finally { if (mounted) setIsLoadingAuth(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try { if (mounted) { setUser(await loadProfile(session?.user)); setAuthError(null); } }
      catch (error) { if (mounted) setAuthError(error); }
      finally { if (mounted) setIsLoadingAuth(false); }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadProfile]);

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
