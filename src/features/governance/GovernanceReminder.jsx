import { Link } from 'react-router-dom';
import { useGroupWorkspace } from './useGroupWorkspace';
export default function GovernanceReminder(){
 const {data}=useGroupWorkspace();if(!data)return null;
 const today=new Date().toISOString().slice(0,10);
 const terms=data.terms.filter(t=>!t.ends_on||t.ends_on<=today);
 const health=data.health.filter(h=>h.revision&&!h.review);
 if(!terms.length&&!health.length&&!data.health_errors.length)return null;
 return <aside role="status" className="mb-5 space-y-2 rounded border border-primary/40 bg-card p-4">
 {terms.length>0&&<p>{terms.length} mandato(s) requieren cargar vencimiento, renovar o registrar una prórroga. Los accesos siguen activos.</p>}
 {health.length>0&&<p>Tenés {health.length} ficha(s) médica(s) de tus hijos pendiente(s) de revisar.</p>}
 {data.health_errors.length>0&&<p>Una familia informó un error de digitalización. Revisá la ficha de {data.health_errors.map(h=>h.name).join(', ')} en Mis ramas.</p>}
 <Link to="/mi-grupo" className="inline-flex min-h-11 items-center underline">Revisar pendientes en Mi grupo</Link></aside>;
}
