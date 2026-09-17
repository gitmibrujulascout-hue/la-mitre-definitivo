import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/api/supabaseClient';
import {findTransferCandidates,BRANCHES,BRANCH_LABELS} from '@/services/access/governance';
import CommandForm,{field,options,useGovernance} from './CommandForm';
export default function ReceiveMemberForm(){
 const {data,user}=useGovernance();const [search,setSearch]=useState('');
 const branches=data.manager?BRANCHES:data.assignments.filter(a=>a.user_id===user.id&&(a.role==='branch_leader'||a.capabilities.includes('transfer'))).map(a=>a.branch);
 const query=useQuery({queryKey:['transfer-candidates',user.tenant_id,user.id,search],queryFn:()=>findTransferCandidates(supabase,user.tenant_id,search),enabled:branches.length>0&&search.trim().length>=3,retry:false});
 if(!branches.length)return null;
 return <div className="space-y-3"><h3 className="font-semibold">Recibir a un integrante de otra rama</h3><label className="block text-sm">Buscar por nombre (al menos 3 letras)<input className="mt-1 min-h-11 w-full rounded border bg-background p-2" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 {query.isFetching&&<p role="status">Buscando…</p>}{query.isError&&<p role="alert">No pudimos buscar. <button className="min-h-11 underline" onClick={()=>query.refetch()}>Reintentar</button></p>}
 {query.isSuccess&&!query.data.length&&<p>No encontramos coincidencias. Probá con otro nombre.</p>}
 {!!query.data?.length&&<CommandForm command="memberBranch" fields={[field('member','Integrante','select',options(query.data)),field('branch','Rama que recibe','select',branches.map(value=>({value,label:BRANCH_LABELS[value]})))]} submitLabel="Confirmar pase a mi rama"/>}
 </div>;
}
