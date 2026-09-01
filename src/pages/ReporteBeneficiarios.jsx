import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Filter, Users, FileSpreadsheet, FileText } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import { RAMAS, TODOS_LOS_ROLES, formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ReporteBeneficiarios() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual.toString());
  const [filtroRama, setFiltroRama] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroDeuda, setFiltroDeuda] = useState('todos');
  const [filtroAfiliacion, setFiltroAfiliacion] = useState('todos');
  const [filtroActivo, setFiltroActivo] = useState('activos');
  const [search, setSearch] = useState('');

  const { data: beneficiarios = [] } = useQuery({ queryKey: ['beneficiarios'], queryFn: () => base44.entities.Beneficiario.list() });
  const { data: pagos = [] } = useQuery({ queryKey: ['pagos'], queryFn: () => base44.entities.Pago.list('-fecha_pago', 1000) });
  const { data: afiliaciones = [] } = useQuery({ queryKey: ['afiliaciones'], queryFn: () => base44.entities.Afiliacion.list() });
  const { data: campamentos = [] } = useQuery({ queryKey: ['campamentos'], queryFn: () => base44.entities.Campamento.list() });

  const anioNum = parseInt(anio);

  const datos = useMemo(() => {
    return beneficiarios.map(b => {
      const pagosBen = pagos.filter(p => p.beneficiario_id === b.id && p.anio === anioNum);
      const mesesPagados = new Set(pagosBen.filter(p => p.tipo_pago !== 'Campamento').flatMap(p => p.meses || [p.mes]).filter(Boolean));
      const mesesDeuda = MESES.filter(m => !mesesPagados.has(m));
      const totalPagado = pagosBen.reduce((s, p) => s + (p.monto || 0), 0);
      const campsAsignados = campamentos.filter(c => (c.beneficiarios_ids || []).includes(b.id));
      const totalCampamentos = campsAsignados.reduce((s, c) => s + (c.costo_por_persona || 0), 0);
      const pagadoCamp = pagosBen.filter(p => p.tipo_pago === 'Campamento').reduce((s, p) => s + (p.monto || 0), 0);
      const deudaCamp = Math.max(0, totalCampamentos - pagadoCamp);
      const afiliacion = afiliaciones.find(a => a.beneficiario_id === b.id && a.anio === anioNum);
      const tieneDeuda = b.tipo !== 'Voluntario' && !b.becado && (mesesDeuda.length > 0 || deudaCamp > 0);
      return { ...b, mesesPagados: mesesPagados.size, mesesDeuda: mesesDeuda.length, totalPagado, deudaCamp, tieneDeuda, afiliacion };
    });
  }, [beneficiarios, pagos, afiliaciones, campamentos, anioNum]);

  const filtrados = useMemo(() => {
    return datos.filter(b => {
      if (filtroActivo === 'activos' && b.activo === false) return false;
      if (filtroActivo === 'inactivos' && b.activo !== false) return false;
      if (filtroRama !== 'todas' && b.rama !== filtroRama) return false;
      if (filtroTipo !== 'todos' && (b.tipo || 'Beneficiario') !== filtroTipo) return false;
      if (filtroDeuda === 'con_deuda' && !b.tieneDeuda) return false;
      if (filtroDeuda === 'sin_deuda' && b.tieneDeuda) return false;
      if (filtroAfiliacion === 'afiliado' && !b.afiliacion) return false;
      if (filtroAfiliacion === 'no_afiliado' && b.afiliacion) return false;
      if (search && !b.nombre?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b2) => (a.nombre || '').localeCompare(b2.nombre || '', 'es'));
  }, [datos, filtroActivo, filtroRama, filtroTipo, filtroDeuda, filtroAfiliacion, search]);

  const filas = () => filtrados.map(b => [
    b.nombre || '',
    b.rama || '',
    b.tipo || 'Beneficiario',
    b.dni || '',
    b.activo !== false ? 'Sí' : 'No',
    b.becado ? 'Sí' : 'No',
    b.tipo === 'Voluntario' ? 'N/A' : `${b.mesesPagados} / 12`,
    b.tipo === 'Voluntario' || b.becado ? '—' : b.mesesDeuda > 0 ? `${b.mesesDeuda} mes(es)` : 'Al día',
    b.deudaCamp > 0 ? `$${b.deudaCamp}` : '—',
    `$${b.totalPagado}`,
    b.tipo === 'Voluntario' ? 'N/A' : b.afiliacion ? 'Sí' : 'Pendiente',
  ]);

  const COLS = ['Nombre', 'Rama', 'Tipo', 'DNI', 'Activo', 'Becado', 'Meses pagados', 'Deuda cuotas', 'Deuda camp.', 'Total pagado', 'Afiliación'];

  const exportarXLS = async () => {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const ws = XLSX.utils.aoa_to_sheet([COLS, ...filas()]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Reporte ${anio}`);
    XLSX.writeFile(wb, `reporte-beneficiarios-${anio}.xlsx`);
  };

  const ORDEN_PDF = ['Lobatos', 'Tropa', 'KM', 'Rovers', 'Voluntario', 'Educador'];

  const filaFor = (b) => [
    b.nombre || '', b.rama || '', b.tipo || 'Beneficiario', b.dni || '',
    b.activo !== false ? 'Sí' : 'No', b.becado ? 'Sí' : 'No',
    b.tipo === 'Voluntario' ? 'N/A' : `${b.mesesPagados} / 12`,
    b.tipo === 'Voluntario' || b.becado ? '—' : b.mesesDeuda > 0 ? `${b.mesesDeuda} mes(es)` : 'Al día',
    b.deudaCamp > 0 ? `$${b.deudaCamp}` : '—', `$${b.totalPagado}`,
    b.tipo === 'Voluntario' ? 'N/A' : b.afiliacion ? 'Sí' : 'Pendiente',
  ];

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const colWidths = [42, 18, 20, 22, 12, 12, 22, 22, 22, 22, 18];
    const medCols = [42, 35, 35, 35, 35];
    const rowH = 7;

    // Agrupar por rama
    const porRama = {};
    filtrados.forEach(b => {
      const r = b.rama || 'Sin rama';
      if (!porRama[r]) porRama[r] = [];
      porRama[r].push(b);
    });
    const ramasOrdenadas = ORDEN_PDF.filter(r => porRama[r]).concat(Object.keys(porRama).filter(r => !ORDEN_PDF.includes(r)));

    let y = 14;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Reporte de Beneficiarios ${anio}`, margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total: ${filtrados.length}  |  Con deuda: ${filtrados.filter(b => b.tieneDeuda).length}  |  Afiliados: ${filtrados.filter(b => b.afiliacion).length}  |  Becados: ${filtrados.filter(b => b.becado).length}`, margin, y);
    y += 4;

    const drawHeader = () => {
      doc.setFillColor(30, 64, 175);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      let x = margin;
      COLS.forEach((col, i) => {
        doc.rect(x, y, colWidths[i], rowH, 'F');
        doc.text(col, x + 1.5, y + 4.5);
        x += colWidths[i];
      });
      y += rowH;
    };

    ramasOrdenadas.forEach((rama, ri) => {
      // Salto de página antes de cada rama
      if (ri > 0) { doc.addPage(); y = 14; }
      // Título de rama
      doc.setFillColor(240, 240, 240);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.rect(margin, y, pageW - 2 * margin, 8, 'F');
      doc.text(`${rama} (${porRama[rama].length})`, margin + 2, y + 5.5);
      y += 10;
      drawHeader();
      // Filas
      doc.setFont('helvetica', 'normal');
      porRama[rama].forEach((b, i) => {
        if (y + rowH > pageH - 10) { doc.addPage(); y = 14; drawHeader(); }
        const row = filaFor(b);
        doc.setFillColor(i % 2 === 0 ? 255 : 245);
        doc.setTextColor(30, 30, 30);
        let x = margin;
        row.forEach((cell, ci) => {
          doc.rect(x, y, colWidths[ci], rowH, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.rect(x, y, colWidths[ci], rowH, 'S');
          const text = String(cell ?? '');
          doc.text(text.length > 18 ? text.slice(0, 17) + '…' : text, x + 1.5, y + 4.5);
          x += colWidths[ci];
        });
        y += rowH;
      });
    });

    // Sección de condiciones médicas y dietarias
    const conMedica = filtrados.filter(b => b.alergias || b.condicion_medica || b.regimen_dietario || b.medicacion_habitual);
    if (conMedica.length > 0) {
      doc.addPage();
      y = 14;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`Condiciones médicas y dietarias (${conMedica.length})`, margin, y);
      y += 6;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      const medHeaders = ['Nombre', 'Alergias', 'Régimen dietario', 'Condición médica', 'Medicación'];
      let x = margin;
      medHeaders.forEach((col, i) => {
        doc.setFillColor(180, 60, 60);
        doc.rect(x, y, medCols[i], rowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(col, x + 1.5, y + 4.5);
        x += medCols[i];
      });
      y += rowH;
      doc.setFont('helvetica', 'normal');
      conMedica.forEach((b, i) => {
        if (y + rowH > pageH - 10) { doc.addPage(); y = 14; }
        const vals = [b.nombre || '', b.alergias || '—', b.regimen_dietario || '—', b.condicion_medica || '—', b.medicacion_habitual || '—'];
        doc.setFillColor(i % 2 === 0 ? 255 : 245);
        doc.setTextColor(30, 30, 30);
        let x = margin;
        vals.forEach((cell, ci) => {
          doc.rect(x, y, medCols[ci], rowH, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.rect(x, y, medCols[ci], rowH, 'S');
          const text = String(cell ?? '');
          doc.text(text.length > 22 ? text.slice(0, 21) + '…' : text, x + 1.5, y + 4.5);
          x += medCols[ci];
        });
        y += rowH;
      });
    }

    doc.save(`reporte-beneficiarios-${anio}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Reporte de Beneficiarios" description="Estado de miembros, pagos y deudas por período">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={filtrados.length === 0}>
              <Download className="w-4 h-4 mr-2" />Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportarXLS}>
              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportarPDF}>
              <FileText className="w-4 h-4 mr-2 text-red-600" />PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Filtros */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024,2025,2026,2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroRama} onValueChange={setFiltroRama}>
            <SelectTrigger><SelectValue placeholder="Rama" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las ramas</SelectItem>
              {TODOS_LOS_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="Beneficiario">Beneficiarios</SelectItem>
              <SelectItem value="Voluntario">Voluntarios</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroDeuda} onValueChange={setFiltroDeuda}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda deuda</SelectItem>
              <SelectItem value="con_deuda">Con deuda</SelectItem>
              <SelectItem value="sin_deuda">Sin deuda</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroAfiliacion} onValueChange={setFiltroAfiliacion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Afiliación: todos</SelectItem>
              <SelectItem value="afiliado">Afiliados</SelectItem>
              <SelectItem value="no_afiliado">No afiliados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroActivo} onValueChange={setFiltroActivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">Solo activos</SelectItem>
              <SelectItem value="inactivos">Solo inactivos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3">
          <Input placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: filtrados.length, color: 'text-foreground' },
          { label: 'Con deuda', value: filtrados.filter(b => b.tieneDeuda).length, color: 'text-red-600' },
          { label: 'Afiliados', value: filtrados.filter(b => b.afiliacion).length, color: 'text-green-600' },
          { label: 'Becados', value: filtrados.filter(b => b.becado).length, color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nombre</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead className="hidden sm:table-cell">DNI</TableHead>
              <TableHead>Meses pagados</TableHead>
              <TableHead>Deuda cuotas</TableHead>
              <TableHead>Deuda camp.</TableHead>
              <TableHead>Afiliación {anio}</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No hay beneficiarios con los filtros seleccionados
              </TableCell></TableRow>
            ) : filtrados.map(b => (
              <TableRow key={b.id} className={b.tieneDeuda ? 'bg-red-50/40' : ''}>
                <TableCell className="font-medium">{b.nombre}</TableCell>
                <TableCell><RamaBadge rama={b.rama} /></TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{b.dni || '—'}</TableCell>
                <TableCell>
                  {b.tipo === 'Voluntario' ? <span className="text-muted-foreground text-xs">N/A</span> : (
                    <span className={cn('font-medium text-sm', b.mesesDeuda > 0 ? 'text-red-600' : 'text-green-600')}>
                      {b.mesesPagados} / 12
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {b.tipo === 'Voluntario' || b.becado ? <span className="text-muted-foreground text-xs">—</span> : (
                    b.mesesDeuda > 0
                      ? <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">{b.mesesDeuda} mes{b.mesesDeuda > 1 ? 'es' : ''}</Badge>
                      : <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">Al día</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {b.deudaCamp > 0
                    ? <span className="text-red-600 font-medium text-sm">{formatMoney(b.deudaCamp)}</span>
                    : <span className="text-muted-foreground text-xs">—</span>
                  }
                </TableCell>
                <TableCell>
                  {b.tipo === 'Voluntario' ? <span className="text-muted-foreground text-xs">N/A</span>
                    : b.afiliacion
                      ? <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">Afiliado</Badge>
                      : <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">Pendiente</Badge>
                  }
                </TableCell>
                <TableCell>
                  {b.activo === false
                    ? <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                    : b.becado
                      ? <Badge className="bg-amber-100 text-amber-700 border text-xs">Becado</Badge>
                      : null
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}