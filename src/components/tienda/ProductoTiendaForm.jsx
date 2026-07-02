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
import { Plus, Trash2, Upload, Eye, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIAS = ['Uniforme', 'Merchandising', 'Libro', 'Accesorio', 'Combo', 'Otro'];
const TALLES_SUGERIDOS = ['S', 'M', 'L', 'XL', 'XXL', '2', '4', '6', '8', '10', '12', '14', '16'];

const emptyForm = {
  nombre: '', descripcion: '', categoria: 'Uniforme',
  precio_venta: '', precio_costo: '',
  imagen_url: '', visible_familias: false,
  tiene_talles: false, talles: [], stock_por_talle: {},
  stock: '', stock_minimo: '3', activo: true,
  es_combo: false, productos_combo: [],
  descuento_familiar_pct: '0', caja_exclusiva: false,
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
        imagen_url: producto.imagen_url ?? '',
        visible_familias: producto.visible_familias ?? false,
        precio_venta: producto.precio_venta ?? '',
        precio_costo: producto.precio_costo ?? '',
        stock: producto.stock ?? '',
        stock_minimo: producto.stock_minimo ?? '3',
        es_combo: producto.es_combo ?? false,
        productos_combo: producto.productos_combo ?? [],
        descuento_familiar_pct: producto.descuento_familiar_pct?.toString() ?? '0',
        caja_exclusiva: producto.caja_exclusiva ?? false,
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
      es_combo: form.es_combo,
      productos_combo: form.es_combo ? form.productos_combo : [],
      descuento_familiar_pct: parseFloat(form.descuento_familiar_pct) || 0,
      caja_exclusiva: form.caja_exclusiva,
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

          {/* Imagen del producto */}
          <div>
            <Label>Imagen del producto</Label>
            <div className="flex items-center gap-3">
              {form.imagen_url ? (
                <img src={form.imagen_url} alt="" className="w-20 h-20 rounded-lg object-cover border" />
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1">
                <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-input bg-transparent shadow-sm hover:bg-accent cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {form.imagen_url ? 'Cambiar imagen' : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setForm(p => ({ ...p, imagen_url: file_url }));
                        toast.success('Imagen subida');
                      } catch (err) {
                        toast.error('Error al subir imagen');
                      }
                    }}
                  />
                </label>
                {form.imagen_url && (
                  <Button type="button" variant="ghost" size="sm" className="ml-2 text-xs text-red-500"
                    onClick={() => setForm(p => ({ ...p, imagen_url: '' }))}>
                    Quitar
                  </Button>
                )}
              </div>
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

          {/* Combo toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="cursor-pointer">Es un combo / bundle</Label>
              <p className="text-xs text-muted-foreground">Agrupa varios productos con un precio especial</p>
            </div>
            <Switch checked={form.es_combo} onCheckedChange={v => setForm(p => ({ ...p, es_combo: v, tiene_talles: v ? false : p.tiene_talles }))} />
          </div>

          {/* Combo builder */}
          {form.es_combo && (
            <div className="space-y-2 p-3 border rounded-lg">
              <Label>Productos del combo</Label>
              {form.productos_combo.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={item.producto_nombre || ''}
                    onChange={e => {
                      const items = [...form.productos_combo];
                      items[idx] = { ...item, producto_nombre: e.target.value };
                      setForm(p => ({ ...p, productos_combo: items }));
                    }}
                    placeholder="Nombre del producto"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={item.cantidad || 1}
                    onChange={e => {
                      const items = [...form.productos_combo];
                      items[idx] = { ...item, cantidad: parseInt(e.target.value) || 1 };
                      setForm(p => ({ ...p, productos_combo: items }));
                    }}
                    className="w-20"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => {
                    const items = form.productos_combo.filter((_, i) => i !== idx);
                    setForm(p => ({ ...p, productos_combo: items }));
                  }}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => {
                setForm(p => ({ ...p, productos_combo: [...p.productos_combo, { producto_id: '', producto_nombre: '', cantidad: 1 }] }));
              }}>
                <Plus className="w-4 h-4 mr-1" />Agregar producto al combo
              </Button>
            </div>
          )}

          {/* Descuento familiar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Descuento familiar (%)</Label>
              <Input type="number" min="0" max="100" value={form.descuento_familiar_pct} onChange={e => setForm(p => ({ ...p, descuento_familiar_pct: e.target.value }))} placeholder="0" />
              <p className="text-xs text-muted-foreground mt-0.5">Se aplica si un familiar ya compró el producto</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label className="cursor-pointer">Caja exclusiva</Label>
                <p className="text-xs text-muted-foreground">Ventas a fondo separado</p>
              </div>
              <Switch checked={form.caja_exclusiva} onCheckedChange={v => setForm(p => ({ ...p, caja_exclusiva: v }))} />
            </div>
          </div>

          {/* Visibilidad para familias */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="cursor-pointer flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Visible para familias
              </Label>
              <p className="text-xs text-muted-foreground">Mostrar en la página de consulta familiar con pre-encargo</p>
            </div>
            <Switch checked={form.visible_familias} onCheckedChange={v => setForm(p => ({ ...p, visible_familias: v }))} />
          </div>

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