import { useState } from 'react';
import {
  Building2,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { setActiveTenantId } from '@/api/tenantContext';
import { cn } from '@/lib/utils';
import WorkspaceWatermark from '@/components/shared/WorkspaceWatermark';

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const openOwnTenant = () => {
    setActiveTenantId(user?.tenant_id || null);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/', { replace: true });
    } catch {
      setLogoutError('No pudimos cerrar la sesión. Intentá nuevamente.');
      setLoggingOut(false);
    }
  };

  const navigationClass = ({ isActive }) => cn(
    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
    isActive
      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
  );

  return (
    <div className="min-h-screen bg-background">
      <button
        type="button"
        onClick={() => setMobileOpen((current) => !current)}
        className="fixed left-4 top-4 z-50 grid min-h-11 min-w-11 place-items-center rounded-lg border border-border bg-card shadow-md lg:hidden"
        aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300',
        'lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="border-b border-sidebar-border p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-sidebar-primary-foreground">Brújula</p>
              <p className="text-xs text-sidebar-foreground/60">Superadministración</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegación superadmin">
          <NavLink className={navigationClass} to="/super-admin" onClick={() => setMobileOpen(false)}>
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Tenants
          </NavLink>

          {user?.tenant_id && (
            <Link
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              to="/app"
              onClick={openOwnTenant}
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Panel de {user.tenant?.name || 'mi tenant'}
            </Link>
          )}

          <Link
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            to="/"
            onClick={() => setMobileOpen(false)}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Ver sitio público
          </Link>
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <p className="truncate px-2 text-xs text-sidebar-foreground/60" title={user?.email || ''}>
            {user?.email}
          </p>
          {logoutError && (
            <p className="mt-2 px-2 text-xs text-destructive" role="alert">{logoutError}</p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <main className="brujula-workspace relative min-h-screen lg:ml-64">
        <WorkspaceWatermark />
        <div className="relative z-10 mx-auto max-w-7xl p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
