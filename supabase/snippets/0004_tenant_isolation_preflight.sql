-- SEC-001 / Punto 3: auditoría previa al aislamiento por tenant.
-- Este script es SOLO LECTURA: no crea, modifica ni elimina datos.
-- Ejecutarlo en Supabase SQL Editor y guardar el resultado.

-- Conteo de registros sin tenant_id por tabla.
-- Las consultas se mantienen explícitas para que el resultado sea fácil de leer.
select 'acceso_campamento' as table_name, count(*) as rows_without_tenant from public.acceso_campamento where tenant_id is null
union all select 'actividad_economica', count(*) from public.actividad_economica where tenant_id is null
union all select 'afiliacion', count(*) from public.afiliacion where tenant_id is null
union all select 'beneficiario', count(*) from public.beneficiario where tenant_id is null
union all select 'caja_chica', count(*) from public.caja_chica where tenant_id is null
union all select 'campamento', count(*) from public.campamento where tenant_id is null
union all select 'config_afiliacion', count(*) from public.config_afiliacion where tenant_id is null
union all select 'config_cuota', count(*) from public.config_cuota where tenant_id is null
union all select 'config_general', count(*) from public.config_general where tenant_id is null
union all select 'consulta_dni', count(*) from public.consulta_dni where tenant_id is null
union all select 'credito_beneficiario', count(*) from public.credito_beneficiario where tenant_id is null
union all select 'evento_calendario', count(*) from public.evento_calendario where tenant_id is null
union all select 'gasto', count(*) from public.gasto where tenant_id is null
union all select 'gasto_actividad', count(*) from public.gasto_actividad where tenant_id is null
union all select 'movimiento_banco', count(*) from public.movimiento_banco where tenant_id is null
union all select 'pago', count(*) from public.pago where tenant_id is null
union all select 'pre_encargo_tienda', count(*) from public.pre_encargo_tienda where tenant_id is null
union all select 'producto_actividad', count(*) from public.producto_actividad where tenant_id is null
union all select 'producto_tienda', count(*) from public.producto_tienda where tenant_id is null
union all select 'rendicion_afiliacion', count(*) from public.rendicion_afiliacion where tenant_id is null
union all select 'solicitud_cambio_salud', count(*) from public.solicitud_cambio_salud where tenant_id is null
union all select 'venta_actividad', count(*) from public.venta_actividad where tenant_id is null
union all select 'venta_tienda', count(*) from public.venta_tienda where tenant_id is null
order by table_name;

-- Tenants existentes y cantidad de membresías activas.
select
  tenant.id,
  tenant.name,
  tenant.slug,
  tenant.active,
  count(membership.user_id) filter (where membership.status = 'active') as active_members
from public.tenants tenant
left join public.tenant_memberships membership on membership.tenant_id = tenant.id
group by tenant.id, tenant.name, tenant.slug, tenant.active
order by tenant.name;
