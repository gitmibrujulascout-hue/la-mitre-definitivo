import { readTenantPeople } from '../services/access/tenantPeople';
import { scholarshipWrite } from '../services/access/scholarships';
import { supabase } from './supabaseClient';
import { uploadFile } from './supabaseStorage';
import { getActiveTenantId } from './tenantContext';
import { extractionSchema } from '../services/access/extractionSchema';
import { normalizeBulkUpdatePlan } from './bulkUpdatePlan.js';

const snake = value => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
const normalize = value => Array.isArray(value) ? value.map(normalize) : (!value || typeof value !== 'object' ? value : Object.fromEntries(Object.entries(value).map(([key, val]) => [snake(key), normalize(val)])));
const entityValues = (name, values) => name === 'Beneficiario' ? scholarshipWrite(normalize(values)) : normalize(values);
const isMissingTenantColumnError = error => Boolean(error && /tenant_id.*does not exist|column .*tenant_id.*does not exist/i.test(error.message || ''));
const dropTenantIdIfMissing = (payload = {}) => {
  const next = { ...payload };
  delete next.tenant_id;
  return next;
};
const withTenantScope = async (query, tenantId) => {
  if (!tenantId) return query;
  return query.eq('tenant_id', tenantId);
};
const retryWithoutTenantScope = async (operation) => {
  const result = await operation();
  if (result?.error && isMissingTenantColumnError(result.error)) {
    const fallback = await operation(true);
    if (fallback?.error) throw fallback.error;
    return fallback;
  }
  return result;
};
const updateRowById = async (tableName, id, values) => {
  const payload = { ...entityValues(tableName, values), updated_at: new Date().toISOString() };
  const tenant = await getActiveTenantId();
  const operation = async (skipTenantScope = false) => {
    let q = supabase.from(snake(tableName)).update(skipTenantScope ? dropTenantIdIfMissing(payload) : payload).eq('id', id);
    if (tenant && !skipTenantScope) q = q.eq('tenant_id', tenant);
    return q.select().single();
  };
  const { data, error } = await retryWithoutTenantScope(operation);
  if (error) throw error;
  return data;
};
const entity = name => ({
  async list(sort = '-created_date', limit = name === 'Beneficiario' ? undefined : 100) { if (name === 'Beneficiario') return readTenantPeople(supabase, await getActiveTenantId(), {}, sort, limit); const desc = String(sort).startsWith('-'); const col = snake(String(sort).replace(/^-/, '').replace(/_date$/, '_at')); let q = supabase.from(snake(name)).select('*'); const tenant = await getActiveTenantId(); if (tenant) q = q.eq('tenant_id', tenant); q = q.order(col, { ascending: !desc }); if (limit) q = q.limit(limit); const { data, error } = await q; if (error && isMissingTenantColumnError(error)) { const fallback = await supabase.from(snake(name)).select('*').order(col, { ascending: !desc }); if (fallback.error) throw fallback.error; return fallback.data || []; } if (error) throw error; return data || []; },
  async filter(filters = {}, sort = '-created_date', limit = name === 'Beneficiario' ? undefined : 100) { if (name === 'Beneficiario') return readTenantPeople(supabase, await getActiveTenantId(), normalize(filters), sort, limit); const desc = String(sort).startsWith('-'); const col = snake(String(sort).replace(/^-/, '').replace(/_date$/, '_at')); let q = supabase.from(snake(name)).select('*'); const tenant = await getActiveTenantId(); if (tenant) q = q.eq('tenant_id', tenant); for (const [key, value] of Object.entries(normalize(filters))) q = value === null ? q.is(key, null) : q.eq(key, value); q = q.order(col, { ascending: !desc }); if (limit) q = q.limit(limit); const { data, error } = await q; if (error && isMissingTenantColumnError(error)) { let fallback = supabase.from(snake(name)).select('*'); for (const [key, value] of Object.entries(normalize(filters))) fallback = value === null ? fallback.is(key, null) : fallback.eq(key, value); fallback = fallback.order(col, { ascending: !desc }); if (limit) fallback = fallback.limit(limit); const retry = await fallback; if (retry.error) throw retry.error; return retry.data || []; } if (error) throw error; return data || []; },
  async create(values) { const payload = entityValues(name, values); const tenant = await getActiveTenantId(); const next = tenant && !payload.tenant_id ? { ...payload, tenant_id: tenant } : payload; const op = async (skipTenantScope = false) => { const row = skipTenantScope ? dropTenantIdIfMissing(next) : next; return supabase.from(snake(name)).insert(row).select().single(); }; const { data, error } = await retryWithoutTenantScope(op); if (error) throw error; return data; },
  async update(id, values) {
    const tenant = await getActiveTenantId();
    if (!tenant) throw new Error('No hay una organización activa.');
    try {
      return await updateRowById(name, id, values);
    } catch (error) {
      if (!isMissingTenantColumnError(error)) throw error;
      const fallback = await supabase.from(snake(name)).update({ ...entityValues(name, values), updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (fallback.error) throw fallback.error;
      return fallback.data;
    }
  },
  async delete(id) { let q = supabase.from(snake(name)).delete().eq('id', id); const tenant = await getActiveTenantId(); if (!tenant) throw new Error('No hay una organización activa.'); q = q.eq('tenant_id', tenant); const { error } = await q; if (error && isMissingTenantColumnError(error)) { const retry = await supabase.from(snake(name)).delete().eq('id', id); if (retry.error) throw retry.error; return true; } if (error) throw error; return true; },
  async deleteMany(filters = {}) { let q = supabase.from(snake(name)).delete(); const tenant = await getActiveTenantId(); if (tenant) q = q.eq('tenant_id', tenant); for (const [key, value] of Object.entries(normalize(filters))) q = q.eq(key, value); const { error } = await q; if (error && isMissingTenantColumnError(error)) { let retry = supabase.from(snake(name)).delete(); for (const [key, value] of Object.entries(normalize(filters))) retry = q.eq(key, value); const final = await retry; if (final.error) throw final.error; return true; } if (error) throw error; return true; },
  async bulkCreate(records) { const tenant = await getActiveTenantId(); const payload = records.map(row => entityValues(name, row)).map(row => tenant && !row.tenant_id ? { ...row, tenant_id: tenant } : row); const op = async (skipTenantScope = false) => { const rows = skipTenantScope ? payload.map(row => dropTenantIdIfMissing(row)) : payload; return supabase.from(snake(name)).insert(rows).select(); }; const { data, error } = await retryWithoutTenantScope(op); if (error) throw error; return data || []; },
  async bulkUpdate(filters, values) {
    const plan = normalizeBulkUpdatePlan(filters, values);
    if (Array.isArray(plan)) {
      const results = [];
      for (const { id, values: rowValues } of plan) {
        const updated = await updateRowById(name, id, rowValues);
        if (updated) results.push(updated);
      }
      return results;
    }

    const tenant = await getActiveTenantId();
    let q = supabase.from(snake(name)).update({ ...entityValues(name, plan.values), updated_at: new Date().toISOString() });
    if (tenant) q = q.eq('tenant_id', tenant);
    for (const [key, value] of Object.entries(normalize(plan.filters))) q = value === null ? q.is(key, null) : q.eq(key, value);
    const { data, error } = await q.select();
    if (error && isMissingTenantColumnError(error)) {
      let fallback = supabase.from(snake(name)).update({ ...entityValues(name, plan.values), updated_at: new Date().toISOString() });
      for (const [key, value] of Object.entries(normalize(plan.filters))) fallback = value === null ? fallback.is(key, null) : fallback.eq(key, value);
      const retry = await fallback.select();
      if (retry.error) throw retry.error;
      return retry.data || [];
    }
    if (error) throw error;
    return data || [];
  }
});

const names = ['AccesoCampamento','ActividadEconomica','Afiliacion','Beneficiario','CajaChica','Campamento','ConfigAfiliacion','ConfigCuota','ConfigGeneral','ConsultaDni','CreditoBeneficiario','EventoCalendario','Gasto','GastoActividad','MovimientoBanco','Pago','PreEncargoTienda','ProductoActividad','ProductoTienda','RendicionAfiliacion','SolicitudCambioSalud','User','VentaActividad','VentaTienda'];
export { normalizeBulkUpdatePlan } from './bulkUpdatePlan.js';

export const base44 = {
  entities: Object.fromEntries(names.map(name => [name, entity(name)])),
  auth: { me: async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authenticated'); const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); return { ...user, ...(profile || {}) }; }, logout: () => supabase.auth.signOut(), redirectToLogin: () => window.location.assign('/login') },
  functions: { invoke: async (name, body = {}) => {
    if (name === 'validar_clave_admin') {
      const { data: config, error } = await supabase.from('config_general').select('clave_admin').limit(1).maybeSingle();
      if (error) throw error;
      return { valido: Boolean(config?.clave_admin && config.clave_admin === body.clave), sinClave: !config?.clave_admin };
    }
    throw new Error(`La función ${name} todavía debe migrarse a Supabase Edge Functions.`);
  } },
  integrations: { Core: { UploadFile: uploadFile, InvokeLLM: async ({ prompt, file_urls = [], response_json_schema } = {}) => { const { data, error } = await supabase.functions.invoke('ai-extract', { body: { prompt, file_urls, response_json_schema: extractionSchema(response_json_schema) } }); if (error) throw error; return data; }, ExtractDataFromUploadedFile: async ({ file_url, json_schema } = {}) => { const { data, error } = await supabase.functions.invoke('ai-extract', { body: { prompt: 'Extraé los datos del archivo respetando exactamente el esquema indicado.', file_urls: [file_url], response_json_schema: extractionSchema(json_schema) } }); if (error) throw error; return { status: 'success', output: data }; } } },
  agents: { getWhatsAppConnectURL: () => '/login' }
};
