import { supabase } from './supabaseClient';
import { uploadFile } from './supabaseStorage';

const snake = value => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
const normalize = value => Array.isArray(value) ? value.map(normalize) : (!value || typeof value !== 'object' ? value : Object.fromEntries(Object.entries(value).map(([key, val]) => [snake(key), normalize(val)])));
const entity = name => ({
  async list(sort = '-created_date', limit = 100) { const desc = String(sort).startsWith('-'); const col = snake(String(sort).replace(/^-/, '').replace(/_date$/, '_at')); let q = supabase.from(snake(name)).select('*').order(col, { ascending: !desc }); if (limit) q = q.limit(limit); const { data, error } = await q; if (error) throw error; return data || []; },
  async filter(filters = {}, sort = '-created_date', limit = 100) { const desc = String(sort).startsWith('-'); const col = snake(String(sort).replace(/^-/, '').replace(/_date$/, '_at')); let q = supabase.from(snake(name)).select('*'); for (const [key, value] of Object.entries(normalize(filters))) q = value === null ? q.is(key, null) : q.eq(key, value); q = q.order(col, { ascending: !desc }); if (limit) q = q.limit(limit); const { data, error } = await q; if (error) throw error; return data || []; },
  async create(values) { const { data, error } = await supabase.from(snake(name)).insert(normalize(values)).select().single(); if (error) throw error; return data; },
  async update(id, values) { const { data, error } = await supabase.from(snake(name)).update({ ...normalize(values), updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) throw error; return data; },
  async delete(id) { const { error } = await supabase.from(snake(name)).delete().eq('id', id); if (error) throw error; return true; },
  async deleteMany(filters = {}) { let q = supabase.from(snake(name)).delete(); for (const [key, value] of Object.entries(normalize(filters))) q = q.eq(key, value); const { error } = await q; if (error) throw error; return true; },
  async bulkCreate(records) { const { data, error } = await supabase.from(snake(name)).insert(normalize(records)).select(); if (error) throw error; return data || []; },
  async bulkUpdate(filters, values) { let q = supabase.from(snake(name)).update({ ...normalize(values), updated_at: new Date().toISOString() }); for (const [key, value] of Object.entries(normalize(filters))) q = q.eq(key, value); const { data, error } = await q.select(); if (error) throw error; return data || []; }
});

const names = ['AccesoCampamento','ActividadEconomica','Afiliacion','Beneficiario','CajaChica','Campamento','ConfigAfiliacion','ConfigCuota','ConfigGeneral','ConsultaDni','CreditoBeneficiario','EventoCalendario','Gasto','GastoActividad','MovimientoBanco','Pago','PreEncargoTienda','ProductoActividad','ProductoTienda','RendicionAfiliacion','SolicitudCambioSalud','User','VentaActividad','VentaTienda'];
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
  integrations: { Core: { UploadFile: uploadFile, InvokeLLM: async () => { throw new Error('La integración de IA debe migrarse a una Edge Function.'); }, ExtractDataFromUploadedFile: async () => { throw new Error('La extracción de archivos debe migrarse a una Edge Function.'); } } },
  agents: { getWhatsAppConnectURL: () => '/login' }
};
