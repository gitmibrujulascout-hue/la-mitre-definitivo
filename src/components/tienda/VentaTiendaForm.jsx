import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { getStockDisponiblePorTalle } from '@/lib/tiendaStock';

export default function VentaTiendaForm({ open, onClose, productos, beneficiarios, preEncargos = [] }) {
  const [items, setItems] = useState([]);
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [formaPago, setFormaPago] = useState('Efectivo');
  const queryClient = useQueryClient();

  const ben = beneficiarios.find(b => b.id === beneficiarioId);

  const { data: creditosBen = [] } = useQuery({
    queryKey: ['creditos-venta', beneficiarioId],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ beneficiario_id: beneficiarioId }),
    enabled: !!beneficiarioId,
  });
  const creditoDisponible = creditosBen.filter(c => (c.monto_disponible || 0) > 0).reduce((s, c) => s + (c.monto_disponible || 0), 0);

  useEffect(() => {
    if (!open) return;
    setItems([{ productoId: '', talle: '', cantidad: '1', precioUnitario: '' }]);
    setBeneficiarioId('');
    setFecha(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  }, [open]);

  const updateItem = (idx, field, val) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'productoId') {
        const prod = productos.find(p => p.id === val);
        next[idx].precioUnitario = prod ? (prod.precio_venta?.toString() || '') : '';
        next[idx].talle = '';
        next[idx].cantidad = '1';
      }
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, { productoId: '', talle: '', cantidad: '1', precioUnitario: '' }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalGeneral = items.reduce((sum, it) => {
    const cant = parseInt(it.cantidad) || 0;
    const precio = parseFloat(it.precioUnitario) || 0;
    return sum + (cant * precio);
  }, 0);

  const ventaMutation = useMutation({
    mutationFn: async () => {
      for (const it of items) {
        const prod = productos.find(p => p.id === it.productoId);
        if (!prod) continue;
        const cant = parseInt(it.cantidad) || 0;
        const precio = parseFloat(it.precioUnitario) || 0;

        const venta = await base44.entities.VentaTienda.create({
          producto_id: prod.id,
          producto_nombre: prod.nombre,
          beneficiario_id: beneficiarioId,
          beneficiario_nombre: ben?.nombre,
          talle: prod.tiene_talles ? it.talle : undefined,
          cantidad: cant,
          precio_unitario: precio,
          monto_total: cant * precio,
          fecha,
          forma_pago: formaPago,
          destino: prod.caja_exclusiva ? 'Caja exclusiva' : (formaPago === 'Transferencia' ? 'Banco' : 'Caja'),
          observaciones: formaPago === 'Crédito actividad' ? 'Crédito aplicado' : undefined,
        });

        // El ingreso de dinero se deriva automáticamente de VentaTienda en cajaUtils.
        // No se crea MovimientoBanco (fuente única: VentaTienda).

        // Decrement stock
        if (prod.tiene_talles && it.talle) {
          const stockActual = prod.stock_por_talle?.[it.talle] ?? 0;
          await base44.entities.ProductoTienda.update(prod.id, {
            stock_por_talle: { ...prod.stock_por_talle, [it.talle]: Math.max(0, stockActual - cant) },
          });
        } else {
          await base44.entities.ProductoTienda.update(prod.id, {
            stock: Math.max(0, (prod.stock || 0) - cant),
          });
        }

        // Si es pago con crédito, descontar del crédito del beneficiario (FIFO)
        if (formaPago === 'Crédito actividad') {
          let montoRestar = cant * precio;
          const creditosDisp = creditosBen.filter(c => (c.monto_disponible || 0) > 0)
            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
          for (const cr of creditosDisp) {
            if (montoRestar <= 0) break;
            const descuento = Math.min(cr.monto_disponible, montoRestar);
            await base44.entities.CreditoBeneficiario.update(cr.id, {
              monto_disponible: Math.max(0, cr.monto_disponible - descuento),
            });
            montoRestar -= descuento;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-venta', beneficiarioId] });
      queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario', beneficiarioId] });
      toast.success(`${items.length} venta(s) registrada(s)`);
      onClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  const puedeGuardar = beneficiarioId && items.every(it => {
    const prod = productos.find(p => p.id === it.productoId);
    if (!prod) return false;
    if ((parseInt(it.cantidad) || 0) <= 0) return false;
    if (prod.tiene_talles && !it.talle) return false;
    // Validar stock disponible (físico - reservas)
    const disp = prod.tiene_talles
      ? getStockDisponiblePorTalle(prod, preEncargos)[it.talle] ?? 0
      : getStockDisponiblePorTalle(prod, preEncargos)._sin_talle ?? 0;
    if ((parseInt(it.cantidad) || 0) > Math.max(0, disp)) return false;
    return true;
  }) && (formaPago !== 'Crédito actividad' || totalGeneral <= creditoDisponible);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva venta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Beneficiario *</Label>
              <Select value={beneficiarioId} onValueChange={setBeneficiarioId}>
                <SelectTrigger><SelectValue placeholder="Buscar..." /></SelectTrigger>
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
          </div>

          {/* Items */}
          <div className="space-y-3">
            {items.map((it, idx) => {
              const prod = productos.find(p => p.id === it.productoId);
              const cant = parseInt(it.cantidad) || 0;
              const precio = parseFloat(it.precioUnitario) || 0;
              return (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Producto *</Label>
                      <Select value={it.productoId} onValueChange={v => updateItem(idx, 'productoId', v)}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent className="max-h-60">
                          {productos.filter(p => p.activo !== false).map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre} — {formatMoney(p.precio_venta)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 mt-5 shrink-0" onClick={() => removeItem(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>

                  {prod?.tiene_talles && (
                    <div>
                      <Label className="text-xs">Talle *</Label>
                      <Select value={it.talle} onValueChange={v => updateItem(idx, 'talle', v)}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Talle..." /></SelectTrigger>
                        <SelectContent>
                          {prod.talles?.map(t => {
                            const disp = Math.max(0, getStockDisponiblePorTalle(prod, preEncargos)[t] ?? 0);
                            return (
                              <SelectItem key={t} value={t} disabled={disp === 0}>
                                {t} ({disp} disp.)
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Cant.</Label>
                      <Input type="number" min="1" className="h-8" value={it.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Precio unit.</Label>
                      <Input type="number" className="h-8" value={it.precioUnitario} onChange={e => updateItem(idx, 'precioUnitario', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Subtotal</Label>
                      <div className="h-8 flex items-center font-semibold text-sm">{formatMoney(cant * precio)}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" />Agregar producto
            </Button>
          </div>

          <div>
            <Label>Forma de pago</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efectivo">Efectivo → Caja</SelectItem>
                <SelectItem value="Transferencia">Transferencia → Banco</SelectItem>
                <SelectItem value="Crédito actividad" disabled={creditoDisponible <= 0}>
                  Crédito actividad {creditoDisponible > 0 ? `(${formatMoney(creditoDisponible)} disp.)` : '(sin crédito)'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total {formaPago === 'Crédito actividad' ? '(crédito)' : formaPago === 'Transferencia' ? '(transferencia)' : '(efectivo)'}
              </span>
              <span className="text-xl font-bold">{formatMoney(totalGeneral)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => ventaMutation.mutate()} disabled={!puedeGuardar || ventaMutation.isPending}>
            {ventaMutation.isPending ? 'Registrando...' : `Registrar ${items.length} venta(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}