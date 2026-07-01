import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIAS = ['Uniforme', 'Merchandising', 'Libro', 'Accesorio', 'Otro'];
const TALLES_SUGERIDOS = ['S', 'M', 'L', 'XL', 'XXL', '2', '4', '6', '8', '10', '12', '14', '16'];

const emptyForm = {
  nombre: '', descripcion: '', categoria: 'Uniforme',
  precio_venta: '', precio_costo: '',
  tiene_talles: false, talles: [], stock_por_talle: {},
  stock: '', stock_minimo: '3', activo: true,
};

export default function ProductoTiendaForm({ open, onClose, producto }) {
  const [form, setForm] = useState(emptyForm);
  const [nuevoTalle, setNuevoTalle] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (producto) {
      setForm({
        ...emptyForm,
        ...producto,
        precio_venta: producto.precio_venta ?? '',
        precio_costo: producto.precio_costo ?? '',
        stock: producto.stock ?? '',
        stock_minimo: producto.stock_minimo ?? '3',
      });
    } else {
      setForm(emptyForm);
    }
  }, [producto, open]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (producto) return base44.entities.ProductoTienda.update(producto.id, data);
      return base44.entities.ProductoTienda.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      toast.success(producto ? 'Producto actualizado' : 'Producto creado');
      onClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  const handleSave = () => {
    if (!form.nombre || !form.precio_venta) return;
    saveMutation.mutate({
      ...form,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_costo: parseFloat(form.precio_costo) || 0,
      stock: form.tiene_talles ? 0 : (parseInt(form.stock) || 0),
      stock_minimo: parseInt(form.stock_minimo) || 3,
    });
  };

  const addTalle = (talle) => {
    const t = (talle || nuevoTalle).trim();
    if (!t || form.talles.includes(t)) return;
    setForm(p => ({
      ...p,
      talles: [...p.talles, t],
      stock_por_talle: { ...p.stock_por_talle, [t]: p.stock_por_talle[t] ?? 0 },
    }));
    setNuevoTalle('');
  };

  const removeTalle = (talle) => {
    setForm(p => {
      const talles = p.talles.filter(t => t !== talle);
      const stock = { ...p.stock_por_talle };
      delete stock[talle];
      return { ...p, talles, stock_por_talle: stock };
    });
  };

  const setStockTalle = (talle, val) => {
    setForm(p => ({
      ...p,
      stock_por_talle: { ...p.stock_por_talle, [talle]: parseInt(val) || 0 },
    }));
  };

  const tallesDisponibles = TALLES_SUGERIDOS.filter(t => !form.talles.includes(t));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producto ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Nombre *</Label>
            <Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Remera oficial del grupo" />
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Opcional" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stock mínimo (alerta)</Label>
              <Input type="number" value={form.stock_minimo} onChange={e => setForm(p => ({ ...p, stock_minimo: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Precio venta *</Label>
              <Input type="number" value={form.precio_venta} onChange={e => setForm(p => ({ ...p, precio_venta: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Precio costo</Label>
              <Input type="number" value={form.precio_costo} onChange={e => setForm(p => ({ ...p, precio_costo: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>

          {/* Toggle talles */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="cursor-pointer">Maneja talles</Label>
              <p className="text-xs text-muted-foreground">Activar para stock por talle (remeras, pantalones, etc.)</p>
            </div>
            <Switch checked={form.tiene_talles} onCheckedChange={v => setForm(p => ({ ...p, tiene_talles: v }))} />
          </div>

          {form.tiene_talles ? (
            <div className="space-y-2">
              <Label>Stock por talle</Label>
              {/* Quick add talles */}
              {tallesDisponibles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tallesDisponibles.map(t => (
                    <button key={t} type="button" onClick={() => addTalle(t)}
                      className="px-2 py-1 text-xs rounded-md border border-dashed border-border hover:bg-accent">
                      + {t}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={nuevoTalle} onChange={e => setNuevoTalle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTalle(); } }}
                  placeholder="Talle personalizado..." className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => addTalle()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {form.talles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Sin talles agregados</p>
              ) : (
                <div className="space-y-1.5">
                  {form.talles.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-16 text-sm font-medium px-2 py-1.5 bg-muted rounded-md text-center">{t}</span>
                      <Input type="number" value={form.stock_por_talle[t] ?? 0}
                        onChange={e => setStockTalle(t, e.target.value)}
                        className="flex-1" placeholder="Stock" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeTalle(t)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <Label>Stock</Label>
              <Input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} placeholder="0" />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <Label className="cursor-pointer">Producto activo</Label>
            <Switch checked={form.activo} onCheckedChange={v => setForm(p => ({ ...p, activo: v }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.precio_venta}>
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}