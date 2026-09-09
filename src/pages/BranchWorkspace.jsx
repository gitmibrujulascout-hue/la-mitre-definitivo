import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BranchWorkspace() {
  const { user } = useAuth();
  const branches = user?.branch_scopes || [];
  const query = useQuery({ queryKey: ['branch-people',user?.tenant_id,user?.id,branches], queryFn: async () => (await base44.entities.Beneficiario.list('nombre')).filter(person => branches.includes(person.rama)) });
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Mis ramas</h1><p className="text-muted-foreground">Personas y contactos de emergencia de las ramas asignadas a tu acceso.</p>
    {query.isPending ? <div className="h-40 animate-pulse bg-muted rounded" aria-label="Cargando personas"/> : query.isError ? <Card className="p-4"><p role="alert">No pudimos cargar tus ramas. Revisá la conexión o la asignación de tu acceso.</p><Button onClick={() => query.refetch()}>Reintentar</Button></Card> : !query.data.length ? <Card className="p-5">No hay personas disponibles. Pedile al administrador que revise tus ramas asignadas.</Card> :
    <div className="grid gap-4 md:grid-cols-2">{query.data.map(person => <Card key={person.id} className="p-4 space-y-2"><h2 className="font-semibold">{person.nombre}</h2><p>{person.rama} · {person.activo === false ? 'Inactivo' : 'Activo'}</p><p className="text-sm">Contacto: {person.contacto_emergencia_nombre || 'Pendiente de completar'}</p><p className="text-sm">{person.contacto_emergencia_relacion || ''} {person.contacto_emergencia_telefono || ''}</p></Card>)}</div>}
  </div>;
}
