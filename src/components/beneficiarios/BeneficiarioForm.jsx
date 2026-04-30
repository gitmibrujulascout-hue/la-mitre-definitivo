import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TODOS_LOS_ROLES, ramaDesdeEdad, RAMA_CONFIG } from '@/lib/ramaUtils';
import { AlertTriangle, ArrowRight } from 'lucide-react';

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

  // Auto-detectar rama según edad (solo si es nuevo registro)
  useEffect(() => {
    if (form.fecha_nacimiento && !initialData?.rama) {
      const ramaAuto = ramaDesdeEdad(form.fecha_nacimiento);
      if (ramaAuto) {
        const tipo = ramaAuto === 'Voluntario' ? 'Voluntario' : 'Beneficiario';
        // Rovers => becado automático (solo abonan campamentos)
        const becado = ramaAuto === 'Rovers' ? true : false;
        setForm(prev => ({ ...prev, rama: ramaAuto, tipo, becado }));
      }
    }
  }, [form.fecha_nacimiento]);

  const handleSave = () => {
    if (!form.nombre) return;
    onSave(form);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Detectar si la rama actual no coincide con la edad → sugerir promoción
  const ramaSegunEdad = form.fecha_nacimiento ? ramaDesdeEdad(form.fecha_nacimiento) : null;
  const sugiereCambioRama = ramaSegunEdad && form.rama && ramaSegunEdad !== form.rama && form.rama !== 'Educador';

  const handlePromoverRama = () => {
    if (!ramaSegunEdad) return;
    const becado = ramaSegunEdad === 'Rovers' ? true : form.becado;
    const tipo = ramaSegunEdad === 'Voluntario' ? 'Voluntario' : 'Beneficiario';
    update('rama', ramaSegunEdad);
    update('tipo', tipo);
    update('becado', becado);
  };

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
              <Select value={form.rama} onValueChange={v => {
                // Si se cambia a Rovers, marcar becado automáticamente
                const becado = v === 'Rovers' ? true : form.becado;
                update('rama', v);
                update('becado', becado);
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rama" /></SelectTrigger>
                <SelectContent>
                  {TODOS_LOS_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Alerta de promoción de rama */}
              {sugiereCambioRama && (
                <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Posible cambio de rama</p>
                      <p className="text-xs text-amber-700">
                        Por edad debería estar en <strong>{ramaSegunEdad}</strong> (actualmente en {form.rama}).
                        El pase debe realizarse en el grupo.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-700 hover:bg-amber-100 flex-shrink-0 text-xs"
                    onClick={handlePromoverRama}
                  >
                    <ArrowRight className="w-3 h-3 mr-1" />
                    Promover
                  </Button>
                </div>
              )}

              {form.fecha_nacimiento && (
                <p className="text-xs text-muted-foreground mt-1">
                  Rama por edad: <span className="font-medium">{ramaSegunEdad || '—'}</span>
                </p>
              )}
            </div>
            {form.tipo === 'Beneficiario' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <p className="text-sm font-medium">Becado</p>
                  <p className="text-xs text-muted-foreground">
                    No abona cuota mensual
                    {form.rama === 'Rovers' && <span className="ml-1 text-amber-600">(Rovers siempre becados)</span>}
                  </p>
                </div>
                <Switch
                  checked={form.becado}
                  onCheckedChange={v => update('becado', v)}
                  disabled={form.rama === 'Rovers'}
                />
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