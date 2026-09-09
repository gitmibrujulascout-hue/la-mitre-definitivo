import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { SCHOLARSHIP_BRANCHES, policySchema } from '@/services/access/scholarships';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ScholarshipPolicyCard() {
  const { user } = useAuth(); const tenantId = user?.tenant_id;
  const cache = useQueryClient(); const [branches,setBranches] = useState([]);
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  const query = useQuery({ queryKey: ['scholarship-policy',tenantId], enabled: Boolean(tenantId), queryFn: async () => {
    const { data,error } = await supabase.from('tenant_scholarship_policy').select('branches').eq('tenant_id',tenantId).maybeSingle();
    if(error) throw new Error('No se pudo leer la configuración de becas.');
    return policySchema.parse(data?.branches ?? []);
  } });
  useEffect(() => { if(query.data) setBranches(query.data); },[query.data]);
  const save = async () => {
    setBusy(true);setMessage('');
    try {
      const { error } = await supabase.rpc('save_tenant_scholarship_policy',{target_tenant_id:tenantId,requested_branches:policySchema.parse(branches)});
      if(error) throw error;
      await cache.invalidateQueries(); setMessage('Regla guardada. Las personas que heredan la regla ya tienen su beca actualizada.');
    } catch { setMessage('No pudimos guardar. Revisá tus permisos y que la actualización de becas esté aplicada.'); }
    finally { setBusy(false); }
  };
  return <Card className="p-5 mb-6 space-y-4">
    <h2 className="text-lg font-semibold">Becas del grupo</h2>
    <p className="text-sm text-muted-foreground">Marcá las ramas con beca completa de cuota mensual en {user?.tenant?.name || 'este grupo'}. No afecta a otros grupos ni a los campamentos.</p>
    {query.isPending ? <div className="h-12 animate-pulse bg-muted rounded" aria-label="Cargando becas"/> : query.isError ? <p role="alert">No pudimos cargar las becas. <button className="underline" onClick={() => query.refetch()}>Reintentar</button></p> : <>
      <div className="grid grid-cols-2 gap-3">{SCHOLARSHIP_BRANCHES.map(branch => <label key={branch} className="flex min-h-11 items-center gap-3 rounded border p-3"><input type="checkbox" checked={branches.includes(branch)} onChange={e => setBranches(current => e.target.checked ? [...current,branch] : current.filter(item => item!==branch))}/>{branch}</label>)}</div>
      <p className="text-sm">Sin ramas marcadas no se otorgan becas automáticas. Cada persona puede heredar esta regla, tener beca individual o pagar cuota como excepción.</p>
      <p className="text-sm text-muted-foreground">Se recalculan las cuotas consultadas de quienes heredan la regla, incluso períodos anteriores calculados por la app. No modifica pagos registrados. Revisá las excepciones antes de guardar.</p>
      <Button onClick={save} disabled={busy}>{busy?'Guardando…':'Guardar regla de becas'}</Button>
    </>}
    <p role="status" className="text-sm">{message}</p>
  </Card>;
}
