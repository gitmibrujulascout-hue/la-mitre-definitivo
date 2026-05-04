import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Filter } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function ReportePagos() {
  const hoy = new Date();
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy.toISOString().split('T')[0]);
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const reporteRef = useRef(null);

  const { data: pagos = [], isLoading } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-fecha_pago', 1000),
  });

  const pagosFiltrados = useMemo(() => {
    return pagos
      .filter(p => {
        if (!p.fecha_pago) return false;
        const fecha = p.fecha_pago;
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        if (filtroTipo !== 'Todos' && p.tipo_pago !== filtroTipo) return false;
        return true;
      })
      .sort((a, b) => (a.fecha_pago || '').localeCompare(b.fecha_pago || ''));
  }, [pagos, desde, hasta, filtroTipo]);

  const totalGeneral = pagosFiltrados.reduce((s, p) => s + (p.monto || 0), 0);
  const totalEfectivo = pagosFiltrados.filter(p => p.forma_pago === 'Efectivo').reduce((s, p) => s + (p.monto || 0), 0);
  const totalTransferencia = pagosFiltrados.filter(p => p.forma_pago === 'Transferencia').reduce((s, p) => s + (p.monto || 0), 0);
  const totalCredito = pagosFiltrados.filter(p => p.forma_pago === 'Crédito actividad').reduce((s, p) => s + (p.monto || 0), 0);

  // Agrupar por beneficiario para resumen
  const porBeneficiario = useMemo(() => {
    const map = {};
    pagosFiltrados.forEach(p => {
      if (!map[p.beneficiario_id]) {
        map[p.beneficiario_id] = { nombre: p.beneficiario_nombre, pagos: [] };
      }
      map[p.beneficiario_id].pagos.push(p);
    });
    return Object.values(map).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [pagosFiltrados]);

  const handleImprimir = () => {
    window.print();
  };

  const formatFecha = (f) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR') : '-';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reporte de Pagos</h1>
            <p className="text-sm text-muted-foreground">Para facturación — seleccioná el período</p>
          </div>
        </div>
        <Button onClick={handleImprimir} disabled={pagosFiltrados.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exportar / Imprimir PDF
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-5 no-print">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filtros del reporte</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="mb-1 block">Desde</Label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Hasta</Label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Tipo de pago</Label>
            <div className="flex gap-2 flex-wrap">
              {['Todos', 'Cuota', 'Campamento'].map(t => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                    filtroTipo === t
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-muted-foreground border-border hover:bg-secondary'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Contenido del reporte (imprimible) */}
      <div ref={reporteRef} id="reporte-pagos" className="space-y-6">

        {/* Encabezado del reporte (visible en impresión) */}
        <div className="print-only hidden border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold">Grupo Scout — Reporte de Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Período: {formatFecha(desde)} al {formatFecha(hasta)}
            {filtroTipo !== 'Todos' ? ` · Tipo: ${filtroTipo}` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Generado el {new Date().toLocaleDateString('es-AR', { dateStyle: 'long' })}</p>
        </div>

        {/* Resumen */}
        {pagosFiltrados.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold mb-4 text-base">Resumen del período</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-muted-foreground mb-1">Total recaudado</p>
                <p className="text-xl font-bold text-blue-700">{formatMoney(totalGeneral)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pagosFiltrados.length} pagos</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs text-muted-foreground mb-1">Efectivo (Caja)</p>
                <p className="text-lg font-bold text-green-700">{formatMoney(totalEfectivo)}</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-muted-foreground mb-1">Transferencia (Banco)</p>
                <p className="text-lg font-bold text-purple-700">{formatMoney(totalTransferencia)}</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs text-muted-foreground mb-1">Crédito actividad</p>
                <p className="text-lg font-bold text-amber-700">{formatMoney(totalCredito)}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Detalle por beneficiario */}
        {porBeneficiario.length > 0 ? (
          <Card className="p-5">
            <h2 className="font-semibold mb-4 text-base">
              Detalle por beneficiario · {formatFecha(desde)} al {formatFecha(hasta)}
            </h2>
            <div className="space-y-4">
              {porBeneficiario.map((ben, idx) => {
                const totalBen = ben.pagos.reduce((s, p) => s + (p.monto || 0), 0);
                return (
                  <div key={idx} className={cn("border rounded-lg overflow-hidden", idx > 0 && "mt-4")}>
                    <div className="bg-secondary/50 px-4 py-2.5 flex items-center justify-between">
                      <span className="font-semibold text-sm">{ben.nombre}</span>
                      <span className="font-bold text-sm text-green-700">{formatMoney(totalBen)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                          <th className="text-left px-4 py-2">Fecha</th>
                          <th className="text-left px-4 py-2">Tipo</th>
                          <th className="text-left px-4 py-2">Concepto</th>
                          <th className="text-left px-4 py-2">Forma pago</th>
                          <th className="text-right px-4 py-2">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ben.pagos.map(p => (
                          <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2 text-muted-foreground">{formatFecha(p.fecha_pago)}</td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className="text-xs">
                                {p.tipo_pago || 'Cuota'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2">
                              {p.tipo_pago === 'Campamento'
                                ? p.campamento_nombre || 'Campamento'
                                : (p.meses?.join(', ') || p.mes || `Año ${p.anio}`)}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{p.forma_pago}</td>
                            <td className="px-4 py-2 text-right font-semibold text-green-700">{formatMoney(p.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Total final */}
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="font-bold text-base">TOTAL PERÍODO</span>
              <span className="font-bold text-xl text-primary">{formatMoney(totalGeneral)}</span>
            </div>
          </Card>
        ) : !isLoading && (
          <Card className="p-10 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay pagos en el período seleccionado</p>
          </Card>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          #reporte-pagos { padding: 0; }
        }
      `}</style>
    </div>
  );
}