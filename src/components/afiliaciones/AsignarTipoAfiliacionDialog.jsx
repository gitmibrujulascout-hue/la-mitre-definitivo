import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AsignarTipoAfiliacionDialog({ open, onClose, beneficiarios }) {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [filtroRama, setFiltroRama] = useState('todos');
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [tipoAfiliacion, setTipoAfiliacion] = useState('General');

  const filtrados = useMemo(() => {
    return beneficiarios
      .filter(b => b.activo !== false)
      .filter(b => !busqueda || b.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
      .filter(b => filtroRama === 'todos' || b.rama === filtroRama);
  }, [beneficiarios, busqueda, filtroRama]);

  const toggleSel = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (filtrados.length > 0 && filtrados.every(b => seleccionados.has(b.id))) {
      setSeleccionados(prev => {
        const next = new Set(prev);
        filtrados.forEach(b => next.delete(b.id));
        return next;
      });
    } else {
      setSeleccionados(prev => {
        const next = new Set(prev);
        filtrados.forEach(b => next.add(b.id));
        return next;
      });
    }
  };

  const selectAllVoluntarios = () => {
    const volIds = beneficiarios
      .filter(b => b.activo !== false && (b.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(b.rama)))
      .map(b => b.id);
    setSeleccionados(prev => {
      const next = new Set(prev);
      volIds.forEach(id => next.add(id));
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const updates = [...seleccionados].map(id =>
        base44.entities.Beneficiario.update(id, { tipo_afiliacion: tipoAfiliacion })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
      toast.success(`${seleccionados.size} beneficiarios actualizados a "${tipoAfiliacion}"`);
      setSeleccionados(new Set());
      onClose();
    },
  });

  const ramas = ['todos', 'Lobatos', 'Tropa', 'KM', 'Rovers', 'Voluntario', 'Educador'];
  const todosSel = filtrados.length > 0 && filtrados.every(b => seleccionados.has(b.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asignar tipo de afiliación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Definí qué precio de afiliación paga cada persona: <strong>General</strong> o <strong>Acompañante</strong>.
            Se usa al registrar nuevas afiliaciones. No afecta afiliaciones ya registradas.
          </p>

          {/* Selector de tipo */}
          <div className="flex gap-2">
            <button
              onClick={() => setTipoAfiliacion('General')}
              className={cn('flex-1 p-3 rounded-lg border text-sm transition-all',
                tipoAfiliacion === 'General' ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-blue-300')}
            >
              <Users className="w-4 h-4 inline mr-1 text-blue-600" />
              <span className="font-medium text-blue-700">General</span>
            </button>
            <button
              onClick={() => setTipoAfiliacion('Acompañante')}
              className={cn('flex-1 p-3 rounded-lg border text-sm transition-all',
                tipoAfiliacion === 'Acompañante' ? 'border-purple-400 bg-purple-50' : 'border-border hover:border-purple-300')}
            >
              <UserCog className="w-4 h-4 inline mr-1 text-purple-600" />
              <span className="font-medium text-purple-700">Acompañante</span>
            </button>
          </div>

          {/* Filtros + acción rápida */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
            </div>
            <Button size="sm" variant="outline" onClick={selectAllVoluntarios}>
              <UserCog className="w-3.5 h-3.5 mr-1" />Seleccionar voluntarios
            </Button>
          </div>

          {/* Filtro por rama */}
          <div className="flex gap-1.5 flex-wrap">
            {ramas.map(r => (
              <button
                key={r}
                onClick={() => setFiltroRama(r)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                  filtroRama === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50')}
              >
                {r === 'todos' ? 'Todas' : r}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 sticky top-0">
                    <TableHead className="w-10">
                      <Checkbox checked={todosSel} onCheckedChange={toggleTodos} />
                    </TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rama</TableHead>
                    <TableHead>Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Sin resultados</TableCell></TableRow>
                  ) : filtrados.map(b => (
                    <TableRow key={b.id} className={seleccionados.has(b.id) ? 'bg-blue-50/40' : ''}>
                      <TableCell>
                        <Checkbox checked={seleccionados.has(b.id)} onCheckedChange={() => toggleSel(b.id)} />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{b.nombre}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{b.rama || '—'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', b.tipo_afiliacion === 'Acompañante' ? 'text-purple-600 border-purple-300' : 'text-blue-600 border-blue-300')}>
                          {b.tipo_afiliacion || 'General'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {seleccionados.size > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm font-medium">{seleccionados.size} seleccionados → "{tipoAfiliacion}"</span>
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? 'Guardando...' : 'Aplicar'}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}