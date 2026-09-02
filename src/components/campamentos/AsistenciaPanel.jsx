import React, { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, CheckCheck, XCircle, UserCheck } from 'lucide-react';
import { RAMA_CONFIG } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ORDEN_RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];

export default function AsistenciaPanel({ campamento, beneficiarios }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: data => base44.entities.Campamento.update(campamento.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campamentos'] }),
  });

  const confirmadosSet = useMemo(() => new Set(campamento.confirmaciones_ids || []), [campamento]);

  const todos = useMemo(() => {
    const getBen = (id) => beneficiarios.find(b => b.id === id);
    const ninos = (campamento.beneficiarios_ids || []).map(getBen).filter(Boolean);
    const adultos = (campamento.adultos_ids || []).map(getBen).filter(Boolean);
    return { ninos, adultos };
  }, [campamento, beneficiarios]);

  const total = todos.ninos.length + todos.adultos.length;
  const confirmados = [...todos.ninos, ...todos.adultos].filter(b => confirmadosSet.has(b.id)).length;

  const toggle = (id) => {
    const next = new Set(confirmadosSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateMutation.mutate(
      { confirmaciones_ids: [...next] },
      { onSuccess: () => toast.success(confirmadosSet.has(id) ? 'Confirmación retirada' : 'Asistencia confirmada') }
    );
  };

  const toggleTodos = (confirmar) => {
    const ids = confirmar
      ? [...todos.ninos, ...todos.adultos].map(b => b.id)
      : [];
    updateMutation.mutate(
      { confirmaciones_ids: ids },
      { onSuccess: () => toast.success(confirmar ? 'Todos confirmados' : 'Confirmaciones reiniciadas') }
    );
  };

  const ninosPorRama = useMemo(() => {
    const map = {};
    for (const b of todos.ninos) {
      const r = b.rama || 'Sin rama';
      if (!map[r]) map[r] = [];
      map[r].push(b);
    }
    for (const r of Object.keys(map)) map[r].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const ordenadas = ORDEN_RAMAS.filter(r => map[r]).map(r => [r, map[r]]);
    const otras = Object.entries(map).filter(([r]) => !ORDEN_RAMAS.includes(r));
    return [...ordenadas, ...otras];
  }, [todos.ninos]);

  const adultosOrdenados = useMemo(() =>
    [...todos.adultos].sort((a, b) => {
      const ra = a.rama_educador || '';
      const rb = b.rama_educador || '';
      if (ra !== rb) return ra.localeCompare(rb, 'es');
      return a.nombre.localeCompare(b.nombre, 'es');
    }),
    [todos.adultos]
  );

  if (total === 0) return null;

  const pct = total > 0 ? Math.round((confirmados / total) * 100) : 0;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Confirmación de asistencia
            <Badge className={cn('text-xs', pct === 100 ? 'bg-green-100 text-green-700' : pct > 0 ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground')}>
              {confirmados}/{total} ({pct}%)
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleTodos(true)} disabled={updateMutation.isPending}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" />Confirmar todos
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleTodos(false)} disabled={updateMutation.isPending}>
              <XCircle className="w-3.5 h-3.5 mr-1" />Reiniciar
            </Button>
          </div>
        </div>
        {/* Barra de progreso */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className={cn('h-full transition-all', pct === 100 ? 'bg-green-500' : 'bg-blue-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Beneficiarios */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Beneficiarios</p>
          {ninosPorRama.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin asignar</p>
          ) : ninosPorRama.map(([rama, lista]) => {
            const config = RAMA_CONFIG[rama];
            return (
              <div key={rama} className="mb-3">
                <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md mb-1', config?.badge || 'bg-muted')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', config?.dot || 'bg-muted-foreground')} />
                  <span className="text-xs font-bold uppercase tracking-wide">{rama} ({lista.length})</span>
                </div>
                {lista.map(b => {
                  const ok = confirmadosSet.has(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => toggle(b.id)}
                      className="w-full flex items-center gap-2 py-1 px-2 text-sm hover:bg-muted/40 rounded text-left"
                    >
                      {ok
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      }
                      <span className={cn('flex-1', ok && 'text-muted-foreground line-through')}>{b.nombre}</span>
                      {ok && <Badge className="bg-green-100 text-green-700 text-xs">Confirmado</Badge>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Adultos */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Adultos / Voluntarios</p>
          {adultosOrdenados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin asignar</p>
          ) : adultosOrdenados.map(b => {
            const ok = confirmadosSet.has(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggle(b.id)}
                className="w-full flex items-center gap-2 py-1 px-2 text-sm hover:bg-muted/40 rounded text-left"
              >
                {ok
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                }
                <span className={cn('flex-1', ok && 'text-muted-foreground line-through')}>{b.nombre}</span>
                {b.rama_educador && <Badge variant="outline" className="text-xs">{b.rama_educador}</Badge>}
                {ok && <Badge className="bg-green-100 text-green-700 text-xs">Confirmado</Badge>}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}