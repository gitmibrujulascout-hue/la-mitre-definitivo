import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Landmark, Loader2, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RegistrarRendicionDialog({ open, onClose, afiliaciones, anio }) {
  const queryClient = useQueryClient();

  const { data: rendiciones = [] } = useQuery({
    queryKey: ['rendiciones-afiliacion'],
    queryFn: () => base44.entities.RendicionAfiliacion.list('-fecha', 50),
  });

  // Total que SA exige (suma de monto de los no bonificada del año)
  const totalExigidoSA = useMemo(
    () => afiliaciones
      .filter(a => Number(a.anio) === Number(anio) && !a.es_primera_vez)
      .reduce((s, a) => s + (a.monto || 0), 0),
    [afiliaciones, anio]
  );

  // Total recaudado en EFECTIVO de familias (acumulado, no bonificada).
  // Se excluye la parte pagada con crédito, que ya volvió a caja por el pago de crédito.
  const totalRecaudadoAcumulado = useMemo(
    () => afiliaciones
      .filter(a => Number(a.anio) === Number(anio) && !a.es_primera_vez)
      .reduce((s, a) => s + Math.max(0, (a.monto_pagado || 0) - (a.monto_pagado_credito || 0)), 0),
    [afiliaciones, anio]
  );

  // Ya ingresado en rendiciones anteriores este año
  const yaIngresado = useMemo(
    () => rendiciones
      .filter(r => Number(r.anio) === Number(anio))
      .reduce((s, r) => s + (r.monto_recaudado || 0), 0),
    [rendiciones, anio]
  );

  // Nuevo efectivo a ingresar en esta rendición (lo recaudado desde la última rendición)
  const recaudadoEstaRendicion = Math.max(0, totalRecaudadoAcumulado - yaIngresado);

  const [fechaDeposito, setFechaDeposito] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const [montoDepositado, setMontoDepositado] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [file, setFile] = useState(null);

  const depositadoNum = parseFloat(montoDepositado) || 0;
  const faltante = Math.max(0, depositadoNum - recaudadoEstaRendicion);

  const rendirMutation = useMutation({
    mutationFn: async () => {
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
        monto_recaudado: recaudadoEstaRendicion,
        monto_faltante: faltante,
        comprobante,
        archivo_url,
      });
      // Egreso en caja: depósito a SA (el total que SA exige)
      await base44.entities.MovimientoBanco.create({
        fecha: fechaDeposito, tipo: 'Egreso', cuenta: 'Caja', origen: 'Afiliación',
        concepto: `Depósito Scout Argentina — rendición afiliaciones ${anio}`,
        monto: depositadoNum, referencia_id: rendicion.id,
      });
      // Ingreso en caja: nuevo efectivo recaudado de las familias (si hubo)
      if (recaudadoEstaRendicion > 0) {
        await base44.entities.MovimientoBanco.create({
          fecha: fechaDeposito, tipo: 'Ingreso', cuenta: 'Caja', origen: 'Afiliación',
          concepto: `Afiliaciones recaudadas — rendición ${anio}`,
          monto: recaudadoEstaRendicion, referencia_id: rendicion.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rendiciones-afiliacion'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Rendición registrada y comprobante guardado');
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
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Scout Argentina cobra por todos los afiliados del padrón. Depositás el monto que SA exige; lo recaudado en efectivo ingresa a caja y la diferencia sale de la caja común. La parte pagada con crédito ya volvió a caja. Los morosos se recuperan por separado.</span>
          </div>

          {/* Config del depósito */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-xs">Fecha de depósito</Label>
              <Input type="date" value={fechaDeposito} onChange={e => setFechaDeposito(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Monto depositado a SA *</Label>
              <Input type="number" value={montoDepositado} onChange={e => setMontoDepositado(e.target.value)} placeholder="Ingresá el monto real depositado" />
              <p className="text-xs text-muted-foreground mt-1">SA exige: {formatMoney(totalExigidoSA)} · Recaudado disponible: {formatMoney(recaudadoEstaRendicion)}</p>
              <p className="text-xs text-amber-600 mt-0.5">⚠ Ingresá el monto que realmente depositaste, no el que SA exige.</p>
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

          {/* Resumen financiero */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-green-50 border border-green-200 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">A ingresar (efectivo)</p>
              <p className="text-sm font-bold text-green-700">{formatMoney(recaudadoEstaRendicion)}</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">A depositar (SA)</p>
              <p className="text-sm font-bold text-red-700">{formatMoney(depositadoNum)}</p>
            </div>
            <div className={cn('p-2 rounded-lg border text-center', faltante > 0 ? 'bg-amber-50 border-amber-300' : 'bg-muted/30 border-border')}>
              <p className="text-[10px] text-muted-foreground leading-tight">De caja común</p>
              <p className={cn('text-sm font-bold', faltante > 0 ? 'text-amber-700' : 'text-muted-foreground')}>{formatMoney(faltante)}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Recaudado en efectivo: {formatMoney(totalRecaudadoAcumulado)} · Ya ingresado en rendiciones anteriores: {formatMoney(yaIngresado)}
          </p>
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