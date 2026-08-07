import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Landmark, Loader2, AlertCircle } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RegistrarRendicionDialog({ open, onClose, afiliaciones, anio }) {
  const queryClient = useQueryClient();

  // Afiliados a cubrir: no bonificada (es_primera_vez) y no rendida aún.
  // El depósito a SA cubre a TODOS los del padrón, paguen o no la familia.
  const pendientesCubrir = useMemo(
    () => afiliaciones
      .filter(a => Number(a.anio) === Number(anio) && !a.es_primera_vez && !a.rendido)
      .sort((a, b) => (a.beneficiario_nombre || '').localeCompare(b.beneficiario_nombre || '')),
    [afiliaciones, anio]
  );

  const [fechaDeposito, setFechaDeposito] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const [comprobante, setComprobante] = useState('');
  // Default: lo que SA exige por todos los pendientes (suma de monto)
  const [montoDepositado, setMontoDepositado] = useState(() =>
    pendientesCubrir.reduce((s, a) => s + (a.monto || 0), 0).toString()
  );
  const [file, setFile] = useState(null);
  const [seleccionados, setSeleccionados] = useState(() => new Set(pendientesCubrir.map(a => a.id)));

  const totalRecaudado = useMemo(
    () => pendientesCubrir.filter(a => seleccionados.has(a.id)).reduce((s, a) => s + (a.monto_pagado || 0), 0),
    [pendientesCubrir, seleccionados]
  );
  const depositadoNum = parseFloat(montoDepositado) || 0;
  const faltante = depositadoNum - totalRecaudado;

  const rendirMutation = useMutation({
    mutationFn: async () => {
      const ids = pendientesCubrir.filter(a => seleccionados.has(a.id)).map(a => a.id);
      const count = ids.length;
      // Subir comprobante (PDF) si hay archivo
      let archivo_url = '';
      if (file) {
        const res = await base44.integrations.Core.UploadFile({ file });
        archivo_url = res.file_url;
      }
      // Registro de la rendición
      const rendicion = await base44.entities.RendicionAfiliacion.create({
        anio: Number(anio),
        fecha: fechaDeposito,
        monto_depositado: depositadoNum,
        monto_recaudado: totalRecaudado,
        monto_faltante: Math.max(0, faltante),
        comprobante,
        archivo_url,
        cantidad_afiliados: count,
        afiliaciones_ids: ids,
      });
      // Egreso en caja: depósito a SA (el total que SA exige)
      await base44.entities.MovimientoBanco.create({
        fecha: fechaDeposito, tipo: 'Egreso', cuenta: 'Caja', origen: 'Afiliación',
        concepto: `Depósito Scout Argentina — rendición afiliaciones ${anio} (${count} afiliados)`,
        monto: depositadoNum, referencia_id: rendicion.id,
      });
      // Ingreso en caja: efectivo recaudado de las familias (si hubo)
      if (totalRecaudado > 0) {
        await base44.entities.MovimientoBanco.create({
          fecha: fechaDeposito, tipo: 'Ingreso', cuenta: 'Caja', origen: 'Afiliación',
          concepto: `Afiliaciones recaudadas — rendición ${anio} (${count} afiliados)`,
          monto: totalRecaudado, referencia_id: rendicion.id,
        });
      }
      // Marcar afiliaciones como rendidas (pagadas a SA)
      await base44.entities.Afiliacion.bulkUpdate(
        ids.map(id => ({ id, rendido: true, fecha_rendicion: fechaDeposito }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['afiliaciones'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['rendiciones-afiliacion'] });
      toast.success('Rendición registrada y comprobante guardado');
      onClose();
    }
  });

  const toggle = (id) => setSeleccionados(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleTodos = () => {
    if (seleccionados.size === pendientesCubrir.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(pendientesCubrir.map(a => a.id)));
  };

  const canConfirm = seleccionados.size > 0 && depositadoNum > 0 && !!fechaDeposito && !rendirMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Rendir afiliaciones a Scout Argentina — {anio}
          </DialogTitle>
        </DialogHeader>

        {pendientesCubrir.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Landmark className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            Todas las afiliaciones de {anio} ya fueron rendidas a Scout Argentina.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Scout Argentina cobra por <strong>todos</strong> los afiliados del padrón, aunque la familia no haya abonado. Depositás el monto que SA exige; si lo recaudado no alcanza, la diferencia sale de la caja común y se recupera cuando las familias paguen.</span>
            </div>

            {/* Config del depósito */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
              <div>
                <Label className="text-xs">Fecha de depósito</Label>
                <Input type="date" value={fechaDeposito} onChange={e => setFechaDeposito(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Monto depositado a SA *</Label>
                <Input type="number" value={montoDepositado} onChange={e => setMontoDepositado(e.target.value)} placeholder="Total que SA exige" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">N° comprobante (opcional)</Label>
                <Input value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="Ej: depósito Macro" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Comprobante (PDF) — opcional</Label>
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} />
                {file && <p className="text-xs text-green-600 mt-1">{file.name}</p>}
              </div>
            </div>

            {/* Resumen financiero */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-green-50 border border-green-200 text-center">
                <p className="text-xs text-muted-foreground">Recaudado</p>
                <p className="text-sm font-bold text-green-700">{formatMoney(totalRecaudado)}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-center">
                <p className="text-xs text-muted-foreground">A depositar</p>
                <p className="text-sm font-bold text-red-700">{formatMoney(depositadoNum)}</p>
              </div>
              <div className={cn('p-2 rounded-lg border text-center', faltante > 0 ? 'bg-amber-50 border-amber-300' : 'bg-muted/30 border-border')}>
                <p className="text-xs text-muted-foreground">Faltante (caja común)</p>
                <p className={cn('text-sm font-bold', faltante > 0 ? 'text-amber-700' : 'text-muted-foreground')}>
                  {formatMoney(Math.max(0, faltante))}
                </p>
              </div>
            </div>

            {/* Lista de afiliados a cubrir */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Afiliados a cubrir ({pendientesCubrir.length})</h3>
              <button onClick={toggleTodos} className="text-xs text-primary hover:underline">
                {seleccionados.size === pendientesCubrir.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="border rounded-lg overflow-hidden max-h-[35vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead className="w-28">Rama</TableHead>
                    <TableHead className="w-28 text-right">Seguro</TableHead>
                    <TableHead className="w-28 text-right">Cobrado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientesCubrir.map(a => {
                    const sel = seleccionados.has(a.id);
                    return (
                      <TableRow key={a.id} className={!sel ? 'opacity-40' : ''}>
                        <TableCell><Checkbox checked={sel} onCheckedChange={() => toggle(a.id)} /></TableCell>
                        <TableCell className="font-medium text-sm">{a.beneficiario_nombre || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.rama || '—'}</Badge></TableCell>
                        <TableCell className="text-right text-sm">{formatMoney(a.monto)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-green-600">{formatMoney(a.monto_pagado || 0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => rendirMutation.mutate()} disabled={!canConfirm}>
            {rendirMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</>
              : `Rendir ${formatMoney(depositadoNum)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}