import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TODOS_LOS_ROLES, ramaDesdeEdad } from '@/lib/ramaUtils';

export default function BeneficiarioForm({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState(initialData || {
    nombre: '', dni: '', telefono_contacto: '', fecha_nacimiento: '',
    funcion: '', categoria: '', zona: '', distrito: '', codigo: '', organismo: '',
    religion: '', religion_descripcion: '',
    rama: '', tipo: 'Beneficiario', becado: false, email_contacto: '', activo: true
  });

  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  // Auto-detectar rama según edad
  useEffect(() => {
    if (form.fecha_nacimiento && !initialData?.rama) {
      const ramaAuto = ramaDesdeEdad(form.fecha_nacimiento);
      if (ramaAuto) {
        const tipo = ramaAuto === 'Voluntario' ? 'Voluntario' : 'Beneficiario';
        setForm(prev => ({ ...prev, rama: ramaAuto, tipo }));
      }
    }
  }, [form.fecha_nacimiento]);

  const handleSave = () => {
    if (!form.nombre) return;
    onSave(form);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar' : 'Nuevo'} Beneficiario</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basico" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="basico" className="flex-1">Datos básicos</TabsTrigger>
            <TabsTrigger value="scout" className="flex-1">Info scout</TabsTrigger>
          </TabsList>

          <TabsContent value="basico" className="space-y-4 pt-4">
            <div>
              <Label>Nombre completo *</Label>
              <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} placeholder="Apellido, Nombre" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>DNI</Label>
                <Input value={form.dni} onChange={e => update('dni', e.target.value)} placeholder="12345678" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={form.telefono_contacto} onChange={e => update('telefono_contacto', e.target.value)} placeholder="351-1234567" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={form.fecha_nacimiento} onChange={e => update('fecha_nacimiento', e.target.value)} />
              </div>
              <div>
                <Label>Email contacto</Label>
                <Input value={form.email_contacto} onChange={e => update('email_contacto', e.target.value)} placeholder="email@ejemplo.com" />
              </div>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => {
                const rama = v === 'Voluntario' ? 'Voluntario' : form.rama === 'Voluntario' ? '' : form.rama;
                update('tipo', v);
                update('rama', rama);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beneficiario">Beneficiario (abona cuota)</SelectItem>
                  <SelectItem value="Voluntario">Voluntario / Educador (no abona)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rama / Rol</Label>
              <Select value={form.rama} onValueChange={v => update('rama', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rama" /></SelectTrigger>
                <SelectContent>
                  {TODOS_LOS_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.fecha_nacimiento && (
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-detectado: {ramaDesdeEdad(form.fecha_nacimiento) || '—'}
                </p>
              )}
            </div>
            {form.tipo === 'Beneficiario' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <p className="text-sm font-medium">Becado</p>
                  <p className="text-xs text-muted-foreground">No abona cuota mensual</p>
                </div>
                <Switch checked={form.becado} onCheckedChange={v => update('becado', v)} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="scout" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Función</Label>
                <Input value={form.funcion} onChange={e => update('funcion', e.target.value)} placeholder="Ej: Jefe de Sección" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Input value={form.categoria} onChange={e => update('categoria', e.target.value)} placeholder="Ej: Scout" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Zona</Label>
                <Input value={form.zona} onChange={e => update('zona', e.target.value)} />
              </div>
              <div>
                <Label>Distrito</Label>
                <Input value={form.distrito} onChange={e => update('distrito', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código</Label>
                <Input value={form.codigo} onChange={e => update('codigo', e.target.value)} />
              </div>
              <div>
                <Label>Organismo</Label>
                <Input value={form.organismo} onChange={e => update('organismo', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Religión</Label>
                <Input value={form.religion} onChange={e => update('religion', e.target.value)} />
              </div>
              <div>
                <Label>Descripción religión</Label>
                <Input value={form.religion_descripcion} onChange={e => update('religion_descripcion', e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}