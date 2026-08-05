import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const CATS = ['Materiales', 'Alimentos', 'Transporte', 'Servicios', 'Mantenimiento', 'Campamento', 'Otro'];

export default function GastoActividadForm({ open, onClose, onSaved, actividad }) {
  const [form, setForm] = useState({
    descripcion: '', monto: '', fecha: actividad?.fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
    categoria: 'Alimentos', forma_pago: 'Efectivo', proveedor: '', numero_factura: '', observaciones: '',
  });

  const mutation = useMutation({
    mutationFn: data => base44.entities.Gasto.create(data),
    onSuccess: () => { toast.success('Gasto registrado'); onSaved(); },
  });

  const handleSave = () => {
    if (!form.descripcion || !form.monto) return;
    mutation.mutate({
      descripcion: form.descripcion,
      monto: parseFloat(form.monto) || 0,
      fecha: form.fecha,
      categoria: form.categoria,
      forma_pago: form.forma_pago,
      destino: form.forma_pago === 'Transferencia' ? 'Banco' : 'Caja',
      proveedor: form.proveedor || undefined,
      numero_factura: form.numero_factura || undefined,
      observaciones: form.observaciones || undefined,
      actividad_id: actividad.id,
      actividad_nombre: actividad.nombre,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gasto de actividad — {actividad?.nombre}</DialogTitle>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pago</Label>
              <Select value={form.forma_pago} onValueChange={v => setForm(p => ({ ...p, forma_pago: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo (Caja)</SelectItem>
                  <SelectItem value="Transferencia">Transferencia (Banco)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Proveedor</Label>
            <Input value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} placeholder="Comercio o proveedor (opcional)" />
          </div>
          <div>
            <Label>N° de factura / recibo</Label>
            <Input value={form.numero_factura} onChange={e => setForm(p => ({ ...p, numero_factura: e.target.value }))} placeholder="Para rendición contable (opcional)" />
          </div>
          <div>
            <Label>Observaciones</Label>
            <Input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} placeholder="Opcional" />
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