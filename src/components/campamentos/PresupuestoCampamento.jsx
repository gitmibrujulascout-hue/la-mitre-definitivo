import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { formatMoney, RAMA_CONFIG } from '@/lib/ramaUtils';
import { Calculator, TrendingUp, TrendingDown, Users, Calendar, Utensils, Bus, Truck, MapPin, Package, Pill, Plus, AlertTriangle, Printer, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEFAULT_ITEMS = [
  { id: 'comida', label: 'Comida', icon: Utensils, perPersonPerDay: true, splitWithAdults: true },
  { id: 'transporte', label: 'Transporte', icon: Bus, perPersonPerDay: false, splitWithAdults: true },
  { id: 'flete', label: 'Flete / Traslado', icon: Truck, perPersonPerDay: false, splitWithAdults: true },
  { id: 'alojamiento', label: 'Alojamiento / Lugar', icon: MapPin, perPersonPerDay: false, splitWithAdults: true },
  { id: 'materiales', label: 'Materiales', icon: Package, perPersonPerDay: false, splitWithAdults: false },
  { id: 'medicamentos', label: 'Medicamentos', icon: Pill, perPersonPerDay: false, splitWithAdults: false },
  { id: 'extras', label: 'Extras', icon: Plus, perPersonPerDay: false, splitWithAdults: false },
  { id: 'imprevistos', label: 'Reserva imprevistos', icon: AlertTriangle, perPersonPerDay: false, splitWithAdults: true },
];

const GASTO_TO_ITEM = {
  'Alimentos': 'comida',
  'Transporte': 'transporte',
  'Mantenimiento': 'alojamiento',
  'Materiales': 'materiales',
  'Campamento': 'alojamiento',
};

export default function PresupuestoCampamento({ open, onClose, campamento, beneficiarios = [], gastos = [] }) {
  const queryClient = useQueryClient();
  const saved = campamento?.presupuesto || {};

  const [comidaPorPersonaDia, setComidaPorPersonaDia] = useState(saved.comida_por_persona_dia || '');
  const [itemValues, setItemValues] = useState(saved.items || {});
  const [itemSplits, setItemSplits] = useState(saved.splits || Object.fromEntries(DEFAULT_ITEMS.map(i => [i.id, i.splitWithAdults])));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const s = campamento?.presupuesto || {};
    setComidaPorPersonaDia(s.comida_por_persona_dia || '');
    setItemValues(s.items || {});
    setItemSplits(s.splits || Object.fromEntries(DEFAULT_ITEMS.map(i => [i.id, i.splitWithAdults])));
    setDirty(false);
  }, [campamento?.id]);

  const getBen = (id) => beneficiarios.find(b => b.id === id);
  const ninos = useMemo(() => (campamento?.beneficiarios_ids || []).map(getBen).filter(Boolean), [campamento, beneficiarios]);
  const adultos = useMemo(() => (campamento?.adultos_ids || []).map(getBen).filter(Boolean), [campamento, beneficiarios]);

  const beneficiariosCamp = ninos.length;
  const adultosCamp = adultos.length;
  const totalPersonas = beneficiariosCamp + adultosCamp;

  const headcountPorRama = useMemo(() => {
    const map = {};
    ninos.forEach(b => {
      const r = b.rama || 'Sin rama';
      map[r] = (map[r] || 0) + 1;
    });
    adultos.forEach(b => {
      const r = b.rama_educador || b.rama || 'Adultos';
      map[r] = (map[r] || 0) + 1;
    });
    return map;
  }, [ninos, adultos]);

  const dias = useMemo(() => {
    if (!campamento?.fecha_inicio || !campamento?.fecha_fin) return 0;
    const ini = new Date(campamento.fecha_inicio + 'T12:00:00');
    const fin = new Date(campamento.fecha_fin + 'T12:00:00');
    const diff = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [campamento]);

  const comidaTotal = (parseFloat(comidaPorPersonaDia) || 0) * totalPersonas * dias;

  const itemTotals = useMemo(() => {
    const totals = {};
    for (const item of DEFAULT_ITEMS) {
      totals[item.id] = item.perPersonPerDay ? comidaTotal : (parseFloat(itemValues[item.id]) || 0);
    }
    return totals;
  }, [comidaTotal, itemValues]);

  const costoTotalEstimado = Object.values(itemTotals).reduce((s, v) => s + v, 0);

  const gastosReales = useMemo(() => {
    const gastosCamp = gastos.filter(g => g.campamento_id === campamento?.id);
    const porItem = {};
    DEFAULT_ITEMS.forEach(i => { porItem[i.id] = 0; });
    gastosCamp.forEach(g => {
      const itemId = GASTO_TO_ITEM[g.categoria] || 'extras';
      porItem[itemId] = (porItem[itemId] || 0) + (g.monto || 0);
    });
    return { porItem, total: gastosCamp.reduce((s, g) => s + (g.monto || 0), 0) };
  }, [gastos, campamento]);

  const costoPorBeneficiario = useMemo(() => {
    if (beneficiariosCamp === 0) return 0;
    let totalBen = 0;
    for (const item of DEFAULT_ITEMS) {
      const val = itemTotals[item.id];
      const divisors = itemSplits[item.id] ? totalPersonas : beneficiariosCamp;
      if (divisors > 0) totalBen += (val / divisors) * beneficiariosCamp;
    }
    return totalBen / beneficiariosCamp;
  }, [itemTotals, itemSplits, totalPersonas, beneficiariosCamp]);

  const ingresoBeneficiarios = beneficiariosCamp * (campamento?.costo_por_persona || 0);
  const ingresoAdultos = campamento?.adultos_pagan
    ? adultosCamp * (campamento?.costo_adultos || campamento?.costo_por_persona || 0)
    : 0;
  const ingresoTotal = ingresoBeneficiarios + ingresoAdultos;
  const resultado = ingresoTotal - costoTotalEstimado;

  const saveMutation = useMutation({
    mutationFn: data => base44.entities.Campamento.update(campamento.id, { presupuesto: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campamentos'] });
      setDirty(false);
      toast.success('Presupuesto guardado');
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      comida_por_persona_dia: comidaPorPersonaDia,
      items: itemValues,
      splits: itemSplits,
    });
  };

  const rows = DEFAULT_ITEMS.map(item => ({
    ...item,
    value: itemTotals[item.id],
    real: gastosReales.porItem[item.id] || 0,
    detail: item.perPersonPerDay && dias > 0 && totalPersonas > 0 && comidaPorPersonaDia
      ? `${formatMoney(parseFloat(comidaPorPersonaDia) || 0)} × ${totalPersonas} pers × ${dias} días`
      : null,
    split: itemSplits[item.id],
    divisors: itemSplits[item.id] ? totalPersonas : beneficiariosCamp,
  }));

  const handlePrint = () => {
    const rowsHtml = rows.map(r => {
      const diff = r.value - r.real;
      const diffStr = r.real > 0
        ? `<td style="text-align:right;color:${diff >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${diff >= 0 ? '+' : ''}${formatMoney(diff)}</td>`
        : '<td style="text-align:center;color:#999">—</td>';
      return `<tr><td>${r.label}</td><td style="text-align:right">${formatMoney(r.value)}</td><td style="text-align:right;color:${r.real > 0 ? '#dc2626' : '#999'}">${r.real > 0 ? formatMoney(r.real) : '—'}</td>${diffStr}</tr>`;
    }).join('');

    const ramaHtml = Object.entries(headcountPorRama).map(([r, c]) => `${r}: ${c}`).join(' · ');
    const totalDiff = costoTotalEstimado - gastosReales.total;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Presupuesto ${campamento?.nombre}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:13px}
      h1{font-size:18px;margin-bottom:4px}
      .meta{color:#555;margin-bottom:16px;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;font-size:12px}
      th{background:#f0f0f0;font-weight:bold}
      .total{background:#f3f4f6;font-weight:bold}
      .resultado{margin-top:16px;padding:10px;border-radius:6px;font-size:14px;font-weight:bold;text-align:center}
    </style></head><body>
    <h1>Presupuesto — ${campamento?.nombre}</h1>
    <div class="meta">${campamento?.ubicacion ? `📍 ${campamento.ubicacion} · ` : ''}${dias} días · ${totalPersonas} personas (${beneficiariosCamp} ben. + ${adultosCamp} adult.)${ramaHtml ? ` · ${ramaHtml}` : ''}</div>
    <table><thead><tr><th>Categoría</th><th style="text-align:right">Presupuestado</th><th style="text-align:right">Gasto real</th><th style="text-align:right">Diferencia</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr class="total"><td>Costo total estimado</td><td style="text-align:right">${formatMoney(costoTotalEstimado)}</td><td style="text-align:right">${formatMoney(gastosReales.total)}</td><td style="text-align:right">${formatMoney(totalDiff)}</td></tr></tfoot></table>
    <div class="resultado" style="background:${resultado >= 0 ? '#dcfce7' : '#fee2e2'};color:${resultado >= 0 ? '#16a34a' : '#dc2626'}">${resultado >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'}: ${formatMoney(Math.abs(resultado))} (Ingresos ${formatMoney(ingresoTotal)} − Gastos ${formatMoney(costoTotalEstimado)})</div>
    <p style="margin-top:12px;color:#666;font-size:11px">Costo por beneficiario: ${formatMoney(costoPorBeneficiario)}</p>
    </body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Presupuesto — {campamento?.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumen del campamento */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold">{totalPersonas}</p>
              <p className="text-xs text-muted-foreground">{beneficiariosCamp} ben. + {adultosCamp} adult.</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <Calendar className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold">{dias}</p>
              <p className="text-xs text-muted-foreground">días</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
              <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-green-700">{formatMoney(ingresoTotal)}</p>
              <p className="text-xs text-muted-foreground">Ingreso esp.</p>
            </div>
          </div>

          {/* Headcount por rama (para cocina) */}
          {Object.keys(headcountPorRama).length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground font-medium">Cocina:</span>
              {Object.entries(headcountPorRama).map(([rama, count]) => {
                const config = RAMA_CONFIG[rama];
                return (
                  <span key={rama} className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', config?.badge || 'bg-muted')}>
                    {rama}: {count}
                  </span>
                );
              })}
            </div>
          )}

          {/* Inputs de gastos estimados */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Comida por persona por día</Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={itemSplits.comida}
                    onCheckedChange={(v) => { setItemSplits(prev => ({ ...prev, comida: v })); setDirty(true); }}
                  />
                  Dividir con adultos
                </label>
              </div>
              <Input
                type="number"
                value={comidaPorPersonaDia}
                onChange={e => { setComidaPorPersonaDia(e.target.value); setDirty(true); }}
                placeholder="Ej: 5000"
              />
              {dias > 0 && totalPersonas > 0 && comidaPorPersonaDia && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatMoney(comidaTotal)} ({itemSplits.comida ? totalPersonas : beneficiariosCamp} pers × {dias} días)
                </p>
              )}
            </div>

            {DEFAULT_ITEMS.filter(i => !i.perPersonPerDay).map(item => (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-1">
                  <Label className="flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {item.label}
                  </Label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={itemSplits[item.id]}
                      onCheckedChange={(v) => { setItemSplits(prev => ({ ...prev, [item.id]: v })); setDirty(true); }}
                    />
                    Dividir con adultos
                  </label>
                </div>
                <Input
                  type="number"
                  value={itemValues[item.id] || ''}
                  onChange={e => { setItemValues(prev => ({ ...prev, [item.id]: e.target.value })); setDirty(true); }}
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {/* Resumen de costos con comparación real */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 gap-1 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span className="col-span-5">Categoría</span>
              <span className="col-span-3 text-right">Presup.</span>
              <span className="col-span-2 text-right">Real</span>
              <span className="col-span-2 text-right">Diff.</span>
            </div>
            {rows.map(r => {
              const diff = r.value - r.real;
              const tieneReal = r.real > 0;
              return (
                <div key={r.id} className="grid grid-cols-12 gap-1 items-center py-1.5 px-3 bg-muted/30 rounded-md">
                  <div className="col-span-5 flex items-center gap-1.5">
                    <r.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{r.label}</span>
                    {r.split && <span className="text-[10px] text-purple-600 whitespace-nowrap">↗{r.divisors}p</span>}
                  </div>
                  <span className="col-span-3 text-right text-sm font-medium">{formatMoney(r.value)}</span>
                  <span className={cn('col-span-2 text-right text-xs', tieneReal ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                    {tieneReal ? formatMoney(r.real) : '—'}
                  </span>
                  <span className={cn('col-span-2 text-right text-xs font-medium', !tieneReal ? 'text-muted-foreground' : diff >= 0 ? 'text-green-600' : 'text-red-500')}>
                    {tieneReal ? (diff >= 0 ? '+' : '') + formatMoney(diff) : '—'}
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-12 gap-1 items-center py-2 px-3 bg-slate-100 rounded-md border-t-2 border-slate-300">
              <span className="col-span-5 text-sm font-bold">Total</span>
              <span className="col-span-3 text-right text-sm font-bold text-slate-700">{formatMoney(costoTotalEstimado)}</span>
              <span className="col-span-2 text-right text-sm font-bold text-red-600">{formatMoney(gastosReales.total)}</span>
              <span className={cn('col-span-2 text-right text-sm font-bold', costoTotalEstimado - gastosReales.total >= 0 ? 'text-green-600' : 'text-red-500')}>
                {formatMoney(costoTotalEstimado - gastosReales.total)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 bg-muted/30 rounded-md">
              <span className="text-sm text-muted-foreground">Costo por beneficiario</span>
              <span className="text-sm font-medium">{formatMoney(costoPorBeneficiario)}</span>
            </div>
          </div>

          {/* Resultado */}
          <Card className={`p-4 ${resultado >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {resultado >= 0
                  ? <TrendingUp className="w-5 h-5 text-green-600" />
                  : <TrendingDown className="w-5 h-5 text-red-500" />}
                <div>
                  <p className="text-sm font-semibold">{resultado >= 0 ? 'Superávit estimado' : 'Déficit estimado'}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(ingresoTotal)} ingresos − {formatMoney(costoTotalEstimado)} gastos</p>
                </div>
              </div>
              <p className={`text-xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatMoney(Math.abs(resultado))}
              </p>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : dirty ? <><Save className="w-4 h-4 mr-2" />Guardar</> : <><Check className="w-4 h-4 mr-2" />Guardado</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}