import React, { useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, ChevronRight, ChevronDown, CreditCard, Tent, ShoppingCart, ArrowRightLeft, FileDown, ShieldCheck } from 'lucide-react';
import { TODOS_LOS_ROLES, formatMoney, compararPorRamaYApellido } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';

const USAGE_ICON = { 'Cuota': CreditCard, 'Campamento': Tent, 'Tienda': ShoppingCart, 'Transferencia': ArrowRightLeft, 'Afiliación': ShieldCheck };
const USAGE_COLOR = { 'Cuota': 'text-blue-600', 'Campamento': 'text-purple-600', 'Tienda': 'text-green-600', 'Transferencia': 'text-amber-600', 'Afiliación': 'text-purple-700' };

export default function CreditosConsulta({ beneficiarios }) {
  const [actividadSel, setActividadSel] = useState('todas');
  const [ramaSel, setRamaSel] = useState('todas');
  const [expanded, setExpanded] = useState({});
  const tableRef = useRef(null);

  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ['creditos-todos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list('-fecha', 500),
  });

  const { data: pagosCredito = [] } = useQuery({
    queryKey: ['pagos-credito'],
    queryFn: () => base44.entities.Pago.filter({ forma_pago: 'Crédito actividad' }, '-fecha_pago', 500),
  });

  const { data: ventasTiendaCredito = [] } = useQuery({
    queryKey: ['ventas-tienda-credito'],
    queryFn: () => base44.entities.VentaTienda.filter({ forma_pago: 'Crédito actividad' }, '-fecha', 500),
  });

  // Mapa beneficiario_id -> rama
  const benRamaMap = useMemo(() => {
    const m = {};
    beneficiarios.forEach(b => { m[b.id] = b.rama; });
    return m;
  }, [beneficiarios]);

  const getActividadNombre = (c) => c.actividad_nombre || c.observaciones || 'Sin actividad';

  const actividadesMap = useMemo(() => {
    const mapa = {};
    creditos.forEach(c => {
      const key = c.actividad_id || c.observaciones || 'sin-actividad';
      if (!mapa[key]) mapa[key] = { id: key, nombre: getActividadNombre(c) };
    });
    return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [creditos]);

  const creditosFiltrados = useMemo(() => {
    let filtered = creditos;
    if (actividadSel !== 'todas') filtered = filtered.filter(c => (c.actividad_id || c.observaciones || 'sin-actividad') === actividadSel);
    if (ramaSel !== 'todas') filtered = filtered.filter(c => benRamaMap[c.beneficiario_id] === ramaSel);
    return [...filtered].sort((a, b) =>
      compararPorRamaYApellido(
        benRamaMap[a.beneficiario_id], a.beneficiario_nombre,
        benRamaMap[b.beneficiario_id], b.beneficiario_nombre
      )
    );
  }, [creditos, actividadSel, ramaSel, benRamaMap]);

  const totalOriginal = creditosFiltrados.reduce((s, c) => s + (c.monto_original || 0), 0);
  const totalDisponible = creditosFiltrados.reduce((s, c) => s + (c.monto_disponible || 0), 0);
  const totalUsadoLibros = totalOriginal - totalDisponible;

  // Usado real desde Pagos + VentasTienda con crédito (consistente con ReporteCreditos)
  const usadoRealPorBen = useMemo(() => {
    const map = {};
    pagosCredito.forEach(p => {
      if (!p.beneficiario_id) return;
      map[p.beneficiario_id] = (map[p.beneficiario_id] || 0) + (p.monto || 0);
    });
    ventasTiendaCredito.forEach(v => {
      if (!v.beneficiario_id) return;
      map[v.beneficiario_id] = (map[v.beneficiario_id] || 0) + (v.monto_total || 0);
    });
    return map;
  }, [pagosCredito, ventasTiendaCredito]);

  const totalUsadoReal = useMemo(() => {
    const benIds = new Set(creditosFiltrados.map(c => c.beneficiario_id).filter(Boolean));
    return Object.entries(usadoRealPorBen)
      .filter(([id]) => benIds.has(id))
      .reduce((s, [, v]) => s + v, 0);
  }, [usadoRealPorBen, creditosFiltrados]);

  const diferenciaReconciliacion = totalUsadoLibros - totalUsadoReal;

  // Agrupar créditos por beneficiario (una fila por persona, con totales de todas las actividades)
  const creditosPorBeneficiario = useMemo(() => {
    const map = {};
    creditosFiltrados.forEach(c => {
      const key = c.beneficiario_id || c.beneficiario_nombre || '__sin_ben__';
      if (!map[key]) {
        map[key] = {
          key,
          beneficiario_id: c.beneficiario_id,
          beneficiario_nombre: c.beneficiario_nombre,
          rama: benRamaMap[c.beneficiario_id],
          creditos: [],
          totalOriginal: 0,
          totalDisponible: 0,
        };
      }
      map[key].creditos.push(c);
      map[key].totalOriginal += c.monto_original || 0;
      map[key].totalDisponible += c.monto_disponible || 0;
    });
    return Object.values(map).sort((a, b) =>
      compararPorRamaYApellido(a.rama, a.beneficiario_nombre, b.rama, b.beneficiario_nombre)
    );
  }, [creditosFiltrados, benRamaMap]);

  const getUsos = (credito) => {
    const usos = [];
    const actNombre = credito.actividad_nombre || credito.observaciones || '';

    pagosCredito
      .filter(p => p.beneficiario_id === credito.beneficiario_id && p.observaciones?.includes(actNombre))
      .forEach(p => {
        usos.push({
          tipo: p.tipo_pago === 'Cuota' ? 'Cuota' : p.tipo_pago === 'Afiliación' ? 'Afiliación' : 'Campamento',
          descripcion: p.tipo_pago === 'Cuota'
            ? `Cuota ${p.anio} — ${(p.meses || [p.mes]).filter(Boolean).join(', ')}`
            : p.tipo_pago === 'Afiliación'
              ? `Afiliación ${p.anio}`
              : `${p.campamento_nombre || 'Campamento'}`,
          monto: p.monto,
          fecha: p.fecha_pago,
        });
      });

    ventasTiendaCredito
      .filter(v => v.beneficiario_id === credito.beneficiario_id && v.observaciones?.includes(actNombre))
      .forEach(v => {
        usos.push({
          tipo: 'Tienda',
          descripcion: `${v.producto_nombre}${v.cantidad > 1 ? ` (x${v.cantidad})` : ''}`,
          monto: v.monto_total,
          fecha: v.fecha,
        });
      });

    // Transferencias salientes
    creditos
      .filter(c =>
        c.observaciones?.includes(`Transferido desde ${credito.beneficiario_nombre}`)
        && (c.actividad_id === credito.actividad_id || (!c.actividad_id && !credito.actividad_id))
      )
      .forEach(c => {
        usos.push({
          tipo: 'Transferencia',
          descripcion: `Transferido a ${c.beneficiario_nombre}`,
          monto: c.monto_original,
          fecha: c.fecha,
        });
      });

    return usos.sort((a, b) => new Date(b.fecha || '1900-01-01') - new Date(a.fecha || '1900-01-01'));
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const exportPDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Reporte de Créditos', margin, y);
    y += 7;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const filtros = [];
    if (ramaSel !== 'todas') filtros.push(`Rama: ${ramaSel}`);
    if (actividadSel !== 'todas') filtros.push(`Actividad: ${actividadesMap.find(a => a.id === actividadSel)?.nombre || ''}`);
    pdf.text(filtros.length > 0 ? filtros.join('  ·  ') : 'Todos los créditos', margin, y);
    y += 5;
    pdf.text(`Generado: ${new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}`, margin, y);
    y += 7;

    // Totals box
    pdf.setFillColor(240, 240, 245);
    pdf.roundedRect(margin, y - 4, pageW - 2 * margin, 10, 1, 1, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    const totStr = `Acreditado: ${formatMoney(totalOriginal)}    Usado: ${formatMoney(totalUsadoReal)}    Disponible: ${formatMoney(totalDisponible)}`;
    pdf.text(totStr, pageW / 2, y + 2, { align: 'center' });
    y += 12;

    // Table
    const cols = [
      { title: 'Beneficiario', w: 55, align: 'left' },
      { title: 'Actividad', w: 45, align: 'left' },
      { title: 'Acreditado', w: 28, align: 'right' },
      { title: 'Usado', w: 28, align: 'right' },
      { title: 'Disponible', w: 28, align: 'right' },
    ];
    const tableW = pageW - 2 * margin;

    // Header row
    pdf.setFillColor(60, 70, 90);
    pdf.rect(margin, y - 4, tableW, 6, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    let x = margin;
    cols.forEach((c) => {
      pdf.text(c.title, c.align === 'right' ? x + c.w - 2 : x + 2, y, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    });
    y += 6;

    // Data rows
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    creditosFiltrados.forEach((c, i) => {
      if (y > pageH - 15) {
        pdf.addPage();
        y = margin;
      }
      const usado = (c.monto_original || 0) - (c.monto_disponible || 0);
      const values = [
        (c.beneficiario_nombre || '').substring(0, 32),
        (c.actividad_nombre || '').substring(0, 26),
        formatMoney(c.monto_original || 0),
        formatMoney(usado),
        formatMoney(c.monto_disponible || 0),
      ];
      if (i % 2 === 0) {
        pdf.setFillColor(245, 245, 248);
        pdf.rect(margin, y - 4, tableW, 6, 'F');
      }
      x = margin;
      cols.forEach((col, j) => {
        pdf.text(values[j], col.align === 'right' ? x + col.w - 2 : x + 2, y, { align: col.align === 'right' ? 'right' : 'left' });
        x += col.w;
      });
      y += 6;
    });

    // Footer line
    y += 2;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageW - margin, y);
    y += 5;
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Total de registros: ${creditosFiltrados.length}`, margin, y);

    const nombreArchivo = `creditos${ramaSel !== 'todas' ? `_${ramaSel}` : ''}${actividadSel !== 'todas' ? `_${actividadesMap.find(a => a.id === actividadSel)?.nombre || ''}` : ''}.pdf`;
    pdf.save(nombreArchivo.replace(/\s+/g, '_'));
  };

  return (
    <div>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Wallet className="w-5 h-5 text-primary" />
            <Select value={ramaSel} onValueChange={setRamaSel}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las ramas</SelectItem>
                {TODOS_LOS_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actividadSel} onValueChange={setActividadSel}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las actividades</SelectItem>
                {actividadesMap.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Acreditado</p>
              <p className="font-bold text-blue-600">{formatMoney(totalOriginal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Usado</p>
              <p className="font-bold text-orange-600">{formatMoney(totalUsadoReal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Disponible</p>
              <p className="font-bold text-green-600">{formatMoney(totalDisponible)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportPDF} disabled={creditosFiltrados.length === 0}>
              <FileDown className="w-4 h-4 mr-1" />PDF
            </Button>
          </div>
        </div>
      </Card>

      {Math.abs(diferenciaReconciliacion) > 1 && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
          <Wallet className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Diferencia de reconciliación: <strong>{formatMoney(Math.abs(diferenciaReconciliacion))}</strong> entre el saldo de libros
            ({formatMoney(totalUsadoLibros)}) y los pagos registrados ({formatMoney(totalUsadoReal)}).
            Esto puede deberse a transferencias antiguas o ajustes manuales en créditos sin pago registrado.
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Cargando...</p>
      ) : creditosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay créditos registrados</p>
        </div>
      ) : (
        <Card className="overflow-hidden" >
          <div ref={tableRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead className="text-right">Acreditado</TableHead>
                  <TableHead className="text-right">Usado</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditosPorBeneficiario.map(ben => {
                  const benUsado = usadoRealPorBen[ben.beneficiario_id] || 0;
                  const isExpanded = expanded[ben.key];
                  return (
                    <React.Fragment key={ben.key}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(ben.key)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{ben.beneficiario_nombre}</span>
                            {ben.rama && (
                              <span className="text-xs text-muted-foreground">{ben.rama}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(ben.totalOriginal)}</TableCell>
                        <TableCell className="text-right text-orange-600">{formatMoney(benUsado)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{formatMoney(ben.totalDisponible)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-3">
                            <div className="space-y-2">
                              {ben.creditos.map(c => {
                                const usado = (c.monto_original || 0) - (c.monto_disponible || 0);
                                const usos = getUsos(c);
                                return (
                                  <div key={c.id} className="border rounded-lg p-2.5 bg-background">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium">{getActividadNombre(c)}</span>
                                      <div className="flex gap-3 text-xs">
                                        <span className="text-muted-foreground">Acreditado: <b className="text-foreground">{formatMoney(c.monto_original || 0)}</b></span>
                                        <span className="text-orange-600">Usado: <b>{formatMoney(usado)}</b></span>
                                        <span className="text-green-600">Disponible: <b>{formatMoney(c.monto_disponible || 0)}</b></span>
                                      </div>
                                    </div>
                                    {usos.length === 0 ? (
                                      <p className="text-xs text-muted-foreground pl-1">Sin consumos registrados</p>
                                    ) : (
                                      <div className="space-y-0.5">
                                        {usos.map((u, i) => {
                                          const UIcon = USAGE_ICON[u.tipo] || CreditCard;
                                          return (
                                            <div key={i} className="flex items-center gap-2 text-sm py-1 border-t border-border/60">
                                              <UIcon className={cn('w-3.5 h-3.5 flex-shrink-0', USAGE_COLOR[u.tipo])} />
                                              <div className="flex-1">
                                                <span className="font-medium">{u.descripcion}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{u.fecha}</span>
                                              </div>
                                              <span className="font-medium text-orange-600">−{formatMoney(u.monto)}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}