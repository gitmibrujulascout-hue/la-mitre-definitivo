import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, ShoppingBag, Package, AlertTriangle, TrendingUp, Search, Eye, EyeOff, ClipboardList, Check, X, CheckCircle2, Users, DollarSign, Undo2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import ProductoTiendaForm from '@/components/tienda/ProductoTiendaForm';
import VentaTiendaForm from '@/components/tienda/VentaTiendaForm';
import ProductoGaleria from '@/components/tienda/ProductoGaleria';
import EntregarEncargoDialog from '@/components/tienda/EntregarEncargoDialog';
import ReporteProveedorDialog from '@/components/tienda/ReporteProveedorDialog';
import ListaEntregaDialog from '@/components/tienda/ListaEntregaDialog';
import EncargosPorFamilia from '@/components/tienda/EncargosPorFamilia';
import EditarEncargoDialog from '@/components/tienda/EditarEncargoDialog';
import RegistrarPagoEncargoDialog from '@/components/tienda/RegistrarPagoEncargoDialog';
import CajaExclusivaPanel from '@/components/tienda/CajaExclusivaPanel';
import { formatMoney } from '@/lib/ramaUtils';
import { getStockDisponiblePorTalle, getStockFisicoTotal } from '@/lib/tiendaStock';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Tienda() {
  const [tab, setTab] = useState('productos');
  const [showProductoForm, setShowProductoForm] = useState(false);
  const [editProducto, setEditProducto] = useState(null);
  const [showVentaForm, setShowVentaForm] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('todas');
  const [entregarEncargo, setEntregarEncargo] = useState(null);
  const [editarEncargo, setEditarEncargo] = useState(null);
  const [pagoEncargo, setPagoEncargo] = useState(null);
  const [showReporteProveedor, setShowReporteProveedor] = useState(false);
  const [showListaEntrega, setShowListaEntrega] = useState(false);
  const [ocultarCancelados, setOcultarCancelados] = useState(false);
  const queryClient = useQueryClient();

  const { data: productos = [] } = useQuery({
    queryKey: ['productos_tienda'],
    queryFn: () => base44.entities.ProductoTienda.list('-updated_date', 500),
  });

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas_tienda'],
    queryFn: () => base44.entities.VentaTienda.list('-fecha', 500),
  });

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list('nombre', 500),
  });

  const { data: preEncargos = [] } = useQuery({
    queryKey: ['pre_encargos'],
    queryFn: () => base44.entities.PreEncargoTienda.list('-fecha', 500),
  });

  const deleteProducto = useMutation({
    mutationFn: id => base44.entities.ProductoTienda.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['productos_tienda'] }); toast.success('Producto eliminado'); },
  });

  const deleteVenta = useMutation({
    mutationFn: async (venta) => {
      await base44.entities.VentaTienda.delete(venta.id);
      // La VentaTienda es la fuente única del ingreso; no hay MovimientoBanco que eliminar.
      // Restaurar stock del producto
      const prod = productos.find(p => p.id === venta.producto_id);
      if (prod) {
        if (prod.tiene_talles && venta.talle) {
          const stockActual = prod.stock_por_talle?.[venta.talle] ?? 0;
          await base44.entities.ProductoTienda.update(prod.id, {
            stock_por_talle: { ...prod.stock_por_talle, [venta.talle]: stockActual + (venta.cantidad || 0) },
          });
        } else {
          await base44.entities.ProductoTienda.update(prod.id, {
            stock: (prod.stock || 0) + (venta.cantidad || 0),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      toast.success('Venta eliminada y stock restaurado');
    },
  });

  const toggleVisible = useMutation({
    mutationFn: ({ id, val }) => base44.entities.ProductoTienda.update(id, { visible_familias: val }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['productos_tienda'] }); },
  });

  const actualizarEncargo = useMutation({
    mutationFn: async ({ id, estado }) => {
      const encargo = preEncargos.find(e => e.id === id);
      if (!encargo) return;
      const update = { estado };
      if (estado === 'Confirmado') update.fecha_confirmacion = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      if (estado === 'Cancelado') {
        update.stock_reservado = false;
        update.monto_pagado = 0;
        // Al cancelar, monto_pagado vuelve a 0. cajaUtils deriva señas de monto_pagado,
        // así que el ingreso desaparece automáticamente (fuente única: PreEncargoTienda).
      }

      // No se modifica el stock físico al cancelar: las reservas se calculan
      // dinámicamente desde los pre-encargos activos (Pendiente/Confirmado).
      await base44.entities.PreEncargoTienda.update(id, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda_familia'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      toast.success('Pre-encargo actualizado');
    },
  });

  // Anular señas registradas en un pre-encargo (sin cancelar el pedido)
  const anularSenia = useMutation({
    mutationFn: async (encargo) => {
      // Al resetear monto_pagado a 0, el ingreso de la seña desaparece de cajaUtils
      // automáticamente (fuente única: PreEncargoTienda.monto_pagado).
      await base44.entities.PreEncargoTienda.update(encargo.id, { monto_pagado: 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      toast.success('Seña anulada');
    },
  });

  const confirmarFamilia = useMutation({
    mutationFn: async (ids) => {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      await base44.entities.PreEncargoTienda.bulkUpdate(
        ids.map(id => ({ id, estado: 'Confirmado', fecha_confirmacion: hoy }))
      );
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda_familia'] });
      toast.success(`${ids.length} pedido(s) confirmado(s)`);
    },
  });

  const registrarPagoEncargo = useMutation({
    mutationFn: async ({ id, update }) => {
      await base44.entities.PreEncargoTienda.update(id, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      toast.success('Pago registrado');
    },
  });

  const guardarEdicionEncargo = useMutation({
    mutationFn: async ({ id, update }) => {
      await base44.entities.PreEncargoTienda.update(id, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda_familia'] });
      toast.success('Encargo actualizado');
    },
  });

  // Stock físico total del producto
  const getStockTotal = (p) => getStockFisicoTotal(p);

  // Reservas activas (pre-encargos Pendiente/Confirmado) por producto
  const reservasPorProducto = useMemo(() => {
    const map = {};
    preEncargos.forEach(e => {
      if (['Pendiente', 'Confirmado'].includes(e.estado)) {
        map[e.producto_id] = (map[e.producto_id] || 0) + (e.cantidad || 0);
      }
    });
    return map;
  }, [preEncargos]);

  // Stock disponible (físico - reservas) por producto y talle
  const getDisponibleTalle = (p, talle) => {
    const disp = getStockDisponiblePorTalle(p, preEncargos);
    return talle ? (disp[talle] ?? 0) : (disp._sin_talle ?? 0);
  };

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === 'todas' || p.categoria === catFilter;
      return matchSearch && matchCat;
    });
  }, [productos, search, catFilter]);

  // Alertas de stock bajo
  const productosBajoStock = useMemo(() =>
    productos.filter(p => getStockTotal(p) <= (p.stock_minimo || 0)),
    [productos]
  );

  // Stats
  const totalVentas = ventas.reduce((s, v) => s + (v.monto_total || 0), 0);
  const ventasHoy = ventas.filter(v => v.fecha === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const totalHoy = ventasHoy.reduce((s, v) => s + (v.monto_total || 0), 0);
  const hayCajaExclusiva = productos.some(p => p.caja_exclusiva);

  // Pre-encargos ordenados: cancelados al final; ocultar si el toggle está activo
  const preEncargosOrdenados = useMemo(() => {
    const lista = ocultarCancelados ? preEncargos.filter(e => e.estado !== 'Cancelado') : preEncargos;
    return [...lista].sort((a, b) => {
      const aCancelado = a.estado === 'Cancelado' ? 1 : 0;
      const bCancelado = b.estado === 'Cancelado' ? 1 : 0;
      if (aCancelado !== bCancelado) return aCancelado - bCancelado;
      return (b.fecha || '').localeCompare(a.fecha || '');
    });
  }, [preEncargos, ocultarCancelados]);

  const categorias = ['todas', 'Uniforme', 'Merchandising', 'Libro', 'Accesorio', 'Otro'];

  return (
    <div>
      <PageHeader title="Tienda" description="Gestión de productos, stock y ventas">
        <Button variant="outline" onClick={() => { setEditProducto(null); setShowProductoForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />Nuevo producto
        </Button>
        <Button onClick={() => setShowVentaForm(true)}>
          <ShoppingBag className="w-4 h-4 mr-2" />Nueva venta
        </Button>
      </PageHeader>

      {/* Alerta de stock bajo */}
      {productosBajoStock.length > 0 && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{productosBajoStock.length}</strong> producto(s) con stock bajo: {productosBajoStock.map(p => p.nombre).join(', ')}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><Package className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Productos</p><p className="text-lg font-bold">{productos.length}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <div><p className="text-xs text-muted-foreground">Stock bajo</p><p className="text-lg font-bold">{productosBajoStock.length}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Ventas hoy</p><p className="text-lg font-bold text-green-600">{formatMoney(totalHoy)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-primary" /></div>
             <div><p className="text-xs text-muted-foreground">Total ventas</p><p className="text-lg font-bold">{formatMoney(totalVentas)}</p></div>
           </div>
         </CardContent></Card>
        </div>

        {/* Caja exclusiva de la tienda */}
        {hayCajaExclusiva && (
          <div className="mb-6">
            <CajaExclusivaPanel />
          </div>
        )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="productos" className="gap-2"><Package className="w-4 h-4" />Productos</TabsTrigger>
          <TabsTrigger value="ventas" className="gap-2"><ShoppingBag className="w-4 h-4" />Ventas</TabsTrigger>
          {preEncargos.length > 0 && (
            <TabsTrigger value="encargos" className="gap-2">
              <ClipboardList className="w-4 h-4" />Pre-encargos
              {preEncargos.filter(e => e.estado === 'Pendiente').length > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  {preEncargos.filter(e => e.estado === 'Pendiente').length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Productos */}
        <TabsContent value="productos" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="pl-8" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {categorias.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={cn('px-3 py-1.5 text-xs rounded-md font-medium border transition-all',
                    catFilter === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent')}>
                  {c === 'todas' ? 'Todas' : c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {productosFiltrados.length === 0 ? (
              <p className="col-span-full text-center py-12 text-muted-foreground">No hay productos. Creá el primero con "Nuevo producto".</p>
            ) : productosFiltrados.map(p => {
              const stockTotal = getStockTotal(p);
              const bajo = stockTotal <= (p.stock_minimo || 0);
              return (
                <Card key={p.id} className={cn('overflow-hidden', bajo && 'border-amber-300')}>
                    <ProductoGaleria
                      imagenes={(p.imagenes_url?.length ? p.imagenes_url : (p.imagen_url ? [p.imagen_url] : []))}
                      nombre={p.nombre}
                      height="h-32"
                    />
                   <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{p.nombre}</h3>
                        {p.descripcion && <p className="text-xs text-muted-foreground line-clamp-1">{p.descripcion}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {p.visible_familias && <Badge className="bg-cyan-100 text-cyan-700 border-cyan-300 border text-xs"><Eye className="w-3 h-3 mr-0.5" />Familias</Badge>}
                        {p.es_combo && <Badge className="bg-blue-100 text-blue-700 border-blue-300 border text-xs">Combo</Badge>}
                        {p.caja_exclusiva && <Badge className="bg-purple-100 text-purple-700 border-purple-300 border text-xs">Excl.</Badge>}
                        {p.descuento_familiar_pct > 0 && <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">Fam. {p.descuento_familiar_pct}%</Badge>}
                        <Badge variant="outline" className="text-xs">{p.categoria}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold">{formatMoney(p.precio_venta)}</span>
                      {!p.activo && <Badge className="bg-muted text-muted-foreground">Inactivo</Badge>}
                    </div>

                    {/* Stock */}
                    {p.tiene_talles ? (
                      <div className="space-y-1">
                        {p.talles?.map(t => {
                          const fisico = p.stock_por_talle?.[t] ?? 0;
                          const disp = getDisponibleTalle(p, t);
                          const reservado = Math.max(0, fisico - disp);
                          return (
                            <div key={t} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Talle {t}</span>
                              <div className="flex items-center gap-1.5">
                                {reservado > 0 && (
                                  <span className="text-amber-600 text-xs" title="Reservado por pre-encargos">
                                    ({reservado} res. · {disp} disp.)
                                  </span>
                                )}
                                <Badge className={cn('text-xs', fisico === 0 ? 'bg-red-100 text-red-700' : fisico <= (p.stock_minimo || 0) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                                  {fisico}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Stock</span>
                        <div className="flex items-center gap-1.5">
                          {reservasPorProducto[p.id] > 0 && (
                            <span className="text-amber-600 text-xs" title="Reservado por pre-encargos">
                              ({reservasPorProducto[p.id]} res. · {getDisponibleTalle(p)} disp.)
                            </span>
                          )}
                          <Badge className={cn(getStockTotal(p) === 0 ? 'bg-red-100 text-red-700' : getStockTotal(p) <= (p.stock_minimo || 0) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                            {getStockTotal(p)}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditProducto(p); setShowProductoForm(true); }}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />Editar
                      </Button>
                      <Button variant="ghost" size="icon"
                        title={p.visible_familias ? 'Ocultar de familias' : 'Mostrar a familias'}
                        onClick={() => toggleVisible.mutate({ id: p.id, val: !p.visible_familias })}>
                        {p.visible_familias ? <Eye className="w-4 h-4 text-cyan-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar "${p.nombre}"?`)) deleteProducto.mutate(p.id); }}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Ventas */}
        <TabsContent value="ventas">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead>Talle</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Precio unit.</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No hay ventas registradas</TableCell></TableRow>
                ) : ventas.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{v.fecha || '—'}</TableCell>
                    <TableCell className="font-medium text-sm">{v.producto_nombre}</TableCell>
                    <TableCell className="text-sm">{v.beneficiario_nombre || '—'}</TableCell>
                    <TableCell>{v.talle ? <Badge variant="outline" className="text-xs">{v.talle}</Badge> : '—'}</TableCell>
                    <TableCell className="text-sm">{v.cantidad}</TableCell>
                    <TableCell className="text-sm">{formatMoney(v.precio_unitario)}</TableCell>
                    <TableCell className="font-semibold text-sm text-green-600">{formatMoney(v.monto_total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{v.forma_pago}</Badge>
                    </TableCell>
                    <TableCell>
                      {v.destino === 'Caja exclusiva' ? (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-300 border text-xs">Caja excl.</Badge>
                      ) : v.destino === 'Banco' ? (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-300 border text-xs">Banco</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Caja</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('¿Eliminar esta venta? Se restaurará el stock y se anulará el ingreso en caja.')) deleteVenta.mutate(v); }}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Pre-encargos */}
        {tab === 'encargos' && (
          <TabsContent value="encargos">
            <div className="flex justify-end gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={() => setShowReporteProveedor(true)}>
                <Package className="w-4 h-4 mr-1.5" />Pedido al proveedor
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowListaEntrega(true)}>
                <ClipboardList className="w-4 h-4 mr-1.5" />Lista de entrega
              </Button>
            </div>

            {/* Agrupado por familia con WhatsApp para confirmación */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Pedidos por familia (para confirmación)
              </h3>
              <EncargosPorFamilia
                encargos={preEncargos}
                beneficiarios={beneficiarios}
                productos={productos}
                onConfirmarFamilia={(ids) => confirmarFamilia.mutate(ids)}
                onEditarEncargo={(item) => setEditarEncargo(item)}
                onRegistrarPago={(item) => setPagoEncargo(item)}
              />
            </div>

            {/* Tabla detallada */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="text-sm font-semibold">Detalle de pre-encargos</h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setOcultarCancelados(v => !v)}
              >
                {ocultarCancelados ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
                {ocultarCancelados ? 'Mostrar cancelados' : 'Ocultar cancelados'}
              </Button>
            </div>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Talle</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="w-32">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preEncargosOrdenados.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay pre-encargos</TableCell></TableRow>
                  ) : preEncargosOrdenados.map(e => (
                    <TableRow key={e.id} className={cn(e.estado === 'Cancelado' && 'opacity-50')}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{e.fecha}</TableCell>
                      <TableCell className="font-medium text-sm">{e.beneficiario_nombre}</TableCell>
                      <TableCell className="text-sm">{e.producto_nombre}</TableCell>
                      <TableCell>{e.talle ? <Badge variant="outline" className="text-xs">{e.talle}</Badge> : '—'}</TableCell>
                      <TableCell className="text-sm">{e.cantidad}</TableCell>
                      <TableCell className="font-semibold text-sm">{formatMoney(e.monto_total)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {(() => {
                            const pagado = e.monto_pagado || 0;
                            const saldo = Math.max(0, (e.monto_total || 0) - pagado);
                            if (pagado === 0) {
                              return <span className="text-xs text-muted-foreground">Sin pago</span>;
                            }
                            if (saldo === 0) {
                              return <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs w-fit">Pagado</Badge>;
                            }
                            return (
                              <>
                                <Badge className="bg-blue-100 text-blue-700 border border-blue-300 text-xs w-fit">Seña {formatMoney(pagado)}</Badge>
                                <span className="text-xs text-muted-foreground">Saldo {formatMoney(saldo)}</span>
                              </>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.estado === 'Pendiente' && <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">Pendiente</Badge>}
                        {e.estado === 'Confirmado' && <Badge className="bg-blue-100 text-blue-700 border-blue-300 border text-xs">Confirmado</Badge>}
                        {e.estado === 'Entregado' && <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">Entregado</Badge>}
                        {e.estado === 'Cancelado' && <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">Cancelado</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(e.estado === 'Pendiente' || e.estado === 'Confirmado') && (
                            <Button variant="outline" size="sm" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={() => setPagoEncargo(e)} title="Registrar pago / seña">
                              <DollarSign className="w-3 h-3 mr-1" />Pago
                            </Button>
                          )}
                          {e.monto_pagado > 0 && (e.estado === 'Pendiente' || e.estado === 'Confirmado') && (
                            <Button variant="outline" size="sm" className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => { if (confirm('¿Anular la seña registrada? Se quitará el dinero de la caja y se reiniciará el monto pagado.')) anularSenia.mutate(e); }} title="Anular seña">
                              <Undo2 className="w-3 h-3 mr-1" />Anular seña
                            </Button>
                          )}
                          {e.estado === 'Pendiente' && (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => actualizarEncargo.mutate({ id: e.id, estado: 'Confirmado' })}>
                                <Check className="w-3 h-3 mr-1" />Confirmar
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7" onClick={() => actualizarEncargo.mutate({ id: e.id, estado: 'Cancelado' })}>
                                <X className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </>
                          )}
                          {e.estado === 'Confirmado' && (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEntregarEncargo(e)}>
                                <CheckCircle2 className="w-3 h-3 mr-1" />Entregar
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7" onClick={() => actualizarEncargo.mutate({ id: e.id, estado: 'Cancelado' })}>
                                <X className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

      </Tabs>

      {showProductoForm && (
        <ProductoTiendaForm open onClose={() => setShowProductoForm(false)} producto={editProducto} />
      )}
      {showVentaForm && (
        <VentaTiendaForm open onClose={() => setShowVentaForm(false)} productos={productos} beneficiarios={beneficiarios} preEncargos={preEncargos} />
      )}
      {entregarEncargo && (
        <EntregarEncargoDialog
          encargo={entregarEncargo}
          producto={productos.find(p => p.id === entregarEncargo.producto_id)}
          onClose={() => setEntregarEncargo(null)}
        />
      )}
      {showReporteProveedor && (
        <ReporteProveedorDialog
          encargos={preEncargos}
          onClose={() => setShowReporteProveedor(false)}
        />
      )}
      {showListaEntrega && (
        <ListaEntregaDialog
          encargos={preEncargos}
          onClose={() => setShowListaEntrega(false)}
        />
      )}
      {editarEncargo && (
        <EditarEncargoDialog
          encargo={editarEncargo}
          producto={productos.find(p => p.id === editarEncargo.producto_id)}
          onClose={() => setEditarEncargo(null)}
          onSave={(id, update) => guardarEdicionEncargo.mutate({ id, update })}
        />
      )}
      {pagoEncargo && (
        <RegistrarPagoEncargoDialog
          encargo={pagoEncargo}
          producto={productos.find(p => p.id === pagoEncargo.producto_id)}
          onClose={() => setPagoEncargo(null)}
          onSave={(id, update) => registrarPagoEncargo.mutate({ id, update })}
        />
      )}
    </div>
  );
}