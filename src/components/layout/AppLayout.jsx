import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '@/lib/AuthContext';
import WorkspaceWatermark from '@/components/shared/WorkspaceWatermark';

export default function AppLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="brujula-workspace relative min-h-screen lg:ml-64">
        <WorkspaceWatermark />
        <div className="relative z-10 mx-auto max-w-7xl p-4 pt-16 lg:p-8 lg:pt-8">
          {!user?.tenant_id && <div className="mb-4 rounded-lg border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-forest-deep">Tu usuario todavía no tiene una organización asignada. Un superadministrador debe asignarte un tenant antes de cargar datos.</div>}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
