import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GovernanceContext } from '@/features/governance/CommandForm';
import { useGroupWorkspace } from '@/features/governance/useGroupWorkspace';
import TeamPanel from '@/features/governance/TeamPanel';
import PeoplePanel from '@/features/governance/PeoplePanel';
import CashPanel from '@/features/governance/CashPanel';
import PollsPanel from '@/features/governance/PollsPanel';
import ScholarshipsPanel from '@/features/governance/ScholarshipsPanel';
import ActivitiesPanel from '@/features/governance/ActivitiesPanel';
import FamilyHealthPanel from '@/features/governance/FamilyHealthPanel';
import AccountsPanel from '@/features/governance/AccountsPanel';

export default function GroupWorkspace(){
 const context=useGroupWorkspace();const {query,data,user}=context;const [tab,setTab]=useState('calendar');
 if(query.isPending)return <div className="h-64 animate-pulse rounded bg-muted" aria-label="Cargando tu grupo"/>;
 if(query.isError)return <section className="space-y-4 rounded border p-5"><h1 className="text-xl font-semibold">Mi grupo</h1><p role="alert">{query.error.message}</p><Button onClick={()=>query.refetch()}>Reintentar</Button></section>;
 const tabs=[['calendar','Calendario',ActivitiesPanel],['polls','Votaciones',PollsPanel]];
 if(data.manager||data.branch_manager||data.assignments.length||data.terms.length)tabs.push(['team','Equipo y mandatos',TeamPanel]);
 if(data.people.length&&(data.manager||data.assignments.some(a=>a.user_id===user.id)))tabs.push(['people','Personas y familias',PeoplePanel]);
 if(data.boxes.length||data.branch_manager||data.ledger)tabs.push(['cash','Cajas',CashPanel]);
 if(data.ledger)tabs.push(['scholarships','Becas',ScholarshipsPanel]);
 if(data.roles.some(r=>['family','youth'].includes(r)))tabs.push(['accounts','Mi cuenta',AccountsPanel]);
 if(data.roles.includes('family'))tabs.push(['health','Fichas de mis hijos',FamilyHealthPanel]);
 const active=tabs.find(([id])=>id===tab)||tabs[0];const Panel=active[2];
 return <GovernanceContext.Provider value={context}><div className="space-y-6"><header><h1 className="text-2xl font-extrabold">Mi grupo</h1><p className="text-muted-foreground">{user?.tenant?.name} · Herramientas según tus cargos y ramas.</p></header>
 <nav aria-label="Secciones de mi grupo" className="flex flex-wrap gap-2">{tabs.map(([id,label])=><Button key={id} variant={id===active[0]?'default':'outline'} className="min-h-11" onClick={()=>setTab(id)} aria-current={id===active[0]?'page':undefined}>{label}</Button>)}</nav>
 <Panel/>
 </div></GovernanceContext.Provider>;
}
