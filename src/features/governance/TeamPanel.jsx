import { Link } from 'react-router-dom';
import { BRANCHES, BRANCH_LABELS } from '@/services/access/governance';
import { roleLabel } from '@/services/access/permissions';
import CommandForm,{field,options,useGovernance} from './CommandForm';

export default function TeamPanel(){
 const {data,user}=useGovernance();
 const branches=(data.manager?BRANCHES:data.assignments.filter(a=>a.user_id===user.id&&a.role==='branch_leader').map(a=>a.branch)).map(value=>({value,label:BRANCH_LABELS[value]}));
 const adults=options(data.members.filter(m=>!m.roles.includes('youth')));
 const scopeRoles=[{value:'branch_deputy',label:'Subjefe de rama'},{value:'branch_assistant',label:'Ayudante de rama'},{value:'remove',label:'Quitar asignación en esta rama'}];
 if(data.manager)scopeRoles.unshift({value:'branch_leader',label:'Jefe de rama'});
 return <section className="space-y-5">
 <h2 className="text-xl font-semibold">Equipo y mandatos</h2>
 {data.manager&&<><Link className="inline-block min-h-11 underline" to="/usuarios">Invitar personas y asignar cargos del grupo o asociación</Link><CommandForm title="Asociación civil del grupo" command="association" initial={{enabled:data.association_enabled}} fields={[field('enabled','El grupo tiene asociación civil','checkbox')]}/>{!data.association_enabled&&<p className="text-sm text-muted-foreground">Podés solicitar asesoramiento al equipo de Brújula para organizar una asociación civil.</p>}</>}
 {(data.manager||data.branch_manager)&&<CommandForm title="Nombrar o actualizar equipo de rama" command="assignment" fields={[field('user','Adulto que ya pertenece al grupo','select',adults),field('branch','Rama','select',branches),field('role','Cargo','select',scopeRoles),field('capabilities','Permisos delegados a subjefe o ayudante','checks',[{value:'edit',label:'Editar datos personales'},{value:'inactivate',label:'Inactivar y reactivar integrantes'},{value:'transfer',label:'Cambiar de rama'}])]}/>}
 <div className="grid gap-3 sm:grid-cols-2">{data.assignments.map(a=><article className="rounded border p-4" key={`${a.user_id}-${a.branch}`}><p className="font-semibold">{data.members.find(m=>m.user_id===a.user_id)?.name||'Mi asignación'}</p><p>{roleLabel(a.role)} · {BRANCH_LABELS[a.branch]}</p><p className="text-sm">{a.role==='branch_leader'?'Responsable de la rama':a.capabilities.length?'Permisos adicionales delegados':'Consulta y actividades'}</p></article>)}</div>
 {!data.assignments.length&&<p>No hay asignaciones de rama. Un administrador puede nombrar al responsable.</p>}
 {data.terms.map(t=><article className="space-y-2 rounded border p-4" key={`${t.user_id}-${t.role}`}><h3 className="font-semibold">{t.name} · {roleLabel(t.role)}</h3><p>{t.ends_on?`Vencimiento: ${t.ends_on}`:'Pendiente: cargar fecha de vencimiento'}</p>{t.extension_reason&&<p>Prórroga: {t.extension_reason}</p>}{data.manager&&<CommandForm title="Registrar mandato o prórroga" command="term" fixed={{user:t.user_id,role:t.role}} fields={[field('end','Vencimiento','date'),field('reason','Motivo, obligatorio para extender')]} initial={{end:t.ends_on||'',reason:''}}/>}</article>)}
 </section>;
}
