import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, MapPin, Calendar, Users, DollarSign } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import CampamentoForm from '@/components/campamentos/CampamentoForm';
import { formatMoney } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Campamentos() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: campamentos = [], isLoading } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list('-created_date'),
  });

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Campamento.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campamentos'] }); toast.success('Campamento eliminado'); },
  });

  const getBenName = (id) => beneficiarios.find(b => b.id === id)?.nombre || id;

  return (
    <div>
      <PageHeader title="Campamentos" description="Eventos y actividades especiales">
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Nuevo Campamento</Button>
      </PageHeader>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Cargando...</p>
      ) : campamentos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No hay campamentos creados aún</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {campamentos.map(c => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg">{c.nombre}</h3>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="space-y-2 text-sm">
                {c.fecha_inicio && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {c.fecha_inicio}{c.fecha_fin ? ` — ${c.fecha_fin}` : ''}
                  </div>
                )}
                {c.ubicacion && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />{c.ubicacion}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">{formatMoney(c.costo_por_persona)}</span>
                  <span className="text-muted-foreground">por persona</span>
                </div>
              </div>

              {c.ramas_participantes?.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {c.ramas_participantes.map(r => <RamaBadge key={r} rama={r} />)}
                </div>
              )}

              {c.beneficiarios_ids?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{c.beneficiarios_ids.length} asistentes</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.beneficiarios_ids.slice(0, 8).map(id => (
                      <Badge key={id} variant="secondary" className="text-xs">{getBenName(id)}</Badge>
                    ))}
                    {c.beneficiarios_ids.length > 8 && (
                      <Badge variant="secondary" className="text-xs">+{c.beneficiarios_ids.length - 8} más</Badge>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && <CampamentoForm open onClose={() => setShowForm(false)} beneficiarios={beneficiarios} />}
    </div>
  );
}