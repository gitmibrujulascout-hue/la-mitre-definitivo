import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import ConfigAfiliacionPanel from '@/components/afiliaciones/ConfigAfiliacionPanel';
import { MESES, MESES_SIN_CUOTA, formatMoney, esBeneficiarioConCuota, calcularMesesQueGeneranDeuda, getCuotaBaseMes, getMesesBonificadosCredito, getCreditoMesBeneficiario, getLabelCreditoMes, getMontoCreditoMes } from '@/lib/ramaUtils';
import { DollarSign, Save, Trash2, Gift, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

export default function ConfiguracionCuotas() {
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());
  const [editValues, setEditValues] = useState({});
  const queryClient = useQueryClient();

  const { data: configCuotas = [] } = useQuery({
    queryKey: ['config_cuotas'],
    queryFn: () => base44.entities.ConfigCuota.list(),
  });

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  const { data: creditos = [] } = useQuery({
    queryKey: ['creditos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list(),
  });

  const { data: configGeneral = [] } = useQuery({
    queryKey: ['config_general'],
    queryFn: () => base44.entities.ConfigGeneral.list(),
  });

  const [claveAdmin, setClaveAdmin] = useState('');
  const claveAdminConfig = configGeneral[0];

  const guardarClaveMut = useMutation({
    mutationFn: async (clave) => {
      if (claveAdminConfig) {
        await base44.entities.ConfigGeneral.update(claveAdminConfig.id, { clave_admin: clave });
      } else {
        await base44.entities.ConfigGeneral.create({ clave_admin: clave });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_general'] });
      setClaveAdmin('');
      toast.success('Clave de acceso administrativo actualizada');
    },
    onError: () => toast.error('Error al guardar la clave'),
  });

  const configAnio = useMemo(() =>
    configCuotas.filter(c => Number(c.anio) === Number(anioFiltro)),
    [configCuotas, anioFiltro]
  );

  const getConfig = (mes) => configAnio.find(c => c.mes === mes);

  const getEditValue = (mes, campo) => {
    const key = `${mes}_${campo}`;
    if (editValues[key] !== undefined) return editValues[key];
    const config = getConfig(mes);
    return config ? config[campo] : '';
  };

  const setEditValue = (mes, campo, valor) => {
    setEditValues(prev => ({ ...prev, [`${mes}_${campo}`]: valor }));
  };

  const saveMut = useMutation({
    mutationFn: async ({ mes, montoEfectivo, montoTransferencia, esBonificado, porcentajeCredito }) => {
      const montoEfecNum = parseFloat(montoEfectivo) || 0;
      const montoTransNum = parseFloat(montoTransferencia) || 0;
      const pctNum = parseFloat(porcentajeCredito) || 50;
      // Guardar mes actual
      const existing = getConfig(mes);
      const data = {
        mes,
        anio: Number(anioFiltro),
        monto_efectivo: montoEfecNum,
        monto_transferencia: montoTransNum,
        es_bonificado_credito: esBonificado,
        porcentaje_credito: esBonificado ? pctNum : 0,
        monto_credito: esBonificado ? Math.round(montoEfecNum * pctNum / 100) : 0,
      };
      // Propagar a meses siguientes (no sin-cuota)
      const mesIdx = MESES.indexOf(mes);
      const siguientes = MESES.filter((m, i) => i > mesIdx && !MESES_SIN_CUOTA.includes(m));
      const ops = [];
      if (existing) {
        ops.push(base44.entities.ConfigCuota.update(existing.id, data));
      } else {
        ops.push(base44.entities.ConfigCuota.create(data));
      }
      siguientes.forEach(m => {
        const ex = getConfig(m);
        const exBonif = ex?.es_bonificado_credito || false;
        const exPct = ex?.porcentaje_credito || 50;
        const mData = {
          mes: m,
          anio: Number(anioFiltro),
          monto_efectivo: montoEfecNum,
          monto_transferencia: montoTransNum,
          es_bonificado_credito: exBonif,
          porcentaje_credito: exBonif ? exPct : 0,
          monto_credito: exBonif ? Math.round(montoEfecNum * exPct / 100) : 0,
        };
        if (ex) {
          ops.push(base44.entities.ConfigCuota.update(ex.id, mData));
        } else {
          ops.push(base44.entities.ConfigCuota.create(mData));
        }
      });
      await Promise.all(ops);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_cuotas'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      setEditValues({});
      toast.success('Configuración guardada y propagada a meses siguientes');
    },
  });

  const handleSave = (mes) => {
    const montoEfectivo = getEditValue(mes, 'monto_efectivo');
    const montoTransferencia = getEditValue(mes, 'monto_transferencia');
    const esBonificado = getEditValue(mes, 'es_bonificado_credito') === true;
    const porcentajeCredito = getEditValue(mes, 'porcentaje_credito');
    if (!montoEfectivo) {
      toast.error('El monto en efectivo es obligatorio');
      return;
    }
    saveMut.mutate({ mes, montoEfectivo, montoTransferencia, esBonificado, porcentajeCredito });
  };

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ConfigCuota.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_cuotas'] });
      toast.success('Configuración eliminada');
    },
  });

  // === Generación de créditos para meses bonificados ===
  const mesesBonificados = useMemo(() =>
    getMesesBonificadosCredito(Number(anioFiltro), configCuotas),
    [configCuotas, anioFiltro]
  );

  const creditosData = useMemo(() => {
    return mesesBonificados.map(mes => {
      const label = getLabelCreditoMes(mes, anioFiltro);
      const yaGenerados = creditos.filter(c => c.observaciones === label);
      const yaTienenIds = new Set(yaGenerados.map(c => c.beneficiario_id));

      const elegibles = beneficiarios.filter(b => {
        if (b.activo === false) return false;
        if (!esBeneficiarioConCuota(b)) return false;
        const pagosBen = pagos.filter(p => p.beneficiario_id === b.id && Number(p.anio) === Number(anioFiltro) && p.tipo_pago !== 'Campamento');
        const mesesCubiertos = new Set(pagosBen.flatMap(p => p.meses || (p.mes ? [p.mes] : [])));
        if (!mesesCubiertos.has(mes)) return false;
        const mesesDeuda = calcularMesesQueGeneranDeuda(b, Number(anioFiltro), afiliaciones).filter(m => m !== mes);
        const mesesHastaMes = mesesDeuda.filter(m => MESES.indexOf(m) < MESES.indexOf(mes));
        return mesesHastaMes.every(m => mesesCubiertos.has(m));
      });

      const pendientes = elegibles.filter(b => !yaTienenIds.has(b.id));
      return { mes, label, yaGenerados, pendientes, totalElegibles: elegibles.length };
    });
  }, [mesesBonificados, beneficiarios, pagos, afiliaciones, creditos, anioFiltro]);

  const generarCreditosMut = useMutation({
    mutationFn: async ({ mes }) => {
      const data = creditosData.find(d => d.mes === mes);
      if (!data || data.pendientes.length === 0) throw new Error('No hay beneficiarios pendientes');
      // Re-fetch fresh credits from server to filter out beneficiaries who already have one
      const creditosFresh = await base44.entities.CreditoBeneficiario.filter(
        { observaciones: data.label },
        '-created_date',
        500
      );
      const yaTienenIdsFresh = new Set(creditosFresh.map(c => c.beneficiario_id));
      const cuotaBase = getCuotaBaseMes(mes, Number(anioFiltro), configCuotas);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      const pendientesFresh = data.pendientes.filter(b => !yaTienenIdsFresh.has(b.id));
      if (pendientesFresh.length === 0) throw new Error('No hay beneficiarios pendientes (ya todos generados)');
      const records = pendientesFresh.map(b => ({
        beneficiario_id: b.id,
        beneficiario_nombre: b.nombre,
        actividad_nombre: data.label,
        monto_original: getCreditoMesBeneficiario(mes, Number(anioFiltro), b, beneficiarios, cuotaBase, configCuotas),
        monto_disponible: getCreditoMesBeneficiario(mes, Number(anioFiltro), b, beneficiarios, cuotaBase, configCuotas),
        fecha: today,
        observaciones: data.label,
      }));
      await base44.entities.CreditoBeneficiario.bulkCreate(records);
      const totalMonto = records.reduce((s, r) => s + r.monto_original, 0);
      await base44.entities.MovimientoBanco.create({
        fecha: today,
        tipo: 'Egreso',
        concepto: `Reserva — ${data.label}`,
        monto: totalMonto,
        cuenta: 'Caja',
        origen: 'Crédito',
        observaciones: `${records.length} créditos generados`,
      });
      return { count: records.length, mes };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success(`${data.count} créditos de ${data.mes} generados`);
    },
    onError: (err) => toast.error(err.message || 'Error al generar créditos'),
  });

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    const set = new Set([actual, actual - 1, actual + 1, ...configCuotas.map(c => c.anio)]);
    return [...set].sort((a, b) => b - a);
  }, [configCuotas]);

  return (
    <div>
      <PageHeader title="Configuración" description="Valores de cuotas, meses con crédito y afiliaciones por año">
        <Select value={String(anioFiltro)} onValueChange={v => setAnioFiltro(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {anios.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Configuración de afiliaciones */}
      <ConfigAfiliacionPanel anio={Number(anioFiltro)} />

      {/* Clave de acceso administrativo */}
      <Card className="p-5 mb-6 border-slate-200 bg-slate-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-slate-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Clave de acceso administrativo</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Clave que se solicita al hacer clic en "Acceso administrativo" desde la página de consulta familiar.
                {claveAdminConfig?.clave_admin
                  ? <> Hay una clave configurada. </>
                  : <> <strong>No hay clave configurada</strong> — el acceso estará bloqueado hasta definir una. </>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={claveAdmin}
              onChange={e => setClaveAdmin(e.target.value)}
              placeholder={claveAdminConfig?.clave_admin ? '•••••••• (ingresar nueva)' : 'Definir clave'}
              className="w-48 h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!claveAdmin.trim()) { toast.error('Ingresá una clave'); return; }
                guardarClaveMut.mutate(claveAdmin.trim());
              }}
              disabled={guardarClaveMut.isPending || !claveAdmin.trim()}
            >
              <Save className="w-3 h-3 mr-1" />{claveAdminConfig?.clave_admin ? 'Cambiar' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Generación de créditos para meses bonificados */}
      {creditosData.length > 0 && (
        <div className="space-y-3 mb-6">
          {creditosData.map(({ mes, label, yaGenerados, pendientes, totalElegibles }) => {
            const montoCred = getMontoCreditoMes(mes, Number(anioFiltro), configCuotas);
            return (
              <Card key={mes} className="p-5 border-cyan-200 bg-cyan-50/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Gift className="w-5 h-5 text-cyan-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-sm text-cyan-900">Créditos de {mes} {anioFiltro}</h3>
                      <p className="text-xs text-cyan-700 mt-0.5">
                        Elegibles (al día + mes pagado): <strong>{totalElegibles}</strong>
                        {' · '}Ya generados: <strong>{yaGenerados.length}</strong>
                        {pendientes.length > 0 && <> {' · '}Pendientes: <strong className="text-cyan-900">{pendientes.length}</strong></>}
                        {' · '}Monto c/u: <strong>{formatMoney(montoCred)}</strong>
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => generarCreditosMut.mutate({ mes })}
                    disabled={generarCreditosMut.isPending || pendientes.length === 0}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {pendientes.length === 0 && totalElegibles > 0
                      ? <><CheckCircle2 className="w-4 h-4 mr-2" />Generados</>
                      : <><Gift className="w-4 h-4 mr-2" />Generar{pendientes.length > 0 ? ` (${pendientes.length})` : ''}</>}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabla de cuotas por mes */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" />Valores de cuota — {anioFiltro}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Definí el valor de cada mes. Marcá "Mes con crédito" para los meses que dividen la cuota en pago + crédito.
          </p>
        </div>

        <div className="divide-y">
          {MESES.map(mes => {
            const config = getConfig(mes);
            const sinCuota = MESES_SIN_CUOTA.includes(mes);
            const esBonificado = getEditValue(mes, 'es_bonificado_credito') === true;
            return (
              <div key={mes} className="flex items-center gap-3 p-3 hover:bg-muted/20">
                <div className="w-28">
                  <p className="font-medium text-sm">{mes}</p>
                  {sinCuota && <Badge variant="secondary" className="text-xs mt-0.5">Sin cuota</Badge>}
                  {esBonificado && !sinCuota && <Badge className="bg-cyan-100 text-cyan-700 border-cyan-300 border text-xs mt-0.5">Con crédito</Badge>}
                </div>

                {sinCuota ? (
                  <p className="text-xs text-muted-foreground flex-1">No genera deuda (no hay actividad)</p>
                ) : (
                  <div className="flex flex-1 items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Efectivo</Label>
                      <Input
                        type="number"
                        value={getEditValue(mes, 'monto_efectivo')}
                        onChange={e => setEditValue(mes, 'monto_efectivo', e.target.value)}
                        placeholder="25000"
                        className="w-32 h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Transferencia</Label>
                      <Input
                        type="number"
                        value={getEditValue(mes, 'monto_transferencia')}
                        onChange={e => setEditValue(mes, 'monto_transferencia', e.target.value)}
                        placeholder="27000"
                        className="w-32 h-8 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                      <Checkbox
                        checked={esBonificado}
                        onCheckedChange={(v) => setEditValue(mes, 'es_bonificado_credito', v === true)}
                      />
                      <span className="text-xs text-muted-foreground">Mes con crédito</span>
                    </label>
                    {esBonificado && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-cyan-600">Crédito %</Label>
                          <Input
                            type="number"
                            value={getEditValue(mes, 'porcentaje_credito') || 50}
                            onChange={e => setEditValue(mes, 'porcentaje_credito', e.target.value)}
                            placeholder="50"
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                        <Badge className="bg-cyan-100 text-cyan-700 border-cyan-300 border text-xs">
                          = {formatMoney(Math.round((parseFloat(getEditValue(mes, 'monto_efectivo')) || 0) * (parseFloat(getEditValue(mes, 'porcentaje_credito')) || 50) / 100))}
                        </Badge>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleSave(mes)} disabled={saveMut.isPending}>
                      <Save className="w-3 h-3 mr-1" />{config ? 'Actualizar' : 'Guardar'}
                    </Button>
                    {config && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMut.mutate(config.id)}>
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Info adicional */}
      <Card className="p-4 mt-4 bg-amber-50/40 border-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-1">
            <p><strong>Valores históricos:</strong> Al guardar un mes, los valores se propagan automáticamente a todos los meses siguientes. Si en Agosto hay un aumento, solo cambiás Agosto y se actualiza desde ahí en adelante. Los pagos de meses anteriores que se hagan tarde se cobran al valor original del mes.</p>
            <p><strong>Mes con crédito:</strong> Marcá los meses donde la cuota se divide en pago + crédito (como Julio). El crédito es un <strong>porcentaje configurable del valor en efectivo</strong> de ese mes (default 50%, con descuento de hermanos aplicado), sin importar el medio de pago usado. Se genera automáticamente al registrar el pago del mes (si el beneficiario está al día), o con el botón de arriba para generar en lote.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}