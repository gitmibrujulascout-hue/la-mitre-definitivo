import React, { useState, useEffect } from 'react';
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
import { Tag } from 'lucide-react';

export default function VentaForm({ open, onClose, onSaved, actividad, beneficiarios }) {
  const [form, setForm] = useState({
    beneficiario_id: '',
    producto_id: '',
    cantidad_vendida: '',
    comprador_nombre: '',
    observaciones: '',
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-actividad', actividad?.id],
    queryFn: () => base44.entities.ProductoActividad.filter({ actividad_id: actividad.id }),
    enabled: !!actividad?.id,
  });

  const sorted = [...productos].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const productoSeleccionado = productos.find(p => p.id === form.producto_id);
  const cantidad = parseFloat(form.cantidad_vendida) || 0;

  // Precio unitario del producto seleccionado
  const precioUnit = productoSeleccionado?.precio_venta || actividad?.precio_venta_unitario || 0;
  const montoCalculado = precioUnit > 0 && cantidad > 0 ? cantidad * precioUnit : 0;

  // Si es promo, mostrar también la cantidad física total
  const unidadesFisicas = productoSeleccionado?.es_promo && productoSeleccionado?.cantidad_promo
    ? cantidad * productoSeleccionado.cantidad_promo
    : null;

  const mutation = useMutation({
    mutationFn: data => base44.entities.VentaActividad.create(data),
    onSuccess: () => { toast.success('Venta registrada'); onSaved(); },
  });

  const ben = beneficiarios.find(b => b.id === form.beneficiario_id);

  const handleSave = () => {
    if (!form.beneficiario_id || !form.cantidad_vendida) return;
    mutation.mutate({
      actividad_id: actividad.id,
      actividad_nombre: actividad.nombre,
      beneficiario_id: form.beneficiario_id,
      beneficiario_nombre: ben?.nombre || '',
      producto_id: productoSeleccionado?.id || '',
      producto_nombre: productoSeleccionado?.nombre || '',
      precio_unitario_aplicado: precioUnit,
      es_promo: productoSeleccionado?.es_promo || false,
      cantidad_promo: productoSeleccionado?.es_promo ? productoSeleccionado.cantidad_promo : null,
      cantidad_vendida: cantidad,
      monto_recaudado: montoCalculado,
      comprador_nombre: form.comprador_nombre || '',
      entregado: false,
      observaciones: form.observaciones || '',
    });
  };

  const benOptions = beneficiarios
    .filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !['Voluntario', 'Educador'].includes(b.rama))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

  const tieneProductos = sorted.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar venta — {actividad?.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Beneficiario */}
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

          {/* Producto */}
          {tieneProductos ? (
            <div>
              <Label>Producto / Promo *</Label>
              <Select value={form.producto_id} onValueChange={v => setForm(p => ({ ...p, producto_id: v, cantidad_vendida: '' }))}>
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
              {productoSeleccionado && (
                <div className="mt-1.5 flex gap-2 flex-wrap">
                  {productoSeleccionado.es_promo && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">
                      <Tag className="w-2.5 h-2.5 mr-1" />
                      Promo {productoSeleccionado.cantidad_promo} unidades por {formatMoney(productoSeleccionado.precio_venta)}
                    </Badge>
                  )}
                  {!productoSeleccionado.es_promo && (
                    <span className="text-xs text-muted-foreground">Precio: {formatMoney(productoSeleccionado.precio_venta)} c/u</span>
                  )}
                  {productoSeleccionado.precio_costo > 0 && (
                    <span className="text-xs text-muted-foreground">· Costo: {formatMoney(productoSeleccionado.precio_costo)}</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              Esta actividad no tiene productos definidos. Podés agregar productos desde el panel de Productos/Precios.
            </p>
          )}

          {/* Cantidad */}
          <div>
            <Label>
              {productoSeleccionado?.es_promo
                ? `Cantidad de promos vendidas *`
                : `Cantidad vendida *`}
            </Label>
            <Input
              type="number"
              value={form.cantidad_vendida}
              onChange={e => setForm(p => ({ ...p, cantidad_vendida: e.target.value }))}
              placeholder="0"
            />
            {precioUnit > 0 && cantidad > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {productoSeleccionado?.es_promo
                  ? `${cantidad} promo(s) × ${formatMoney(precioUnit)} = `
                  : `${cantidad} × ${formatMoney(precioUnit)} = `}
                <span className="font-semibold text-green-600">{formatMoney(montoCalculado)}</span>
                {unidadesFisicas && (
                  <span className="ml-1 text-muted-foreground">(= {unidadesFisicas} unidades físicas)</span>
                )}
              </p>
            )}
            {!tieneProductos && !actividad?.precio_venta_unitario && (
              <p className="text-xs text-muted-foreground mt-1">
                Sin precio definido — el monto se calculará al distribuir créditos.
              </p>
            )}
          </div>

          {/* Comprador externo */}
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