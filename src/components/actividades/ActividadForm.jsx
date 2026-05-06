import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RAMA_CONFIG } from '@/lib/ramaUtils';

const RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];

const DEFAULT = {
  nombre: '',
  descripcion: '',
  fecha: new Date().toISOString().split('T')[0],
  estado: 'Planificada',
  tipo_producto: '',
  porcentaje_grupo: 50,
  porcentaje_beneficiario: 50,
  ramas_participantes: [],
  adultos_ids: [],
  observaciones: '',
};

export default function ActividadForm({ open, onClose, onSaved, initialData, beneficiarios = [] }) {
  const isEditing = !!initialData;
  const [form, setForm] = useState(initialData ? { ...DEFAULT, ...initialData } : { ...DEFAULT });

  const adultos = beneficiarios.filter(b =>
    b.activo !== false && (b.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(b.rama))
  );

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleRama = (rama) => {
    const updated = form.ramas_participantes.includes(rama)
      ? form.ramas_participantes.filter(r => r !== rama)
      : [...form.ramas_participantes, rama];
    const adultosAuto = adultos
      .filter(b => b.rama_educador && updated.includes(b.rama_educador))
      .map(b => b.id);
    setForm(prev => ({ ...prev, ramas_participantes: updated, adultos_ids: adultosAuto }));
  };

  const voluntariosPuros = adultos.filter(b => b.rama === 'Voluntario');

  const toggleVoluntarios = () => {
    const todosSeleccionados = voluntariosPuros.every(b => form.adultos_ids.includes(b.id));
    if (todosSeleccionados) {
      setForm(prev => ({ ...prev, adultos_ids: prev.adultos_ids.filter(id => !voluntariosPuros.map(b => b.id).includes(id)) }));
    } else {
      const nuevos = voluntariosPuros.map(b => b.id);
      setForm(prev => ({ ...prev, adultos_ids: [...new Set([...prev.adultos_ids, ...nuevos])] }));
    }
  };

  const toggleAdulto = (id) => {
    setForm(prev => ({
      ...prev,
      adultos_ids: prev.adultos_ids.includes(id)
        ? prev.adultos_ids.filter(x => x !== id)
        : [...prev.adultos_ids, id],
    }));
  };

  const mutation = useMutation({
    mutationFn: data => isEditing
      ? base44.entities.ActividadEconomica.update(initialData.id, data)
      : base44.entities.ActividadEconomica.create(data),
    onSuccess: () => { toast.success(isEditing ? 'Actividad actualizada' : 'Actividad creada'); onSaved(); },
  });

  const handleSave = () => {
    if (!form.nombre || !form.fecha) return;
    mutation.mutate({
      ...form,
      porcentaje_grupo: parseFloat(form.porcentaje_grupo) || 50,
      porcentaje_beneficiario: parseFloat(form.porcentaje_beneficiario) || 50,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Actividad' : 'Nueva Actividad Económica'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} placeholder="Ej: Venta de empanadas Mayo 2026" />
            </div>
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => update('fecha', e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => update('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planificada">Planificada</SelectItem>
                  <SelectItem value="En curso">En curso</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Producto / Tipo de actividad</Label>
              <Input value={form.tipo_producto} onChange={e => update('tipo_producto', e.target.value)} placeholder="Ej: Empanadas, Rifa, Reventa de chocolates" />
            </div>
            <div className="col-span-2">
              <Label>Descripción / Observaciones</Label>
              <Textarea value={form.descripcion} onChange={e => update('descripcion', e.target.value)} className="h-16" placeholder="Opcional" />
            </div>
          </div>

          {/* Porcentaje de distribución */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="font-medium text-sm">Distribución de la ganancia</p>
            <p className="text-xs text-muted-foreground">
              Al finalizar, la ganancia neta se distribuye entre los participantes según cuánto vendió cada uno.
              Aquí definís qué porcentaje corresponde al beneficiario vs. al grupo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">% para el beneficiario</Label>
                <Input
                  type="number" min="0" max="100"
                  value={form.porcentaje_beneficiario}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    porcentaje_beneficiario: e.target.value,
                    porcentaje_grupo: Math.max(0, 100 - parseFloat(e.target.value || 0)),
                  }))}
                />
              </div>
              <div>
                <Label className="text-xs">% para el grupo</Label>
                <Input
                  type="number" min="0" max="100"
                  value={form.porcentaje_grupo}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    porcentaje_grupo: e.target.value,
                    porcentaje_beneficiario: Math.max(0, 100 - parseFloat(e.target.value || 0)),
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Ramas participantes */}
          <div>
            <Label className="mb-2 block">Ramas participantes</Label>
            <div className="flex gap-2 flex-wrap">
              {RAMAS.map(rama => {
                const config = RAMA_CONFIG[rama];
                const active = form.ramas_participantes.includes(rama);
                return (
                  <button
                    key={rama}
                    type="button"
                    onClick={() => toggleRama(rama)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                      active ? config?.badge || 'bg-primary text-primary-foreground border-transparent' : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    {rama}
                  </button>
                );
              })}
              {voluntariosPuros.length > 0 && (
                <button
                  type="button"
                  onClick={toggleVoluntarios}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                    voluntariosPuros.every(b => form.adultos_ids.includes(b.id))
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-muted text-muted-foreground border-border'
                  )}
                >
                  Voluntarios
                </button>
              )}
            </div>
          </div>

          {/* Adultos responsables */}
          {adultos.length > 0 && (
            <div>
              <Label className="mb-2 block">Voluntarios / Adultos responsables</Label>
              <div className="flex gap-2 flex-wrap">
                {adultos.map(b => {
                  const active = form.adultos_ids.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleAdulto(b.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                        active
                          ? 'bg-slate-700 text-white border-slate-700'
                          : 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {b.nombre}
                      {b.rama_educador && <span className="ml-1 opacity-60 text-xs">({b.rama_educador})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.fecha || mutation.isPending}>
            {isEditing ? 'Actualizar' : 'Crear actividad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}