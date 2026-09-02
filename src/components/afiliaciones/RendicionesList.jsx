import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Download, Trash2, FileText, TrendingUp, RotateCcw } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import RegistrarRecuperoDialog from './RegistrarRecuperoDialog';

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
  const { data: recuperos = [] } = useQuery({
    queryKey: ['recuperos-afiliacion', anio],
    queryFn: () => base44.entities.MovimientoBanco.filter({ origen: 'Recupero afiliación' }, '-fecha', 50),
  });

  const [showRecuperoDialog, setShowRecuperoDialog] = useState(false);

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

  // Imputar el recaudado a cada depósito respetando fechas de pago:
  // un depósito solo se cubre con pagos recibidos ON OR BEFORE su fecha
  const { rendicionesCalculadas, resumen } = useMemo(() => {
    const rendAnio = rendiciones
      .filter(r => Number(r.anio) === Number(anio))
      .sort((a, b) => {
        const diff = (a.fecha || '').localeCompare(b.fecha || '');
        if (diff !== 0) return diff;
        return (a.created_date || '').localeCompare(b.created_date || '');
      });

    const afilAnio = afiliaciones.filter(a => Number(a.anio) === Number(anio) && !a.es_primera_vez);
    const totalExigidoSA = afilAnio.reduce((s, a) => s + (a.monto || 0), 0);
    const totalRecaudadoFamilias = afilAnio.reduce(
      (s, a) => s + Math.max(0, (a.monto_pagado || 0) - (a.monto_pagado_credito || 0)), 0
    );

    // Pagos en efectivo con fecha, ordenados cronológicamente
    const pagos = afilAnio
      .map(a => ({
        fecha: a.fecha_pago || (a.created_date || '').slice(0, 10) || '',
        monto: Math.max(0, (a.monto_pagado || 0) - (a.monto_pagado_credito || 0)),
      }))
      .filter(p => p.fecha && p.monto > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Imputar secuencialmente: cada depósito toma pagos con fecha <= su fecha
    let pool = 0;
    let pagoIdx = 0;
    const calculadas = rendAnio.map(r => {
      while (pagoIdx < pagos.length && pagos[pagoIdx].fecha <= (r.fecha || '')) {
        pool += pagos[pagoIdx].monto;
        pagoIdx++;
      }
      const depositado = r.monto_depositado || 0;
      const imputado = Math.min(depositado, pool);
      const deCajaComun = Math.max(0, depositado - pool);
      pool -= imputado;
      return { ...r, monto_recaudado_calculado: imputado, deCajaComunCalculado: deCajaComun, disponibleRestante: pool };
    });

    const totalDepositado = calculadas.reduce((s, r) => s + (r.monto_depositado || 0), 0);
    const totalImputado = calculadas.reduce((s, r) => s + r.monto_recaudado_calculado, 0);
    const totalDeCajaComun = calculadas.reduce((s, r) => s + r.deCajaComunCalculado, 0);
    const saldoADepositar = Math.max(0, totalExigidoSA - totalDepositado);

    return {
      rendicionesCalculadas: calculadas,
      resumen: {
        totalExigidoSA,
        totalRecaudadoFamilias,
        totalDepositado,
        totalImputado,
        totalDeCajaComun,
        disponibleFinal: pool,
        saldoADepositar,
      },
    };
  }, [rendiciones, afiliaciones, anio]);

  if (isLoading || rendicionesCalculadas.length === 0) return null;

  const s = resumen;
  const yaRecuperado = recuperos
    .filter(r => (r.fecha || '').startsWith(String(anio)))
    .reduce((sum, r) => sum + (r.monto || 0), 0);
  const pendienteRecupero = Math.max(0, s.disponibleFinal - yaRecuperado);

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
          <p className="text-[10px] text-muted-foreground leading-tight">Imputado a depósitos</p>
          <p className="text-sm font-bold text-green-600">{formatMoney(s.totalImputado)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">De caja común</p>
          <p className="text-sm font-bold text-amber-600">{formatMoney(s.totalDeCajaComun)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">Disponible próx. depósito</p>
          <p className={cn('text-sm font-bold', s.disponibleFinal > 0 ? 'text-green-600' : 'text-muted-foreground')}>
            {s.disponibleFinal > 0 ? formatMoney(s.disponibleFinal) : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">Saldo a depositar</p>
          <p className="text-sm font-bold text-orange-600">{formatMoney(s.saldoADepositar)}</p>
        </div>
      </div>

      {/* Recuperos en caja */}
      {s.totalDeCajaComun > 0 && (
        <div className="flex items-center justify-between gap-3 p-4 bg-amber-50 border-b">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span className="font-medium text-amber-800">Recuperos en caja</span>
            </div>
            <span className="text-muted-foreground">
              De caja común: <span className="font-semibold text-amber-700">{formatMoney(s.totalDeCajaComun)}</span>
            </span>
            <span className="text-muted-foreground">
              Disponible: <span className="font-semibold text-green-600">{formatMoney(s.disponibleFinal)}</span>
            </span>
            <span className="text-muted-foreground">
              Ya recuperado: <span className="font-semibold text-blue-600">{formatMoney(yaRecuperado)}</span>
            </span>
            <span className="text-muted-foreground">
              Pendiente: <span className="font-semibold text-amber-600">{formatMoney(pendienteRecupero)}</span>
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setShowRecuperoDialog(true)}
            disabled={pendienteRecupero <= 0}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Registrar recupero
          </Button>
        </div>
      )}

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
              <TableCell className="text-right text-green-600">{formatMoney(r.monto_recaudado_calculado || 0)}</TableCell>
              <TableCell className="text-right">
                {r.deCajaComunCalculado > 0
                  ? <span className="text-amber-600 font-medium">{formatMoney(r.deCajaComunCalculado)}</span>
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right">
                {r.disponibleRestante > 0
                  ? <span className="text-green-600 font-medium flex items-center justify-end gap-0.5">
                      <TrendingUp className="w-3 h-3" />{formatMoney(r.disponibleRestante)}
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

      <RegistrarRecuperoDialog
        open={showRecuperoDialog}
        onClose={() => setShowRecuperoDialog(false)}
        anio={anio}
        disponible={s.disponibleFinal}
        yaRecuperado={yaRecuperado}
      />
    </Card>
  );
}