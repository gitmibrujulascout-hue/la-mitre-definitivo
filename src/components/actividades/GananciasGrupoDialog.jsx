import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/ramaUtils';
import { Banknote, Gift, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GananciasGrupoDialog({ open, onClose, onSaved, actividad, gananciaReal, beneficiarios }) {
  const queryClient = useQueryClient();
  const pctGrupo = actividad.porcentaje_grupo || 50;
  const gananciaGrupo = Math.max(0, gananciaReal) * pctGrupo / 100;

  const [modo, setModo] = useState('caja'); // 'caja' | 'distribuir'

  // --- MODO CAJA ---
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [fechaCaja, setFechaCaja] = useState(new Date().toISOString().split('T')[0]);
  const [montoCaja, setMontoCaja] = useState(Math.round(gananciaGrupo));

  // --- MODO DISTRIBUIR ---
  // Lista de { beneficiario_id, nombre, monto }
  const [distribuciones, setDistribuciones] = useState([{ beneficiario_id: '', nombre: '', monto: '' }]);

  const totalDistribuido = distribuciones.reduce((s, d) => s + (Number(d.monto) || 0), 0);

  const addFila = () => setDistribuciones(prev => [...prev, { beneficiario_id: '', nombre: '', monto: '' }]);
  const removeFila = (i) => setDistribuciones(prev => prev.filter((_, idx) => idx !== i));
  const updateFila = (i, field, val) => setDistribuciones(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  const handleBenSelect = (i, benId) => {
    const ben = beneficiarios.find(b => b.id === benId);
    updateFila(i, 'beneficiario_id', benId);
    updateFila(i, 'nombre', ben?.nombre || '');
  };

  // Mutation: acreditar a caja
  const cajaMutation = useMutation({
    mutationFn: async () => {
      const destino = formaPago === 'Efectivo' ? 'Caja' : 'Banco';
      await base44.entities.MovimientoBanco.create({
        fecha: fechaCaja,
        tipo: 'Ingreso',
        concepto: `Ganancia grupo — ${actividad.nombre}`,
        monto: Number(montoCaja),
        cuenta: destino,
        origen: 'Manual',
        observaciones: `${pctGrupo}% ganancia de actividad económica: ${actividad.nombre}`,
      });
    },
    onSuccess: async () => {
      await base44.entities.ActividadEconomica.update(actividad.id, { ganancia_grupo_acreditada: true });
      queryClient.invalidateQueries({ queryKey: ['movimientos-banco'] });
      queryClient.invalidateQueries({ queryKey: ['actividades'] });
      toast.success('Ingreso registrado en caja correctamente');
      onSaved();
    },
  });

  // Mutation: distribuir como créditos a beneficiarios
  const distribuirMutation = useMutation({
    mutationFn: async () => {
      const fecha = new Date().toISOString().split('T')[0];
      const validas = distribuciones.filter(d => d.beneficiario_id && Number(d.monto) > 0);
      await Promise.all(validas.map(d =>
        base44.entities.CreditoBeneficiario.create({
          beneficiario_id: d.beneficiario_id,
          beneficiario_nombre: d.nombre,
          actividad_id: actividad.id,
          actividad_nombre: actividad.nombre,
          monto_original: Number(d.monto),
          monto_disponible: Number(d.monto),
          fecha,
          observaciones: `Crédito del grupo (${pctGrupo}%) — ${actividad.nombre}`,
        })
      ));

      // Egreso en Caja: la plata pasa a la "caja de créditos" (reservada)
      const totalMonto = validas.reduce((s, d) => s + Number(d.monto), 0);
      await base44.entities.MovimientoBanco.create({
        fecha,
        tipo: 'Egreso',
        concepto: `Reserva — Créditos grupo ${actividad.nombre}`,
        monto: totalMonto,
        cuenta: 'Caja',
        origen: 'Crédito',
        observaciones: `Distribución de ganancia del grupo (${pctGrupo}%) a beneficiarios`,
      });

      await base44.entities.ActividadEconomica.update(actividad.id, { ganancia_grupo_acreditada: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      queryClient.invalidateQueries({ queryKey: ['actividades'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Créditos distribuidos correctamente');
      onSaved();
    },
  });

  const isPending = cajaMutation.isPending || distribuirMutation.isPending;

  const handleConfirmar = () => {
    if (modo === 'caja') {
      if (!montoCaja || Number(montoCaja) <= 0) { toast.error('Ingresá un monto válido'); return; }
      cajaMutation.mutate();
    } else {
      const validas = distribuciones.filter(d => d.beneficiario_id && Number(d.monto) > 0);
      if (validas.length === 0) { toast.error('Agregá al menos un beneficiario con monto'); return; }
      distribuirMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gestionar ganancias del grupo</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Info ganancia grupo */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Ganancia neta total</p>
              <p className="font-bold text-green-600">{formatMoney(Math.max(0, gananciaReal))}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Parte del grupo ({pctGrupo}%)</p>
              <p className="font-bold text-primary">{formatMoney(gananciaGrupo)}</p>
            </div>
          </div>

          {/* Selector de modo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setModo('caja')}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-medium',
                modo === 'caja' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
              )}
            >
              <Banknote className="w-5 h-5" />
              Acreditar a caja
            </button>
            <button
              onClick={() => setModo('distribuir')}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-medium',
                modo === 'distribuir' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
              )}
            >
              <Gift className="w-5 h-5" />
              Distribuir a beneficiarios
            </button>
          </div>

          {/* MODO CAJA */}
          {modo === 'caja' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Se registrará un ingreso en caja/banco por la ganancia correspondiente al grupo.
              </p>
              <div className="space-y-2">
                <Label>Monto a registrar</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={montoCaja}
                    onChange={e => setMontoCaja(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Forma de pago</Label>
                  <select
                    value={formaPago}
                    onChange={e => setFormaPago(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="Efectivo">Efectivo → Caja</option>
                    <option value="Transferencia">Transferencia → Banco</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha</Label>
                  <Input type="date" value={fechaCaja} onChange={e => setFechaCaja(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* MODO DISTRIBUIR */}
          {modo === 'distribuir' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Distribuí la ganancia del grupo como créditos a beneficiarios que participaron (aunque no hayan vendido). Estos créditos quedan disponibles en su cuenta corriente para cubrir campamentos u otros costos.
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {distribuciones.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={d.beneficiario_id}
                      onChange={e => handleBenSelect(i, e.target.value)}
                      className="flex-1 h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">Seleccionar beneficiario...</option>
                      {beneficiarios.filter(b => b.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                      ))}
                    </select>
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={d.monto}
                        onChange={e => updateFila(i, 'monto', e.target.value)}
                        className="pl-6 h-9 text-sm"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeFila(i)} disabled={distribuciones.length === 1}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addFila} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1" />Agregar beneficiario
              </Button>
              <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total a distribuir</span>
                <span className={cn('font-bold', totalDistribuido > gananciaGrupo ? 'text-red-600' : 'text-primary')}>
                  {formatMoney(totalDistribuido)}
                  {totalDistribuido > gananciaGrupo && <span className="text-xs ml-1">(supera la parte del grupo)</span>}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={isPending}>
            {isPending ? 'Procesando...' : modo === 'caja' ? 'Registrar en caja' : 'Distribuir créditos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}