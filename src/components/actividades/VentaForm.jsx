import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/ramaUtils';

export default function VentaForm({ open, onClose, onSaved, actividad, beneficiarios }) {
  const [form, setForm] = useState({ beneficiario_id: '', cantidad_vendida: '', monto_recaudado: '' });

  const pctBen = actividad.porcentaje_beneficiario || 50;
  const pctGrupo = actividad.porcentaje_grupo || 50;

  const creditoBen = Math.round((parseFloat(form.monto_recaudado) || 0) * pctBen / 100 * 100) / 100;
  const creditoGrupo = Math.round((parseFloat(form.monto_recaudado) || 0) * pctGrupo / 100 * 100) / 100;

  const mutation = useMutation({
    mutationFn: data => base44.entities.VentaActividad.create(data),
    onSuccess: () => { toast.success('Venta registrada'); onSaved(); },
  });

  const ben = beneficiarios.find(b => b.id === form.beneficiario_id);

  const handleSave = () => {
    if (!form.beneficiario_id || !form.monto_recaudado) return;
    mutation.mutate({
      actividad_id: actividad.id,
      actividad_nombre: actividad.nombre,
      beneficiario_id: form.beneficiario_id,
      beneficiario_nombre: ben?.nombre || '',
      cantidad_vendida: parseFloat(form.cantidad_vendida) || 0,
      monto_recaudado: parseFloat(form.monto_recaudado) || 0,
      credito_beneficiario: creditoBen,
      credito_grupo: creditoGrupo,
      acreditado: false,
    });
  };

  const benOptions = beneficiarios.filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !['Voluntario', 'Educador'].includes(b.rama));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Beneficiario *</Label>
            <Select value={form.beneficiario_id} onValueChange={v => setForm(p => ({ ...p, beneficiario_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario" /></SelectTrigger>
              <SelectContent>
                {benOptions.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cantidad vendida</Label>
              <Input type="number" value={form.cantidad_vendida} onChange={e => setForm(p => ({ ...p, cantidad_vendida: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Monto recaudado *</Label>
              <Input type="number" value={form.monto_recaudado} onChange={e => setForm(p => ({ ...p, monto_recaudado: e.target.value }))} placeholder="0" />
            </div>
          </div>
          {parseFloat(form.monto_recaudado) > 0 && (
            <div className="grid grid-cols-2 gap-3 bg-muted/50 rounded-lg p-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Crédito al beneficiario ({pctBen}%)</p>
                <p className="font-bold text-primary">{formatMoney(creditoBen)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Para el grupo ({pctGrupo}%)</p>
                <p className="font-bold text-green-600">{formatMoney(creditoGrupo)}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.beneficiario_id || !form.monto_recaudado || mutation.isPending}>Registrar venta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}