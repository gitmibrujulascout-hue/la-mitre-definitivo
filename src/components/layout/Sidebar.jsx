import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CreditCard, Receipt, Tent, 
  BookOpen, Menu, X, TreePine, Landmark, TrendingUp, ExternalLink, FileText, ShieldCheck, MessageCircle, HeartPulse, ShoppingBag, Calendar, Eye, Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAvisosPendientes } from '@/hooks/useAvisosPendientes';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission, PERMISSIONS, roleLabels } from '@/services/access/permissions';

const navItems = [
  { path: '/app', label: 'Dashboard', icon: LayoutDashboard, permission: PERMISSIONS.dashboardView },
  { path: '/beneficiarios', label: 'Beneficiarios', icon: Users, permission: PERMISSIONS.membersManage },
  { path: '/pagos', label: 'Pagos', icon: CreditCard, permission: PERMISSIONS.paymentsManage },
  { path: '/gastos', label: 'Gastos', icon: Receipt, permission: PERMISSIONS.expensesManage },
  { path: '/campamentos', label: 'Campamentos', icon: Tent, permission: PERMISSIONS.campsManage },
  { path: '/cuenta-corriente', label: 'Cta. Corriente', icon: BookOpen, permission: PERMISSIONS.accountsManage },
  { path: '/caja', label: 'Caja y Banco', icon: Landmark, permission: PERMISSIONS.cashManage },
  { path: '/config-cuotas', label: 'Config. Cuotas', icon: Calendar, permission: PERMISSIONS.feesManage },
  { path: '/tienda', label: 'Tienda', icon: ShoppingBag, permission: PERMISSIONS.storeManage },
  { path: '/actividades', label: 'Act. Económicas', icon: TrendingUp, permission: PERMISSIONS.fundraisingManage },
  { path: '/reporte-pagos', label: 'Reporte de Pagos', icon: FileText, permission: PERMISSIONS.reportsView },
  { path: '/reporte-creditos', label: 'Créditos usados', icon: Coins, permission: PERMISSIONS.reportsView },
  { path: '/reporte-beneficiarios', label: 'Reporte Miembros', icon: Users, permission: PERMISSIONS.reportsView },
  { path: '/afiliaciones', label: 'Afiliaciones', icon: ShieldCheck, permission: PERMISSIONS.affiliationsManage },
  { path: '/agente-scout', label: 'Agente WhatsApp', icon: MessageCircle, permission: PERMISSIONS.assistantUse },
  { path: '/directorio-emergencias', label: 'Directorio Emergencias', icon: HeartPulse, permission: PERMISSIONS.emergencyView },
  { path: '/consultas-familias', label: 'Consultas Familias', icon: Eye, permission: PERMISSIONS.familyQueriesView },
  { path: '/usuarios', label: 'Usuarios y permisos', icon: ShieldCheck, permission: PERMISSIONS.usersManage },
];

export default function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { encargosPendientes, solicitudesSaludPendientes } = useAvisosPendientes();
  const { user } = useAuth();
  const allowedNavItems = navItems.filter((item) => hasPermission(user, item.permission));
  const visibleNavItems = user?.is_super_admin ? [...allowedNavItems, { path: '/super-admin', label: 'Super admin', icon: ShieldCheck }] : allowedNavItems;
  const avisosPorPath = {
    '/tienda': encargosPendientes,
    '/beneficiarios': solicitudesSaludPendientes,
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card shadow-md border border-border"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 bg-sidebar text-sidebar-foreground z-40 flex flex-col transition-transform duration-300",
        "lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <TreePine className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-sidebar-primary-foreground leading-tight">
                {user?.tenant?.name || 'Brújula Scout'}
              </h1>
              <p className="line-clamp-1 text-xs text-sidebar-foreground/60">{roleLabels(user?.tenant_roles)}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map(item => {
            const isActive = location.pathname === item.path;
            const avisos = avisosPorPath[item.path] || 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {avisos > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold",
                    isActive
                      ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
                      : "bg-ember text-white"
                  )}>
                    {avisos}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Estado de cuenta público */}
        <div className="px-3 pb-2 border-t border-sidebar-border pt-3">
          <p className="text-xs text-sidebar-foreground/30 px-2 mb-1 uppercase tracking-wider">Familias</p>
          <Link
            to="/estado-cuenta"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ExternalLink className="w-4 h-4" />
            Estado de Cuenta
          </Link>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40 text-center">
            {user?.email || 'Sesión del tenant'}
          </p>
        </div>
      </aside>
    </>
  );
}
