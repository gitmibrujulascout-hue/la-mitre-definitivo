import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney, RAMA_CONFIG } from '@/lib/ramaUtils';
import { Calculator, TrendingUp, TrendingDown, Users, Calendar, Utensils, Bus, Truck, MapPin, Package, Pill, Plus, AlertTriangle, Printer, Save, Check, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'fijo', label: 'Monto fijo', desc: 'Total del rubro' },
  { value: 'por_persona_dia', label: '$/pers/día', desc: 'Por persona por día' },
  { value: 'por_persona', label: '$/pers', desc: 'Por persona (total)' },
  { value: 'cantidad_precio', label: 'Cant × $', desc: 'Cantidad × precio unitario' },
];

const DIVISION = [
  { value: 'todos', label: 'Todos', desc: 'Ben. + adultos' },
  { value: 'beneficiarios', label: 'Sólo ben.', desc: 'Sólo beneficiarios' },
];

const DEFAULT_ITEMS = [
  { id: 'comida', label: 'Comida', icon: Utensils, tipoDefault: 'por_persona_dia', dividirDefault: 'todos' },
  { id: 'transporte', label: 'Transporte', icon: Bus, tipoDefault: 'fijo', dividirDefault: 'todos' },
  { id: 'flete', label: 'Flete / Traslado', icon: Truck, tipoDefault: 'fijo', dividirDefault: 'todos' },
  { id: 'alojamiento', label: 'Alojamiento / Lugar', icon: MapPin, tipoDefault: 'fijo', dividirDefault: 'todos' },
  { id: 'materiales', label: 'Materiales', icon: Package, tipoDefault: 'fijo', dividirDefault: 'beneficiarios' },
  { id: 'medicamentos', label: 'Medicamentos', icon: Pill, tipoDefault: 'fijo', dividirDefault: 'beneficiarios' },
  { id: 'extras', label: 'Extras', icon: Plus, tipoDefault: 'fijo', dividirDefault: 'todos' },
  { id: 'imprevistos', label: 'Reserva imprevistos', icon: AlertTriangle, tipoDefault: 'fijo', dividirDefault: 'todos' },
];

const GASTO_TO_ITEM = {
  'Alimentos': 'comida',
  'Transporte': 'transporte',
  'Mantenimiento': 'alojamiento',
  'Materiales': 'materiales',
  'Campamento': 'alojamiento',
};

// Detect format: new (items values are objects) vs old (items values are numbers)
function isNewFormat(items) {
  if (!items || typeof items !== 'object') return false;
  const vals = Object.values(items);
  return vals.length > 0 && typeof vals[0] === 'object';
}

// Migrate old format → new format
function migratePresupuesto(saved, camp) {
  const result = {
    cantidad_beneficiarios: saved.cantidad_beneficiarios ?? (camp?.beneficiarios_ids?.length ?? 0),
    cantidad_adultos: saved.cantidad_adultos ?? (camp?.adultos_ids?.length ?? 0),
    dias_manual: saved.dias_manual ?? null,
    adultos_pagan_override: saved.adultos_pagan_override ?? null,
    items: {},
  };

  // Already new format → use directly, fill defaults for missing items
  if (isNewFormat(saved.items)) {
    for (const def of DEFAULT_ITEMS) {
      const existing = saved.items[def.id];
      result.items[def.id] = {
        tipo: existing?.tipo || def.tipoDefault,
        monto: existing?.monto ?? '',
        cantidad: existing?.cantidad ?? '',
        precio_unitario: existing?.precio_unitario ?? '',
        dividir_entre: existing?.dividir_entre || def.dividirDefault,
      };
    }
    return result;
  }

  // Old format migration
  const oldItems = saved.items || {};
  const oldSplits = saved.splits || {};
  const oldComida = saved.comida_por_persona_dia;

  for (const def of DEFAULT_ITEMS) {
    const oldSplit = oldSplits[def.id];
    const dividir = oldSplit != null ? (oldSplit ? 'todos' : 'beneficiarios') : def.dividirDefault;

    if (def.id === 'comida' && oldComida) {
      result.items[def.id] = { tipo: 'por_persona_dia', monto: oldComida, dividir_entre: dividir };
    } else if (oldItems[def.id] != null && oldItems[def.id] !== '') {
      result.items[def.id] = { tipo: 'fijo', monto: String(oldItems[def.id]), dividir_entre: dividir };
    } else {
      result.items[def.id] = { tipo: def.tipoDefault, monto: '', dividir_entre: def.dividirDefault };
    }
  }

  return result;
}

export default function PresupuestoCampamento({ open, onClose, campamento, beneficiarios = [], gastos = [] }) {
  const queryClient = useQueryClient();
  const saved = campamento?.presupuesto || {};

  const [estado, setEstado] = useState(() => migratePresupuesto(saved, campamento, beneficiarios));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEstado(migratePresupuesto(campamento?.presupuesto || {}, campamento, beneficiarios));
    setDirty(false);
  }, [campamento?.id]);

  const getBen = (id) => beneficiarios.find(b => b.id === id);
  const ninosCamp = (campamento?.beneficiarios_ids || []).map(getBen).filter(Boolean).length;
  const adultosCamp = (campamento?.adultos_ids || []).map(getBen).filter(Boolean).length;

  const cantBen = parseInt(estado.cantidad_beneficiarios) || 0;
  const cantAdultos = parseInt(estado.cantidad_adultos) || 0;
  const totalPersonas = cantBen + cantAdultos;

  const adultosPagan = estado.adultos_pagan_override ?? campamento?.adultos_pagan ?? false;

  const diasAuto = useMemo(() => {
    if (!campamento?.fecha_inicio || !campamento?.fecha_fin) return 0;
    const ini = new Date(campamento.fecha_inicio + 'T12:00:00');
    const fin = new Date(campamento.fecha_fin + 'T12:00:00');
    const diff = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [campamento]);
  const dias = estado.dias_manual != null && estado.dias_manual !== '' ? parseInt(estado.dias_manual) : diasAuto;

  // Calculate each item total
  const itemCalculations = useMemo(() => {
    const result = {};
    for (const def of DEFAULT_ITEMS) {
      const item = estado.items[def.id] || { tipo: def.tipoDefault, monto: '', dividir_entre: def.dividirDefault };
      const tipo = item.tipo || 'fijo';
      const dividir = item.dividir_entre || 'todos';
      const personasDivisor = dividir === 'todos' ? totalPersonas : cantBen;

      let total = 0;
      let detalle = '';

      if (tipo === 'fijo') {
        total = parseFloat(item.monto) || 0;
        detalle = '';
      } else if (tipo === 'por_persona_dia') {
        const monto = parseFloat(item.monto) || 0;
        total = monto * personasDivisor * dias;
        if (monto && personasDivisor && dias) detalle = `${formatMoney(monto)} × ${personasDivisor} pers × ${dias} días`;
      } else if (tipo === 'por_persona') {
        const monto = parseFloat(item.monto) || 0;
        total = monto * personasDivisor;
        if (monto && personasDivisor) detalle = `${formatMoney(monto)} × ${personasDivisor} pers`;
      } else if (tipo === 'cantidad_precio') {
        const cant = parseFloat(item.cantidad) || 0;
        const precio = parseFloat(item.precio_unitario) || 0;
        total = cant * precio;
        if (cant && precio) detalle = `${cant} × ${formatMoney(precio)}`;
      }

      result[def.id] = { total, detalle, tipo, dividir, personasDivisor };
    }
    return result;
  }, [estado, totalPersonas, cantBen, dias]);

  const costoTotalEstimado = Object.values(itemCalculations).reduce((s, c) => s + c.total, 0);

  // Cost per beneficiary
  const costoPorBeneficiario = useMemo(() => {
    if (cantBen === 0) return 0;
    let totalBen = 0;
    for (const def of DEFAULT_ITEMS) {
      const calc = itemCalculations[def.id];
      const divisor = calc.dividir === 'todos' ? totalPersonas : cantBen;
      if (divisor > 0) totalBen += calc.total / divisor;
    }
    return totalBen;
  }, [itemCalculations, totalPersonas, cantBen]);

  const costoPorPersona = useMemo(() => {
    if (totalPersonas === 0) return 0;
    return costoTotalEstimado / totalPersonas;
  }, [costoTotalEstimado, totalPersonas]);

  // Gastos reales
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

  // Ingresos
  const costoBenCamp = campamento?.costo_por_persona || 0;
  const costoAdultoCamp = campamento?.costo_adultos || costoBenCamp;
  const ingresoBeneficiarios = cantBen * costoBenCamp;
  const ingresoAdultos = adultosPagan ? cantAdultos * costoAdultoCamp : 0;
  const ingresoTotal = ingresoBeneficiarios + ingresoAdultos;
  const resultado = ingresoTotal - costoTotalEstimado;

  const saveMutation = useMutation({
    mutationFn: data => base44.entities.Campamento.update(campamento.id, { presupuesto: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campamentos'] });
      queryClient.invalidateQueries({ queryKey: ['campamento_pub'] });
      setDirty(false);
      toast.success('Presupuesto guardado');
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      cantidad_beneficiarios: estado.cantidad_beneficiarios,
      cantidad_adultos: estado.cantidad_adultos,
      dias_manual: estado.dias_manual,
      adultos_pagan_override: estado.adultos_pagan_override,
      items: estado.items,
    });
  };

  const updateItem = (id, field, value) => {
    setEstado(prev => ({
      ...prev,
      items: { ...prev.items, [id]: { ...prev.items[id], [field]: value } },
    }));
    setDirty(true);
  };

  const syncFromCampamento = () => {
    setEstado(prev => ({
      ...prev,
      cantidad_beneficiarios: ninosCamp,
      cantidad_adultos: adultosCamp,
      dias_manual: null,
      adultos_pagan_override: null,
    }));
    setDirty(true);
    toast.info(`Sincronizado: ${ninosCamp} ben. + ${adultosCamp} adultos`);
  };

  const rows = DEFAULT_ITEMS.map(item => ({
    ...item,
    calc: itemCalculations[item.id],
    real: gastosReales.porItem[item.id] || 0,
  }));

  const handlePrint = () => {
    const rowsHtml = rows.map(r => {
      const calc = r.calc;
      const diff = calc.total - r.real;
      const diffStr = r.real > 0
        ? `<td style="text-align:right;color:${diff >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${diff >= 0 ? '+' : ''}${formatMoney(diff)}</td>`
        : '<td style="text-align:center;color:#999">—</td>';
      const detalleStr = calc.detalle ? `<br><span style="font-size:10px;color:#888">${calc.detalle}</span>` : '';
      const tipoStr = TIPOS.find(t => t.value === calc.tipo)?.label || '';
      const divStr = calc.dividir === 'todos' ? 'Todos' : 'Sólo ben.';
      return `<tr><td>${r.label}${detalleStr}</td><td style="text-align:center;font-size:10px">${tipoStr} / ${divStr}</td><td style="text-align:right">${formatMoney(calc.total)}</td><td style="text-align:right;color:${r.real > 0 ? '#dc2626' : '#999'}">${r.real > 0 ? formatMoney(r.real) : '—'}</td>${diffStr}</tr>`;
    }).join('');

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
      .resumen{margin-top:12px;display:flex;gap:16px;font-size:12px}
      .resumen div{padding:8px 12px;border-radius:6px;background:#f8f8f8}
    </style></head><body>
    <h1>Presupuesto — ${campamento?.nombre}</h1>
    <div class="meta">${campamento?.ubicacion ? `📍 ${campamento.ubicacion} · ` : ''}${dias} días · ${totalPersonas} personas (${cantBen} ben. + ${cantAdultos} adult.)${adultosPagan ? ' · Adultos pagan' : ' · Adultos no pagan'}</div>
    <table><thead><tr><th>Categoría</th><th style="text-align:center">Tipo / Div.</th><th style="text-align:right">Presupuestado</th><th style="text-align:right">Gasto real</th><th style="text-align:right">Diferencia</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr class="total"><td colspan="2">Costo total estimado</td><td style="text-align:right">${formatMoney(costoTotalEstimado)}</td><td style="text-align:right">${formatMoney(gastosReales.total)}</td><td style="text-align:right">${formatMoney(totalDiff)}</td></tr></tfoot></table>
    <div class="resumen">
      <div>Costo/beneficiario: <b>${formatMoney(costoPorBeneficiario)}</b></div>
      <div>Costo/persona: <b>${formatMoney(costoPorPersona)}</b></div>
      <div>Ingreso esperado: <b>${formatMoney(ingresoTotal)}</b></div>
    </div>
    <div class="resultado" style="background:${resultado >= 0 ? '#dcfce7' : '#fee2e2'};color:${resultado >= 0 ? '#16a34a' : '#dc2626'}">${resultado >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'}: ${formatMoney(Math.abs(resultado))}</div>
    </body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const updateField = (field, value) => {
    setEstado(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Presupuesto — {campamento?.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Variables del presupuesto */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Variables del presupuesto
              </p>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600" onClick={syncFromCampamento}>
                Sync desde campamento ({ninosCamp}+{adultosCamp})
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Beneficiarios</Label>
                <Input type="number" value={estado.cantidad_beneficiarios} onChange={e => updateField('cantidad_beneficiarios', e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Adultos</Label>
                <Input type="number" value={estado.cantidad_adultos} onChange={e => updateField('cantidad_adultos', e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Días {estado.dias_manual == null && `(auto: ${diasAuto})`}</Label>
                <Input type="number" value={estado.dias_manual ?? ''} onChange={e => updateField('dias_manual', e.target.value)} placeholder={String(diasAuto)} className="h-8" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer pb-1.5">
                  <input
                    type="checkbox"
                    checked={adultosPagan}
                    onChange={e => updateField('adultos_pagan_override', e.target.checked)}
                    className="rounded"
                  />
                  Adultos pagan
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white/60 rounded px-2 py-1">
                <span className="text-muted-foreground">Total pers: </span>
                <span className="font-bold">{totalPersonas}</span>
              </div>
              <div className="bg-white/60 rounded px-2 py-1">
                <span className="text-muted-foreground">Días: </span>
                <span className="font-bold">{dias}</span>
              </div>
              <div className="bg-white/60 rounded px-2 py-1">
                <span className="text-muted-foreground">$/ben: </span>
                <span className="font-bold">{formatMoney(costoBenCamp)}</span>
              </div>
              <div className="bg-white/60 rounded px-2 py-1">
                <span className="text-muted-foreground">$/adulto: </span>
                <span className="font-bold">{formatMoney(costoAdultoCamp)}</span>
              </div>
            </div>
          </div>

          {/* Items del presupuesto */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rubros del presupuesto</p>
            {rows.map(item => {
              const calc = item.calc;
              return (
                <div key={item.id} className="rounded-lg border p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    <Badge2 className={cn('text-[10px]', calc.dividir === 'todos' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
                      {calc.dividir === 'todos' ? `${totalPersonas} pers` : `${cantBen} ben`}
                    </Badge2>
                    <span className="text-sm font-bold tabular-nums w-20 text-right">{formatMoney(calc.total)}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1.5 items-end">
                    <div className="col-span-3">
                      <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                      <Select value={calc.tipo} onValueChange={v => updateItem(item.id, 'tipo', v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPOS.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-[10px] text-muted-foreground">Dividir entre</Label>
                      <Select value={calc.dividir} onValueChange={v => updateItem(item.id, 'dividir_entre', v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DIVISION.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {calc.tipo === 'fijo' && (
                      <div className="col-span-6">
                        <Label className="text-[10px] text-muted-foreground">Monto total</Label>
                        <Input type="number" value={estado.items[item.id]?.monto ?? ''} onChange={e => updateItem(item.id, 'monto', e.target.value)} placeholder="0" className="h-7 text-xs" />
                      </div>
                    )}
                    {calc.tipo === 'por_persona_dia' && (
                      <div className="col-span-6">
                        <Label className="text-[10px] text-muted-foreground">$/pers/día</Label>
                        <Input type="number" value={estado.items[item.id]?.monto ?? ''} onChange={e => updateItem(item.id, 'monto', e.target.value)} placeholder="0" className="h-7 text-xs" />
                      </div>
                    )}
                    {calc.tipo === 'por_persona' && (
                      <div className="col-span-6">
                        <Label className="text-[10px] text-muted-foreground">$/persona</Label>
                        <Input type="number" value={estado.items[item.id]?.monto ?? ''} onChange={e => updateItem(item.id, 'monto', e.target.value)} placeholder="0" className="h-7 text-xs" />
                      </div>
                    )}
                    {calc.tipo === 'cantidad_precio' && (
                      <>
                        <div className="col-span-3">
                          <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
                          <Input type="number" value={estado.items[item.id]?.cantidad ?? ''} onChange={e => updateItem(item.id, 'cantidad', e.target.value)} placeholder="0" className="h-7 text-xs" />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-[10px] text-muted-foreground">Precio unit.</Label>
                          <Input type="number" value={estado.items[item.id]?.precio_unitario ?? ''} onChange={e => updateItem(item.id, 'precio_unitario', e.target.value)} placeholder="0" className="h-7 text-xs" />
                        </div>
                      </>
                    )}
                  </div>
                  {calc.detalle && (
                    <p className="text-[10px] text-muted-foreground pl-6">{calc.detalle}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Resumen comparativo */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 gap-1 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span className="col-span-5">Categoría</span>
              <span className="col-span-3 text-right">Presup.</span>
              <span className="col-span-2 text-right">Real</span>
              <span className="col-span-2 text-right">Diff.</span>
            </div>
            {rows.map(r => {
              const diff = r.calc.total - r.real;
              const tieneReal = r.real > 0;
              return (
                <div key={r.id} className="grid grid-cols-12 gap-1 items-center py-1.5 px-3 bg-muted/30 rounded-md">
                  <div className="col-span-5 flex items-center gap-1.5">
                    <r.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{r.label}</span>
                    {r.calc.dividir === 'todos' && <span className="text-[10px] text-purple-600 whitespace-nowrap">↗{totalPersonas}p</span>}
                  </div>
                  <span className="col-span-3 text-right text-sm font-medium">{formatMoney(r.calc.total)}</span>
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
          </div>

          {/* Costos unitarios calculados */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-center">
              <Coins className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Costo/beneficiario</p>
              <p className="text-base font-bold text-blue-700">{formatMoney(costoPorBeneficiario)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
              <Users className="w-4 h-4 text-slate-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Costo/persona</p>
              <p className="text-base font-bold text-slate-700">{formatMoney(costoPorPersona)}</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-2.5 text-center">
              <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Ingreso esp.</p>
              <p className="text-base font-bold text-green-700">{formatMoney(ingresoTotal)}</p>
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

function Badge2({ className, children }) {
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 font-semibold', className)}>{children}</span>;
}