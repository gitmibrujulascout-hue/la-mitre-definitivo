import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { Users, Package, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function VentaTiendaForm({ open, onClose, productos, beneficiarios, ventas = [] }) {
  const [productoId, setProductoId] = useState('');
  const [talle, setTalle] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [esBeneficiario, setEsBeneficiario] = useState(false);
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [compradorNombre, setCompradorNombre] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [creditoId, setCreditoId] = useState('');
  const [montoCreditoAplicar, setMontoCreditoAplicar] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setProductoId(''); setTalle(''); setCantidad('1'); setPrecioUnitario('');
    setEsBeneficiario(false); setBeneficiarioId(''); setCompradorNombre('');
    setFecha(new Date().toISOString().split('T')[0]); setFormaPago('Efectivo');
    setCreditoId(''); setMontoCreditoAplicar('');
  }, [open]);

  const producto = useMemo(() => productos.find(p => p.id === productoId), [productos, productoId]);

  const { data: creditosBen = [] } = useQuery({
    queryKey: ['creditos-beneficiario-tienda', beneficiarioId],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ beneficiario_id: beneficiarioId }, '-fecha', 50),
    enabled: !!beneficiarioId,
  });

  const creditosDisponibles = useMemo(() =>
    (creditosBen || []).filter(c => (c.monto_disponible || 0) > 0),
    [creditosBen]
  );
  const totalCreditos = creditosDisponibles.reduce((s, c) => s + (c.monto_disponible || 0), 0);
  const creditoSeleccionado = creditosDisponibles.find(c => c.id === creditoId) || creditosDisponibles[0];

  useEffect(() => {
    if (producto) setPrecioUnitario(producto.precio_venta?.toString() || '');
    setTalle(''); setCantidad('1');
  }, [productoId]);

  const esCombo = producto?.es_combo;
  const cajaExclusiva = producto?.caja_exclusiva;

  const stockDisponible = useMemo(() => {
    if (!producto || esCombo) return 999;
    if (producto.tiene_talles) return producto.stock_por_talle?.[talle] ?? 0;
    return producto.stock ?? 0;
  }, [producto, talle, esCombo]);

  // Component products for combo stock check
  const comboComponentes = useMemo(() => {
    if (!esCombo || !producto?.productos_combo) return [];
    return producto.productos_combo.map(comp => {
      const prod = productos.find(p => p.id === comp.producto_id || p.nombre === comp.producto_nombre);
      return {
        ...comp,
        producto: prod,
        stock: prod ? (prod.stock ?? 0) : 0,
      };
    });
  }, [esCombo, producto, productos]);

  const cantidadNum = parseInt(cantidad) || 0;
  const precioNum = parseFloat(precioUnitario) || 0;

  // Family discount check
  const familiaYaCompro = useMemo(() => {
    if (!esBeneficiario || !beneficiarioId || !producto) return false;
    const ben = beneficiarios.find(b => b.id === beneficiarioId);
    if (!ben || !ben.grupo_familiar) return false;
    // Find other family members
    const familiaresIds = beneficiarios
      .filter(b => b.grupo_familiar === ben.grupo_familiar && b.id !== ben.id)
      .map(b => b.id);
    if (familiaresIds.length === 0) return false;
    // Check if any family member already bought this product
    return ventas.some(v => v.producto_id === productoId && familiaresIds.includes(v.beneficiario_id));
  }, [esBeneficiario, beneficiarioId, producto, productoId, beneficiarios, ventas]);

  const pctDescuento = familiaYaCompro && producto ? (producto.descuento_familiar_pct || 0) : 0;
  const descuentoUnitario = precioNum * (pctDescuento / 100);
  const precioConDescuento = precioNum - descuentoUnitario;
  const montoTotal = cantidadNum * precioConDescuento;
  const descuentoTotal = descuentoUnitario * cantidadNum;

  const usaCredito = formaPago === 'Crédito actividad';
  const montoCreditoNum = usaCredito && creditoSeleccionado ? Math.min(parseFloat(montoCreditoAplicar) || 0, creditoSeleccionado.monto_disponible) : 0;
  const diferenciaCredito = usaCredito ? Math.max(0, montoTotal - montoCreditoNum) : 0;

  useEffect(() => {
    if (formaPago !== 'Crédito actividad' || montoTotal === 0) return;
    if (creditosDisponibles.length > 0 && !creditosDisponibles.find(c => c.id === creditoId)) {
      setCreditoId(creditosDisponibles[0].id);
    }
    if (creditoSeleccionado) {
      setMontoCreditoAplicar(Math.min(creditoSeleccionado.monto_disponible, montoTotal).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formaPago, montoTotal]);

  const sinStock = !esCombo && producto && cantidadNum > stockDisponible;
  const comboSinStock = esCombo && comboComponentes.some(c => !c.producto || c.stock < (c.cantidad * cantidadNum));

  const ventaMutation = useMutation({
    mutationFn: async () => {
      const ben = esBeneficiario ? beneficiarios.find(b => b.id === beneficiarioId) : null;
      const destino = cajaExclusiva ? 'Caja exclusiva' : (formaPago === 'Transferencia' ? 'Banco' : 'Caja');

      const obsCredito = usaCredito && creditoSeleccionado
        ? `Crédito aplicado de: ${creditoSeleccionado.actividad_nombre}` + (diferenciaCredito > 0 ? `. Diferencia en efectivo: ${formatMoney(diferenciaCredito)}` : '')
        : undefined;

      // 1. Create the sale
      await base44.entities.VentaTienda.create({
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        beneficiario_id: esBeneficiario ? beneficiarioId : undefined,
        beneficiario_nombre: ben?.nombre,
        comprador_nombre: !esBeneficiario ? compradorNombre : undefined,
        talle: producto.tiene_talles && !esCombo ? talle : undefined,
        cantidad: cantidadNum,
        precio_unitario: precioConDescuento,
        monto_total: montoTotal,
        descuento_aplicado: descuentoTotal > 0 ? descuentoTotal : undefined,
        es_combo: esCombo,
        fecha,
        forma_pago: formaPago,
        destino,
        observaciones: obsCredito,
      });

      // 2. Decrement stock
      if (esCombo) {
        // Decrement stock of each component product
        for (const comp of comboComponentes) {
          if (!comp.producto) continue;
          const nuevoStock = Math.max(0, (comp.producto.stock ?? 0) - (comp.cantidad * cantidadNum));
          await base44.entities.ProductoTienda.update(comp.producto.id, { stock: nuevoStock });
        }
      } else if (producto.tiene_talles) {
        const nuevoStock = { ...producto.stock_por_talle, [talle]: Math.max(0, stockDisponible - cantidadNum) };
        await base44.entities.ProductoTienda.update(producto.id, { stock_por_talle: nuevoStock });
      } else {
        const nuevoStock = Math.max(0, (producto.stock || 0) - cantidadNum);
        await base44.entities.ProductoTienda.update(producto.id, { stock: nuevoStock });
      }

      // 3. Decrement credit if using credit payment
      if (usaCredito && creditoSeleccionado) {
        await base44.entities.CreditoBeneficiario.update(creditoSeleccionado.id, {
          monto_disponible: Math.max(0, creditoSeleccionado.monto_disponible - montoCreditoNum),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario-tienda'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
      toast.success('Venta registrada y stock actualizado');
      onClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  const handleSave = () => {
    if (!producto || cantidadNum <= 0 || sinStock || comboSinStock) return;
    if (esBeneficiario ? !beneficiarioId : !compradorNombre) return;
    ventaMutation.mutate();
  };

  const puedeGuardar = producto && cantidadNum > 0 && !sinStock && !comboSinStock && (esBeneficiario ? beneficiarioId : compradorNombre) && (!usaCredito || montoCreditoNum > 0);

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
                    {p.caja_exclusiva ? ' 🔒' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Combo components display */}
          {esCombo && comboComponentes.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
              <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> Combo incluye:
              </p>
              {comboComponentes.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-blue-700">
                  <span>{c.producto_nombre || c.producto?.nombre || '—'}</span>
                  <span>
                    {c.cantidad * cantidadNum} uds
                    {c.producto && c.stock < (c.cantidad * cantidadNum) && (
                      <span className="text-red-500 font-medium ml-1">⚠ sin stock</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {producto?.tiene_talles && !esCombo && (
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
              {!esCombo && producto && (
                <p className="text-xs text-muted-foreground mt-1">Disponible: {stockDisponible}</p>
              )}
            </div>
            <div>
              <Label>Precio unitario</Label>
              <Input type="number" value={precioUnitario} onChange={e => setPrecioUnitario(e.target.value)} />
            </div>
          </div>

          {/* Family discount */}
          {familiaYaCompro && pctDescuento > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <Users className="w-4 h-4 text-green-600 shrink-0" />
              <div className="text-sm text-green-700">
                <p className="font-medium">Descuento familiar del {pctDescuento}% aplicado</p>
                <p className="text-xs">Un familiar de este grupo ya compró este producto</p>
              </div>
            </div>
          )}

          {/* Caja exclusiva notice */}
          {cajaExclusiva && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
              🔒 Esta venta va a una caja exclusiva separada
            </div>
          )}

          {sinStock && (
            <p className="text-sm text-red-500">⚠ Stock insuficiente para esta venta</p>
          )}
          {comboSinStock && (
            <p className="text-sm text-red-500">⚠ Stock insuficiente en uno o más componentes del combo</p>
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

          {esBeneficiario && (
            <div>
              <Label>Beneficiario</Label>
              <Select value={beneficiarioId} onValueChange={v => { setBeneficiarioId(v); setCreditoId(''); setMontoCreditoAplicar(''); if (formaPago === 'Crédito actividad') setFormaPago('Efectivo'); }}>
                <SelectTrigger><SelectValue placeholder="Buscar beneficiario..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {beneficiarios.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {beneficiarioId && creditosDisponibles.length > 0 && (
                <div className="mt-2 p-2.5 rounded-lg border border-green-200 bg-green-50/60 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="text-green-800 font-medium">Créditos disponibles: </span>
                    <span className="text-green-700 font-bold">{formatMoney(totalCreditos)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {!esBeneficiario && (
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
              <Select value={formaPago} onValueChange={setFormaPago} disabled={cajaExclusiva}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  {esBeneficiario && creditosDisponibles.length > 0 && (
                    <SelectItem value="Crédito actividad">Crédito actividad — {formatMoney(totalCreditos)} disp.</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Total */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de la venta</span>
              <span className="text-xl font-bold">{formatMoney(montoTotal)}</span>
            </div>
            {descuentoTotal > 0 && (
              <p className="text-xs text-green-600 text-right">Ahorro familiar: −{formatMoney(descuentoTotal)}</p>
            )}
          </div>
        </div>

        {usaCredito && creditoSeleccionado && montoTotal > 0 && (
          <div className="space-y-3 p-3 rounded-lg border border-green-200 bg-green-50/40 mb-2">
            {creditosDisponibles.length > 1 && (
              <div>
                <Label>Origen del crédito</Label>
                <Select value={creditoSeleccionado.id} onValueChange={setCreditoId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {creditosDisponibles.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.actividad_nombre} — {formatMoney(c.monto_disponible)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total de la venta:</span>
                <span className="font-medium">{formatMoney(montoTotal)}</span>
              </div>
              <div>
                <Label>Monto de crédito a aplicar</Label>
                <Input
                  type="number"
                  value={montoCreditoAplicar}
                  onChange={e => setMontoCreditoAplicar(e.target.value)}
                  max={creditoSeleccionado.monto_disponible}
                />
                <p className="text-xs text-muted-foreground mt-0.5">Disponible: {formatMoney(creditoSeleccionado.monto_disponible)}</p>
              </div>
              {diferenciaCredito > 0 ? (
                <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>El crédito no cubre el total. Diferencia en efectivo: {formatMoney(diferenciaCredito)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>El crédito cubre el total de la venta.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!puedeGuardar || ventaMutation.isPending}>
            {ventaMutation.isPending ? 'Registrando...' : 'Registrar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}