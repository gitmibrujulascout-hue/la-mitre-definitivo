import { z } from 'zod';
import { calcularMesesQueGeneranDeuda,calcularMontoPorMes,getCuotaBeneficiario,feePeriodDate } from '../../lib/ramaUtils.js';
import { applyPeriodScholarship } from './scholarships.js';
const billingSchema=z.object({member:z.object({id:z.string().uuid()}).passthrough(),family_count:z.coerce.number().int().min(0),fees:z.array(z.object({mes:z.string().nullable(),anio:z.coerce.number(),monto_efectivo:z.coerce.number().nullable(),monto_transferencia:z.coerce.number().nullable()})),payments:z.array(z.object({}).passthrough()),affiliations:z.array(z.object({}).passthrough()),camps:z.array(z.object({id:z.string().uuid(),name:z.string().nullable(),date:z.string().nullable(),amount:z.coerce.number().nullable()}))});
export function personalAccountSummary(raw,year){
 const parsed=billingSchema.safeParse(raw);if(!parsed.success)return {months:[],camps:[],feeDebt:0,unconfigured:true};
 const {member,fees,payments,affiliations,camps,family_count:familyCount}=parsed.data;
 // Sólo cantidad de hermanos: nunca exponer cuentas o datos de otros integrantes.
 const siblings=Array.from({length:Math.max(0,familyCount-1)},(_,i)=>({id:`sibling-${i}`,grupo_familiar:member.grupo_familiar,activo:true,rama:member.rama,tipo:'Beneficiario'}));
 const paid=calcularMontoPorMes(payments.filter(p=>Number(p.anio)===year&&p.tipo_pago!=='Campamento'),member);
 const months=calcularMesesQueGeneranDeuda(member,year,affiliations).map(month=>{
 const config=fees.find(f=>Number(f.anio)===year&&f.mes===month);
 const transfer=payments.some(p=>Number(p.anio)===year&&p.forma_pago==='Transferencia'&&(p.meses||[p.mes]).includes(month));
 const base=transfer?config?.monto_transferencia:config?.monto_efectivo;
 const expected=base==null?null:getCuotaBeneficiario(member,siblings,base,feePeriodDate(year,month));
 return {month,expected,paid:paid[month]||0,debt:expected===null?null:Math.max(0,expected-(paid[month]||0))};
 });
 return {months,feeDebt:months.reduce((sum,m)=>sum+(m.debt||0),0),unconfigured:months.some(m=>m.expected===null),camps:camps.filter(c=>c.date?.startsWith(String(year))).map(c=>({...c,expected:applyPeriodScholarship(c.amount||0,member,c.date,'camp',c.id),paid:payments.filter(p=>p.campamento_id===c.id).reduce((s,p)=>s+Number(p.monto||0),0)}))};
}
