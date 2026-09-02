import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/ramaUtils';
import { Calculator, Coins, Users, TrendingUp, TrendingDown, AlertTriangle, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPOS = [
  { value: 'fijo', label: 'Fijo' },
  { value: 'por_persona_dia', label: '$/pers/día' },
  { value: 'por_persona', label: '$/pers' },
  { value: 'cantidad_precio', label: 'Cant × $' },
];

const DEFAULT_ITEMS = [
  { id: 'comida', label: 'Comida', tipoDefault: 'por_persona_dia', calcularSobreDefault: 'total', quienPagaDefault: 'beneficiarios' },
  { id: 'transporte', label: 'Transporte', tipoDefault: 'fijo', calcularSobreDefault: 'total', quienPagaDefault: 'beneficiarios' },
  { id: 'flete', label: 'Flete / Traslado', tipoDefault: 'fijo', calcularSobreDefault: 'total', quienPagaDefault: 'beneficiarios' },
  { id: 'alojamiento', label: 'Alojamiento / Lugar', tipoDefault: 'fijo', calcularSobreDefault: 'total', quienPagaDefault: 'beneficiarios' },
  { id: 'materiales', label: 'Materiales', tipoDefault: 'fijo', calcularSobreDefault: 'beneficiarios', quienPagaDefault: 'beneficiarios' },
  { id: 'medicamentos', label: 'Medicamentos', tipoDefault: 'fijo', calcularSobreDefault: 'beneficiarios', quienPagaDefault: 'beneficiarios' },
  { id: 'extras', label: 'Extras', tipoDefault: 'fijo', calcularSobreDefault: 'total', quienPagaDefault: 'beneficiarios' },
  { id: 'imprevistos', label: 'Reserva imprevistos', tipoDefault: 'fijo', calcularSobreDefault: 'total', quienPagaDefault: 'beneficiarios' },
];

function isNewFormat(items) {
  if (!items || typeof items !== 'object') return false;
  const vals = Object.values(items);
  return vals.length > 0 && typeof vals[0] === 'object';
}

function migratePresupuesto(saved, camp) {
  const result = {
    cantidad_beneficiarios: saved.cantidad_beneficiarios ?? (camp?.beneficiarios_ids?.length ?? 0),
    cantidad_adultos: saved.cantidad_adultos ?? (camp?.adultos_ids?.length ?? 0),
    dias_manual: saved.dias_manual ?? null,
    items: {},
  };
  const adultosPagan = saved.adultos_pagan_override ?? camp?.adultos_pagan ?? false;

  if (isNewFormat(saved.items)) {
    for (const def of DEFAULT_ITEMS) {
      const existing = saved.items[def.id];
      let calcularSobre, quienPaga;
      if (existing?.calcular_sobre) {
        calcularSobre = existing.calcular_sobre;
      } else if (existing?.dividir_entre) {
        calcularSobre = existing.dividir_entre === 'todos' ? 'total' : 'beneficiarios';
      } else {
        calcularSobre = def.calcularSobreDefault;
      }
      if (existing?.quien_paga) {
        quienPaga = existing.quien_paga;
      } else if (existing?.dividir_entre) {
        quienPaga = existing.dividir_entre === 'todos' ? (adultosPagan ? 'todos' : 'beneficiarios') : 'beneficiarios';
      } else {
        quienPaga = def.quienPagaDefault;
      }
      result.items[def.id] = {
        tipo: existing?.tipo || def.tipoDefault,
        monto: existing?.monto ?? '',
        cantidad: existing?.cantidad ?? '',
        precio_unitario: existing?.precio_unitario ?? '',
        calcular_sobre: calcularSobre,
        quien_paga: quienPaga,
      };
    }
    return result;
  }

  const oldItems = saved.items || {};
  const oldSplits = saved.splits || {};
  const oldComida = saved.comida_por_persona_dia;

  for (const def of DEFAULT_ITEMS) {
    const oldSplit = oldSplits[def.id];
    const dividir = oldSplit != null ? (oldSplit ? 'todos' : 'beneficiarios') : 'total';
    const calcularSobre = dividir === 'todos' ? 'total' : 'beneficiarios';
    const quienPaga = dividir === 'todos' ? (adultosPagan ? 'todos' : 'beneficiarios') : 'beneficiarios';

    if (def.id === 'comida' && oldComida) {
      result.items[def.id] = { tipo: 'por_persona_dia', monto: oldComida, calcular_sobre: calcularSobre, quien_paga: quienPaga };
    } else if (oldItems[def.id] != null && oldItems[def.id] !== '') {
      result.items[def.id] = { tipo: 'fijo', monto: String(oldItems[def.id]), calcular_sobre: calcularSobre, quien_paga: quienPaga };
    } else {
      result.items[def.id] = { tipo: def.tipoDefault, monto: '', calcular_sobre: def.calcularSobreDefault, quien_paga: def.quienPagaDefault };
    }
  }
  return result;
}

export default function PresupuestoResumenPublico({ campamento }) {
  const [expandido, setExpandido] = useState(false);
  const saved = campamento?.presupuesto || {};

  const estado = useMemo(() => migratePresupuesto(saved, campamento), [campamento]);

  const cantBen = parseInt(estado.cantidad_beneficiarios) || 0;
  const cantAdultos = parseInt(estado.cantidad_adultos) || 0;
  const totalPersonas = cantBen + cantAdultos;

  const diasAuto = useMemo(() => {
    if (!campamento?.fecha_inicio || !campamento?.fecha_fin) return 0;
    const ini = new Date(campamento.fecha_inicio + 'T12:00:00');
    const fin = new Date(campamento.fecha_fin + 'T12:00:00');
    const diff = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [campamento]);
  const dias = estado.dias_manual != null && estado.dias_manual !== '' ? parseInt(estado.dias_manual) : diasAuto;

  const itemCalculations = useMemo(() => {
    const result = {};
    for (const def of DEFAULT_ITEMS) {
      const item = estado.items[def.id] || { tipo: def.tipoDefault, monto: '', calcular_sobre: def.calcularSobreDefault, quien_paga: def.quienPagaDefault };
      const tipo = item.tipo || 'fijo';
      const calcularSobre = item.calcular_sobre || def.calcularSobreDefault || 'total';
      const personasDivisor = calcularSobre === 'total' ? totalPersonas : cantBen;

      let total = 0;
      let detalle = '';

      if (tipo === 'fijo') {
        total = parseFloat(item.monto) || 0;
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

      result[def.id] = { total, detalle, tipo, calcularSobre, personasDivisor };
    }
    return result;
  }, [estado, totalPersonas, cantBen, dias]);

  const costoTotalEstimado = Object.values(itemCalculations).reduce((s, c) => s + c.total, 0);

  const breakdown = useMemo(() => {
    let paganSoloBen = 0;
    let paganTodos = 0;
    let subsidiable = 0;

    for (const def of DEFAULT_ITEMS) {
      const calc = itemCalculations[def.id];
      const itemState = estado.items[def.id] || {};
      const quienPaga = itemState.quien_paga || def.quienPagaDefault || 'beneficiarios';
      const calcularSobre = itemState.calcular_sobre || def.calcularSobreDefault || 'total';

      if (quienPaga === 'todos') {
        paganTodos += calc.total;
      } else {
        paganSoloBen += calc.total;
        if (calcularSobre === 'total' && cantAdultos > 0) {
          subsidiable += calc.total;
        }
      }
    }

    const costoBen_SoloBen = cantBen > 0 ? paganSoloBen / cantBen : 0;
    const costoBen_Todos = totalPersonas > 0 ? paganTodos / totalPersonas : 0;
    const costoPorBeneficiario = costoBen_SoloBen + costoBen_Todos;
    const costoPorAdulto = totalPersonas > 0 ? paganTodos / totalPersonas : 0;
    const subsidioAdultos = cantBen > 0 && totalPersonas > 0
      ? subsidiable / cantBen - subsidiable / totalPersonas
      : 0;

    return { paganSoloBen, paganTodos, costoBen_SoloBen, costoBen_Todos, costoPorBeneficiario, costoPorAdulto, subsidioAdultos };
  }, [itemCalculations, estado, totalPersonas, cantBen, cantAdultos]);

  // Si no hay ningún monto cargado, no mostrar nada
  const tieneDatos = Object.values(estado.items).some(it => (it.monto && it.monto !== '') || (it.cantidad && it.cantidad !== ''));
  if (!tieneDatos) return null;

  const costoBenCamp = campamento?.costo_por_persona || 0;
  const costoAdultoCamp = campamento?.costo_adultos || costoBenCamp;
  const ingresoBeneficiarios = cantBen * costoBenCamp;
  const ingresoAdultos = (campamento?.adultos_pagan ? cantAdultos : 0) * costoAdultoCamp;
  const ingresoTotal = ingresoBeneficiarios + ingresoAdultos;
  const resultado = ingresoTotal - costoTotalEstimado;

  const handlePrint = () => {
    const rowsHtml = DEFAULT_ITEMS.map(r => {
      const calc = itemCalculations[r.id];
      const itemState = estado.items[r.id] || {};
      const calcularSobre = itemState.calcular_sobre || r.calcularSobreDefault || 'total';
      const quienPaga = itemState.quien_paga || r.quienPagaDefault || 'beneficiarios';
      const detalleStr = calc.detalle ? `<br><span style="font-size:10px;color:#888">${calc.detalle}</span>` : '';
      const tipoStr = TIPOS.find(t => t.value === calc.tipo)?.label || '';
      const sobreStr = calcularSobre === 'total' ? 'Todos' : 'Sólo ben.';
      const paganStr = quienPaga === 'todos' ? 'Todos' : 'Sólo ben.';
      return `<tr><td>${r.label}${detalleStr}</td><td style="text-align:center;font-size:10px">${tipoStr}</td><td style="text-align:center;font-size:10px">${sobreStr}</td><td style="text-align:center;font-size:10px">${paganStr}</td><td style="text-align:right">${formatMoney(calc.total)}</td></tr>`;
    }).join('');

    const bk = breakdown;
    const desgloseHtml = `
      <table style="margin-top:12px">
        <tr><td>Lo pagan sólo beneficiarios</td><td style="text-align:right">${formatMoney(bk.paganSoloBen)}</td><td style="text-align:center;font-size:10px;color:#666">÷ ${cantBen} = ${formatMoney(bk.costoBen_SoloBen)}/ben</td></tr>
        <tr><td>Lo pagan todos</td><td style="text-align:right">${formatMoney(bk.paganTodos)}</td><td style="text-align:center;font-size:10px;color:#666">÷ ${totalPersonas} = ${formatMoney(bk.costoBen_Todos)}/pers</td></tr>
        ${bk.subsidioAdultos > 0 ? `<tr style="color:#b45309"><td>Subsidio adultos (ben. absorben)</td><td style="text-align:right">+${formatMoney(bk.subsidioAdultos)}/ben</td><td></td></tr>` : ''}
        <tr class="total"><td>Costo por beneficiario</td><td colspan="2" style="text-align:right">${formatMoney(bk.costoPorBeneficiario)}</td></tr>
        <tr><td>Costo por adulto</td><td colspan="2" style="text-align:right">${bk.costoPorAdulto > 0 ? formatMoney(bk.costoPorAdulto) : '$0'}</td></tr>
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
    <div class="meta">${campamento?.ubicacion ? `📍 ${campamento.ubicacion} · ` : ''}${dias} días · ${totalPersonas} personas (${cantBen} ben. + ${cantAdultos} adult.)</div>
    <table><thead><tr><th>Categoría</th><th style="text-align:center">Tipo</th><th style="text-align:center">Costo sobre</th><th style="text-align:center">Lo pagan</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr class="total"><td colspan="4">Costo total estimado</td><td style="text-align:right">${formatMoney(costoTotalEstimado)}</td></tr></tfoot></table>
    ${desgloseHtml}
    <div class="resultado" style="background:${resultado >= 0 ? '#dcfce7' : '#fee2e2'};color:${resultado >= 0 ? '#16a34a' : '#dc2626'}">${resultado >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'}: ${formatMoney(Math.abs(resultado))} (Ingresos ${formatMoney(ingresoTotal)} − Gastos ${formatMoney(costoTotalEstimado)})</div>
    </body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Presupuesto del campamento
          </span>
          <Button variant="ghost" size="sm" onClick={() => setExpandido(v => !v)} className="h-7 text-xs">
            {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expandido ? 'Contraer' : 'Ver detalle'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Resumen destacado (siempre visible) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
            <Coins className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Costo por beneficiario</p>
            <p className="text-lg font-bold text-blue-700">{formatMoney(breakdown.costoPorBeneficiario)}</p>
          </div>
          <div className={cn('rounded-lg border p-3 text-center', breakdown.costoPorAdulto > 0 ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200')}>
            <Users className={cn('w-4 h-4 mx-auto mb-1', breakdown.costoPorAdulto > 0 ? 'text-purple-600' : 'text-slate-400')} />
            <p className="text-xs text-muted-foreground">Costo por adulto</p>
            <p className={cn('text-lg font-bold', breakdown.costoPorAdulto > 0 ? 'text-purple-700' : 'text-slate-400')}>
              {breakdown.costoPorAdulto > 0 ? formatMoney(breakdown.costoPorAdulto) : 'No pagan'}
            </p>
          </div>
        </div>

        {/* Total + resultado */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-100 border border-slate-300 p-2.5 text-center">
            <p className="text-xs text-muted-foreground">Costo total estimado</p>
            <p className="text-base font-bold text-slate-700">{formatMoney(costoTotalEstimado)}</p>
          </div>
          <div className={cn('rounded-lg border p-2.5 text-center', resultado >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              {resultado >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-600" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
              {resultado >= 0 ? 'Superávit' : 'Déficit'}
            </p>
            <p className={cn('text-base font-bold', resultado >= 0 ? 'text-green-700' : 'text-red-600')}>{formatMoney(Math.abs(resultado))}</p>
          </div>
        </div>

        {/* Detalle expandible */}
        {expandido && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rubros</p>
            <div className="space-y-1.5">
              {DEFAULT_ITEMS.map(item => {
                const calc = itemCalculations[item.id];
                if (calc.total === 0) return null;
                const itemState = estado.items[item.id] || {};
                const calcularSobre = itemState.calcular_sobre || item.calcularSobreDefault || 'total';
                const quienPaga = itemState.quien_paga || item.quienPagaDefault || 'beneficiarios';
                return (
                  <div key={item.id} className="rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-sm font-bold tabular-nums">{formatMoney(calc.total)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {calcularSobre === 'total' ? `${totalPersonas} pers` : `${cantBen} ben`}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px]', quienPaga === 'todos' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700')}>
                        {quienPaga === 'todos' ? 'Pagan todos' : 'Pagan ben.'}
                      </Badge>
                      {calc.detalle && <span className="text-[10px] text-muted-foreground">{calc.detalle}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desglose de costos */}
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desglose</p>
              <div className="rounded-lg border p-2 space-y-0.5 text-sm">
                <div className="flex justify-between">
                  <span>Lo pagan sólo beneficiarios</span>
                  <span className="font-bold">{formatMoney(breakdown.paganSoloBen)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-1">
                  ÷ {cantBen} ben = <span className="font-medium text-amber-700">{formatMoney(breakdown.costoBen_SoloBen)}/ben</span>
                </p>
              </div>
              <div className="rounded-lg border p-2 space-y-0.5 text-sm">
                <div className="flex justify-between">
                  <span>Lo pagan todos</span>
                  <span className="font-bold">{formatMoney(breakdown.paganTodos)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-1">
                  ÷ {totalPersonas} pers = <span className="font-medium text-purple-700">{formatMoney(breakdown.costoBen_Todos)}/pers</span>
                </p>
              </div>
              {breakdown.subsidioAdultos > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm">
                  <div className="flex justify-between text-amber-800">
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Ben. subsidian a {cantAdultos} adulto(s)</span>
                    <span className="font-bold">+{formatMoney(breakdown.subsidioAdultos)}/ben</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir presupuesto
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}