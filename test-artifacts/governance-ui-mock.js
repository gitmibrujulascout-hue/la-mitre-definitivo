const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const params=new URLSearchParams(location.search);const role=params.get('role')||'admin';
const roles=role==='admin'?['tenant_admin','group_leadership','treasury','branch_leader','family']:role==='youth'?['youth']:role==='family'?['family']:['branch_assistant'];
const user={id:id(11),tenant_id:id(1),tenant_roles:roles,tenant:{name:'Grupo de prueba'},branch_scopes:['Rovers']};
const manager=role==='admin';
const state={tenant_id:id(1),roles,manager,branch_manager:manager,ledger:manager,association_enabled:true,
 members:[{user_id:id(11),name:'Persona adulta de prueba',roles},{user_id:id(12),name:'Ayudante de prueba',roles:['branch_assistant']}],
 assignments:manager?[{user_id:id(11),branch:'Rovers',role:'branch_leader',capabilities:[]}]:[],
 terms:manager?[{user_id:id(11),name:'Persona adulta de prueba',role:'group_leadership',ends_on:null}]:[],
 people:manager?[{id:id(21),name:'Integrante de prueba',branch:'Rovers',active:true,can_edit:true,can_inactivate:true,can_transfer:true,phone:'',email:'',family:'Familia de prueba'}]:[],
 links:[],health:roles.includes('family')?[{id:id(21),name:'Integrante de prueba',revision:'2026-09-16T12:00:00+00:00',health:{alergias:'Dato ficticio',contacto_emergencia_nombre:'Contacto de prueba'},review:null}]:[],health_errors:[],
 boxes:role==='family'?[]:[{id:id(31),name:'Caja Rover',branch:'Rovers',balance:100,can_manage:manager}],
 entries:[{id:id(32),box_id:id(31),amount:100,description:'Ingreso de prueba',created_at:'2026-09-16T12:00:00Z'}],cash_destinations:[{id:id(31),name:'Caja Rover',branch:'Rovers'}],transfers:[],
 polls:[{id:id(41),title:'Votación de prueba',options:['Opción A','Opción B'],closes_at:'2099-01-01T00:00:00Z',voted:false,eligible:true,totals:null}],
 activities:[],tasks:[],scholarships:[],special_activities:[],accounts:[{id:id(21),name:'Integrante de prueba',branch:'Rovers',credit:0,payments:[],affiliations:[]}]};
export const useAuth=()=>({user,refreshUser:async()=>{}});
export const AuthProvider=({children})=>children;
export const supabase={rpc:async(name,args)=>{
 if(params.has('error'))return {error:{message:'simulated failure'}};
 if(name==='get_group_workspace')return {data:structuredClone(state)};
 if(name==='cast_group_vote')state.polls[0].voted=true;
 if(name==='review_family_health')state.health[0].review=args.result;
 return {data:null,error:null};
}};
