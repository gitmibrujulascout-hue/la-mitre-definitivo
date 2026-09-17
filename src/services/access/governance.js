import { z } from 'zod';

export const BRANCHES = ['Lobatos','Tropa','KM','Rovers'];
export const BRANCH_LABELS = {Lobatos:'Manada / Lobatos',Tropa:'Unidad / Tropa',KM:'Caminantes',Rovers:'Rover'};
const uuid=z.string().uuid();
const text=z.string().trim().min(3,'Completá al menos 3 caracteres.').max(200);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Elegí una fecha válida.').refine(value=>!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'La fecha no existe.');
const optionalId=z.union([uuid,z.literal('')]).optional();
const requiredNumber=schema=>z.preprocess(value=>typeof value==='string'&&value.trim()===''?undefined:value,schema);
const jsonRow=z.object({}).passthrough();
const snapshotSchema=z.object({tenant_id:uuid,roles:z.array(z.string()),manager:z.boolean(),branch_manager:z.boolean(),ledger:z.boolean(),association_enabled:z.boolean(),
 members:z.array(z.object({user_id:uuid,name:z.string(),roles:z.array(z.string())})),
 assignments:z.array(z.object({user_id:uuid,branch:z.enum(BRANCHES),role:z.string(),capabilities:z.array(z.string())}).passthrough()),
 people:z.array(z.object({id:uuid,name:z.string().nullable(),branch:z.string().nullable(),active:z.boolean().nullable(),can_edit:z.boolean(),can_inactivate:z.boolean(),can_transfer:z.boolean()}).passthrough()),
 boxes:z.array(z.object({id:uuid,name:z.string(),branch:z.string().nullable(),balance:z.coerce.number(),can_manage:z.boolean()}).passthrough()),
 polls:z.array(z.object({id:uuid,title:z.string(),options:z.array(z.string()),closes_at:z.string(),voted:z.boolean().nullable(),eligible:z.boolean(),totals:z.array(z.object({option:z.number(),votes:z.number()})).nullable()})),
 terms:z.array(jsonRow),links:z.array(jsonRow),health:z.array(jsonRow),health_errors:z.array(jsonRow),entries:z.array(jsonRow),transfers:z.array(jsonRow),cash_destinations:z.array(jsonRow),activities:z.array(jsonRow),tasks:z.array(jsonRow),scholarships:z.array(jsonRow),special_activities:z.array(jsonRow),accounts:z.array(jsonRow)});

export const commandSchemas={
 parentInvite:z.object({member:uuid,name:text,email:z.string().email('Ingresá un email válido.')}),
 assignment:z.object({user:uuid,branch:z.enum(BRANCHES),role:z.enum(['branch_leader','branch_deputy','branch_assistant','remove']),capabilities:z.array(z.enum(['edit','inactivate','transfer'])).default([])}),
 association:z.object({enabled:z.boolean()}),
 term:z.object({user:uuid,role:z.string().min(1),end:date,reason:z.string().max(500).default('')}),
 link:z.object({user:uuid,member:uuid,kind:z.enum(['family','youth']),enabled:z.boolean().default(true)}),
 health:z.object({member:uuid,revision:z.string().datetime({offset:true}),result:z.enum(['confirmed','error'])}),
 cashCreate:z.object({name:text,branch:z.enum([...BRANCHES,'']),activity:z.string().max(100).default('')}),
 cashEntry:z.object({box_id:uuid,amount:requiredNumber(z.coerce.number().finite().refine(n=>n!==0,'El importe no puede ser cero.')),description:text}),
 cashTransfer:z.object({box_id:uuid,destination_id:uuid,amount:requiredNumber(z.coerce.number().finite().positive()),description:text}).refine(v=>v.box_id!==v.destination_id,{path:['destination_id'],message:'Elegí otra caja.'}),
 cashApprove:z.object({id:uuid,as:z.enum(['treasury','source','destination'])}),
 poll:z.object({title:text,options:z.string().transform(v=>v.split('\n').map(x=>x.trim()).filter(Boolean)).pipe(z.array(z.string().max(100)).min(2,'Ingresá al menos dos opciones, una por línea.').max(10)),closes:z.string().min(1).refine(v=>Date.parse(v)>Date.now(),'El cierre debe ser futuro.'),electors:z.array(uuid).min(1,'Seleccioná al menos una persona.')}),
 vote:z.object({poll:uuid,choice:requiredNumber(z.coerce.number().int().min(0))}),
 scholarship:z.object({member_id:optionalId,branch:z.enum([...BRANCHES,'']),percentage:requiredNumber(z.coerce.number().min(0).max(100)),starts_on:date,ends_on:date,concept:z.enum(['fee','camp','activity']),activity_id:optionalId}).refine(v=>Boolean(v.member_id)!==Boolean(v.branch),{path:['member_id'],message:'Elegí una persona o una rama completa.'}).refine(v=>v.ends_on>=v.starts_on,{path:['ends_on'],message:'El fin debe ser igual o posterior al inicio.'}).refine(v=>v.concept==='fee'||Boolean(v.activity_id),{path:['activity_id'],message:'Elegí la actividad o campamento.'}),
 scholarshipApprove:z.object({id:uuid,as:z.enum(['treasury','group_leadership'])}),
 scholarshipRevise:z.object({id:uuid,percentage:requiredNumber(z.coerce.number().min(0).max(100)),starts_on:date,ends_on:date}).refine(v=>v.ends_on>=v.starts_on,{path:['ends_on'],message:'El fin debe ser igual o posterior al inicio.'}),
 person:z.object({member:uuid,name:text,phone:z.string().max(80),email:z.union([z.string().email(),z.literal('')]),family:z.string().max(100)}),
 memberStatus:z.object({member:uuid,active:z.boolean(),date:date}),
 memberBranch:z.object({member:uuid,branch:z.enum(BRANCHES)}),
 activity:z.object({branch:z.enum(BRANCHES),name:text,date,description:z.string().max(2000),location:z.string().max(200)}),
 task:z.object({branch:z.enum(BRANCHES),title:text,assigned_to:uuid}),
 taskDone:z.object({id:uuid,done:z.boolean()})
};
const RPC={
 parentInvite:v=>['invite_member_parent',{target_member_id:v.member,parent_name:v.name,parent_email:v.email}],
 assignment:v=>['save_branch_assignment',{target_user_id:v.user,target_branch:v.branch,target_role:v.role,target_capabilities:v.capabilities}],
 association:v=>['save_governance_setting',{enabled:v.enabled}],
 term:v=>['save_role_term',{target_user_id:v.user,target_role:v.role,target_end:v.end,reason:v.reason}],
 link:v=>['set_person_account',{target_user_id:v.user,target_member_id:v.member,kind:v.kind,enabled:v.enabled}],
 health:v=>['review_family_health',{target_member_id:v.member,target_revision:v.revision,result:v.result}],
 cashCreate:v=>['manage_branch_cash',{command:'create',payload:v}],cashEntry:v=>['manage_branch_cash',{command:'entry',payload:v}],cashTransfer:v=>['manage_branch_cash',{command:'transfer',payload:v}],cashApprove:v=>['manage_branch_cash',{command:'approve',payload:v}],
 poll:v=>['create_group_poll',{title:v.title,options:v.options,closes_at:new Date(v.closes).toISOString(),electors:v.electors}],
 vote:v=>['cast_group_vote',{target_poll_id:v.poll,choice:v.choice}],
 scholarship:v=>['save_period_scholarship',{payload:v}],scholarshipApprove:v=>['save_period_scholarship',{payload:v}],
 scholarshipRevise:v=>['revise_period_scholarship',{payload:v}],
 person:v=>['update_branch_person',{target_member_id:v.member,patch:{nombre:v.name,telefono_contacto:v.phone,email_contacto:v.email,grupo_familiar:v.family}}],
 memberStatus:v=>['update_branch_person',{target_member_id:v.member,patch:{activo:v.active,effective_date:v.date}}],
 memberBranch:v=>['update_branch_person',{target_member_id:v.member,patch:{rama:v.branch}}],
 activity:v=>['save_branch_activity',{payload:v}],task:v=>['save_branch_task',{payload:v}],taskDone:v=>['save_branch_task',{payload:v}]
};
const errorMessages={
 '23505':'Ya existe un jefe para esa rama o la persona ya dirige otra. Revisá las asignaciones.',
 OVERLAPPING_PERIOD:'Ya existe una beca para ese período. Elegí un período que no se superponga.',
 INVALID_SCHOLARSHIP_REVISION:'El cambio debe comenzar hoy o después, dentro del período de la beca. Las fechas pasadas se conservan.',
 EXTENSION_REASON_REQUIRED:'Escribí el motivo de la prórroga.',
 INSUFFICIENT_BALANCE:'La caja de origen no tiene saldo suficiente. Revisá los movimientos.',
 HEALTH_CHANGED:'La ficha cambió. Actualizá la pantalla y revisá la versión nueva.',
 ACCESS_DENIED:'No tenés permiso para esta acción. Revisá tu cargo y la rama asignada.',
 VOTE_NOT_AVAILABLE:'La votación cerró, ya votaste o no estás habilitado. Actualizá la pantalla.',
 ASSOCIATION_HAS_OFFICERS:'Primero quitá los cargos de la asociación para poder desactivarla.',
 EXISTING_ADULT_REQUIRED:'Seleccioná una cuenta adulta activa que ya pertenezca al grupo.'
};
export async function readGroupWorkspace(client,tenant){
 uuid.parse(tenant);
 const {data,error}=await client.rpc('get_group_workspace',{target_tenant_id:tenant});
 if(error)throw new Error('No pudimos cargar el espacio del grupo. Reintentá; si persiste, pedile al administrador que revise la actualización.');
 const parsed=snapshotSchema.safeParse(data);
 if(!parsed.success||parsed.data.tenant_id!==tenant)throw new Error('No pudimos verificar los datos del grupo. Reintentá.');
 return parsed.data;
}
export async function runGovernanceCommand(client,tenant,command,input){
 uuid.parse(tenant);
 if(!commandSchemas[command])throw new Error('Acción no disponible.');
 const parsed=commandSchemas[command].safeParse(input);
 if(!parsed.success)return {ok:false,errors:Object.fromEntries(parsed.error.issues.map(e=>[e.path[0],/^(Invalid|Expected|Required|Number|String|Array)/.test(e.message)?'Completá un valor válido.':e.message]))};
 const [name,args]=RPC[command](parsed.data);
 try{
 const {data,error}=await client.rpc(name,{target_tenant_id:tenant,...args});
 if(error){const match=Object.keys(errorMessages).find(k=>error.code===k||String(error.message).includes(k));return {ok:false,message:errorMessages[match]||'No pudimos guardar. Revisá los datos y volvé a intentar.'};}
 if(command==='parentInvite'){
 const token=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).safeParse(data);
 if(!token.success)return {ok:false,message:'No pudimos verificar el enlace de invitación.'};
 return {ok:true,invitationPath:`/aceptar-invitacion?token=${token.data.token}`};
 }
 return {ok:true};
 }catch{return {ok:false,message:'No pudimos conectar. Revisá la conexión y reintentá.'};}
}
export function familySuggestions(name,people){
 const words=String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/\s+/).filter(w=>w.length>2);
 return people.filter(p=>String(p.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/\s+/).some(w=>words.includes(w)));
}

export async function findTransferCandidates(client,tenant,search){
 uuid.parse(tenant);if(search.trim().length<3)return [];
 const {data,error}=await client.rpc('find_branch_transfer_candidates',{target_tenant_id:tenant,search});
 const parsed=z.array(z.object({id:uuid,name:z.string(),branch:z.enum(BRANCHES)})).safeParse(data);
 if(error||!parsed.success)throw new Error('No pudimos buscar integrantes. Reintentá.');
 return parsed.data;
}
