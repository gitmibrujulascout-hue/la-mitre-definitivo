import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, MapPin, Calendar, Users, DollarSign, Search, Pencil, Eye } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import CampamentoForm from '@/components/campamentos/CampamentoForm';
import CampamentoDetalle from '@/components/campamentos/CampamentoDetalle';
import { formatMoney, RAMAS } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Campamentos() {
  const [showForm, setShowForm] = useState(false);
  const [editingCamp, setEditingCamp] = useState(null);
  const [viewingCamp, setViewingCamp] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRama, setFilterRama] = useState('todas');
  const [mostrarPasados, setMostrarPasados] = useState(false);
  const hoy = new Date().toISOString().split('T')[0];
  const queryClient = useQueryClient();

  const { data: campamentos = [], isLoading } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list('-created_date'),
  });

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos'],
    queryFn: () => base44.entities.Gasto.list('-fecha', 500),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Campamento.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campamentos'] }); toast.success('Campamento eliminado'); },
  });

  const getBenName = (id) => beneficiarios.find(b => b.id === id)?.nombre || id;

  const filtered = useMemo(() => {
    const sorted = [...campamentos].sort((a, b) => {
      const fa = a.fecha_inicio || '';
      const fb = b.fecha_inicio || '';
      return fa.localeCompare(fb);
    });
    return sorted.filter(c => {
      const matchSearch = !search || c.nombre?.toLowerCase().includes(search.toLowerCase()) || c.ubicacion?.toLowerCase().includes(search.toLowerCase());
      const matchRama = filterRama === 'todas' || c.ramas_participantes?.includes(filterRama);
      const esPasado = c.fecha_fin ? c.fecha_fin < hoy : (c.fecha_inicio ? c.fecha_inicio < hoy : false);
      const matchTemporal = mostrarPasados || !esPasado;
      return matchSearch && matchRama && matchTemporal;
    });
  }, [campamentos, search, filterRama, mostrarPasados, hoy]);

  // Si estamos viendo un detalle, refrescamos el campamento desde la lista actualizada
  const campamentoActualizado = viewingCamp
    ? campamentos.find(c => c.id === viewingCamp.id) || viewingCamp
    : null;

  if (campamentoActualizado && !editingCamp) {
    return (
      <div>
        <CampamentoDetalle
          campamento={campamentoActualizado}
          beneficiarios={beneficiarios}
          pagos={pagos}
          gastos={gastos}
          onBack={() => setViewingCamp(null)}
          onEdit={() => { setEditingCamp(campamentoActualizado); }}
        />
        {editingCamp && (
          <CampamentoForm
            open
            onClose={() => setEditingCamp(null)}
            beneficiarios={beneficiarios}
            campamento={editingCamp}
          />
        )}
      </div>
    );
  }

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
          <Button variant={mostrarPasados ? 'default' : 'outline'} onClick={() => setMostrarPasados(v => !v)} className="whitespace-nowrap">
            {mostrarPasados ? 'Ocultar pasados' : 'Ver todos'}
          </Button>
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
          {filtered.map(c => {
            const totalPersonas = (c.beneficiarios_ids?.length || 0) + (c.adultos_ids?.length || 0);
            return (
              <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg">{c.nombre}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewingCamp(c)}>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingCamp(c); }}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
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
                    <span className="text-muted-foreground">por niño</span>
                    {c.adultos_pagan && <Badge variant="outline" className="text-xs">Adultos abonan</Badge>}
                  </div>
                  {totalPersonas > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{c.beneficiarios_ids?.length || 0} niños · {c.adultos_ids?.length || 0} adultos</span>
                    </div>
                  )}
                </div>

                {c.ramas_participantes?.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {c.ramas_participantes.map(r => <RamaBadge key={r} rama={r} />)}
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setViewingCamp(c)}>
                  <Eye className="w-3.5 h-3.5 mr-2" />Ver detalle y listado
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <CampamentoForm open onClose={() => setShowForm(false)} beneficiarios={beneficiarios} />
      )}
      {editingCamp && !viewingCamp && (
        <CampamentoForm open onClose={() => setEditingCamp(null)} beneficiarios={beneficiarios} campamento={editingCamp} />
      )}
    </div>
  );
}