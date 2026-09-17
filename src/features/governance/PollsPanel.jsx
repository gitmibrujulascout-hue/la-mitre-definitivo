import CommandForm,{field,options,useGovernance} from './CommandForm';
export default function PollsPanel(){
 const {data}=useGovernance();
 return <section className="space-y-5"><h2 className="text-xl font-semibold">Asambleas y votaciones</h2><p>Voto secreto, uno por persona. Los resultados se muestran cuando cierra la votación.</p>
 {data.roles.includes('group_leadership')&&<CommandForm title="Crear votación" command="poll" submitLabel="Crear votación secreta" fields={[field('title','Tema'),field('closes','Fecha y hora de cierre','datetime-local'),field('options','Opciones, una por línea','textarea'),field('electors','Personas habilitadas para esta votación','checks',options(data.members))]}/>}
 {data.polls.length===0&&<p>No hay votaciones habilitadas para vos. La jefatura del grupo define quién participa en cada una.</p>}
 {data.polls.map(p=><article key={p.id} className="rounded border bg-card p-4 space-y-3"><h3 className="font-semibold">{p.title}</h3><p>Cierre: {new Date(p.closes_at).toLocaleString('es-AR')}</p>
 {p.totals?<ul>{p.totals.map(row=><li key={row.option}>{p.options[row.option]}: {row.votes} votos</li>)}</ul>:p.voted?<p role="status">Tu voto ya fue registrado.</p>:p.eligible?<CommandForm command="vote" fixed={{poll:p.id}} fields={[field('choice','Tu voto','select',p.options.map((label,index)=>({value:String(index),label})))]} submitLabel="Confirmar voto secreto"/>:<p>No estás incluido en el padrón de esta votación.</p>}
 </article>)}
 </section>;
}
