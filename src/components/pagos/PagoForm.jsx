import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { MESES, CUOTA_EFECTIVO, CUOTA_TRANSFERENCIA, MESES_SIN_CUOTA, formatMoney, getCuotaBeneficiario, marzoEsBonificado, estaAlDia, calcularMesesQueGeneranDeuda, getMesesBonificadosCredito, getCreditoMesBeneficiario, getLabelCreditoMes, getCuotaBaseMes, calcularMontoPorMes, calcularEsperadoPorMes } from '@/lib/ramaUtils';
import { registrarPagos } from '@/lib/registros';
import { toast } from 'sonner';
import { Tent, CreditCard, Users, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';

// Procesa créditos para meses bonificados: si el pago incluye un mes configurado
// como bonificado y el beneficiario está al día, crea el crédito correspondiente.
async function procesarCreditosMesesBonificados(pagos, beneficiario, pagosExistentes, afiliaciones, anio, todosCreditos, todosBeneficiarios, configCuotas) {
  if (!beneficiario) return;
  const anioNum = parseInt(anio);
  const mesesBonificados = getMesesBonificadosCredito(anioNum, configCuotas);
  if (mesesBonificados.length === 0) return;

  for (const mesBon of mesesBonificados) {
    const incluyeMes = pagos.some(p =>
      p.tipo_pago === 'Cuota' && (p.meses?.includes(mesBon) || p.mes === mesBon)
    );
    if (!incluyeMes) continue;

    const label = getLabelCreditoMes(mesBon, anioNum);
    const yaTieneCredito = todosCreditos.some(
      c => c.beneficiario_id === beneficiario.id && c.observaciones === label
    );
    if (yaTieneCredito) continue;

    const mesesDeuda = calcularMesesQueGeneranDeuda(beneficiario, anioNum, afiliaciones);
    const pagosCuotasAnio = [
      ...pagosExistentes.filter(
        p => p.beneficiario_id === beneficiario.id && Number(p.anio) === anioNum && p.tipo_pago !== 'Campamento'
      ),
      ...pagos.filter(p => p.tipo_pago === 'Cuota' && p.beneficiario_id === beneficiario.id),
    ];
    if (!estaAlDia(beneficiario, pagosCuotasAnio, mesesDeuda, mesesBonificados)) continue;

    const cuotaBase = getCuotaBaseMes(mesBon, anioNum, configCuotas);
    const montoCredito = getCreditoMesBeneficiario(mesBon, anioNum, beneficiario, todosBeneficiarios, cuotaBase, configCuotas);
    await base44.entities.CreditoBeneficiario.create({
      beneficiario_id: beneficiario.id,
      beneficiario_nombre: beneficiario.nombre,
      actividad_nombre: label,
      monto_original: montoCredito,
      monto_disponible: montoCredito,
      fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      observaciones: label,
    });
  }
}

export default function PagoForm({ open, onClose, beneficiarios, preselectedBenId = null }) {
  const [tipoPago, setTipoPago] = useState('Cuota');
  const [beneficiarioId, setBeneficiarioId] = useState(preselectedBenId || '');
  const [mesesSeleccionados, setMesesSeleccionados] = useState([]);
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [campamentoId, setCampamentoId] = useState('');
  const [montoManual, setMontoManual] = useState('');
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [fechaPago, setFechaPago] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [observaciones, setObservaciones] = useState('');
  const [hermanosSeleccionados, setHermanosSeleccionados] = useState([]);
  const [creditoId, setCreditoId] = useState('');
  const [montoCreditoAplicar, setMontoCreditoAplicar] = useState('');
  const [montoManualCuota, setMontoManualCuota] = useState('');

  const queryClient = useQueryClient();

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list(),
  });

  const { data: pagosExistentes = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 200),
  });

  const { data: creditosBen = [] } = useQuery({
    queryKey: ['creditos-beneficiario', beneficiarioId],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ beneficiario_id: beneficiarioId }, '-fecha', 50),
    enabled: !!beneficiarioId,
  });

  const { data: todosCreditos = [] } = useQuery({
    queryKey: ['creditos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list(),
  });

  const { data: configCuotas = [] } = useQuery({
    queryKey: ['config_cuotas'],
    queryFn: () => base44.entities.ConfigCuota.list(),
  });

  const creditosDisponibles = useMemo(() =>
    creditosBen.filter(c => (c.monto_disponible || 0) > 0),
    [creditosBen]
  );
  const totalCreditos = creditosDisponibles.reduce((s, c) => s + (c.monto_disponible || 0), 0);
  const creditoSeleccionado = creditosDisponibles.find(c => c.id === creditoId) || creditosDisponibles[0];

  const createMutation = useMutation({
    mutationFn: async (pagos) => {
      const pagosCreados = await registrarPagos(pagos);
      // Procesar crédito de Julio para beneficiarios al día
      await procesarCreditosMesesBonificados(pagos, selectedBen, pagosExistentes, afiliaciones, anio, todosCreditos, beneficiarios, configCuotas);
      return pagosCreados;
    },
    onSuccess: (_, pagos) => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
      onClose();
      toast.success(pagos.length > 1 ? `${pagos.length} pagos registrados` : 'Pago registrado');
    },
  });

  const creditoMutation = useMutation({
    mutationFn: async ({ pagos, cId, montoCredito }) => {
      await registrarPagos(pagos);
      // Re-fetch del crédito para evitar estado stale
      const credFresh = await base44.entities.CreditoBeneficiario.get(cId);
      if (credFresh) {
        await base44.entities.CreditoBeneficiario.update(cId, {
          monto_disponible: Math.max(0, credFresh.monto_disponible - montoCredito),
        });
      }
      // Procesar crédito de Julio también en pagos con crédito actividad
      await procesarCreditosMesesBonificados(pagos, selectedBen, pagosExistentes, afiliaciones, anio, todosCreditos, beneficiarios, configCuotas);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
      onClose();
      toast.success('Pago con crédito registrado');
    },
  });

  // Solo beneficiarios activos que abonen cuota (excluir voluntarios y becados), ordenados alfabéticamente
  const beneficiariosParaCuota = useMemo(() =>
    beneficiarios
      .filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !b.becado && !['Voluntario', 'Educador'].includes(b.rama))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [beneficiarios]
  );

  // Para campamentos: solo los asistentes registrados en el campamento seleccionado
  const beneficiariosParaCampamento = useMemo(() => {
    const selectedCampObj = campamentos.find(c => c.id === campamentoId);
    if (!selectedCampObj) return [];

    const idsAsistentes = [
      ...(selectedCampObj.beneficiarios_ids || []),
      ...(selectedCampObj.adultos_ids || []),
    ];

    return beneficiarios
      .filter(b => {
        if (!b.activo || !idsAsistentes.includes(b.id)) return false;
        // Si los adultos no pagan, excluir voluntarios y educadores
        if (!selectedCampObj.adultos_pagan && (b.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(b.rama))) return false;
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [beneficiarios, campamentos, campamentoId]);

  const beneficiariosLista = tipoPago === 'Cuota' ? beneficiariosParaCuota : beneficiariosParaCampamento;
  const selectedBen = beneficiarios.find(b => b.id === beneficiarioId);

  // Hermanos: mismo grupo_familiar, excluyendo al principal
  const hermanos = useMemo(() => {
    if (!selectedBen?.grupo_familiar || tipoPago !== 'Cuota') return [];
    return beneficiariosParaCuota.filter(
      b => b.grupo_familiar === selectedBen.grupo_familiar && b.id !== selectedBen.id
    );
  }, [selectedBen, beneficiariosParaCuota, tipoPago]);

  // Meses ya pagados por hermano seleccionado
  const mesesYaPagadosPorHermano = useMemo(() => {
    const mapa = {};
    hermanosSeleccionados.forEach(hid => {
      mapa[hid] = pagosExistentes
        .filter(p => p.beneficiario_id === hid && p.anio === parseInt(anio) && p.tipo_pago === 'Cuota')
        .flatMap(p => p.meses || (p.mes ? [p.mes] : []));
    });
    return mapa;
  }, [hermanosSeleccionados, pagosExistentes, anio]);

  const toggleHermano = (hid) => {
    setHermanosSeleccionados(prev =>
      prev.includes(hid) ? prev.filter(id => id !== hid) : [...prev, hid]
    );
  };

  // Pagos de cuota del beneficiario en el año seleccionado
  const pagosCuotaBen = useMemo(() => {
    if (!beneficiarioId || !anio) return [];
    return pagosExistentes.filter(p => p.beneficiario_id === beneficiarioId && p.anio === parseInt(anio) && p.tipo_pago === 'Cuota');
  }, [beneficiarioId, anio, pagosExistentes]);

  // Monto pagado por mes (monto real, sin conversión)
  const montoPorMes = useMemo(() => {
    if (!selectedBen) return {};
    return calcularMontoPorMes(pagosCuotaBen, selectedBen, beneficiarios);
  }, [pagosCuotaBen, selectedBen, beneficiarios]);

  // Monto esperado por mes según el método de pago usado (transferencia > efectivo)
  const esperadoPorMes = useMemo(() => {
    if (!selectedBen) return {};
    return calcularEsperadoPorMes(pagosCuotaBen, selectedBen, beneficiarios);
  }, [pagosCuotaBen, selectedBen, beneficiarios]);

  // Meses totalmente pagados (total >= esperado según método de pago) — no se pueden re-seleccionar
  const mesesTotalmentePagados = useMemo(() => {
    if (!selectedBen) return [];
    const cuotaEfectiva = getCuotaBeneficiario(selectedBen, beneficiarios);
    return Object.keys(montoPorMes).filter(m => (montoPorMes[m] || 0) >= (esperadoPorMes[m] || cuotaEfectiva) - 0.01);
  }, [montoPorMes, esperadoPorMes, selectedBen, beneficiarios]);

  // Meses parcialmente pagados (0 < total < esperado) — se pueden re-seleccionar para saldar
  const mesesParciales = useMemo(() => {
    if (!selectedBen) return [];
    const cuotaEfectiva = getCuotaBeneficiario(selectedBen, beneficiarios);
    return Object.keys(montoPorMes).filter(m => (montoPorMes[m] || 0) > 0 && (montoPorMes[m] || 0) < (esperadoPorMes[m] || cuotaEfectiva) - 0.01);
  }, [montoPorMes, esperadoPorMes, selectedBen, beneficiarios]);

  // Calcular meses ya pagados por este beneficiario en el año seleccionado (alias para compatibilidad)
  const mesesYaPagados = mesesTotalmentePagados;

  const selectedCamp = campamentos.find(c => c.id === campamentoId);
  const pagosDelCampamento = pagosExistentes.filter(p => p.campamento_id === campamentoId && p.beneficiario_id === beneficiarioId);
  const totalPagadoCamp = pagosDelCampamento.reduce((s, p) => s + (p.monto || 0), 0);
  const saldoCampamento = selectedCamp ? (selectedCamp.costo_por_persona || 0) - totalPagadoCamp : 0;

  // Cuota con descuento familiar automático
  const cuotaBaseEfectivo = selectedBen ? getCuotaBeneficiario(selectedBen, beneficiarios) : CUOTA_EFECTIVO;
  // Mantener la proporción transferencia/efectivo
  const ratio = CUOTA_TRANSFERENCIA / CUOTA_EFECTIVO;
  const cuotaBaseTransferencia = Math.round(cuotaBaseEfectivo * ratio);

  // Saldo pendiente total de los meses parciales seleccionados (para saldar)
  const saldoPendienteParciales = useMemo(() => {
    return mesesSeleccionados
      .filter(m => mesesParciales.includes(m))
      .reduce((s, m) => s + Math.max(0, (esperadoPorMes[m] || cuotaBaseEfectivo) - (montoPorMes[m] || 0)), 0);
  }, [mesesSeleccionados, mesesParciales, esperadoPorMes, montoPorMes, cuotaBaseEfectivo]);
  const cuotaUnitaria = !formaPago ? 0 : formaPago === 'Transferencia' ? cuotaBaseTransferencia : cuotaBaseEfectivo;
  const tieneDescuento = cuotaBaseEfectivo < CUOTA_EFECTIVO;
  const montoCuotas = tipoPago === 'Cuota' ? mesesSeleccionados.length * cuotaUnitaria : 0;
  const montoManualValue = parseFloat(montoManualCuota) || 0;
  // Si se ingresa un monto manual para cuota, usarlo (pago parcial); si no, usar el cálculo completo
  const montoCuotaFinal = montoManualValue > 0 ? montoManualValue : montoCuotas;
  const saldoParcialCuota = montoManualValue > 0 && montoManualValue < montoCuotas ? montoCuotas - montoManualValue : 0;
  const montoCampamento = tipoPago === 'Campamento' ? parseFloat(montoManual) || saldoCampamento : 0;
  const montoFinal = tipoPago === 'Cuota' ? montoCuotaFinal : montoCampamento;

  // Destino automático según forma de pago
  const destino = formaPago === 'Transferencia' ? 'Banco' : formaPago === 'Subsidio del grupo' ? 'Grupo' : 'Caja';

  // Crédito aplicado
  const montoCreditoNum = creditoSeleccionado ? Math.min(parseFloat(montoCreditoAplicar) || 0, creditoSeleccionado.monto_disponible) : 0;
  const diferenciaCredito = formaPago === 'Crédito actividad' ? Math.max(0, montoFinal - montoCreditoNum) : 0;

  // Meses que no generan cuota para este beneficiario en el año seleccionado
  const mesesNoCobrar = useMemo(() => {
    const no = [...MESES_SIN_CUOTA]; // Enero, Febrero siempre
    const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === beneficiarioId && Number(a.anio) === Number(anio));
    const esPrimeraVez = selectedBen ? !selectedBen.fecha_primer_afiliacion : false;
    if (marzoEsBonificado(afiliacionAnio, esPrimeraVez)) no.push('Marzo');
    // Excluir meses anteriores a la fecha de primera afiliación (si se incorporó este año)
    if (selectedBen?.fecha_primer_afiliacion) {
      const [anioAfil, mesAfil] = selectedBen.fecha_primer_afiliacion.split('T')[0].split('-').map(Number);
      if (anioAfil === Number(anio)) {
        MESES.slice(0, mesAfil - 1).forEach(m => { if (!no.includes(m)) no.push(m); });
      }
    }
    return no;
  }, [beneficiarioId, anio, afiliaciones, selectedBen]);

  // Auto-seleccionar el primer mes adeudado cuando cambia el beneficiario o el año
  useEffect(() => {
    if (tipoPago !== 'Cuota' || !beneficiarioId) return;
    const primerMesAdeudado = MESES.find(m => !mesesTotalmentePagados.includes(m) && !mesesNoCobrar.includes(m));
    if (primerMesAdeudado) {
      setMesesSeleccionados([primerMesAdeudado]);
    } else {
      setMesesSeleccionados([]);
    }
    setMontoManualCuota('');
  }, [beneficiarioId, anio, tipoPago, mesesTotalmentePagados.length, mesesNoCobrar.length]);

  // Auto-seleccionar y calcular crédito cuando se elige "Crédito actividad"
  useEffect(() => {
    if (formaPago !== 'Crédito actividad') {
      setMontoCreditoAplicar('');
      return;
    }
    if (creditosDisponibles.length > 0 && !creditosDisponibles.find(c => c.id === creditoId)) {
      setCreditoId(creditosDisponibles[0].id);
    }
    if (creditoSeleccionado && montoFinal > 0) {
      setMontoCreditoAplicar(Math.min(creditoSeleccionado.monto_disponible, montoFinal).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formaPago, montoFinal, creditosDisponibles, creditoId]);

  const toggleMes = (mes) => {
    if (mesesYaPagados.includes(mes) || mesesNoCobrar.includes(mes)) return;
    setMesesSeleccionados(prev =>
      prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]
    );
  };

  const handleSave = () => {
    if (!beneficiarioId || !formaPago) return;
    if (tipoPago === 'Cuota' && mesesSeleccionados.length === 0) return;
    if (tipoPago === 'Campamento' && !campamentoId) return;

    // --- Pago con crédito ---
    if (formaPago === 'Crédito actividad' && creditoSeleccionado) {
      const baseFields = {
        beneficiario_id: beneficiarioId,
        beneficiario_nombre: selectedBen?.nombre || '',
        tipo_pago: tipoPago,
        anio: parseInt(anio),
        fecha_pago: fechaPago,
        ...(tipoPago === 'Cuota'
          ? { meses: mesesSeleccionados, mes: mesesSeleccionados[0] || '' }
          : { campamento_id: campamentoId, campamento_nombre: selectedCamp?.nombre || '' }
        ),
      };
      const pagos = [{
        ...baseFields,
        forma_pago: 'Crédito actividad',
        destino: 'Caja',
        monto: montoCreditoNum,
        observaciones: observaciones || `Crédito aplicado de: ${creditoSeleccionado.actividad_nombre}`,
      }];
      if (diferenciaCredito > 0) {
        pagos.push({
          ...baseFields,
          forma_pago: 'Efectivo',
          destino: 'Caja',
          monto: diferenciaCredito,
          observaciones: observaciones || `Diferencia en efectivo (complementa crédito de: ${creditoSeleccionado.actividad_nombre})`,
        });
      }
      creditoMutation.mutate({ pagos, cId: creditoSeleccionado.id, montoCredito: montoCreditoNum });
      return;
    }

    // --- Pago regular ---
    const buildPago = (ben, meses) => {
      const cuotaBen = getCuotaBeneficiario(ben, beneficiarios);
      const ratio = CUOTA_TRANSFERENCIA / CUOTA_EFECTIVO;
      const cuotaUnitariaBen = formaPago === 'Efectivo' ? cuotaBen : Math.round(cuotaBen * ratio);
      // Filtrar meses ya pagados por este hermano
      const mesesValidos = meses.filter(m => !(mesesYaPagadosPorHermano[ben.id] || []).includes(m));
      if (mesesValidos.length === 0) return null;
      return {
        beneficiario_id: ben.id,
        beneficiario_nombre: ben.nombre,
        tipo_pago: 'Cuota',
        anio: parseInt(anio),
        forma_pago: formaPago,
        destino,
        monto: mesesValidos.length * cuotaUnitariaBen,
        meses: mesesValidos,
        mes: mesesValidos[0],
        fecha_pago: fechaPago,
        observaciones,
      };
    };

    const pagos = [];

    if (tipoPago === 'Cuota') {
      pagos.push({
        beneficiario_id: beneficiarioId,
        beneficiario_nombre: selectedBen?.nombre || '',
        tipo_pago: 'Cuota',
        anio: parseInt(anio),
        forma_pago: formaPago,
        destino,
        monto: montoFinal,
        meses: mesesSeleccionados,
        mes: mesesSeleccionados[0] || '',
        fecha_pago: fechaPago,
        observaciones,
      });
      // Agregar pagos de hermanos seleccionados con los mismos meses
      hermanosSeleccionados.forEach(hid => {
        const hermano = beneficiarios.find(b => b.id === hid);
        if (hermano) {
          const p = buildPago(hermano, mesesSeleccionados);
          if (p) pagos.push(p);
        }
      });
    } else {
      pagos.push({
        beneficiario_id: beneficiarioId,
        beneficiario_nombre: selectedBen?.nombre || '',
        tipo_pago: 'Campamento',
        anio: parseInt(anio),
        forma_pago: formaPago,
        destino,
        monto: montoCampamento,
        campamento_id: campamentoId,
        campamento_nombre: selectedCamp?.nombre || '',
        fecha_pago: fechaPago,
        observaciones,
      });
    }

    createMutation.mutate(pagos);
  };

  const canSave = beneficiarioId && formaPago &&
    (tipoPago === 'Cuota' ? mesesSeleccionados.length > 0 : (campamentoId && montoFinal > 0)) &&
    (formaPago !== 'Crédito actividad' || (creditoSeleccionado && montoCreditoNum > 0));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">

          {/* Tipo de pago */}
          <div className="grid grid-cols-2 gap-2">
            {['Cuota', 'Campamento'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipoPago(t); setBeneficiarioId(preselectedBenId || ''); setMesesSeleccionados([]); setCampamentoId(''); setMontoManual(''); setHermanosSeleccionados([]); }}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium ${tipoPago === t ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'}`}
              >
                {t === 'Cuota' ? <CreditCard className="w-4 h-4" /> : <Tent className="w-4 h-4" />}
                {t}
              </button>
            ))}
          </div>

          {/* Campamento (antes que el beneficiario, solo en modo Campamento) */}
          {tipoPago === 'Campamento' && (
            <div>
              <Label>Campamento *</Label>
              <Select value={campamentoId} onValueChange={v => { setCampamentoId(v); setBeneficiarioId(''); setMontoManual(''); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar campamento" /></SelectTrigger>
                <SelectContent>
                  {campamentos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Beneficiario */}
          <div>
            <Label>Beneficiario *</Label>
            <Select
              value={beneficiarioId}
              onValueChange={v => { setBeneficiarioId(v); setHermanosSeleccionados([]); setCreditoId(''); setMontoCreditoAplicar(''); }}
              disabled={tipoPago === 'Campamento' && !campamentoId}
            >
              <SelectTrigger>
                <SelectValue placeholder={tipoPago === 'Campamento' && !campamentoId ? 'Primero seleccioná un campamento' : 'Seleccionar beneficiario'} />
              </SelectTrigger>
              <SelectContent>
                {beneficiariosLista.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre}{b.rama ? ` (${b.rama})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipoPago === 'Campamento' && campamentoId && beneficiariosLista.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay asistentes registrados en este campamento.</p>
            )}
            {beneficiarioId && creditosDisponibles.length > 0 && (
              <div className="mt-2 p-2.5 rounded-lg border border-green-200 bg-green-50/60 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="text-sm">
                  <span className="text-green-800 font-medium">Créditos disponibles: </span>
                  <span className="text-green-700 font-bold">{formatMoney(totalCreditos)}</span>
                  <span className="text-green-600 text-xs ml-1">
                    ({creditosDisponibles.length} {creditosDisponibles.length === 1 ? 'actividad' : 'actividades'})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Año */}
          <div>
            <Label>Año *</Label>
            <Select value={anio} onValueChange={setAnio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2026, 2027, 2028].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Hermanos del grupo familiar */}
          {tipoPago === 'Cuota' && hermanos.length > 0 && formaPago !== 'Crédito actividad' && formaPago !== 'Subsidio del grupo' && (
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/60 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-800">¿Pagás también para los hermanos?</p>
              </div>
              <div className="space-y-1.5">
                {hermanos.map(h => {
                  const sel = hermanosSeleccionados.includes(h.id);
                  return (
                    <label key={h.id} className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        checked={sel}
                        onCheckedChange={() => toggleHermano(h.id)}
                      />
                      <span className="text-sm">{h.nombre}</span>
                      {h.rama && <span className="text-xs text-muted-foreground">({h.rama})</span>}
                    </label>
                  );
                })}
              </div>
              {hermanosSeleccionados.length > 0 && (
                <p className="text-xs text-blue-600">
                  Se registrarán pagos separados para cada hermano con los mismos meses y forma de pago.
                </p>
              )}
            </div>
          )}

          {/* Selección de meses (multi-selección) */}
          {tipoPago === 'Cuota' && (
            <div>
              <Label className="mb-2 block">
                Meses a abonar * — {mesesSeleccionados.length} seleccionado(s)
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {MESES.map(mes => {
                  const pagadoTotal = mesesTotalmentePagados.includes(mes);
                  const parcial = mesesParciales.includes(mes);
                  const noCobra = mesesNoCobrar.includes(mes);
                  const seleccionado = mesesSeleccionados.includes(mes);
                  const saldoMes = parcial ? ((esperadoPorMes[mes] || cuotaBaseEfectivo) - (montoPorMes[mes] || 0)) : 0;
                  return (
                    <button
                      key={mes}
                      type="button"
                      disabled={pagadoTotal || noCobra}
                      onClick={() => toggleMes(mes)}
                      title={parcial ? `Pagó ${formatMoney(montoPorMes[mes] || 0)}, saldo: ${formatMoney(saldoMes)}` : ''}
                      className={`p-2 rounded-md text-xs font-medium border transition-all ${
                        noCobra ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' :
                        pagadoTotal ? 'bg-green-50 border-green-200 text-green-600 opacity-60 cursor-not-allowed' :
                        parcial && seleccionado ? 'bg-orange-500 border-orange-500 text-white' :
                        parcial ? 'bg-orange-50 border-orange-300 text-orange-600' :
                        seleccionado ? 'bg-primary border-primary text-primary-foreground' :
                        'border-border hover:border-primary/50'
                      }`}
                    >
                      {mes.substring(0, 3)}
                      {noCobra ? ' —' : pagadoTotal ? ' ✓' : parcial ? ' ◐' : ''}
                    </button>
                  );
                })}
              </div>
              {mesesSeleccionados.length > 0 && formaPago && (
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    {mesesSeleccionados.length} mes(es) × {formatMoney(cuotaUnitaria)} = <span className="font-semibold text-foreground">{formatMoney(montoCuotas)}</span>
                  </p>
                  {tieneDescuento && (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ Descuento familiar aplicado (cuota base: {formatMoney(formaPago === 'Transferencia' ? CUOTA_TRANSFERENCIA : CUOTA_EFECTIVO)})
                    </p>
                  )}
                  {mesesParciales.length > 0 && (
                    <p className="text-xs text-orange-600 font-medium">
                      ◐ Meses con pago parcial (naranja) — seleccioná para saldar el resto
                    </p>
                  )}
                </div>
              )}

              {/* Monto manual para pago parcial de cuota */}
              {tipoPago === 'Cuota' && mesesSeleccionados.length > 0 && formaPago && formaPago !== 'Crédito actividad' && formaPago !== 'Subsidio del grupo' && (
                <div>
                  <Label>Monto recibido (si es pago parcial)</Label>
                  <Input
                    type="number"
                    value={montoManualCuota}
                    onChange={e => setMontoManualCuota(e.target.value)}
                    placeholder={montoCuotas.toString()}
                  />
                  {saldoPendienteParciales > 0 && (
                    <button
                      type="button"
                      onClick={() => setMontoManualCuota(saldoPendienteParciales.toString())}
                      className="mt-1.5 text-xs text-orange-600 font-medium hover:text-orange-700 flex items-center gap-1"
                    >
                      ◐ Saldar saldo pendiente de meses parciales: {formatMoney(saldoPendienteParciales)}
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Dejá vacío para registrar el monto completo ({formatMoney(montoCuotas)}).
                    {montoManualValue > 0 && montoManualValue < montoCuotas && (
                      <span className="text-orange-600 font-medium block">
                        Saldo pendiente: {formatMoney(saldoParcialCuota)}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Campamento - detalle de saldo y monto */}
          {tipoPago === 'Campamento' && (
            <div className="space-y-3">
              {selectedCamp && beneficiarioId && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo total:</span>
                    <span className="font-medium">{formatMoney(selectedCamp.costo_por_persona)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ya pagado:</span>
                    <span className="font-medium text-green-600">{formatMoney(totalPagadoCamp)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-semibold">Saldo pendiente:</span>
                    <span className={`font-bold ${saldoCampamento > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {formatMoney(saldoCampamento)}
                    </span>
                  </div>
                </div>
              )}
              {selectedCamp && (
                <div>
                  <Label>Monto a pagar (puede ser a cuenta)</Label>
                  <Input
                    type="number"
                    value={montoManual}
                    onChange={e => setMontoManual(e.target.value)}
                    placeholder={saldoCampamento > 0 ? saldoCampamento.toString() : '0'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Dejá vacío para pagar el saldo completo</p>
                </div>
              )}
            </div>
          )}

          {/* Forma de pago */}
          <div>
            <Label>Forma de pago *</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efectivo">Efectivo → Caja{tipoPago === 'Cuota' ? ` — ${formatMoney(cuotaBaseEfectivo)}/mes` : ''}</SelectItem>
                <SelectItem value="Transferencia">Transferencia → Banco{tipoPago === 'Cuota' ? ` — ${formatMoney(cuotaBaseTransferencia)}/mes` : ''}</SelectItem>
                {creditosDisponibles.length > 0 && (
                  <SelectItem value="Crédito actividad">Crédito actividad — {formatMoney(totalCreditos)} disp.</SelectItem>
                )}
                <SelectItem value="Subsidio del grupo">Subsidio del grupo (absorbido)</SelectItem>
              </SelectContent>
            </Select>
            {formaPago && formaPago !== 'Crédito actividad' && (
              <p className="text-xs text-muted-foreground mt-1">
                {formaPago === 'Subsidio del grupo'
                  ? <>El grupo absorbe este monto (no mueve dinero real). Registrá el motivo en observaciones.</>
                  : <>El dinero irá a: <span className="font-medium">{destino}</span></>}
              </p>
            )}
          </div>

          {/* Detalle de crédito aplicado */}
          {formaPago === 'Crédito actividad' && creditoSeleccionado && montoFinal > 0 && (
            <div className="space-y-3 p-3 rounded-lg border border-green-200 bg-green-50/40">
              {creditosDisponibles.length > 1 && (
                <div>
                  <Label>Origen del crédito</Label>
                  <Select value={creditoSeleccionado.id} onValueChange={setCreditoId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {creditosDisponibles.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.actividad_nombre} — {formatMoney(c.monto_disponible)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total a pagar:</span>
                  <span className="font-medium">{formatMoney(montoFinal)}</span>
                </div>
                <div>
                  <Label>Monto de crédito a aplicar</Label>
                  <Input
                    type="number"
                    value={montoCreditoAplicar}
                    onChange={e => setMontoCreditoAplicar(e.target.value)}
                    max={creditoSeleccionado.monto_disponible}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Disponible: {formatMoney(creditoSeleccionado.monto_disponible)}</p>
                </div>
                {diferenciaCredito > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Diferencia en efectivo:</span>
                    <span className="font-medium text-orange-600">{formatMoney(diferenciaCredito)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {diferenciaCredito > 0 ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="text-xs text-orange-700">El crédito no cubre el total. Se registrará un pago en efectivo por la diferencia.</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-xs text-green-700">El crédito cubre el total del pago.</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Monto final */}
          {montoFinal > 0 && formaPago !== 'Crédito actividad' && (
            <div className="p-3 rounded-lg bg-green-50 text-green-700 text-center">
              {hermanosSeleccionados.length > 0 ? (
                <>
                  <p className="text-sm">Total a registrar ({1 + hermanosSeleccionados.length} pagos)</p>
                  <p className="text-xl font-bold">
                    {formatMoney(montoFinal + hermanosSeleccionados.reduce((sum, hid) => {
                      const h = beneficiarios.find(b => b.id === hid);
                      if (!h) return sum;
                      const cuotaH = getCuotaBeneficiario(h, beneficiarios);
                      const ratio = CUOTA_TRANSFERENCIA / CUOTA_EFECTIVO;
                      const cuotaUH = formaPago === 'Efectivo' ? cuotaH : Math.round(cuotaH * ratio);
                      const mesesValidos = mesesSeleccionados.filter(m => !(mesesYaPagadosPorHermano[hid] || []).includes(m));
                      return sum + mesesValidos.length * cuotaUH;
                    }, 0))}
                  </p>
                  <p className="text-xs opacity-75 mt-0.5">
                    {selectedBen?.nombre}: {formatMoney(montoFinal)}
                    {hermanosSeleccionados.map(hid => {
                      const h = beneficiarios.find(b => b.id === hid);
                      if (!h) return null;
                      const cuotaH = getCuotaBeneficiario(h, beneficiarios);
                      const ratio = CUOTA_TRANSFERENCIA / CUOTA_EFECTIVO;
                      const cuotaUH = formaPago === 'Efectivo' ? cuotaH : Math.round(cuotaH * ratio);
                      const mesesValidos = mesesSeleccionados.filter(m => !(mesesYaPagadosPorHermano[hid] || []).includes(m));
                      return ` · ${h.nombre.split(' ')[0]}: ${formatMoney(mesesValidos.length * cuotaUH)}`;
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">Monto a registrar</p>
                  <p className="text-xl font-bold">{formatMoney(montoFinal)}</p>
                </>
              )}
            </div>
          )}

          <div>
            <Label>Fecha de pago</Label>
            <Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
          </div>
          <div>
            <Label>Observaciones</Label>
            <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder={formaPago === 'Subsidio del grupo' ? 'Motivo del subsidio (evaluado con dirigentes)' : 'Opcional'} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || createMutation.isPending || creditoMutation.isPending}>
            {(createMutation.isPending || creditoMutation.isPending) ? 'Registrando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}