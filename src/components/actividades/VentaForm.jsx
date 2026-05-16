import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/ramaUtils';

export default function VentaForm({ open, onClose, onSaved, actividad, beneficiarios }) {
  const [form, setForm] = useState({
    beneficiario_id: '',
    cantidad_vendida: '',
    comprador_nombre: '',
    observaciones: '',
  });

  const precioUnit = actividad?.precio_venta_unitario || 0;
  const cantidad = parseFloat(form.cantidad_vendida) || 0;
  const montoCalculado = precioUnit > 0 ? cantidad * precioUnit : 0;

  const mutation = useMutation({
    mutationFn: data => base44.entities.VentaActividad.create(data),
    onSuccess: () => { toast.success('Venta registrada'); onSaved(); },
  });

  const ben = beneficiarios.find(b => b.id === form.beneficiario_id);

  const handleSave = () => {
    if (!form.beneficiario_id || !form.cantidad_vendida) return;
    const monto = precioUnit > 0 ? montoCalculado : 0;
    mutation.mutate({
      actividad_id: actividad.id,
      actividad_nombre: actividad.nombre,
      beneficiario_id: form.beneficiario_id,
      beneficiario_nombre: ben?.nombre || '',
      cantidad_vendida: cantidad,
      monto_recaudado: monto,
      comprador_nombre: form.comprador_nombre || '',
      entregado: false,
      observaciones: form.observaciones || '',
    });
  };

  const benOptions = beneficiarios
    .filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !['Voluntario', 'Educador'].includes(b.rama))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar venta — {actividad?.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Beneficiario vendedor *</Label>
            <Select value={form.beneficiario_id} onValueChange={v => setForm(p => ({ ...p, beneficiario_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario" /></SelectTrigger>
              <SelectContent>
                {benOptions.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Cantidad vendida *</Label>
            <Input
              type="number"
              value={form.cantidad_vendida}
              onChange={e => setForm(p => ({ ...p, cantidad_vendida: e.target.value }))}
              placeholder="0"
            />
            {precioUnit > 0 && cantidad > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {cantidad} × {formatMoney(precioUnit)} = <span className="font-semibold text-green-600">{formatMoney(montoCalculado)}</span>
              </p>
            )}
            {precioUnit === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                La actividad no tiene precio unitario definido. El monto se calculará al distribuir.
              </p>
            )}
          </div>

          <div>
            <Label>Nombre del comprador externo</Label>
            <Input
              value={form.comprador_nombre}
              onChange={e => setForm(p => ({ ...p, comprador_nombre: e.target.value }))}
              placeholder="Nombre de quien retira el pedido (opcional)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Completá si la venta es para alguien externo que luego pasa a retirar
            </p>
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea
              value={form.observaciones}
              onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))}
              placeholder="Opcional"
              className="h-16"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!form.beneficiario_id || !form.cantidad_vendida || mutation.isPending}
          >
            Registrar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}