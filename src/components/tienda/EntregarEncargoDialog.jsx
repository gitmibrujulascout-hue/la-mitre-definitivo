import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function EntregarEncargoDialog({ encargo, producto, onClose }) {
  const [formaPago, setFormaPago] = useState('Efectivo');
  const defaultDestino = producto?.caja_exclusiva ? 'Caja exclusiva' : 'Caja';
  const [destino, setDestino] = useState(defaultDestino);
  const queryClient = useQueryClient();

  const entregar = useMutation({
    mutationFn: async () => {
      // 1. Crear VentaTienda
      const venta = await base44.entities.VentaTienda.create({
        producto_id: encargo.producto_id,
        producto_nombre: encargo.producto_nombre,
        beneficiario_id: encargo.beneficiario_id,
        beneficiario_nombre: encargo.beneficiario_nombre,
        talle: encargo.talle || undefined,
        cantidad: encargo.cantidad,
        precio_unitario: encargo.precio_unitario,
        monto_total: encargo.monto_total,
        fecha: new Date().toISOString().split('T')[0],
        forma_pago: formaPago,
        destino: destino,
        observaciones: 'Generado desde pre-encargo',
      });

      // 2. Crear MovimientoBanco si no es caja exclusiva
      if (destino === 'Caja' || destino === 'Banco') {
        await base44.entities.MovimientoBanco.create({
          fecha: new Date().toISOString().split('T')[0],
          tipo: 'Ingreso',
          concepto: `Venta tienda - ${encargo.producto_nombre} (${encargo.beneficiario_nombre})`,
          monto: encargo.monto_total,
          cuenta: destino,
          origen: 'Manual',
          referencia_id: venta.id,
        });
      }

      // 3. Actualizar pre-encargo a Entregado
      await base44.entities.PreEncargoTienda.update(encargo.id, {
        estado: 'Entregado',
        fecha_confirmacion: encargo.fecha_confirmacion || new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda_familia'] });
      toast.success('Pre-encargo entregado. Venta registrada.');
      onClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Entregar pre-encargo</DialogTitle>
          <DialogDescription>
            Al confirmar, se generará la venta y el ingreso de dinero correspondiente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm bg-muted/50 rounded-lg p-3 space-y-0.5">
            <p className="font-medium">{encargo.producto_nombre}</p>
            <p className="text-muted-foreground">Para: {encargo.beneficiario_nombre}</p>
            <p className="text-muted-foreground">{encargo.cantidad}u{encargo.talle ? ` · Talle ${encargo.talle}` : ''}</p>
            <p className="font-semibold text-green-600">{formatMoney(encargo.monto_total)}</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Forma de pago</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efectivo">Efectivo</SelectItem>
                <SelectItem value="Transferencia">Transferencia</SelectItem>
                <SelectItem value="Crédito actividad">Crédito actividad</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Destino del dinero</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Caja">Caja</SelectItem>
                <SelectItem value="Banco">Banco</SelectItem>
                <SelectItem value="Caja exclusiva">Caja exclusiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => entregar.mutate()} disabled={entregar.isPending}>
            Confirmar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}