import { formatMoney } from '@/lib/ramaUtils';
import { useGovernance } from './CommandForm';
import { useState } from 'react';
import { personalAccountSummary } from '@/services/access/personalAccount';
export default function AccountsPanel(){
 const {data}=useGovernance();const [year,setYear]=useState(new Date().getFullYear());
 return <section className="space-y-5"><h2 className="text-xl font-semibold">Mi cuenta y la de mis hijos</h2>
 <label className="block">Año<input className="ml-3 min-h-11 w-28 rounded border bg-background px-2" type="number" min="2026" max="2100" value={year} onChange={e=>setYear(Number(e.target.value))}/></label>
 {!data.accounts.length&&<p>No hay una persona vinculada a tu cuenta. Pedile al administrador o al jefe de rama que revise la vinculación.</p>}
 {data.accounts.map(a=>{const summary=personalAccountSummary(a.billing,year);return <article key={a.id} className="space-y-3 rounded border p-4"><h3 className="font-semibold">{a.name} · {a.branch}</h3><p>Crédito disponible: {formatMoney(a.credit)}</p>
 <h4 className="font-semibold">Cuotas {year}</h4>{summary.unconfigured&&<p role="status">Hay importes pendientes de configurar por Tesorería. El total es parcial.</p>}<p>Cuotas pendientes con importe confirmado: {formatMoney(summary.feeDebt)}</p>
 <ul>{summary.months.map(m=><li key={m.month} className="border-t py-2">{m.month}: {m.expected===null?'Importe pendiente':`${formatMoney(m.expected)} · Pagado ${formatMoney(m.paid)} · Pendiente ${formatMoney(m.debt)}`}</li>)}</ul>
 <h4 className="font-semibold">Campamentos</h4><ul>{summary.camps.map(c=><li key={c.id}>{c.name}: {formatMoney(c.expected)} · Pendiente {formatMoney(Math.max(0,c.expected-c.paid))}</li>)}</ul>
 <h4 className="font-semibold">Pagos registrados</h4>{!a.payments.length&&<p>No hay pagos registrados.</p>}<ul>{a.payments.map((p,i)=><li key={i} className="border-t py-2">{p.date} · {p.concept} · {formatMoney(p.amount)}</li>)}</ul>
 <h4 className="font-semibold">Afiliaciones</h4><ul>{a.affiliations.map((p,i)=><li key={i}>{p.year}: {formatMoney(p.paid)} pagados de {formatMoney(p.amount)}</li>)}</ul>
 </article>;})}
 </section>;
}
