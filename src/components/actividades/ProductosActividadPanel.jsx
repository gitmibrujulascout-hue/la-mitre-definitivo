import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ShoppingBag, Pencil, Tag } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

const DEFAULT_PRODUCTO = {
  nombre: '',
  descripcion: '',
  es_promo: false,
  cantidad_promo: '',
  precio_venta: '',
  precio_costo: '',
  orden: 0,
};

function ProductoFormDialog({ open, onClose, onSaved, actividadId, actividadNombre, initialData }) {
  const isEditing = !!initialData;
  const [form, setForm] = useState(initialData ? { ...DEFAULT_PRODUCTO, ...initialData } : { ...DEFAULT_PRODUCTO });
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: data => isEditing
      ? base44.entities.ProductoActividad.update(initialData.id, data)
      : base44.entities.ProductoActividad.create(data),
    onSuccess: () => { toast.success(isEditing ? 'Producto actualizado' : 'Producto agregado'); onSaved(); },
  });

  const handleSave = () => {
    if (!form.nombre || !form.precio_venta) return;
    mutation.mutate({
      ...form,
      actividad_id: actividadId,
      actividad_nombre: actividadNombre,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_costo: parseFloat(form.precio_costo) || 0,
      cantidad_promo: form.es_promo ? (parseInt(form.cantidad_promo) || 2) : null,
      orden: parseInt(form.orden) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar producto' : 'Agregar producto / promo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nombre *</Label>
            <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} placeholder="Ej: Empanada de carne, Promo 2x1" />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.es_promo}
                onChange={e => update('es_promo', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">Es una promo por cantidad</span>
            </label>
          </div>

          {form.es_promo && (
            <div>
              <Label>Cantidad incluida en la promo</Label>
              <Input
                type="number"
                value={form.cantidad_promo}
                onChange={e => update('cantidad_promo', e.target.value)}
                placeholder="Ej: 2 (para promo 2 por $X)"
              />
              <p className="text-xs text-muted-foreground mt-1">El precio abajo es el precio total de la promo</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{form.es_promo ? 'Precio total promo *' : 'Precio de venta *'}</Label>
              <Input
                type="number"
                value={form.precio_venta}
                onChange={e => update('precio_venta', e.target.value)}
                placeholder="$"
              />
            </div>
            <div>
              <Label>Precio de costo unit.</Label>
              <Input
                type="number"
                value={form.precio_costo}
                onChange={e => update('precio_costo', e.target.value)}
                placeholder="$ (opcional)"
              />
            </div>
          </div>

          {form.es_promo && form.cantidad_promo && form.precio_venta && (
            <p className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded p-2">
              Promo: {form.cantidad_promo} unidades por {formatMoney(parseFloat(form.precio_venta))} 
              {' '}(≈ {formatMoney(parseFloat(form.precio_venta) / parseInt(form.cantidad_promo))} c/u)
            </p>
          )}

          <div>
            <Label>Descripción (opcional)</Label>
            <Input value={form.descripcion} onChange={e => update('descripcion', e.target.value)} placeholder="Detalles adicionales" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.precio_venta || mutation.isPending}>
            {isEditing ? 'Guardar' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductosActividadPanel({ actividad }) {
  const [showForm, setShowForm] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const queryClient = useQueryClient();

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-actividad', actividad.id],
    queryFn: () => base44.entities.ProductoActividad.filter({ actividad_id: actividad.id }),
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.ProductoActividad.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos-actividad', actividad.id] }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['productos-actividad', actividad.id] });

  const sorted = [...productos].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />Productos / Precios
          </CardTitle>
          <Button size="sm" onClick={() => { setEditingProducto(null); setShowForm(true); }}>
            <Plus className="w-3 h-3 mr-1" />Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-0">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Definí los productos y precios de esta actividad
          </p>
        ) : sorted.map(p => (
          <div key={p.id} className="flex items-center justify-between py-2.5 border-b last:border-0 text-sm gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">{p.nombre}</span>
                {p.es_promo && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">
                    <Tag className="w-2.5 h-2.5 mr-1" />
                    Promo {p.cantidad_promo}x
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="font-semibold text-green-600">{formatMoney(p.precio_venta)}</span>
                {p.es_promo && p.cantidad_promo > 1 && (
                  <span>(≈ {formatMoney(p.precio_venta / p.cantidad_promo)} c/u)</span>
                )}
                {p.precio_costo > 0 && (
                  <span className="text-red-400">Costo: {formatMoney(p.precio_costo)}</span>
                )}
              </div>
              {p.descripcion && <p className="text-xs text-muted-foreground italic">{p.descripcion}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingProducto(p); setShowForm(true); }}>
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMut.mutate(p.id)}>
                <Trash2 className="w-3 h-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {showForm && (
        <ProductoFormDialog
          open
          onClose={() => { setShowForm(false); setEditingProducto(null); }}
          onSaved={() => { invalidate(); setShowForm(false); setEditingProducto(null); }}
          actividadId={actividad.id}
          actividadNombre={actividad.nombre}
          initialData={editingProducto}
        />
      )}
    </Card>
  );
}