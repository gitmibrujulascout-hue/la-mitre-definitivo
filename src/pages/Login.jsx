import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import PublicHeader from '@/components/public/PublicHeader';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { user, login, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const registrationRequested = searchParams.get('accion') === 'registrar-grupo';

  if (isLoadingAuth) {
    return (
      <main className="brujula-public min-h-screen">
        <PublicHeader />
        <div className="brujula-auth-page grid min-h-[calc(100svh-3.5rem)] place-items-center px-5">
          <span className="brujula-auth-spinner" aria-label="Comprobando la sesión" />
        </div>
      </main>
    );
  }

  if (user) return <Navigate to="/app" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
      navigate('/app', { replace: true });
    } catch {
      setError('No pudimos iniciar sesión. Revisá el email y la contraseña e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="brujula-public min-h-screen">
      <PublicHeader />
      <section className="brujula-auth-page flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-5 py-12">
        <div className="brujula-auth-card w-full max-w-md p-5 sm:p-7">
          <h1 className="text-2xl font-extrabold">Ingresar a Brújula</h1>
          <p className="brujula-auth-copy mt-2 text-sm">Ingresá con tu cuenta del grupo scout.</p>

          {registrationRequested && (
            <div className="brujula-auth-notice mt-5 text-sm leading-5" role="status">
              El alta del grupo se completa con una cuenta autorizada. Ingresá y continuá desde la sección Super admin.
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <label className="block text-sm font-semibold" htmlFor="login-email">
              Email
              <input
                id="login-email"
                className="brujula-auth-input mt-2 w-full"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="block text-sm font-semibold" htmlFor="login-password">
              Contraseña
              <input
                id="login-password"
                className="brujula-auth-input mt-2 w-full"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error && <p className="brujula-auth-error text-sm" role="alert" aria-live="assertive">{error}</p>}

            <button className="brujula-primary-action min-h-12 w-full" type="submit" disabled={loading || !email || !password}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-4 text-sm font-semibold">
            <Link className="brujula-auth-link" to="/login?accion=registrar-grupo">Registrar grupo</Link>
            <Link className="brujula-auth-link" to="/">Volver al inicio</Link>
          </div>

          <div className="brujula-auth-family mt-6 border-t pt-5 text-center">
            <Link className="brujula-auth-link font-semibold" to="/estado-cuenta">
              Ingresar al portal para familias
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
