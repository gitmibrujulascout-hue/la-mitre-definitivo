import { handleHealthExtraction } from './handler.ts';
import { healthKeys } from '../_shared/health-contract.js';
const tenant='00000000-0000-4000-8000-000000000001', member='00000000-0000-4000-8000-000000000011';
const body={tenant_id:tenant,member_id:member,files:[{type:'image/png',data:btoa('\x89PNG\r\n\x1a\n'+ 'test'.repeat(8))}]};
function assert(condition:unknown){if(!condition)throw new Error('Falló una condición del contrato de extracción.');}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
Deno.test('extracción autentica, verifica rama, usa imágenes privadas y rechaza lectura incompleta',async()=>{
  const original=globalThis.fetch;
  const names=['SUPABASE_URL','SUPABASE_ANON_KEY','OPENAI_API_KEY'];const previous=names.map(name=>Deno.env.get(name));
  Deno.env.set('SUPABASE_URL','https://fixture.local');Deno.env.set('SUPABASE_ANON_KEY','fixture-key');Deno.env.set('OPENAI_API_KEY','fixture-key');
  let allowed=true, providerCalls=0, incomplete=false;
  globalThis.fetch=async(input,options)=>{
    const url=String(input instanceof Request?input.url:input);
    if(url.includes('/auth/v1/user'))return json({id:member,aud:'authenticated',role:'authenticated'});
    if(url.includes('/rpc/can_digitize_health'))return json(allowed);
    if(url==='https://api.openai.com/v1/responses'){
      providerCalls++;const request=JSON.parse(String(options?.body));assert(request.store===false);assert(request.input[0].content[1].type==='input_image');assert(request.input[0].content[1].image_url.startsWith('data:image/png;base64,'));
      const extraction={nombre:'Persona ficticia',dni:null,multiple_people:false,readable:true,warnings:[],fields:Object.fromEntries(healthKeys.map(key=>[key,{value:null,evidence:null,status:'absent'}]))};
      return json({status:incomplete?'incomplete':'completed',output:[{content:[{type:'output_text',text:JSON.stringify(extraction)}]}]});
    }
    throw new Error('Solicitud externa inesperada');
  };
  const request=(payload:unknown,auth=true)=>new Request('https://fixture.local/health-extract',{method:'POST',headers:auth?{Authorization:'Bearer fixture-token'}:{},body:JSON.stringify(payload)});
  try{
    assert((await handleHealthExtraction(request(body,false))).status===401);assert(providerCalls===0);
    allowed=false;assert((await handleHealthExtraction(request(body))).status===403);assert(providerCalls===0);
    allowed=true;assert((await handleHealthExtraction(request(body))).status===200);assert(providerCalls===1);
    incomplete=true;assert((await handleHealthExtraction(request(body))).status===422);
    assert((await handleHealthExtraction(request({...body,files:[{type:'image/png',data:btoa('not an image')}]}))).status===400);
    assert((await handleHealthExtraction(request({...body,file_urls:['https://elsewhere.local']}))).status===422);
  }finally{globalThis.fetch=original;names.forEach((name,index)=>previous[index]===undefined?Deno.env.delete(name):Deno.env.set(name,previous[index]!));}
});
