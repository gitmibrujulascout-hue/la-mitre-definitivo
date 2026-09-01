import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle2, XCircle, Search, DollarSign, ShieldCheck, Users, AlertCircle, Pencil, Landmark } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatMoney } from '@/lib/ramaUtils';
import RegistrarRendicionDialog from '@/components/afiliaciones/RegistrarRendicionDialog';
import RendicionesList from '@/components/afiliaciones/RendicionesList';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getMontoSeguro, esPrimeraVezBonificado } from '@/lib/afiliacionUtils';

// ——— Dialog para editar tipo de afiliación del beneficiario ———
function EditarTipoAfiliacionDialog({ open, onClose, beneficiario }) {
  const queryClient = useQueryClient();
  // null = sin fecha (primera vez), o una fecha real
  const [tipo, setTipo] = useState(beneficiario?.fecha_primer_afiliacion ? 'renovacion' : 'primera_vez');
  const [fecha, setFecha] = useState(beneficiario?.fecha_primer_afiliacion || '');

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Beneficiario.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
      toast.success('Estado de afiliación actualizado');
      onClose();
    }
  });

  const handleSave = () => {
    const nuevaFecha = tipo === 'primera_vez' ? null : (fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
    updateMutation.mutate({
      id: beneficiario.id,
      data: { fecha_primer_afiliacion: nuevaFecha }
    });
  };

  if (!beneficiario) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tipo de afiliación — {beneficiario.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <p className="text-sm text-muted-foreground">
            Define si este miembro es primera afiliación (no abona) o renovación (debe abonar).
          </p>
          <div className="space-y-2">
            <button
              onClick={() => setTipo('primera_vez')}
              className={cn(
                'w-full text-left p-3 rounded-lg border text-sm transition-all',
                tipo === 'primera_vez' ? 'border-amber-400 bg-amber-50' : 'border-border hover:border-amber-300'
              )}
            >
              <div className="font-medium text-amber-700">⭐ Primera afiliación</div>
              <div className="text-xs text-muted-foreground mt-0.5">No abona seguro este año (bonificado por la Asociación)</div>
            </button>
            <button
              onClick={() => setTipo('renovacion')}
              className={cn(
                'w-full text-left p-3 rounded-lg border text-sm transition-all',
                tipo === 'renovacion' ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-blue-300'
              )}
            >
              <div className="font-medium text-blue-700">🔄 Renovación</div>
              <div className="text-xs text-muted-foreground mt-0.5">Ya estuvo afiliado — debe abonar el seguro</div>
            </button>
          </div>
          {tipo === 'renovacion' && (
            <div>
              <Label className="text-xs">Fecha de primera afiliación</Label>
              <Input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                max={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })}
              />
              <p className="text-xs text-muted-foreground mt-1">Puede ser aproximada, sirve para registrar el historial.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const AÑOS = [2024, 2025, 2026, 2027, 2028];
const MONTO_SEGURO_DEFAULT = 42000;

// ——— Formulario individual ———
function AfiliacionForm({ open, onClose, beneficiarios, afiliacionesExistentes, anio, config }) {
  const [form, setForm] = useState({
    beneficiario_id: '',
    monto: MONTO_SEGURO_DEFAULT.toString(),
    monto_pagado: MONTO_SEGURO_DEFAULT.toString(),
    fecha_pago: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
    forma_pago: 'Efectivo',
    observaciones: '',
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: data => base44.entities.Afiliacion.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['afiliaciones'] });
      toast.success('Afiliación registrada');
      onClose();
    }
  });

  const beneficiarioSel = beneficiarios.find(b => b.id === form.beneficiario_id);
  const esPrimeraVez = beneficiarioSel && !beneficiarioSel.fecha_primer_afiliacion;
  const bonificado = esPrimeraVez && esPrimeraVezBonificado(beneficiarioSel, config, form.fecha_pago);
  const montoSeguroBen = bonificado ? 0 : getMontoSeguro(beneficiarioSel, config);
  const yaAfiliado = afiliacionesExistentes.some(a => a.beneficiario_id === form.beneficiario_id && Number(a.anio) === Number(anio));

  const handleBeneficiarioChange = (v) => {
    const ben = beneficiarios.find(b => b.id === v);
    const primera = ben && !ben.fecha_primer_afiliacion;
    const bonif = primera && esPrimeraVezBonificado(ben, config, form.fecha_pago);
    const monto = bonif ? 0 : getMontoSeguro(ben, config);
    setForm(p => ({
      ...p,
      beneficiario_id: v,
      monto: monto.toString(),
      monto_pagado: monto.toString(),
    }));
  };

  const handleSave = () => {
    if (!form.beneficiario_id) return;
    const montoAfiliacion = bonificado ? 0 : parseFloat(form.monto) || 0;
    const montoPagado = bonificado ? 0 : parseFloat(form.monto_pagado) || 0;
    createMutation.mutate({
      ...form,
      anio: Number(anio),
      monto: montoAfiliacion,
      monto_pagado: montoPagado,
      beneficiario_nombre: beneficiarioSel?.nombre || '',
      beneficiario_dni: beneficiarioSel?.dni || '',
      rama: beneficiarioSel?.rama || '',
      es_primera_vez: esPrimeraVez,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Afiliación {anio}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Beneficiario *</Label>
            <Select value={form.beneficiario_id} onValueChange={handleBeneficiarioChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario..." /></SelectTrigger>
              <SelectContent>
                {beneficiarios.filter(b => b.activo !== false).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre} {b.dni ? `(${b.dni})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {beneficiarioSel && (
            <div className={cn('p-3 rounded-lg text-sm',
              esPrimeraVez && bonificado ? 'bg-amber-50 border border-amber-200 text-amber-800' :
              esPrimeraVez && !bonificado ? 'bg-red-50 border border-red-200 text-red-700' :
              'bg-blue-50 border border-blue-200 text-blue-800')}>
              {esPrimeraVez && bonificado
                ? '⭐ Primera afiliación — No abona seguro (dentro de fecha límite)'
                : esPrimeraVez && !bonificado
                  ? '⚠ Primera afiliación pero fecha límite vencida — Debe abonar seguro'
                  : `Ya afiliado desde ${beneficiarioSel.fecha_primer_afiliacion} — Debe abonar seguro`}
            </div>
          )}

          {yaAfiliado && (
            <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
              ⚠️ Este beneficiario ya tiene afiliación registrada para {anio}
            </div>
          )}

          {!bonificado && beneficiarioSel && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto seguro total</Label>
                  <Input
                    type="number"
                    value={form.monto}
                    onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                    placeholder={MONTO_SEGURO_DEFAULT.toString()}
                  />
                </div>
                <div>
                  <Label>Monto pagado ahora</Label>
                  <Input
                    type="number"
                    value={form.monto_pagado}
                    onChange={e => setForm(p => ({ ...p, monto_pagado: e.target.value }))}
                    placeholder={form.monto || MONTO_SEGURO_DEFAULT.toString()}
                  />
                  {parseFloat(form.monto_pagado) < parseFloat(form.monto) && parseFloat(form.monto) > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Pago parcial ({formatMoney(parseFloat(form.monto) - parseFloat(form.monto_pagado))} pendiente)</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fecha de pago</Label>
                  <Input type="date" value={form.fecha_pago} onChange={e => setForm(p => ({ ...p, fecha_pago: e.target.value }))} />
                </div>
                <div>
                  <Label>Forma de pago</Label>
                  <Select value={form.forma_pago} onValueChange={v => setForm(p => ({ ...p, forma_pago: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {esPrimeraVez && bonificado && beneficiarioSel && (
            <div>
              <Label>Fecha de registro</Label>
              <Input type="date" value={form.fecha_pago} onChange={e => setForm(p => ({ ...p, fecha_pago: e.target.value }))} />
            </div>
          )}

          <div>
            <Label>Observaciones</Label>
            <Input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.beneficiario_id || yaAfiliado || createMutation.isPending}>
            {createMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ——— Afiliación masiva ———
function AfiliacionMasivaDialog({ open, onClose, beneficiarios, afiliacionesExistentes, anio, config }) {
  const queryClient = useQueryClient();

  // Separar quienes deben pagar y quienes no (primera vez)
  const [montoGlobal, setMontoGlobal] = useState((config?.monto_general || MONTO_SEGURO_DEFAULT).toString());
  const [fechaPago, setFechaPago] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [formaPago, setFormaPago] = useState('Efectivo');

  // IDs ya afiliados este año
  const yaAfiliadosIds = useMemo(() =>
    new Set(afiliacionesExistentes.filter(a => Number(a.anio) === Number(anio)).map(a => a.beneficiario_id)),
    [afiliacionesExistentes, anio]
  );

  // Todos los activos (chicos y adultos) sin afiliar aún este año
  const pendientes = useMemo(() =>
    beneficiarios.filter(b => b.activo !== false && !yaAfiliadosIds.has(b.id)),
    [beneficiarios, yaAfiliadosIds]
  );

  const primeraVezTodos = pendientes.filter(b => !b.fecha_primer_afiliacion);
  const primeraVez = primeraVezTodos.filter(b => esPrimeraVezBonificado(b, config, fechaPago));
  const primeraVezPagan = primeraVezTodos.filter(b => !esPrimeraVezBonificado(b, config, fechaPago));
  const debenPagar = [...pendientes.filter(b => !!b.fecha_primer_afiliacion), ...primeraVezPagan];

  // Selección de los que deben pagar
  const [seleccionados, setSeleccionados] = useState(() => new Set(debenPagar.map(b => b.id)));
  // Selección de primera vez
  const [selPrimeraVez, setSelPrimeraVez] = useState(() => new Set(primeraVez.map(b => b.id)));
  // Montos individuales editables
  const [montos, setMontos] = useState({});

  const toggleTodos = () => {
    if (seleccionados.size === debenPagar.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(debenPagar.map(b => b.id)));
  };

  const toggleTodosPrimeraVez = () => {
    if (selPrimeraVez.size === primeraVez.length) setSelPrimeraVez(new Set());
    else setSelPrimeraVez(new Set(primeraVez.map(b => b.id)));
  };

  const getMonto = (id) => {
    if (montos[id] !== undefined) return montos[id];
    const ben = pendientes.find(b => b.id === id);
    return getMontoSeguro(ben, config);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await Promise.all(data.map(d => base44.entities.Afiliacion.create(d)));
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['afiliaciones'] });
      toast.success(`${data.length} afiliaciones registradas`);
      onClose();
    }
  });

  const handleSave = () => {
    const registros = [];

    // Los que deben pagar (renovaciones + primera vez vencida)
    debenPagar.filter(b => seleccionados.has(b.id)).forEach(b => {
      const m = parseFloat(getMonto(b.id)) || 0;
      registros.push({
        beneficiario_id: b.id,
        beneficiario_nombre: b.nombre,
        beneficiario_dni: b.dni || '',
        rama: b.rama || '',
        anio: Number(anio),
        monto: getMontoSeguro(b, config),
        monto_pagado: m,
        fecha_pago: fechaPago,
        forma_pago: formaPago,
        es_primera_vez: !b.fecha_primer_afiliacion,
      });
    });

    // Primera vez
    primeraVez.filter(b => selPrimeraVez.has(b.id)).forEach(b => {
      registros.push({
        beneficiario_id: b.id,
        beneficiario_nombre: b.nombre,
        beneficiario_dni: b.dni || '',
        rama: b.rama || '',
        anio: Number(anio),
        monto: 0,
        monto_pagado: 0,
        fecha_pago: fechaPago,
        forma_pago: formaPago,
        es_primera_vez: true,
      });
    });

    if (registros.length === 0) return;
    createMutation.mutate(registros);
  };

  const totalAPagar = debenPagar.filter(b => seleccionados.has(b.id)).reduce((s, b) => s + (parseFloat(getMonto(b.id)) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Afiliación Masiva — {anio}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Config global */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-xs">Monto general (default)</Label>
              <Input
                type="number"
                value={montoGlobal}
                onChange={e => setMontoGlobal(e.target.value)}
                placeholder={(config?.monto_general || MONTO_SEGURO_DEFAULT).toString()}
              />
            </div>
            <div>
              <Label className="text-xs">Fecha de pago</Label>
              <Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Forma de pago</Label>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sección: deben pagar */}
          {debenPagar.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  Deben abonar el seguro ({debenPagar.length})
                </h3>
                <button onClick={toggleTodos} className="text-xs text-primary hover:underline">
                  {seleccionados.size === debenPagar.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Rama</TableHead>
                      <TableHead className="w-36">Monto pagado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debenPagar.map(b => {
                      const sel = seleccionados.has(b.id);
                      const m = getMonto(b.id);
                      const montoTotal = parseFloat(montoGlobal) || 0;
                      const montoPagado = parseFloat(m) || 0;
                      const parcial = montoPagado < montoTotal && montoPagado > 0;
                      return (
                        <TableRow key={b.id} className={!sel ? 'opacity-40' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={sel}
                              onCheckedChange={() => setSeleccionados(prev => {
                                const next = new Set(prev);
                                next.has(b.id) ? next.delete(b.id) : next.add(b.id);
                                return next;
                              })}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-sm">{b.nombre}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{b.rama || '—'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Input
                                type="number"
                                value={m}
                                onChange={e => setMontos(prev => ({ ...prev, [b.id]: e.target.value }))}
                                className="h-7 text-xs w-28"
                                disabled={!sel}
                              />
                              {sel && parcial && (
                                <span className="text-xs text-amber-600">Parcial</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-right mt-1 font-semibold text-blue-700">
                Total a registrar: {formatMoney(totalAPagar)} ({seleccionados.size} personas)
              </p>
            </div>
          )}

          {/* Sección: primera vez (no pagan) */}
          {primeraVez.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  Primera afiliación — No abonan ({primeraVez.length})
                </h3>
                <button onClick={toggleTodosPrimeraVez} className="text-xs text-primary hover:underline">
                  {selPrimeraVez.size === primeraVez.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Rama</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {primeraVez.map(b => (
                      <TableRow key={b.id} className={!selPrimeraVez.has(b.id) ? 'opacity-40' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selPrimeraVez.has(b.id)}
                            onCheckedChange={() => setSelPrimeraVez(prev => {
                              const next = new Set(prev);
                              next.has(b.id) ? next.delete(b.id) : next.add(b.id);
                              return next;
                            })}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{b.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{b.rama || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">⭐ Sin costo</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {pendientes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
              Todos los beneficiarios ya están afiliados para {anio}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || (seleccionados.size === 0 && selPrimeraVez.size === 0)}
          >
            {createMutation.isPending ? 'Registrando...' : `Registrar ${seleccionados.size + selPrimeraVez.size} afiliaciones`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ——— Página principal ———
export default function Afiliaciones() {
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [showForm, setShowForm] = useState(false);
  const [showMasivo, setShowMasivo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroVista, setFiltroVista] = useState('todos'); // 'todos' | 'pagan' | 'no_pagan' | 'pendientes'
  const [editandoTipo, setEditandoTipo] = useState(null); // beneficiario a editar
  const [showRendicion, setShowRendicion] = useState(false);
  const queryClient = useQueryClient();

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: afiliaciones = [], isLoading } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  const { data: rendicionesAfiliacion = [] } = useQuery({
    queryKey: ['rendiciones-afiliacion'],
    queryFn: () => base44.entities.RendicionAfiliacion.list('-fecha', 50),
  });

  const { data: configsAfiliacion = [] } = useQuery({
    queryKey: ['config-afiliacion'],
    queryFn: () => base44.entities.ConfigAfiliacion.list('-anio', 50),
  });
  const configAnio = configsAfiliacion.find(c => Number(c.anio) === Number(anio));
  const totalDepositadoSA = useMemo(
    () => rendicionesAfiliacion.filter(r => Number(r.anio) === Number(anio)).reduce((s, r) => s + (r.monto_depositado || 0), 0),
    [rendicionesAfiliacion, anio]
  );

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Afiliacion.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['afiliaciones'] }); toast.success('Eliminado'); }
  });

  const afiliacionesAnio = useMemo(() =>
    afiliaciones.filter(a => Number(a.anio) === Number(anio)),
    [afiliaciones, anio]
  );

  // Todos los activos: chicos Y adultos/voluntarios pagan el seguro
  const beneficiariosActivos = useMemo(() =>
    beneficiarios.filter(b => b.activo !== false),
    [beneficiarios]
  );

  const mapAfiliados = useMemo(() => {
    const map = {};
    afiliacionesAnio.forEach(a => { map[a.beneficiario_id] = a; });
    return map;
  }, [afiliacionesAnio]);

  const filas = useMemo(() => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos Aires' });
    return beneficiarios
      .filter(b => !busqueda || b.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || b.dni?.includes(busqueda))
      .map(b => {
        const primera = !b.fecha_primer_afiliacion || mapAfiliados[b.id]?.es_primera_vez === true;
        const bonif = primera && esPrimeraVezBonificado(b, configAnio, hoy);
        return {
          beneficiario: b,
          afiliacion: mapAfiliados[b.id] || null,
          esPrimeraVez: primera,
          bonificado: bonif,
          inactivo: b.activo === false,
        };
      })
      .filter(f => {
        if (filtroVista === 'pagan') return !f.bonificado;
        if (filtroVista === 'no_pagan') return f.bonificado;
        if (filtroVista === 'pendientes') return !f.afiliacion;
        return true;
      })
      .sort((a, b) => {
        const aInac = a.inactivo ? 1 : 0;
        const bInac = b.inactivo ? 1 : 0;
        if (aInac !== bInac) return aInac - bInac;
        const prioridad = (f) => {
          const { afiliacion, bonificado } = f;
          if (!afiliacion) return bonificado ? 2 : 0;
          if (afiliacion.es_primera_vez && (afiliacion.monto || 0) === 0) return 2;
          const saldo = (afiliacion.monto || 0) - (afiliacion.monto_pagado || afiliacion.monto || 0);
          return saldo > 0 ? 1 : 2;
        };
        const pa = prioridad(a);
        const pb = prioridad(b);
        if (pa !== pb) return pa - pb;
        return a.beneficiario.nombre?.localeCompare(b.beneficiario.nombre);
      });
  }, [beneficiarios, mapAfiliados, busqueda, filtroVista, configAnio]);

  const totalAfiliados = afiliacionesAnio.length;
  const totalSinAfiliar = beneficiariosActivos.length - totalAfiliados;
  const totalRecaudado = afiliacionesAnio.filter(a => !a.es_primera_vez).reduce((s, a) => s + (a.monto_pagado || a.monto || 0), 0);
  const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos Aires' });
  const countNoPagan = beneficiariosActivos.filter(b => !b.fecha_primer_afiliacion && esPrimeraVezBonificado(b, configAnio, hoyStr)).length;
  const countPagan = beneficiariosActivos.length - countNoPagan;

  // Monto adeudado: sin afiliar que deben pagar + pagos parciales
  const montoAdeudado = useMemo(() => {
    let total = 0;
    beneficiariosActivos.forEach(b => {
      const primera = !b.fecha_primer_afiliacion;
      const bonificado = primera && esPrimeraVezBonificado(b, configAnio, hoyStr);
      if (bonificado) return; // primera vez bonificada hoy, no adeuda
      const afil = mapAfiliados[b.id];
      const montoSeguro = getMontoSeguro(b, configAnio);
      if (!afil) {
        total += montoSeguro;
      } else {
        total += Math.max(0, (afil.monto || montoSeguro) - (afil.monto_pagado || afil.monto || 0));
      }
    });
    return total;
  }, [beneficiariosActivos, mapAfiliados, configAnio, hoyStr]);

  const totalExigidoSA = useMemo(
    () => afiliacionesAnio.filter(a => !a.es_primera_vez).reduce((s, a) => s + (a.monto || 0), 0),
    [afiliacionesAnio]
  );
  const totalADepositarSA = Math.max(0, totalExigidoSA - totalDepositadoSA);

  return (
    <div>
      <PageHeader title="Afiliaciones" description={`Registro de afiliaciones y seguros — ${anio}`}>
        <Select value={anio} onValueChange={setAnio}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AÑOS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setShowMasivo(true)}>
          <Users className="w-4 h-4 mr-2" />Afiliación masiva
        </Button>
        <Button variant="outline" onClick={() => setShowRendicion(true)}>
          <Landmark className="w-4 h-4 mr-2" />Rendir a Scout Arg.
        </Button>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />Registrar
        </Button>
      </PageHeader>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Afiliados {anio}</p>
              <p className="text-xl font-bold text-green-600">{totalAfiliados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sin afiliar</p>
              <p className="text-xl font-bold text-red-500">{totalSinAfiliar}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">No pagan seguro</p>
              <p className="text-xl font-bold text-amber-600">{countNoPagan}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recaudado</p>
              <p className="text-xl font-bold text-blue-600">{formatMoney(totalRecaudado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Adeudado</p>
              <p className="text-xl font-bold text-orange-600">{formatMoney(montoAdeudado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A depositar SA</p>
              <p className="text-xl font-bold text-cyan-600">{formatMoney(totalADepositarSA)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nota informativa */}
      <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        Scout Argentina cobra por todos los afiliados del padrón, aunque la familia no haya abonado. Depositás el monto que SA exige; si lo recaudado no alcanza, la diferencia sale de la caja común y se recupera luego. Usá <strong className="ml-1">"Rendir a Scout Arg."</strong> para registrar el depósito y guardar el comprobante.
        <span className="ml-2 text-amber-600">· {countPagan} deben abonar · {countNoPagan} primera vez (sin costo)</span>
      </div>

      {/* Filtros */}
      <Card className="p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o DNI..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'todos', label: 'Todos' },
              { value: 'pagan', label: 'Deben pagar' },
              { value: 'no_pagan', label: 'No pagan' },
              { value: 'pendientes', label: 'Pendientes' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFiltroVista(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                  filtroVista === f.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Beneficiario</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado {anio}</TableHead>
              <TableHead>Seguro</TableHead>
              <TableHead>Pagado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filas.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay beneficiarios</TableCell></TableRow>
            ) : filas.map(({ beneficiario: b, afiliacion, esPrimeraVez, bonificado, inactivo }) => {
              const saldoPendiente = afiliacion && !afiliacion.es_primera_vez
                ? (afiliacion.monto || 0) - (afiliacion.monto_pagado || afiliacion.monto || 0)
                : 0;
              return (
                <TableRow key={b.id} className={cn(
                  inactivo ? 'opacity-60 bg-slate-50/40' : '',
                  !afiliacion && !inactivo ? 'bg-red-50/30' : ''
                )}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {b.nombre}
                      {inactivo && (
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-300">
                          Inactivo{b.fecha_baja ? ` ${new Date(b.fecha_baja + 'T00:00:00').toLocaleDateString('es-AR')}` : ''}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{b.rama || '—'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {esPrimeraVez && bonificado ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">⭐ 1ª bonificada</Badge>
                      ) : esPrimeraVez && !bonificado ? (
                        <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">⭐ 1ª vencida</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-300 border text-xs">Renovación</Badge>
                      )}
                      <button
                        onClick={() => setEditandoTipo(b)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Cambiar tipo"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {afiliacion ? (
                      afiliacion.es_primera_vez && (afiliacion.monto || 0) === 0 ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">✓ Sin costo</Badge>
                      ) : saldoPendiente > 0 ? (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-300 border text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />Parcial
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">✓ Pagado</Badge>
                      )
                    ) : esPrimeraVez ? (
                      <Badge className="bg-slate-100 text-slate-600 border text-xs">Pendiente</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">✗ Sin afiliar</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {afiliacion
                      ? afiliacion.es_primera_vez && (afiliacion.monto || 0) === 0
                        ? <span className="text-amber-600 text-xs">No abona</span>
                        : formatMoney(afiliacion.monto)
                      : bonificado
                        ? <span className="text-xs text-muted-foreground">No abona</span>
                        : <span className="text-xs text-muted-foreground">{formatMoney(getMontoSeguro(b, configAnio))}</span>}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {afiliacion && !(afiliacion.es_primera_vez && (afiliacion.monto || 0) === 0)
                      ? <>
                          <span className={saldoPendiente > 0 ? 'text-orange-600' : 'text-green-600'}>
                            {formatMoney(afiliacion.monto_pagado || afiliacion.monto)}
                          </span>
                          {saldoPendiente > 0 && (
                            <p className="text-xs text-muted-foreground">resta {formatMoney(saldoPendiente)}</p>
                          )}
                        </>
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{afiliacion?.fecha_pago || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{afiliacion?.forma_pago || '—'}</TableCell>
                  <TableCell>
                    {afiliacion && (
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(afiliacion.id)}>
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-6">
        <RendicionesList anio={anio} />
      </div>

      {showForm && (
        <AfiliacionForm
          open
          onClose={() => setShowForm(false)}
          beneficiarios={beneficiarios}
          afiliacionesExistentes={afiliacionesAnio}
          anio={anio}
          config={configAnio}
        />
      )}

      {showMasivo && (
        <AfiliacionMasivaDialog
          open
          onClose={() => setShowMasivo(false)}
          beneficiarios={beneficiarios}
          afiliacionesExistentes={afiliaciones}
          anio={anio}
          config={configAnio}
        />
      )}

      {editandoTipo && (
        <EditarTipoAfiliacionDialog
          open
          onClose={() => setEditandoTipo(null)}
          beneficiario={editandoTipo}
        />
      )}

      {showRendicion && (
        <RegistrarRendicionDialog
          open
          onClose={() => setShowRendicion(false)}
          afiliaciones={afiliaciones}
          anio={anio}
        />
      )}
    </div>
  );
}