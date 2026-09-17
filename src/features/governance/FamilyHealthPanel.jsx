import { SALUD_FIELDS } from '@/lib/saludFields';
import CommandForm,{useGovernance} from './CommandForm';
export default function FamilyHealthPanel(){
 const {data}=useGovernance();
 return <section className="space-y-5"><h2 className="text-xl font-semibold">Revisar fichas de mis hijos</h2><p>Podés confirmar los datos o informar un error. Si la información de la ficha original cambió, entregá una nueva ficha corregida al jefe de rama.</p>
 {!data.health.length&&<p>No tenés hijos vinculados. Pedile al administrador o al jefe de rama que verifique el vínculo.</p>}
 {data.health.map(h=><article className="space-y-3 rounded border p-4" key={h.id}><h3 className="font-semibold">{h.name}</h3>{!h.revision?<p>La digitalización todavía está pendiente.</p>:<><dl className="grid gap-3 sm:grid-cols-2">{Object.entries(h.health||{}).filter(([,v])=>v!==null&&v!=='').map(([key,value])=><div key={key}><dt className="font-semibold">{SALUD_FIELDS.find(f=>f.key===key)?.label||key.replaceAll('_',' ')}</dt><dd className="break-words">{String(value)}</dd></div>)}</dl><p>{h.review==='confirmed'?'Confirmaste esta versión.':h.review==='error'?'Error informado al jefe de rama.':'Tenés una ficha digitalizada pendiente de revisar.'}</p>
 <div className="grid gap-3 sm:grid-cols-2"><CommandForm command="health" fixed={{member:h.id,revision:h.revision,result:'confirmed'}} submitLabel="Confirmo que los datos coinciden"/><CommandForm command="health" fixed={{member:h.id,revision:h.revision,result:'error'}} submitLabel="Encontré un error"/></div></>}</article>)}
 </section>;
}
