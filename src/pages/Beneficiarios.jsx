import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Upload, MoreHorizontal, Pencil, Trash2, Award, UserCog } from 'lucide-react';
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
  const [filterRama, setFilterRama] = useState('todas');
  const [filterTipo, setFilterTipo] = useState('todos');

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

  const filtered = beneficiarios.filter(b => {
    const matchSearch = b.nombre?.toLowerCase().includes(search.toLowerCase());
    const matchRama = filterRama === 'todas' || b.rama === filterRama;
    const matchTipo = filterTipo === 'todos' || b.tipo === filterTipo || (!b.tipo && filterTipo === 'Beneficiario');
    return matchSearch && matchRama && matchTipo;
  });

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
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nombre</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead className="hidden sm:table-cell">DNI</TableHead>
              <TableHead className="hidden md:table-cell">Función</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay beneficiarios</TableCell></TableRow>
            ) : (
              filtered.map(b => (
                <TableRow key={b.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{b.nombre}</TableCell>
                  <TableCell><RamaBadge rama={b.rama} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{b.dni || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{b.funcion || '—'}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {showForm && <BeneficiarioForm open onClose={() => setShowForm(false)} onSave={handleSave} />}
      {editing && <BeneficiarioForm open onClose={() => setEditing(null)} onSave={handleSave} initialData={editing} />}
      {showImport && <ImportBeneficiariosDialog open onClose={() => setShowImport(false)} />}
    </div>
  );
}