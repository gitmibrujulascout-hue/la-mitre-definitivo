import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const CATS = ['Materiales', 'Insumos', 'Transporte', 'Packaging', 'Servicios', 'Otro'];

export default function GastoActividadForm({ open, onClose, onSaved, actividad }) {
  const [form, setForm] = useState({
    descripcion: '', monto: '', fecha: actividad.fecha || new Date().toISOString().split('T')[0],
    categoria: 'Insumos', observaciones: '',
  });

  const mutation = useMutation({
    mutationFn: data => base44.entities.GastoActividad.create(data),
    onSuccess: () => { toast.success('Gasto registrado'); onSaved(); },
  });

  const handleSave = () => {
    if (!form.descripcion || !form.monto) return;
    mutation.mutate({
      ...form,
      monto: parseFloat(form.monto) || 0,
      actividad_id: actividad.id,
      actividad_nombre: actividad.nombre,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar gasto de actividad</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Descripción *</Label>
            <Input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Harina, aceite, packaging" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto *</Label>
              <Input type="number" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.descripcion || !form.monto || mutation.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}