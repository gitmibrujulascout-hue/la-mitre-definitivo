import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Gift, Star, Minus, CalendarDays, Filter, X, AlertCircle } from 'lucide-react';
import { MESES, MESES_SIN_CUOTA, TODOS_LOS_ROLES, formatMoney } from '@/lib/ramaUtils';
import RamaBadge from '@/components/shared/RamaBadge';

function getApellido(nombre) {
  if (!nombre) return '';
  const partes = nombre.trim().split(/\s+/);
  return partes[partes.length - 1].toLowerCase();
}

function getMesStatus(cuenta, mes, mesIndex, anio) {
  // Becado: todos los meses van a becado
  if (cuenta.becado) return 'becado';

  // Meses sin cuota (Enero, Febrero)
  if (MESES_SIN_CUOTA.includes(mes)) return 'sin-cuota';

  // Marzo bonificado
  if (mes === 'Marzo' && cuenta.marzoGratis) return 'bonificado';

  // Mes totalmente pagado
  if (cuenta.mesesPagados?.includes(mes)) return 'pagado';

  // Mes parcialmente pagado (con saldo pendiente)
  if (cuenta.mesesParciales?.includes(mes)) return 'parcial';

  // Mes con deuda
  if (cuenta.mesesDeuda?.includes(mes)) return 'debe';

  // No corresponde (futuro o fuera del rango activo)
  return 'no-corresponde';
}

const STATUS_CONFIG = {
  'pagado': { icon: CheckCircle2, className: 'text-green-600 bg-green-50', title: 'Pagado' },
  'parcial': { icon: AlertCircle, className: 'text-orange-500 bg-orange-50', title: 'Pago parcial' },
  'debe': { icon: XCircle, className: 'text-red-500 bg-red-50', title: 'Debe' },
  'becado': { icon: Star, className: 'text-amber-500 bg-amber-50', title: 'Becado' },
  'bonificado': { icon: Gift, className: 'text-blue-500 bg-blue-50', title: 'Bonificado' },
  'sin-cuota': { icon: Minus, className: 'text-slate-300 bg-slate-50', title: 'Sin cuota' },
  'no-corresponde': { icon: Minus, className: 'text-slate-200', title: 'No corresponde' },
};

export default function GrillaCuotasMensuales({ cuentas, anio, onSelectBen }) {
  const hoy = new Date();
  const mesActualIdx = hoy.getMonth();
  const mesesTranscurridos = anio < hoy.getFullYear() ? 12 : anio > hoy.getFullYear() ? 0 : mesActualIdx + 1;
  const [mesFiltro, setMesFiltro] = useState(null); // índice del mes a filtrar por "debe"

  const ordenados = useMemo(() => {
    let lista = [...cuentas];
    if (mesFiltro !== null) {
      lista = lista.filter(c => {
        const status = getMesStatus(c, MESES[mesFiltro], mesFiltro, anio);
        return status === 'debe' || status === 'parcial';
      });
    }
    return lista.sort((a, b) => {
      const ra = TODOS_LOS_ROLES.indexOf(a.rama);
      const rb = TODOS_LOS_ROLES.indexOf(b.rama);
      if (ra !== rb) return ra - rb;
      return getApellido(a.nombre).localeCompare(getApellido(b.nombre));
    });
  }, [cuentas, mesFiltro, anio]);

  // Contar resumen por mes
  const resumenPorMes = useMemo(() => {
    return MESES.map((mes, idx) => {
      let pagados = 0, deben = 0, parciales = 0, bonificados = 0, becados = 0;
      ordenados.forEach(c => {
        const status = getMesStatus(c, mes, idx, anio);
        if (status === 'pagado') pagados++;
        else if (status === 'parcial') parciales++;
        else if (status === 'debe') deben++;
        else if (status === 'bonificado') bonificados++;
        else if (status === 'becado') becados++;
      });
      return { mes, pagados, deben, parciales, bonificados, becados };
    });
  }, [ordenados, anio]);

  const totalesPorBen = useMemo(() => {
    return ordenados.map(c => {
      let pagados = 0, deben = 0, parciales = 0;
      MESES.forEach((mes, idx) => {
        const status = getMesStatus(c, mes, idx, anio);
        if (status === 'pagado') pagados++;
        else if (status === 'parcial') parciales++;
        else if (status === 'debe') deben++;
      });
      return { id: c.id, pagados, deben, parciales };
    });
  }, [ordenados, anio]);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px]">Beneficiario</TableHead>
              <TableHead className="text-center">Rama</TableHead>
              {MESES.map((mes, idx) => {
                const isFiltroActivo = mesFiltro === idx;
                const puedeFiltrar = idx < mesesTranscurridos && anio >= 2026 && !MESES_SIN_CUOTA.includes(mes) && (resumenPorMes[idx].deben > 0 || resumenPorMes[idx].parciales > 0);
                return (
                  <TableHead key={mes} className="text-center min-w-[60px] px-1">
                    <button
                      type="button"
                      disabled={!puedeFiltrar}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMesFiltro(isFiltroActivo ? null : idx);
                      }}
                      className={`flex flex-col items-center w-full py-0.5 rounded transition-colors ${
                        puedeFiltrar ? 'cursor-pointer hover:bg-accent/50' : 'cursor-default'
                      } ${isFiltroActivo ? 'bg-red-100 text-red-700' : ''}`}
                    >
                      <span className="text-[11px] font-medium flex items-center gap-0.5">
                        {mes.slice(0, 3)}
                        {isFiltroActivo && <X className="w-2.5 h-2.5" />}
                      </span>
                      {idx < mesesTranscurridos && anio >= 2026 && (
                        <span className={`text-[9px] ${isFiltroActivo ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {resumenPorMes[idx].deben > 0 ? `${resumenPorMes[idx].deben}⚠` : resumenPorMes[idx].parciales > 0 ? `${resumenPorMes[idx].parciales}◐` : '✓'}
                        </span>
                      )}
                    </button>
                  </TableHead>
                );
              })}
              <TableHead className="text-center min-w-[70px]">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={MESES.length + 3} className="text-center py-8 text-muted-foreground">
                  No hay beneficiarios
                </TableCell>
              </TableRow>
            ) : (
              ordenados.map((c, benIdx) => {
                const totales = totalesPorBen[benIdx];
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => onSelectBen(c)}
                  >
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[180px]">{c.nombre}</span>
                        {c.activo === false && (
                          <Badge className="bg-slate-100 text-slate-500 border-slate-300 border text-[10px] px-1 py-0">Inactivo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><RamaBadge rama={c.rama} /></TableCell>
                    {MESES.map((mes, idx) => {
                      const status = getMesStatus(c, mes, idx, anio);
                      const config = STATUS_CONFIG[status];
                      const Icon = config.icon;
                      const saldoMes = status === 'parcial' && c.montoPorMes
                        ? Math.max(0, (c.esperadoPorMes?.[mes] || c.cuotaIndividual || 0) - (c.montoPorMes[mes] || 0))
                        : 0;
                      return (
                        <TableCell key={mes} className="text-center px-1 py-1.5">
                          <div
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${config.className}`}
                            title={status === 'parcial' ? `Pago parcial — saldo: ${formatMoney(saldoMes)}` : config.title}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-semibold text-green-600">{totales.pagados}</span>
                        {totales.parciales > 0 && (
                          <span className="text-[10px] text-orange-500">{totales.parciales} parc.</span>
                        )}
                        {totales.deben > 0 && (
                          <span className="text-[10px] text-red-500">{totales.deben} debe</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t bg-muted/30 text-xs">
        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Pagado</div>
        <div className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-orange-500" /> Pago parcial</div>
        <div className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-red-500" /> Debe</div>
        <div className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500" /> Becado</div>
        <div className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 text-blue-500" /> Bonificado</div>
        <div className="flex items-center gap-1.5"><Minus className="w-3.5 h-3.5 text-slate-300" /> Sin cuota / No corresponde</div>
      </div>
    </Card>
  );
}