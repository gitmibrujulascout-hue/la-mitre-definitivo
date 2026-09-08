import { supabase } from '../../api/supabaseClient';
import { getActiveTenantId } from '../../api/tenantContext';
export async function allExistingMembers() {
  const tenant = await getActiveTenantId();
  if (!tenant) throw new Error('Seleccioná un grupo antes de importar.');
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('beneficiario').select('*').eq('tenant_id', tenant).order('id').range(offset, offset + 499);
    if (error) throw new Error('No se pudieron comprobar los miembros existentes. Intentá nuevamente.');
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
