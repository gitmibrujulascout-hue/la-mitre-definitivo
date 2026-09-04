import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '@/lib/AuthContext';

export default function AppLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-7xl mx-auto">
          {!user?.tenant_id && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Tu usuario todavía no tiene una organización asignada. Un superadministrador debe asignarte un tenant antes de cargar datos.</div>}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
