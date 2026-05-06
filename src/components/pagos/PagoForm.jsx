import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { MESES, CUOTA_EFECTIVO, CUOTA_TRANSFERENCIA, MESES_SIN_CUOTA, formatMoney, getCuotaBeneficiario, marzoEsBonificado } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { Tent, CreditCard, Users } from 'lucide-react';

export default function PagoForm({ open, onClose, beneficiarios, preselectedBenId = null }) {
  const [tipoPago, setTipoPago] = useState('Cuota');
  const [beneficiarioId, setBeneficiarioId] = useState(preselectedBenId || '');
  const [mesesSeleccionados, setMesesSeleccionados] = useState([]);
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [campamentoId, setCampamentoId] = useState('');
  const [montoManual, setMontoManual] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObservaciones] = useState('');
  const [hermanosSeleccionados, setHermanosSeleccionados] = useState([]);

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

  const createMutation = useMutation({
    mutationFn: async (pagos) => {
      await Promise.all(pagos.map(p => base44.entities.Pago.create(p)));
    },
    onSuccess: (_, pagos) => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      onClose();
      toast.success(pagos.length > 1 ? `${pagos.length} pagos registrados` : 'Pago registrado');
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

    // Combinar beneficiarios_ids y adultos_ids del campamento
    const idsAsistentes = [
      ...(selectedCampObj.beneficiarios_ids || []),
      ...(selectedCampObj.adultos_ids || []),
    ];

    return beneficiarios
      .filter(b => b.activo !== false && idsAsistentes.includes(b.id))
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

  // Calcular meses ya pagados por este beneficiario en el año seleccionado
  const mesesYaPagados = useMemo(() => {
    if (!beneficiarioId || !anio) return [];
    return pagosExistentes
      .filter(p => p.beneficiario_id === beneficiarioId && p.anio === parseInt(anio) && p.tipo_pago === 'Cuota')
      .flatMap(p => p.meses || (p.mes ? [p.mes] : []));
  }, [beneficiarioId, anio, pagosExistentes]);

  const selectedCamp = campamentos.find(c => c.id === campamentoId);
  const pagosDelCampamento = pagosExistentes.filter(p => p.campamento_id === campamentoId && p.beneficiario_id === beneficiarioId);
  const totalPagadoCamp = pagosDelCampamento.reduce((s, p) => s + (p.monto || 0), 0);
  const saldoCampamento = selectedCamp ? (selectedCamp.costo_por_persona || 0) - totalPagadoCamp : 0;

  // Cuota con descuento familiar automático
  const cuotaBaseEfectivo = selectedBen ? getCuotaBeneficiario(selectedBen, beneficiarios) : CUOTA_EFECTIVO;
  // Mantener la proporción transferencia/efectivo
  const ratio = CUOTA_TRANSFERENCIA / CUOTA_EFECTIVO;
  const cuotaBaseTransferencia = Math.round(cuotaBaseEfectivo * ratio);
  const cuotaUnitaria = formaPago === 'Efectivo' ? cuotaBaseEfectivo : formaPago === 'Transferencia' ? cuotaBaseTransferencia : 0;
  const tieneDescuento = cuotaBaseEfectivo < CUOTA_EFECTIVO;
  const montoCuotas = tipoPago === 'Cuota' ? mesesSeleccionados.length * cuotaUnitaria : 0;
  const montoCampamento = tipoPago === 'Campamento' ? parseFloat(montoManual) || saldoCampamento : 0;
  const montoFinal = tipoPago === 'Cuota' ? montoCuotas : montoCampamento;

  // Destino automático según forma de pago
  const destino = formaPago === 'Transferencia' ? 'Banco' : 'Caja';

  // Meses que no generan cuota para este beneficiario en el año seleccionado
  const mesesNoCobrar = useMemo(() => {
    const no = [...MESES_SIN_CUOTA]; // Enero, Febrero siempre
    const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === beneficiarioId && Number(a.anio) === Number(anio));
    const esPrimeraVez = selectedBen ? !selectedBen.fecha_primer_afiliacion : false;
    if (marzoEsBonificado(afiliacionAnio, esPrimeraVez)) no.push('Marzo');
    return no;
  }, [beneficiarioId, anio, afiliaciones, selectedBen]);

  // Auto-seleccionar el primer mes adeudado cuando cambia el beneficiario o el año
  useEffect(() => {
    if (tipoPago !== 'Cuota' || !beneficiarioId) return;
    const primerMesAdeudado = MESES.find(m => !mesesYaPagados.includes(m) && !mesesNoCobrar.includes(m));
    if (primerMesAdeudado) {
      setMesesSeleccionados([primerMesAdeudado]);
    } else {
      setMesesSeleccionados([]);
    }
  }, [beneficiarioId, anio, tipoPago, mesesYaPagados.length, mesesNoCobrar.length]);

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
    (tipoPago === 'Cuota' ? mesesSeleccionados.length > 0 : (campamentoId && montoFinal > 0));

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
              onValueChange={v => { setBeneficiarioId(v); setHermanosSeleccionados([]); }}
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
          {tipoPago === 'Cuota' && hermanos.length > 0 && (
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
                  const yaPagado = mesesYaPagados.includes(mes);
                  const noCobra = mesesNoCobrar.includes(mes);
                  const seleccionado = mesesSeleccionados.includes(mes);
                  return (
                    <button
                      key={mes}
                      type="button"
                      disabled={yaPagado || noCobra}
                      onClick={() => toggleMes(mes)}
                      className={`p-2 rounded-md text-xs font-medium border transition-all ${
                        noCobra ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' :
                        yaPagado ? 'bg-green-50 border-green-200 text-green-600 opacity-60 cursor-not-allowed' :
                        seleccionado ? 'bg-primary border-primary text-primary-foreground' :
                        'border-border hover:border-primary/50'
                      }`}
                    >
                      {mes.substring(0, 3)}
                      {noCobra ? ' —' : yaPagado ? ' ✓' : ''}
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
                      ✓ Descuento familiar aplicado (cuota base: {formatMoney(formaPago === 'Efectivo' ? CUOTA_EFECTIVO : CUOTA_TRANSFERENCIA)})
                    </p>
                  )}
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
              </SelectContent>
            </Select>
            {formaPago && (
              <p className="text-xs text-muted-foreground mt-1">
                El dinero irá a: <span className="font-medium">{destino}</span>
              </p>
            )}
          </div>

          {/* Monto final */}
          {montoFinal > 0 && (
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
            <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || createMutation.isPending}>
            {createMutation.isPending ? 'Registrando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}