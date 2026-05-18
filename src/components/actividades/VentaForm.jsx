import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Tag } from 'lucide-react';

const emptyLinea = { producto_id: '', cantidad_vendida: '' };

export default function VentaForm({ open, onClose, onSaved, actividad, beneficiarios }) {
  const [beneficiario_id, setBeneficiarioId] = useState('');
  const [comprador_nombre, setCompradorNombre] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState([{ ...emptyLinea }]);

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-actividad', actividad?.id],
    queryFn: () => base44.entities.ProductoActividad.filter({ actividad_id: actividad.id }),
    enabled: !!actividad?.id,
  });

  const sorted = [...productos].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const tieneProductos = sorted.length > 0;

  const ben = beneficiarios.find(b => b.id === beneficiario_id);

  const benOptions = beneficiarios
    .filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !['Voluntario', 'Educador'].includes(b.rama))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

  const getProducto = (id) => productos.find(p => p.id === id);

  const calcLinea = (linea) => {
    const prod = getProducto(linea.producto_id);
    const precio = prod?.precio_venta || actividad?.precio_venta_unitario || 0;
    const cant = parseFloat(linea.cantidad_vendida) || 0;
    return { prod, precio, cant, monto: precio > 0 && cant > 0 ? cant * precio : 0 };
  };

  const totalMonto = lineas.reduce((s, l) => s + calcLinea(l).monto, 0);

  const setLinea = (i, campo, valor) => {
    setLineas(prev => prev.map((l, idx) =>
      idx === i ? { ...l, [campo]: valor, ...(campo === 'producto_id' ? { cantidad_vendida: '' } : {}) } : l
    ));
  };

  const addLinea = () => setLineas(prev => [...prev, { ...emptyLinea }]);
  const removeLinea = (i) => setLineas(prev => prev.filter((_, idx) => idx !== i));

  const createMut = useMutation({
    mutationFn: data => base44.entities.VentaActividad.create(data),
  });

  const handleSave = async () => {
    if (!beneficiario_id) return;
    const lineasValidas = lineas.filter(l => parseFloat(l.cantidad_vendida) > 0);
    if (lineasValidas.length === 0) return;

    for (const linea of lineasValidas) {
      const { prod, precio, cant, monto } = calcLinea(linea);
      await createMut.mutateAsync({
        actividad_id: actividad.id,
        actividad_nombre: actividad.nombre,
        beneficiario_id,
        beneficiario_nombre: ben?.nombre || '',
        producto_id: prod?.id || '',
        producto_nombre: prod?.nombre || '',
        precio_unitario_aplicado: precio,
        es_promo: prod?.es_promo || false,
        cantidad_promo: prod?.es_promo ? prod.cantidad_promo : null,
        cantidad_vendida: cant,
        monto_recaudado: monto,
        comprador_nombre: comprador_nombre || '',
        entregado: false,
        observaciones: observaciones || '',
      });
    }

    toast.success(lineasValidas.length === 1 ? 'Venta registrada' : `${lineasValidas.length} ventas registradas`);
    onSaved();
  };

  const canSave = beneficiario_id && lineas.some(l => parseFloat(l.cantidad_vendida) > 0) && !createMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pedido — {actividad?.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Beneficiario */}
          <div>
            <Label>Beneficiario vendedor *</Label>
            <Select value={beneficiario_id} onValueChange={setBeneficiarioId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario" /></SelectTrigger>
              <SelectContent>
                {benOptions.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comprador externo */}
          <div>
            <Label>Nombre del comprador externo</Label>
            <Input
              value={comprador_nombre}
              onChange={e => setCompradorNombre(e.target.value)}
              placeholder="Nombre de quien retira el pedido (opcional)"
            />
          </div>

          {/* Líneas de productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Productos del pedido *</Label>
              {tieneProductos && (
                <Button type="button" size="sm" variant="outline" onClick={addLinea}>
                  <Plus className="w-3 h-3 mr-1" />Agregar producto
                </Button>
              )}
            </div>

            {!tieneProductos && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                Esta actividad no tiene productos definidos. Podés agregarlos desde el panel de Productos/Precios.
              </p>
            )}

            <div className="space-y-3">
              {lineas.map((linea, i) => {
                const { prod, precio, cant, monto } = calcLinea(linea);
                const unidadesFisicas = prod?.es_promo && prod?.cantidad_promo ? cant * prod.cantidad_promo : null;
                return (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Línea {i + 1}</span>
                      {lineas.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLinea(i)}>
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>

                    {/* Producto */}
                    {tieneProductos && (
                      <Select value={linea.producto_id} onValueChange={v => setLinea(i, 'producto_id', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto o promo" />
                        </SelectTrigger>
                        <SelectContent>
                          {sorted.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                {p.nombre}
                                {p.es_promo && <span className="text-amber-600 text-xs">({p.cantidad_promo}x)</span>}
                                <span className="text-muted-foreground text-xs">— {formatMoney(p.precio_venta)}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {prod && (
                      <div className="flex gap-2 flex-wrap">
                        {prod.es_promo ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">
                            <Tag className="w-2.5 h-2.5 mr-1" />
                            Promo {prod.cantidad_promo} uds por {formatMoney(prod.precio_venta)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Precio: {formatMoney(prod.precio_venta)} c/u</span>
                        )}
                      </div>
                    )}

                    {/* Cantidad */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={linea.cantidad_vendida}
                        onChange={e => setLinea(i, 'cantidad_vendida', e.target.value)}
                        placeholder={prod?.es_promo ? 'Cantidad de promos' : 'Cantidad'}
                        className="w-36"
                      />
                      {precio > 0 && cant > 0 && (
                        <span className="text-xs text-muted-foreground">
                          = <span className="font-semibold text-green-600">{formatMoney(monto)}</span>
                          {unidadesFisicas && <span className="ml-1">({unidadesFisicas} uds físicas)</span>}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          {totalMonto > 0 && (
            <div className="flex justify-end">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-right">
                <p className="text-xs text-muted-foreground">Total del pedido</p>
                <p className="text-lg font-bold text-green-700">{formatMoney(totalMonto)}</p>
              </div>
            </div>
          )}

          <div>
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Opcional"
              className="h-14"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {createMut.isPending ? 'Guardando...' : `Registrar pedido${lineas.length > 1 ? ` (${lineas.filter(l => parseFloat(l.cantidad_vendida) > 0).length} productos)` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}