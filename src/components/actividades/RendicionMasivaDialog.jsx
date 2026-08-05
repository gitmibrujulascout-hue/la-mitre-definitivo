import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { CheckSquare, Square, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

function apellido(nombre = '') {
  const partes = nombre.trim().split(/\s+/);
  return partes[partes.length - 1].toLowerCase();
}

const ESTADO_BADGE = {
  'Sin rendir': 'bg-red-50 text-red-600 border-red-200',
  'Parcial':    'bg-amber-50 text-amber-600 border-amber-200',
  'Rendido':    'bg-green-50 text-green-700 border-green-200',
};

export default function RendicionMasivaDialog({ open, onClose, ventas, actividadId }) {
  const [seleccionados, setSeleccionados] = useState([]);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // Solo ventas NO completamente rendidas, ordenadas por apellido
  const ventasPendientes = useMemo(() => {
    return [...ventas]
      .filter(v => v.estado_rendicion !== 'Rendido')
      .sort((a, b) => apellido(a.beneficiario_nombre).localeCompare(apellido(b.beneficiario_nombre), 'es'));
  }, [ventas]);

  const filtradas = useMemo(() => {
    if (!search) return ventasPendientes;
    const q = search.toLowerCase();
    return ventasPendientes.filter(v =>
      v.beneficiario_nombre?.toLowerCase().includes(q) ||
      v.comprador_nombre?.toLowerCase().includes(q)
    );
  }, [ventasPendientes, search]);

  const toggle = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    if (seleccionados.length === filtradas.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(filtradas.map(v => v.id));
    }
  };

  const totalSeleccionado = filtradas
    .filter(v => seleccionados.includes(v.id))
    .reduce((s, v) => s + (v.monto_recaudado || 0), 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      for (const id of seleccionados) {
        const v = ventas.find(x => x.id === id);
        await base44.entities.VentaActividad.update(id, {
          estado_rendicion: 'Rendido',
          monto_rendido: v?.monto_recaudado || 0,
          fecha_rendicion: fecha,
        });
      }
    },
    onSuccess: () => {
      toast.success(`${seleccionados.length} venta(s) marcadas como rendidas`);
      queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividadId] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Rendición masiva de dinero
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Seleccioná las ventas cuyo dinero ya fue entregado. Se marcarán como <strong>Rendido completo</strong>.
          </p>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por vendedor o comprador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={toggleTodos}
              className="text-xs text-primary flex items-center gap-1 whitespace-nowrap hover:underline"
            >
              {seleccionados.length === filtradas.length && filtradas.length > 0
                ? <><Square className="w-3 h-3" />Desmarcar todos</>
                : <><CheckSquare className="w-3 h-3" />Seleccionar todos</>}
            </button>
          </div>

          {ventasPendientes.length === 0 ? (
            <p className="text-center text-green-700 bg-green-50 border border-green-200 rounded-lg py-4 text-sm font-medium">
              ✓ Todas las ventas ya están rendidas
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {filtradas.map(v => {
                const sel = seleccionados.includes(v.id);
                const estado = v.estado_rendicion || 'Sin rendir';
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggle(v.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 text-sm border-b last:border-0 transition-colors text-left',
                      sel ? 'bg-primary/5' : 'hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {sel
                        ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className={cn('font-medium truncate', sel && 'text-primary')}>
                          {v.beneficiario_nombre}
                        </p>
                        {v.comprador_nombre && (
                          <p className="text-xs text-amber-700 truncate">🛍️ {v.comprador_nombre}</p>
                        )}
                        {v.producto_nombre && (
                          <p className="text-xs text-muted-foreground truncate">{v.producto_nombre}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {v.pagado && estado !== 'Rendido' && (
                        <span className="text-xs border rounded px-1.5 py-0.5 bg-blue-50 text-blue-600 border-blue-200">
                          💵 Pagado
                        </span>
                      )}
                      <span className={cn('text-xs border rounded px-1.5 py-0.5', ESTADO_BADGE[estado])}>
                        {estado}
                        {estado === 'Parcial' && v.monto_rendido > 0 && ` (${formatMoney(v.monto_rendido)})`}
                      </span>
                      <span className="font-semibold text-green-600 text-sm">{formatMoney(v.monto_recaudado || 0)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {seleccionados.length > 0 && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
              <div className="flex justify-between text-green-700">
                <span>{seleccionados.length} venta(s) seleccionada(s)</span>
                <span className="font-bold">{formatMoney(totalSeleccionado)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={seleccionados.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Guardando...' : `Marcar ${seleccionados.length} como rendidas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}