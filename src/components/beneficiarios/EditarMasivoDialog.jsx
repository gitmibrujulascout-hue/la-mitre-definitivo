import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import PanueloIcon, { PANUELO_OPTIONS } from '@/components/shared/PanueloIcon';
import { TODOS_LOS_ROLES } from '@/lib/ramaUtils';

const FIELDS = [
  { key: 'rama', label: 'Rama', type: 'select', options: TODOS_LOS_ROLES },
  { key: 'tipo', label: 'Tipo', type: 'select', options: ['Beneficiario', 'Voluntario'] },
  { key: 'funcion', label: 'Función', type: 'text' },
  { key: 'estado_panuelo', label: 'Pañuelo', type: 'select', options: ['', 'Promesa', 'Investidura', 'Paturuzú'] },
  { key: 'becado', label: 'Becado', type: 'checkbox' },
  { key: 'activo', label: 'Activo', type: 'checkbox' },
  { key: 'zona', label: 'Zona', type: 'text' },
  { key: 'distrito', label: 'Distrito', type: 'text' },
  { key: 'grupo_familiar', label: 'Grupo familiar', type: 'text' },
  { key: 'email_contacto', label: 'Email de contacto', type: 'text' },
  { key: 'telefono_contacto', label: 'Teléfono', type: 'text' },
];

export default function EditarMasivoDialog({ open, onClose, selectedIds, beneficiarios, onDone }) {
  const [selectedFields, setSelectedFields] = useState([]);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const selectedBeneficiarios = beneficiarios.filter(b => selectedIds.includes(b.id));

  const toggleField = (key) => {
    setSelectedFields(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    setValues(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setFieldValue = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (selectedFields.length === 0) {
      toast.error('Seleccioná al menos un campo para editar');
      return;
    }
    const data = {};
    selectedFields.forEach(key => {
      if (values[key] !== undefined) data[key] = values[key];
    });
    setSaving(true);
    try {
      const updates = selectedIds.map(id => ({ id, ...data }));
      await base44.entities.Beneficiario.bulkUpdate(updates);
      toast.success(`${selectedIds.length} miembro(s) actualizado(s)`);
      onDone?.();
      onClose();
      setSelectedFields([]);
      setValues({});
    } catch (err) {
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Editar {selectedIds.length} miembro(s)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Marcá los campos que querés actualizar para los {selectedIds.length} miembros seleccionados. Los campos no marcados no se modificarán.
          </p>

          {FIELDS.map(field => {
            const isSelected = selectedFields.includes(field.key);
            return (
              <div key={field.key} className={`rounded-lg border p-3 ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleField(field.key)} />
                  <Label className="cursor-pointer font-medium" onClick={() => toggleField(field.key)}>{field.label}</Label>
                  {field.key === 'estado_panuelo' && (
                    <PanueloIcon estado={values[field.key]} className="w-4 h-4 ml-auto" />
                  )}
                </div>
                {isSelected && (
                  <div className="pl-6">
                    {field.type === 'select' && (
                      <Select value={values[field.key] ?? ''} onValueChange={v => setFieldValue(field.key, v)}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          {field.options.map(opt => (
                            <SelectItem key={opt || '__blank__'} value={opt || '__blank__'}>
                              {opt === '' ? '— Sin valor —' : opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.type === 'text' && (
                      <Input
                        value={values[field.key] ?? ''}
                        onChange={e => setFieldValue(field.key, e.target.value)}
                        placeholder="Ingresar valor..."
                      />
                    )}
                    {field.type === 'checkbox' && (
                      <Select value={values[field.key] === undefined ? '' : String(values[field.key])} onValueChange={v => setFieldValue(field.key, v === 'true')}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Sí</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || selectedFields.length === 0}>
            {saving ? 'Guardando...' : `Actualizar ${selectedIds.length} miembro(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}