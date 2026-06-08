import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { HeartPulse } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const FIELDS = [
  { key: 'grupo_sanguineo', label: 'Grupo sanguíneo', placeholder: 'Ej: A, B, AB, O' },
  { key: 'factor_rh', label: 'Factor RH', placeholder: 'Positivo / Negativo' },
  { key: 'peso_kg', label: 'Peso (kg)', placeholder: 'Ej: 65', type: 'number' },
  { key: 'talla_m', label: 'Talla (m)', placeholder: 'Ej: 1.65', type: 'number' },
  { key: 'alergias', label: 'Alergias conocidas', placeholder: 'Alimentos, medicamentos, látex... (o "Ninguna")' },
  { key: 'condicion_medica', label: 'Afección / Enfermedad crónica', placeholder: 'Asma, diabetes, epilepsia... (o "Ninguna")' },
  { key: 'medicacion_habitual', label: 'Medicación habitual', placeholder: 'Nombre y dosis (o "No toma")' },
  { key: 'regimen_dietario', label: 'Régimen dietario especial', placeholder: 'Celíaco, vegetariano, sin TACC... (o "Ninguno")' },
  { key: 'anticoagulacion', label: 'Anticoagulación', placeholder: 'Droga utilizada (o dejar vacío si no)' },
  { key: 'salud_mental', label: 'Salud mental', placeholder: 'Diagnóstico o tratamiento relevante (si lo hay)' },
  { key: 'discapacidad', label: 'Discapacidad / CUD', placeholder: 'N° de certificado o descripción (si tiene)' },
  { key: 'obra_social', label: 'Obra social / Prepaga', placeholder: 'Nombre de la cobertura' },
  { key: 'numero_obra_social', label: 'N° de afiliado', placeholder: 'N° de credencial' },
  { key: 'contacto_emergencia_nombre', label: 'Contacto emergencia (nombre)', placeholder: 'Nombre completo' },
  { key: 'contacto_emergencia_telefono', label: 'Contacto emergencia (teléfono)', placeholder: 'Teléfono' },
  { key: 'contacto_emergencia_relacion', label: 'Relación del contacto', placeholder: 'Madre, padre, tutor...' },
  { key: 'observaciones_salud', label: 'Observaciones adicionales', placeholder: 'Cualquier dato importante que debamos saber', wide: true },
];

function buildForm(b) {
  const f = {};
  FIELDS.forEach(({ key }) => { f[key] = b?.[key] != null ? String(b[key]) : ''; });
  return f;
}

export default function FichaSaludFamiliaDialog({ open, onClose, beneficiario, onSaved }) {
  const [form, setForm] = useState(() => buildForm(beneficiario));
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Beneficiario.update(beneficiario.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
      toast.success('Información de salud guardada. ¡Gracias!');
      onClose();
      if (onSaved) onSaved();
    },
  });

  const handleChange = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    const toSave = {};
    FIELDS.forEach(({ key, type }) => {
      const val = form[key];
      if (val && val.trim() !== '') {
        toSave[key] = type === 'number' ? parseFloat(val) : val.trim();
      }
    });
    updateMutation.mutate(toSave);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-primary" />
            Información médica — {beneficiario?.nombre}
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Esta información es confidencial y solo la ven los responsables del grupo. Completá los campos que correspondan y guardá.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {FIELDS.map(({ key, label, placeholder, type, wide }) => (
            <div key={key} className={wide ? 'sm:col-span-2' : ''}>
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type={type || 'text'}
                value={form[key]}
                onChange={e => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className="mt-1 text-sm"
              />
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Guardando...' : 'Guardar información'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}