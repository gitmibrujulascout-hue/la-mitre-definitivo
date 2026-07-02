import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { MESES, MESES_SIN_CUOTA, CUOTA_EFECTIVO, formatMoney, getCuotaBeneficiario, marzoEsBonificado } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AplicarCreditoDialog({ credito, beneficiarioId, beneficiarioNombre, beneficiario, campamentos, todosLosBeneficiarios, pagos, anio, afiliacion, esPrimeraVezAfiliacion, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState('Cuota');
  const [meses, setMeses] = useState([]);
  const [campamentoId, setCampamentoId] = useState('');
  const [montoCredito, setMontoCredito] = useState(credito.monto_disponible.toString());
  const [diferenciaEfectivo, setDiferenciaEfectivo] = useState('');

  // Meses ya pagados este año
  const mesesYaPagados = useMemo(() => {
    if (!beneficiarioId || !anio) return [];
    return pagos
      .filter(p => p.beneficiario_id === beneficiarioId && p.anio === anio && p.tipo_pago === 'Cuota')
      .flatMap(p => p.meses || (p.mes ? [p.mes] : []));
  }, [beneficiarioId, anio, pagos]);

  // Meses que no generan cuota
  const marzoGratis = marzoEsBonificado(afiliacion, esPrimeraVezAfiliacion);
  const mesesNoCobrar = useMemo(() => {
    const no = [...MESES_SIN_CUOTA];
    if (marzoGratis) no.push('Marzo');
    return no;
  }, [marzoGratis]);

  // Cuota unitaria del beneficiario (con descuento familiar si aplica)
  const cuotaUnitaria = useMemo(() => {
    if (!beneficiario) return CUOTA_EFECTIVO;
    return getCuotaBeneficiario(beneficiario, todosLosBeneficiarios);
  }, [beneficiario, todosLosBeneficiarios]);

  // Auto-seleccionar primer mes adeudado
  useEffect(() => {
    if (tipo !== 'Cuota') return;
    const primer = MESES.find(m => !mesesYaPagados.includes(m) && !mesesNoCobrar.includes(m));
    setMeses(primer ? [primer] : []);
  }, [tipo, mesesYaPagados.length, mesesNoCobrar.length]);

  const cuotaTotal = meses.length * cuotaUnitaria;

  // Auto-ajustar montos cuando cambian los meses seleccionados
  useEffect(() => {
    if (tipo !== 'Cuota' || cuotaTotal === 0) return;
    const credAuto = Math.min(credito.monto_disponible, cuotaTotal);
    setMontoCredito(credAuto.toString());
    const dif = cuotaTotal - credAuto;
    setDiferenciaEfectivo(dif > 0 ? dif.toString() : '');
  }, [meses.length, cuotaUnitaria, tipo, cuotaTotal, credito.monto_disponible]);

  const creditoNum = Math.min(parseFloat(montoCredito) || 0, credito.monto_disponible);
  const diferenciaNum = parseFloat(diferenciaEfectivo) || 0;
  const totalAPagar = creditoNum + diferenciaNum;
  const falta = cuotaTotal - totalAPagar;
  const cubreCompleto = tipo === 'Cuota' && Math.abs(falta) < 1;

  const handleMontoCreditoChange = (val) => {
    setMontoCredito(val);
    const cred = parseFloat(val) || 0;
    const dif = cuotaTotal - cred;
    setDiferenciaEfectivo(dif > 0 ? dif.toString() : '');
  };

  const handleTipoChange = (v) => {
    setTipo(v);
    setMeses([]);
    setCampamentoId('');
    setMontoCredito(credito.monto_disponible.toString());
    setDiferenciaEfectivo('');
  };

  const toggleMes = (mes) => {
    if (mesesYaPagados.includes(mes) || mesesNoCobrar.includes(mes)) return;
    setMeses(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const campamento = campamentos.find(c => c.id === campamentoId);
      const fechaPago = new Date().toISOString().split('T')[0];

      if (tipo === 'Cuota') {
        // Pago con crédito
        await base44.entities.Pago.create({
          beneficiario_id: beneficiarioId,
          beneficiario_nombre: beneficiarioNombre,
          tipo_pago: 'Cuota',
          meses,
          mes: meses[0],
          anio,
          forma_pago: 'Crédito actividad',
          destino: 'Caja',
          monto: creditoNum,
          fecha_pago: fechaPago,
          observaciones: `Crédito aplicado de: ${credito.actividad_nombre}`,
        });
        // Diferencia en efectivo
        if (diferenciaNum > 0) {
          await base44.entities.Pago.create({
            beneficiario_id: beneficiarioId,
            beneficiario_nombre: beneficiarioNombre,
            tipo_pago: 'Cuota',
            meses,
            mes: meses[0],
            anio,
            forma_pago: 'Efectivo',
            destino: 'Caja',
            monto: diferenciaNum,
            fecha_pago: fechaPago,
            observaciones: `Diferencia en efectivo (complementa crédito de: ${credito.actividad_nombre})`,
          });
        }
      } else {
        await base44.entities.Pago.create({
          beneficiario_id: beneficiarioId,
          beneficiario_nombre: beneficiarioNombre,
          tipo_pago: 'Campamento',
          anio,
          campamento_id: campamentoId,
          campamento_nombre: campamento?.nombre,
          forma_pago: 'Crédito actividad',
          destino: 'Caja',
          monto: creditoNum,
          fecha_pago: fechaPago,
          observaciones: `Crédito aplicado de: ${credito.actividad_nombre}`,
        });
      }
      // Descontar crédito (re-fetch para evitar estado stale)
      const credFresh = await base44.entities.CreditoBeneficiario.get(credito.id);
      await base44.entities.CreditoBeneficiario.update(credito.id, {
        monto_disponible: Math.max(0, credFresh.monto_disponible - creditoNum),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
      toast.success('Crédito aplicado correctamente');
      onSaved();
    },
  });

  const canSave = tipo === 'Cuota'
    ? meses.length > 0 && cubreCompleto && creditoNum > 0
    : !!campamentoId && creditoNum > 0 && creditoNum <= credito.monto_disponible;

  const hayMesesAdeudados = MESES.some(m => !mesesYaPagados.includes(m) && !mesesNoCobrar.includes(m));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar crédito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Crédito disponible de "{credito.actividad_nombre}"</p>
            <p className="text-2xl font-bold text-primary">{formatMoney(credito.monto_disponible)}</p>
          </div>

          <div>
            <Label>Aplicar a</Label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cuota">Cuotas mensuales</SelectItem>
                <SelectItem value="Campamento">Campamento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === 'Cuota' && (
            <>
              <div>
                <Label className="mb-2 block">Meses a acreditar — {meses.length} seleccionado(s)</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {MESES.map(mes => {
                    const yaPagado = mesesYaPagados.includes(mes);
                    const noCobra = mesesNoCobrar.includes(mes);
                    const seleccionado = meses.includes(mes);
                    return (
                      <button
                        key={mes}
                        type="button"
                        disabled={yaPagado || noCobra}
                        onClick={() => toggleMes(mes)}
                        className={cn(
                          'text-xs py-1.5 px-2 rounded border transition-all',
                          noCobra ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' :
                          yaPagado ? 'bg-green-50 border-green-200 text-green-600 opacity-60 cursor-not-allowed' :
                          seleccionado ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground'
                        )}
                      >
                        {mes.substring(0, 3)}
                        {noCobra ? ' —' : yaPagado ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
                {!hayMesesAdeudados && (
                  <p className="text-xs text-muted-foreground mt-2">No hay meses adeudados para este beneficiario.</p>
                )}
              </div>

              {meses.length > 0 && (
                <>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cuota ({meses.length} mes):</span>
                      <span className="font-medium">{formatMoney(cuotaTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Crédito a aplicar:</span>
                      <span className="font-medium text-primary">{formatMoney(creditoNum)}</span>
                    </div>
                    {diferenciaNum > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Diferencia en efectivo:</span>
                        <span className="font-medium text-orange-600">{formatMoney(diferenciaNum)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1">
                      <span className="font-semibold">Total a cancelar:</span>
                      <span className={cn('font-bold', cubreCompleto ? 'text-green-600' : 'text-red-500')}>
                        {formatMoney(totalAPagar)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label>Monto de crédito a aplicar</Label>
                    <Input
                      type="number"
                      value={montoCredito}
                      onChange={e => handleMontoCreditoChange(e.target.value)}
                      max={credito.monto_disponible}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Máximo disponible: {formatMoney(credito.monto_disponible)}</p>
                  </div>

                  {cuotaTotal > creditoNum && (
                    <div>
                      <Label>Diferencia en efectivo</Label>
                      <Input
                        type="number"
                        value={diferenciaEfectivo}
                        onChange={e => setDiferenciaEfectivo(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        El crédito no cubre el total de la cuota. Ingresá la diferencia en efectivo para cancelar el mes.
                      </p>
                    </div>
                  )}

                  {!cubreCompleto ? (
                    <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Falta {formatMoney(Math.abs(falta))} para cancelar el mes. No se marcará como cancelado hasta cubrir el 100%.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>El mes se cancelará completamente con crédito{diferenciaNum > 0 ? ' + efectivo' : ''}.</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tipo === 'Campamento' && (
            <>
              <div>
                <Label>Campamento</Label>
                <Select value={campamentoId} onValueChange={setCampamentoId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar campamento" /></SelectTrigger>
                  <SelectContent>
                    {campamentos.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre} · {formatMoney(c.costo_por_persona)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto a aplicar</Label>
                <Input
                  type="number"
                  value={montoCredito}
                  onChange={e => setMontoCredito(e.target.value)}
                  max={credito.monto_disponible}
                />
                <p className="text-xs text-muted-foreground mt-1">Máximo: {formatMoney(credito.monto_disponible)}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending}>
            {mutation.isPending ? 'Aplicando...' : `Aplicar ${formatMoney(creditoNum)}${diferenciaNum > 0 ? ` + ${formatMoney(diferenciaNum)} efectivo` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}