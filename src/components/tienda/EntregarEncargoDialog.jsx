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
        fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
        forma_pago: formaPago,
        destino: destino,
        observaciones: 'Generado desde pre-encargo',
      });

      // 2. Registrar en la caja solo el saldo pendiente (las señas ya se registraron al pagarse)
      const saldoPendiente = Math.max(0, (encargo.monto_total || 0) - (encargo.monto_pagado || 0));
      if (saldoPendiente > 0) {
        await base44.entities.MovimientoBanco.create({
          fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
          tipo: 'Ingreso',
          concepto: `Venta tienda - ${encargo.producto_nombre} (${encargo.beneficiario_nombre})`,
          monto: saldoPendiente,
          cuenta: destino,
          origen: 'Manual',
          referencia_id: venta.id,
        });
      }

      // 3. Decrementar stock físico (la entrega consume el stock real)
      const prod = await base44.entities.ProductoTienda.get(encargo.producto_id);
      if (prod) {
        if (prod.tiene_talles && encargo.talle) {
          const stockActual = prod.stock_por_talle?.[encargo.talle] ?? 0;
          await base44.entities.ProductoTienda.update(prod.id, {
            stock_por_talle: { ...prod.stock_por_talle, [encargo.talle]: Math.max(0, stockActual - (encargo.cantidad || 0)) },
          });
        } else {
          await base44.entities.ProductoTienda.update(prod.id, {
            stock: Math.max(0, (prod.stock || 0) - (encargo.cantidad || 0)),
          });
        }
      }

      // 4. Actualizar pre-encargo a Entregado (la reserva deja de contar, el stock físico ya fue consumido)
      await base44.entities.PreEncargoTienda.update(encargo.id, {
        estado: 'Entregado',
        stock_reservado: false,
        fecha_confirmacion: encargo.fecha_confirmacion || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda_familia'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      toast.success('Pre-encargo entregado. Venta registrada y stock actualizado.');
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
            Al confirmar, se generará la venta, el ingreso de dinero y se descontará el stock físico.
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
            <Select value={destino} onValueChange={setDestino} disabled={producto?.caja_exclusiva}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {producto?.caja_exclusiva ? (
                  <SelectItem value="Caja exclusiva">Caja exclusiva</SelectItem>
                ) : (
                  <>
                    <SelectItem value="Caja">Caja</SelectItem>
                    <SelectItem value="Banco">Banco</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {producto?.caja_exclusiva && (
              <p className="text-xs text-purple-600 mt-1">Este producto pertenece a la caja exclusiva de la tienda.</p>
            )}
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