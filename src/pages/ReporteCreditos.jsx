import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Gift, Download, Filter, Coins, TrendingUp, Calendar, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Extrae el origen del crédito desde las observaciones ("Crédito aplicado de: X + Y")
function extraerOrigen(obs) {
  if (!obs) return '—';
  const match = obs.match(/(?:aplicado|crédito) de:\s*(.+?)(?:\s*\||\s*$)/i);
  return match ? match[1].trim() : '—';
}

export default function ReporteCreditos() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear().toString());
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: pagos = [], isLoading } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-fecha_pago', 2000),
  });

  // Solo pagos imputados con crédito de actividad (ingreso al grupo)
  const creditosUsados = useMemo(() => {
    return pagos
      .filter(p => p.forma_pago === 'Crédito actividad')
      .filter(p => String(p.anio) === anio)
      .filter(p => {
        if (!p.fecha_pago) return false;
        if (desde && p.fecha_pago < desde) return false;
        if (hasta && p.fecha_pago > hasta) return false;
        return true;
      })
      .sort((a, b) => (b.fecha_pago || '').localeCompare(a.fecha_pago || ''));
  }, [pagos, anio, desde, hasta]);

  const totalUtilizado = creditosUsados.reduce((s, p) => s + (p.monto || 0), 0);
  const totalCuota = creditosUsados.filter(p => p.tipo_pago === 'Cuota').reduce((s, p) => s + (p.monto || 0), 0);
  const totalCampamento = creditosUsados.filter(p => p.tipo_pago === 'Campamento').reduce((s, p) => s + (p.monto || 0), 0);
  const totalAfiliacion = creditosUsados.filter(p => p.tipo_pago === 'Afiliación').reduce((s, p) => s + (p.monto || 0), 0);

  // Agrupado por mes de aplicación (fecha_pago)
  const porMes = useMemo(() => {
    const map = {};
    creditosUsados.forEach(p => {
      if (!p.fecha_pago) return;
      const m = p.fecha_pago.substring(5, 7);
      const idx = parseInt(m, 10) - 1;
      const nombre = MESES[idx] || m;
      if (!map[nombre]) map[nombre] = { nombre, idx, total: 0, count: 0 };
      map[nombre].total += p.monto || 0;
      map[nombre].count += 1;
    });
    return Object.values(map).sort((a, b) => a.idx - b.idx);
  }, [creditosUsados]);

  // Agrupado por actividad de origen
  const porOrigen = useMemo(() => {
    const map = {};
    creditosUsados.forEach(p => {
      const origen = extraerOrigen(p.observaciones);
      if (!map[origen]) map[origen] = { origen, total: 0, count: 0 };
      map[origen].total += p.monto || 0;
      map[origen].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [creditosUsados]);

  const formatFecha = (f) => f
    ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
    : '—';

  const exportarExcel = () => {
    const filas = creditosUsados.map(p => ({
      'Fecha': p.fecha_pago || '',
      'Beneficiario': p.beneficiario_nombre || '',
      'Tipo': p.tipo_pago || 'Cuota',
      'Concepto': p.tipo_pago === 'Campamento'
        ? (p.campamento_nombre || 'Campamento')
        : p.tipo_pago === 'Afiliación'
          ? 'Afiliación / Seguro'
          : (p.meses?.join(', ') || p.mes || `Año ${p.anio}`),
      'Origen crédito': extraerOrigen(p.observaciones),
      'Monto': p.monto || 0,
    }));
    import('xlsx').then(({ utils, writeFile }) => {
      const wb = utils.book_new();
      const ws = utils.json_to_sheet(filas);
      utils.book_append_sheet(wb, ws, 'Créditos utilizados');
      writeFile(wb, `creditos_utilizados_${anio}.xlsx`);
    });
  };

  return (
    <div>
      <PageHeader
        title="Créditos utilizados"
        description="Créditos de actividad imputados a cuotas/campamentos — dinero a trasladar de la caja de créditos al ingreso del grupo"
      >
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={() => window.print()} disabled={creditosUsados.length === 0}>
            <Download className="w-4 h-4 mr-2" />PDF
          </Button>
          <Button onClick={exportarExcel} disabled={creditosUsados.length === 0}>
            <Download className="w-4 h-4 mr-2" />Excel
          </Button>
        </div>
      </PageHeader>

      {/* Filtros */}
      <Card className="p-4 mb-6 no-print">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Año</Label>
            <div className="flex gap-2 flex-wrap">
              {[2024, 2025, 2026, 2027].map(y => (
                <button
                  key={y}
                  onClick={() => setAnio(y.toString())}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                    anio === y.toString()
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:bg-secondary'
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Desde (opcional)</Label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Hasta (opcional)</Label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>
        {(desde || hasta) && (
          <button onClick={() => { setDesde(''); setHasta(''); }} className="text-xs text-primary hover:underline mt-2">
            Limpiar rango de fechas
          </button>
        )}
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Coins className="w-4 h-4" />
            <span className="text-xs">Total utilizado</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-primary">{formatMoney(totalUtilizado)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{creditosUsados.length} aplicaciones</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">A cuotas</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-600">{formatMoney(totalCuota)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">A campamentos</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-blue-600">{formatMoney(totalCampamento)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs">A afiliaciones</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-purple-600">{formatMoney(totalAfiliacion)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">recupera en caja · rinde a SA</p>
        </Card>
      </div>

      <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
        <Coins className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Cada aplicación de crédito representa dinero que vuelve de la reserva de créditos a la caja general (<strong>recuperar en caja</strong>): <strong>{formatMoney(totalUtilizado)}</strong>.
          Cuotas y campamentos quedan como ingreso del grupo; las <strong>afiliaciones</strong> ({formatMoney(totalAfiliacion)}) se recuperan en caja y luego se rinden a Scout Argentina.
        </span>
      </div>

      {/* Resumen por mes */}
      {porMes.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Resumen por mes de aplicación — {anio}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {porMes.map(m => (
              <div key={m.nombre} className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">{m.nombre}</p>
                <p className="text-lg font-bold text-primary">{formatMoney(m.total)}</p>
                <p className="text-xs text-muted-foreground">{m.count} aplic.</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resumen por origen */}
      {porOrigen.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Gift className="w-4 h-4" /> Por actividad de origen
          </h3>
          <div className="space-y-1.5">
            {porOrigen.map(o => (
              <div key={o.origen} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Gift className="w-3 h-3 text-primary flex-shrink-0" />
                  <span className="truncate">{o.origen}</span>
                  <span className="text-xs text-muted-foreground">({o.count})</span>
                </div>
                <span className="font-semibold text-primary">{formatMoney(o.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detalle */}
      <Card className="overflow-hidden">
        <h3 className="font-semibold text-sm p-4 pb-2">Detalle de aplicaciones</h3>
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
        ) : creditosUsados.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Gift className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay créditos utilizados en {anio}{desde || hasta ? ' para el rango seleccionado' : ''}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-4 py-2.5">Beneficiario</th>
                  <th className="text-left px-4 py-2.5">Destino</th>
                  <th className="text-left px-4 py-2.5">Origen del crédito</th>
                  <th className="text-right px-4 py-2.5">Monto</th>
                </tr>
              </thead>
              <tbody>
                {creditosUsados.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatFecha(p.fecha_pago)}</td>
                    <td className="px-4 py-2 font-medium">{p.beneficiario_nombre || '—'}</td>
                    <td className="px-4 py-2">
                      {p.tipo_pago === 'Campamento' ? (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">{p.campamento_nombre || 'Campamento'}</Badge>
                      ) : p.tipo_pago === 'Afiliación' ? (
                        <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">Afiliación / Seguro</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{p.meses?.join(', ') || p.mes || `Año ${p.anio}`}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Gift className="w-3 h-3 text-primary flex-shrink-0" />
                        <span className="truncate">{extraerOrigen(p.observaciones)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-amber-700">{formatMoney(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40">
                  <td colSpan={4} className="px-4 py-3 text-right font-bold">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-lg text-primary">{formatMoney(totalUtilizado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}