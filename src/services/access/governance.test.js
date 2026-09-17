import test from 'node:test';
import assert from 'node:assert/strict';
import {commandSchemas,runGovernanceCommand,familySuggestions} from './governance.js';
import {scholarshipPercentage} from './scholarships.js';
import {getCuotaBeneficiario,calcularIntervalosActivos} from '../../lib/ramaUtils.js';
import {personalAccountSummary} from './personalAccount.js';
import {monthlyFee,splitFeePayment} from './feePayments.js';
const id='00000000-0000-4000-8000-000000000001';
test('percentage periods preserve previous debt and individual replaces branch, including zero',()=>{
 const member={id,rama:'Rovers',tipo:'Beneficiario',becado:false,scholarship_periods:[{branch:'Rovers',percentage:100,starts_on:'2026-09-01',ends_on:'2026-10-31',concept:'fee'},{member_id:id,percentage:25,starts_on:'2026-10-01',ends_on:'2026-10-31',concept:'fee'}]};
 assert.equal(getCuotaBeneficiario(member,[],100,'2026-08-01'),100);
 assert.equal(getCuotaBeneficiario(member,[],100,'2026-09-01'),0);
 assert.equal(getCuotaBeneficiario(member,[],100,'2026-10-01'),75);
 assert.equal(getCuotaBeneficiario(member,[],100,'2026-11-01'),100);
 assert.equal(scholarshipPercentage(member,'2026-09-01','affiliation'),0);
 member.scholarship_periods[1].percentage=0;assert.equal(getCuotaBeneficiario(member,[],100,'2026-10-01'),100);
});
test('multiple inactive periods retain previous and returning months',()=>{
 const member={fecha_primer_afiliacion:'2026-03-01',inactive_periods:[{starts_on:'2026-04-01',ends_on:'2026-06-01'},{starts_on:'2026-08-01',ends_on:null}]};
 assert.deepEqual(calcularIntervalosActivos(member,2026),[[2,2],[5,5],[6,6]]);
});
test('forms reject impossible dates, negative grants, missing scope and wrong concepts',()=>{
 const input={branch:'Rovers',percentage:50,starts_on:'2026-02-31',ends_on:'2026-03-01',concept:'fee'};
 assert.equal(commandSchemas.scholarship.safeParse(input).success,false);
 assert.equal(commandSchemas.scholarship.safeParse({...input,starts_on:'2026-02-01',percentage:101}).success,false);
 assert.equal(commandSchemas.scholarship.safeParse({...input,starts_on:'2026-02-01',concept:'affiliation'}).success,false);
 assert.equal(commandSchemas.assignment.safeParse({user:id,branch:'Rovers',role:'tenant_admin'}).success,false);
 assert.equal(commandSchemas.vote.safeParse({poll:id,choice:''}).success,false);
});
test('errors never expose backend messages and invalid forms never send a command',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {error:{message:'private database stack'}};}};
 assert.equal((await runGovernanceCommand(client,id,'vote',{poll:'invalid',choice:0})).ok,false);assert.equal(calls,0);
 const result=await runGovernanceCommand(client,id,'vote',{poll:id,choice:0});assert.equal(result.ok,false);assert.doesNotMatch(result.message,/private/);
});
test('surname suggestions are inert and never create links',()=>{
 assert.deepEqual(familySuggestions('Adulto Pérez',[{id,name:'Menor Perez'},{id:'different',name:'Otra Persona'}]).map(p=>p.id),[id]);
});
test('private account does not invent unconfigured amounts',()=>{
 const raw={member:{id,rama:'Rovers',activo:true,fecha_primer_afiliacion:'2025-03-01'},family_count:0,fees:[],payments:[],affiliations:[],camps:[]};
 const result=personalAccountSummary(raw,2026);assert.equal(result.unconfigured,true);assert.equal(result.feeDebt,0);assert.ok(result.months.every(m=>m.expected===null));
});
test('monthly payments keep different grants separate and retain the exact payment total',()=>{
 const member={id,rama:'Rovers',scholarship_periods:[{member_id:id,percentage:50,concept:'fee',starts_on:'2026-09-01',ends_on:'2026-09-30'}]};
 const config=[{mes:'Septiembre',anio:2026,monto_efectivo:100},{mes:'Octubre',anio:2026,monto_efectivo:100}];
 assert.equal(monthlyFee(member,[],2026,'Septiembre','Efectivo',config),50);
 const rows=splitFeePayment({tipo_pago:'Cuota',beneficiario_id:id,anio:2026,meses:['Septiembre','Octubre'],monto:150,forma_pago:'Efectivo'},[member],config);
 assert.deepEqual(rows.map(p=>[p.mes,p.monto]),[['Septiembre',50],['Octubre',100]]);
 const partial=splitFeePayment({...rows[0],meses:['Septiembre','Octubre'],monto:1},[member],config);
 assert.equal(partial.reduce((sum,p)=>sum+Math.round(p.monto*100),0),100);
 member.scholarship_periods[0].percentage=100;
 assert.throws(()=>splitFeePayment({...rows[0],monto:50},[member],config));
 assert.equal(monthlyFee({...member,inactive_periods:[{starts_on:'2026-10-01',ends_on:null}]},[],2026,'Octubre','Efectivo',config),0);
});
