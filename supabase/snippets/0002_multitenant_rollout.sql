-- Despliegue gradual de multi-tenancy.
-- Se agregan tenant_id como columnas opcionales para no romper los datos existentes.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'acceso_campamento','actividad_economica','afiliacion','beneficiario',
    'caja_chica','campamento','config_afiliacion','config_cuota','config_general',
    'consulta_dni','credito_beneficiario','evento_calendario','gasto',
    'gasto_actividad','movimiento_banco','pago','pre_encargo_tienda',
    'producto_actividad','producto_tienda','rendicion_afiliacion',
    'solicitud_cambio_salud','venta_actividad','venta_tienda'
  ] loop
    execute format('alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)', table_name);
    execute format('create index if not exists %I on public.%I(tenant_id)', table_name || '_tenant_id_idx', table_name);
  end loop;
end $$;

-- Función para usarla cuando cada registro ya tenga tenant_id.
create or replace function public.can_access_tenant(row_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
    or (row_tenant_id is not null and exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = row_tenant_id
        and tm.user_id = auth.uid()
    ));
$$;

grant execute on function public.can_access_tenant(uuid) to authenticated;
