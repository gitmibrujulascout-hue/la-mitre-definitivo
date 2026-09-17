import { MESES, feePeriodDate, getCuotaBaseMes, getCuotaTransferenciaMes, getCuotaBeneficiario, mesExcluidoPorActividad } from '../../lib/ramaUtils.js';

export function monthlyFee(member, people, year, month, method='Efectivo', config=[], affiliations=[]) {
  if (!MESES.includes(month)) throw new Error('Elegí un mes válido.');
  if (mesExcluidoPorActividad(MESES.indexOf(month),member,Number(year),affiliations)) return 0;
  const base=method==='Transferencia'?getCuotaTransferenciaMes(month,year,config):getCuotaBaseMes(month,year,config);
  return getCuotaBeneficiario(member,people,base,feePeriodDate(year,month));
}

// Cada importe queda imputado a su mes: una beca temporal no cambia la distribución
// de un pago ya registrado. Los pagos parciales conservan exactamente sus centavos.
export function splitFeePayment(payment,people,config=[],affiliations=[]) {
  if(payment.tipo_pago!=='Cuota')return [payment];
  const member=people.find(p=>p.id===payment.beneficiario_id);
  if(!member)throw new Error('Actualizá el padrón antes de registrar el pago.');
  const months=payment.meses||[payment.mes];
  if(!months.length||new Set(months).size!==months.length)throw new Error('Revisá los meses seleccionados.');
  const amounts=months.map(month=>({month,weight:monthlyFee(member,people,payment.anio,month,payment.forma_pago,config,affiliations)})).filter(m=>m.weight>0);
  const total=amounts.reduce((sum,m)=>sum+m.weight,0);
  const cents=Math.round(Number(payment.monto)*100);
  if(!total||!Number.isSafeInteger(cents)||cents<=0)throw new Error('No hay cuota para cobrar en esos meses. Revisá las becas y las fechas de actividad.');
  let allocated=0;
  return amounts.map(({month,weight},index)=>{
    const part=index===amounts.length-1?cents-allocated:Math.floor(cents*weight/total);
    allocated+=part;
    return {...payment,mes:month,meses:[month],monto:part/100};
  }).filter(p=>p.monto>0);
}
