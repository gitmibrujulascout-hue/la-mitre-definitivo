import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, MapPin, Calendar, Users, DollarSign, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import CampamentoForm from '@/components/campamentos/CampamentoForm';
import { formatMoney, RAMAS } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Campamentos() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRama, setFilterRama] = useState('todas');
  const [montoMin, setMontoMin] = useState('');
  const [montoMax, setMontoMax] = useState('');
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

  const filtered = useMemo(() => campamentos.filter(c => {
    const matchSearch = !search || c.nombre?.toLowerCase().includes(search.toLowerCase()) || c.ubicacion?.toLowerCase().includes(search.toLowerCase());
    const matchRama = filterRama === 'todas' || c.ramas_participantes?.includes(filterRama);
    const matchMin = !montoMin || (c.costo_por_persona || 0) >= parseFloat(montoMin);
    const matchMax = !montoMax || (c.costo_por_persona || 0) <= parseFloat(montoMax);
    return matchSearch && matchRama && matchMin && matchMax;
  }), [campamentos, search, filterRama, montoMin, montoMax]);

  return (
    <div>
      <PageHeader title="Campamentos" description="Eventos y actividades especiales">
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Nuevo Campamento</Button>
      </PageHeader>

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o ubicación..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterRama} onValueChange={setFilterRama}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las ramas</SelectItem>
              {RAMAS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Costo mín." type="number" value={montoMin} onChange={e => setMontoMin(e.target.value)} className="w-full sm:w-32" />
          <Input placeholder="Costo máx." type="number" value={montoMax} onChange={e => setMontoMax(e.target.value)} className="w-full sm:w-32" />
        </div>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Cargando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No hay campamentos que coincidan con los filtros</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(c => (
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