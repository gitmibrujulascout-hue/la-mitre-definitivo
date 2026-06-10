import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, Sparkles, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

import { SALUD_FIELDS as FIELDS, SALUD_SCHEMA, parseSaludForm } from '@/lib/saludFields';

function buildInitialForm(beneficiario) {
  const form = {};
  FIELDS.forEach(({ key }) => {
    form[key] = beneficiario?.[key] != null ? String(beneficiario[key]) : '';
  });
  return form;
}

// Comparación campo a campo entre lo cargado y lo extraído por IA
function ConflictRow({ field, valorActual, valorIA, eleccion, onChange }) {
  const distintos = valorActual && valorIA && String(valorActual).trim() !== String(valorIA).trim();
  if (!distintos) return null;
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-orange-50 border-orange-200">
      <p className="text-xs font-semibold text-orange-700">{field.label}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('actual')}
          className={cn(
            "text-left text-xs p-2 rounded border transition-all",
            eleccion === 'actual'
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
              : "border-gray-200 bg-white hover:border-blue-300"
          )}
        >
          <p className="text-muted-foreground mb-0.5">Valor actual</p>
          <p className="font-medium text-foreground">{valorActual}</p>
        </button>
        <button
          type="button"
          onClick={() => onChange('ia')}
          className={cn(
            "text-left text-xs p-2 rounded border transition-all",
            eleccion === 'ia'
              ? "border-green-500 bg-green-50 ring-1 ring-green-400"
              : "border-gray-200 bg-white hover:border-green-300"
          )}
        >
          <p className="text-muted-foreground mb-0.5">Valor extraído por IA</p>
          <p className="font-medium text-foreground">{valorIA}</p>
        </button>
      </div>
    </div>
  );
}

export default function EditarSaludDialog({ open, onClose, beneficiario, onSaved }) {
  const [form, setForm] = useState(() => buildInitialForm(beneficiario));
  const [mode, setMode] = useState('edit'); // 'edit' | 'import' | 'conflict'
  const [files, setFiles] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [conflictos, setConflictos] = useState({}); // key -> 'actual' | 'ia'
  const inputRef = useRef();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Beneficiario.update(beneficiario.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
      toast.success('Datos de salud guardados correctamente');
      onClose();
      if (onSaved) onSaved();
    },
  });

  const handleChange = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleFiles = (e) => {
    const newFiles = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf');
    setFiles(prev => [...prev, ...newFiles]);
    setExtracted(null);
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleExtract = async () => {
    if (files.length === 0) return;
    setExtracting(true);
    setExtracted(null);

    const merged = {};
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: SALUD_SCHEMA,
      });
      if (result.status === 'success' && result.output) {
        const data = Array.isArray(result.output) ? result.output[0] : result.output;
        Object.entries(data).forEach(([k, v]) => {
          if (v && v !== 'null' && v !== 'No' && v !== 'NO') merged[k] = String(v);
        });
      }
    }

    setExtracted(merged);

    // Detectar conflictos: campo tiene valor actual Y valor IA distintos
    const confInit = {};
    FIELDS.forEach(({ key }) => {
      const actual = form[key]?.trim();
      const ia = merged[key]?.trim();
      if (actual && ia && actual !== ia) {
        confInit[key] = 'actual'; // por defecto se mantiene el actual
      }
    });
    setConflictos(confInit);

    if (Object.keys(confInit).length > 0) {
      setMode('conflict');
    } else {
      // Sin conflictos: mergear directo
      setForm(prev => {
        const updated = { ...prev };
        FIELDS.forEach(({ key }) => {
          if (merged[key] && !updated[key]) updated[key] = merged[key];
          if (merged[key] && !prev[key]) updated[key] = merged[key];
        });
        return updated;
      });
      setMode('edit');
      toast.success('Datos importados sin conflictos — revisá y guardá.');
    }

    setExtracting(false);
  };

  const handleResolveConflict = (key, choice) => {
    setConflictos(prev => ({ ...prev, [key]: choice }));
  };

  const handleApplyConflicts = () => {
    setForm(prev => {
      const updated = { ...prev };
      FIELDS.forEach(({ key }) => {
        if (conflictos[key]) {
          updated[key] = conflictos[key] === 'ia' ? extracted[key] : prev[key];
        } else if (extracted[key] && !prev[key]) {
          // Sin conflicto: si la IA trajo dato nuevo, lo tomamos
          updated[key] = extracted[key];
        }
      });
      return updated;
    });
    setMode('edit');
    toast.success('Conflictos resueltos — revisá y guardá.');
  };

  const handleSave = () => {
    updateMutation.mutate(parseSaludForm(form));
  };

  const conflictosKeys = Object.keys(conflictos);
  const todosResueltos = conflictosKeys.every(k => conflictos[k]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'conflict' ? (
              <><AlertCircle className="w-5 h-5 text-orange-500" />Resolver conflictos — {beneficiario?.nombre}</>
            ) : (
              <>Datos de Salud — {beneficiario?.nombre}</>
            )}
          </DialogTitle>
          {mode === 'edit' && (
            <p className="text-sm text-muted-foreground pt-1">
              Completá o corregí manualmente los campos. También podés importar desde PDF con IA.
            </p>
          )}
        </DialogHeader>

        {/* Panel de importación (modo edit) */}
        {mode === 'edit' && (
          <div className="space-y-3">
            {files.length === 0 ? (
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-medium">Opcional: importar con IA desde PDF</p>
                <p className="text-xs text-muted-foreground">Los datos extraídos se compararán con los actuales</p>
                <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFiles} />
              </div>
            ) : (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm flex-1 truncate">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleExtract} disabled={extracting} className="flex-1">
                    {extracting ? (
                      <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Analizando...</>
                    ) : (
                      <><Sparkles className="w-3 h-3 mr-1.5" />Analizar con IA</>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setFiles([])}>Quitar archivos</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modo: resolver conflictos */}
        {mode === 'conflict' && (
          <div className="space-y-3">
            <div className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              Se encontraron <strong>{conflictosKeys.length} conflictos</strong> entre los datos actuales y los extraídos por IA. Seleccioná cuál mantener en cada campo.
            </div>
            {FIELDS.map(field => (
              <ConflictRow
                key={field.key}
                field={field}
                valorActual={form[field.key]}
                valorIA={extracted?.[field.key]}
                eleccion={conflictos[field.key]}
                onChange={(choice) => handleResolveConflict(field.key, choice)}
              />
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setMode('edit')} className="flex-1">Cancelar y volver</Button>
              <Button onClick={handleApplyConflicts} disabled={!todosResueltos} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />Aplicar selección
              </Button>
            </div>
          </div>
        )}

        {/* Formulario manual */}
        {mode === 'edit' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {FIELDS.map(({ key, label, placeholder, type, wide, toggleable, toggleLabel }) => (
              <div key={key} className={wide ? 'sm:col-span-2' : ''}>
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type={type || 'text'}
                    value={form[key]}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={toggleable ? (form[key] === '' ? `(vacío = ${toggleLabel})` : placeholder) : placeholder}
                    className="text-sm flex-1"
                  />
                  {toggleable && form[key] !== '' && (
                    <button
                      type="button"
                      onClick={() => handleChange(key, '')}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      title={`Limpiar (marcar como ${toggleLabel})`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'edit' && (
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar datos de salud'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}