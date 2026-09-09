import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { SALUD_FIELDS } from '@/lib/saludFields';
import { extractHealthFiles,identityProblem,mergeHealthProposal,parseHealthForm,readHealthDraft,saveHealthDraft,validateHealthFiles } from '@/services/access/healthDigitization';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import HealthPhotoPreview from './HealthPhotoPreview';

export default function HealthDigitizationDialog({open,onClose,beneficiario,onSaved}) {
  const {user}=useAuth();const cache=useQueryClient();
  const camera=useRef();const picker=useRef();
  const [files,setFiles]=useState([]);const [values,setValues]=useState({});const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [errors,setErrors]=useState({});
  const [identityChecked,setIdentityChecked]=useState(false);const [reviewed,setReviewed]=useState(false);
  const query=useQuery({queryKey:['health-draft',user?.tenant_id,beneficiario.id],queryFn:()=>readHealthDraft(supabase,user.tenant_id,beneficiario.id),enabled:open&&Boolean(user?.tenant_id),retry:false,gcTime:0,refetchOnWindowFocus:false});
  useEffect(()=>{if(query.data){setValues(Object.fromEntries(Object.entries(query.data.health).map(([key,value])=>[key,String(value??'')])));setResult(null);setReviewed(false);setIdentityChecked(false);}},[query.data]);
  const change=(key,value)=>{setValues(current=>({...current,[key]:value}));setReviewed(false);setErrors(current=>({...current,[key]:undefined}));};
  const resetReading=()=>{setResult(null);setValues(Object.fromEntries(Object.entries(query.data.health).map(([key,value])=>[key,String(value??'')])));setReviewed(false);setIdentityChecked(false);};
  const addFiles=event=>{const added=Array.from(event.target.files||[]);event.target.value='';if(!added.length)return;try{validateHealthFiles([...files,...added]);setFiles(current=>[...current,...added]);resetReading();setMessage('');}catch(error){setMessage(error.message);}};
  const extract=async()=>{
    setBusy(true);setMessage('');setResult(null);setIdentityChecked(false);setReviewed(false);
    try{const next=await extractHealthFiles(supabase,user.tenant_id,beneficiario.id,files);setResult(next);if(!identityProblem(next,query.data)&&next.readable)setValues(mergeHealthProposal(values,next));}
    catch{setMessage('No pudimos leer la ficha. Probá una foto más clara o completá los datos manualmente.');}finally{setBusy(false);}
  };
  const save=async()=>{
    const parsed=parseHealthForm(values);if(!parsed.ok){setErrors(parsed.errors);document.getElementById(`health-${Object.keys(parsed.errors)[0]}`)?.focus();return;}
    setBusy(true);setMessage('');
    try{await saveHealthDraft(supabase,user.tenant_id,query.data,parsed.patch);await cache.invalidateQueries();toast.success('Ficha digitalizada y revisada.');onSaved?.();onClose();}
    catch(error){setMessage(error.message);}finally{setBusy(false);}
  };
  const problem=result&&query.data?identityProblem(result,query.data):null;
  return <Dialog open={open} onOpenChange={()=>{if(!busy)onClose();}}><DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Digitalizar ficha médica</DialogTitle><p className="text-sm">{beneficiario.nombre} · {beneficiario.rama}</p></DialogHeader>
    {query.isPending?<div className="h-24 rounded bg-muted animate-pulse" aria-label="Cargando ficha"/>:query.isError?<div role="alert"><p>No pudimos cargar la ficha. Revisá tu conexión o tu acceso.</p><Button onClick={()=>query.refetch()}>Reintentar</Button></div>:<>
      <p className="text-sm text-muted-foreground">Fotografiá todas las páginas, con buena luz y texto enfocado. Revisá el nombre y los datos antes de guardar.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>camera.current.click()}>Sacar foto</Button><Button variant="outline" disabled={busy} onClick={()=>picker.current.click()}>Subir fotos o PDF</Button></div>
      <input ref={camera} aria-label="Cámara de ficha médica" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={addFiles}/>
      <input ref={picker} aria-label="Archivos de ficha médica" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={addFiles}/>
      <p className="text-xs text-muted-foreground">Hasta 4 archivos y 12 MB en total. La foto se procesa para completar la ficha; no se publica.</p>
      {files.map((file,index)=><div key={index} className="flex min-w-0 items-center gap-2"><span className="truncate text-sm flex-1">{file.name}</span><Button variant="ghost" disabled={busy} aria-label={`Quitar archivo ${index+1}`} onClick={()=>{setFiles(current=>current.filter((_,i)=>i!==index));resetReading();}}>Quitar</Button></div>)}
      {!!files.length&&<Button disabled={busy} onClick={extract}>{busy?'Procesando…':'Leer ficha'}</Button>}
      <HealthPhotoPreview files={files}/>
      {result&&<div className="rounded border p-3 space-y-2"><p className="text-sm">Identidad leída: {result.nombre||'Nombre no legible'} · DNI {result.dni||'No legible'}</p><p className="text-sm">Ficha seleccionada: {query.data.nombre} · DNI {query.data.dni||'Sin DNI registrado'}</p>
        {problem&&<p role="alert" className="text-destructive">{problem}</p>}{!result.readable&&<p role="alert">La ficha no se pudo leer con suficiente claridad. Sacá otra foto o completala manualmente.</p>}
        {result.warnings.map((warning,index)=><p key={index} className="text-sm">{warning}</p>)}
        <Button variant="outline" disabled={busy} onClick={()=>{setResult(null);setValues(Object.fromEntries(Object.entries(query.data.health).map(([k,v])=>[k,String(v??'')])));setReviewed(false);setIdentityChecked(false);}}>Descartar lectura</Button>
      </div>}
      <p className="text-sm">Los datos ya registrados se conservan. Aplicá cada propuesta que quieras reemplazar y corregí lo necesario.</p>
      <div className="grid sm:grid-cols-2 gap-4">{SALUD_FIELDS.map(field=>{const proposal=result?.fields[field.key];return <div key={field.key} className={field.wide?'sm:col-span-2':''}><Label htmlFor={`health-${field.key}`}>{field.label}</Label><Input id={`health-${field.key}`} value={values[field.key]??''} disabled={busy||Boolean(problem)} inputMode={field.type==='number'?'decimal':undefined} onChange={event=>change(field.key,event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key]?`error-${field.key}`:undefined}/>
        {errors[field.key]&&<p id={`error-${field.key}`} className="text-sm text-destructive">{errors[field.key]}</p>}
        {proposal?.status==='unreadable'&&<p className="text-sm text-muted-foreground">No legible: revisá este campo en el original.</p>}
        {proposal?.status==='present'&&proposal.value&&<div className="text-sm mt-1 space-y-1"><p>Leído: {proposal.value}</p><p className="text-muted-foreground">Evidencia: {proposal.evidence||'No disponible'}</p><Button variant="outline" disabled={busy||Boolean(problem)||!proposal.evidence} onClick={()=>change(field.key,proposal.value)}>Usar dato leído</Button></div>}
      </div>;})}</div>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={identityChecked} disabled={busy||Boolean(problem)} onChange={event=>setIdentityChecked(event.target.checked)}/>Verifiqué que la ficha corresponde a {beneficiario.nombre}.</label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={reviewed} disabled={busy||Boolean(problem)} onChange={event=>setReviewed(event.target.checked)}/>Revisé todas las páginas y los datos que voy a guardar.</label>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy||!reviewed||!identityChecked||Boolean(problem)||result?.readable===false} onClick={save}>{busy?'Procesando…':'Confirmar digitalización'}</Button></DialogFooter>
    </>}
    <p role="status" className="text-sm">{message}</p>
  </DialogContent></Dialog>;
}
