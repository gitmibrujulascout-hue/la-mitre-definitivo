import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

const TIPOS = ['Reunión', 'Salida', 'Campamento', 'Actividad especial', 'Ceremonia', 'Otro'];
const RAMAS_OPCIONES = ['Lobatos', 'Tropa', 'KM', 'Rovers', 'Adultos'];

const EMPTY = {
  nombre: '',
  descripcion: '',
  fecha: '',
  fecha_fin: '',
  tipo: 'Otro',
  todo_el_grupo: false,
  ramas_participantes: [],
  ubicacion: '',
  observaciones: '',
};

export default function EventoCalendarioForm({ open, onClose, onSubmit, submitting, eventoEdit }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      setForm(eventoEdit ? { ...EMPTY, ...eventoEdit } : EMPTY);
    }
  }, [open, eventoEdit]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleRama = (rama) => {
    setForm((prev) => {
      const includes = prev.ramas_participantes.includes(rama);
      const ramas = includes
        ? prev.ramas_participantes.filter((r) => r !== rama)
        : [...prev.ramas_participantes, rama];
      return { ...prev, ramas_participantes: ramas };
    });
  };

  const handleSubmit = () => {
    if (!form.nombre || !form.fecha) return;
    const data = { ...form };
    if (data.todo_el_grupo) data.ramas_participantes = [];
    if (!data.fecha_fin) delete data.fecha_fin;
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{eventoEdit ? 'Editar evento' : 'Nuevo evento del calendario'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nombre *</Label>
            <Input
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Ej: Salida a la plaza"
            />
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea
              value={form.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
            </div>
            <div>
              <Label>Fecha fin (opcional)</Label>
              <Input type="date" value={form.fecha_fin || ''} onChange={(e) => set('fecha_fin', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ubicación</Label>
            <Input value={form.ubicacion || ''} onChange={(e) => set('ubicacion', e.target.value)} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={form.todo_el_grupo}
              onCheckedChange={(v) => set('todo_el_grupo', v)}
            />
            <Label className="cursor-pointer" onClick={() => set('todo_el_grupo', !form.todo_el_grupo)}>
              Todo el grupo
            </Label>
          </div>

          {!form.todo_el_grupo && (
            <div>
              <Label>Ramas participantes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {RAMAS_OPCIONES.map((rama) => (
                  <label key={rama} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.ramas_participantes.includes(rama)}
                      onCheckedChange={() => toggleRama(rama)}
                    />
                    <span className="text-sm">{rama}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.nombre || !form.fecha || submitting}>
            {submitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}