import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RAMA_CONFIG } from '@/lib/ramaUtils';

const RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];

const DEFAULT = {
  nombre: '', descripcion: '', fecha: new Date().toISOString().split('T')[0],
  estado: 'Planificada', tipo_producto: '',
  precio_venta_unitario: '', cantidad_total: '', ingreso_total: '',
  costo_total: '', ganancia_neta: '',
  porcentaje_grupo: 50, porcentaje_beneficiario: 50,
  ramas_participantes: [], adultos_ids: [], observaciones: '',
};

export default function ActividadForm({ open, onClose, onSaved, initialData, beneficiarios = [] }) {
  const isEditing = !!initialData;
  const [form, setForm] = useState(initialData ? { ...DEFAULT, ...initialData } : { ...DEFAULT });

  const adultos = beneficiarios.filter(b => b.activo !== false && (b.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(b.rama)));

  const update = (k, v) => setForm(prev => {
    const next = { ...prev, [k]: v };
    // Recalcular ganancia neta automáticamente
    if (k === 'ingreso_total' || k === 'costo_total') {
      const ing = parseFloat(k === 'ingreso_total' ? v : next.ingreso_total) || 0;
      const cos = parseFloat(k === 'costo_total' ? v : next.costo_total) || 0;
      next.ganancia_neta = ing - cos;
    }
    return next;
  });

  const toggleRama = (rama) => {
    const updated = form.ramas_participantes.includes(rama)
      ? form.ramas_participantes.filter(r => r !== rama)
      : [...form.ramas_participantes, rama];
    // Auto-seleccionar adultos con rama_educador en las ramas seleccionadas
    const adultosAuto = adultos.filter(b => b.rama_educador && updated.includes(b.rama_educador)).map(b => b.id);
    update('ramas_participantes', updated);
    setForm(prev => ({ ...prev, ramas_participantes: updated, adultos_ids: adultosAuto }));
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
    const data = {
      ...form,
      precio_venta_unitario: parseFloat(form.precio_venta_unitario) || 0,
      cantidad_total: parseFloat(form.cantidad_total) || 0,
      ingreso_total: parseFloat(form.ingreso_total) || 0,
      costo_total: parseFloat(form.costo_total) || 0,
      ganancia_neta: parseFloat(form.ganancia_neta) || 0,
      porcentaje_grupo: parseFloat(form.porcentaje_grupo) || 50,
      porcentaje_beneficiario: parseFloat(form.porcentaje_beneficiario) || 50,
    };
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Actividad' : 'Nueva Actividad Económica'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Datos básicos */}
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
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => update('descripcion', e.target.value)} className="h-16" placeholder="Opcional" />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={e => update('observaciones', e.target.value)} className="h-16" placeholder="Opcional" />
            </div>
          </div>

          {/* Datos económicos */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="font-medium text-sm">Datos económicos</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Precio unitario</Label>
                <Input type="number" value={form.precio_venta_unitario} onChange={e => update('precio_venta_unitario', e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Cantidad vendida</Label>
                <Input type="number" value={form.cantidad_total} onChange={e => update('cantidad_total', e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Ingreso total</Label>
                <Input type="number" value={form.ingreso_total} onChange={e => update('ingreso_total', e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Costo total</Label>
                <Input type="number" value={form.costo_total} onChange={e => update('costo_total', e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">% para el grupo</Label>
                <Input type="number" min="0" max="100" value={form.porcentaje_grupo}
                  onChange={e => { update('porcentaje_grupo', e.target.value); update('porcentaje_beneficiario', 100 - parseFloat(e.target.value || 0)); }} />
              </div>
              <div>
                <Label className="text-xs">% para el beneficiario</Label>
                <Input type="number" min="0" max="100" value={form.porcentaje_beneficiario}
                  onChange={e => { update('porcentaje_beneficiario', e.target.value); update('porcentaje_grupo', 100 - parseFloat(e.target.value || 0)); }} />
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                <p className="text-xs text-green-600">Ganancia neta</p>
                <p className="font-bold text-green-700">${parseFloat(form.ganancia_neta || 0).toLocaleString('es-AR')}</p>
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
                      active ? config?.badge || 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    {rama}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Adultos responsables */}
          {adultos.length > 0 && (
            <div>
              <Label className="mb-2 block">Adultos responsables</Label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {adultos.map(b => (
                  <div key={b.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted text-sm">
                    <Checkbox
                      checked={form.adultos_ids.includes(b.id)}
                      onCheckedChange={() => toggleAdulto(b.id)}
                    />
                    <span className="flex-1">{b.nombre}</span>
                    {b.rama_educador && <span className="text-xs text-muted-foreground">{b.rama_educador}</span>}
                  </div>
                ))}
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