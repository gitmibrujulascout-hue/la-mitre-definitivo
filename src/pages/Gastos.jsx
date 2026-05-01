import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Search, FileText, Upload, Pencil } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import GastoForm from '@/components/gastos/GastoForm';
import ImportMasivaGastosDialog from '@/components/gastos/ImportMasivaGastosDialog';
import { formatMoney } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const CATEGORIAS = ['Materiales', 'Alimentos', 'Transporte', 'Servicios', 'Mantenimiento', 'Campamento', 'Otro'];

export default function Gastos() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('todas');
  const [montoMin, setMontoMin] = useState('');
  const [montoMax, setMontoMax] = useState('');
  const queryClient = useQueryClient();

  const { data: gastos = [], isLoading } = useQuery({
    queryKey: ['gastos'],
    queryFn: () => base44.entities.Gasto.list('-fecha', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Gasto.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gastos'] }); toast.success('Gasto eliminado'); },
  });

  const filtered = useMemo(() => gastos.filter(g => {
    const matchSearch = !search || g.descripcion?.toLowerCase().includes(search.toLowerCase()) || g.proveedor?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategoria === 'todas' || g.categoria === filterCategoria;
    const matchMin = !montoMin || (g.monto || 0) >= parseFloat(montoMin);
    const matchMax = !montoMax || (g.monto || 0) <= parseFloat(montoMax);
    return matchSearch && matchCat && matchMin && matchMax;
  }), [gastos, search, filterCategoria, montoMin, montoMax]);

  const totalFiltrado = filtered.reduce((sum, g) => sum + (g.monto || 0), 0);

  return (
    <div>
      <PageHeader title="Gastos" description={`Mostrando ${filtered.length} gastos — ${formatMoney(totalFiltrado)}`}>
        <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-2" />Carga masiva</Button>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Nuevo Gasto</Button>
      </PageHeader>

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar descripción o proveedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Monto mín." type="number" value={montoMin} onChange={e => setMontoMin(e.target.value)} className="w-full sm:w-32" />
          <Input placeholder="Monto máx." type="number" value={montoMax} onChange={e => setMontoMax(e.target.value)} className="w-full sm:w-32" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Proveedor</TableHead>
              <TableHead>Archivo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay gastos que coincidan con los filtros</TableCell></TableRow>
            ) : (
              filtered.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.descripcion}</TableCell>
                  <TableCell><Badge variant="secondary">{g.categoria || '—'}</Badge></TableCell>
                  <TableCell className="font-semibold text-red-500">{formatMoney(g.monto)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{g.fecha}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{g.proveedor || '—'}</TableCell>
                  <TableCell>
                    {g.archivo_url ? (
                      <a href={g.archivo_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-4 h-4 text-primary" />
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(g)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(g.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {showForm && <GastoForm open onClose={() => setShowForm(false)} />}
      {editing && <GastoForm open onClose={() => setEditing(null)} initialData={editing} />}
      {showImport && <ImportMasivaGastosDialog open onClose={() => setShowImport(false)} />}
    </div>
  );
}