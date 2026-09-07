-- FAM-001: vínculo familiar automático y lectura protegida de ficha médica.
-- Requiere SEC-001 y SEC-002.

create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  beneficiario_id uuid not null references public.beneficiario(id) on delete cascade,
  relationship text not null default 'familiar',
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (tenant_id, user_id, beneficiario_id)
);

create index if not exists family_links_user_idx
  on public.family_links (user_id, tenant_id, status);
create index if not exists family_links_beneficiario_idx
  on public.family_links (beneficiario_id, tenant_id, status);

create table if not exists public.family_link_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  dni_suffix text,
  matched boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.family_links enable row level security;
alter table public.family_link_attempts enable row level security;

drop policy if exists family_links_read_own on public.family_links;
create policy family_links_read_own
  on public.family_links for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_tenant_users(tenant_id)
  );

drop policy if exists family_attempts_read_managers on public.family_link_attempts;
create policy family_attempts_read_managers
  on public.family_link_attempts for select to authenticated
  using (public.can_manage_tenant_users(tenant_id));

create or replace function public.normalize_family_name(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(
    translate(trim(coalesce(value, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')
  ), '[^a-z0-9]+', ' ', 'g');
$$;

create or replace function public.request_family_link(
  target_tenant_id uuid,
  child_dni text,
  child_full_name text,
  child_birth_date date
)
returns table (linked boolean, result_code text, linked_beneficiario_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  matched_id uuid;
  match_count integer;
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if child_dni !~ '^[0-9]{7,9}$'
     or child_birth_date is null
     or public.normalize_family_name(child_full_name) = '' then
    return query select false, 'INVALID_DATA', null::uuid;
    return;
  end if;

  -- Sólo cuenta una coincidencia exacta y única dentro del tenant.
  select min(beneficiario.id), count(*)::integer
  into matched_id, match_count
  from public.beneficiario
  where beneficiario.tenant_id = target_tenant_id
    and beneficiario.activo is distinct from false
    and regexp_replace(coalesce(beneficiario.dni, ''), '[^0-9]', '', 'g') = child_dni
    and public.normalize_family_name(beneficiario.nombre) = public.normalize_family_name(child_full_name)
    and beneficiario.fecha_nacimiento = child_birth_date::text;

  insert into public.family_link_attempts (tenant_id, user_id, dni_suffix, matched)
  values (target_tenant_id, auth.uid(), right(child_dni, 2), match_count = 1);

  if match_count <> 1 then
    return query select false, 'PENDING_REVIEW', null::uuid;
    return;
  end if;

  insert into public.family_links (tenant_id, user_id, beneficiario_id)
  values (target_tenant_id, auth.uid(), matched_id)
  on conflict (tenant_id, user_id, beneficiario_id)
  do update set status = 'active', revoked_at = null;

  insert into public.tenant_memberships (tenant_id, user_id, role, status)
  values (target_tenant_id, auth.uid(), 'member', 'active')
  on conflict (tenant_id, user_id) do update set status = 'active';

  insert into public.tenant_membership_roles (tenant_id, user_id, role)
  values (target_tenant_id, auth.uid(), 'family')
  on conflict do nothing;

  return query select true, 'LINKED', matched_id;
end;
$$;

create or replace function public.get_family_children(target_tenant_id uuid)
returns table (
  id uuid,
  nombre text,
  dni text,
  fecha_nacimiento text,
  rama text,
  grupo_familiar text,
  grupo_sanguineo text,
  factor_rh text,
  alergias text,
  condicion_medica text,
  medicacion_habitual text,
  regimen_dietario text,
  anticoagulacion text,
  salud_mental text,
  discapacidad text,
  obra_social text,
  numero_obra_social text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  contacto_emergencia_relacion text,
  observaciones_salud text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    b.id, b.nombre, b.dni, b.fecha_nacimiento, b.rama, b.grupo_familiar,
    b.grupo_sanguineo, b.factor_rh, b.alergias, b.condicion_medica,
    b.medicacion_habitual, b.regimen_dietario, b.anticoagulacion,
    b.salud_mental, b.discapacidad, b.obra_social, b.numero_obra_social,
    b.contacto_emergencia_nombre, b.contacto_emergencia_telefono,
    b.contacto_emergencia_relacion, b.observaciones_salud
  from public.beneficiario b
  join public.family_links link
    on link.beneficiario_id = b.id
   and link.tenant_id = b.tenant_id
   and link.user_id = auth.uid()
   and link.status = 'active'
  where b.tenant_id = target_tenant_id;
$$;

revoke all on function public.request_family_link(uuid, text, text, date) from public, anon;
revoke all on function public.get_family_children(uuid) from public, anon;
grant execute on function public.request_family_link(uuid, text, text, date) to authenticated;
grant execute on function public.get_family_children(uuid) to authenticated;

-- Las familias no leen tablas operativas directamente: sólo las funciones
-- anteriores. Los roles administrativos conservan la lectura del tenant.
do $$
declare
  current_table text;
  operational_tables constant text[] := array[
    'acceso_campamento','actividad_economica','afiliacion','beneficiario',
    'caja_chica','campamento','config_afiliacion','config_cuota',
    'config_general','consulta_dni','credito_beneficiario','evento_calendario',
    'gasto','gasto_actividad','movimiento_banco','pago','pre_encargo_tienda',
    'producto_actividad','producto_tienda','rendicion_afiliacion',
    'solicitud_cambio_salud','venta_actividad','venta_tienda'
  ];
begin
  foreach current_table in array operational_tables loop
    if to_regclass('public.' || current_table) is not null then
      execute format('drop policy if exists tenant_isolation_select on public.%I', current_table);
      execute format($policy$
        create policy tenant_isolation_select
          on public.%I for select to authenticated
          using (
            public.has_tenant_role(
              tenant_id,
              array['tenant_admin', 'group_leadership', 'administration', 'treasury']::text[]
            )
          )
      $policy$, current_table);
    end if;
  end loop;
end
$$;
