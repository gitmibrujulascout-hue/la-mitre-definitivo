import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function VentaTiendaForm({ open, onClose, productos, beneficiarios, ventas = [] }) {
  const [productoId, setProductoId] = useState('');
  const [talle, setTalle] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  const producto = productos.find(p => p.id === productoId);
  const ben = beneficiarios.find(b => b.id === beneficiarioId);

  useEffect(() => {
    if (!open) return;
    setProductoId(''); setTalle(''); setCantidad('1'); setPrecioUnitario('');
    setBeneficiarioId('');
    setFecha(new Date().toISOString().split('T')[0]);
  }, [open]);

  useEffect(() => {
    if (producto) setPrecioUnitario(producto.precio_venta?.toString() || '');
    setTalle(''); setCantidad('1');
  }, [productoId]);

  const cantidadNum = parseInt(cantidad) || 0;
  const precioNum = parseFloat(precioUnitario) || 0;
  const montoTotal = cantidadNum * precioNum;

  const ventaMutation = useMutation({
    mutationFn: async () => {
      const destino = 'Caja';
      await base44.entities.VentaTienda.create({
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        beneficiario_id: beneficiarioId,
        beneficiario_nombre: ben?.nombre,
        talle: producto.tiene_talles ? talle : undefined,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
        monto_total: montoTotal,
        fecha,
        forma_pago: 'Efectivo',
        destino,
      });

      // Decrement stock
      if (producto.tiene_talles) {
        const stockActual = producto.stock_por_talle?.[talle] ?? 0;
        const nuevoStock = { ...producto.stock_por_talle, [talle]: Math.max(0, stockActual - cantidadNum) };
        await base44.entities.ProductoTienda.update(producto.id, { stock_por_talle: nuevoStock });
      } else {
        const nuevoStock = Math.max(0, (producto.stock || 0) - cantidadNum);
        await base44.entities.ProductoTienda.update(producto.id, { stock: nuevoStock });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_tienda'] });
      toast.success('Venta registrada en efectivo');
      onClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  const puedeGuardar = producto && cantidadNum > 0 && beneficiarioId && (producto.tiene_talles ? !!talle : true);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva venta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Producto *</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {productos.filter(p => p.activo !== false).map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {formatMoney(p.precio_venta)}
                    {p.es_combo ? ' 📦' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {producto?.tiene_talles && (
            <div>
              <Label>Talle *</Label>
              <Select value={talle} onValueChange={setTalle}>
                <SelectTrigger><SelectValue placeholder="Seleccionar talle..." /></SelectTrigger>
                <SelectContent>
                  {producto.talles?.map(t => (
                    <SelectItem key={t} value={t} disabled={(producto.stock_por_talle?.[t] ?? 0) === 0}>
                      {t} ({producto.stock_por_talle?.[t] ?? 0} disp.)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cantidad *</Label>
              <Input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
            <div>
              <Label>Precio unitario</Label>
              <Input type="number" value={precioUnitario} onChange={e => setPrecioUnitario(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Beneficiario *</Label>
            <Select value={beneficiarioId} onValueChange={setBeneficiarioId}>
              <SelectTrigger><SelectValue placeholder="Buscar beneficiario..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {beneficiarios.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total (efectivo)</span>
              <span className="text-xl font-bold">{formatMoney(montoTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => ventaMutation.mutate()} disabled={!puedeGuardar || ventaMutation.isPending}>
            {ventaMutation.isPending ? 'Registrando...' : 'Registrar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}