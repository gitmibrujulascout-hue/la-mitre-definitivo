import { readTenantPeople } from '../services/access/tenantPeople';
import { scholarshipWrite } from '../services/access/scholarships';
import { createTenantEntity } from '../services/access/tenantEntities.js';
import { supabase } from './supabaseClient';
import { uploadFile } from './supabaseStorage';
import { getActiveTenantId } from './tenantContext';
import { extractionSchema } from '../services/access/extractionSchema';

const entity = name => createTenantEntity({
  client: supabase, getTenant: getActiveTenantId, name, readPeople: readTenantPeople,
  writeValues: value => name === 'Beneficiario' ? scholarshipWrite(value) : value,
});

const names = ['AccesoCampamento','ActividadEconomica','Afiliacion','Beneficiario','CajaChica','Campamento','ConfigAfiliacion','ConfigCuota','ConfigGeneral','ConsultaDni','CreditoBeneficiario','EventoCalendario','Gasto','GastoActividad','MovimientoBanco','Pago','PreEncargoTienda','ProductoActividad','ProductoTienda','RendicionAfiliacion','SolicitudCambioSalud','User','VentaActividad','VentaTienda'];
export { normalizeBulkUpdatePlan } from './bulkUpdatePlan.js';

export const base44 = {
  entities: Object.fromEntries(names.map(name => [name, entity(name)])),
  auth: { me: async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authenticated'); const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); return { ...user, ...(profile || {}) }; }, logout: () => supabase.auth.signOut(), redirectToLogin: () => window.location.assign('/login') },
  functions: { invoke: async (name, body = {}) => {
    if (name === 'validar_clave_admin') {
      const tenant = await getActiveTenantId();
      if (!tenant) throw new Error('Seleccioná un grupo para continuar.');
      const { data: config, error } = await supabase.from('config_general').select('clave_admin').eq('tenant_id', tenant).limit(1).maybeSingle();
      if (error) throw new Error('No pudimos validar el acceso del grupo. Intentá nuevamente.');
      return { valido: Boolean(config?.clave_admin && config.clave_admin === body.clave), sinClave: !config?.clave_admin };
    }
    throw new Error(`La función ${name} todavía debe migrarse a Supabase Edge Functions.`);
  } },
  integrations: { Core: { UploadFile: uploadFile, InvokeLLM: async ({ prompt, file_urls = [], response_json_schema } = {}) => { const { data, error } = await supabase.functions.invoke('ai-extract', { body: { prompt, file_urls, response_json_schema: extractionSchema(response_json_schema) } }); if (error) throw error; return data; }, ExtractDataFromUploadedFile: async ({ file_url, json_schema } = {}) => { const { data, error } = await supabase.functions.invoke('ai-extract', { body: { prompt: 'Extraé los datos del archivo respetando exactamente el esquema indicado.', file_urls: [file_url], response_json_schema: extractionSchema(json_schema) } }); if (error) throw error; return { status: 'success', output: data }; } } },
  agents: { getWhatsAppConnectURL: () => '/login' }
};
