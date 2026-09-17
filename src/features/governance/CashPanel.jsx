import { BRANCHES,BRANCH_LABELS } from '@/services/access/governance';
import { formatMoney } from '@/lib/ramaUtils';
import CommandForm,{field,options,useGovernance} from './CommandForm';

export default function CashPanel(){
 const {data,user}=useGovernance();const treasury=data.roles.includes('treasury');
 const branches=(treasury||data.roles.includes('tenant_admin')?BRANCHES:data.assignments.filter(a=>a.user_id===user.id&&a.role==='branch_leader').map(a=>a.branch)).map(value=>({value,label:BRANCH_LABELS[value]}));
 const managed=data.boxes.filter(b=>b.can_manage);
 return <section className="space-y-5"><h2 className="text-xl font-semibold">Cajas de ramas y actividades</h2><p className="text-sm text-muted-foreground">Consultá los movimientos de las cajas habilitadas para tu perfil. Las transferencias se contabilizan cuando se reúnen todas las aprobaciones.</p>
 {(branches.length>0||treasury)&&<CommandForm title="Crear caja" command="cashCreate" fields={[field('name','Nombre de la caja'),field('branch','Rama (opcional para Tesorería)','select',branches),field('activity','Actividad, si corresponde')]}/>}
 {data.boxes.length===0&&<p>No hay cajas disponibles para tu perfil. Consultá al jefe de rama o a Tesorería.</p>}
 <div className="grid gap-4 sm:grid-cols-2">{data.boxes.map(b=><article className="rounded border bg-card p-4" key={b.id}><h3 className="font-semibold">{b.name}</h3><p>{BRANCH_LABELS[b.branch]||'Grupo'} {b.activity&&`· ${b.activity}`}</p><p className="text-xl font-semibold">{formatMoney(b.balance)}</p><details className="mt-3"><summary className="min-h-11 cursor-pointer">Ver movimientos</summary><ul className="space-y-2">{data.entries.filter(e=>e.box_id===b.id).map(e=><li key={e.id} className="border-t pt-2"><p>{e.description}</p><p>{formatMoney(e.amount)} · {new Date(e.created_at).toLocaleDateString('es-AR')}</p></li>)}</ul></details></article>)}</div>
 {managed.length>0&&<><CommandForm title="Registrar ingreso o egreso" command="cashEntry" fields={[field('box_id','Caja','select',options(managed)),field('amount','Importe: positivo ingreso, negativo egreso','number'),field('description','Concepto')]}/>
 <CommandForm title="Solicitar transferencia" command="cashTransfer" fields={[field('box_id','Caja de origen','select',options(managed)),field('destination_id','Caja de destino','select',options(data.cash_destinations)),field('amount','Importe','number'),field('description','Motivo')]}/></>}
 {data.transfers.map(t=><article key={t.id} className="space-y-3 rounded border p-4"><h3 className="font-semibold">{t.description} · {formatMoney(t.amount)}</h3><p>{t.status==='posted'?'Transferencia contabilizada':'Pendiente de aprobaciones'}</p><p className="text-sm">{data.cash_destinations.find(b=>b.id===t.source_id)?.name||'Caja de origen'} → {data.cash_destinations.find(b=>b.id===t.destination_id)?.name||'Caja de destino'}</p>
 {t.status==='pending'&&<div className="grid gap-2 sm:grid-cols-3">{[[treasury,'treasury','Tesorería'],[t.can_source,'source','Jefe de origen'],[t.can_destination,'destination','Jefe de destino']].filter(([allowed,key])=>allowed&&!t.approvals[key]).map(([,key,label])=><CommandForm key={key} command="cashApprove" fixed={{id:t.id,as:key}} submitLabel={`Aprobar como ${label}`}/>)}</div>}</article>)}
 </section>;
}
