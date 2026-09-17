import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { readGroupWorkspace,runGovernanceCommand } from '@/services/access/governance';
export function useGroupWorkspace(){
 const {user,refreshUser}=useAuth();const cache=useQueryClient();
 const query=useQuery({queryKey:['group-workspace',user?.tenant_id,user?.id,user?.tenant_roles],queryFn:()=>readGroupWorkspace(supabase,user.tenant_id),enabled:!!user?.tenant_id,retry:false,staleTime:15000});
 const run=async(command,input)=>{
 const result=await runGovernanceCommand(supabase,user.tenant_id,command,input);
 if(result.ok){await cache.invalidateQueries();if(['assignment','link'].includes(command))await refreshUser();}
 return result;
 };
 return {query,data:query.data,user,run};
}
