import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CreditCard, Receipt, Tent, 
  BookOpen, Menu, X, TreePine, Landmark, TrendingUp, ExternalLink, FileText, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/beneficiarios', label: 'Beneficiarios', icon: Users },
  { path: '/pagos', label: 'Pagos', icon: CreditCard },
  { path: '/gastos', label: 'Gastos', icon: Receipt },
  { path: '/campamentos', label: 'Campamentos', icon: Tent },
  { path: '/cuenta-corriente', label: 'Cta. Corriente', icon: BookOpen },
  { path: '/caja', label: 'Caja y Banco', icon: Landmark },
  { path: '/actividades', label: 'Act. Económicas', icon: TrendingUp },
  { path: '/reporte-pagos', label: 'Reporte de Pagos', icon: FileText },
  { path: '/afiliaciones', label: 'Afiliaciones', icon: ShieldCheck },
];

export default function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
                Scout Bartolomé Mitre
              </h1>
              <p className="text-xs text-sidebar-foreground/60">Tesorería</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
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
                <item.icon className="w-4 h-4" />
                {item.label}
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
            Villa Carlos Paz · Córdoba
          </p>
        </div>
      </aside>
    </>
  );
}