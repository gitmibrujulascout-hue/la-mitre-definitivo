import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { z } from 'npm:zod@3.24.2';
import { extractionValidator, healthExtractionInstructions, healthExtractionJsonSchema } from '../_shared/health-contract.js';

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Cache-Control':'no-store' };
const fileSchema = z.object({type:z.enum(['image/jpeg','image/png','image/webp','application/pdf']),data:z.string().max(17_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict();
const inputSchema = z.object({tenant_id:z.string().uuid(),member_id:z.string().uuid(),files:z.array(fileSchema).min(1).max(4)}).strict();
const providerSchema = z.object({status:z.string(),output:z.array(z.object({content:z.array(z.object({type:z.string(),text:z.string().optional()}).passthrough()).optional()}).passthrough())}).passthrough();
const reply = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});

export async function handleHealthExtraction(req: Request) {
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
  try {
    const authorization=req.headers.get('Authorization');
    if(!authorization?.startsWith('Bearer ')) return reply({error:'ACCESS_DENIED'},401);
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const {data:user,error:authError}=await client.auth.getUser();
    if(authError||!user.user) return reply({error:'ACCESS_DENIED'},401);
    // Stream acotado: no confiar sólo en Content-Length enviado por el cliente.
    const reader=req.body?.getReader(); if(!reader) return reply({error:'INVALID_INPUT'},400);
    const chunks:Uint8Array[]=[];let total=0;
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>17_000_000){await reader.cancel();return reply({error:'FILE_TOO_LARGE'},413);}chunks.push(value);}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const input=inputSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    const {data:allowed,error:accessError}=await client.rpc('can_digitize_health',{target_tenant_id:input.tenant_id,target_member_id:input.member_id});
    if(accessError||allowed!==true) return reply({error:'ACCESS_DENIED'},403);
    const totalBytes=input.files.reduce((sum,file)=>sum+Math.floor(file.data.length*3/4),0);
    if(totalBytes>12*1024*1024) return reply({error:'FILE_TOO_LARGE'},413);
    for(const file of input.files){
      const head=atob(file.data.slice(0,32));
      const valid=file.type==='application/pdf'?head.startsWith('%PDF-'):file.type==='image/jpeg'?head.startsWith('\xff\xd8\xff'):file.type==='image/png'?head.startsWith('\x89PNG\r\n\x1a\n'):head.startsWith('RIFF')&&head.slice(8,12)==='WEBP';
      if(!valid)return reply({error:'INVALID_FILE'},400);
    }
    const apiKey=Deno.env.get('OPENAI_API_KEY');if(!apiKey)return reply({error:'EXTRACTION_UNAVAILABLE'},503);
    const content=input.files.map((file,index)=>file.type==='application/pdf'
      ?{type:'input_file',filename:`pagina-${index+1}.pdf`,file_data:`data:application/pdf;base64,${file.data}`}
      :{type:'input_image',detail:'high',image_url:`data:${file.type};base64,${file.data}`});
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),
      body:JSON.stringify({model:Deno.env.get('HEALTH_EXTRACTION_MODEL')||'o4-mini',store:false,instructions:healthExtractionInstructions,input:[{role:'user',content:[{type:'input_text',text:'Transcribí estas páginas según el esquema. Dejá explícitas las dudas.'},...content]}],text:{format:{type:'json_schema',name:'health_record',strict:true,schema:healthExtractionJsonSchema}}})});
    if(!response.ok)return reply({error:'EXTRACTION_FAILED'},502);
    const result=providerSchema.parse(await response.json());
    if(result.status!=='completed')return reply({error:'EXTRACTION_INCOMPLETE'},422);
    const output=result.output.flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text||'').join('');
    return reply(extractionValidator(z).parse(JSON.parse(output)));
  } catch { return reply({error:'EXTRACTION_FAILED'},422); }
}
