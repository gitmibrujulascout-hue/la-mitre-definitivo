import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Landmark, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function RegistrarRendicionDialog({ open, onClose, afiliaciones, anio }) {
  const queryClient = useQueryClient();
  const [fechaDeposito, setFechaDeposito] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const [comprobante, setComprobante] = useState('');
  const [seleccionados, setSeleccionados] = useState(new Set());

  const pendientes = useMemo(
    () => afiliaciones
      .filter(a => Number(a.anio) === Number(anio) && !a.es_primera_vez && (a.monto_pagado || 0) > 0 && !a.rendido)
      .sort((a, b) => (a.beneficiario_nombre || '').localeCompare(b.beneficiario_nombre || '')),
    [afiliaciones, anio]
  );

  // Al abrir: seleccionar todos los pendientes por defecto
  useEffect(() => {
    if (open) setSeleccionados(new Set(pendientes.map(a => a.id)));
  }, [open, pendientes]);

  const total = useMemo(
    () => pendientes.filter(a => seleccionados.has(a.id)).reduce((s, a) => s + (a.monto_pagado || 0), 0),
    [pendientes, seleccionados]
  );

  const rendirMutation = useMutation({
    mutationFn: async () => {
      const ids = pendientes.filter(a => seleccionados.has(a.id)).map(a => a.id);
      const conceptoIng = `Afiliaciones recaudadas — ${ids.length} afiliados ${anio}`;
      const conceptoEgr = `Depósito Scout Argentina — rendición afiliaciones ${anio}${comprobante ? ` (comp. ${comprobante})` : ''}`;
      // Ingreso en caja: el efectivo cobrado a las familias
      await base44.entities.MovimientoBanco.create({
        fecha: fechaDeposito, tipo: 'Ingreso', cuenta: 'Caja', origen: 'Afiliación',
        concepto: conceptoIng, monto: total,
      });
      // Egreso en caja: depósito directo a la cuenta de Scout Argentina
      await base44.entities.MovimientoBanco.create({
        fecha: fechaDeposito, tipo: 'Egreso', cuenta: 'Caja', origen: 'Afiliación',
        concepto: conceptoEgr, monto: total,
      });
      // Marcar afiliaciones como rendidas
      await base44.entities.Afiliacion.bulkUpdate(
        ids.map(id => ({ id, rendido: true, fecha_rendicion: fechaDeposito }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['afiliaciones'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success(`Rendición registrada: ${formatMoney(total)} depositados a Scout Argentina`);
      onClose();
    }
  });

  const toggle = (id) => setSeleccionados(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleTodos = () => {
    if (seleccionados.size === pendientes.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(pendientes.map(a => a.id)));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Rendir afiliaciones a Scout Argentina — {anio}
          </DialogTitle>
        </DialogHeader>

        {pendientes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Landmark className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            No hay afiliaciones cobradas pendientes de rendir.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Se registran dos movimientos en <strong>Caja</strong>: un ingreso (efectivo cobrado a las familias) y un egreso (depósito a Scout Argentina). Saldo neto cero — la plata pasa de la mano del tesorero directo al banco de la Asociación.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
              <div>
                <Label className="text-xs">Fecha de depósito</Label>
                <Input type="date" value={fechaDeposito} onChange={e => setFechaDeposito(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">N° comprobante (opcional)</Label>
                <Input value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="Ej: depósito Macro" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                Afiliaciones a rendir ({pendientes.length})
              </h3>
              <button onClick={toggleTodos} className="text-xs text-primary hover:underline">
                {seleccionados.size === pendientes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead className="w-32">Rama</TableHead>
                    <TableHead className="w-36 text-right">Cobrado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientes.map(a => {
                    const sel = seleccionados.has(a.id);
                    return (
                      <TableRow key={a.id} className={!sel ? 'opacity-40' : ''}>
                        <TableCell>
                          <Checkbox checked={sel} onCheckedChange={() => toggle(a.id)} />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{a.beneficiario_nombre || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.rama || '—'}</Badge></TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{formatMoney(a.monto_pagado)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2 text-green-700"><ArrowUpRight className="w-4 h-4" /> Ingreso caja: <strong>{formatMoney(total)}</strong></div>
                <div className="flex items-center gap-2 text-red-700"><ArrowDownLeft className="w-4 h-4" /> Depósito Scout Arg.: <strong>{formatMoney(total)}</strong></div>
              </div>
              <p className="text-sm text-muted-foreground sm:text-right">
                {seleccionados.size} afiliaciones · Saldo neto: <strong className="text-foreground">{formatMoney(0)}</strong>
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => rendirMutation.mutate()}
            disabled={rendirMutation.isPending || pendientes.length === 0 || seleccionados.size === 0 || !fechaDeposito}
          >
            {rendirMutation.isPending ? 'Registrando...' : `Rendir ${formatMoney(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}