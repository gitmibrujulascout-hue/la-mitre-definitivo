import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = async (authUser) => {
    if (!authUser) return null;
    const [profileResult, membershipResult, superAdminResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
      supabase
        .from('tenant_memberships')
        .select('tenant_id, role, tenants(id, name, slug)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.rpc('is_super_admin')
    ]);

    if (membershipResult.error) throw new Error('No pudimos cargar tu organización. Volvé a intentarlo.');

    const profile = profileResult.error ? null : profileResult.data;
    const membership = membershipResult.data;
    const isSuperAdmin = superAdminResult.error ? false : Boolean(superAdminResult.data);
    if (membership?.tenant_id) window.localStorage.setItem('mibrujula_active_tenant', membership.tenant_id);
    return {
      ...authUser,
      ...(profile || {}),
      role: profile?.role || membership?.role || 'user',
      is_super_admin: Boolean(profile?.is_super_admin || isSuperAdmin),
      tenant_id: membership?.tenant_id || null,
      tenant_role: membership?.role || null,
      tenant: membership?.tenants || null
    };
  };

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
  }, []);

  const login = async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const logout = async () => { await supabase.auth.signOut(); setUser(null); setAuthError(null); };
  const navigateToLogin = () => window.location.assign('/login');

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoadingAuth, isLoadingPublicSettings: false, authError, authChecked: !isLoadingAuth, login, logout, navigateToLogin, checkUserAuth: async () => {}, checkAppState: async () => {} }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
