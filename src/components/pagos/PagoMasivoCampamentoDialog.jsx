import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { formatMoney } from '@/lib/ramaUtils';
import { costoEsperado } from '@/components/campamentos/BalanceCampamento';
import { toast } from 'sonner';
import { Tent, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PagoMasivoCampamentoDialog({ open, onClose, beneficiarios }) {
  const [campamentoId, setCampamentoId] = useState('');
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [fechaPago, setFechaPago] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [bensSeleccionados, setBensSeleccionados] = useState([]);
  const [searchBen, setSearchBen] = useState('');
  const [soloDeudores, setSoloDeudores] = useState(true);

  const queryClient = useQueryClient();

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list(),
  });

  const { data: pagosExistentes = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const campamentoSeleccionado = campamentos.find(c => c.id === campamentoId);

  // Pagos de campamento agrupados por persona
  const pagosMap = useMemo(() => {
    const map = {};
    pagosExistentes
      .filter(p => p.tipo_pago === 'Campamento' && p.campamento_id === campamentoId)
      .forEach(p => {
        map[p.beneficiario_id] = (map[p.beneficiario_id] || 0) + (p.monto || 0);
      });
    return map;
  }, [pagosExistentes, campamentoId]);

  // Lista de personas: beneficiarios + adultos (si adultos_pagan)
  const personasDisponibles = useMemo(() => {
    if (!campamentoSeleccionado) return [];
    const todosIds = [
      ...(campamentoSeleccionado.beneficiarios_ids || []),
      ...(campamentoSeleccionado.adultos_pagan ? (campamentoSeleccionado.adultos_ids || []) : []),
    ];
    return beneficiarios
      .filter(b => todosIds.includes(b.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(b => {
        const esperado = costoEsperado(campamentoSeleccionado, b);
        const pagado = pagosMap[b.id] || 0;
        const pendiente = Math.max(0, esperado - pagado);
        return { ...b, esperado, pagado, pendiente, yaPago: pendiente <= 0.01 && esperado > 0, noAbona: esperado === 0 };
      });
  }, [campamentoSeleccionado, beneficiarios, pagosMap]);

  const personasFiltradas = useMemo(() => {
    let res = personasDisponibles;
    if (soloDeudores) res = res.filter(p => p.pendiente > 0.01);
    if (searchBen) res = res.filter(p => p.nombre.toLowerCase().includes(searchBen.toLowerCase()));
    return res;
  }, [personasDisponibles, soloDeudores, searchBen]);

  const bulkMutation = useMutation({
    mutationFn: async (pagos) => {
      for (const p of pagos) {
        await base44.entities.Pago.create(p);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      toast.success('Pagos de campamento registrados correctamente');
      handleClose();
    },
  });

  const handleClose = () => {
    setCampamentoId('');
    setFormaPago('Efectivo');
    setFechaPago(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
    setBensSeleccionados([]);
    setSearchBen('');
    setSoloDeudores(true);
    onClose();
  };

  const toggleBen = (id) => {
    setBensSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    const seleccionables = personasFiltradas.filter(p => !p.yaPago && !p.noAbona).map(p => p.id);
    if (bensSeleccionados.length === seleccionables.length && seleccionables.length > 0) {
      setBensSeleccionados([]);
    } else {
      setBensSeleccionados(seleccionables);
    }
  };

  const totalGeneral = bensSeleccionados.reduce((s, id) => {
    const p = personasDisponibles.find(b => b.id === id);
    return s + (p ? p.pendiente : 0);
  }, 0);
  const destino = formaPago === 'Transferencia' ? 'Banco' : 'Caja';

  const canSave = campamentoId && formaPago && bensSeleccionados.length > 0;

  const handleGuardar = () => {
    if (!canSave) return;
    const pagos = bensSeleccionados.map(benId => {
      const p = personasDisponibles.find(b => b.id === benId);
      return {
        beneficiario_id: benId,
        beneficiario_nombre: p?.nombre || '',
        tipo_pago: 'Campamento',
        campamento_id: campamentoId,
        campamento_nombre: campamentoSeleccionado?.nombre || '',
        anio: new Date(campamentoSeleccionado?.fecha_inicio || fechaPago).getFullYear(),
        forma_pago: formaPago,
        destino,
        monto: p ? p.pendiente : 0,
        fecha_pago: fechaPago,
      };
    });
    bulkMutation.mutate(pagos);
  };

  const deudores = personasDisponibles.filter(p => p.pendiente > 0.01);
  const seleccionables = personasFiltradas.filter(p => !p.yaPago && !p.noAbona);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tent className="w-5 h-5 text-primary" />
            Registro Masivo — Campamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Campamento */}
          <div>
            <Label>Campamento *</Label>
            <Select value={campamentoId} onValueChange={v => { setCampamentoId(v); setBensSeleccionados([]); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar campamento" /></SelectTrigger>
              <SelectContent>
                {campamentos.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} — {formatMoney(c.costo_por_persona)}/persona
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Forma de pago y fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Forma de pago *</Label>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo → Caja</SelectItem>
                  <SelectItem value="Transferencia">Transferencia → Banco</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de pago</Label>
              <Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
            </div>
          </div>

          {/* Beneficiarios */}
          {campamentoId && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Label>Personas — {bensSeleccionados.length} seleccionado(s)</Label>
                  {deudores.length > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">{deudores.length} con deuda</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={soloDeudores} onCheckedChange={setSoloDeudores} />
                    Solo deudores
                  </label>
                  <button
                    type="button"
                    onClick={toggleTodos}
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    {bensSeleccionados.length === seleccionables.length && seleccionables.length > 0
                      ? <><Square className="w-3 h-3" />Desmarcar todos</>
                      : <><CheckSquare className="w-3 h-3" />Marcar todos ({seleccionables.length})</>}
                  </button>
                </div>
              </div>
              <Input
                placeholder="Buscar persona..."
                value={searchBen}
                onChange={e => setSearchBen(e.target.value)}
                className="mb-2"
              />
              {personasFiltradas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {soloDeudores && deudores.length === 0
                    ? '✓ No hay personas con deuda pendiente'
                    : 'No hay personas asignadas a este campamento'}
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {personasFiltradas.map(p => {
                    const sel = bensSeleccionados.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => !p.yaPago && !p.noAbona && toggleBen(p.id)}
                        disabled={p.yaPago || p.noAbona}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors border-b last:border-0',
                          (p.yaPago || p.noAbona) ? 'opacity-50 cursor-not-allowed bg-muted/30' :
                          sel ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="flex flex-col items-start">
                          <span>{p.nombre}</span>
                          {p.rama && <Badge variant="outline" className="text-[10px] py-0 mt-0.5">{p.rama}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {p.noAbona ? (
                            <Badge variant="secondary" className="text-[10px] py-0">No abona</Badge>
                          ) : p.yaPago ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">✓ Pagó</Badge>
                          ) : (
                            <>
                              <span className="text-xs text-red-600 font-medium">{formatMoney(p.pendiente)}</span>
                              {sel
                                ? <CheckSquare className="w-4 h-4 text-primary" />
                                : <Square className="w-4 h-4 text-muted-foreground" />}
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Resumen */}
          {canSave && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm space-y-1">
              <p className="font-semibold text-green-800 mb-2">Resumen del registro masivo</p>
              {bensSeleccionados.map(id => {
                const p = personasDisponibles.find(b => b.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex justify-between text-green-700">
                    <span className="truncate flex-1">{p.nombre}</span>
                    <span className="font-medium ml-2">{formatMoney(p.pendiente)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between font-bold text-green-800 border-t border-green-200 pt-1 mt-1">
                <span>Total a registrar ({bensSeleccionados.length})</span>
                <span>{formatMoney(totalGeneral)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={!canSave || bulkMutation.isPending}>
            {bulkMutation.isPending ? 'Registrando...' : `Registrar ${bensSeleccionados.length > 0 ? bensSeleccionados.length : ''} pago(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}