import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SuperAdmin() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '' });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tenants').select('id,name,slug,active,created_at').order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setTenants(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const activeCount = useMemo(() => tenants.filter(t => t.active).length, [tenants]);
  const createTenant = async (event) => {
    event.preventDefault();
    const slug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!form.name.trim() || !slug) return toast.error('Completá nombre y slug.');
    const { error } = await supabase.from('tenants').insert({ name: form.name.trim(), slug });
    if (error) return toast.error(error.message);
    toast.success('Tenant creado correctamente.'); setForm({ name: '', slug: '' }); load();
  };

  if (!user?.is_super_admin) return <Card><CardContent className="p-6">No tenés permisos de superadministrador.</CardContent></Card>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">PLATAFORMA BRÚJULA</p><h1 className="text-3xl font-bold">Gestión de tenants</h1><p className="text-muted-foreground">Administrá los espacios de cada grupo scout.</p></div><Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" />Actualizar</Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><Building2 className="mb-2 h-5 w-5" /><p className="text-2xl font-bold">{tenants.length}</p><p className="text-sm text-muted-foreground">Tenants totales</p></CardContent></Card><Card><CardContent className="p-5"><ShieldCheck className="mb-2 h-5 w-5" /><p className="text-2xl font-bold">{activeCount}</p><p className="text-sm text-muted-foreground">Tenants activos</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-2xl font-bold">{user.email}</p><p className="text-sm text-muted-foreground">Sesión superadmin</p></CardContent></Card></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><Card><CardHeader><CardTitle>Tenants registrados</CardTitle></CardHeader><CardContent>{loading ? <p>Cargando…</p> : tenants.length === 0 ? <p className="text-muted-foreground">Todavía no hay tenants.</p> : <div className="space-y-3">{tenants.map(t => <div key={t.id} className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-semibold">{t.name}</p><p className="text-sm text-muted-foreground">{t.slug}</p></div><span className={`rounded-full px-2 py-1 text-xs ${t.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{t.active ? 'Activo' : 'Inactivo'}</span></div>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle>Crear tenant</CardTitle></CardHeader><CardContent><form onSubmit={createTenant} className="space-y-3"><Input placeholder="Nombre del grupo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><Input placeholder="slug-del-grupo" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /><Button className="w-full" type="submit"><Plus className="h-4 w-4" />Crear tenant</Button></form></CardContent></Card></div>
  </div>;
}
