import test from 'node:test';
import assert from 'node:assert/strict';
import { createTenantEntity } from './tenantEntities.js';
const tenant='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000011';
function fixture(active=tenant,error=null) {
  const calls=[];
  const client={from(table){ calls.push(['from',table]);const q={};for(const method of ['select','eq','is','order','limit','insert','update','delete','single'])q[method]=(...args)=>{calls.push([method,...args]);return q;};q.then=(resolve,reject)=>Promise.resolve({data:[],error}).then(resolve,reject);return q;},async rpc(name,body){calls.push(['rpc',name,body]);return {data:body.operations.map(()=>({id,tenant_id:tenant})),error};}};
  const entity=createTenantEntity({client,getTenant:async()=>active,name:'PreEncargoTienda'});
  return {calls,entity};
}
test('todas las operaciones rechazan grupo ausente antes de consultar o escribir',async()=>{
  const {entity,calls}=fixture(null);
  for(const fn of [()=>entity.list(),()=>entity.filter(),()=>entity.create({estado:'x'}),()=>entity.update(id,{estado:'x'}),()=>entity.delete(id),()=>entity.deleteMany({id}),()=>entity.bulkCreate([{estado:'x'}]),()=>entity.bulkUpdate([{id,estado:'x'}]),()=>entity.atomic([{type:'update',id,values:{estado:'x'}}])])await assert.rejects(fn,/Seleccioná un grupo/);
  assert.deepEqual(calls,[]);
});
test('rechaza tenant ajeno e identidad y nunca reintenta al faltar columna tenant',async()=>{
  const {entity,calls}=fixture();
  for(const fn of [()=>entity.create({tenant_id:other}),()=>entity.update(id,{tenantId:other}),()=>entity.filter({tenant_id:other}),()=>entity.bulkCreate([{tenant_id:other}]),()=>entity.update(id,{id:other}),()=>entity.deleteMany({})])await assert.rejects(fn);
  assert.deepEqual(calls,[]);
  const failed=fixture(tenant,{message:'column tenant_id does not exist: private details'});
  await assert.rejects(()=>failed.entity.deleteMany({referencia_id:id,origen:'Afiliación'}),error=>!error.message.includes('private'));
  assert.equal(failed.calls.filter(c=>c[0]==='from').length,1);
  assert.ok(failed.calls.some(c=>c[0]==='eq'&&c[1]==='tenant_id'&&c[2]===tenant));
  assert.ok(failed.calls.some(c=>c[0]==='eq'&&c[1]==='referencia_id'&&c[2]===id));
});
test('lecturas y altas permitidas conservan contexto, lote usa una sola RPC sin fallback',async()=>{
  const {entity,calls}=fixture();
  await entity.list();await entity.create({estado:'Pendiente'});
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='tenant_id'&&c[2]===tenant));
  assert.equal(calls.find(c=>c[0]==='insert')[1].tenant_id,tenant);
  calls.length=0;
  await entity.bulkUpdate([{id,estado:'Confirmado'}]);
  assert.equal(calls.length,1);assert.equal(calls[0][1],'apply_tenant_batch');assert.equal(calls[0][2].target_tenant_id,tenant);
  const denied=fixture(tenant,{code:'42501'});
  await assert.rejects(()=>denied.entity.bulkUpdate([{id,estado:'Confirmado'}]));
  assert.equal(denied.calls.length,1);
});

test('editar formulario completo conserva id y no reescribe fecha de creación',async()=>{
  const {entity,calls}=fixture();
  await entity.update(id,{id,tenant_id:tenant,created_at:'2020-01-01',updated_at:'2020-01-01',estado:'Confirmado'});
  const payload=calls.find(c=>c[0]==='update')[1];
  assert.equal(payload.id,undefined);assert.equal(payload.created_at,undefined);assert.equal(payload.estado,'Confirmado');
});
