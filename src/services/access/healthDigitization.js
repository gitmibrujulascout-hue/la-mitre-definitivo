import { z } from 'zod';
import { healthKeys, extractionValidator } from '../../../supabase/functions/_shared/health-contract.js';
import { readTenantPeople } from './tenantPeople.js';
export const healthResultSchema=extractionValidator(z);
export const healthDraftSchema=z.object({id:z.string().uuid(),nombre:z.string().nullable(),dni:z.string().nullable(),rama:z.string().nullable(),revision:z.string(),health:z.object(Object.fromEntries(healthKeys.map(key=>[key,z.union([z.string(),z.number(),z.null()])]))).strict()});
export function identityProblem(result,member) {
  if(result.multiple_people)return 'Las páginas parecen pertenecer a más de una persona. Separá las fichas y volvé a analizar.';
  const digits=value=>String(value||'').replace(/\D/g,'');
  if(digits(result.dni)&&digits(member.dni)&&digits(result.dni)!==digits(member.dni))return 'El DNI leído no coincide con el chico seleccionado. Revisá la ficha antes de continuar.';
  return null;
}
export function mergeHealthProposal(current,result) {
  return Object.fromEntries(healthKeys.map(key=>[key,String(String(current[key]??'').trim()?current[key]:(result.fields[key].status==='present'&&result.fields[key].evidence?result.fields[key].value:'')??'')]));
}
export function parseHealthForm(values) {
  const patch={};const errors={};
  for(const key of healthKeys){
    const value=String(values[key]??'').trim();
    if(!value){patch[key]=null;continue;}
    if(['peso_kg','talla_m'].includes(key)){
      const number=Number(value.replace(',','.'));const max=key==='peso_kg'?500:3;
      if(!Number.isFinite(number)||number<=0||number>max)errors[key]=key==='peso_kg'?'Ingresá un peso válido en kg.':'Ingresá la talla en metros, por ejemplo 1,45.';
      else patch[key]=number;
    }else if(value.length>3500)errors[key]='El texto es demasiado largo.';
    else patch[key]=value;
  }
  if(Object.keys(errors).length)return {ok:false,errors};
  if(!Object.values(patch).some(value=>value!==null))return {ok:false,errors:{observaciones_salud:'Cargá los datos de la ficha antes de confirmarla.'}};
  return {ok:true,patch};
}
export function validateHealthFiles(files){
  if(!files.length||files.length>4)throw new Error('Seleccioná entre uno y cuatro archivos.');
  if(files.some(file=>!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)))throw new Error('Usá fotos JPG, PNG, WebP o archivos PDF.');
  if(files.reduce((sum,file)=>sum+file.size,0)>12*1024*1024)throw new Error('Los archivos deben sumar como máximo 12 MB.');
}
export async function extractHealthFiles(client,tenantId,memberId,files){
  validateHealthFiles(files);
  const encoded=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(new Error('No pudimos leer la foto.'));reader.onload=()=>resolve({type:file.type,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file);
  })));
  const {data,error}=await client.functions.invoke('health-extract',{body:{tenant_id:tenantId,member_id:memberId,files:encoded}});
  if(error)throw new Error('No pudimos leer la ficha. Probá una foto más clara o completá los datos manualmente.');
  return healthResultSchema.parse(data);
}
export async function readHealthDraft(client,tenantId,memberId){
  const {data,error}=await client.rpc('get_member_health_draft',{target_tenant_id:tenantId,target_member_id:memberId});
  if(error)throw new Error('No pudimos cargar la ficha. Revisá tu conexión y la rama asignada.');
  const draft=healthDraftSchema.parse(data);if(draft.id!==memberId)throw new Error('La ficha recibida no corresponde a la persona seleccionada.');return draft;
}
export async function readHealthQueue(client,tenantId){
  const rows=await readTenantPeople(client,tenantId,{},'nombre',undefined,'list_health_digitization_queue');
  return z.array(z.object({id:z.string().uuid(),tenant_id:z.string().uuid(),nombre:z.string().nullable(),rama:z.string().nullable(),reviewed_at:z.string().datetime({offset:true}).nullable()})).parse(rows);
}
export async function saveHealthDraft(client,tenantId,draft,patch){
  const {error}=await client.rpc('save_member_health_digitization',{target_tenant_id:tenantId,target_member_id:draft.id,target_revision:draft.revision,target_patch:patch,target_reviewed:true});
  if(error)throw new Error(error.message?.includes('HEALTH_CHANGED')?'Otra persona actualizó la ficha. Cerrala y volvé a abrirla para revisar los datos nuevos.':'No pudimos guardar. Revisá tu conexión y que sigas teniendo esa rama asignada.');
}
