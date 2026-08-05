import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TODOS_LOS_ROLES, ramaDesdeEdad, esBeneficiarioConCuota } from '@/lib/ramaUtils';
import { AlertTriangle, ArrowRight, Users, Search, X } from 'lucide-react';

export default function BeneficiarioForm({ open, onClose, onSave, initialData, todosBeneficiarios = [] }) {
  const [form, setForm] = useState(initialData || {
    nombre: '', dni: '', telefono_contacto: '', telefono_contacto_2: '', fecha_nacimiento: '',
    funcion: '', categoria: '', zona: '', distrito: '', codigo: '', organismo: '',
    religion: '', religion_descripcion: '', estado_panuelo: '',
    rama: '', tipo: 'Beneficiario', becado: false, email_contacto: '', activo: true,
    grupo_familiar: '', fecha_primer_afiliacion: '',
    provincia: '', localidad: '', calle: '', codigo_postal: '', nacionalidad: '',
    sexo: '', estado_civil: '', estudios: '', titulo: '', discapacidad: '', detalle_discapacidad: '',
    alergias: '', condicion_medica: '', medicacion_habitual: '',
    obra_social: '', numero_obra_social: '',
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', contacto_emergencia_relacion: '',
    observaciones_salud: '',
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
    // Pasar también los IDs de hermanos para que la página actualice su grupo_familiar
    onSave(form, hermanosSeleccionados);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Detectar si la rama actual no coincide con la edad → sugerir promoción
  const ramaSegunEdad = form.fecha_nacimiento ? ramaDesdeEdad(form.fecha_nacimiento) : null;
  const sugiereCambioRama = ramaSegunEdad && form.rama && ramaSegunEdad !== form.rama && form.rama !== 'Educador';

  // Posibles miembros del grupo familiar: mismo apellido, cualquier tipo/rama, activos
  const apellidoActual = useMemo(() => {
    const nombre = form.nombre?.trim() || '';
    return nombre.split(/[,\s]/)[0].toLowerCase();
  }, [form.nombre]);

  const posiblesFamiliaresPorApellido = useMemo(() => {
    if (apellidoActual.length < 3) return [];
    return todosBeneficiarios.filter(b => {
      if (b.id === initialData?.id) return false;
      if (b.activo === false) return false;
      const apellidoB = (b.nombre?.trim() || '').split(/[,\s]/)[0].toLowerCase();
      return apellidoB === apellidoActual;
    });
  }, [apellidoActual, todosBeneficiarios, initialData]);

  // Estado local: inicializado con quienes ya comparten el mismo grupo_familiar en la DB
  const [hermanosSeleccionados, setHermanosSeleccionados] = useState(() => {
    if (!initialData?.grupo_familiar) return [];
    return (todosBeneficiarios || [])
      .filter(b => b.id !== initialData?.id && b.grupo_familiar === initialData.grupo_familiar)
      .map(b => b.id);
  });

  // Búsqueda manual para agregar cualquier miembro al grupo
  const [busquedaFamiliar, setBusquedaFamiliar] = useState('');

  const resultadosBusqueda = useMemo(() => {
    if (busquedaFamiliar.trim().length < 2) return [];
    const q = busquedaFamiliar.toLowerCase();
    return todosBeneficiarios.filter(b => {
      if (b.id === initialData?.id) return false;
      if (b.activo === false) return false;
      // Excluir los que ya aparecen por apellido
      const apellidoB = (b.nombre?.trim() || '').split(/[,\s]/)[0].toLowerCase();
      if (apellidoB === apellidoActual) return false;
      return b.nombre?.toLowerCase().includes(q);
    }).slice(0, 8);
  }, [busquedaFamiliar, todosBeneficiarios, initialData, apellidoActual]);

  // Todos los que están seleccionados (por apellido o manualmente)
  const todosLosFamiliaresEnGrupo = useMemo(() => {
    return todosBeneficiarios.filter(b => hermanosSeleccionados.includes(b.id));
  }, [hermanosSeleccionados, todosBeneficiarios]);

  // Re-inicializar si cambia el initialData (al abrir otro beneficiario)
  useEffect(() => {
    if (!initialData?.grupo_familiar) {
      setHermanosSeleccionados([]);
    } else {
      setHermanosSeleccionados(
        (todosBeneficiarios || [])
          .filter(b => b.id !== initialData?.id && b.grupo_familiar === initialData.grupo_familiar)
          .map(b => b.id)
      );
    }
    setBusquedaFamiliar('');
  }, [initialData?.id]);

  const toggleFamiliar = (b) => {
    setHermanosSeleccionados(prev => {
      const nuevos = prev.includes(b.id)
        ? prev.filter(id => id !== b.id)
        : [...prev, b.id];

      if (nuevos.length === 0) {
        update('grupo_familiar', '');
      } else {
        const conGrupo = todosBeneficiarios.find(x => nuevos.includes(x.id) && x.grupo_familiar);
        const grupo = conGrupo?.grupo_familiar || form.grupo_familiar || apellidoActual;
        update('grupo_familiar', grupo);
      }
      return nuevos;
    });
  };

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
            <TabsTrigger value="basico" className="flex-1">Básico</TabsTrigger>
            <TabsTrigger value="scout" className="flex-1">Scout</TabsTrigger>
            <TabsTrigger value="personal" className="flex-1">Personal</TabsTrigger>
            <TabsTrigger value="salud" className="flex-1">⚕ Salud</TabsTrigger>
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
                <Label>WhatsApp / Tel. principal</Label>
                <Input value={form.telefono_contacto} onChange={e => update('telefono_contacto', e.target.value)} placeholder="351-1234567" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>WhatsApp / Tel. secundario</Label>
                <Input value={form.telefono_contacto_2 || ''} onChange={e => update('telefono_contacto_2', e.target.value)} placeholder="Mamá / Papá" />
              </div>
              <div>
                <Label>Email contacto</Label>
                <Input value={form.email_contacto} onChange={e => update('email_contacto', e.target.value)} placeholder="email@ejemplo.com" />
              </div>
            </div>
            <div>
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={form.fecha_nacimiento} onChange={e => update('fecha_nacimiento', e.target.value)} />
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
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-800">Grupo familiar</p>
              </div>

              {/* Miembros detectados por apellido */}
              {posiblesFamiliaresPorApellido.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-blue-600 font-medium">Mismo apellido:</p>
                  {posiblesFamiliaresPorApellido.map(b => (
                    <div key={b.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`familiar-${b.id}`}
                        checked={hermanosSeleccionados.includes(b.id)}
                        onCheckedChange={() => toggleFamiliar(b)}
                      />
                      <label htmlFor={`familiar-${b.id}`} className="text-sm text-blue-900 cursor-pointer flex items-center gap-1">
                        {b.nombre}
                        <span className="text-blue-500 text-xs">({b.rama}{b.tipo === 'Voluntario' ? ' – voluntario' : ''})</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Miembros ya vinculados manualmente (no detectados por apellido) */}
              {todosLosFamiliaresEnGrupo.filter(b => {
                const apellidoB = (b.nombre?.trim() || '').split(/[,\s]/)[0].toLowerCase();
                return apellidoB !== apellidoActual;
              }).map(b => (
                <div key={b.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`familiar-manual-${b.id}`}
                    checked={true}
                    onCheckedChange={() => toggleFamiliar(b)}
                  />
                  <label htmlFor={`familiar-manual-${b.id}`} className="text-sm text-blue-900 cursor-pointer flex items-center gap-1">
                    {b.nombre}
                    <span className="text-blue-500 text-xs">({b.rama}{b.tipo === 'Voluntario' ? ' – voluntario' : ''})</span>
                    <span className="text-purple-600 text-xs">vinculado manualmente</span>
                  </label>
                </div>
              ))}

              {/* Búsqueda manual */}
              <div className="space-y-1.5">
                <p className="text-xs text-blue-600 font-medium">Agregar otro familiar (papá, mamá, tío...):</p>
                <div className="relative">
                  <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-blue-400" />
                  <Input
                    value={busquedaFamiliar}
                    onChange={e => setBusquedaFamiliar(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="pl-7 h-8 text-xs bg-white border-blue-200"
                  />
                  {busquedaFamiliar && (
                    <button onClick={() => setBusquedaFamiliar('')} className="absolute right-2 top-2">
                      <X className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                  )}
                </div>
                {resultadosBusqueda.length > 0 && (
                  <div className="bg-white border border-blue-200 rounded-md p-1.5 space-y-1 max-h-36 overflow-y-auto">
                    {resultadosBusqueda.map(b => (
                      <div key={b.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`busqueda-${b.id}`}
                          checked={hermanosSeleccionados.includes(b.id)}
                          onCheckedChange={() => toggleFamiliar(b)}
                        />
                        <label htmlFor={`busqueda-${b.id}`} className="text-xs text-blue-900 cursor-pointer">
                          {b.nombre} <span className="text-blue-400">({b.rama}{b.tipo === 'Voluntario' ? ' – voluntario' : ''})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {hermanosSeleccionados.length > 0 && (
                <p className="text-xs text-blue-500">
                  {hermanosSeleccionados.length} miembro(s) vinculado(s) al grupo
                  {form.grupo_familiar && <span className="font-mono ml-1 text-blue-400">({form.grupo_familiar})</span>}
                </p>
              )}
              {hermanosSeleccionados.length === 0 && posiblesFamiliaresPorApellido.length === 0 && (
                <p className="text-xs text-blue-500">Buscá familiares para vincular al grupo.</p>
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

            {/* Baja temporal */}
            <div className={`p-3 rounded-lg border space-y-3 ${form.activo === false ? 'border-red-200 bg-red-50' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Activo en el grupo</p>
                  <p className="text-xs text-muted-foreground">Si está inactivo no genera deudas de cuota</p>
                </div>
                <Switch
                  checked={form.activo !== false}
                  onCheckedChange={v => {
                    update('activo', v);
                    if (v) {
                      // Reingreso: limpiar fecha de baja y registrar reingreso
                      update('fecha_baja', '');
                      update('fecha_reingreso', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
                    } else {
                      // Baja: registrar fecha de hoy por defecto
                      update('fecha_baja', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
                      update('fecha_reingreso', '');
                    }
                  }}
                />
              </div>
              {form.activo === false && (
                <div>
                  <Label>Fecha de baja</Label>
                  <Input
                    type="date"
                    value={form.fecha_baja || ''}
                    onChange={e => update('fecha_baja', e.target.value)}
                  />
                  <p className="text-xs text-red-600 mt-1">A partir de este mes no se generarán deudas de cuota</p>
                </div>
              )}
              {form.activo !== false && form.fecha_reingreso && (
                <p className="text-xs text-green-600">Reingresó el {form.fecha_reingreso}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="personal" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sexo</Label>
                <Select value={form.sexo || ''} onValueChange={v => update('sexo', v === '__blank__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__blank__">Sin especificar</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado civil</Label>
                <Input value={form.estado_civil || ''} onChange={e => update('estado_civil', e.target.value)} placeholder="Soltero/a..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nacionalidad</Label>
                <Input value={form.nacionalidad || ''} onChange={e => update('nacionalidad', e.target.value)} placeholder="Argentina" />
              </div>
              <div>
                <Label>Fecha primera afiliación</Label>
                <Input type="date" value={form.fecha_primer_afiliacion || ''} onChange={e => update('fecha_primer_afiliacion', e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Si está vacío → es primera vez (no paga seguro)</p>
              </div>
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.calle || ''} onChange={e => update('calle', e.target.value)} placeholder="Calle y número" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Localidad</Label>
                <Input value={form.localidad || ''} onChange={e => update('localidad', e.target.value)} />
              </div>
              <div>
                <Label>Provincia</Label>
                <Input value={form.provincia || ''} onChange={e => update('provincia', e.target.value)} />
              </div>
              <div>
                <Label>Cód. Postal</Label>
                <Input value={form.codigo_postal || ''} onChange={e => update('codigo_postal', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estudios</Label>
                <Input value={form.estudios || ''} onChange={e => update('estudios', e.target.value)} placeholder="Nivel educativo" />
              </div>
              <div>
                <Label>Título</Label>
                <Input value={form.titulo || ''} onChange={e => update('titulo', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discapacidad</Label>
                <Input value={form.discapacidad || ''} onChange={e => update('discapacidad', e.target.value)} placeholder="Sí / No / Tipo" />
              </div>
              <div>
                <Label>Detalle discapacidad</Label>
                <Input value={form.detalle_discapacidad || ''} onChange={e => update('detalle_discapacidad', e.target.value)} />
              </div>
            </div>

          </TabsContent>

          <TabsContent value="salud" className="space-y-4 pt-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Esta información es confidencial y se usa en caso de emergencia durante actividades.
            </div>
            <div>
              <Label>Alergias</Label>
              <Input value={form.alergias || ''} onChange={e => update('alergias', e.target.value)} placeholder="Alimentos, medicamentos, picaduras..." />
            </div>
            <div>
              <Label>Condición médica</Label>
              <Input value={form.condicion_medica || ''} onChange={e => update('condicion_medica', e.target.value)} placeholder="Asma, diabetes, epilepsia..." />
            </div>
            <div>
              <Label>Medicación habitual</Label>
              <Input value={form.medicacion_habitual || ''} onChange={e => update('medicacion_habitual', e.target.value)} placeholder="Nombre y dosis" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Obra social / Prepaga</Label>
                <Input value={form.obra_social || ''} onChange={e => update('obra_social', e.target.value)} placeholder="OSDE, Swiss Medical..." />
              </div>
              <div>
                <Label>Nº afiliado obra social</Label>
                <Input value={form.numero_obra_social || ''} onChange={e => update('numero_obra_social', e.target.value)} />
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contacto de emergencia designado</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input value={form.contacto_emergencia_nombre || ''} onChange={e => update('contacto_emergencia_nombre', e.target.value)} placeholder="Nombre completo" />
                </div>
                <div>
                  <Label>Relación</Label>
                  <Input value={form.contacto_emergencia_relacion || ''} onChange={e => update('contacto_emergencia_relacion', e.target.value)} placeholder="Mamá, Papá..." />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={form.contacto_emergencia_telefono || ''} onChange={e => update('contacto_emergencia_telefono', e.target.value)} placeholder="351-..." />
                </div>
              </div>
            </div>
            <div>
              <Label>Observaciones de salud</Label>
              <Input value={form.observaciones_salud || ''} onChange={e => update('observaciones_salud', e.target.value)} placeholder="Cualquier dato relevante para emergencias" />
            </div>
          </TabsContent>

          <TabsContent value="scout" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Función</Label>
                <Select value={form.funcion || ''} onValueChange={v => update('funcion', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar función" /></SelectTrigger>
                  <SelectContent>
                    {[
                      'Ayudante de Comunidad Caminante',
                      'Ayudante de Comunidad Rover',
                      'Ayudante de Manada',
                      'Ayudante de Unidad Scout',
                      'Caminante',
                      'Equipo de Apoyo',
                      'Jefe de Comunidad Caminante',
                      'Jefe de Comunidad Rover',
                      'Jefe de Manada',
                      'Jefe de Unidad Scout',
                      'Lobato / Lobezna',
                      'Representante de Entidad Patrocinante',
                      'Rover',
                      'Scout',
                    ].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Input value={form.categoria} onChange={e => update('categoria', e.target.value)} placeholder="Ej: Scout" />
              </div>
            </div>
            {(form.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(form.rama)) && (
              <div>
                <Label>Rama a cargo (educador)</Label>
                <Select value={form.rama_educador || ''} onValueChange={v => update('rama_educador', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Sin asignación de rama" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin asignación</SelectItem>
                    {['Lobatos', 'Tropa', 'KM', 'Rovers'].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Se usará para auto-seleccionar este adulto al crear campamentos de esa rama</p>
              </div>
            )}
            <div>
              <Label>Estado del pañuelo</Label>
              <Select value={form.estado_panuelo || ''} onValueChange={v => update('estado_panuelo', v === '__blank__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sin pañuelo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__blank__">Sin pañuelo</SelectItem>
                  <SelectItem value="Promesa">Promesa</SelectItem>
                  <SelectItem value="Investidura">Investidura</SelectItem>
                  <SelectItem value="Paturuzú">Paturuzú (equipo especial)</SelectItem>
                </SelectContent>
              </Select>
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