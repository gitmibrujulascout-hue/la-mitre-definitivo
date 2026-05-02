import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Upload, MoreHorizontal, Pencil, Trash2, Award, UserCog, Download } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import BeneficiarioForm from '@/components/beneficiarios/BeneficiarioForm';
import ImportBeneficiariosDialog from '@/components/beneficiarios/ImportBeneficiariosDialog';
import { TODOS_LOS_ROLES } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Beneficiarios() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDni, setFilterDni] = useState('');
  const [filterRama, setFilterRama] = useState('todas');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterFuncion, setFilterFuncion] = useState('todas');
  const [selected, setSelected] = useState([]);

  const queryClient = useQueryClient();
  const { data: beneficiarios = [], isLoading } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const createMutation = useMutation({
    mutationFn: data => base44.entities.Beneficiario.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beneficiarios'] }); setShowForm(false); toast.success('Beneficiario creado'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Beneficiario.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beneficiarios'] }); setEditing(null); toast.success('Beneficiario actualizado'); },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Beneficiario.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beneficiarios'] }); toast.success('Beneficiario eliminado'); },
  });

  const funciones = [...new Set(beneficiarios.map(b => b.funcion).filter(Boolean))].sort();

  const ORDEN_RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers', 'Voluntario', 'Educador'];

  const filtered = beneficiarios
    .filter(b => {
      const matchSearch = !search || b.nombre?.toLowerCase().includes(search.toLowerCase());
      const matchDni = !filterDni || b.dni?.includes(filterDni);
      const matchRama = filterRama === 'todas' || b.rama === filterRama;
      const matchTipo = filterTipo === 'todos' || b.tipo === filterTipo || (!b.tipo && filterTipo === 'Beneficiario');
      const matchFuncion = filterFuncion === 'todas' || b.funcion === filterFuncion;
      return matchSearch && matchDni && matchRama && matchTipo && matchFuncion;
    })
    .sort((a, b) => {
      const ra = ORDEN_RAMAS.indexOf(a.rama) === -1 ? 99 : ORDEN_RAMAS.indexOf(a.rama);
      const rb = ORDEN_RAMAS.indexOf(b.rama) === -1 ? 99 : ORDEN_RAMAS.indexOf(b.rama);
      if (ra !== rb) return ra - rb;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

  const exportarCSV = () => {
    const cols = ['Nombre', 'DNI', 'Fecha Nac.', 'Rama', 'Tipo', 'Función', 'Teléfono', 'Email', 'Becado'];
    const rows = filtered.map(b => [
      b.nombre || '',
      b.dni || '',
      b.fecha_nacimiento || '',
      b.rama || '',
      b.tipo || '',
      b.funcion || '',
      b.telefono_contacto || '',
      b.email_contacto || '',
      b.becado ? 'Sí' : 'No',
    ]);
    const csv = [cols, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'beneficiarios.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const allFilteredIds = filtered.map(b => b.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.includes(id));
  const someSelected = selected.length > 0;

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(allSelected ? [] : allFilteredIds);

  const deleteSelected = async () => {
    if (!confirm(`¿Eliminar ${selected.length} beneficiario(s)?`)) return;
    for (const id of selected) await base44.entities.Beneficiario.delete(id);
    queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
    setSelected([]);
    toast.success(`${selected.length} beneficiarios eliminados`);
  };

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div>
      <PageHeader title="Beneficiarios" description="Gestión de miembros del grupo scout">
        <Button variant="outline" onClick={exportarCSV}>
          <Download className="w-4 h-4 mr-2" />Exportar
        </Button>
        <Button variant="outline" onClick={() => setShowImport(true)}>
          <Upload className="w-4 h-4 mr-2" />Importar
        </Button>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />Nuevo
        </Button>
      </PageHeader>

      {/* Filtros */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Input placeholder="Filtrar por DNI..." value={filterDni} onChange={e => setFilterDni(e.target.value)} className="w-full sm:w-44" />
          <Select value={filterRama} onValueChange={setFilterRama}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las ramas</SelectItem>
              {TODOS_LOS_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="Beneficiario">Solo beneficiarios</SelectItem>
              <SelectItem value="Voluntario">Solo voluntarios</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterFuncion} onValueChange={setFilterFuncion}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Todas las funciones" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las funciones</SelectItem>
              {funciones.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Barra de acciones masivas */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">{selected.length} seleccionado(s)</span>
          <Button size="sm" variant="destructive" onClick={deleteSelected}>
            <Trash2 className="w-4 h-4 mr-1" />Eliminar seleccionados
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected([])}>Deseleccionar</Button>
        </div>
      )}

      {/* Tabla */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead className="hidden sm:table-cell">DNI</TableHead>
              <TableHead className="hidden md:table-cell">Función</TableHead>
              <TableHead className="hidden lg:table-cell">Cumpleaños</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay beneficiarios</TableCell></TableRow>
            ) : (
              filtered.map(b => {
                const edad = b.fecha_nacimiento
                  ? Math.floor((new Date() - new Date(b.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000))
                  : null;
                const isChecked = selected.includes(b.id);
                return (
                <TableRow key={b.id} className={`hover:bg-muted/30 ${isChecked ? 'bg-primary/5' : ''}`}>
                  <TableCell>
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(b.id)} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {b.nombre}
                    {edad !== null && edad < 25 && <span className="text-muted-foreground font-normal ml-1">({edad} años)</span>}
                  </TableCell>
                  <TableCell><RamaBadge rama={b.rama} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{b.dni || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{b.funcion || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {b.fecha_nacimiento ? (() => {
                      const [y, m, d] = b.fecha_nacimiento.split('-');
                      return `${d}/${m}/${y}`;
                    })() : '—'}
                  </TableCell>
                  <TableCell>
                    {b.tipo === 'Voluntario' ? (
                      <Badge className="bg-purple-100 text-purple-700 border-purple-300 border"><UserCog className="w-3 h-3 mr-1" />Voluntario</Badge>
                    ) : b.becado ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 border"><Award className="w-3 h-3 mr-1" />Becado</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(b); }}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}><Trash2 className="w-4 h-4 mr-2" />Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </Card>

      {showForm && <BeneficiarioForm open onClose={() => setShowForm(false)} onSave={handleSave} todosBeneficiarios={beneficiarios} />}
      {editing && <BeneficiarioForm open onClose={() => setEditing(null)} onSave={handleSave} initialData={editing} todosBeneficiarios={beneficiarios} />}
      {showImport && <ImportBeneficiariosDialog open onClose={() => setShowImport(false)} />}
    </div>
  );
}