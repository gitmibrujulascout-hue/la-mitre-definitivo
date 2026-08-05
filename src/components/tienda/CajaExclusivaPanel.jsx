import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Wallet, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Panel de la caja exclusiva de la tienda.
 * Lee los movimientos de MovimientoBanco con cuenta='Caja exclusiva'
 * (ingresos por señas/ventas + egresos a proveedores + transferencias).
 */
export default function CajaExclusivaPanel() {
  const [showEgreso, setShowEgreso] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos_caja_exclusiva'],
    queryFn: () => base44.entities.MovimientoBanco.filter({ cuenta: 'Caja exclusiva' }, '-fecha', 500),
  });

  const ingresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const egresos = movimientos.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + (m.monto || 0), 0);
  const saldo = ingresos - egresos;
  const recientes = movimientos.slice(0, 8);

  return (
    <>
      <Card className="border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-purple-800">Caja exclusiva de la tienda</h4>
                <p className="text-xs text-purple-600">Fondo separado — no impacta en caja/banco general</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-purple-700 border-purple-300 hover:bg-purple-50 h-8" onClick={() => setShowEgreso(true)}>
                <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />Egreso
              </Button>
              <Button variant="outline" size="sm" className="text-purple-700 border-purple-300 hover:bg-purple-50 h-8" onClick={() => setShowTransfer(true)}>
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />Transferir a caja
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="font-bold text-sm text-green-700">{formatMoney(ingresos)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Egresos</p>
              <p className="font-bold text-sm text-red-600">{formatMoney(egresos)}</p>
            </div>
            <div className={cn('rounded-lg p-2 text-center border-2', saldo >= 0 ? 'bg-purple-50 border-purple-300' : 'bg-red-50 border-red-300')}>
              <p className="text-xs text-muted-foreground">Saldo neto</p>
              <p className={cn('font-bold text-sm', saldo >= 0 ? 'text-purple-700' : 'text-red-600')}>{formatMoney(saldo)}</p>
            </div>
          </div>

          {recientes.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {recientes.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-md bg-muted/40">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.tipo === 'Ingreso'
                      ? <ArrowUpRight className="w-3 h-3 text-green-600 shrink-0" />
                      : <ArrowDownLeft className="w-3 h-3 text-red-500 shrink-0" />}
                    <span className="text-muted-foreground whitespace-nowrap">{m.fecha}</span>
                    <span className="truncate">{m.concepto}</span>
                  </div>
                  <span className={cn('font-semibold whitespace-nowrap', m.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-500')}>
                    {m.tipo === 'Egreso' ? '−' : '+'}{formatMoney(m.monto)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">Sin movimientos todavía.</p>
          )}
        </CardContent>
      </Card>

      {showEgreso && <EgresoDialog onClose={() => setShowEgreso(false)} />}
      {showTransfer && <TransferDialog saldoActual={saldo} onClose={() => setShowTransfer(false)} />}
    </>
  );
}

function EgresoDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ concepto: '', monto: '', fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }) });

  const mut = useMutation({
    mutationFn: data => base44.entities.MovimientoBanco.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Egreso registrado');
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-purple-600" /> Egreso de caja exclusiva
          </DialogTitle>
          <DialogDescription>Pago a proveedor o gasto de la tienda.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-1.5 block">Concepto *</Label>
            <Input value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} placeholder="Ej: Pago a proveedor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Monto *</Label>
              <Input type="number" min="0" step="0.01" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!form.concepto || !form.monto || parseFloat(form.monto) <= 0}
            onClick={() => mut.mutate({
              ...form,
              monto: parseFloat(form.monto),
              tipo: 'Egreso',
              cuenta: 'Caja exclusiva',
              origen: 'Manual',
            })}
          >
            Registrar egreso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({ saldoActual, onClose }) {
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState('');
  const [destino, setDestino] = useState('Caja');
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));

  const mut = useMutation({
    mutationFn: async () => {
      const m = parseFloat(monto);
      // Egreso de la caja exclusiva
      await base44.entities.MovimientoBanco.create({
        fecha, tipo: 'Egreso', cuenta: 'Caja exclusiva', origen: 'Manual',
        concepto: `Transferencia a ${destino} (caja exclusiva tienda)`, monto: m,
      });
      // Ingreso en la caja/banco general
      await base44.entities.MovimientoBanco.create({
        fecha, tipo: 'Ingreso', cuenta: destino, origen: 'Manual',
        concepto: 'Transferencia desde caja exclusiva tienda', monto: m,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Transferencia realizada');
      onClose();
    },
  });

  const montoNum = parseFloat(monto) || 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-purple-600" /> Transferir a caja general
          </DialogTitle>
          <DialogDescription>Mueve dinero de la caja exclusiva hacia la caja o banco general.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-2 text-sm flex justify-between">
            <span className="text-muted-foreground">Saldo disponible</span>
            <span className="font-bold text-purple-700">{formatMoney(saldoActual)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Monto *</Label>
              <Input type="number" min="0" step="0.01" max={saldoActual} value={monto} onChange={e => setMonto(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Destino</Label>
              <div className="flex gap-2">
                {['Caja', 'Banco'].map(d => (
                  <Button key={d} type="button" variant={destino === d ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setDestino(d)}>{d}</Button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Fecha</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={montoNum <= 0 || montoNum > saldoActual} onClick={() => mut.mutate()}>
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}