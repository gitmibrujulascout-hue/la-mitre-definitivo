import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Landmark, Loader2, AlertCircle } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RegistrarRendicionDialog({ open, onClose, anio, totalExigidoSA }) {
  const queryClient = useQueryClient();

  const { data: rendiciones = [] } = useQuery({
    queryKey: ['rendiciones-afiliacion'],
    queryFn: () => base44.entities.RendicionAfiliacion.list('-fecha', 50),
  });

  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  const totalDepositadoSA = useMemo(
    () => rendiciones.filter(r => Number(r.anio) === Number(anio)).reduce((s, r) => s + (r.monto_depositado || 0), 0),
    [rendiciones, anio]
  );

  // Recaudado real de familias (entró a caja directamente al pagar)
  const totalRecaudadoFamilias = useMemo(
    () => afiliaciones
      .filter(a => Number(a.anio) === Number(anio) && !a.es_primera_vez)
      .reduce((s, a) => s + Math.max(0, (a.monto_pagado || 0) - (a.monto_pagado_credito || 0)), 0),
    [afiliaciones, anio]
  );

  const [fechaDeposito, setFechaDeposito] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const [montoDepositado, setMontoDepositado] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [file, setFile] = useState(null);

  const depositadoNum = parseFloat(montoDepositado) || 0;
  const saldoEnCaja = totalRecaudadoFamilias - totalDepositadoSA;
  const saldoADepositar = Math.max(0, (totalExigidoSA || 0) - totalDepositadoSA);

  const rendirMutation = useMutation({
    mutationFn: async () => {
      let archivo_url = '';
      if (file) {
        const res = await base44.integrations.Core.UploadFile({ file });
        archivo_url = res.file_url;
      }
      const rendicion = await base44.entities.RendicionAfiliacion.create({
        anio: Number(anio),
        fecha: fechaDeposito,
        monto_depositado: depositadoNum,
        monto_recaudado: 0,
        monto_faltante: 0,
        comprobante,
        archivo_url,
      });
      // Egreso de caja: depósito a Scout Argentina
      await base44.entities.MovimientoBanco.create({
        fecha: fechaDeposito, tipo: 'Egreso', cuenta: 'Caja', origen: 'Afiliación',
        concepto: `Depósito Scout Argentina — afiliaciones ${anio}`,
        monto: depositadoNum, referencia_id: rendicion.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rendiciones-afiliacion'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Depósito registrado en caja');
      onClose();
    }
  });

  const canConfirm = depositadoNum > 0 && !!fechaDeposito && !rendirMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Rendir a Scout Argentina — {anio}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>El dinero de las familias ya entró a caja al registrar cada pago. Acá solo registrás la salida del depósito a Scout Argentina.</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-200 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">SA exige</p>
              <p className="text-sm font-bold text-cyan-700">{formatMoney(totalExigidoSA || 0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50 border border-green-200 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">Recaudado familias</p>
              <p className="text-sm font-bold text-green-700">{formatMoney(totalRecaudadoFamilias)}</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">Saldo por depositar</p>
              <p className="text-sm font-bold text-orange-700">{formatMoney(saldoADepositar)}</p>
            </div>
          </div>

          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-xs">Fecha de depósito</Label>
              <Input type="date" value={fechaDeposito} onChange={e => setFechaDeposito(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Monto depositado a SA *</Label>
              <Input type="number" value={montoDepositado} onChange={e => setMontoDepositado(e.target.value)} placeholder="Ingresá el monto real depositado" />
              <p className="text-xs text-muted-foreground mt-1">
                Ya depositado: {formatMoney(totalDepositadoSA)} · En caja de familias: {formatMoney(saldoEnCaja)}
              </p>
            </div>
            <div>
              <Label className="text-xs">N° comprobante (opcional)</Label>
              <Input value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="Ej: depósito Macro" />
            </div>
            <div>
              <Label className="text-xs">Comprobante (PDF) — opcional</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} />
              {file && <p className="text-xs text-green-600 mt-1">{file.name}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => rendirMutation.mutate()} disabled={!canConfirm}>
            {rendirMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</>
              : <>Dar salida · {formatMoney(depositadoNum)}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}