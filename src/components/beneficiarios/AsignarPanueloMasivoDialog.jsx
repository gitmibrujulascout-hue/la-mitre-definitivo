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

const PANUELO_PROMESA_IMG = "https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/9f0e84abb_Gemini_Generated_Image_pm52inpm52inpm52.png";
const PANUELO_INVESTIDURA_IMG = "https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/030bc09bd_Gemini_Generated_Image_pm52inpm52inpm52-copia.png";

const PromesaImg = ({ className }) => <img src={PANUELO_PROMESA_IMG} alt="Promesa" className={className} />;
const InvestiduraImg = ({ className }) => <img src={PANUELO_INVESTIDURA_IMG} alt="Investidura" className={className} />;

const PANUELO_OPTIONS = [
  { value: '', label: 'Sin pañuelo', icon: null },
  { value: 'Promesa', label: 'Promesa', icon: PromesaImg },
  { value: 'Investidura', label: 'Investidura', icon: InvestiduraImg },
  { value: 'Paturuzú', label: 'Paturuzú', icon: Crown },
];

export default function AsignarPanueloMasivoDialog({ open, onClose, beneficiarios, onDone }) {
  const [selected, setSelected] = useState([]);
  const [panuelo, setPanuelo] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = beneficiarios
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
      const updates = selected.map(id => ({ id, estado_panuelo: panuelo }));
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

  const currentIcon = PANUELO_OPTIONS.find(p => p.value === panuelo)?.icon;

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
                  <SelectItem key={opt.value || '__blank__'} value={opt.value}>
                    <span className="flex items-center gap-2">
                      {opt.icon && <opt.icon className="w-4 h-4" />}
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentIcon && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <currentIcon className="w-3 h-3" />
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
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filtered.map(b => {
                const checked = selected.includes(b.id);
                const Icon = PANUELO_OPTIONS.find(p => p.value === b.estado_panuelo)?.icon;
                return (
                  <div key={b.id} className={`flex items-center gap-2 px-3 py-1.5 border-b last:border-0 cursor-pointer hover:bg-muted/30 ${checked ? 'bg-primary/5' : ''}`}
                    onClick={() => toggle(b.id)}>
                    <Checkbox checked={checked} onCheckedChange={() => toggle(b.id)} />
                    {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
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