import { BRANCHES,BRANCH_LABELS } from '@/services/access/governance';
import CommandForm,{field,options,useGovernance} from './CommandForm';
export default function ActivitiesPanel(){
 const {data,user}=useGovernance();
 const branches=(data.manager?BRANCHES:data.assignments.filter(a=>a.user_id===user.id).map(a=>a.branch)).map(value=>({value,label:BRANCH_LABELS[value]}));
 const led=data.assignments.filter(a=>a.user_id===user.id&&a.role==='branch_leader').map(a=>a.branch);
 return <section className="space-y-5"><h2 className="text-xl font-semibold">Calendario y tareas</h2>
 {branches.length>0&&<CommandForm title="Agregar actividad de rama" command="activity" fields={[field('branch','Rama','select',branches),field('name','Actividad'),field('date','Fecha','date'),field('description','Descripción','textarea'),field('location','Lugar')]}/>}
 {!data.activities.length&&<p>No hay actividades publicadas. Revisá nuevamente cuando tu equipo actualice el calendario.</p>}
 <ul className="space-y-3">{data.activities.map(a=><li className="rounded border p-4" key={a.id}><p className="font-semibold">{a.name} · {a.date}</p><p>{a.description}</p><p>{a.location}</p></li>)}</ul>
 {led.length>0&&<CommandForm title="Asignar tarea al equipo" command="task" fields={[field('branch','Rama','select',led.map(value=>({value,label:BRANCH_LABELS[value]}))),field('title','Tarea'),field('assigned_to','Subjefe o ayudante','select',options(data.members.filter(m=>data.assignments.some(a=>a.user_id===m.user_id&&led.includes(a.branch)&&a.role!=='branch_leader'))))]}/>}
 {data.tasks.map(task=><CommandForm key={`${task.id}-${task.done}`} title={task.title} command="taskDone" fixed={{id:task.id,done:!task.done}} submitLabel={task.done?'Marcar pendiente':'Marcar realizada'}/>)}
 </section>;
}
