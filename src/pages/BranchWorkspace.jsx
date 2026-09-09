import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/api/supabaseClient';
import { readHealthQueue } from '@/services/access/healthDigitization';
import HealthDigitizationDialog from '@/features/health/HealthDigitizationDialog';

export default function BranchWorkspace() {
  const { user } = useAuth();
  const branches = user?.branch_scopes || [];
  const [selected,setSelected]=useState(null);
  const [onlyPending,setOnlyPending]=useState(false);
  const health=useQuery({queryKey:['health-queue',user?.tenant_id,user?.id,branches],queryFn:()=>readHealthQueue(supabase,user.tenant_id),retry:false});
  const query = useQuery({ queryKey: ['branch-people',user?.tenant_id,user?.id,branches], queryFn: async () => (await base44.entities.Beneficiario.list('nombre')).filter(person => branches.includes(person.rama)) });
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Mis ramas</h1><p className="text-muted-foreground">Personas y contactos de emergencia de las ramas asignadas a tu acceso.</p>
    <label className="flex min-h-11 gap-3 items-center"><input type="checkbox" checked={onlyPending} onChange={event=>setOnlyPending(event.target.checked)}/>Mostrar solo fichas pendientes de digitalizar</label>
    {health.isError&&<p role="alert">No pudimos consultar las digitalizaciones. <Button variant="outline" onClick={()=>health.refetch()}>Reintentar</Button></p>}
    {query.isPending ? <div className="h-40 animate-pulse bg-muted rounded" aria-label="Cargando personas"/> : query.isError ? <Card className="p-4"><p role="alert">No pudimos cargar tus ramas. Revisá la conexión o la asignación de tu acceso.</p><Button onClick={() => query.refetch()}>Reintentar</Button></Card> : !query.data.length ? <Card className="p-5">No hay personas disponibles. Pedile al administrador que revise tus ramas asignadas.</Card> :
    <div className="grid gap-4 md:grid-cols-2">{query.data.filter(person=>!onlyPending||(health.data||[]).some(item=>item.id===person.id&&!item.reviewed_at)).map(person => {const record=health.data?.find(item=>item.id===person.id);return <Card key={person.id} className="p-4 space-y-2"><h2 className="font-semibold">{person.nombre}</h2><p>{person.rama} · {person.activo === false ? 'Inactivo' : 'Activo'}</p><p className="text-sm">Contacto: {person.contacto_emergencia_nombre || 'Pendiente de completar'}</p><p className="text-sm">{person.contacto_emergencia_relacion || ''} {person.contacto_emergencia_telefono || ''}</p>{record&&<><p className="text-sm">{record.reviewed_at?'Ficha digitalizada y revisada':'Ficha pendiente de digitalizar'}</p><Button onClick={()=>setSelected(person)}>{record.reviewed_at?'Revisar ficha médica':'Digitalizar ficha médica'}</Button></>}</Card>;})}</div>}
    {onlyPending&&health.isSuccess&&!health.data.some(person=>branches.includes(person.rama)&&!person.reviewed_at)&&<p role="status">No quedan fichas pendientes. Desmarcá el filtro para ver todas las personas.</p>}
    {selected&&<HealthDigitizationDialog key={selected.id} open beneficiario={selected} onClose={()=>setSelected(null)}/>}
  </div>;
}
