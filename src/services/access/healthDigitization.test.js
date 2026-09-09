import test from 'node:test';
import assert from 'node:assert/strict';
import { healthKeys } from '../../../supabase/functions/_shared/health-contract.js';
import { healthResultSchema,identityProblem,mergeHealthProposal,parseHealthForm,validateHealthFiles } from './healthDigitization.js';
import { hasPermission,PERMISSIONS } from './permissions.js';
const result=()=>({nombre:'Persona de prueba',dni:'12.345.678',multiple_people:false,readable:true,warnings:[],fields:Object.fromEntries(healthKeys.map(key=>[key,{value:null,evidence:null,status:'absent'}]))});

test('ficha de otra persona o varias fichas bloquean el resultado',()=>{
  assert.match(identityProblem(result(),{dni:'99888777'}),/DNI/);
  assert.equal(identityProblem(result(),{dni:'12345678'}),null);
  assert.match(identityProblem({...result(),multiple_people:true},{dni:'12345678'}),/más de una/);
});
test('respuesta defensiva rechaza campos desconocidos y estructuras inesperadas',()=>{
  assert.equal(healthResultSchema.safeParse(result()).success,true);
  assert.equal(healthResultSchema.safeParse({...result(),becado:true}).success,false);
  assert.equal(healthResultSchema.safeParse([]).success,false);
  assert.equal(healthResultSchema.safeParse({...result(),fields:{}}).success,false);
});
test('no pisa datos existentes ni rellena valores sin evidencia; conserva NO explícito',()=>{
  const proposal=result();proposal.fields.alergias={value:'No tiene (declarado en la ficha)',evidence:'NO marcado',status:'present'};
  proposal.fields.medicacion_habitual={value:'Inventado',evidence:null,status:'present'};
  assert.equal(mergeHealthProposal({alergias:'Alergia registrada'},proposal).alergias,'Alergia registrada');
  assert.equal(mergeHealthProposal({},proposal).alergias,'No tiene (declarado en la ficha)');
  assert.equal(mergeHealthProposal({alergias:''},proposal).alergias,'No tiene (declarado en la ficha)');
  assert.equal(mergeHealthProposal({},proposal).medicacion_habitual,'');
});
test('números y coma decimal, datos vacíos y talla en unidad incorrecta',()=>{
  const parsed=parseHealthForm({peso_kg:35,talla_m:'1,45'});
  assert.equal(parsed.ok,true);assert.equal(parsed.patch.peso_kg,35);assert.equal(parsed.patch.talla_m,1.45);
  assert.equal(parseHealthForm({talla_m:'145'}).ok,false);
  assert.equal(parseHealthForm({peso_kg:'30 kg'}).ok,false);
  assert.equal(parseHealthForm({}).ok,false);
});
test('archivos limitados y permisos de digitalización separados de lectura',()=>{
  assert.doesNotThrow(()=>validateHealthFiles([{type:'image/jpeg',size:1000},{type:'application/pdf',size:500}]));
  assert.throws(()=>validateHealthFiles([{type:'text/html',size:50}]));
  assert.throws(()=>validateHealthFiles([{type:'image/jpeg',size:13*1024*1024}]));
  assert.throws(()=>validateHealthFiles(Array(5).fill({type:'image/jpeg',size:10})));
  assert.equal(hasPermission({tenant_roles:['branch_leader']},PERMISSIONS.healthDigitize),true);
  for(const role of ['family','support','treasury','institutional'])assert.equal(hasPermission({tenant_roles:[role]},PERMISSIONS.healthDigitize),false);
});
