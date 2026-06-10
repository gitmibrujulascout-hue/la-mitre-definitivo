import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { HeartPulse } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { SALUD_FIELDS as FIELDS, parseSaludForm } from '@/lib/saludFields';

// Para campos toggleable: "ninguno" = true si el valor actual es null/vacío
function buildForm(beneficiario) {
  const form = {};
  FIELDS.forEach(({ key, type }) => {
    form[key] = beneficiario?.[key] != null ? String(beneficiario[key]) : '';
  });
  return form;
}

// "ninguno" activo = el campo está vacío/null en el beneficiario actual
function buildToggleState(beneficiario) {
  const state = {};
  FIELDS.forEach(({ key, toggleable }) => {
    if (toggleable) {
      const val = beneficiario?.[key];
      // ninguno = true cuando no hay valor (el caso por defecto)
      state[key] = val == null || String(val).trim() === '';
    }
  });
  return state;
}

export default function FichaSaludFamiliaDialog({ open, onClose, beneficiario, onSaved }) {
  const [form, setForm] = useState(() => buildForm(beneficiario));
  // ninguno[key] = true → campo deshabilitado (no aplica), false → campo editable
  const [ninguno, setNinguno] = useState(() => buildToggleState(beneficiario));

  const enviarMutation = useMutation({
    mutationFn: (datos_propuestos) =>
      base44.entities.SolicitudCambioSalud.create({
        beneficiario_id: beneficiario.id,
        beneficiario_nombre: beneficiario.nombre,
        datos_propuestos,
        estado: 'Pendiente',
      }),
    onSuccess: () => {
      toast.success('¡Información enviada! Un responsable del grupo revisará y confirmará los datos en breve.');
      onClose();
      if (onSaved) onSaved();
    },
  });

  const handleChange = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleToggle = (key) => {
    const ahora = !ninguno[key];
    setNinguno(prev => ({ ...prev, [key]: ahora }));
    // Si se activa "ninguno", limpiar el campo
    if (ahora) setForm(prev => ({ ...prev, [key]: '' }));
  };

  const handleSave = () => {
    // Para campos toggleable con "ninguno" activo, forzar null
    const formFinal = { ...form };
    FIELDS.forEach(({ key, toggleable }) => {
      if (toggleable && ninguno[key]) formFinal[key] = '';
    });

    const toSend = parseSaludForm(formFinal);
    // Incluir también campos toggleable en "ninguno" como null explícito (para limpiar valores previos)
    FIELDS.forEach(({ key, toggleable }) => {
      if (toggleable && ninguno[key]) toSend[key] = null;
    });

    const toSendFiltered = Object.fromEntries(Object.entries(toSend).filter(([, v]) => v != null));
    // También enviar los que se pusieron en null explícitamente si el beneficiario tenía valor antes
    FIELDS.forEach(({ key, toggleable }) => {
      if (toggleable && ninguno[key] && beneficiario?.[key]) {
        toSendFiltered[key] = null;
      }
    });

    if (Object.keys(toSendFiltered).length === 0) {
      toast.error('Completá al menos un campo antes de enviar.');
      return;
    }
    enviarMutation.mutate(toSendFiltered);
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
            Esta información es confidencial y solo la ven los responsables del grupo. Completá los campos y enviá — un responsable revisará y confirmará los cambios.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {FIELDS.map(({ key, label, placeholder, type, wide, toggleable, toggleLabel }) => {
            const esNinguno = toggleable ? ninguno[key] : false;
            return (
              <div key={key} className={wide ? 'sm:col-span-2' : ''}>
                <Label className="text-xs text-muted-foreground">{label}</Label>

                {toggleable ? (
                  <div className="mt-1 space-y-1.5">
                    {/* Checkbox "ninguno" */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={esNinguno}
                        onChange={() => handleToggle(key)}
                        className="w-4 h-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                      />
                      <span className={`text-sm ${esNinguno ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {toggleLabel}
                      </span>
                    </label>
                    {/* Input — visible solo si no es ninguno */}
                    {!esNinguno && (
                      <Input
                        type={type || 'text'}
                        value={form[key]}
                        onChange={e => handleChange(key, e.target.value)}
                        placeholder={placeholder}
                        className="text-sm"
                        autoFocus
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    type={type || 'text'}
                    value={form[key]}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="mt-1 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={enviarMutation.isPending}>
            {enviarMutation.isPending ? 'Enviando...' : 'Enviar para revisión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}