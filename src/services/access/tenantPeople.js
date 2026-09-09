import { z } from 'zod';
const rowsSchema = z.array(z.object({ id: z.string().uuid(), tenant_id: z.string().uuid(), nombre: z.string().nullable().optional() }).passthrough());
export async function readTenantPeople(client, tenantId, filters = {}, sort = '-created_date', limit, rpcName = 'list_tenant_people') {
  if (!tenantId) throw new Error('Seleccioná un grupo para consultar personas.');
  const rows = [];
  for (let offset = 0; offset < 50000; offset += 500) {
    const { data, error } = await client.rpc(rpcName, { target_tenant_id: tenantId, target_offset: offset, target_limit: 500 });
    if (error) throw new Error('No pudimos cargar las personas autorizadas. Revisá la conexión o la actualización de permisos.');
    const page = rowsSchema.parse(data);
    if (page.some(row => row.tenant_id !== tenantId)) throw new Error('Respuesta de otro grupo rechazada.');
    rows.push(...page);
    if (page.length < 500) {
      const descending = sort.startsWith('-');
      const field = sort.replace(/^-/, '').replace(/_date$/, '_at');
      const filtered = rows.filter(row => Object.entries(filters).every(([key,value]) => row[key] === value));
      filtered.sort((a,b) => String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'es', { numeric: true }) * (descending ? -1 : 1));
      return limit ? filtered.slice(0,limit) : filtered;
    }
  }
  throw new Error('El listado excede el máximo seguro. Contactá al administrador.');
}

export function readEmergencyPeople(client, tenantId) {
  return readTenantPeople(client, tenantId, {}, 'nombre', undefined, 'list_tenant_emergency_people');
}
