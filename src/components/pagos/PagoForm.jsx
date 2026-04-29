import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MESES, CUOTA_EFECTIVO, CUOTA_TRANSFERENCIA, formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { Award } from 'lucide-react';

export default function PagoForm({ open, onClose, beneficiarios }) {
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [formaPago, setFormaPago] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObservaciones] = useState('');

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: data => base44.entities.Pago.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pagos'] }); onClose(); toast.success('Pago registrado'); },
  });

  const selectedBen = beneficiarios.find(b => b.id === beneficiarioId);
  const monto = formaPago === 'Efectivo' ? CUOTA_EFECTIVO : formaPago === 'Transferencia' ? CUOTA_TRANSFERENCIA : 0;

  const activeBeneficiarios = beneficiarios.filter(b => b.activo !== false && !b.becado);

  const handleSave = () => {
    if (!beneficiarioId || !mes || !formaPago) return;
    createMutation.mutate({
      beneficiario_id: beneficiarioId,
      beneficiario_nombre: selectedBen?.nombre || '',
      mes,
      anio: parseInt(anio),
      forma_pago: formaPago,
      monto,
      fecha_pago: fechaPago,
      observaciones
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Beneficiario *</Label>
            <Select value={beneficiarioId} onValueChange={setBeneficiarioId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario" /></SelectTrigger>
              <SelectContent>
                {activeBeneficiarios.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre} ({b.rama})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBen?.becado && (
              <div className="flex items-center gap-2 mt-2 p-2 rounded bg-amber-50 text-amber-700 text-sm">
                <Award className="w-4 h-4" />Este beneficiario está becado
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mes *</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                <SelectContent>
                  {MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Año *</Label>
              <Input value={anio} onChange={e => setAnio(e.target.value)} type="number" />
            </div>
          </div>

          <div>
            <Label>Forma de pago *</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efectivo">Efectivo — {formatMoney(CUOTA_EFECTIVO)}</SelectItem>
                <SelectItem value="Transferencia">Transferencia — {formatMoney(CUOTA_TRANSFERENCIA)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {monto > 0 && (
            <div className="p-3 rounded-lg bg-green-50 text-green-700 text-center">
              <p className="text-sm">Monto a registrar</p>
              <p className="text-xl font-bold">{formatMoney(monto)}</p>
            </div>
          )}

          <div>
            <Label>Fecha de pago</Label>
            <Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
          </div>
          <div>
            <Label>Observaciones</Label>
            <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!beneficiarioId || !mes || !formaPago}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}