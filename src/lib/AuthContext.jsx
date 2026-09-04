import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = async (authUser) => {
    if (!authUser) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
    if (error) throw error;
    return { ...authUser, ...(data || {}) };
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try { if (mounted) setUser(await loadProfile(session?.user)); }
      catch (error) { if (mounted) setAuthError(error); }
      finally { if (mounted) setIsLoadingAuth(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try { if (mounted) setUser(await loadProfile(session?.user)); }
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
  const logout = async () => { await supabase.auth.signOut(); setUser(null); };
  const navigateToLogin = () => window.location.assign('/login');

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoadingAuth, isLoadingPublicSettings: false, authError, authChecked: !isLoadingAuth, login, logout, navigateToLogin, checkUserAuth: async () => {}, checkAppState: async () => {} }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
