import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function VentaTiendaForm({ open, onClose, productos, beneficiarios }) {
  const [productoId, setProductoId] = useState('');
  const [talle, setTalle] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [esBeneficiario, setEsBeneficiario] = useState(false);
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [compradorNombre, setCompradorNombre] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formaPago, setFormaPago] = useState('Efectivo');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setProductoId(''); setTalle(''); setCantidad('1'); setPrecioUnitario('');
    setEsBeneficiario(false); setBeneficiarioId(''); setCompradorNombre('');
    setFecha(new Date().toISOString().split('T')[0]); setFormaPago('Efectivo');
  }, [open]);

  const producto = useMemo(() => productos.find(p => p.id === productoId), [productos, productoId]);

  // Auto-fill precio when product changes
  useEffect(() => {
    if (producto) setPrecioUnitario(producto.precio_venta?.toString() || '');
    setTalle(''); setCantidad('1');
  }, [productoId]);

  const stockDisponible = useMemo(() => {
    if (!producto) return 0;
    if (producto.tiene_talles) return producto.stock_por_talle?.[talle] ?? 0;
    return producto.stock ?? 0;
  }, [producto, talle]);

  const cantidadNum = parseInt(cantidad) || 0;
  const precioNum = parseFloat(precioUnitario) || 0;
  const montoTotal = cantidadNum * precioNum;
  const sinStock = producto && cantidadNum > stockDisponible;

  const ventaMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Crear la venta
      await base44.entities.VentaTienda.create(data);
      // 2. Descontar stock del producto
      let nuevoStock;
      if (producto.tiene_talles) {
        nuevoStock = { ...producto.stock_por_talle, [talle]: Math.max(0, stockDisponible - cantidadNum) };
        await base44.entities.ProductoTienda.update(producto.id, { stock_por_talle: nuevoStock });
      } else {
        nuevoStock = Math.max(0, (producto.stock || 0) - cantidadNum);
        await base44.entities.ProductoTienda.update(producto.id, { stock: nuevoStock });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_tienda'] });
      toast.success('Venta registrada y stock actualizado');
      onClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  const handleSave = () => {
    if (!producto || cantidadNum <= 0 || sinStock) return;
    ventaMutation.mutate({
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      beneficiario_id: esBeneficiario ? beneficiarioId : undefined,
      beneficiario_nombre: esBeneficiario
        ? beneficiarios.find(b => b.id === beneficiarioId)?.nombre
        : undefined,
      comprador_nombre: !esBeneficiario ? compradorNombre : undefined,
      talle: producto.tiene_talles ? talle : undefined,
      cantidad: cantidadNum,
      precio_unitario: precioNum,
      monto_total: montoTotal,
      fecha,
      forma_pago: formaPago,
      destino: formaPago === 'Transferencia' ? 'Banco' : 'Caja',
    });
  };

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
                  <SelectItem key={p.id} value={p.id}>{p.nombre} — {formatMoney(p.precio_venta)}</SelectItem>
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
              {producto && (
                <p className="text-xs text-muted-foreground mt-1">Disponible: {stockDisponible}</p>
              )}
            </div>
            <div>
              <Label>Precio unitario</Label>
              <Input type="number" value={precioUnitario} onChange={e => setPrecioUnitario(e.target.value)} />
            </div>
          </div>

          {sinStock && (
            <p className="text-sm text-red-500">⚠ Stock insuficiente para esta venta</p>
          )}

          {/* Comprador */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEsBeneficiario(true)}
              className={`flex-1 p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${esBeneficiario ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
              Beneficiario
            </button>
            <button type="button" onClick={() => setEsBeneficiario(false)}
              className={`flex-1 p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${!esBeneficiario ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
              Externo
            </button>
          </div>

          {esBeneficiario ? (
            <div>
              <Label>Beneficiario</Label>
              <Select value={beneficiarioId} onValueChange={setBeneficiarioId}>
                <SelectTrigger><SelectValue placeholder="Buscar beneficiario..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {beneficiarios.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Nombre del comprador</Label>
              <Input value={compradorNombre} onChange={e => setCompradorNombre(e.target.value)} placeholder="Nombre y apellido" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Forma de pago</Label>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Total de la venta</span>
            <span className="text-xl font-bold">{formatMoney(montoTotal)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!producto || cantidadNum <= 0 || sinStock || (esBeneficiario ? !beneficiarioId : !compradorNombre)}>
            Registrar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}