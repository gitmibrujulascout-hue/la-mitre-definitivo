import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

// Sincronizado con la lógica de Caja.jsx
const destinoPago = (p) => {
  if (p.forma_pago === 'Subsidio del grupo' || p.destino === 'Grupo') return null;
  if (p.forma_pago === 'Crédito actividad') return null;
  if (p.tipo_pago === 'Afiliación') return null;
  if (p.destino === 'Banco') return 'Banco';
  if (p.destino === 'Caja') return 'Caja';
  if (p.forma_pago === 'Transferencia') return 'Banco';
  return 'Caja';
};
const destinoGasto = (g) => {
  if (g.destino === 'Banco') return 'Banco';
  if (g.destino === 'Caja') return 'Caja';
  if (g.forma_pago === 'Transferencia') return 'Banco';
  return 'Caja';
};

export default function ReporteCajaDialog({ open, onClose, cuentaInicial = 'Caja' }) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const primerDiaMes = hoy.substring(0, 8) + '01';

  const [cuenta, setCuenta] = useState(cuentaInicial);
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy);
  const printRef = useRef();

  const { data: pagos = [] } = useQuery({ queryKey: ['pagos'], queryFn: () => base44.entities.Pago.list('-fecha_pago', 5000) });
  const { data: gastos = [] } = useQuery({ queryKey: ['gastos'], queryFn: () => base44.entities.Gasto.list('-fecha', 5000) });
  const { data: movimientosExtra = [] } = useQuery({ queryKey: ['movimientos_banco'], queryFn: () => base44.entities.MovimientoBanco.list('-fecha', 2000) });
  const { data: campamentos = [] } = useQuery({ queryKey: ['campamentos'], queryFn: () => base44.entities.Campamento.list() });

  const privateCampIds = useMemo(() => new Set(
    campamentos.filter(c => c.es_privado).map(c => c.id)
  ), [campamentos]);

  // Todos los movimientos de la cuenta (sin filtro de fecha), ordenados cronológicamente
  const todosMovimientos = useMemo(() => {
    const ingresoPagos = pagos
      .filter(p => destinoPago(p) === cuenta)
      .filter(p => !(p.tipo_pago === 'Campamento' && privateCampIds.has(p.campamento_id)))
      .map(p => ({
        fecha: p.fecha_pago || '', tipo: 'Ingreso',
        concepto: p.tipo_pago === 'Campamento'
          ? `Campamento: ${p.campamento_nombre || ''} — ${p.beneficiario_nombre}`
          : p.tipo_pago === 'Afiliación'
            ? `Afiliación/Seguro — ${p.beneficiario_nombre}`
            : `Cuota ${(p.meses || [p.mes]).filter(Boolean).join(', ')} — ${p.beneficiario_nombre}`,
        monto: p.monto || 0, origen: 'Pago',
      }));

    const egresoGastos = gastos
      .filter(g => destinoGasto(g) === cuenta)
      .filter(g => !privateCampIds.has(g.campamento_id))
      .map(g => ({
        fecha: g.fecha || '', tipo: 'Egreso',
        concepto: `${g.descripcion}${g.proveedor ? ` (${g.proveedor})` : ''}`,
        monto: g.monto || 0, origen: 'Gasto',
      }));

    const extras = movimientosExtra
      .filter(m => (m.cuenta || 'Caja') === cuenta && (m.origen === 'Manual' || m.origen === 'Crédito' || m.origen === 'Afiliación'))
      .map(m => ({
        fecha: m.fecha || '', tipo: m.tipo,
        concepto: m.concepto, monto: m.monto || 0, origen: m.origen === 'Manual' ? 'Manual' : m.origen,
      }));

    return [...ingresoPagos, ...egresoGastos, ...extras].sort((a, b) => {
      const diff = a.fecha.localeCompare(b.fecha);
      if (diff !== 0) return diff;
      if (a.tipo === 'Ingreso' && b.tipo !== 'Ingreso') return -1;
      if (a.tipo !== 'Ingreso' && b.tipo === 'Ingreso') return 1;
      return 0;
    });
  }, [pagos, gastos, movimientosExtra, cuenta, privateCampIds]);

  // Saldo anterior al rango (suma de todo lo anterior a "desde")
  const saldoAnterior = useMemo(() => {
    return todosMovimientos
      .filter(m => m.fecha < desde)
      .reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.monto : -m.monto), 0);
  }, [todosMovimientos, desde]);

  // Movimientos dentro del rango
  const movimientosRango = useMemo(() => {
    return todosMovimientos.filter(m => m.fecha >= desde && m.fecha <= hasta);
  }, [todosMovimientos, desde, hasta]);

  // Con saldo acumulado (parte del saldoAnterior)
  const movimientosConSaldo = useMemo(() => {
    let acum = saldoAnterior;
    return movimientosRango.map(m => {
      acum += m.tipo === 'Ingreso' ? m.monto : -m.monto;
      return { ...m, saldoAcumulado: acum };
    });
  }, [movimientosRango, saldoAnterior]);

  const totalIngresos = movimientosRango.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEgresos = movimientosRango.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + m.monto, 0);
  const saldoFinal = saldoAnterior + totalIngresos - totalEgresos;

  const handlePrint = () => {
    const contenido = printRef.current.innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(`
      <html><head><title>Reporte ${cuenta} ${desde} al ${hasta}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
        h2 { margin-bottom: 4px; }
        p { margin: 2px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f3f4f6; text-align: left; padding: 6px 8px; border-bottom: 2px solid #ddd; font-size: 11px; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
        .ingreso { color: #16a34a; font-weight: 600; }
        .egreso { color: #dc2626; font-weight: 600; }
        .saldo-ant { background: #fef9c3; font-weight: bold; }
        .saldo-final { background: #dcfce7; font-weight: bold; }
        .resumen { margin-top: 12px; display: flex; gap: 24px; }
        .resumen div { padding: 8px 12px; border-radius: 6px; }
        @media print { button { display: none; } }
      </style></head>
      <body>${contenido}</body></html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
    ventana.close();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reporte de movimientos</DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4 items-end pb-4 border-b">
          <div>
            <Label className="text-xs">Cuenta</Label>
            <div className="flex gap-2 mt-1">
              {['Caja', 'Banco'].map(c => (
                <button
                  key={c}
                  onClick={() => setCuenta(c)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${cuenta === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-36 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-36 mt-1" />
          </div>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />Imprimir / PDF
          </Button>
        </div>

        {/* Contenido imprimible */}
        <div ref={printRef}>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Reporte {cuenta} — {desde} al {hasta}</h2>
            <p className="text-sm text-muted-foreground">Generado el {hoy}</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="w-20">Origen</TableHead>
                <TableHead className="w-20">Tipo</TableHead>
                <TableHead className="w-28 text-right">Monto</TableHead>
                <TableHead className="w-28 text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Fila saldo anterior */}
              <TableRow className="bg-yellow-50 font-semibold">
                <TableCell className="text-xs text-muted-foreground">Anterior a {desde}</TableCell>
                <TableCell colSpan={3} className="text-sm font-semibold text-muted-foreground italic">
                  Saldo anterior al período
                </TableCell>
                <TableCell />
                <TableCell className={cn('text-right font-bold', saldoAnterior >= 0 ? 'text-blue-700' : 'text-red-600')}>
                  {formatMoney(saldoAnterior)}
                </TableCell>
              </TableRow>

              {movimientosConSaldo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay movimientos en este período
                  </TableCell>
                </TableRow>
              ) : (
                movimientosConSaldo.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm whitespace-nowrap">{m.fecha}</TableCell>
                    <TableCell className="text-sm">{m.concepto}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{m.origen}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={m.tipo === 'Ingreso'
                        ? 'bg-green-100 text-green-700 border-green-300 border text-xs'
                        : 'bg-red-100 text-red-700 border-red-300 border text-xs'
                      }>
                        {m.tipo === 'Ingreso' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownLeft className="w-3 h-3 mr-1" />}
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold', m.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-500')}>
                      {m.tipo === 'Egreso' ? '−' : '+'}{formatMoney(m.monto)}
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold text-sm', m.saldoAcumulado >= 0 ? 'text-foreground' : 'text-red-500')}>
                      {formatMoney(m.saldoAcumulado)}
                    </TableCell>
                  </TableRow>
                ))
              )}

              {/* Fila saldo final */}
              {movimientosConSaldo.length > 0 && (
                <TableRow className="bg-green-50 font-bold border-t-2 border-green-300">
                  <TableCell colSpan={2} className="text-sm font-bold">SALDO FINAL AL {hasta}</TableCell>
                  <TableCell className="text-sm text-green-700">+{formatMoney(totalIngresos)}</TableCell>
                  <TableCell className="text-sm text-red-600">−{formatMoney(totalEgresos)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground font-medium">
                    Neto: {formatMoney(totalIngresos - totalEgresos)}
                  </TableCell>
                  <TableCell className={cn('text-right font-bold text-base', saldoFinal >= 0 ? 'text-green-700' : 'text-red-600')}>
                    {formatMoney(saldoFinal)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}