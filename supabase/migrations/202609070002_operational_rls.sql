-- SEC-001 / Punto 3: aislamiento RLS de las entidades operativas.
-- Requisito: ejecutar luego de 202609070001_tenant_access_roles_invitations.sql.
-- Las rutas públicas heredadas se protegen en SEC-002 mediante funciones RPC
-- específicas; desde este punto no deben consultar tablas operativas directamente.

do $$
declare
  current_table text;
  operational_tables constant text[] := array[
    'acceso_campamento',
    'actividad_economica',
    'afiliacion',
    'beneficiario',
    'caja_chica',
    'campamento',
    'config_afiliacion',
    'config_cuota',
    'config_general',
    'consulta_dni',
    'credito_beneficiario',
    'evento_calendario',
    'gasto',
    'gasto_actividad',
    'movimiento_banco',
    'pago',
    'pre_encargo_tienda',
    'producto_actividad',
    'producto_tienda',
    'rendicion_afiliacion',
    'solicitud_cambio_salud',
    'venta_actividad',
    'venta_tienda'
  ];
begin
  foreach current_table in array operational_tables loop
    if to_regclass('public.' || current_table) is not null then
      execute format('alter table public.%I enable row level security', current_table);

      execute format('drop policy if exists tenant_isolation_select on public.%I', current_table);
      execute format('drop policy if exists tenant_isolation_insert on public.%I', current_table);
      execute format('drop policy if exists tenant_isolation_update on public.%I', current_table);
      execute format('drop policy if exists tenant_isolation_delete on public.%I', current_table);

      execute format($policy$
        create policy tenant_isolation_select
          on public.%I for select to authenticated
          using (public.can_access_tenant(tenant_id))
      $policy$, current_table);

      execute format($policy$
        create policy tenant_isolation_insert
          on public.%I for insert to authenticated
          with check (
            public.has_tenant_role(
              tenant_id,
              array['tenant_admin', 'group_leadership', 'administration', 'treasury']::text[]
            )
          )
      $policy$, current_table);

      execute format($policy$
        create policy tenant_isolation_update
          on public.%I for update to authenticated
          using (
            public.has_tenant_role(
              tenant_id,
              array['tenant_admin', 'group_leadership', 'administration', 'treasury']::text[]
            )
          )
          with check (
            public.has_tenant_role(
              tenant_id,
              array['tenant_admin', 'group_leadership', 'administration', 'treasury']::text[]
            )
          )
      $policy$, current_table);

      execute format($policy$
        create policy tenant_isolation_delete
          on public.%I for delete to authenticated
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

-- Confirmación: sólo deben aparecer tablas con RLS habilitado.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'acceso_campamento', 'actividad_economica', 'afiliacion', 'beneficiario',
    'caja_chica', 'campamento', 'config_afiliacion', 'config_cuota',
    'config_general', 'consulta_dni', 'credito_beneficiario',
    'evento_calendario', 'gasto', 'gasto_actividad', 'movimiento_banco',
    'pago', 'pre_encargo_tienda', 'producto_actividad', 'producto_tienda',
    'rendicion_afiliacion', 'solicitud_cambio_salud', 'venta_actividad',
    'venta_tienda'
  )
order by tablename;
