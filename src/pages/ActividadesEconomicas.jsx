import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, TrendingUp, DollarSign, Users, Wallet, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import ActividadForm from '@/components/actividades/ActividadForm';
import ActividadDetalle from '@/components/actividades/ActividadDetalle';
import CreditosConsulta from '@/components/actividades/CreditosConsulta';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatMoney } from '@/lib/ramaUtils';

const ESTADO_COLORS = {
  Planificada: 'bg-blue-100 text-blue-700 border-blue-200 border',
  'En curso': 'bg-amber-100 text-amber-700 border-amber-200 border',
  Finalizada: 'bg-green-100 text-green-700 border-green-200 border',
};

export default function ActividadesEconomicas() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: actividades = [], isLoading } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => base44.entities.ActividadEconomica.list('-fecha', 100),
  });
  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  // Fetch real de ventas y gastos para calcular totales precisos
  const { data: todasVentas = [] } = useQuery({
    queryKey: ['ventas-todas-act'],
    queryFn: () => base44.entities.VentaActividad.list('-created_date', 5000),
  });
  const { data: todosGastos = [] } = useQuery({
    queryKey: ['gastos-todos-act'],
    queryFn: () => base44.entities.Gasto.list('-created_date', 5000),
  });

  // Agrupar por actividad_id
  const statsPorActividad = React.useMemo(() => {
    const map = {};
    todasVentas.forEach(v => {
      if (!v.actividad_id) return;
      if (!map[v.actividad_id]) map[v.actividad_id] = { ingreso: 0, ventas: 0 };
      map[v.actividad_id].ingreso += v.monto_recaudado || 0;
      map[v.actividad_id].ventas++;
    });
    todosGastos.forEach(g => {
      if (!g.actividad_id) return;
      if (!map[g.actividad_id]) map[g.actividad_id] = { ingreso: 0, ventas: 0 };
      map[g.actividad_id].costo = (map[g.actividad_id].costo || 0) + (g.monto || 0);
    });
    return map;
  }, [todasVentas, todosGastos]);

  const filtered = actividades.filter(a =>
    !search || a.nombre?.toLowerCase().includes(search.toLowerCase()) || a.tipo_producto?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['actividades'] });
    setShowForm(false);
    setEditing(null);
  };

  // Derivar siempre de la query fresca para que los cambios (fechas, etc.) se reflejen
  const actividadActual = detalle ? (actividades.find(a => a.id === detalle.id) || detalle) : null;

  if (detalle) {
    return (
      <ActividadDetalle
        actividad={actividadActual}
        beneficiarios={beneficiarios}
        onBack={() => {
          queryClient.invalidateQueries({ queryKey: ['ventas-todas-act'] });
          queryClient.invalidateQueries({ queryKey: ['gastos-todos-act'] });
          queryClient.invalidateQueries({ queryKey: ['actividades'] });
          setDetalle(null);
        }}
        onEdit={() => { setEditing(actividadActual); setDetalle(null); }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['actividades'] });
          queryClient.invalidateQueries({ queryKey: ['ventas-todas-act'] });
          queryClient.invalidateQueries({ queryKey: ['gastos-todos-act'] });
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Actividades Económicas" description="Gestión de actividades de recaudación del grupo">
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Nueva Actividad</Button>
      </PageHeader>

      <Tabs defaultValue="actividades">
        <TabsList className="mb-6">
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
          <TabsTrigger value="creditos"><Wallet className="w-4 h-4 mr-1" />Créditos</TabsTrigger>
        </TabsList>
        <TabsContent value="actividades">
      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar actividad..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </Card>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay actividades económicas registradas</p>
          <p className="text-sm mt-1">Creá tu primera actividad de recaudación</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => {
            const stats = statsPorActividad[a.id] || {};
            const ingreso = stats.ingreso || 0;
            const costo = stats.costo || 0;
            const ganancia = ingreso - costo;
            return (
              <Card
                key={a.id}
                className="p-5 cursor-pointer hover:shadow-md transition-shadow border hover:border-primary/30"
                onClick={() => setDetalle(a)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{a.nombre}</h3>
                    {a.tipo_producto && <p className="text-xs text-muted-foreground mt-0.5">{a.tipo_producto}</p>}
                  </div>
                  <Badge className={ESTADO_COLORS[a.estado] || 'bg-secondary'}>{a.estado}</Badge>
                </div>
                {stats.ventas > 0 || costo > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-muted/50 rounded p-2 text-center">
                        <p className="text-xs text-muted-foreground">Ingreso</p>
                        <p className="font-semibold text-green-600">{formatMoney(ingreso)}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2 text-center">
                        <p className="text-xs text-muted-foreground">Costo</p>
                        <p className="font-semibold text-red-500">{formatMoney(costo)}</p>
                      </div>
                    </div>
                    <div className={`mt-2 rounded p-2 text-center border ${ganancia >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className={`text-xs ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>Ganancia neta</p>
                      <p className={`font-bold ${ganancia >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatMoney(ganancia)}</p>
                    </div>
                  </>
                ) : (
                  <div className="bg-muted/30 rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">Sin ventas registradas</p>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{a.fecha}</span>
                  {a.ganancia_grupo_acreditada && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />Acreditada
                    </span>
                  )}
                  {a.ramas_participantes?.length > 0 && (
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a.ramas_participantes.join(', ')}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {(showForm || editing) && (
        <ActividadForm
          open
          initialData={editing}
          beneficiarios={beneficiarios}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
        </TabsContent>
        <TabsContent value="creditos">
          <CreditosConsulta beneficiarios={beneficiarios} />
        </TabsContent>
      </Tabs>
    </div>
  );
}