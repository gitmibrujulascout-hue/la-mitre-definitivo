import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { readHealthQueue } from '@/services/access/healthDigitization';
import { hasPermission, PERMISSIONS } from '@/services/access/permissions';

export default function HealthDigitizationReminder(){
  const {user}=useAuth();const branches=user?.branch_scopes||[];
  const enabled=Boolean(user?.tenant_id&&branches.length&&hasPermission(user,PERMISSIONS.healthDigitize));
  const query=useQuery({queryKey:['health-queue',user?.tenant_id,user?.id,branches],queryFn:()=>readHealthQueue(supabase,user.tenant_id),enabled,refetchOnMount:'always',refetchOnWindowFocus:'always',refetchInterval:60000,retry:false});
  if(!enabled)return null;
  if(query.isPending)return <div className="mb-4 p-3 rounded bg-muted animate-pulse" aria-label="Consultando fichas pendientes"/>;
  if(query.isError)return <div role="alert" className="mb-4 rounded border p-3 text-sm">No pudimos consultar las fichas pendientes. <button className="min-h-11 underline" onClick={()=>query.refetch()}>Reintentar</button></div>;
  const pending=query.data.filter(person=>branches.includes(person.rama)&&!person.reviewed_at).length;
  if(!pending)return null;
  return <div role="status" className="mb-4 rounded border border-ember/30 bg-ember-soft p-4 text-forest-deep"><p className="font-semibold">Tenés {pending} ficha{pending!==1?'s':''} médica{pending!==1?'s':''} pendiente{pending!==1?'s':''} de digitalizar en tus ramas.</p><Link className="inline-flex min-h-11 items-center underline" to="/mi-rama">Revisar fichas pendientes</Link></div>;
}
