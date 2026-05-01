import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Pencil, Plus, Trash2, TrendingUp, DollarSign, Users } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import VentaForm from '@/components/actividades/VentaForm';
import GastoActividadForm from '@/components/actividades/GastoActividadForm';

const ESTADO_COLORS = {
  Planificada: 'bg-blue-100 text-blue-700 border-blue-200 border',
  'En curso': 'bg-amber-100 text-amber-700 border-amber-200 border',
  Finalizada: 'bg-green-100 text-green-700 border-green-200 border',
};

export default function ActividadDetalle({ actividad, beneficiarios, onBack, onEdit, onSaved }) {
  const [showVentaForm, setShowVentaForm] = useState(false);
  const [showGastoForm, setShowGastoForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas-actividad', actividad.id],
    queryFn: () => base44.entities.VentaActividad.filter({ actividad_id: actividad.id }),
  });

  const { data: gastosAct = [] } = useQuery({
    queryKey: ['gastos-actividad', actividad.id],
    queryFn: () => base44.entities.GastoActividad.filter({ actividad_id: actividad.id }),
  });

  const deleteVentaMut = useMutation({
    mutationFn: id => base44.entities.VentaActividad.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividad.id] }); toast.success('Venta eliminada'); },
  });

  const deleteGastoMut = useMutation({
    mutationFn: id => base44.entities.GastoActividad.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gastos-actividad', actividad.id] }); toast.success('Gasto eliminado'); },
  });

  const totalVentas = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const totalCredBen = ventas.reduce((s, v) => s + (v.credito_beneficiario || 0), 0);
  const totalCredGrupo = ventas.reduce((s, v) => s + (v.credito_grupo || 0), 0);
  const totalGastos = gastosAct.reduce((s, g) => s + (g.monto || 0), 0);
  const gananciaReal = totalVentas - totalGastos;

  const getBen = (id) => beneficiarios.find(b => b.id === id);

  return (
    <div>
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
        <Button onClick={onEdit}><Pencil className="w-4 h-4 mr-2" />Editar</Button>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total recaudado</p>
          <p className="text-xl font-bold text-green-600">{formatMoney(totalVentas)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="text-xl font-bold text-red-500">{formatMoney(totalGastos)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Ganancia neta</p>
          <p className={`text-xl font-bold ${gananciaReal >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(gananciaReal)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Créditos a beneficiarios</p>
          <p className="text-xl font-bold text-primary">{formatMoney(totalCredBen)}</p>
        </Card>
      </div>

      {/* Configuración de porcentajes */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Badge variant="outline">Grupo: {actividad.porcentaje_grupo || 50}%</Badge>
        <Badge variant="outline">Beneficiario: {actividad.porcentaje_beneficiario || 50}%</Badge>
        {actividad.ramas_participantes?.length > 0 && (
          <Badge variant="secondary"><Users className="w-3 h-3 mr-1" />{actividad.ramas_participantes.join(', ')}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por beneficiario */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />Ventas por beneficiario</CardTitle>
              <Button size="sm" onClick={() => setShowVentaForm(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 max-h-80 overflow-y-auto">
            {ventas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin ventas registradas</p>
            ) : ventas.map(v => {
              const ben = getBen(v.beneficiario_id);
              return (
                <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <p className="font-medium">{ben?.nombre || v.beneficiario_nombre}</p>
                    <p className="text-xs text-muted-foreground">{v.cantidad_vendida} uds · Recaudó {formatMoney(v.monto_recaudado)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Crédito</p>
                      <p className="font-semibold text-primary">{formatMoney(v.credito_beneficiario)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteVentaMut.mutate(v.id)}>
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Gastos de la actividad */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" />Gastos de la actividad</CardTitle>
              <Button size="sm" onClick={() => setShowGastoForm(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 max-h-80 overflow-y-auto">
            {gastosAct.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin gastos registrados</p>
            ) : gastosAct.map(g => (
              <div key={g.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div>
                  <p className="font-medium">{g.descripcion}</p>
                  <p className="text-xs text-muted-foreground">{g.categoria} · {g.fecha}</p>
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

      {showVentaForm && (
        <VentaForm
          open
          actividad={actividad}
          beneficiarios={beneficiarios}
          onClose={() => setShowVentaForm(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividad.id] }); setShowVentaForm(false); }}
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
    </div>
  );
}