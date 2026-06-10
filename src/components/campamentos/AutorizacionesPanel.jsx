import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckSquare, Square, FileCheck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RAMA_CONFIG } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { differenceInYears, parseISO } from 'date-fns';

function esMenor(beneficiario) {
  if (!beneficiario?.fecha_nacimiento) return true; // si no tiene fecha, asumir menor por precaución
  const edad = differenceInYears(new Date(), parseISO(beneficiario.fecha_nacimiento));
  return edad < 18;
}

export default function AutorizacionesPanel({ campamento, beneficiarios, invalidateKey = 'campamentos' }) {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const autorizados = new Set(campamento.autorizaciones_ids || []);

  const mutation = useMutation({
    mutationFn: (nuevosIds) => base44.entities.Campamento.update(campamento.id, { autorizaciones_ids: nuevosIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
    },
    onError: () => toast.error('Error al guardar'),
  });

  const toggle = (id) => {
    const actual = new Set(campamento.autorizaciones_ids || []);
    if (actual.has(id)) {
      actual.delete(id);
    } else {
      actual.add(id);
    }
    mutation.mutate(Array.from(actual));
  };

  const entregaron = menores.filter(b => autorizados.has(b.id)).length;
  const porcentaje = menores.length > 0 ? Math.round((entregaron / menores.length) * 100) : 0;

  // Agrupación por rama para vista ordenada
  const ORDEN_RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];
  const porRama = useMemo(() => {
    const map = {};
    for (const b of filtrados) {
      const r = b.rama || 'Sin rama';
      if (!map[r]) map[r] = [];
      map[r].push(b);
    }
    const ordenadas = ORDEN_RAMAS.filter(r => map[r]).map(r => [r, map[r]]);
    const otras = Object.entries(map).filter(([r]) => !ORDEN_RAMAS.includes(r));
    return [...ordenadas, ...otras];
  }, [filtrados]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-green-600" />
          Autorizaciones familiares
          <Badge
            className={cn(
              'ml-auto text-xs',
              entregaron === menores.length && menores.length > 0
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
            )}
          >
            {entregaron}/{menores.length} entregadas ({porcentaje}%)
          </Badge>
        </CardTitle>

        {/* Barra de progreso */}
        {menores.length > 0 && (
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
            <div
              className={cn('h-full rounded-full transition-all', entregaron === menores.length ? 'bg-green-500' : 'bg-amber-400')}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        )}

        {/* Buscador */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar beneficiario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0 max-h-96 overflow-y-auto">
        {menores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay menores de 18 asignados a este campamento
          </p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
        ) : (
          porRama.map(([rama, lista]) => {
            const config = RAMA_CONFIG[rama];
            return (
              <div key={rama} className="mb-4 last:mb-0">
                <div className={cn('flex items-center gap-2 px-2 py-1 rounded-md mb-1', config?.badge || 'bg-muted')}>
                  <span className={cn('w-2 h-2 rounded-full', config?.dot || 'bg-muted-foreground')} />
                  <span className="text-xs font-bold uppercase tracking-wide">{rama} ({lista.length})</span>
                </div>
                {lista.map((b, i) => {
                  const tiene = autorizados.has(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggle(b.id)}
                      disabled={mutation.isPending}
                      className={cn(
                        'w-full flex items-center gap-2 py-1.5 px-3 rounded text-sm transition-colors hover:bg-muted/50',
                        tiene && 'bg-green-50 hover:bg-green-100'
                      )}
                    >
                      <span className="text-muted-foreground w-5 text-xs">{i + 1}.</span>
                      <span className="flex-1 text-left">{b.nombre}</span>
                      {tiene
                        ? <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
                        : <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}