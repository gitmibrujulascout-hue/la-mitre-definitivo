import { BRANCHES,BRANCH_LABELS } from '@/services/access/governance';
import CommandForm,{field,options,useGovernance} from './CommandForm';
export default function ScholarshipsPanel(){
 const {data}=useGovernance();
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
 return <section className="space-y-5"><h2 className="text-xl font-semibold">Becas por período</h2><p>Elegí una persona o una rama completa. La beca individual reemplaza la de rama. Las afiliaciones no se becan.</p>
 <CommandForm title="Registrar beca" command="scholarship" initial={{concept:'fee'}} fields={[field('member_id','Persona (dejar vacío para becar una rama)','select',options(data.people)),field('branch','Rama completa (dejar vacío para beca individual)','select',BRANCHES.map(value=>({value,label:BRANCH_LABELS[value]}))),field('percentage','Porcentaje de beca','number'),field('starts_on','Desde','date'),field('ends_on','Hasta','date'),field('concept','Concepto','select',[{value:'fee',label:'Cuotas'},{value:'camp',label:'Campamento'},{value:'activity',label:'Actividad especial'}]),field('activity_id','Campamento o actividad, si corresponde','select',options(data.special_activities))]}/>
 {data.scholarships.length===0&&<p>No hay becas por período. La regla Rover no se activa automáticamente.</p>}
 {data.scholarships.map(s=><article className="space-y-3 rounded border p-4" key={s.id}><h3 className="font-semibold">{s.member_id?data.people.find(p=>p.id===s.member_id)?.name:BRANCH_LABELS[s.branch]} · {s.percentage}%</h3><p>{s.starts_on} a {s.ends_on} · {s.concept==='fee'?'Cuotas':s.concept==='camp'?'Campamento':'Actividad'}</p><p>{s.concept==='fee'||(s.approvals.treasury&&s.approvals.group_leadership)?'Aprobada':'Pendiente de aprobación conjunta'}</p>
 {s.concept!=='fee'&&['treasury','group_leadership'].filter(role=>data.roles.includes(role)&&!s.approvals[role]).map(role=><CommandForm key={role} command="scholarshipApprove" fixed={{id:s.id,as:role}} submitLabel={`Aprobar como ${role==='treasury'?'Tesorería':'Jefatura de grupo'}`}/>)}
 {s.ends_on>=today&&<details><summary className="min-h-11 cursor-pointer py-2 focus-ring">Editar esta beca</summary><p className="mb-3 text-sm text-muted-foreground">Se conserva el período anterior al cambio. Un 0% deja de becar desde la fecha elegida. Los campamentos y actividades requieren nuevas aprobaciones.</p><CommandForm command="scholarshipRevise" fixed={{id:s.id}} initial={{percentage:String(s.percentage),starts_on:s.starts_on>today?s.starts_on:today,ends_on:s.ends_on}} fields={[field('percentage','Nuevo porcentaje','number'),field('starts_on','Aplicar desde','date'),field('ends_on','Hasta','date')]} submitLabel="Guardar cambio de beca"/></details>}
 </article>)}
 </section>;
}
