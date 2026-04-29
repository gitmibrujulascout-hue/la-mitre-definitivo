import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RAMAS } from '@/lib/ramaUtils';

export default function BeneficiarioForm({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState(initialData || {
    nombre: '', dni: '', fecha_nacimiento: '', rama: '', 
    becado: false, email_contacto: '', telefono_contacto: '', activo: true
  });

  const handleSave = () => {
    if (!form.nombre || !form.rama) return;
    onSave(form);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar' : 'Nuevo'} Beneficiario</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Nombre completo *</Label>
            <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>DNI</Label>
              <Input value={form.dni} onChange={e => update('dni', e.target.value)} placeholder="12345678" />
            </div>
            <div>
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={form.fecha_nacimiento} onChange={e => update('fecha_nacimiento', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Rama *</Label>
            <Select value={form.rama} onValueChange={v => update('rama', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar rama" /></SelectTrigger>
              <SelectContent>
                {RAMAS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email contacto</Label>
              <Input value={form.email_contacto} onChange={e => update('email_contacto', e.target.value)} placeholder="email@ejemplo.com" />
            </div>
            <div>
              <Label>Teléfono contacto</Label>
              <Input value={form.telefono_contacto} onChange={e => update('telefono_contacto', e.target.value)} placeholder="351-1234567" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div>
              <p className="text-sm font-medium">Becado</p>
              <p className="text-xs text-muted-foreground">No abona cuota mensual</p>
            </div>
            <Switch checked={form.becado} onCheckedChange={v => update('becado', v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.rama}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}