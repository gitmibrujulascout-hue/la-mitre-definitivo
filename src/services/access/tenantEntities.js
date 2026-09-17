import { z } from 'zod';
import { normalizeBulkUpdatePlan } from '../../api/bulkUpdatePlan.js';

const object = z.record(z.unknown());
const tenantSchema = z.string().uuid();
const snake = value => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
const normalize = value => Array.isArray(value) ? value.map(normalize) : (!value || typeof value !== 'object' ? value : Object.fromEntries(Object.entries(value).map(([key, val]) => [snake(key), normalize(val)])));
const failure = () => new Error('No pudimos completar la operación. Revisá tu conexión y los permisos del grupo e intentá nuevamente.');

export function createTenantEntity({ client, getTenant, name, readPeople, writeValues = value => value }) {
  const table = snake(name);
  async function tenant() {
    const parsed = tenantSchema.safeParse(await getTenant());
    if (!parsed.success) throw new Error('Seleccioná un grupo para continuar.');
    return parsed.data;
  }
  function payload(value, tenantId, writing = false, expectedId) {
    const parsed = object.safeParse(value);
    if (!parsed.success) throw new Error('Revisá los datos de la operación.');
    const data = normalize(parsed.data);
    if (data.tenant_id !== undefined && data.tenant_id !== tenantId) throw new Error('Los datos no corresponden al grupo activo.');
    if (writing) {
      if (Object.hasOwn(data,'id') && data.id !== expectedId) throw new Error('No se puede modificar la identidad del registro.');
      // Existing forms submit the complete row: metadata is read-only, never rewritten.
      delete data.id;
      delete data.created_at;
      delete data.updated_at;
      delete data.scholarship_periods;
      delete data.inactive_periods;
      delete data.legacy_becado;
    }
    return data;
  }
  function filters(query, data) {
    for (const [key, value] of Object.entries(data)) query = value === null ? query.is(key, null) : query.eq(key, value);
    return query;
  }
  async function result(query) {
    const { data, error } = await query;
    if (error) throw failure();
    return data;
  }
  async function read(values, sort, limit) {
    const tenantId = await tenant();
    const where = payload(values, tenantId);
    if (name === 'Beneficiario') return readPeople(client, tenantId, where, sort, limit);
    let query = filters(client.from(table).select('*').eq('tenant_id', tenantId), where);
    query = query.order(snake(sort.replace(/^-/, '').replace(/_date$/, '_at')), { ascending: !sort.startsWith('-') });
    if (limit) query = query.limit(limit);
    return (await result(query)) || [];
  }
  async function atomic(operations) {
    const tenantId = await tenant();
    const parsed = z.array(z.object({
      type: z.enum(['update', 'create']), id: z.string().uuid().optional(),
      values: object, expected_updated_at: z.string().nullable().optional(),
    }).strict()).min(1).max(1000).safeParse(operations);
    if (!parsed.success) throw new Error('Revisá los registros seleccionados.');
    const prepared = parsed.data.map(operation => ({ ...operation, values: writeValues(payload(operation.values, tenantId, true, operation.id)) }));
    const { data, error } = await client.rpc('apply_tenant_batch', { target_tenant_id: tenantId, target_table: table, operations: prepared });
    if (error) {
      if (error.code === 'PGRST202') throw new Error('El administrador debe actualizar la base para habilitar el guardado masivo.');
      throw new Error('No pudimos confirmar el lote. Actualizá el listado antes de reintentar; los cambios se guardan todos juntos.');
    }
    const rows = z.array(z.object({ id: z.string().uuid(), tenant_id: tenantSchema }).passthrough()).safeParse(data);
    if (!rows.success || rows.data.length !== operations.length || rows.data.some(row => row.tenant_id !== tenantId)) throw failure();
    return rows.data;
  }
  return {
    async get(id) {
      if (!tenantSchema.safeParse(id).success) throw new Error('El registro solicitado no es válido.');
      const rows=await read({id},'-created_date',1);
      return rows[0]??null;
    },
    list: (sort = '-created_date', limit = name === 'Beneficiario' ? undefined : 100) => read({}, sort, limit),
    filter: (where = {}, sort = '-created_date', limit = name === 'Beneficiario' ? undefined : 100) => read(where, sort, limit),
    async create(values) {
      const tenantId = await tenant();
      const row = { ...writeValues(payload(values, tenantId, true)), tenant_id: tenantId };
      return result(client.from(table).insert(row).select().single());
    },
    async update(id, values) {
      const tenantId = await tenant();
      const row = { ...writeValues(payload(values, tenantId, true, id)), updated_at: new Date().toISOString() };
      return result(client.from(table).update(row).eq('tenant_id', tenantId).eq('id', id).select().single());
    },
    async delete(id) {
      const tenantId = await tenant();
      await result(client.from(table).delete().eq('tenant_id', tenantId).eq('id', id));
      return true;
    },
    async deleteMany(where = {}) {
      const tenantId = await tenant();
      const data = payload(where, tenantId);
      if (!Object.keys(data).some(key => key !== 'tenant_id')) throw new Error('Seleccioná qué registros eliminar.');
      await result(filters(client.from(table).delete().eq('tenant_id', tenantId), data));
      return true;
    },
    async bulkCreate(records) {
      const tenantId = await tenant();
      if (!Array.isArray(records)) throw failure();
      const rows = records.map(row => ({ ...writeValues(payload(row, tenantId, true)), tenant_id: tenantId }));
      return (await result(client.from(table).insert(rows).select())) || [];
    },
    async bulkUpdate(where, values) {
      // Capture and validate context even for an empty or malformed batch.
      const tenantId = await tenant();
      const plan = normalizeBulkUpdatePlan(where, values);
      if (Array.isArray(plan)) return atomic(plan.map(row => ({ type: 'update', ...row })));
      const selection = payload(plan.filters, tenantId);
      const changes = writeValues(payload(plan.values, tenantId, true));
      if (!Object.keys(selection).some(key => key !== 'tenant_id')) throw new Error('Seleccioná qué registros actualizar.');
      return (await result(filters(client.from(table).update({ ...changes, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId), selection).select())) || [];
    },
    atomic,
  };
}
