import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, Plus, Trash2, TrendingUp, DollarSign, Gift, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import VentaForm from '@/components/actividades/VentaForm';
import GastoActividadForm from '@/components/actividades/GastoActividadForm';
import DistribuirCreditosDialog from '@/components/actividades/DistribuirCreditosDialog';

const ESTADO_COLORS = {
  Planificada: 'bg-blue-100 text-blue-700 border-blue-200 border',
  'En curso': 'bg-amber-100 text-amber-700 border-amber-200 border',
  Finalizada: 'bg-green-100 text-green-700 border-green-200 border',
};

export default function ActividadDetalle({ actividad, beneficiarios, onBack, onEdit, onSaved }) {
  const [showVentaForm, setShowVentaForm] = useState(false);
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [showDistribuir, setShowDistribuir] = useState(false);
  const queryClient = useQueryClient();

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas-actividad', actividad.id],
    queryFn: () => base44.entities.VentaActividad.filter({ actividad_id: actividad.id }),
  });

  const { data: gastosAct = [] } = useQuery({
    queryKey: ['gastos-actividad', actividad.id],
    queryFn: () => base44.entities.GastoActividad.filter({ actividad_id: actividad.id }),
  });

  const { data: creditos = [] } = useQuery({
    queryKey: ['creditos-actividad', actividad.id],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ actividad_id: actividad.id }),
  });

  const deleteVentaMut = useMutation({
    mutationFn: id => base44.entities.VentaActividad.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividad.id] }),
  });

  const deleteGastoMut = useMutation({
    mutationFn: id => base44.entities.GastoActividad.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gastos-actividad', actividad.id] }),
  });

  const totalVentas = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const totalGastos = gastosAct.reduce((s, g) => s + (g.monto || 0), 0);
  const gananciaReal = totalVentas - totalGastos;
  const creditosAcreditados = creditos.length > 0;

  const getBen = (id) => beneficiarios.find(b => b.id === id);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividad.id] });
    queryClient.invalidateQueries({ queryKey: ['creditos-actividad', actividad.id] });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold">{actividad.nombre}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={ESTADO_COLORS[actividad.estado]}>{actividad.estado}</Badge>
              {actividad.tipo_producto && <span className="text-sm text-muted-foreground">{actividad.tipo_producto}</span>}
              <span className="text-sm text-muted-foreground">{actividad.fecha}</span>
            </div>
          </div>
        </div>
        <Button onClick={onEdit} variant="outline"><Pencil className="w-4 h-4 mr-2" />Editar</Button>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total recaudado</p>
          <p className="text-xl font-bold text-green-600">{formatMoney(totalVentas)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Gastos de producción</p>
          <p className="text-xl font-bold text-red-500">{formatMoney(totalGastos)}</p>
        </Card>
        <Card className={`p-3 text-center col-span-2 sm:col-span-1 ${gananciaReal >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-muted-foreground">Ganancia neta</p>
          <p className={`text-xl font-bold ${gananciaReal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatMoney(gananciaReal)}</p>
        </Card>
      </div>

      {/* Info distribución */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Badge variant="outline">Beneficiario: {actividad.porcentaje_beneficiario || 50}%</Badge>
        <Badge variant="outline">Grupo: {actividad.porcentaje_grupo || 50}%</Badge>
        {actividad.ramas_participantes?.length > 0 && (
          <Badge variant="secondary">{actividad.ramas_participantes.join(', ')}</Badge>
        )}
      </div>

      {/* Acción distribuir créditos */}
      {!creditosAcreditados && ventas.length > 0 && (
        <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-sm">Distribuir créditos a los participantes</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calculará el crédito de cada vendedor según su proporción de ventas y la ganancia neta ({formatMoney(Math.max(0, gananciaReal))}).
              </p>
            </div>
            <Button onClick={() => setShowDistribuir(true)}>
              <Gift className="w-4 h-4 mr-2" />Distribuir créditos
            </Button>
          </div>
        </Card>
      )}

      {creditosAcreditados && (
        <Card className="p-3 mb-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Créditos ya distribuidos a {creditos.length} beneficiario(s)</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por beneficiario */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />Participación por vendedor
              </CardTitle>
              <Button size="sm" onClick={() => setShowVentaForm(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 max-h-80 overflow-y-auto space-y-0">
            {ventas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Registrá cuánto vendió cada participante al finalizar la actividad
              </p>
            ) : ventas.map(v => {
              const ben = getBen(v.beneficiario_id);
              const pct = totalVentas > 0 ? Math.round((v.monto_recaudado / totalVentas) * 100) : 0;
              const creditoEst = gananciaReal > 0 ? Math.round(gananciaReal * (actividad.porcentaje_beneficiario || 50) / 100 * pct / 100 * 100) / 100 : 0;
              return (
                <div key={v.id} className="flex items-center justify-between py-2.5 border-b last:border-0 text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{ben?.nombre || v.beneficiario_nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.cantidad_vendida > 0 && `${v.cantidad_vendida} uds · `}Recaudó {formatMoney(v.monto_recaudado)} ({pct}%)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {gananciaReal > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Crédito est.</p>
                        <p className="font-semibold text-primary">{formatMoney(creditoEst)}</p>
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteVentaMut.mutate(v.id)}>
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Gastos de producción */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />Gastos de producción
              </CardTitle>
              <Button size="sm" onClick={() => setShowGastoForm(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 max-h-80 overflow-y-auto space-y-0">
            {gastosAct.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Registrá los costos de producción (materiales, insumos, etc.)
              </p>
            ) : gastosAct.map(g => (
              <div key={g.id} className="flex items-center justify-between py-2.5 border-b last:border-0 text-sm">
                <div>
                  <p className="font-medium">{g.descripcion}</p>
                  <p className="text-xs text-muted-foreground">{g.categoria}{g.fecha ? ` · ${g.fecha}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-500">{formatMoney(g.monto)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteGastoMut.mutate(g.id)}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Créditos ya acreditados */}
      {creditosAcreditados && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4" />Créditos acreditados</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {creditos.map(cr => (
              <div key={cr.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div>
                  <p className="font-medium">{cr.beneficiario_nombre}</p>
                  <p className="text-xs text-muted-foreground">Disponible: {formatMoney(cr.monto_disponible)}</p>
                </div>
                <p className="font-bold text-primary">{formatMoney(cr.monto_original)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showVentaForm && (
        <VentaForm
          open
          actividad={actividad}
          beneficiarios={beneficiarios}
          onClose={() => setShowVentaForm(false)}
          onSaved={() => { invalidateAll(); setShowVentaForm(false); }}
        />
      )}
      {showGastoForm && (
        <GastoActividadForm
          open
          actividad={actividad}
          onClose={() => setShowGastoForm(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['gastos-actividad', actividad.id] }); setShowGastoForm(false); }}
        />
      )}
      {showDistribuir && (
        <DistribuirCreditosDialog
          open
          actividad={actividad}
          ventas={ventas}
          gananciaReal={gananciaReal}
          beneficiarios={beneficiarios}
          onClose={() => setShowDistribuir(false)}
          onSaved={() => { invalidateAll(); setShowDistribuir(false); onSaved(); }}
        />
      )}
    </div>
  );
}