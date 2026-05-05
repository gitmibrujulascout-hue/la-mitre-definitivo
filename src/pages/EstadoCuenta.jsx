import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, CheckCircle2, XCircle, Award, Tent, Gift, AlertCircle,
  User, Phone, Mail, Calendar, Hash, ShieldCheck
} from 'lucide-react';
import RamaBadge from '@/components/shared/RamaBadge';
import {
  MESES, MESES_SIN_CUOTA, MESES_BONIFICADOS,
  CUOTA_EFECTIVO, formatMoney, esBeneficiarioConCuota, getCuotaBeneficiario
} from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

const AÑO_INICIO = 2026;

export default function EstadoCuenta() {
  const [dniInput, setDniInput] = useState('');
  const [dniBuscado, setDniBuscado] = useState('');
  const [anio] = useState(new Date().getFullYear());

  const { data: beneficiarios = [], isLoading: loadingBen } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list(),
  });

  const { data: creditos = [] } = useQuery({
    queryKey: ['creditos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list(),
  });

  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  // Buscar beneficiario por DNI
  const beneficiarioEncontrado = useMemo(() => {
    if (!dniBuscado) return null;
    return beneficiarios.find(b => b.dni === dniBuscado.trim()) || null;
  }, [dniBuscado, beneficiarios]);

  // Grupo familiar (mismo grupo_familiar)
  const grupoFamiliar = useMemo(() => {
    if (!beneficiarioEncontrado?.grupo_familiar) return [beneficiarioEncontrado].filter(Boolean);
    return beneficiarios.filter(
      b => b.grupo_familiar === beneficiarioEncontrado.grupo_familiar && b.activo !== false
    );
  }, [beneficiarioEncontrado, beneficiarios]);

  // Calcular datos de cuenta para un beneficiario
  const calcularCuenta = (b) => {
    if (!b) return null;
    const activos = beneficiarios.filter(x => x.activo !== false);
    const pagosDelBen = pagos.filter(p => p.beneficiario_id === b.id);
    // Pagos de cuota del año (pueden registrarse en cualquier año pero con anio=actual)
    // Pagos de cuota del año seleccionado
    const pagosCuotasAnio = pagosDelBen.filter(
      p => Number(p.anio) === Number(anio) && p.tipo_pago !== 'Campamento'
    );
    // Todos los pagos del año (incluye campamento, para historial)
    const pagosAnio = pagosDelBen.filter(p => Number(p.anio) === Number(anio));
    const mesesPagados = pagosCuotasAnio.flatMap(p => p.meses || (p.mes ? [p.mes] : []));

    const mesActual = new Date().getMonth(); // 0-indexed
    const mesesTranscurridos = anio < new Date().getFullYear() ? 12 : anio > new Date().getFullYear() ? 0 : mesActual + 1;
    const mesesQueGeneranDeuda = anio < AÑO_INICIO ? [] : MESES.slice(0, mesesTranscurridos).filter(
      m => !MESES_SIN_CUOTA.includes(m) && !MESES_BONIFICADOS.includes(m)
    );

    const cuotaIndividual = getCuotaBeneficiario(b, activos);

    // Calcular deuda mes por mes: si el mes ya está pagado no genera deuda,
    // si no está pagado genera deuda por la cuota base (efectivo).
    // Esto evita que pagar por transferencia (monto mayor) genere saldo a favor irreal.
    let deudaCuotas = 0;
    let pagadoCuotas = 0;
    if (esBeneficiarioConCuota(b)) {
      // Meses efectivamente cubiertos por algún pago
      const mesesCubiertos = new Set(
        pagosCuotasAnio.flatMap(p => p.meses || (p.mes ? [p.mes] : []))
      );
      const mesesPendientes = mesesQueGeneranDeuda.filter(m => !mesesCubiertos.has(m));
      // Deuda = meses no pagados × cuota base (sin importar si pagaron transferencia o efectivo)
      deudaCuotas = mesesPendientes.length * cuotaIndividual;
      pagadoCuotas = pagosCuotasAnio.reduce((s, p) => s + (p.monto || 0), 0);
    } else {
      pagadoCuotas = pagosCuotasAnio.reduce((s, p) => s + (p.monto || 0), 0);
    }
    // Saldo = -(deuda pendiente). Lo pagado de más por transferencia no genera saldo a favor.
    const saldoCuotas = -deudaCuotas;

    // Campamentos asignados al beneficiario
    const campBen = campamentos.filter(c => c.beneficiarios_ids?.includes(b.id));
    // Total pagado en campamentos (todos los pagos)
    const pagadoCamp = pagosDelBen
      .filter(p => p.tipo_pago === 'Campamento')
      .reduce((s, p) => s + (p.monto || 0), 0);
    const totalCampamentos = campBen.reduce((s, c) => s + (c.costo_por_persona || 0), 0);
    const saldoCamp = pagadoCamp - totalCampamentos;

    // Créditos disponibles
    const creditosDisp = creditos.filter(c => c.beneficiario_id === b.id && (c.monto_disponible || 0) > 0);
    const totalCreditos = creditosDisp.reduce((s, c) => s + (c.monto_disponible || 0), 0);

    // Saldo real total
    const saldo = saldoCuotas + saldoCamp + totalCreditos;

    return {
      pagosAnio,
      mesesPagados,
      campBen,
      totalCampamentos,
      pagadoCamp,
      cuotaIndividual,
      deudaCuotas,
      pagadoCuotas,
      saldo,
      totalCreditos,
      creditosDisp,
      tieneDescuento: cuotaIndividual < CUOTA_EFECTIVO && esBeneficiarioConCuota(b),
    };
  };

  const handleBuscar = () => setDniBuscado(dniInput);

  const loading = loadingBen || loadingPagos;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Estado de Cuenta</h1>
            <p className="text-xs text-muted-foreground">Grupo Scout — Consultá el estado de tu hijo/a</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Buscador por DNI */}
        <Card className="p-6">
          <h2 className="font-semibold mb-1">Ingresá el DNI del scout</h2>
          <p className="text-sm text-muted-foreground mb-4">Ingresá el número de DNI (sin puntos) para consultar el estado de cuenta.</p>
          <div className="flex gap-2">
            <Input
              value={dniInput}
              onChange={e => setDniInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              placeholder="Ej: 45123456"
              className="flex-1 text-lg"
              type="number"
            />
            <Button onClick={handleBuscar} disabled={!dniInput.trim() || loading}>
              <Search className="w-4 h-4 mr-2" />Consultar
            </Button>
          </div>
        </Card>

        {/* Resultado */}
        {dniBuscado && !loading && !beneficiarioEncontrado && (
          <Card className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No se encontró ningún scout con DNI {dniBuscado}</p>
            <p className="text-sm text-muted-foreground mt-1">Verificá el número o consultá con la administración del grupo.</p>
          </Card>
        )}

        {beneficiarioEncontrado && grupoFamiliar.map(b => {
          const cuenta = calcularCuenta(b);
          if (!cuenta) return null;
          const esPrincipal = b.id === beneficiarioEncontrado.id;

          return (
            <div key={b.id} className={cn("space-y-4", !esPrincipal && "opacity-90")}>
              {/* Encabezado del scout */}
              <Card className="p-5 border-2 border-primary/20 bg-primary/5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-xl font-bold">{b.nombre}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <RamaBadge rama={b.rama} />
                        {b.becado && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300 border">
                            <Award className="w-3 h-3 mr-1" />Becado
                          </Badge>
                        )}
                        {cuenta.tieneDescuento && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-300 border">
                            Descuento hermanos
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
                      {b.dni && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Hash className="w-3.5 h-3.5" />
                          <span>DNI: <span className="text-foreground font-medium">{b.dni}</span></span>
                        </div>
                      )}
                      {b.fecha_nacimiento && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Nac.: <span className="text-foreground font-medium">{new Date(b.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-AR')}</span></span>
                        </div>
                      )}
                      {b.telefono_contacto && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="text-foreground font-medium">{b.telefono_contacto}</span>
                        </div>
                      )}
                      {b.email_contacto && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="text-foreground font-medium">{b.email_contacto}</span>
                        </div>
                      )}
                      {b.organismo && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span>Organismo: <span className="text-foreground font-medium">{b.organismo}</span></span>
                        </div>
                      )}
                      {b.codigo && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span>Cód.: <span className="text-foreground font-medium">{b.codigo}</span></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Saldo */}
                  <div className={cn(
                    "rounded-xl p-4 text-center min-w-[130px]",
                    b.becado ? "bg-amber-50 border border-amber-200" :
                    cuenta.saldo >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                  )}>
                    <p className="text-xs text-muted-foreground mb-1">Saldo {anio}</p>
                    {b.becado ? (
                      <p className="text-lg font-bold text-amber-600">Becado</p>
                    ) : (
                      <p className={cn("text-2xl font-bold", cuenta.saldo >= 0 ? "text-green-600" : "text-red-500")}>
                        {formatMoney(cuenta.saldo)}
                      </p>
                    )}
                    {cuenta.tieneDescuento && (
                      <p className="text-xs text-blue-600 mt-1">{formatMoney(cuenta.cuotaIndividual)}/mes</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Afiliación a Scout Argentina — ANTES de cuotas */}
              {(() => {
                const afiliacionesDelBen = afiliaciones.filter(a => a.beneficiario_id === b.id);
                const afiliacionAnio = afiliacionesDelBen.find(a => Number(a.anio) === anio);

                // Es primera vez si: la afiliación lo dice, o si no tiene fecha_primer_afiliacion
                // (nunca tuvo afiliación previa = se inscribió este año o nunca se registró antes)
                const esPrimeraVez = afiliacionAnio?.es_primera_vez ||
                  (!afiliacionAnio && !b.fecha_primer_afiliacion);

                const saldoPendienteAfil = afiliacionAnio && !afiliacionAnio.es_primera_vez
                  ? (afiliacionAnio.monto || 0) - (afiliacionAnio.monto_pagado || afiliacionAnio.monto || 0)
                  : 0;

                // Color del card
                const cardColor = esPrimeraVez
                  ? "border-amber-200 bg-amber-50/40"
                  : !afiliacionAnio
                    ? "border-red-200 bg-red-50/40"
                    : saldoPendienteAfil > 0
                      ? "border-orange-200 bg-orange-50/40"
                      : "border-green-200 bg-green-50/40";

                const iconColor = esPrimeraVez
                  ? "text-amber-500"
                  : !afiliacionAnio
                    ? "text-red-400"
                    : saldoPendienteAfil > 0
                      ? "text-orange-500"
                      : "text-green-600";

                return (
                  <div>
                    <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-primary" /> Afiliación a Scout Argentina {anio}
                    </h3>
                    <Card className={cn("p-4 flex items-center justify-between gap-3", cardColor)}>
                      <div className="flex items-center gap-3">
                        <ShieldCheck className={cn("w-5 h-5 flex-shrink-0", iconColor)} />
                        <div>
                          <p className="font-medium text-sm">Afiliación a Scout Argentina {anio}</p>
                          {afiliacionAnio?.fecha_pago && (
                            <p className="text-xs text-muted-foreground">Registrado el {afiliacionAnio.fecha_pago} · {afiliacionAnio.forma_pago}</p>
                          )}
                          {esPrimeraVez && (
                            <p className="text-xs text-amber-600">Primer año — bonificado por la Asociación Nacional</p>
                          )}
                          {!afiliacionAnio && !esPrimeraVez && (
                            <p className="text-xs text-muted-foreground">Sin registro de pago este año</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {esPrimeraVez ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">⭐ Bonificado</Badge>
                        ) : !afiliacionAnio ? (
                          <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">✗ No pagado</Badge>
                        ) : saldoPendienteAfil > 0 ? (
                          <div>
                            <p className="text-xs text-muted-foreground">Monto: {formatMoney(afiliacionAnio.monto)}</p>
                            <p className="text-sm font-semibold text-orange-600">Debe: {formatMoney(saldoPendienteAfil)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-muted-foreground">Monto: {formatMoney(afiliacionAnio.monto)}</p>
                            <p className="text-sm font-semibold text-green-600">Pagado ✓</p>
                          </div>
                        )}
                      </div>
                    </Card>
                    {afiliacionesDelBen.filter(a => Number(a.anio) !== anio).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {afiliacionesDelBen.filter(a => Number(a.anio) !== anio).map(a => (
                          <div key={a.id} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/40 text-xs">
                            <span className="text-muted-foreground">Afiliación {a.anio}</span>
                            {a.es_primera_vez ? (
                              <span className="text-amber-600">⭐ Bonificado</span>
                            ) : (
                              <span className="text-green-600 font-medium">Pagado {formatMoney(a.monto_pagado || a.monto)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cuotas */}
              <div>
                <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Cuotas {anio}</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {MESES.map(mes => {
                    const pago = cuenta.pagosAnio.find(p => (p.meses || [p.mes]).includes(mes));
                    const pagado = !!pago;
                    const sinCuota = MESES_SIN_CUOTA.includes(mes);
                    const bonificado = MESES_BONIFICADOS.includes(mes);
                    return (
                      <Card key={mes} className={cn(
                        'p-2.5 text-center',
                        sinCuota ? 'bg-slate-50 border-slate-200 opacity-40' :
                        b.becado || bonificado ? 'bg-amber-50 border-amber-200' :
                        pagado ? 'bg-green-50 border-green-200' : 'bg-red-50/40 border-red-100'
                      )}>
                        <p className="text-xs font-medium text-muted-foreground">{mes.substring(0, 3)}</p>
                        {sinCuota ? (
                          <p className="text-xs text-slate-300 mt-1">—</p>
                        ) : b.becado ? (
                          <Award className="w-4 h-4 text-amber-500 mx-auto mt-1" />
                        ) : bonificado && !pagado ? (
                          <Award className="w-4 h-4 text-amber-400 mx-auto mt-1" />
                        ) : pagado ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mt-1" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-300 mx-auto mt-1" />
                        )}
                      </Card>
                    );
                  })}
                </div>
                {esBeneficiarioConCuota(b) && !b.becado && (
                  <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                    <span>Pagado: <span className="font-medium text-green-600">{formatMoney(cuenta.pagadoCuotas)}</span></span>
                    <span>Cuota: <span className="font-medium">{formatMoney(cuenta.cuotaIndividual)}/mes</span></span>
                  </div>
                )}
              </div>

              {/* Campamentos */}
              {cuenta.campBen.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Campamentos</h3>
                  <div className="space-y-2">
                    {cuenta.campBen.map(c => {
                      const pagadoEste = pagos
                        .filter(p => p.beneficiario_id === b.id && p.tipo_pago === 'Campamento' && p.campamento_id === c.id)
                        .reduce((s, p) => s + (p.monto || 0), 0);
                      const saldoCamp = (c.costo_por_persona || 0) - pagadoEste;
                      return (
                        <Card key={c.id} className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Tent className="w-5 h-5 text-primary flex-shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{c.nombre}</p>
                              <p className="text-xs text-muted-foreground">{c.fecha_inicio}{c.ubicacion ? ` · ${c.ubicacion}` : ''}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">Costo: {formatMoney(c.costo_por_persona)}</p>
                            <p className={cn("text-sm font-semibold", saldoCamp <= 0 ? "text-green-600" : "text-red-500")}>
                              {saldoCamp <= 0 ? "Pagado ✓" : `Debe: ${formatMoney(saldoCamp)}`}
                            </p>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}



              {/* Créditos */}
              {cuenta.creditosDisp.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-primary" /> Créditos por actividades
                  </h3>
                  <div className="space-y-2">
                    {cuenta.creditosDisp.map(cr => (
                      <Card key={cr.id} className="p-4 bg-primary/5 border-primary/20 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{cr.actividad_nombre}</p>
                          <p className="text-xs text-muted-foreground">Acreditado el {cr.fecha}</p>
                        </div>
                        <p className="text-lg font-bold text-primary">{formatMoney(cr.monto_disponible)}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}



              {grupoFamiliar.length > 1 && !esPrincipal && (
                <div className="border-t border-dashed pt-2" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}