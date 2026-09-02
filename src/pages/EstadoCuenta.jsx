import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, CheckCircle2, XCircle, Award, Tent, Gift, AlertCircle,
  User, Phone, Mail, Calendar, Hash, ShieldCheck, UserX, UserCheck, HeartPulse, Pencil,
  ChevronDown, ChevronUp
} from 'lucide-react';
import FichaSaludFamiliaDialog from '@/components/beneficiarios/FichaSaludFamiliaDialog';
import RamaBadge from '@/components/shared/RamaBadge';
import {
  MESES, MESES_SIN_CUOTA,
  CUOTA_EFECTIVO, CUOTA_TRANSFERENCIA, formatMoney, esBeneficiarioConCuota, getCuotaBeneficiario, getCuotaBaseMes, getCuotaTransferenciaMes, marzoEsBonificado,
  estaAlDia, getCuotaMes, calcularMesesQueGeneranDeuda, mesExcluidoPorActividad, calcularMontoPorMes, calcularEsperadoPorMes
} from '@/lib/ramaUtils';
import { MONTO_SEGURO_AFILIACION } from '@/lib/registros';
import { cn } from '@/lib/utils';
import PanueloIcon from '@/components/shared/PanueloIcon';
import TiendaFamilia from '@/components/tienda/TiendaFamilia';
import CalendarioFamilia from '@/components/dashboard/CalendarioFamilia';
import DescargarAutorizacionButton from '@/components/campamentos/DescargarAutorizacionButton';
import DescargarCircularButton from '@/components/campamentos/DescargarCircularButton';

const AÑO_INICIO = 2026;

export default function EstadoCuenta() {
  const [dniInput, setDniInput] = useState('');
  const [dniBuscado, setDniBuscado] = useState('');
  const [editandoSalud, setEditandoSalud] = useState(null); // beneficiario seleccionado
  const [saludExpandido, setSaludExpandido] = useState({}); // { [id]: bool }
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

  const { data: configCuotas = [] } = useQuery({
    queryKey: ['config_cuotas'],
    queryFn: () => base44.entities.ConfigCuota.list(),
  });

  // Buscar beneficiario por DNI
  const beneficiarioEncontrado = useMemo(() => {
    if (!dniBuscado) return null;
    return beneficiarios.find(b => b.dni === dniBuscado.trim()) || null;
  }, [dniBuscado, beneficiarios]);

  // Grupo familiar (mismo grupo_familiar) — incluye inactivos para no perder resultados
  const grupoFamiliar = useMemo(() => {
    if (!beneficiarioEncontrado?.grupo_familiar) return [beneficiarioEncontrado].filter(Boolean);
    return beneficiarios.filter(
      b => b.grupo_familiar === beneficiarioEncontrado.grupo_familiar
    );
  }, [beneficiarioEncontrado, beneficiarios]);

  // Calcular datos de cuenta para un beneficiario
  const calcularCuenta = (b) => {
    if (!b) return null;
    try {
    const activos = beneficiarios.filter(x => x.activo !== false);
    const pagosDelBen = pagos.filter(p => p.beneficiario_id === b.id);
    const pagosCuotasAnio = pagosDelBen.filter(
      p => Number(p.anio) === Number(anio) && p.tipo_pago !== 'Campamento'
    );
    const pagosAnio = pagosDelBen.filter(p => Number(p.anio) === Number(anio));
    const mesesPagados = pagosCuotasAnio.flatMap(p => p.meses || (p.mes ? [p.mes] : []));
    const montoPorMes = calcularMontoPorMes(pagosCuotasAnio, b, activos);
    const esperadoPorMes = calcularEsperadoPorMes(pagosCuotasAnio, b, activos);

    const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === b.id && Number(a.anio) === Number(anio));
    const esPrimeraVez = !b.fecha_primer_afiliacion || afiliacionAnio?.es_primera_vez === true;
    const marzoGratis = marzoEsBonificado(afiliacionAnio, esPrimeraVez);

    // Cálculo centralizado de meses que generan deuda (alta + baja + reingreso)
    const mesesQueGeneranDeuda = anio < AÑO_INICIO ? [] : calcularMesesQueGeneranDeuda(b, anio, afiliaciones);

    // Cuota del mes actual para display
    const mesActualNombre = MESES[new Date().getMonth()];
    const baseMesActual = getCuotaBaseMes(mesActualNombre, anio, configCuotas) || CUOTA_EFECTIVO;
    const cuotaIndividual = getCuotaBeneficiario(b, activos, baseMesActual);
    // Calcular cuota transferencia aplicando el mismo ratio de descuento que efectivo
    const ratioDescuento = esBeneficiarioConCuota(b) && baseMesActual > 0 ? cuotaIndividual / baseMesActual : 1;
    const baseTransferenciaActual = getCuotaTransferenciaMes(mesActualNombre, anio, configCuotas) || CUOTA_TRANSFERENCIA;
    const cuotaTransferencia = Math.round(baseTransferenciaActual * ratioDescuento);

    // Calcular deuda mes por mes: cada mes puede tener su propio valor de cuota
    let deudaCuotas = 0;
    let pagadoCuotas = 0;
    const alDia = esBeneficiarioConCuota(b) ? estaAlDia(b, pagosCuotasAnio, mesesQueGeneranDeuda) : false;
    if (esBeneficiarioConCuota(b)) {
      const mesesPendientes = mesesQueGeneranDeuda.filter(m => {
        const baseMes = getCuotaBaseMes(m, anio, configCuotas) || CUOTA_EFECTIVO;
        const cuotaBenMes = getCuotaBeneficiario(b, activos, baseMes);
        const esperadoMes = esperadoPorMes[m] || cuotaBenMes;
        return (montoPorMes[m] || 0) < esperadoMes - 0.01;
      });
      deudaCuotas = mesesPendientes.reduce((s, m) => {
        const baseMes = getCuotaBaseMes(m, anio, configCuotas) || CUOTA_EFECTIVO;
        const cuotaBenMes = getCuotaBeneficiario(b, activos, baseMes);
        const esperadoMes = esperadoPorMes[m] || cuotaBenMes;
        return s + Math.max(0, esperadoMes - (montoPorMes[m] || 0));
      }, 0);
      pagadoCuotas = pagosCuotasAnio.reduce((s, p) => s + (p.monto || 0), 0);
    } else {
      pagadoCuotas = pagosCuotasAnio.reduce((s, p) => s + (p.monto || 0), 0);
    }
    // Saldo = -(deuda pendiente). Lo pagado de más por transferencia no genera saldo a favor.
    const saldoCuotas = -deudaCuotas;

    // Campamentos asignados al beneficiario
    const campBen = campamentos.filter(c => c.beneficiarios_ids?.includes(b.id) || c.adultos_ids?.includes(b.id));
    // Total pagado en campamentos (todos los pagos)
    const pagadoCamp = pagosDelBen
      .filter(p => p.tipo_pago === 'Campamento')
      .reduce((s, p) => s + (p.monto || 0), 0);
    const totalCampamentos = campBen.reduce((s, c) => {
      const esAdulto = c.adultos_ids?.includes(b.id) && !c.beneficiarios_ids?.includes(b.id);
      if (esAdulto) {
        return s + (c.adultos_pagan ? (c.costo_adultos || c.costo_por_persona || 0) : 0);
      }
      return s + (c.costo_por_persona || 0);
    }, 0);
    const saldoCamp = pagadoCamp - totalCampamentos;

    // Créditos disponibles
    const creditosBen = creditos.filter(c => c.beneficiario_id === b.id);
    const creditosDisp = creditosBen.filter(c => (c.monto_disponible || 0) > 0);
    const totalCreditos = creditosDisp.reduce((s, c) => s + (c.monto_disponible || 0), 0);
    // Pagos realizados con crédito (para mostrar dónde se aplicaron)
    const pagosConCredito = pagosDelBen.filter(p => p.forma_pago === 'Crédito actividad');

    // Afiliación: si no es primera vez, sumar deuda pendiente al saldo
    let saldoAfiliacion = 0;
    if (!esPrimeraVez && anio >= AÑO_INICIO) {
      const montoPagadoAfiliacion = afiliacionAnio ? (afiliacionAnio.monto_pagado ?? afiliacionAnio.monto ?? 0) : 0;
      const montoDebidoAfiliacion = afiliacionAnio ? (afiliacionAnio.monto ?? MONTO_SEGURO_AFILIACION) : MONTO_SEGURO_AFILIACION;
      saldoAfiliacion = montoPagadoAfiliacion - montoDebidoAfiliacion;
    }

    // Saldo real total (los créditos NO se computan hasta que se apliquen a un pago)
    const saldo = saldoCuotas + saldoCamp + saldoAfiliacion;

    return {
      pagosAnio,
      mesesPagados,
      montoPorMes,
      esperadoPorMes,
      cuotaEfectiva: cuotaIndividual,
      campBen,
      totalCampamentos,
      pagadoCamp,
      cuotaIndividual,
      deudaCuotas,
      pagadoCuotas,
      saldo,
      totalCreditos,
      creditosDisp,
      creditosBen,
      pagosConCredito,
      marzoGratis,
      cuotaTransferencia,
      alDia,
      tieneDescuento: cuotaIndividual < CUOTA_EFECTIVO && esBeneficiarioConCuota(b),
    };
    } catch (err) {
      // Si hay un error calculando la cuenta de un beneficiario específico,
      // devolver datos mínimos para que la página no quede en blanco
      console.error('Error calculando cuenta de', b?.nombre, err);
      return {
        pagosAnio: [], mesesPagados: [], montoPorMes: {}, esperadoPorMes: {},
        cuotaEfectiva: CUOTA_EFECTIVO, campBen: [], totalCampamentos: 0, pagadoCamp: 0,
        cuotaIndividual: CUOTA_EFECTIVO, deudaCuotas: 0, pagadoCuotas: 0, saldo: 0,
        totalCreditos: 0, creditosDisp: [], creditosBen: [], pagosConCredito: [],
        marzoGratis: false, cuotaTransferencia: CUOTA_TRANSFERENCIA, alDia: false, tieneDescuento: false,
      };
    }
  };

  const handleBuscar = () => {
    const input = dniInput.trim();
    // Prefijo "9" + DNI (más de 8 dígitos) = modo admin/test: consulta sin registrar la visita
    const esModoTest = input.startsWith('9') && input.length > 8;
    const dni = esModoTest ? input.substring(1) : input;
    setDniBuscado(dni);
    if (esModoTest) return;
    // Registrar la consulta para seguimiento de adopción familiar (fire-and-forget)
    const ben = beneficiarios.find(b => b.dni === dni) || null;
    base44.entities.ConsultaDni.create({
      dni_buscado: dni,
      encontrado: !!ben,
      beneficiario_id: ben?.id || '',
      beneficiario_nombre: ben?.nombre || '',
      grupo_familiar: ben?.grupo_familiar || '',
    }).catch(() => {});
  };

  const loading = loadingBen || loadingPagos;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
      {/* Background logo */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'url(https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/136be520e_LogoScoutLaMitreperfil21.png)',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '600px 600px'
        }}
      />
      
      <div className="relative z-10">
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

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

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
                  {b.estado_panuelo && (
                    <div className="flex-shrink-0 flex items-center justify-center w-28 rounded-xl bg-white/60 border border-primary/15 self-stretch py-2">
                      <PanueloIcon estado={b.estado_panuelo} className="w-full h-full max-h-[140px]" />
                    </div>
                  )}
                  <div className="space-y-3 flex-1">
                    <div>
                      <h2 className="text-xl font-bold">{b.nombre}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <RamaBadge rama={b.rama} />
                        {b.activo === false && (
                          <Badge className="bg-red-100 text-red-700 border-red-300 border">
                            <UserX className="w-3 h-3 mr-1" />Dado de baja
                            {b.fecha_baja && <span className="ml-1">· {b.fecha_baja.split('T')[0]}</span>}
                          </Badge>
                        )}
                        {b.fecha_reingreso && b.activo !== false && (
                          <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">
                            <UserCheck className="w-3 h-3 mr-1" />Reingresó {b.fecha_reingreso}
                          </Badge>
                        )}
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
                          <span>Nac.: <span className="text-foreground font-medium">{new Date(b.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span></span>
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
                    cuenta.saldo >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                  )}>
                    <p className="text-xs text-muted-foreground mb-1">Saldo {anio}</p>
                    <p className={cn("text-2xl font-bold", cuenta.saldo >= 0 ? "text-green-600" : "text-red-500")}>
                      {formatMoney(cuenta.saldo)}
                    </p>
                    {b.becado && cuenta.saldo >= 0 && (
                      <p className="text-xs text-amber-600 mt-1">Cuotas bonificadas</p>
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
                    const montoMes = cuenta.montoPorMes[mes] || 0;
                    const esperadoMes = cuenta.esperadoPorMes?.[mes] || cuenta.cuotaEfectiva || CUOTA_EFECTIVO;
                    const pagadoTotal = montoMes >= esperadoMes - 0.01;
                    const parcial = montoMes > 0 && montoMes < esperadoMes - 0.01;
                    const saldoMes = parcial ? esperadoMes - montoMes : 0;
                    const sinCuota = MESES_SIN_CUOTA.includes(mes);
                    const bonificado = mes === 'Marzo' && cuenta.marzoGratis;
                    const mesIdx = MESES.indexOf(mes);
                    const mesActualIdx = new Date().getMonth();
                    const yaTranscurrioEsteAnio = anio < new Date().getFullYear() || mesIdx <= mesActualIdx;

                    // Mes fuera de los períodos activos (antes del alta, después de la baja,
                    // o entre la baja y el reingreso) → no genera deuda
                    const esBaja = mesExcluidoPorActividad(mesIdx, b, anio, afiliaciones);

                    const esDeuda = !sinCuota && !b.becado && !bonificado && !pagadoTotal && !esBaja && yaTranscurrioEsteAnio && esBeneficiarioConCuota(b);
                    return (
                     <Card key={mes} className={cn(
                        'p-2.5 text-center',
                        sinCuota ? 'bg-slate-50 border-slate-200 opacity-40' :
                        esBaja ? 'bg-slate-100 border-slate-300 opacity-60' :
                        b.becado || bonificado ? 'bg-amber-50 border-amber-200' :
                        pagadoTotal ? 'bg-green-50 border-green-200' :
                        parcial ? 'bg-orange-50 border-orange-300' :
                        esDeuda ? 'bg-red-100 border-red-400' : 'bg-slate-50 border-slate-200'
                      )}>
                        <p className={cn("text-xs font-medium", esDeuda ? "text-red-700 font-bold" : esBaja ? "text-slate-400" : "text-muted-foreground")}>{mes.substring(0, 3)}</p>
                        {sinCuota ? (
                          <p className="text-xs text-slate-300 mt-1">—</p>
                        ) : esBaja ? (
                          <UserX className="w-4 h-4 text-slate-400 mx-auto mt-1" title="De baja" />
                        ) : b.becado ? (
                          <Award className="w-4 h-4 text-amber-500 mx-auto mt-1" />
                        ) : bonificado && montoMes === 0 ? (
                          <Award className="w-4 h-4 text-amber-400 mx-auto mt-1" />
                        ) : pagadoTotal ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mt-1" />
                        ) : parcial ? (
                          <div title={`Pagado parcial: ${formatMoney(montoMes)} · Falta: ${formatMoney(saldoMes)}`}>
                            <AlertCircle className="w-4 h-4 text-orange-500 mx-auto mt-1" />
                            <p className="text-[9px] text-orange-600 font-medium mt-0.5">{formatMoney(saldoMes)}</p>
                          </div>
                        ) : esDeuda ? (
                          <XCircle className="w-4 h-4 text-red-600 mx-auto mt-1" />
                        ) : (
                          <p className="text-xs text-slate-300 mt-1">—</p>
                        )}
                       </Card>
                     );
                  })}
                </div>
                {esBeneficiarioConCuota(b) && !b.becado && (
                  <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                    <span>Pagado: <span className="font-medium text-green-600">{formatMoney(cuenta.pagadoCuotas)}</span></span>
                    <span className="text-right">
                      Cuota: <span className="font-medium">{formatMoney(cuenta.cuotaIndividual)} efectivo</span>
                      {' · '}
                      <span className="font-medium">{formatMoney(cuenta.cuotaTransferencia)} transferencia</span>
                      <span className="text-muted-foreground"> /mes</span>
                    </span>
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
                      const esAdultoCamp = c.adultos_ids?.includes(b.id) && !c.beneficiarios_ids?.includes(b.id);
                      const costoBen = esAdultoCamp
                        ? (c.adultos_pagan ? (c.costo_adultos || c.costo_por_persona || 0) : 0)
                        : (c.costo_por_persona || 0);
                      const saldoCamp = costoBen - pagadoEste;
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
                            <p className="text-xs text-muted-foreground">Costo: {formatMoney(costoBen)}</p>
                            <p className={cn("text-sm font-semibold", saldoCamp <= 0 ? "text-green-600" : "text-red-500")}>
                              {saldoCamp <= 0 ? "Pagado ✓" : `Debe: ${formatMoney(saldoCamp)}`}
                            </p>
                            {c.autorizacion_activa && c.beneficiarios_ids?.includes(b.id) && (
                              <DescargarAutorizacionButton campamento={c} beneficiario={b} />
                            )}
                            {c.circular_url && (
                              <DescargarCircularButton campamento={c} />
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}



              {/* Créditos agrupados por actividad */}
              {(cuenta.creditosBen.length > 0 || cuenta.pagosConCredito.length > 0) && (() => {
                const porActividad = {};
                cuenta.creditosBen.forEach(cr => {
                  const key = cr.actividad_id || cr.actividad_nombre || 'Sin actividad';
                  if (!porActividad[key]) porActividad[key] = { nombre: cr.actividad_nombre || 'Sin actividad', items: [] };
                  porActividad[key].items.push(cr);
                });
                return (
                  <div>
                    <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-primary" /> Créditos por actividades económicas
                    </h3>
                    {cuenta.creditosDisp.length > 0 ? (
                      <div className="space-y-2 mb-2">
                        {Object.values(porActividad).map(({ nombre, items }) => {
                          const total = items.reduce((s, cr) => s + (cr.monto_disponible || 0), 0);
                          const fechaMin = items.map(cr => cr.fecha).filter(Boolean).sort()[0];
                          return (
                            <Card key={nombre} className="p-4 bg-primary/5 border-primary/20 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{nombre}</p>
                                {fechaMin && <p className="text-xs text-muted-foreground">Acreditado el {fechaMin}</p>}
                              </div>
                              <p className="text-lg font-bold text-primary">{formatMoney(total)}</p>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mb-2 italic">No hay créditos disponibles (todos fueron aplicados).</p>
                    )}

                    {/* Historial de uso de créditos */}
                    {cuenta.pagosConCredito.length > 0 && (
                      <Card className="p-3 border-muted">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Historial de créditos aplicados
                        </p>
                        <div className="space-y-1.5">
                          {cuenta.pagosConCredito.sort((a, b) => (b.fecha_pago || '').localeCompare(a.fecha_pago || '')).map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs gap-2 py-1.5 border-b border-muted/40 last:border-0">
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {p.tipo_pago === 'Campamento' ? `Campamento: ${p.campamento_nombre}` : `Cuota: ${p.meses?.join(', ') || p.mes}`}
                                </p>
                                <p className="text-muted-foreground">{p.fecha_pago} {p.observaciones ? `· ${p.observaciones}` : ''}</p>
                              </div>
                              <p className="font-semibold text-green-600 flex-shrink-0">{formatMoney(p.monto)}</p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                );
              })()}



              {/* Información médica */}
              {(() => {
                const tieneSalud = !!(b.grupo_sanguineo || b.factor_rh || b.alergias || b.condicion_medica || b.medicacion_habitual || b.regimen_dietario || b.obra_social || b.numero_obra_social || b.contacto_emergencia_nombre || b.contacto_emergencia_telefono || b.salud_mental || b.anticoagulacion || b.observaciones_salud || b.peso_kg || b.talla_m);
                const expandido = saludExpandido[b.id] || false;
                return (
                  <>
                    {/* Cartel de alerta si no hay datos */}
                    {!tieneSalud && (
                      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 flex gap-3 items-start">
                        <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                          <HeartPulse className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-amber-800 text-sm">¡Información de salud incompleta!</p>
                          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                            Contar con los datos de salud de <strong>{b.nombre.split(' ')[0]}</strong> es muy importante. Ante cualquier emergencia durante las actividades, esta información es indispensable para actuar rápido y de forma segura. Por favor, completala cuanto antes.
                          </p>
                          <Button size="sm" className="mt-2.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setEditandoSalud(b)}>
                            <Pencil className="w-3 h-3 mr-1.5" />Completar ahora
                          </Button>
                        </div>
                      </div>
                    )}

                    <Card className="border border-primary/20 overflow-hidden">
                      {/* Header colapsable */}
                      <button
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        onClick={() => setSaludExpandido(prev => ({ ...prev, [b.id]: !expandido }))}
                      >
                        <div className="flex items-center gap-2">
                          <HeartPulse className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold text-sm">Información médica</h3>
                          {tieneSalud && (
                            <span className="text-xs bg-green-100 text-green-700 border border-green-300 rounded-full px-2 py-0.5">Cargada</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {expandido ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {/* Contenido expandible */}
                      {expandido && (
                        <div className="px-4 pb-4 border-t">
                          <div className="flex justify-end mt-3 mb-3">
                            <Button size="sm" variant="outline" onClick={() => setEditandoSalud(b)}>
                              <Pencil className="w-3 h-3 mr-1.5" />
                              {tieneSalud ? 'Actualizar' : 'Completar'}
                            </Button>
                          </div>
                          {tieneSalud ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm pl-1">
                              {b.grupo_sanguineo && (
                                <div><span className="text-muted-foreground text-xs">Grupo / RH: </span>
                                  <span className="font-medium">{b.grupo_sanguineo}{b.factor_rh ? ` (${b.factor_rh === 'Positivo' ? '+' : '-'})` : ''}</span></div>
                              )}
                              {b.alergias && (
                                <div><span className="text-muted-foreground text-xs">Alergias: </span>
                                  <span className="font-medium">{b.alergias}</span></div>
                              )}
                              {b.condicion_medica && (
                                <div><span className="text-muted-foreground text-xs">Afección: </span>
                                  <span className="font-medium">{b.condicion_medica}</span></div>
                              )}
                              {b.medicacion_habitual && (
                                <div><span className="text-muted-foreground text-xs">Medicación: </span>
                                  <span className="font-medium">{b.medicacion_habitual}</span></div>
                              )}
                              {b.obra_social && (
                                <div><span className="text-muted-foreground text-xs">Obra social: </span>
                                  <span className="font-medium">{b.obra_social}{b.numero_obra_social ? ` · ${b.numero_obra_social}` : ''}</span></div>
                              )}
                              {b.regimen_dietario && (
                                <div><span className="text-muted-foreground text-xs">Dieta: </span>
                                  <span className="font-medium">{b.regimen_dietario}</span></div>
                              )}
                              {b.salud_mental && (
                                <div><span className="text-muted-foreground text-xs">Salud mental: </span>
                                  <span className="font-medium">{b.salud_mental}</span></div>
                              )}
                              {b.anticoagulacion && (
                                <div><span className="text-muted-foreground text-xs">Anticoagulación: </span>
                                  <span className="font-medium">{b.anticoagulacion}</span></div>
                              )}
                              {b.contacto_emergencia_nombre && (
                                <div><span className="text-muted-foreground text-xs">Emergencia: </span>
                                  <span className="font-medium">{b.contacto_emergencia_nombre}{b.contacto_emergencia_telefono ? ` · ${b.contacto_emergencia_telefono}` : ''}</span></div>
                              )}
                              {b.observaciones_salud && (
                                <div className="col-span-2"><span className="text-muted-foreground text-xs">Observaciones: </span>
                                  <span className="font-medium">{b.observaciones_salud}</span></div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Aún no hay datos de salud cargados para {b.nombre.split(' ')[0]}.
                            </p>
                          )}
                        </div>
                      )}
                    </Card>
                  </>
                );
              })()}

              {grupoFamiliar.length > 1 && !esPrincipal && (
                <div className="border-t border-dashed pt-2" />
              )}
            </div>
          );
        })}

        {/* Calendario de actividades del grupo y de la rama */}
        {beneficiarioEncontrado && (
          <CalendarioFamilia grupoFamiliar={grupoFamiliar} />
        )}

        {/* Tienda del grupo — catálogo y pre-encargos */}
        {beneficiarioEncontrado && (
          <TiendaFamilia grupoFamiliar={grupoFamiliar} />
        )}
      </div>
        </div>

        {editandoSalud && (
          <FichaSaludFamiliaDialog
            open
            beneficiario={editandoSalud}
            onClose={() => setEditandoSalud(null)}
            onSaved={() => setEditandoSalud(null)}
          />
        )}
      </div>
      );
      }