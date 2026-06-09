import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Filter, FileSpreadsheet } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Formatea dinero al formato argentino: $ ##.###,##
function formatDineroAR(monto) {
  const num = Number(monto) || 0;
  const partes = num.toFixed(2).split('.');
  const entero = parseInt(partes[0]);
  const decimal = partes[1];
  const enterFormato = entero.toLocaleString('es-AR');
  return `$ ${enterFormato},${decimal}`;
}

// Obtiene el número de mes a partir del nombre
function mesIndex(nombreMes) {
  return MESES.findIndex(m => m.toLowerCase() === nombreMes?.toLowerCase());
}

// Último día del mes
function ultimoDiaMes(anio, mes0) {
  return new Date(anio, mes0 + 1, 0).getDate();
}

// Formatea fecha como "YYYY-MM-DD HH:MM:SS" (formato Excel del template)
function fmtExcel(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d} 00:00:00`;
}

// Construye la descripción "Cuota Mes - APELLIDO, Nombre" o múltiples meses
function buildConcepto(pago) {
  if (pago.tipo_pago === 'Campamento') {
    return `Campamento ${pago.campamento_nombre || ''} - ${pago.beneficiario_nombre || ''}`;
  }
  const meses = pago.meses?.length ? pago.meses : (pago.mes ? [pago.mes] : []);
  const conceptoMeses = meses.length > 1
    ? `Cuotas ${meses.join('/')} ${pago.anio}`
    : `Cuota ${meses[0] || ''} ${pago.anio}`;
  return `${conceptoMeses} - ${pago.beneficiario_nombre || ''}`;
}

// Calcula período facturado: primer día del primer mes → último día del último mes
function buildPeriodo(pago) {
  const anio = pago.anio || new Date().getFullYear();
  const meses = pago.meses?.length ? pago.meses : (pago.mes ? [pago.mes] : []);

  if (pago.tipo_pago === 'Campamento') {
    // Para campamento usamos la fecha de pago como período de un día
    const f = new Date((pago.fecha_pago || new Date().toISOString().split('T')[0]) + 'T12:00:00');
    return { desde: fmtExcel(f), hasta: fmtExcel(f) };
  }

  if (meses.length === 0) {
    const f = new Date((pago.fecha_pago || new Date().toISOString().split('T')[0]) + 'T12:00:00');
    return { desde: fmtExcel(f), hasta: fmtExcel(f) };
  }

  const indices = meses.map(m => mesIndex(m)).filter(i => i >= 0).sort((a, b) => a - b);
  const primerMes = indices[0];
  const ultimoMes = indices[indices.length - 1];

  const desde = new Date(anio, primerMes, 1);
  const hasta = new Date(anio, ultimoMes, ultimoDiaMes(anio, ultimoMes));
  return { desde: fmtExcel(desde), hasta: fmtExcel(hasta) };
}

function exportarExcel(pagosFiltrados, beneficiariosMap) {
  const filas = pagosFiltrados.map(p => {
    const fechaComprobante = fmtExcel(new Date((p.fecha_pago || new Date().toISOString().split('T')[0]) + 'T12:00:00'));
    const { desde, hasta } = buildPeriodo(p);
    const ben = beneficiariosMap[p.beneficiario_id];
    const email = ben?.email_contacto || null;

    // Calcular cantidad de meses
    let cantidad = 1;
    if (p.tipo_pago === 'Cuota') {
      const meses = p.meses?.length ? p.meses : (p.mes ? [p.mes] : []);
      cantidad = meses.length || 1;
    }

    const total = p.monto || 0;
    const precioUnitario = cantidad > 0 ? total / cantidad : total;

    // Determinar condición de venta
    let condicionVenta = 'CONTADO';
    if (p.forma_pago === 'Transferencia') {
      condicionVenta = 'TRANSFERENCIA BANCARIA';
    }

    return {
      'Fecha Comprobante': fechaComprobante,
      'Producto / Servicio': buildConcepto(p),
      'Precio Unitario': formatDineroAR(precioUnitario),
      'Cantidad': cantidad,
      'Total': formatDineroAR(total),
      'Tipo': 'SERVICIO',
      'Facturado Desde': desde,
      'Facturado Hasta': hasta,
      'Condicion de Venta': condicionVenta,
      'Condicion de IVA': 'CONSUMIDOR FINAL',
      'CUIT o DNI (Opcional)': null,
      'Email (Opcional)': email || null,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas, {
    header: [
      'Fecha Comprobante','Producto / Servicio','Precio Unitario','Cantidad','Total',
      'Tipo','Facturado Desde','Facturado Hasta','Condicion de Venta','Condicion de IVA',
      'CUIT o DNI (Opcional)','Email (Opcional)'
    ]
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Datos de Facturas');
  XLSX.writeFile(wb, `facturacion_masiva_${new Date().toISOString().split('T')[0]}.xlsx`);
}

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

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const beneficiariosMap = useMemo(() => {
    const map = {};
    beneficiarios.forEach(b => { map[b.id] = b; });
    return map;
  }, [beneficiarios]);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImprimir} disabled={pagosFiltrados.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Imprimir PDF
          </Button>
          <Button onClick={() => exportarExcel(pagosFiltrados, beneficiariosMap)} disabled={pagosFiltrados.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel facturación
          </Button>
        </div>
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