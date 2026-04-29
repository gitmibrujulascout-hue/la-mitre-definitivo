import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RAMAS, RAMA_CONFIG } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CampamentoForm({ open, onClose, beneficiarios }) {
  const [form, setForm] = useState({
    nombre: '', fecha_inicio: '', fecha_fin: '', costo_por_persona: '',
    ubicacion: '', observaciones: '', ramas_participantes: [], beneficiarios_ids: []
  });

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: data => base44.entities.Campamento.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campamentos'] }); onClose(); toast.success('Campamento creado'); },
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleRama = (rama) => {
    const current = form.ramas_participantes;
    const updated = current.includes(rama) ? current.filter(r => r !== rama) : [...current, rama];
    update('ramas_participantes', updated);

    // Auto-select beneficiarios de las ramas seleccionadas
    const benIds = beneficiarios
      .filter(b => b.activo !== false && updated.includes(b.rama))
      .map(b => b.id);
    update('beneficiarios_ids', benIds);
  };

  const toggleBeneficiario = (id) => {
    const current = form.beneficiarios_ids;
    update('beneficiarios_ids', current.includes(id) ? current.filter(i => i !== id) : [...current, id]);
  };

  const activeBeneficiarios = beneficiarios.filter(b => b.activo !== false);

  const handleSave = () => {
    if (!form.nombre || !form.costo_por_persona) return;
    createMutation.mutate({ ...form, costo_por_persona: parseFloat(form.costo_por_persona) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Campamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Nombre del campamento *</Label>
            <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} placeholder="Ej: Campamento de verano" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha inicio</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => update('fecha_inicio', e.target.value)} />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => update('fecha_fin', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Costo por persona *</Label>
              <Input type="number" value={form.costo_por_persona} onChange={e => update('costo_por_persona', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input value={form.ubicacion} onChange={e => update('ubicacion', e.target.value)} placeholder="Lugar" />
            </div>
          </div>

          {/* Selección de ramas */}
          <div>
            <Label className="mb-2 block">Ramas participantes</Label>
            <div className="grid grid-cols-2 gap-2">
              {RAMAS.map(rama => {
                const config = RAMA_CONFIG[rama];
                const isSelected = form.ramas_participantes.includes(rama);
                return (
                  <button
                    key={rama}
                    type="button"
                    onClick={() => toggleRama(rama)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium text-left',
                      isSelected ? `${config.badge} border-current` : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <span className={cn('w-3 h-3 rounded-full', config.dot)} />
                    {rama}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selección individual de beneficiarios */}
          <div>
            <Label className="mb-2 block">Asistentes ({form.beneficiarios_ids.length} seleccionados)</Label>
            <ScrollArea className="h-48 border rounded-lg p-2">
              {RAMAS.map(rama => {
                const benRama = activeBeneficiarios.filter(b => b.rama === rama);
                if (benRama.length === 0) return null;
                return (
                  <div key={rama} className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{rama}</p>
                    {benRama.map(b => (
                      <label key={b.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={form.beneficiarios_ids.includes(b.id)}
                          onCheckedChange={() => toggleBeneficiario(b.id)}
                        />
                        <span className="text-sm">{b.nombre}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </ScrollArea>
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={e => update('observaciones', e.target.value)} placeholder="Opcional" className="h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.costo_por_persona}>Crear campamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}