import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Download, Trash2, FileText, TrendingUp } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RendicionesList({ anio }) {
  const queryClient = useQueryClient();
  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });
  const { data: rendiciones = [], isLoading } = useQuery({
    queryKey: ['rendiciones-afiliacion'],
    queryFn: () => base44.entities.RendicionAfiliacion.list('-fecha', 50),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r) => {
      await base44.entities.MovimientoBanco.deleteMany({ referencia_id: r.id, origen: 'Afiliación' });
      await base44.entities.RendicionAfiliacion.delete(r.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rendiciones-afiliacion'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Rendición eliminada y movimientos revertidos');
    }
  });

  const handleDelete = (r) => {
    if (window.confirm(`¿Eliminar la rendición del ${r.fecha} por ${formatMoney(r.monto_depositado)}? Se revertirán los movimientos de caja.`)) {
      deleteMutation.mutate(r);
    }
  };

  // Recalcular "de caja común" con arrastre de excedente entre rendiciones
  const { rendicionesCalculadas, resumen } = useMemo(() => {
    const rendAnio = rendiciones
      .filter(r => Number(r.anio) === Number(anio))
      .sort((a, b) => {
        const diff = (a.fecha || '').localeCompare(b.fecha || '');
        if (diff !== 0) return diff;
        return (a.created_date || '').localeCompare(b.created_date || '');
      });

    let excedenteAcumulado = 0;
    const calculadas = rendAnio.map(r => {
      const depositado = r.monto_depositado || 0;
      const recaudado = r.monto_recaudado || 0;
      const excedentePrevio = excedenteAcumulado;
      const deCajaComun = Math.max(0, depositado - recaudado - excedentePrevio);
      excedenteAcumulado = Math.max(0, excedentePrevio + recaudado - depositado);
      return { ...r, deCajaComunCalculado: deCajaComun, excedenteRestante: excedenteAcumulado };
    });

    const totalDepositado = calculadas.reduce((s, r) => s + (r.monto_depositado || 0), 0);
    const totalRecaudado = calculadas.reduce((s, r) => s + (r.monto_recaudado || 0), 0);
    const totalDeCajaComun = calculadas.reduce((s, r) => s + r.deCajaComunCalculado, 0);

    // Total que SA exige (afiliaciones no primera vez del año)
    const afilAnio = afiliaciones.filter(a => Number(a.anio) === Number(anio) && !a.es_primera_vez);
    const totalExigidoSA = afilAnio.reduce((s, a) => s + (a.monto || 0), 0);
    const totalRecaudadoFamilias = afilAnio.reduce((s, a) => s + Math.max(0, (a.monto_pagado || 0) - (a.monto_pagado_credito || 0)), 0);
    const saldoADepositar = Math.max(0, totalExigidoSA - totalDepositado);

    return {
      rendicionesCalculadas: calculadas,
      resumen: {
        totalExigidoSA,
        totalRecaudadoFamilias,
        totalDepositado,
        totalRecaudado,
        totalDeCajaComun,
        excedenteFinal: excedenteAcumulado,
        saldoADepositar,
      },
    };
  }, [rendiciones, afiliaciones, anio]);

  if (isLoading || rendicionesCalculadas.length === 0) return null;

  const s = resumen;

  return (
    <Card className="overflow-hidden mt-6">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" />
          Rendiciones a Scout Argentina — {anio}
        </h3>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 p-4 bg-muted/10 border-b">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">SA exige</p>
          <p className="text-sm font-bold text-cyan-700">{formatMoney(s.totalExigidoSA)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">Recaudado familias</p>
          <p className="text-sm font-bold text-green-700">{formatMoney(s.totalRecaudadoFamilias)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">Depositado a SA</p>
          <p className="text-sm font-bold text-red-600">{formatMoney(s.totalDepositado)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">De caja común</p>
          <p className="text-sm font-bold text-amber-600">{formatMoney(s.totalDeCajaComun)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">Excedente en caja</p>
          <p className={cn('text-sm font-bold', s.excedenteFinal > 0 ? 'text-green-600' : 'text-muted-foreground')}>
            {s.excedenteFinal > 0 ? formatMoney(s.excedenteFinal) : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">Saldo a depositar</p>
          <p className="text-sm font-bold text-orange-600">{formatMoney(s.saldoADepositar)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">Neto caja</p>
          <p className={cn('text-sm font-bold', (s.totalRecaudado - s.totalDepositado) >= 0 ? 'text-green-600' : 'text-red-600')}>
            {formatMoney(s.totalRecaudado - s.totalDepositado)}
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Depositado</TableHead>
            <TableHead className="text-right">Recaudado</TableHead>
            <TableHead className="text-right">De caja común</TableHead>
            <TableHead className="text-right">Excedente</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rendicionesCalculadas.map(r => (
            <TableRow key={r.id}>
              <TableCell className="text-sm">{r.fecha}</TableCell>
              <TableCell className="text-right font-semibold text-red-600">{formatMoney(r.monto_depositado)}</TableCell>
              <TableCell className="text-right text-green-600">{formatMoney(r.monto_recaudado || 0)}</TableCell>
              <TableCell className="text-right">
                {r.deCajaComunCalculado > 0
                  ? <span className="text-amber-600 font-medium">{formatMoney(r.deCajaComunCalculado)}</span>
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right">
                {r.excedenteRestante > 0
                  ? <span className="text-green-600 font-medium flex items-center justify-end gap-0.5">
                      <TrendingUp className="w-3 h-3" />{formatMoney(r.excedenteRestante)}
                    </span>
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-sm">
                {r.archivo_url
                  ? <a href={r.archivo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      <Download className="w-3 h-3" />{r.comprobante || 'Ver comprobante'}
                    </a>
                  : r.comprobante || <span className="text-muted-foreground text-xs inline-flex items-center gap-1"><FileText className="w-3 h-3" />Sin archivo</span>}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}>
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}