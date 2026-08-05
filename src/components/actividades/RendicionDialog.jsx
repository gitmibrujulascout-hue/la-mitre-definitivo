import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney } from '@/lib/ramaUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function RendicionDialog({ open, onClose, venta, actividadId }) {
  const [estado, setEstado] = useState(venta?.estado_rendicion || 'Sin rendir');
  const [montoRendido, setMontoRendido] = useState(venta?.monto_rendido ?? '');
  const queryClient = useQueryClient();

  const saldoPendiente = (venta?.monto_recaudado || 0) - (parseFloat(montoRendido) || 0);

  const mutation = useMutation({
    mutationFn: data => base44.entities.VentaActividad.update(venta.id, data),
    onSuccess: () => {
      toast.success('Rendición actualizada');
      queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividadId] });
      onClose();
    },
  });

  const handleSave = () => {
    const monto = estado === 'Rendido'
      ? venta.monto_recaudado
      : parseFloat(montoRendido) || 0;
    mutation.mutate({
      estado_rendicion: estado,
      monto_rendido: monto,
      fecha_rendicion: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rendición de dinero</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-semibold">{venta?.beneficiario_nombre}</p>
            {venta?.producto_nombre && <p className="text-muted-foreground">{venta.producto_nombre}</p>}
            <p className="text-green-700 font-bold mt-1">Total a rendir: {formatMoney(venta?.monto_recaudado || 0)}</p>
          </div>

          <div>
            <Label>Estado de rendición</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sin rendir">Sin rendir</SelectItem>
                <SelectItem value="Parcial">Parcial (entregó parte)</SelectItem>
                <SelectItem value="Rendido">Rendido completo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {estado === 'Parcial' && (
            <div>
              <Label>Monto rendido</Label>
              <Input
                type="number"
                value={montoRendido}
                onChange={e => setMontoRendido(e.target.value)}
                placeholder="0"
              />
              {parseFloat(montoRendido) > 0 && (
                <p className="text-xs mt-1 text-amber-700">
                  Saldo pendiente: <span className="font-bold">{formatMoney(saldoPendiente)}</span>
                </p>
              )}
            </div>
          )}

          {estado === 'Rendido' && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
              Se marcará como rendido el total: {formatMoney(venta?.monto_recaudado || 0)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            Guardar rendición
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}