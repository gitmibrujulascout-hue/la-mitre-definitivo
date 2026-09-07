import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPTY_FORM = Object.freeze({ name: '', slug: '' });

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const nameRef = useRef(null);
  const slugRef = useRef(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('tenants')
      .select('id,name,slug,active,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError('No pudimos cargar los tenants. Revisá la conexión e intentá nuevamente.');
    } else {
      setTenants(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const activeCount = useMemo(
    () => tenants.filter((tenant) => tenant.active).length,
    [tenants]
  );

  const createTenant = async (event) => {
    event.preventDefault();
    setStatus(null);

    const name = form.name.trim();
    const slug = normalizeSlug(form.slug);
    const nextErrors = {};
    if (name.length < 2) nextErrors.name = 'Ingresá el nombre del grupo.';
    if (!slug) nextErrors.slug = 'Ingresá un identificador válido.';

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      if (nextErrors.name) nameRef.current?.focus();
      else slugRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setCreating(true);
    const { error } = await supabase.from('tenants').insert({ name, slug });

    if (error) {
      setStatus({
        type: 'error',
        text: error.code === '23505'
          ? 'Ya existe un tenant con ese identificador.'
          : 'No pudimos crear el tenant. Intentá nuevamente.'
      });
      setCreating(false);
      return;
    }

    setForm(EMPTY_FORM);
    setStatus({ type: 'success', text: 'Tenant creado correctamente.' });
    setCreating(false);
    await loadTenants();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Plataforma Brújula</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Consola superadmin</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Administrá los espacios de todos los grupos scouts desde un único lugar.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadTenants()} disabled={loading} className="min-h-11">
          <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de tenants">
        <Card>
          <CardContent className="p-5">
            <Building2 className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-3xl font-extrabold">{tenants.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tenants totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <CheckCircle2 className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-3xl font-extrabold">{activeCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tenants activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ShieldCheck className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
            <p className="truncate text-sm font-bold" title={user?.email || ''}>{user?.email}</p>
            <p className="mt-1 text-sm text-muted-foreground">Sesión superadmin</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Tenants registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="space-y-3" aria-label="Cargando tenants">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            )}

            {!loading && loadError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4" role="alert">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">No pudimos mostrar los tenants.</p>
                    <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
                    <Button className="mt-4" variant="outline" onClick={() => void loadTenants()}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!loading && !loadError && tenants.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Building2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-semibold">Todavía no hay tenants.</p>
                <p className="mt-1 text-sm text-muted-foreground">Creá el primero desde el formulario.</p>
              </div>
            )}

            {!loading && !loadError && tenants.length > 0 && (
              <div className="space-y-3">
                {tenants.map((tenant) => (
                  <article key={tenant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold">{tenant.name}</h2>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{tenant.slug}</p>
                    </div>
                    <span className={tenant.active
                      ? 'rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary'
                      : 'rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground'}>
                      {tenant.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crear tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createTenant} className="space-y-4" noValidate>
              <label className="block text-sm font-semibold" htmlFor="tenant-name">
                Nombre del grupo
                <Input
                  ref={nameRef}
                  id="tenant-name"
                  className="mt-2 min-h-11"
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    setFieldErrors((current) => ({ ...current, name: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
              </label>
              {fieldErrors.name && <p className="text-sm text-destructive" role="alert">{fieldErrors.name}</p>}

              <label className="block text-sm font-semibold" htmlFor="tenant-slug">
                Identificador
                <Input
                  ref={slugRef}
                  id="tenant-slug"
                  className="mt-2 min-h-11"
                  placeholder="grupo-san-martin"
                  value={form.slug}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, slug: event.target.value }));
                    setFieldErrors((current) => ({ ...current, slug: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.slug)}
                />
              </label>
              {fieldErrors.slug && <p className="text-sm text-destructive" role="alert">{fieldErrors.slug}</p>}

              {status && (
                <div
                  className={status.type === 'error'
                    ? 'rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
                    : 'rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary'}
                  role={status.type === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {status.text}
                </div>
              )}

              <Button className="min-h-11 w-full" type="submit" disabled={creating}>
                <Plus aria-hidden="true" />
                {creating ? 'Creando…' : 'Crear tenant'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
