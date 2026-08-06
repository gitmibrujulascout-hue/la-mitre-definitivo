import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle2, XCircle, Award, Tent, Gift, Zap, ShieldCheck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import RamaBadge from '@/components/shared/RamaBadge';
import { MESES, MESES_SIN_CUOTA, CUOTA_EFECTIVO, formatMoney, marzoEsBonificado, mesExcluidoPorActividad, getCuotaBeneficiario, calcularMontoPorMes } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import WhatsAppResumenBtn from '@/components/cuenta/WhatsAppResumenBtn';
import AplicarCreditoDialog from '@/components/cuenta/AplicarCreditoDialog';

export default function CuentaDetalle({ beneficiario, pagos, campamentos, anio, onBack, afiliacion, esPrimeraVezAfiliacion, todosLosBeneficiarios = [] }) {
  const [showAplicar, setShowAplicar] = useState(false);
  const [creditoSeleccionado, setCreditoSeleccionado] = useState(null);
  const queryClient = useQueryClient();

  const { data: creditosWA = [] } = useQuery({
    queryKey: ['creditos-beneficiario', beneficiario?.id],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ beneficiario_id: beneficiario.id }),
    enabled: !!beneficiario?.id,
  });

  if (!beneficiario) return null;

  const pagosAnio = pagos.filter(p => p.anio === anio);
  const pagosCuotaAnio = pagosAnio.filter(p => p.tipo_pago !== 'Campamento');
  const montoPorMes = calcularMontoPorMes(pagosCuotaAnio, beneficiario, todosLosBeneficiarios);
  const cuotaEfectiva = getCuotaBeneficiario(beneficiario, todosLosBeneficiarios);
  const marzoGratis = marzoEsBonificado(afiliacion, esPrimeraVezAfiliacion);

  // Afiliación del año para el cálculo de períodos activos (alta/baja/reingreso)
  const afiliacionesCalc = afiliacion ? [afiliacion] : [];

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />Volver
      </Button>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">{beneficiario.nombre}</h2>
            <div className="flex items-center gap-2 mt-2">
              <RamaBadge rama={beneficiario.rama} />
              {beneficiario.becado && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 border"><Award className="w-3 h-3 mr-1" />Becado</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Saldo {anio}</p>
              <p className={cn('text-3xl font-bold', beneficiario.saldo >= 0 ? 'text-green-600' : 'text-red-500')}>
                {formatMoney(beneficiario.saldo)}
              </p>
            </div>
            <WhatsAppResumenBtn
              beneficiario={beneficiario}
              pagos={pagos}
              campamentos={campamentos}
              anio={anio}
              afiliacion={afiliacion}
              esPrimeraVezAfiliacion={esPrimeraVezAfiliacion}
              creditos={creditosWA}
            />
          </div>
        </div>
      </Card>

      {/* Estado de afiliación */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Afiliación / Seguro {anio}</p>
            {esPrimeraVezAfiliacion ? (
              <p className="text-xs text-amber-700 mt-0.5">⭐ Primera afiliación — no abona seguro</p>
            ) : afiliacion ? (
              afiliacion.es_primera_vez ? (
                <p className="text-xs text-amber-700 mt-0.5">⭐ Primera afiliación — no abona seguro</p>
              ) : (
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    Seguro: <strong>{formatMoney(afiliacion.monto || 0)}</strong>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Pagado: <strong className={(afiliacion.monto_pagado || 0) >= (afiliacion.monto || 0) ? 'text-green-600' : 'text-orange-600'}>
                      {formatMoney(afiliacion.monto_pagado || 0)}
                    </strong>
                  </span>
                  {(afiliacion.monto_pagado || 0) >= (afiliacion.monto || 0) ? (
                    <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">✓ Pagado</Badge>
                  ) : (
                    <Badge className="bg-orange-100 text-orange-700 border-orange-300 border text-xs">
                      <AlertCircle className="w-3 h-3 mr-1" />Pendiente {formatMoney((afiliacion.monto || 0) - (afiliacion.monto_pagado || 0))}
                    </Badge>
                  )}
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />Sin afiliar — debe abonar seguro
                </Badge>
              </div>
            )}
          </div>
          {beneficiario.saldoAfiliacion !== undefined && beneficiario.saldoAfiliacion < 0 && !esPrimeraVezAfiliacion && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Impacto en saldo</p>
              <p className="font-semibold text-red-500">{formatMoney(beneficiario.saldoAfiliacion)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Créditos de actividades económicas */}
      <CreditosPanel
        beneficiarioId={beneficiario.id}
        beneficiarioNombre={beneficiario.nombre}
        beneficiario={beneficiario}
        grupoFamiliar={beneficiario.grupo_familiar}
        campamentos={campamentos}
        todosLosBeneficiarios={todosLosBeneficiarios}
        pagos={pagos}
        anio={anio}
        afiliacion={afiliacion}
        esPrimeraVezAfiliacion={esPrimeraVezAfiliacion}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['pagos'] })}
      />

      {/* Grilla de meses */}
      <h3 className="font-semibold mb-3">Cuotas {anio}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
        {MESES.map((mes, idx) => {
          const montoMes = montoPorMes[mes] || 0;
          const pagadoTotal = montoMes >= cuotaEfectiva - 0.01;
          const parcial = montoMes > 0 && montoMes < cuotaEfectiva - 0.01;
          const saldoMes = parcial ? cuotaEfectiva - montoMes : 0;
          const sinCuota = MESES_SIN_CUOTA.includes(mes);
          const bonificado = mes === 'Marzo' && marzoGratis;
          // Mes fuera de los períodos activos (antes del alta, después de la baja,
          // o entre la baja y el reingreso) → no corresponde
          const antesDeInicio = mesExcluidoPorActividad(idx, beneficiario, anio, afiliacionesCalc);

          return (
            <Card key={mes} className={cn(
              'p-3 text-center transition-all',
              sinCuota || antesDeInicio ? 'bg-slate-50 border-slate-200 opacity-50' :
              beneficiario.becado || bonificado ? 'bg-amber-50 border-amber-200' :
              pagadoTotal ? 'bg-green-50 border-green-200' :
              parcial ? 'bg-orange-50 border-orange-300' : 'bg-muted/50'
            )}>
              <p className="text-xs font-medium text-muted-foreground">{mes.substring(0, 3)}</p>
              {sinCuota || antesDeInicio ? (
                <p className="text-xs text-slate-400 mt-1">—</p>
              ) : beneficiario.becado ? (
                <Award className="w-5 h-5 text-amber-500 mx-auto mt-1" />
              ) : bonificado && montoMes === 0 ? (
                <>
                  <Award className="w-5 h-5 text-amber-400 mx-auto mt-1" />
                  <p className="text-xs text-amber-600 mt-1">Bonif.</p>
                </>
              ) : pagadoTotal ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mt-1" />
              ) : parcial ? (
                <>
                  <AlertCircle className="w-5 h-5 text-orange-500 mx-auto mt-1" />
                  <p className="text-xs text-orange-600 font-medium mt-0.5">{formatMoney(saldoMes)}</p>
                </>
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground/30 mx-auto mt-1" />
              )}
            </Card>
          );
        })}
      </div>

      {/* Campamentos */}
      {campamentos.length > 0 && (
        <>
          <h3 className="font-semibold mb-3">Campamentos</h3>
          <div className="space-y-2 mb-6">
            {campamentos.map(c => {
              const esAdulto = ['Voluntario', 'Educador'].includes(beneficiario.rama) || beneficiario.tipo === 'Voluntario';
              const estaComoAdulto = esAdulto && c.adultos_ids?.includes(beneficiario.id);
              const abona = estaComoAdulto ? c.adultos_pagan : true;
              const costo = estaComoAdulto
                ? (c.adultos_pagan ? (c.costo_adultos || c.costo_por_persona) : 0)
                : c.costo_por_persona;
              return (
                <Card key={c.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Tent className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">{c.fecha_inicio}</p>
                    </div>
                  </div>
                  {abona
                    ? <p className="font-semibold text-red-500">{formatMoney(costo)}</p>
                    : <p className="text-xs text-muted-foreground italic">No abona</p>
                  }
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Historial de pagos */}
      <h3 className="font-semibold mb-3">Historial de pagos</h3>
      {pagos.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">No hay pagos registrados</Card>
      ) : (
        <div className="space-y-2">
          {pagos.map(p => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {p.tipo_pago === 'Campamento' ? p.campamento_nombre : (p.meses?.join(', ') || p.mes)} {p.anio}
                </p>
                <p className="text-xs text-muted-foreground">{p.forma_pago} · {p.fecha_pago}</p>
              </div>
              <p className="font-semibold text-green-600">{formatMoney(p.monto)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Subcomponente: panel de créditos disponibles del beneficiario
function CreditosPanel({ beneficiarioId, beneficiarioNombre, beneficiario, grupoFamiliar, campamentos, todosLosBeneficiarios, pagos, anio, afiliacion, esPrimeraVezAfiliacion, onSaved }) {
  const [showAplicar, setShowAplicar] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [creditoSel, setCreditoSel] = useState(null);
  const queryClient = useQueryClient();

  const { data: creditos = [] } = useQuery({
    queryKey: ['creditos-beneficiario', beneficiarioId],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ beneficiario_id: beneficiarioId }),
  });

  const disponibles = creditos.filter(c => (c.monto_disponible || 0) > 0);
  const [desgloseOpen, setDesgloseOpen] = useState(false);
  const totalDisponible = disponibles.reduce((s, c) => s + (c.monto_disponible || 0), 0);

  if (disponibles.length === 0) return null;

  return (
    <>
      <div className="mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />Créditos de actividades económicas
        </h3>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-medium text-sm">Crédito total disponible</p>
              <p className="text-2xl font-bold text-primary">{formatMoney(totalDisponible)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { setCreditoSel(disponibles); setShowAplicar(true); }}
              >
                <Zap className="w-3 h-3 mr-1" />Aplicar
              </Button>
            </div>
          </div>

          {/* Desglose colapsable por origen */}
          {disponibles.length > 0 && (
            <Collapsible open={desgloseOpen} onOpenChange={setDesgloseOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3">
                {desgloseOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Ver desglose por origen ({disponibles.length} crédito{disponibles.length !== 1 ? 's' : ''})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
                  {disponibles.map(cr => (
                    <div key={cr.id} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Gift className="w-3 h-3 text-primary flex-shrink-0" />
                        <span className="truncate">{cr.actividad_nombre}</span>
                        {cr.monto_original !== cr.monto_disponible && (
                          <span className="text-muted-foreground/60">(usado: {formatMoney(cr.monto_original - cr.monto_disponible)})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-medium text-primary">{formatMoney(cr.monto_disponible)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => { setCreditoSel([cr]); setShowTransferir(true); }}
                        >
                          Transferir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </Card>
      </div>

      {showAplicar && creditoSel && (
        <AplicarCreditoDialog
          creditos={creditoSel}
          beneficiarioId={beneficiarioId}
          beneficiarioNombre={beneficiarioNombre}
          beneficiario={beneficiario}
          campamentos={campamentos}
          todosLosBeneficiarios={todosLosBeneficiarios}
          pagos={pagos}
          anio={anio}
          afiliacion={afiliacion}
          esPrimeraVezAfiliacion={esPrimeraVezAfiliacion}
          onClose={() => { setShowAplicar(false); setCreditoSel(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario', beneficiarioId] });
            queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            setShowAplicar(false);
            setCreditoSel(null);
            onSaved();
          }}
        />
      )}
      {showTransferir && creditoSel && (
        <TransferirCreditoDialog
          credito={creditoSel[0]}
          origenId={beneficiarioId}
          grupoFamiliar={grupoFamiliar}
          todosLosBeneficiarios={todosLosBeneficiarios}
          onClose={() => { setShowTransferir(false); setCreditoSel(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario', beneficiarioId] });
            queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
            setShowTransferir(false);
            setCreditoSel(null);
            onSaved();
          }}
        />
      )}
    </>
  );
}

// Dialog para transferir crédito a otro beneficiario
function TransferirCreditoDialog({ credito, origenId, grupoFamiliar, todosLosBeneficiarios, onClose, onSaved }) {
  const queryClient = useQueryClient();
  // Priorizar familia, luego todos los demás (excluyendo el propio)
  const familiares = todosLosBeneficiarios.filter(b =>
    b.id !== origenId && b.activo !== false && grupoFamiliar && b.grupo_familiar === grupoFamiliar
  );
  const otrosBen = todosLosBeneficiarios.filter(b =>
    b.id !== origenId && b.activo !== false && (!grupoFamiliar || b.grupo_familiar !== grupoFamiliar)
  );

  const [destinoId, setDestinoId] = useState('');
  const [monto, setMonto] = useState(credito.monto_disponible.toString());
  const montoNum = parseFloat(monto) || 0;

  const destinatario = todosLosBeneficiarios.find(b => b.id === destinoId);

  const mutation = useMutation({
    mutationFn: async () => {
      // Crear crédito nuevo para el destinatario
      await base44.entities.CreditoBeneficiario.create({
        beneficiario_id: destinoId,
        beneficiario_nombre: destinatario?.nombre,
        actividad_id: credito.actividad_id,
        actividad_nombre: credito.actividad_nombre,
        monto_original: montoNum,
        monto_disponible: montoNum,
        fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
        observaciones: `Transferido desde ${credito.beneficiario_nombre}`,
      });
      // Descontar del crédito origen (re-fetch para evitar estado stale)
      const credFresh = await base44.entities.CreditoBeneficiario.get(credito.id);
      await base44.entities.CreditoBeneficiario.update(credito.id, {
        monto_disponible: Math.max(0, credFresh.monto_disponible - montoNum),
      });
      // Invalidar créditos del destinatario también
      queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario', destinoId] });
      queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
    },
    onSuccess: () => { toast.success('Crédito transferido correctamente'); onSaved(); },
  });

  const canSave = montoNum > 0 && montoNum <= credito.monto_disponible && !!destinoId;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir crédito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Crédito disponible de "{credito.actividad_nombre}"</p>
            <p className="text-2xl font-bold text-primary">{formatMoney(credito.monto_disponible)}</p>
          </div>

          <div>
            <Label>Transferir a</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario" /></SelectTrigger>
              <SelectContent>
                {familiares.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">Grupo familiar</div>
                    {familiares.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.nombre} · {b.rama || ''}</SelectItem>
                    ))}
                    {otrosBen.length > 0 && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase mt-1">Otros</div>}
                  </>
                )}
                {otrosBen.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre} · {b.rama || ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Monto a transferir</Label>
            <Input
              type="number"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              max={credito.monto_disponible}
            />
            <p className="text-xs text-muted-foreground mt-1">Máximo: {formatMoney(credito.monto_disponible)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending}>
            Transferir {formatMoney(montoNum)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}