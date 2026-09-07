import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import PublicHeader from '@/components/public/PublicHeader';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function FamilyPortal() {
  const { user, isLoadingAuth, loginWithGoogle, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [tenant, setTenant] = useState(null);
  const [dni, setDni] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [children, setChildren] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const slug = searchParams.get('tenant') || 'la-mitre';
    supabase.from('tenants').select('id, name, slug').eq('slug', slug).maybeSingle()
      .then(({ data }) => setTenant(data || null));
  }, [searchParams]);

  useEffect(() => {
    if (!user || !tenant) return;
    supabase.rpc('get_family_children', { target_tenant_id: tenant.id })
      .then(({ data }) => setChildren(data || []));
  }, [user, tenant]);

  if (isLoadingAuth) return <main className="brujula-public min-h-screen"><PublicHeader /><div className="p-8 text-center">Comprobando la sesión…</div></main>;
  if (!user) {
    return <main className="brujula-public min-h-screen"><PublicHeader /><section className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-2xl font-extrabold">Portal para familias</h1>
      <p className="mt-3 text-sm text-slate-600">Ingresá con Google para vincular a tus hijos con el grupo scout.</p>
      <button className="brujula-primary-action mt-6 min-h-12 w-full" onClick={() => loginWithGoogle(window.location.href)}>Continuar con Google</button>
      <Link className="brujula-auth-link mt-5 inline-block" to="/">Volver al inicio</Link>
    </section></main>;
  }

  const submit = async (event) => {
    event.preventDefault();
    if (!tenant) return;
    setLoading(true); setStatus('');
    const { data, error } = await supabase.rpc('request_family_link', {
      target_tenant_id: tenant.id,
      child_dni: dni.replace(/\D/g, ''),
      child_full_name: fullName,
      child_birth_date: birthDate
    });
    if (error) setStatus('No pudimos procesar los datos. Revisalos e intentá nuevamente.');
    else if (data?.[0]?.linked) {
      setStatus('Vínculo creado. Ya podés consultar la información autorizada.');
      await refreshUser();
      const { data: linked } = await supabase.rpc('get_family_children', { target_tenant_id: tenant.id });
      setChildren(linked || []);
    } else setStatus('No pudimos validar los datos automáticamente. El grupo deberá revisar la solicitud.');
    setLoading(false);
  };

  return <main className="brujula-public min-h-screen"><PublicHeader /><section className="mx-auto max-w-xl px-5 py-12">
    <div className="brujula-auth-card p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold">Portal para familias</h1>
      <p className="mt-2 text-sm text-slate-600">{tenant ? `Grupo: ${tenant.name}` : 'Cargando grupo…'}</p>
      {children.length === 0 ? <form onSubmit={submit} className="mt-6 space-y-4">
        <p className="text-sm">Completá los datos tal como figuran en la ficha del grupo.</p>
        <label className="block text-sm font-semibold">DNI del menor<input className="brujula-auth-input mt-2 w-full" value={dni} onChange={e => setDni(e.target.value)} required /></label>
        <label className="block text-sm font-semibold">Nombre y apellido<input className="brujula-auth-input mt-2 w-full" value={fullName} onChange={e => setFullName(e.target.value)} required /></label>
        <label className="block text-sm font-semibold">Fecha de nacimiento<input className="brujula-auth-input mt-2 w-full" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required /></label>
        {status && <p className="brujula-auth-notice text-sm" role="status">{status}</p>}
        <button className="brujula-primary-action min-h-12 w-full" disabled={loading || !tenant}>{loading ? 'Validando…' : 'Vincular menor'}</button>
      </form> : <div className="mt-6 space-y-3">{children.map(child => <div key={child.id} className="rounded-xl border p-4"><p className="font-semibold">{child.nombre}</p><p className="mt-1 text-sm text-slate-600">Ficha médica digital disponible para consulta.</p></div>)}</div>}
      {status && children.length > 0 && <p className="brujula-auth-notice mt-4 text-sm" role="status">{status}</p>}
    </div>
  </section></main>;
}
