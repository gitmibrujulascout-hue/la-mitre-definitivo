import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RAMAS, RAMA_CONFIG } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const EMPTY_FORM = {
  nombre: '', fecha_inicio: '', fecha_fin: '', costo_por_persona: '',
  costo_adultos: '', adultos_pagan: false,
  ubicacion: '', observaciones: '', ramas_participantes: [],
  beneficiarios_ids: [], adultos_ids: []
};

export default function CampamentoForm({ open, onClose, beneficiarios, campamento = null }) {
  const isEditing = !!campamento;
  const [form, setForm] = useState(campamento ? {
    ...EMPTY_FORM,
    ...campamento,
    costo_por_persona: campamento.costo_por_persona?.toString() || '',
    costo_adultos: campamento.costo_adultos?.toString() || '',
  } : EMPTY_FORM);

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: data => isEditing
      ? base44.entities.Campamento.update(campamento.id, data)
      : base44.entities.Campamento.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campamentos'] });
      onClose();
      toast.success(isEditing ? 'Campamento actualizado' : 'Campamento creado');
    },
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleRama = (rama) => {
    const updated = form.ramas_participantes.includes(rama)
      ? form.ramas_participantes.filter(r => r !== rama)
      : [...form.ramas_participantes, rama];
    // Auto-select niños de ramas seleccionadas
    const benIds = beneficiarios
      .filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !['Voluntario', 'Educador'].includes(b.rama) && updated.includes(b.rama))
      .map(b => b.id);
    // Auto-select adultos educadores asignados a las ramas seleccionadas
    const adultosIds = beneficiarios
      .filter(b => b.activo !== false && (b.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(b.rama)) && b.rama_educador && updated.includes(b.rama_educador))
      .map(b => b.id);
    setForm(prev => ({ ...prev, ramas_participantes: updated, beneficiarios_ids: benIds, adultos_ids: adultosIds }));
  };

  const toggleBen = (id) => {
    const current = form.beneficiarios_ids;
    update('beneficiarios_ids', current.includes(id) ? current.filter(i => i !== id) : [...current, id]);
  };

  const toggleAdulto = (id) => {
    const current = form.adultos_ids || [];
    update('adultos_ids', current.includes(id) ? current.filter(i => i !== id) : [...current, id]);
  };

  const ninos = useMemo(() =>
    beneficiarios.filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !['Voluntario', 'Educador'].includes(b.rama))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [beneficiarios]
  );

  const adultos = useMemo(() =>
    beneficiarios.filter(b => b.activo !== false && (b.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(b.rama)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [beneficiarios]
  );

  const handleSave = () => {
    if (!form.nombre || !form.costo_por_persona) return;
    saveMutation.mutate({
      ...form,
      costo_por_persona: parseFloat(form.costo_por_persona),
      costo_adultos: form.adultos_pagan && form.costo_adultos ? parseFloat(form.costo_adultos) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Campamento' : 'Nuevo Campamento'}</DialogTitle>
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
              <Label>Costo niños *</Label>
              <Input type="number" value={form.costo_por_persona} onChange={e => update('costo_por_persona', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input value={form.ubicacion} onChange={e => update('ubicacion', e.target.value)} placeholder="Lugar" />
            </div>
          </div>

          {/* Adultos pagan */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="text-sm font-medium">¿Los adultos/voluntarios deben abonar?</p>
              <p className="text-xs text-muted-foreground">Activar para poder registrar pagos de adultos</p>
            </div>
            <Switch checked={form.adultos_pagan} onCheckedChange={v => update('adultos_pagan', v)} />
          </div>
          {form.adultos_pagan && (
            <div>
              <Label>Costo adultos</Label>
              <Input type="number" value={form.costo_adultos} onChange={e => update('costo_adultos', e.target.value)} placeholder="Mismo que niños si se deja vacío" />
            </div>
          )}

          {/* Ramas */}
          <div>
            <Label className="mb-2 block">Ramas participantes</Label>
            <div className="grid grid-cols-2 gap-2">
              {RAMAS.map(rama => {
                const config = RAMA_CONFIG[rama];
                const isSelected = form.ramas_participantes.includes(rama);
                return (
                  <button key={rama} type="button" onClick={() => toggleRama(rama)}
                    className={cn('flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium text-left',
                      isSelected ? `${config.badge} border-current` : 'border-border hover:border-muted-foreground/30'
                    )}>
                    <span className={cn('w-3 h-3 rounded-full', config.dot)} />{rama}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Niños asistentes */}
          <div>
            <Label className="mb-2 block">Niños asistentes ({form.beneficiarios_ids.length} seleccionados)</Label>
            <ScrollArea className="h-40 border rounded-lg p-2">
              {RAMAS.filter(r => !['Voluntario', 'Educador'].includes(r)).map(rama => {
                const benRama = ninos.filter(b => b.rama === rama);
                if (benRama.length === 0) return null;
                return (
                  <div key={rama} className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{rama}</p>
                    {benRama.map(b => (
                      <label key={b.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox checked={form.beneficiarios_ids.includes(b.id)} onCheckedChange={() => toggleBen(b.id)} />
                        <span className="text-sm">{b.nombre}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </ScrollArea>
          </div>

          {/* Adultos asistentes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Adultos / Voluntarios asistentes ({(form.adultos_ids || []).length} seleccionados)</Label>
              {adultos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = adultos.map(b => b.id);
                    const allSelected = allIds.every(id => (form.adultos_ids || []).includes(id));
                    update('adultos_ids', allSelected ? [] : allIds);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {adultos.every(b => (form.adultos_ids || []).includes(b.id)) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>
            <ScrollArea className="h-36 border rounded-lg p-2">
              {adultos.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No hay adultos/voluntarios registrados</p>
              ) : adultos.map(b => (
                <label key={b.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={(form.adultos_ids || []).includes(b.id)} onCheckedChange={() => toggleAdulto(b.id)} />
                  <span className="text-sm">{b.nombre}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{b.rama || b.funcion || ''}</span>
                </label>
              ))}
            </ScrollArea>
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={e => update('observaciones', e.target.value)} placeholder="Opcional" className="h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.costo_por_persona || saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear campamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}