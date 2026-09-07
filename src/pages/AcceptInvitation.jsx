import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { trustActiveTenantId } from '@/api/tenantContext';
import PublicHeader from '@/components/public/PublicHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { getAuthenticatedHome } from '@/services/access/authDestination';
import { roleLabels } from '@/services/access/permissions';
import {
  acceptTenantInvitation,
  getTenantInvitation
} from '@/services/users/tenantAccessService';
import {
  fieldErrorsFor,
  invitationAccountSchema
} from '@/services/users/tenantAccessValidation';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { user, login, logout, refreshUser, isLoadingAuth } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [pageError, setPageError] = useState('');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [working, setWorking] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    let active = true;
    getTenantInvitation(token).then((result) => {
      if (!active) return;
      if (!result.ok) setPageError(result.message);
      else {
        setInvitation(result.invitation);
        setForm((current) => ({ ...current, email: result.invitation.email }));
      }
      setLoadingInvitation(false);
    });
    return () => { active = false; };
  }, [token]);

  const finishAcceptance = async (authenticatedUser) => {
    if (authenticatedUser?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setPageError('Ingresaste con un email diferente al de la invitación.');
      return;
    }
    const result = await acceptTenantInvitation(token);
    if (!result.ok) {
      setPageError(result.message);
      return;
    }
    trustActiveTenantId(authenticatedUser.id, result.tenantId);
    const refreshedUser = await refreshUser();
    navigate(getAuthenticatedHome(refreshedUser), { replace: true });
  };

  const acceptWithCurrentSession = async () => {
    setWorking(true);
    setPageError('');
    await finishAcceptance(user);
    setWorking(false);
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    const parsed = invitationAccountSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFor(parsed));
      return;
    }
    if (parsed.data.email !== invitation.email.toLowerCase()) {
      setFieldErrors({ email: 'Usá el mismo email que recibió la invitación.' });
      return;
    }

    setWorking(true);
    setPageError('');
    setFieldErrors({});
    try {
      if (mode === 'login') {
        const authenticatedUser = await login(parsed.data.email, parsed.data.password);
        await finishAcceptance(authenticatedUser);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: { full_name: invitation.fullName },
            emailRedirectTo: window.location.href
          }
        });
        if (error) throw error;
        if (data.session && data.user) await finishAcceptance(data.user);
        else setConfirmationSent(true);
      }
    } catch {
      setPageError(mode === 'login'
        ? 'No pudimos iniciar sesión. Revisá la contraseña e intentá nuevamente.'
        : 'No pudimos crear la cuenta. Quizás ya existe; probá con “Ya tengo cuenta”.');
    } finally {
      setWorking(false);
    }
  };

  const useAnotherAccount = async () => {
    setWorking(true);
    await logout();
    setPageError('');
    setWorking(false);
  };

  return (
    <main className="brujula-public min-h-screen">
      <PublicHeader />
      <section className="brujula-auth-page flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-5 py-12">
        <div className="brujula-auth-card w-full max-w-lg p-5 sm:p-7">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">Aceptar invitación</h1>

          {(loadingInvitation || isLoadingAuth) && (
            <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="brujula-auth-spinner" aria-hidden="true" />
              Verificando el enlace…
            </div>
          )}

          {!loadingInvitation && invitation && (
            <div className="brujula-auth-notice mt-5 text-sm leading-6">
              <p><strong>{invitation.fullName}</strong>, te invitaron a <strong>{invitation.tenantName}</strong>.</p>
              <p className="mt-1">Roles: {roleLabels(invitation.roles)}</p>
            </div>
          )}

          {pageError && <p className="brujula-auth-error mt-5 text-sm" role="alert">{pageError}</p>}

          {!loadingInvitation && invitation?.status !== 'pending' && (
            <div className="mt-6">
              <p className="font-semibold">Este enlace ya no está disponible.</p>
              <p className="mt-1 text-sm text-muted-foreground">Pedile una nueva invitación al administrador del grupo.</p>
            </div>
          )}

          {!loadingInvitation && invitation?.status === 'pending' && user && (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border p-4">
                <p className="flex items-center gap-2 font-semibold"><Mail aria-hidden="true" />{user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">Sesión actualmente iniciada</p>
              </div>
              {user.email?.toLowerCase() === invitation.email.toLowerCase() ? (
                <Button className="min-h-12 w-full" onClick={acceptWithCurrentSession} disabled={working}>
                  <CheckCircle2 aria-hidden="true" />
                  {working ? 'Aceptando…' : 'Aceptar y entrar'}
                </Button>
              ) : (
                <Button className="min-h-12 w-full" variant="outline" onClick={useAnotherAccount} disabled={working}>
                  <LogOut aria-hidden="true" /> Usar la cuenta invitada
                </Button>
              )}
            </div>
          )}

          {!loadingInvitation && invitation?.status === 'pending' && !user && !confirmationSent && (
            <>
              <div className="mt-6 grid grid-cols-2 rounded-lg bg-muted p-1" aria-label="Tipo de acceso">
                <ModeButton active={mode === 'login'} onClick={() => setMode('login')}>Ya tengo cuenta</ModeButton>
                <ModeButton active={mode === 'signup'} onClick={() => setMode('signup')}>Crear cuenta</ModeButton>
              </div>
              <form className="mt-5 space-y-4" onSubmit={submitAccount} noValidate>
                <AccountField
                  id="invitation-email"
                  label="Email invitado"
                  type="email"
                  value={form.email}
                  error={fieldErrors.email}
                  onChange={(email) => setForm((current) => ({ ...current, email }))}
                />
                <AccountField
                  id="invitation-password"
                  label="Contraseña"
                  type="password"
                  value={form.password}
                  error={fieldErrors.password}
                  onChange={(password) => setForm((current) => ({ ...current, password }))}
                />
                <Button className="min-h-12 w-full" type="submit" disabled={working}>
                  <KeyRound aria-hidden="true" />
                  {working ? 'Procesando…' : mode === 'login' ? 'Ingresar y aceptar' : 'Crear cuenta y aceptar'}
                </Button>
              </form>
            </>
          )}

          {confirmationSent && (
            <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 p-4" role="status">
              <p className="font-semibold">Revisá tu email</p>
              <p className="mt-1 text-sm text-muted-foreground">Confirmá la cuenta y volvé a abrir este enlace para completar el acceso.</p>
            </div>
          )}

          <Link className="brujula-auth-link mt-6 inline-block text-sm font-semibold" to="/">Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={active ? 'min-h-11 rounded-md bg-card px-3 text-sm font-semibold shadow-sm' : 'min-h-11 rounded-md px-3 text-sm font-semibold text-muted-foreground'}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function AccountField({ id, label, type, value, error, onChange }) {
  return (
    <label className="block text-sm font-semibold" htmlFor={id}>
      {label}
      <Input
        id={id}
        className="mt-2 min-h-11"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={type === 'password' ? 'current-password' : 'email'}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="mt-1 block text-sm text-destructive">{error}</span>}
    </label>
  );
}

