import { createContext, useContext, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export const GovernanceContext=createContext(null);
export const useGovernance=()=>useContext(GovernanceContext);
export const options=rows=>rows.map(r=>({value:r.id||r.user_id,label:r.name||r.nombre||'Sin nombre'}));
export const field=(name,label,type='text',choices)=>({name,label,type,choices});

export default function CommandForm({title,command,fields=[],initial={},fixed={},submitLabel='Guardar',onSaved}){
 const {run}=useGovernance();
 const prefix=useId();
 const [values,setValues]=useState(()=>Object.fromEntries(fields.map(f=>[f.name,initial[f.name]??(f.type==='checks'?[]:f.type==='checkbox'?false:'')])));
 const [errors,setErrors]=useState({});const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const ref=useRef(null);
 const [invitation,setInvitation]=useState('');
 const submit=async event=>{
 event.preventDefault();setBusy(true);setStatus('');setErrors({});
 try{const result=await run(command,{...values,...fixed});
 if(!result.ok){setErrors(result.errors||{});setStatus(result.message||'Revisá los campos señalados.');requestAnimationFrame(()=>ref.current?.querySelector('[aria-invalid="true"]')?.focus());}
 else{setStatus('Guardado correctamente.');if(result.invitationPath)setInvitation(new URL(result.invitationPath,window.location.origin).toString());onSaved?.();}}
 catch{setStatus('No pudimos guardar. Reintentá.');}finally{setBusy(false);}
 };
 return <form ref={ref} onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4" noValidate>
 {title&&<h3 className="font-semibold">{title}</h3>}
 <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
 {fields.map(f=><div key={f.name} className={`block text-sm font-medium ${f.type==='checks'||f.type==='textarea'?'sm:col-span-2':''}`}>
 <label htmlFor={`${prefix}-${f.name}`}>{f.label}</label>
 {f.type==='checks'?<div className="mt-2 max-h-56 overflow-auto rounded border p-2">{f.choices?.map(o=><label key={o.value} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={values[f.name].includes(o.value)} onChange={e=>setValues(v=>({...v,[f.name]:e.target.checked?[...v[f.name],o.value]:v[f.name].filter(x=>x!==o.value)}))}/>{o.label}</label>)}</div>:
 f.type==='select'?<select id={`${prefix}-${f.name}`} aria-describedby={`${prefix}-${f.name}-error`} aria-invalid={!!errors[f.name]} className="mt-1 min-h-11 w-full rounded border bg-background px-2 focus-visible:outline" value={values[f.name]} onChange={e=>setValues(v=>({...v,[f.name]:e.target.value}))}><option value="">Seleccionar</option>{f.choices?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:
 f.type==='textarea'?<textarea id={`${prefix}-${f.name}`} aria-describedby={`${prefix}-${f.name}-error`} aria-invalid={!!errors[f.name]} className="mt-1 min-h-24 w-full rounded border bg-background p-2" value={values[f.name]} onChange={e=>setValues(v=>({...v,[f.name]:e.target.value}))}/>:
 f.type==='checkbox'?<input id={`${prefix}-${f.name}`} className="ml-3 min-h-11 align-middle" type="checkbox" checked={values[f.name]} onChange={e=>setValues(v=>({...v,[f.name]:e.target.checked}))}/>:
 <input id={`${prefix}-${f.name}`} aria-describedby={`${prefix}-${f.name}-error`} aria-invalid={!!errors[f.name]} className="mt-1 min-h-11 w-full rounded border bg-background px-2 focus-visible:outline" type={f.type} step={f.type==='number'?'0.01':undefined} value={values[f.name]} onChange={e=>setValues(v=>({...v,[f.name]:e.target.value}))}/>}
 {errors[f.name]&&<span id={`${prefix}-${f.name}-error`} className="mt-1 block text-destructive">{errors[f.name]}</span>}
 </div>)}
 </fieldset>
 {status&&<p role="status" aria-live="polite" className="text-sm">{status}</p>}
 {invitation&&<label className="block text-sm">Copiá y compartí este enlace con el responsable. Vence en 7 días.<input className="mt-2 min-h-11 w-full rounded border bg-background p-2" value={invitation} readOnly onFocus={event=>event.target.select()}/></label>}
 <Button className="min-h-11" disabled={busy} type="submit">{busy?'Guardando…':submitLabel}</Button>
 </form>;
}
