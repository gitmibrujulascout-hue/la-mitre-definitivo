import { Clock3, LogOut, ShieldAlert } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import PublicHeader from '@/components/public/PublicHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { roleLabels } from '@/services/access/permissions';

export default function NoAccess() {
  const { user, logout, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (isLoadingAuth) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <main className="brujula-public min-h-screen">
      <PublicHeader />
      <section className="brujula-auth-page grid min-h-[calc(100svh-3.5rem)] place-items-center px-5 py-12">
        <div className="brujula-auth-card w-full max-w-lg p-6 text-center sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <ShieldAlert aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">Tu acceso todavía no tiene una pantalla habilitada</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Estás registrado en {user?.tenant?.name || 'el grupo'} como {roleLabels(user?.tenant_roles)}.
            El administrador puede ajustar tus roles desde Usuarios y permisos.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
            <Clock3 aria-hidden="true" />
            Los portales de familia, rama y juvenil se habilitarán en próximas etapas.
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={handleLogout} className="min-h-11">
              <LogOut aria-hidden="true" /> Cerrar sesión
            </Button>
            <Button asChild className="min-h-11"><Link to="/">Volver al inicio</Link></Button>
          </div>
        </div>
      </section>
    </main>
  );
}
