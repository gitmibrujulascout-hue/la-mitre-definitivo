import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/ramaUtils';
import { RefreshCw, Zap, Percent } from 'lucide-react';

function roundTo500(value) {
  return Math.round(value / 500) * 500;
}

// Calcula unidades físicas reales de una venta (considerando promos)
function unidadesFisicas(v) {
  if (v.es_promo && v.cantidad_promo) {
    return (v.cantidad_vendida || 0) * v.cantidad_promo;
  }
  return v.cantidad_vendida || 0;
}

export default function DistribuirCreditosDialog({ open, onClose, onSaved, actividad, ventas, gananciaReal, beneficiarios }) {
  const queryClient = useQueryClient();
  const pctBen = actividad.porcentaje_beneficiario || 50;
  const totalVentas = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const gananciaParaBen = Math.max(0, gananciaReal) * pctBen / 100;

  const [modo, setModo] = useState('unidad'); // 'unidad' | 'proporcional'

  // Fetch productos para conocer el "grupo" de cada uno
  const { data: productos = [] } = useQuery({
    queryKey: ['productos-actividad', actividad?.id],
    queryFn: () => base44.entities.ProductoActividad.filter({ actividad_id: actividad.id }),
    enabled: !!actividad?.id && open,
  });

  const getGrupo = (producto_id) => {
    const p = productos.find(pr => pr.id === producto_id);
    return p?.grupo || null;
  };

  // --- Modo proporcional (original) ---
  const calculadosProporcional = useMemo(() => {
    const porBen = {};
    ventas.forEach(v => {
      const key = v.beneficiario_id || v.beneficiario_nombre;
      if (!porBen[key]) {
        porBen[key] = { beneficiario_id: v.beneficiario_id, beneficiario_nombre: v.beneficiario_nombre, monto_recaudado: 0 };
      }
      porBen[key].monto_recaudado += v.monto_recaudado || 0;
    });
    return Object.values(porBen).map(v => {
      const ben = beneficiarios.find(b => b.id === v.beneficiario_id);
      const proporcion = totalVentas > 0 ? v.monto_recaudado / totalVentas : 0;
      const creditoExacto = Math.round(gananciaParaBen * proporcion * 100) / 100;
      const creditoSugerido = roundTo500(creditoExacto);
      return { v, ben, creditoExacto, creditoSugerido, proporcion };
    })
    .filter(d => d.creditoExacto > 0)
    .sort((a, b) => {
      const na = (a.ben?.nombre || a.v.beneficiario_nombre || '').toLowerCase();
      const nb = (b.ben?.nombre || b.v.beneficiario_nombre || '').toLowerCase();
      return na.localeCompare(nb, 'es');
    });
  }, [ventas, gananciaParaBen, totalVentas, beneficiarios]);

  // --- Modo por unidad ---
  // Agrupar productos por "grupo" (o individual si no tiene grupo)
  const productosAgrupados = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      const grupo = getGrupo(v.producto_id);
      const key = grupo || v.producto_id || v.producto_nombre || '__sin_producto__';
      if (!map[key]) {
        map[key] = {
          key,
          grupo: grupo || null,
          producto_id: v.producto_id,
          producto_nombre: v.producto_nombre,
          es_promo: v.es_promo,
          cantidad_promo: v.cantidad_promo,
          totalUnidadesFisicas: 0,
          totalMonto: 0,
        };
      }
      map[key].totalUnidadesFisicas += unidadesFisicas(v);
      map[key].totalMonto += v.monto_recaudado || 0;
    });
    return Object.values(map).sort((a, b) => (a.grupo || a.producto_nombre || '').localeCompare(b.grupo || b.producto_nombre || '', 'es'));
  }, [ventas, productos]);

  // Estado: crédito por unidad física para cada grupo/producto
  const [creditosPorUnidad, setCreditosPorUnidad] = useState({});

  // Inicializar con valor sugerido: gananciaParaBen / total unidades físicas globales
  const totalUnidadesGlobales = productosAgrupados.reduce((s, p) => s + p.totalUnidadesFisicas, 0);
  const valorUnitarioSugerido = totalUnidadesGlobales > 0 ? roundTo500(gananciaParaBen / totalUnidadesGlobales) : 0;

  useEffect(() => {
    if (modo === 'unidad' && productosAgrupados.length > 0) {
      const init = {};
      productosAgrupados.forEach(p => { init[p.key] = valorUnitarioSugerido; });
      setCreditosPorUnidad(init);
    }
  }, [modo, productosAgrupados.length, valorUnitarioSugerido]);

  const setValorUnidad = (key, val) => setCreditosPorUnidad(prev => ({ ...prev, [key]: val === '' ? '' : Number(val) }));
  const aplicarATodos = (val) => {
    const update = {};
    productosAgrupados.forEach(p => { update[p.key] = val; });
    setCreditosPorUnidad(update);
  };

  // Calcular crédito automático por vendedor en modo unidad
  const calculadosPorUnidad = useMemo(() => {
    if (modo !== 'unidad') return [];
    const porBen = {};
    ventas.forEach(v => {
      const key = v.beneficiario_id || v.beneficiario_nombre;
      if (!porBen[key]) {
        porBen[key] = { beneficiario_id: v.beneficiario_id, beneficiario_nombre: v.beneficiario_nombre, unidades: 0, monto: 0 };
      }
      const grupo = getGrupo(v.producto_id);
      const grupoKey = grupo || v.producto_id || v.producto_nombre || '__sin_producto__';
      const valorUnitario = creditosPorUnidad[grupoKey] || 0;
      porBen[key].unidades += unidadesFisicas(v);
      porBen[key].monto += v.monto_recaudado || 0;
      porBen[key].credito = (porBen[key].credito || 0) + (unidadesFisicas(v) * valorUnitario);
    });
    return Object.values(porBen)
      .filter(d => d.credito > 0)
      .map(d => {
        const ben = beneficiarios.find(b => b.id === d.beneficiario_id);
        return { ...d, ben, creditoFinal: Math.round(d.credito) };
      })
      .sort((a, b) => (a.ben?.nombre || a.beneficiario_nombre || '').localeCompare(b.ben?.nombre || b.beneficiario_nombre || '', 'es'));
  }, [ventas, productos, creditosPorUnidad, modo, beneficiarios]);

  // Estado para overrides manuales en modo unidad
  const [overrides, setOverrides] = useState({});
  const getMontoFinal = (key) => overrides[key] ?? calculadosPorUnidad.find(c => (c.beneficiario_id || c.beneficiario_nombre) === key)?.creditoFinal ?? 0;
  const setOverride = (key, val) => setOverrides(prev => ({ ...prev, [key]: val === '' ? '' : Number(val) }));
  const resetOverride = (key) => setOverrides(prev => { const c = { ...prev }; delete c[key]; return c; });

  // Estado para modo proporcional (montos editables)
  const [montos, setMontos] = useState({});
  useEffect(() => {
    if (modo === 'proporcional') {
      const init = {};
      calculadosProporcional.forEach(d => { init[d.v.beneficiario_id || d.v.beneficiario_nombre] = d.creditoSugerido; });
      setMontos(init);
    }
  }, [modo, calculadosProporcional.length, gananciaReal]);

  const getKey = (v) => v.beneficiario_id || v.beneficiario_nombre;
  const getMonto = (key) => montos[key] ?? 0;
  const setMonto = (key, val) => setMontos(prev => ({ ...prev, [key]: val === '' ? '' : Number(val) }));
  const resetMonto = (key, sugerido) => setMontos(prev => ({ ...prev, [key]: sugerido }));

  const totalADistribuir = modo === 'proporcional'
    ? calculadosProporcional.reduce((s, d) => s + (getMonto(getKey(d.v)) || 0), 0)
    : calculadosPorUnidad.reduce((s, d) => s + (getMontoFinal(getKey(d)) || 0), 0);

  const datosFinales = modo === 'proporcional'
    ? calculadosProporcional.map(d => ({ ...d, monto: getMonto(getKey(d.v)) || 0 }))
    : calculadosPorUnidad.map(d => ({ ...d, monto: getMontoFinal(getKey(d)) || 0 }));

  const mutation = useMutation({
    mutationFn: async () => {
      const fecha = new Date().toISOString().split('T')[0];
      const creditos = datosFinales.filter(d => d.monto > 0);
      await Promise.all(creditos.map(d => {
        const ben = 'ben' in d ? d.ben : beneficiarios.find(b => b.id === d.beneficiario_id);
        const nombre = ben?.nombre || d.beneficiario_nombre || d.v?.beneficiario_nombre;
        return base44.entities.CreditoBeneficiario.create({
          beneficiario_id: d.beneficiario_id || d.v?.beneficiario_id,
          beneficiario_nombre: nombre,
          actividad_id: actividad.id,
          actividad_nombre: actividad.nombre,
          monto_original: d.monto,
          monto_disponible: d.monto,
          fecha,
        });
      }));

      // Egreso en Caja: la plata pasa a la "caja de créditos" (reservada)
      const totalMonto = creditos.reduce((s, d) => s + d.monto, 0);
      await base44.entities.MovimientoBanco.create({
        fecha,
        tipo: 'Egreso',
        concepto: `Reserva — Créditos ${actividad.nombre}`,
        monto: totalMonto,
        cuenta: 'Caja',
        origen: 'Crédito',
        observaciones: `Distribución de ganancia a beneficiarios (${pctBen}%)`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-actividad', actividad.id] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Créditos distribuidos correctamente');
      onSaved();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Distribuir créditos</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Ganancia neta</p>
              <p className="font-bold text-green-600">{formatMoney(Math.max(0, gananciaReal))}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Para beneficiarios ({pctBen}%)</p>
              <p className="font-bold text-primary">{formatMoney(gananciaParaBen)}</p>
            </div>
          </div>

          {/* Selector de modo */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setModo('unidad')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'unidad' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <Zap className="w-3.5 h-3.5" />
              Por unidad vendida
            </button>
            <button
              onClick={() => setModo('proporcional')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'proporcional' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <Percent className="w-3.5 h-3.5" />
              Por ganancia proporcional
            </button>
          </div>

          {/* MODO: Por unidad vendida */}
          {modo === 'unidad' && productosAgrupados.length > 0 && (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">Paso 1: Definir crédito por unidad</p>
                <p className="text-xs text-muted-foreground">
                  Todos los vendedores que vendieron la misma cantidad del mismo producto reciben el mismo crédito.
                </p>
              </div>

              {/* Aplicar a todos */}
              <div className="flex items-center gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50/50">
                <span className="text-xs font-medium text-blue-800 flex-1">Mismo valor para todos los productos:</span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="100"
                    placeholder={String(valorUnitarioSugerido)}
                    onChange={e => aplicarATodos(Number(e.target.value) || 0)}
                    className="pl-5 h-8 text-sm"
                  />
                </div>
              </div>

              {/* Tabla de productos con valor por unidad */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {productosAgrupados.map(p => (
                  <div key={p.key} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.grupo || p.producto_nombre || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.totalUnidadesFisicas} uds físicas · {formatMoney(p.totalMonto)} recaudado
                        {p.es_promo && <span className="ml-1 text-amber-600">(promo {p.cantidad_promo}x)</span>}
                      </p>
                    </div>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="100"
                        value={creditosPorUnidad[p.key] ?? ''}
                        onChange={e => setValorUnidad(p.key, e.target.value)}
                        className="pl-5 h-8 text-sm font-semibold text-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview de créditos calculados */}
              {calculadosPorUnidad.length > 0 && (
                <>
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Paso 2: Revisar créditos calculados</p>
                    <p className="text-xs text-muted-foreground mb-2">Se calculan automáticamente. Podés ajustar manualmente si es necesario.</p>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {calculadosPorUnidad.map(d => {
                      const key = getKey(d);
                      const final = getMontoFinal(key);
                      const tieneOverride = overrides[key] !== undefined;
                      return (
                        <div key={key} className="bg-muted/30 rounded-lg px-3 py-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{d.ben?.nombre || d.beneficiario_nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {d.unidades} uds vendidas · {formatMoney(d.monto)} recaudado
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Acreditar:</span>
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="100"
                                min="0"
                                value={final}
                                onChange={e => setOverride(key, e.target.value)}
                                className={`pl-6 h-8 text-sm font-semibold ${tieneOverride ? 'text-amber-600' : 'text-primary'}`}
                              />
                            </div>
                            {tieneOverride && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" title="Restaurar cálculo automático" onClick={() => resetOverride(key)}>
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* MODO: Proporcional */}
          {modo === 'proporcional' && calculadosProporcional.length > 0 && (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">Crédito a acreditar a cada participante:</p>
                <p className="text-xs text-muted-foreground">
                  Distribución proporcional según monto vendido. Valores redondeados a $500.
                </p>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {calculadosProporcional.map(({ v, ben, creditoExacto, creditoSugerido, proporcion }) => {
                  const key = getKey(v);
                  return (
                    <div key={key} className="bg-muted/30 rounded-lg px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{ben?.nombre || v.beneficiario_nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(v.monto_recaudado)} vendidos · {Math.round(proporcion * 100)}% · Exacto: {formatMoney(creditoExacto)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Acreditar:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="500"
                            min="0"
                            value={getMonto(key)}
                            onChange={e => setMonto(key, e.target.value)}
                            className="pl-6 h-8 text-sm font-semibold text-primary"
                          />
                        </div>
                        {getMonto(key) !== creditoSugerido && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" title="Restaurar valor redondeado" onClick={() => resetMonto(key, creditoSugerido)}>
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty states */}
          {((modo === 'unidad' && productosAgrupados.length === 0) || (modo === 'proporcional' && calculadosProporcional.length === 0)) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay ventas registradas o ganancia para distribuir.
            </p>
          )}

          {/* Total */}
          {totalADistribuir > 0 && (
            <>
              <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total a distribuir</span>
                <span className="font-bold text-primary">{formatMoney(totalADistribuir)}</span>
              </div>
              {modo === 'proporcional' && totalADistribuir > gananciaParaBen + 1 && (
                <p className="text-xs text-amber-600 text-center">⚠️ El total supera la ganancia disponible ({formatMoney(gananciaParaBen)})</p>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Estos créditos quedarán disponibles en la cuenta corriente de cada beneficiario.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={datosFinales.length === 0 || mutation.isPending || totalADistribuir <= 0}
          >
            {mutation.isPending ? 'Acreditando...' : 'Confirmar y acreditar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}