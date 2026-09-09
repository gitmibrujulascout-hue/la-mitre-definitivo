import { z } from 'zod';
const schema = z.object({
  rama: z.enum(['Lobatos', 'Tropa', 'KM', 'Rovers', 'Voluntario', 'Educador']).optional(),
  tipo: z.enum(['Beneficiario', 'Voluntario']).optional(),
  funcion: z.string().max(200).optional(), estado_panuelo: z.string().max(100).optional(),
  becado: z.boolean().optional(), activo: z.boolean().optional(),
  zona: z.string().max(200).optional(), distrito: z.string().max(200).optional(),
  grupo_familiar: z.string().max(200).optional(), email_contacto: z.string().max(254).optional(),
  telefono_contacto: z.string().max(100).optional()
}).strict();
export async function saveMemberBulkEdit(client, tenant, ids, fields, values) {
  if (!tenant) throw new Error('Seleccioná un grupo antes de guardar.');
  const selected = z.array(z.string().uuid()).min(1).max(1000).parse([...new Set(ids)]);
  if (!fields.length || fields.some(field => values[field] === undefined)) throw new Error('Elegí un valor para cada campo marcado.');
  const patch = schema.parse(Object.fromEntries(fields.map(field => [field, values[field] === '__blank__' ? '' : values[field]])));
  const { data, error } = await client.from('beneficiario').update({ ...patch, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenant).in('id', selected).select('id');
  if (error) throw new Error('No pudimos guardar los cambios. Revisá tus permisos e intentá nuevamente.');
  if (data?.length !== selected.length) throw new Error('No se actualizaron todos los miembros. Recargá el listado y revisá tus permisos antes de reintentar.');
  return data.length;
}
