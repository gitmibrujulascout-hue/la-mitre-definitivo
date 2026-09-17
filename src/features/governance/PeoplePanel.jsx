import { useState } from 'react';
import { BRANCHES,BRANCH_LABELS,familySuggestions } from '@/services/access/governance';
import CommandForm,{field,options,useGovernance} from './CommandForm';
import ReceiveMemberForm from './ReceiveMemberForm';

export default function PeoplePanel(){
 const {data,user}=useGovernance();const [search,setSearch]=useState('');const [account,setAccount]=useState('');const [person,setPerson]=useState('');
 const selected=data.people.find(p=>p.id===person);
 const visible=data.people.filter(p=>String(p.name).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
 const suggestions=familySuggestions(data.members.find(m=>m.user_id===account)?.name||'',data.people);
 const branchOptions=BRANCHES.map(value=>({value,label:BRANCH_LABELS[value]}));
 const led=data.assignments.filter(a=>a.user_id===user.id&&a.role==='branch_leader').map(a=>a.branch);
 const linkPeople=data.people.filter(p=>data.manager||led.includes(p.branch));
 return <section className="space-y-5"><h2 className="text-xl font-semibold">Personas y familias</h2>
 <label className="block">Buscar por nombre o apellido<input className="mt-1 min-h-11 w-full rounded border bg-background px-3" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <label className="block">Seleccionar integrante<select className="mt-1 min-h-11 w-full rounded border bg-background px-3" value={person} onChange={e=>setPerson(e.target.value)}><option value="">Elegir</option>{visible.map(p=><option key={p.id} value={p.id}>{p.name} · {p.branch} {p.active===false?'· Inactivo':''}</option>)}</select></label>
 {!visible.length&&<p>No se encontraron personas. Revisá la búsqueda o las ramas asignadas.</p>}
 <ReceiveMemberForm/>
 {selected&&<div className="space-y-3"><p className="font-semibold">{selected.name} · {selected.active===false?'Inactivo':'Activo'}</p>
 {selected.can_edit&&<CommandForm key={selected.id} title="Datos personales" command="person" fixed={{member:selected.id}} initial={{name:selected.name||'',phone:selected.phone||'',email:selected.email||'',family:selected.family||''}} fields={[field('name','Nombre completo'),field('phone','Teléfono'),field('email','Email','email'),field('family','Grupo familiar')]}/>}
 {selected.can_inactivate&&<CommandForm title={selected.active===false?'Reactivar integrante':'Dar de baja del grupo'} command="memberStatus" fixed={{member:selected.id,active:selected.active===false}} fields={[field('date','Fecha efectiva','date')]} submitLabel={selected.active===false?'Confirmar reactivación':'Confirmar inactividad'}/>}
 {selected.can_transfer&&<CommandForm title="Cambiar de rama" command="memberBranch" fixed={{member:selected.id}} fields={[field('branch','Rama de destino','select',branchOptions)]}/>}
 </div>}
 {(data.manager||data.branch_manager)&&<><h3 className="font-semibold">Vincular cuentas sin duplicar personas</h3><p className="text-sm">Las coincidencias de apellido son sugerencias. Verificá el parentesco antes de habilitar el acceso.</p>
 <CommandForm title="Invitar a un responsable familiar" command="parentInvite" fields={[field('member','Hijo o hija','select',options(linkPeople)),field('name','Nombre del adulto'),field('email','Email del adulto','email')]} submitLabel="Crear invitación familiar"/>
 <label className="block">Cuenta para buscar coincidencias<select className="mt-1 min-h-11 w-full rounded border bg-background px-3" value={account} onChange={e=>setAccount(e.target.value)}><option value="">Elegir cuenta existente</option>{data.members.map(m=><option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></label>
 {account&&<p className="text-sm">Coincidencias posibles: {suggestions.map(p=>p.name).join(', ')||'Sin coincidencias; usá la selección manual.'}</p>}
 <CommandForm key={account} title="Confirmar vínculo familiar o cuenta juvenil" command="link" initial={{user:account}} fixed={{enabled:true}} fields={[field('user','Cuenta','select',options(data.members)),field('member','Integrante','select',options(linkPeople)),field('kind','Tipo de vínculo','select',[{value:'family',label:'Padre, madre o responsable familiar'},{value:'youth',label:'Cuenta propia de Caminante o Rover'}])]}/>
 {data.links.map(l=><CommandForm key={`${l.user_id}-${l.member_id}-${l.kind}`} title={`${data.members.find(m=>m.user_id===l.user_id)?.name||'Cuenta'} → ${data.people.find(p=>p.id===l.member_id)?.name||'Integrante'} (${l.kind==='family'?'Familia':'Cuenta juvenil'})`} command="link" fixed={{user:l.user_id,member:l.member_id,kind:l.kind,enabled:false}} submitLabel="Revocar este vínculo"/>)}
 </>}
 </section>;
}
