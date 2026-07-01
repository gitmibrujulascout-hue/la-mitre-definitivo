import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { MESES, MESES_SIN_CUOTA, formatMoney, esBeneficiarioConCuota, estaAlDia, getCuotaBeneficiario, getCuotaBaseMes, JULIO_DESCUENTO_AL_DIA } from '@/lib/ramaUtils';
import { DollarSign, Save, Plus, Trash2, Gift, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';

export default function ConfiguracionCuotas() {
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());
  const [editValues, setEditValues] = useState({});
  const queryClient = useQueryClient();

  const { data: configCuotas = [], isLoading } = useQuery({
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
    mutationFn: async ({ mes, montoEfectivo, montoTransferencia }) => {
      const existing = getConfig(mes);
      const data = {
        mes,
        anio: Number(anioFiltro),
        monto_efectivo: parseFloat(montoEfectivo) || 0,
        monto_transferencia: parseFloat(montoTransferencia) || 0,
      };
      if (existing) {
        return base44.entities.ConfigCuota.update(existing.id, data);
      }
      return base44.entities.ConfigCuota.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_cuotas'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      toast.success('Cuota guardada');
    },
  });

  const handleSave = (mes) => {
    const montoEfectivo = getEditValue(mes, 'monto_efectivo');
    const montoTransferencia = getEditValue(mes, 'monto_transferencia');
    if (!montoEfectivo) {
      toast.error('El monto en efectivo es obligatorio');
      return;
    }
    saveMut.mutate({ mes, montoEfectivo, montoTransferencia });
  };

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ConfigCuota.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_cuotas'] });
      toast.success('Configuración eliminada');
    },
  });

  // === Generar créditos de Julio ===
  const [generandoCreditos, setGenerandoCreditos] = useState(false);

  const beneficiariosAlDiaJulio = useMemo(() => {
    const anio = Number(anioFiltro);
    const activos = beneficiarios.filter(b => b.activo !== false);
    return activos.filter(b => {
      if (!esBeneficiarioConCuota(b)) return false;
      const pagosBen = pagos.filter(p => p.beneficiario_id === b.id && Number(p.anio) === anio && p.tipo_pago !== 'Campamento');
      const mesesCubiertos = new Set(pagosBen.flatMap(p => p.meses || (p.mes ? [p.mes] : [])));
      // Verificar que tiene todos los meses hasta Junio pagados
      const mesesHastaJunio = MESES.slice(0, 6).filter(m => !MESES_SIN_CUOTA.includes(m));
      return mesesHastaJunio.every(m => mesesCubiertos.has(m));
    });
  }, [beneficiarios, pagos, anioFiltro]);

  const creditosJulioExistentes = useMemo(() => {
    const label = `Crédito Julio ${anioFiltro}`;
    return creditos.filter(c => c.observaciones === label);
  }, [creditos, anioFiltro]);

  const generarCreditosMut = useMutation({
    mutationFn: async () => {
      const label = `Crédito Julio ${anioFiltro}`;
      const yaTienen = new Set(creditosJulioExistentes.map(c => c.beneficiario_id));
      const pendientes = beneficiariosAlDiaJulio.filter(b => !yaTienen.has(b.id));

      if (pendientes.length === 0) {
        throw new Error('No hay beneficiarios pendientes de generar crédito');
      }

      const activos = beneficiarios.filter(b => b.activo !== false);
      const baseJulio = getCuotaBaseMes('Julio', Number(anioFiltro), configCuotas);

      const records = pendientes.map(b => ({
        beneficiario_id: b.id,
        beneficiario_nombre: b.nombre,
        actividad_nombre: `Crédito Julio ${anioFiltro}`,
        monto_original: Math.round(getCuotaBeneficiario(b, activos, baseJulio) * JULIO_DESCUENTO_AL_DIA),
        monto_disponible: Math.round(getCuotaBeneficiario(b, activos, baseJulio) * JULIO_DESCUENTO_AL_DIA),
        fecha: new Date().toISOString().split('T')[0],
        observaciones: label,
      }));

      const result = await base44.entities.CreditoBeneficiario.bulkCreate(records);
      return { count: records.length, result };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      toast.success(`${data.count} créditos de Julio generados`);
      setGenerandoCreditos(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Error al generar créditos');
      setGenerandoCreditos(false);
    },
  });

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    const set = new Set([actual, actual - 1, actual + 1, ...configCuotas.map(c => c.anio)]);
    return [...set].sort((a, b) => b - a);
  }, [configCuotas]);

  return (
    <div>
      <PageHeader title="Configuración de Cuotas" description="Definí los valores de cuota por mes y año">
        <Select value={String(anioFiltro)} onValueChange={v => setAnioFiltro(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {anios.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Generar créditos de Julio */}
      <Card className="p-5 mb-6 border-cyan-200 bg-cyan-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-cyan-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-cyan-900">Créditos de Julio {anioFiltro}</h3>
              <p className="text-xs text-cyan-700 mt-0.5">
                Beneficiarios al día hasta Junio: <strong>{beneficiariosAlDiaJulio.length}</strong>
                {' · '}Créditos ya generados: <strong>{creditosJulioExistentes.length}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cada beneficiario al día paga 50% de la cuota de Julio y recibe el otro 50% como crédito en su cuenta.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setGenerandoCreditos(true); generarCreditosMut.mutate(); }}
            disabled={generandoCreditos || generarCreditosMut.isPending || beneficiariosAlDiaJulio.length === 0 || creditosJulioExistentes.length >= beneficiariosAlDiaJulio.length}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {creditosJulioExistentes.length >= beneficiariosAlDiaJulio.length && beneficiariosAlDiaJulio.length > 0
              ? <><CheckCircle2 className="w-4 h-4 mr-2" />Créditos generados</>
              : <><Gift className="w-4 h-4 mr-2" />Generar créditos</>}
          </Button>
        </div>
      </Card>

      {/* Tabla de cuotas por mes */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" />Valores de cuota — {anioFiltro}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Definí el valor de cada mes. Los meses sin configurar usan el valor por defecto ($25.000 efectivo).
          </p>
        </div>

        <div className="divide-y">
          {MESES.map(mes => {
            const config = getConfig(mes);
            const sinCuota = MESES_SIN_CUOTA.includes(mes);
            const esJulio = mes === 'Julio';
            return (
              <div key={mes} className="flex items-center gap-3 p-3 hover:bg-muted/20">
                <div className="w-28">
                  <p className="font-medium text-sm">{mes}</p>
                  {sinCuota && <Badge variant="secondary" className="text-xs mt-0.5">Sin cuota</Badge>}
                  {esJulio && <Badge className="bg-cyan-100 text-cyan-700 border-cyan-300 border text-xs mt-0.5">50% al día</Badge>}
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
                    <Button size="sm" variant="outline" onClick={() => handleSave(mes)} disabled={saveMut.isPending}>
                      <Save className="w-3 h-3 mr-1" />{config ? 'Actualizar' : 'Guardar'}
                    </Button>
                    {config && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMut.mutate(config.id)}>
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    )}
                    {config && (
                      <Badge variant="outline" className="text-xs ml-1">
                        Actual: {formatMoney(config.monto_efectivo)}
                      </Badge>
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
            <p><strong>Valores históricos:</strong> Cada mes mantiene su valor definido. Si en Agosto hay un aumento, solo cambiás el valor de Agosto en adelante. Los pagos de meses anteriores que se hagan tarde se cobran al valor original del mes.</p>
            <p><strong>Descuento de Julio:</strong> Los beneficiarios al día con cuotas hasta Junio pagan solo el 50% de Julio. El otro 50% se acredita como crédito en su cuenta (usá el botón de arriba para generar los créditos).</p>
          </div>
        </div>
      </Card>
    </div>
  );
}