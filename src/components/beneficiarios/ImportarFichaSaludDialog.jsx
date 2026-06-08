import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, Sparkles, FileText, X, CheckCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const SALUD_SCHEMA = {
  type: 'object',
  properties: {
    alergias: { type: 'string', description: 'Alergias conocidas (alimentos, medicamentos, etc.). Null si no tiene.' },
    condicion_medica: { type: 'string', description: 'Enfermedades crónicas o afecciones relevantes. Null si no tiene.' },
    medicacion_habitual: { type: 'string', description: 'Medicación que toma habitualmente. Null si no toma.' },
    grupo_sanguineo: { type: 'string', description: 'Grupo sanguíneo (A, B, AB, O). Null si no está.' },
    factor_rh: { type: 'string', description: 'Factor RH (Positivo o Negativo). Null si no está.' },
    obra_social: { type: 'string', description: 'Nombre de la obra social o prepaga. Null si no tiene.' },
    numero_obra_social: { type: 'string', description: 'Número de credencial o afiliado de la obra social.' },
    contacto_emergencia_nombre: { type: 'string', description: 'Nombre de la persona de contacto en emergencias.' },
    contacto_emergencia_telefono: { type: 'string', description: 'Teléfono del contacto de emergencia.' },
    contacto_emergencia_relacion: { type: 'string', description: 'Relación del contacto de emergencia (ej: madre, padre, tutor).' },
    observaciones_salud: { type: 'string', description: 'Otras observaciones relevantes: régimen dietario, salud mental, convulsiones, cirugías, anticoagulación, fobias, etc.' },
  }
};

const FIELD_LABELS = {
  alergias: 'Alergias',
  condicion_medica: 'Afección / Enfermedad crónica',
  medicacion_habitual: 'Medicación habitual',
  grupo_sanguineo: 'Grupo sanguíneo',
  factor_rh: 'Factor RH',
  obra_social: 'Obra social / Prepaga',
  numero_obra_social: 'N° de afiliado',
  contacto_emergencia_nombre: 'Contacto emergencia (nombre)',
  contacto_emergencia_telefono: 'Contacto emergencia (tel)',
  contacto_emergencia_relacion: 'Contacto emergencia (relación)',
  observaciones_salud: 'Observaciones de salud',
};

export default function ImportarFichaSaludDialog({ open, onClose, beneficiario, onSaved }) {
  const [files, setFiles] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
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

    try {
      const merged = {};

      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: SALUD_SCHEMA,
        });
        if (result.status === 'success' && result.output) {
          const data = Array.isArray(result.output) ? result.output[0] : result.output;
          // Merge: solo sobreescribir si el valor nuevo no es null/vacío
          Object.entries(data).forEach(([k, v]) => {
            if (v && v !== 'null' && v !== 'No' && v !== 'NO') {
              merged[k] = v;
            }
          });
        }
      }

      setExtracted(merged);
    } catch (e) {
      toast.error('Error al analizar los archivos');
    } finally {
      setExtracting(false);
    }
  };

  const handleChange = (key, val) => {
    setExtracted(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    if (!extracted) return;
    // Filtrar campos vacíos
    const toSave = Object.fromEntries(
      Object.entries(extracted).filter(([, v]) => v && v.trim() !== '')
    );
    updateMutation.mutate(toSave);
  };

  const hasData = extracted && Object.values(extracted).some(v => v && v.trim?.() !== '');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Importar Ficha de Salud con IA
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Subí los PDFs completados de <strong>{beneficiario?.nombre}</strong>. La IA extraerá automáticamente los datos de salud.
          </p>
        </DialogHeader>

        {/* Carga de archivos */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Hacé clic para seleccionar PDFs</p>
          <p className="text-xs text-muted-foreground mt-1">Ficha de salud, ficha de afiliado, etc. (PDF)</p>
          <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFiles} />
        </div>

        {/* Lista de archivos seleccionados */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {!extracted && (
              <Button onClick={handleExtract} disabled={extracting} className="w-full">
                {extracting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Analizando con IA...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Analizar con IA</>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Resultado extraído */}
        {extracted && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Datos extraídos — revisá y corregí si es necesario</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.keys(FIELD_LABELS).map(key => (
                <div key={key} className={key === 'observaciones_salud' ? 'sm:col-span-2' : ''}>
                  <Label className="text-xs text-muted-foreground">{FIELD_LABELS[key]}</Label>
                  <Input
                    value={extracted[key] || ''}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder="—"
                    className="mt-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {hasData && (
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar en beneficiario'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}