import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag, Plus, Minus, Package, Check, Clock, X, CheckCircle2, Ruler } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import ProductoGaleria from '@/components/tienda/ProductoGaleria';

export default function TiendaFamilia({ grupoFamiliar }) {
  const [encargos, setEncargos] = useState({});
  const [tablaTallesOpen, setTablaTallesOpen] = useState(null);
  const queryClient = useQueryClient();

  const { data: productos = [] } = useQuery({
    queryKey: ['productos_tienda_familia'],
    queryFn: () => base44.entities.ProductoTienda.list('-updated_date', 500),
  });

  const productosVisibles = useMemo(
    () => productos.filter(p => p.visible_familias && p.activo !== false),
    [productos]
  );

  const { data: preEncargos = [] } = useQuery({
    queryKey: ['pre_encargos_familia'],
    queryFn: () => base44.entities.PreEncargoTienda.list('-fecha', 500),
  });

  const familiaresIds = useMemo(() => grupoFamiliar.map(b => b.id), [grupoFamiliar]);
  const misEncargos = useMemo(
    () => preEncargos.filter(e => familiaresIds.includes(e.beneficiario_id)),
    [preEncargos, familiaresIds]
  );

  const crearEncargo = useMutation({
    mutationFn: async ({ producto, benId, benNombre, cantidad, talle }) => {
      await base44.entities.PreEncargoTienda.create({
        beneficiario_id: benId,
        beneficiario_nombre: benNombre,
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        producto_imagen_url: producto.imagen_url,
        talle: talle || undefined,
        cantidad,
        precio_unitario: producto.precio_venta,
        monto_total: producto.precio_venta * cantidad,
        estado: 'Pendiente',
        fecha: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      toast.success('Pre-encargo enviado. El grupo lo confirmará pronto.');
      setEncargos({});
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  const setEncargo = (productoId, field, value) => {
    setEncargos(prev => ({ ...prev, [productoId]: { ...prev[productoId], [field]: value } }));
  };

  if (productosVisibles.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <ShoppingBag className="w-4 h-4 text-primary" /> Tienda del Grupo
      </h3>

      {/* Mis pre-encargos */}
      {misEncargos.length > 0 && (
        <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
          <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-primary" /> Mis pre-encargos
          </p>
          <div className="space-y-2">
            {misEncargos.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  {e.producto_imagen_url && (
                    <img src={e.producto_imagen_url} alt="" className="w-8 h-8 rounded object-cover" />
                  )}
                  <div>
                    <span className="font-medium">{e.producto_nombre}</span>
                    {e.talle && <span className="text-xs text-muted-foreground ml-1">· Talle {e.talle}</span>}
                    <span className="text-xs text-muted-foreground ml-1">· {e.cantidad}u</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatMoney(e.monto_total)}</span>
                  {e.estado === 'Pendiente' && <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs"><Clock className="w-3 h-3 mr-0.5" />Pendiente</Badge>}
                  {e.estado === 'Confirmado' && <Badge className="bg-blue-100 text-blue-700 border-blue-300 border text-xs"><Check className="w-3 h-3 mr-0.5" />Confirmado</Badge>}
                  {e.estado === 'Entregado' && <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs"><CheckCircle2 className="w-3 h-3 mr-0.5" />Entregado</Badge>}
                  {e.estado === 'Cancelado' && <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs"><X className="w-3 h-3 mr-0.5" />Cancelado</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Catálogo de productos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {productosVisibles.map(p => {
          const enc = encargos[p.id] || {};
          const benSel = grupoFamiliar.find(b => b.id === enc.benId);
          const cant = parseInt(enc.cantidad) || 1;
          const total = p.precio_venta * cant;

          return (
            <Card key={p.id} className="overflow-hidden flex flex-col">
              <ProductoGaleria
                imagenes={(p.imagenes_url?.length ? p.imagenes_url : (p.imagen_url ? [p.imagen_url] : []))}
                nombre={p.nombre}
                height="h-48"
              />
              <div className="p-4 flex flex-col flex-1">
                <h4 className="font-semibold text-sm">{p.nombre}</h4>
                {p.descripcion && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descripcion}</p>}
                <p className="text-lg font-bold mt-2">{formatMoney(p.precio_venta)}</p>

                <div className="mt-3 space-y-2">
                  <Select value={enc.benId || ''} onValueChange={v => setEncargo(p.id, 'benId', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Para quién..." /></SelectTrigger>
                    <SelectContent>
                      {grupoFamiliar.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {p.tiene_talles && p.talles?.length > 0 && (
                    <>
                      <Select value={enc.talle || ''} onValueChange={v => setEncargo(p.id, 'talle', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Talle..." /></SelectTrigger>
                        <SelectContent>
                          {p.talles.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {p.tabla_talles_url && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() => setTablaTallesOpen(p.tabla_talles_url)}
                        >
                          <Ruler className="w-3.5 h-3.5" /> Ver tabla de talles
                        </button>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEncargo(p.id, 'cantidad', Math.max(1, cant - 1))}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <Input
                      type="number" min="1" value={cant}
                      onChange={e => setEncargo(p.id, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 text-center text-sm"
                    />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEncargo(p.id, 'cantidad', cant + 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-bold">{formatMoney(total)}</span>
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!enc.benId || (p.tiene_talles && !enc.talle) || crearEncargo.isPending}
                    onClick={() => crearEncargo.mutate({ producto: p, benId: enc.benId, benNombre: benSel?.nombre, cantidad: cant, talle: enc.talle })}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                    Solicitar pre-encargo
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Lightbox tabla de talles */}
      {tablaTallesOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setTablaTallesOpen(null)}
        >
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setTablaTallesOpen(null)}>
            <X className="w-8 h-8" />
          </button>
          <img src={tablaTallesOpen} alt="Tabla de talles" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}