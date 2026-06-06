import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { Tent, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PagoMasivoCampamentoDialog({ open, onClose, beneficiarios }) {
  const [campamentoId, setCampamentoId] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [bensSeleccionados, setBensSeleccionados] = useState([]);
  const [searchBen, setSearchBen] = useState('');

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

  // Beneficiarios asignados al campamento (que aún no pagaron)
  const bensDisponibles = useMemo(() => {
    if (!campamentoSeleccionado) return [];
    const asignados = campamentoSeleccionado.beneficiarios_ids || [];
    const yaPageron = new Set(
      pagosExistentes
        .filter(p => p.tipo_pago === 'Campamento' && p.campamento_id === campamentoId)
        .map(p => p.beneficiario_id)
    );
    return beneficiarios
      .filter(b => asignados.includes(b.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(b => ({ ...b, yaPago: yaPageron.has(b.id) }));
  }, [campamentoSeleccionado, campamentoId, beneficiarios, pagosExistentes]);

  const bensFiltrados = useMemo(() => {
    if (!searchBen) return bensDisponibles;
    return bensDisponibles.filter(b => b.nombre.toLowerCase().includes(searchBen.toLowerCase()));
  }, [bensDisponibles, searchBen]);

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
    setFormaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setBensSeleccionados([]);
    setSearchBen('');
    onClose();
  };

  const toggleBen = (id) => {
    setBensSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    const sinPagar = bensFiltrados.filter(b => !b.yaPago).map(b => b.id);
    if (bensSeleccionados.length === sinPagar.length && sinPagar.length > 0) {
      setBensSeleccionados([]);
    } else {
      setBensSeleccionados(sinPagar);
    }
  };

  const costoPorPersona = campamentoSeleccionado?.costo_por_persona || 0;
  const totalGeneral = bensSeleccionados.length * costoPorPersona;
  const destino = formaPago === 'Transferencia' ? 'Banco' : 'Caja';

  const canSave = campamentoId && formaPago && bensSeleccionados.length > 0;

  const handleGuardar = () => {
    if (!canSave) return;
    const pagos = bensSeleccionados.map(benId => {
      const ben = beneficiarios.find(b => b.id === benId);
      return {
        beneficiario_id: benId,
        beneficiario_nombre: ben?.nombre || '',
        tipo_pago: 'Campamento',
        campamento_id: campamentoId,
        campamento_nombre: campamentoSeleccionado?.nombre || '',
        anio: new Date(campamentoSeleccionado?.fecha_inicio || fechaPago).getFullYear(),
        forma_pago: formaPago,
        destino,
        monto: costoPorPersona,
        fecha_pago: fechaPago,
      };
    });
    bulkMutation.mutate(pagos);
  };

  const sinPagar = bensFiltrados.filter(b => !b.yaPago);

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
              <div className="flex items-center justify-between mb-2">
                <Label>Beneficiarios * — {bensSeleccionados.length} seleccionado(s)</Label>
                <button
                  type="button"
                  onClick={toggleTodos}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  {bensSeleccionados.length === sinPagar.length && sinPagar.length > 0
                    ? <><Square className="w-3 h-3" />Desmarcar todos</>
                    : <><CheckSquare className="w-3 h-3" />Seleccionar todos (sin pagar)</>}
                </button>
              </div>
              <Input
                placeholder="Buscar beneficiario..."
                value={searchBen}
                onChange={e => setSearchBen(e.target.value)}
                className="mb-2"
              />
              {bensFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay beneficiarios asignados a este campamento</p>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                  {bensFiltrados.map(b => {
                    const sel = bensSeleccionados.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => !b.yaPago && toggleBen(b.id)}
                        disabled={b.yaPago}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors border-b last:border-0',
                          b.yaPago ? 'opacity-40 cursor-not-allowed bg-muted/30' :
                          sel ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted/50'
                        )}
                      >
                        <span>{b.nombre}</span>
                        <div className="flex items-center gap-2">
                          {b.rama && <Badge variant="outline" className="text-xs py-0">{b.rama}</Badge>}
                          {b.yaPago
                            ? <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">Ya pagó</Badge>
                            : sel
                              ? <CheckSquare className="w-4 h-4 text-primary" />
                              : <Square className="w-4 h-4 text-muted-foreground" />}
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
              <div className="flex justify-between text-green-700">
                <span>{bensSeleccionados.length} beneficiario(s) × {formatMoney(costoPorPersona)}</span>
                <span>c/u</span>
              </div>
              <div className="flex justify-between font-bold text-green-800 border-t border-green-200 pt-1 mt-1">
                <span>Total a registrar</span>
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