import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, UserX, CheckCircle2, XCircle } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

const ORDEN_RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];

// Determina si el campamento ya pasó (fecha_fin < hoy)
export function campamentoPasado(campamento) {
  if (!campamento?.fecha_fin) return false;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  return campamento.fecha_fin < hoy;
}

export default function RevisionAsistenciaDialog({ open, onClose, campamento, beneficiarios, pagos }) {
  const queryClient = useQueryClient();
  const [seleccionados, setSeleccionados] = useState(new Set());

  // Confirmación efectiva: marcados manualmente + los que registraron algún pago (la seña confirma asistencia)
  const confirmadosSet = useMemo(() => {
    const set = new Set(campamento.confirmaciones_ids || []);
    for (const p of pagos) {
      if (p.campamento_id === campamento.id && p.beneficiario_id) set.add(p.beneficiario_id);
    }
    return set;
  }, [campamento, pagos]);

  const todos = useMemo(() => {
    const getBen = (id) => beneficiarios.find(b => b.id === id);
    const ninos = (campamento.beneficiarios_ids || []).map(getBen).filter(Boolean);
    const adultos = (campamento.adultos_ids || []).map(getBen).filter(Boolean);
    return { ninos, adultos };
  }, [campamento, beneficiarios]);

  const pagadoPor = (id) => pagos
    .filter(p => p.campamento_id === campamento.id && p.beneficiario_id === id)
    .reduce((s, p) => s + (p.monto || 0), 0);

  const costoBen = (ben) => {
    if (!ben) return campamento.costo_por_persona;
    const costoInd = campamento.costos_individuales?.[ben.id];
    if (costoInd != null) return costoInd;
    const esAdulto = ben.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(ben.rama);
    if (esAdulto && !campamento.adultos_pagan) return 0;
    if (esAdulto && campamento.adultos_pagan) return campamento.costo_adultos || campamento.costo_por_persona;
    return campamento.costo_por_persona;
  };

  // Lista combinada con estado de confirmación y pago
  const personas = useMemo(() => {
    const ninosOrdenados = [...todos.ninos].sort((a, b) => {
      const ra = a.rama || 'Z';
      const rb = b.rama || 'Z';
      const ia = ORDEN_RAMAS.indexOf(ra);
      const ib = ORDEN_RAMAS.indexOf(rb);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.nombre.localeCompare(b.nombre, 'es');
    });
    const adultosOrdenados = [...todos.adultos].sort((a, b) => {
      const ra = a.rama_educador || '';
      const rb = b.rama_educador || '';
      if (ra !== rb) return ra.localeCompare(rb, 'es');
      return a.nombre.localeCompare(b.nombre, 'es');
    });

    const buildInfo = (b, esAdulto) => {
      const confirmado = confirmadosSet.has(b.id);
      const costo = costoBen(b);
      const pagado = pagadoPor(b.id);
      const saldo = costo - pagado;
      const noConfirmo = !confirmado;
      const noPago = costo > 0 && saldo > 0.01;
      // Sospechoso de no asistencia: no confirmó Y no pagó (pagar = confirmar asistencia)
      const sospechoso = noConfirmo && pagado === 0;
      return { ...b, esAdulto, confirmado, costo, pagado, saldo, noConfirmo, noPago, sospechoso };
    };

    return [
      ...ninosOrdenados.map(b => buildInfo(b, false)),
      ...adultosOrdenados.map(b => buildInfo(b, true)),
    ];
  }, [todos, confirmadosSet, pagos, campamento]);

  const sospechosos = personas.filter(p => p.sospechoso);
  const sospechososIds = useMemo(() => new Set(sospechosos.map(p => p.id)), [sospechosos]);

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seleccionarSospechosos = () => {
    setSeleccionados(new Set(sospechososIds));
  };

  const limpiar = () => setSeleccionados(new Set());

  const mut = useMutation({
    mutationFn: async (idsToRemove) => {
      const idsSet = new Set(idsToRemove);
      const nuevaNinos = (campamento.beneficiarios_ids || []).filter(id => !idsSet.has(id));
      const nuevaAdultos = (campamento.adultos_ids || []).filter(id => !idsSet.has(id));
      const nuevaConfirmaciones = (campamento.confirmaciones_ids || []).filter(id => !idsSet.has(id));
      await base44.entities.Campamento.update(campamento.id, {
        beneficiarios_ids: nuevaNinos,
        adultos_ids: nuevaAdultos,
        confirmaciones_ids: nuevaConfirmaciones,
      });
    },
    onSuccess: (_, idsToRemove) => {
      queryClient.invalidateQueries({ queryKey: ['campamentos'] });
      queryClient.invalidateQueries({ queryKey: ['campamento_pub'] });
      toast.success(`${idsToRemove.length} persona(s) removida(s) del listado de asistentes`);
      setSeleccionados(new Set());
      onClose();
    },
  });

  const handleConfirmar = () => {
    const ids = [...seleccionados];
    if (ids.length === 0) return;
    mut.mutate(ids);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-amber-500" />
            Revisión de asistencia post-campamento
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            El campamento ya pasó. Revisá quiénes <strong>no confirmaron asistencia</strong> y/o <strong>no pagaron</strong>.
            Si no asistieron, marcálos para removerlos del listado de asistentes — así no se les generará deuda que no corresponde.
          </p>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-2 text-center">
            <p className="text-lg font-bold text-amber-600">{sospechosos.length}</p>
            <p className="text-xs text-muted-foreground">No confirmaron</p>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <p className="text-lg font-bold text-red-500">{personas.filter(p => p.noPago).length}</p>
            <p className="text-xs text-muted-foreground">Con deuda</p>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <p className="text-lg font-bold text-blue-500">{seleccionados.size}</p>
            <p className="text-xs text-muted-foreground">A remover</p>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={seleccionarSospechosos} disabled={sospechosos.length === 0}>
            Seleccionar no confirmados ({sospechosos.length})
          </Button>
          <Button size="sm" variant="ghost" onClick={limpiar} disabled={seleccionados.size === 0}>
            Limpiar selección
          </Button>
        </div>

        {/* Listado */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          {personas.map(p => {
            const sel = seleccionados.has(p.id);
            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 px-3 py-2 border-b last:border-0 cursor-pointer transition-colors ${sel ? 'bg-red-50' : 'hover:bg-muted/40'}`}
              >
                <Checkbox checked={sel} onCheckedChange={() => toggleSeleccion(p.id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{p.nombre}</span>
                    {p.esAdulto && <Badge variant="outline" className="text-xs">Adulto</Badge>}
                    {!p.esAdulto && p.rama && <Badge variant="outline" className="text-xs">{p.rama}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.confirmado
                      ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />Confirmó</span>
                      : <span className="text-xs text-amber-600 flex items-center gap-0.5"><XCircle className="w-3 h-3" />No confirmó</span>
                    }
                    {p.costo > 0 && (
                      <span className={`text-xs ${p.saldo > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                        {p.saldo > 0.01 ? `Debe ${formatMoney(p.saldo)}` : '✓ Pagó'}
                      </span>
                    )}
                    {p.costo === 0 && <span className="text-xs text-muted-foreground">No abona</span>}
                  </div>
                </div>
                {p.sospechoso && !sel && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">Revisar</Badge>
                )}
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={seleccionados.size === 0 || mut.isPending}
          >
            {mut.isPending ? 'Removiendo...' : `Remover ${seleccionados.size} del listado`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}