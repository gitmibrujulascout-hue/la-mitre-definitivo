import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, RotateCcw } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function RegistrarRecuperoDialog({ open, onClose, anio, disponible, yaRecuperado }) {
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const [formaPago, setFormaPago] = useState('Efectivo');

  const cuenta = formaPago === 'Efectivo' ? 'Caja' : 'Banco';
  const pendiente = Math.max(0, disponible - yaRecuperado);

  const recuperoMutation = useMutation({
    mutationFn: async () => {
      const montoNum = parseFloat(monto) || 0;
      await base44.entities.MovimientoBanco.create({
        fecha,
        tipo: 'Ingreso',
        cuenta,
        origen: 'Recupero afiliación',
        concepto: `Recupero afiliaciones — saldo posterior a depósitos ${anio}`,
        monto: montoNum,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['recuperos-afiliacion'] });
      toast.success('Recupero registrado en caja');
      setMonto('');
      onClose();
    }
  });

  const montoNum = parseFloat(monto) || 0;
  const canConfirm = montoNum > 0 && !!fecha && !recuperoMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            Recupero de afiliaciones — {anio}
          </DialogTitle>
          <DialogDescription>
            Registrá los pagos de afiliaciones recibidos después de los depósitos a SA, para compensar el aporte de caja común.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground">Disponible</p>
              <p className="text-sm font-bold text-green-600">{formatMoney(disponible)}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground">Ya recuperado</p>
              <p className="text-sm font-bold text-blue-600">{formatMoney(yaRecuperado)}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground">Pendiente</p>
              <p className="text-sm font-bold text-amber-600">{formatMoney(pendiente)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto a recuperar</Label>
              <Input
                type="number"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0"
                max={pendiente}
              />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Forma de pago</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efectivo">Efectivo (Caja)</SelectItem>
                <SelectItem value="Transferencia">Transferencia (Banco)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {montoNum > pendiente && (
            <p className="text-xs text-amber-600">
              El monto supera lo pendiente de recuperar ({formatMoney(pendiente)}).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!canConfirm} onClick={() => recuperoMutation.mutate()}>
            <Landmark className="w-4 h-4" /> Registrar recupero
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}