import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search, Crown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import PanueloIcon, { PANUELO_OPTIONS } from '@/components/shared/PanueloIcon';

export default function AsignarPanueloMasivoDialog({ open, onClose, beneficiarios, onDone }) {
  const [selected, setSelected] = useState([]);
  const [panuelo, setPanuelo] = useState('__blank__');
  const [search, setSearch] = useState('');
  const [filtroPanuelo, setFiltroPanuelo] = useState('todos');
  const [saving, setSaving] = useState(false);

  const filtered = beneficiarios
    .filter(b => {
      if (filtroPanuelo === 'sin_panuelo') return !b.estado_panuelo;
      if (filtroPanuelo !== 'todos') return b.estado_panuelo === filtroPanuelo;
      return true;
    })
    .filter(b => !search || b.nombre?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

  const allFilteredIds = filtered.map(b => b.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.includes(id));

  const toggleAll = () => setSelected(allSelected ? [] : allFilteredIds);
  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAsignar = async () => {
    if (selected.length === 0) {
      toast.error('Seleccioná al menos un miembro');
      return;
    }
    setSaving(true);
    try {
      const updates = selected.map(id => ({ id, estado_panuelo: panuelo === '__blank__' ? '' : panuelo }));
      await base44.entities.Beneficiario.bulkUpdate(updates);
      toast.success(`${selected.length} miembro(s) actualizado(s)`);
      onDone?.();
      onClose();
      setSelected([]);
    } catch (err) {
      toast.error('Error al asignar pañuelos');
    } finally {
      setSaving(false);
    }
  };

  const currentIcon = panuelo;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-600" />
            Asignar pañuelo masivamente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Pañuelo a asignar</Label>
            <Select value={panuelo} onValueChange={setPanuelo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PANUELO_OPTIONS.map(opt => (
                  <SelectItem key={opt.value || '__blank__'} value={opt.value || '__blank__'}>
                    <span className="flex items-center gap-2">
                      <PanueloIcon estado={opt.value} className="w-4 h-4" />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentIcon && currentIcon !== '__blank__' && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <PanueloIcon estado={panuelo === '__blank__' ? '' : panuelo} className="w-3.5 h-3.5" />
                Se mostrará este ícono junto al nombre en el listado
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Seleccionar miembros ({selected.length})</Label>
              <Button size="sm" variant="ghost" onClick={toggleAll}>
                {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </Button>
            </div>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filtroPanuelo} onValueChange={setFiltroPanuelo}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los pañuelos</SelectItem>
                  <SelectItem value="sin_panuelo">Sin pañuelo</SelectItem>
                  {PANUELO_OPTIONS.filter(o => o.value).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-1.5">
                        <PanueloIcon estado={opt.value} className="w-4 h-4" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filtered.map(b => {
                const checked = selected.includes(b.id);
                return (
                  <div key={b.id} className={`flex items-center gap-2 px-3 py-1.5 border-b last:border-0 cursor-pointer hover:bg-muted/30 ${checked ? 'bg-primary/5' : ''}`}
                    onClick={() => toggle(b.id)}>
                    <Checkbox checked={checked} onCheckedChange={() => toggle(b.id)} />
                    <PanueloIcon estado={b.estado_panuelo} className="w-3.5 h-3.5" />
                    <span className="text-sm flex-1">{b.nombre}</span>
                    <span className="text-xs text-muted-foreground">{b.rama}</span>
                    {b.estado_panuelo && (
                      <span className="text-xs font-medium text-muted-foreground">→ {b.estado_panuelo}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAsignar} disabled={saving || selected.length === 0}>
            {saving ? 'Guardando...' : `Asignar a ${selected.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}