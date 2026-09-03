import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS = ['Materiales', 'Alimentos', 'Transporte', 'Servicios', 'Mantenimiento', 'Campamento', 'Otro'];

export default function AnalizarEgresosDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [categoriaDefault, setCategoriaDefault] = useState('Otro');
  const [search, setSearch] = useState('');
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ['movimientos_banco'],
    queryFn: () => base44.entities.MovimientoBanco.list('-fecha', 2000),
    enabled: open,
  });

  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos'],
    queryFn: () => base44.entities.Gasto.list('-fecha', 2000),
    enabled: open,
  });

  // Egresos manuales que NO tienen referencia a un Gasto
  const egresosHuérfanos = useMemo(() => {
    return movs.filter(m =>
      m.origen === 'Manual' &&
      m.tipo === 'Egreso' &&
      !m.referencia_id
    );
  }, [movs]);

  // Egresos manuales que ya fueron migrados (tienen referencia_id y origen='Gasto')
  const yaMigrados = useMemo(() => {
    return movs.filter(m => m.origen === 'Gasto');
  }, [movs]);

  // Intento de match: mismo monto + fecha cercana (±3 días)
  const gastosSet = useMemo(() => {
    const map = new Map();
    gastos.forEach(g => {
      const key = `${g.monto}|${g.fecha}`;
      map.set(key, g);
    });
    return map;
  }, [gastos]);

  const tieneMatchGasto = (m) => {
    const key = `${m.monto}|${m.fecha}`;
    return gastosSet.has(key);
  };

  const filtrados = useMemo(() => {
    if (!search) return egresosHuérfanos;
    const s = search.toLowerCase();
    return egresosHuérfanos.filter(m =>
      (m.concepto || '').toLowerCase().includes(s) ||
      String(m.monto).includes(s)
    );
  }, [egresosHuérfanos, search]);

  const totalHuérfanos = egresosHuérfanos.reduce((s, m) => s + (m.monto || 0), 0);
  const totalSeleccionado = filtrados
    .filter(m => seleccionados.has(m.id))
    .reduce((s, m) => s + (m.monto || 0), 0);

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (seleccionados.size === filtrados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(filtrados.map(m => m.id)));
    }
  };

  const migrarMutation = useMutation({
    mutationFn: async () => {
      const ids = filtrados.filter(m => seleccionados.has(m.id));
      const creados = [];
      for (const m of ids) {
        // Crear Gasto a partir del MovimientoBanco manual
        const nuevoGasto = await base44.entities.Gasto.create({
          descripcion: m.concepto || 'Migrado desde movimiento manual',
          monto: m.monto,
          fecha: m.fecha,
          categoria: categoriaDefault,
          forma_pago: m.cuenta === 'Banco' ? 'Transferencia' : 'Efectivo',
          destino: m.cuenta === 'Banco' ? 'Banco' : 'Caja',
          observaciones: `Migrado desde MovimientoBanco (ID: ${m.id})`,
        });
        // Marcar el MovimientoBanco como migrado: origen='Gasto', referencia al gasto creado
        await base44.entities.MovimientoBanco.update(m.id, {
          origen: 'Gasto',
          referencia_id: nuevoGasto.id,
        });
        creados.push(nuevoGasto.id);
      }
      return { count: creados.length };
    },
    onMutate: () => setMigrando(true),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      setResultado({ count: data.count });
      setSeleccionados(new Set());
      toast.success(`${data.count} egresos migrados a Gastos`);
    },
    onError: () => toast.error('Error al migrar'),
    onSettled: () => setMigrando(false),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Análisis de egresos: Caja vs Gastos
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-lg font-semibold">
              {resultado.count} egresos migrados correctamente a Gastos
            </p>
            <p className="text-sm text-muted-foreground">
              Los movimientos ahora aparecen tanto en Caja como en Gastos, usando Gasto como origen único.
            </p>
            <Button onClick={() => { setResultado(null); onClose(); }}>Cerrar</Button>
          </div>
        ) : (
          <>
            {/* Resumen del análisis */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border p-3 bg-amber-50 border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800">Egresos sin registrar en Gastos</span>
                </div>
                <p className="text-2xl font-bold text-amber-700">{egresosHuérfanos.length}</p>
                <p className="text-xs text-amber-600">{formatMoney(totalHuérfanos)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-green-50 border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-800">Ya migrados</span>
                </div>
                <p className="text-2xl font-bold text-green-700">{yaMigrados.length}</p>
                <p className="text-xs text-green-600">Unificados correctamente</p>
              </div>
              <div className="rounded-lg border p-3 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-800">Gastos registrados</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">{gastos.length}</p>
                <p className="text-xs text-blue-600">En la entidad Gasto</p>
              </div>
            </div>

            {/* Explicación */}
            <div className="rounded-lg bg-muted/50 border p-3 mb-4 text-xs text-muted-foreground">
              <strong>¿Qué significa esto?</strong> Hay egresos cargados directamente como
              "movimientos manuales" en Caja (vía MovimientoBanco) que no existen como registros
              de Gasto. Esto genera que Caja y Gastos muestren números distintos. La migración
              convierte cada movimiento manual en un Gasto y marca el original como migrado
              (sin borrarlo), evitando duplicación. A partir de ahora, los nuevos egresos
              manuales se crean directamente como Gastos.
            </div>

            {/* Controles de migración */}
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div>
                <Label className="text-xs">Categoría para migrados</Label>
                <Select value={categoriaDefault} onValueChange={setCategoriaDefault}>
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Buscar</Label>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por concepto o monto..." className="h-8" />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll} className="h-8">
                {seleccionados.size === filtrados.length && filtrados.length > 0
                  ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </Button>
            </div>

            {/* Tabla de egresos huérfanos */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 sticky top-0">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-20">Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="w-24">Cuenta</TableHead>
                    <TableHead className="w-28">Monto</TableHead>
                    <TableHead className="w-24">¿En Gastos?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : filtrados.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {egresosHuérfanos.length === 0 ? '✓ No hay egresos pendientes de migrar' : 'Sin resultados para el filtro'}
                    </TableCell></TableRow>
                  ) : (
                    filtrados.map(m => {
                      const match = tieneMatchGasto(m);
                      return (
                        <TableRow key={m.id} className={cn('cursor-pointer hover:bg-muted/30', seleccionados.has(m.id) && 'bg-primary/5')}>
                          <TableCell>
                            <Checkbox
                              checked={seleccionados.has(m.id)}
                              onCheckedChange={() => toggleSeleccion(m.id)}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{m.fecha}</TableCell>
                          <TableCell className="text-sm font-medium max-w-xs truncate">{m.concepto}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{m.cuenta}</Badge></TableCell>
                          <TableCell className="font-semibold text-red-500">{formatMoney(m.monto)}</TableCell>
                          <TableCell>
                            {match
                              ? <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Posible match</Badge>
                              : <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">No</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer con selección y acción */}
            <DialogFooter className="flex items-center justify-between gap-4 border-t pt-3">
              <div className="text-sm text-muted-foreground">
                {seleccionados.size > 0 ? (
                  <span>{seleccionados.size} seleccionados — <strong className="text-red-500">{formatMoney(totalSeleccionado)}</strong></span>
                ) : (
                  <span>Seleccioná movimientos para migrar</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cerrar</Button>
                <Button
                  onClick={() => migrarMutation.mutate()}
                  disabled={seleccionados.size === 0 || migrando}
                >
                  {migrando
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Migrando...</>
                    : <><ArrowRight className="w-4 h-4 mr-2" />Migrar {seleccionados.size > 0 ? `(${seleccionados.size})` : ''}</>}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}