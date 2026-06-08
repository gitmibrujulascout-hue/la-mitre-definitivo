import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { HeartPulse } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { SALUD_FIELDS as FIELDS, buildSaludForm as buildForm, parseSaludForm } from '@/lib/saludFields';

export default function FichaSaludFamiliaDialog({ open, onClose, beneficiario, onSaved }) {
  const [form, setForm] = useState(() => buildForm(beneficiario));

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

  const handleSave = () => {
    const toSend = parseSaludForm(form);
    // Filtrar nulls para no enviar campos vacíos en la solicitud
    const toSendFiltered = Object.fromEntries(Object.entries(toSend).filter(([, v]) => v != null));
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
          <Button onClick={handleSave} disabled={enviarMutation.isPending}>
            {enviarMutation.isPending ? 'Enviando...' : 'Enviar para revisión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}