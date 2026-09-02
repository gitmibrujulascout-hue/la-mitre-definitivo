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

  // Breakdown: split items into "todos" and "sólo beneficiarios" groups
  const breakdown = useMemo(() => {
    let gastosTodos = 0;        // items divididos entre todos
    let gastosSoloBen = 0;       // items divididos sólo entre beneficiarios

    for (const def of DEFAULT_ITEMS) {
      const calc = itemCalculations[def.id];
      if (calc.dividir === 'todos') gastosTodos += calc.total;
      else gastosSoloBen += calc.total;
    }

    const divisorTodos = adultosPagan ? totalPersonas : cantBen;

    // Cost per beneficiary
    // - "todos" items: if adults pay → divided by total_personas; if not → ben covers all
    // - "sólo ben" items: always divided by beneficiarios
    const costoBen_Todos = divisorTodos > 0 ? gastosTodos / divisorTodos : 0;
    const costoBen_SoloBen = cantBen > 0 ? gastosSoloBen / cantBen : 0;
    const costoPorBeneficiario = costoBen_Todos + costoBen_SoloBen;

    // Cost per adult (only if adults pay)
    const costoPorAdulto = adultosPagan ? (divisorTodos > 0 ? gastosTodos / divisorTodos : 0) : 0;

    // How much beneficiaries are subsidizing for adults (when adults don't pay)
    const subsidioAdultos = !adultosPagan && cantBen > 0 && cantAdultos > 0
      ? (gastosTodos / cantBen) - (totalPersonas > 0 ? gastosTodos / totalPersonas : 0)
      : 0;

    return {
      gastosTodos,
      gastosSoloBen,
      divisorTodos,
      costoBen_Todos,
      costoBen_SoloBen,
      costoPorBeneficiario,
      costoPorAdulto,
      subsidioAdultos,
    };
  }, [itemCalculations, totalPersonas, cantBen, cantAdultos, adultosPagan]);

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
  }));

  const handlePrint = () => {
    const rowsHtml = rows.map(r => {
      const calc = r.calc;
      const detalleStr = calc.detalle ? `<br><span style="font-size:10px;color:#888">${calc.detalle}</span>` : '';
      const tipoStr = TIPOS.find(t => t.value === calc.tipo)?.label || '';
      const divStr = calc.dividir === 'todos' ? 'Todos' : 'Sólo ben.';
      return `<tr><td>${r.label}${detalleStr}</td><td style="text-align:center;font-size:10px">${tipoStr} / ${divStr}</td><td style="text-align:right">${formatMoney(calc.total)}</td></tr>`;
    }).join('');

    const bk = breakdown;
    const desgloseHtml = `
      <table style="margin-top:12px">
        <tr><td>Gastos compartidos (todos)</td><td style="text-align:right">${formatMoney(bk.gastosTodos)}</td><td style="text-align:center;font-size:10px;color:#666">÷ ${bk.divisorTodos} = ${formatMoney(bk.costoBen_Todos)}/pers</td></tr>
        <tr><td>Gastos sólo beneficiarios</td><td style="text-align:right">${formatMoney(bk.gastosSoloBen)}</td><td style="text-align:center;font-size:10px;color:#666">÷ ${cantBen} = ${formatMoney(bk.costoBen_SoloBen)}/ben</td></tr>
        ${!adultosPagan && bk.subsidioAdultos > 0 ? `<tr style="color:#b45309"><td>Subsidio adultos (ben. absorben)</td><td style="text-align:right">+${formatMoney(bk.subsidioAdultos)}/ben</td><td></td></tr>` : ''}
        <tr class="total"><td>Costo por beneficiario</td><td colspan="2" style="text-align:right">${formatMoney(bk.costoPorBeneficiario)}</td></tr>
        ${adultosPagan ? `<tr><td>Costo por adulto</td><td colspan="2" style="text-align:right">${formatMoney(bk.costoPorAdulto)}</td></tr>` : '<tr style="color:#999"><td>Adultos no pagan</td><td colspan="2" style="text-align:right">$0</td></tr>'}
      </table>`;

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
    <div class="meta">${campamento?.ubicacion ? `📍 ${campamento.ubicacion} · ` : ''}${dias} días · ${totalPersonas} personas (${cantBen} ben. + ${cantAdultos} adult.)${adultosPagan ? ' · Adultos pagan' : ' · Adultos no pagan'}</div>
    <table><thead><tr><th>Categoría</th><th style="text-align:center">Tipo / Div.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr class="total"><td colspan="2">Costo total estimado</td><td style="text-align:right">${formatMoney(costoTotalEstimado)}</td></tr></tfoot></table>
    ${desgloseHtml}
    <div class="resultado" style="background:${resultado >= 0 ? '#dcfce7' : '#fee2e2'};color:${resultado >= 0 ? '#16a34a' : '#dc2626'}">${resultado >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'}: ${formatMoney(Math.abs(resultado))} (Ingresos ${formatMoney(ingresoTotal)} − Gastos ${formatMoney(costoTotalEstimado)})</div>
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

          {/* Desglose de costos por persona */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" /> Desglose de costos
            </p>

            {/* Gastos compartidos */}
            <div className="rounded-lg border p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  Gastos compartidos (todos)
                </span>
                <span className="text-sm font-bold">{formatMoney(breakdown.gastosTodos)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pl-5">
                ÷ {breakdown.divisorTodos} {adultosPagan ? 'personas' : 'beneficiarios (adultos no pagan)'}
                {' = '}<span className="font-medium text-purple-700">{formatMoney(breakdown.costoBen_Todos)}</span>/pers
              </p>
            </div>

            {/* Gastos sólo beneficiarios */}
            <div className="rounded-lg border p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-blue-500" />
                  Gastos sólo beneficiarios
                </span>
                <span className="text-sm font-bold">{formatMoney(breakdown.gastosSoloBen)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pl-5">
                ÷ {cantBen} beneficiarios
                {' = '}<span className="font-medium text-blue-700">{formatMoney(breakdown.costoBen_SoloBen)}</span>/ben
              </p>
            </div>

            {/* Subsidio adultos */}
            {!adultosPagan && breakdown.subsidioAdultos > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Beneficiarios subsidian a {cantAdultos} adulto(s)
                  </span>
                  <span className="text-sm font-bold text-amber-700">+{formatMoney(breakdown.subsidioAdultos)}/ben</span>
                </div>
                <p className="text-[11px] text-amber-600 pl-5">
                  Cada beneficiario absorbe la parte de los adultos que no pagan
                </p>
              </div>
            )}

            {/* Totales destacados */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                <Coins className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Costo por beneficiario</p>
                <p className="text-lg font-bold text-blue-700">{formatMoney(breakdown.costoPorBeneficiario)}</p>
                <p className="text-[10px] text-muted-foreground">{cantBen} × {formatMoney(breakdown.costoPorBeneficiario)} = {formatMoney(breakdown.costoPorBeneficiario * cantBen)}</p>
              </div>
              <div className={cn('rounded-lg border p-3 text-center', adultosPagan ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200')}>
                <Users className={cn('w-4 h-4 mx-auto mb-1', adultosPagan ? 'text-purple-600' : 'text-slate-400')} />
                <p className="text-xs text-muted-foreground">Costo por adulto</p>
                <p className={cn('text-lg font-bold', adultosPagan ? 'text-purple-700' : 'text-slate-400')}>{adultosPagan ? formatMoney(breakdown.costoPorAdulto) : 'No pagan'}</p>
                {adultosPagan && <p className="text-[10px] text-muted-foreground">{cantAdultos} × {formatMoney(breakdown.costoPorAdulto)} = {formatMoney(breakdown.costoPorAdulto * cantAdultos)}</p>}
              </div>
            </div>
          </div>

          {/* Total + Ingresos */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-100 border border-slate-300 p-2.5 text-center">
              <p className="text-xs text-muted-foreground">Costo total estimado</p>
              <p className="text-base font-bold text-slate-700">{formatMoney(costoTotalEstimado)}</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-2.5 text-center">
              <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-0.5" />
              <p className="text-xs text-muted-foreground">Ingreso esperado</p>
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