import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, TrendingUp, DollarSign, Users } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import ActividadForm from '@/components/actividades/ActividadForm';
import ActividadDetalle from '@/components/actividades/ActividadDetalle';
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

  const filtered = actividades.filter(a =>
    !search || a.nombre?.toLowerCase().includes(search.toLowerCase()) || a.tipo_producto?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['actividades'] });
    setShowForm(false);
    setEditing(null);
  };

  if (detalle) {
    return (
      <ActividadDetalle
        actividad={detalle}
        beneficiarios={beneficiarios}
        onBack={() => setDetalle(null)}
        onEdit={() => { setEditing(detalle); setDetalle(null); }}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ['actividades'] }); }}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Actividades Económicas" description="Gestión de actividades de recaudación del grupo">
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Nueva Actividad</Button>
      </PageHeader>

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
            const ganancia = (a.ingreso_total || 0) - (a.costo_total || 0);
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
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground">Ingreso</p>
                    <p className="font-semibold text-green-600">{formatMoney(a.ingreso_total || 0)}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <p className="text-xs text-muted-foreground">Costo</p>
                    <p className="font-semibold text-red-500">{formatMoney(a.costo_total || 0)}</p>
                  </div>
                </div>
                {ganancia > 0 && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 text-center">
                    <p className="text-xs text-green-600">Ganancia neta</p>
                    <p className="font-bold text-green-700">{formatMoney(ganancia)}</p>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{a.fecha}</span>
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
    </div>
  );
}