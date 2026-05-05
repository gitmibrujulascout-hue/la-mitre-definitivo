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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle2, XCircle, Search, Users, DollarSign, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AÑOS = [2024, 2025, 2026, 2027, 2028];

function AfiliacionForm({ open, onClose, beneficiarios, afiliacionesExistentes, anio }) {
  const [form, setForm] = useState({
    beneficiario_id: '',
    monto: '',
    fecha_pago: new Date().toISOString().split('T')[0],
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
  const yaAfiliado = afiliacionesExistentes.some(a => a.beneficiario_id === form.beneficiario_id && Number(a.anio) === Number(anio));

  const handleSave = () => {
    if (!form.beneficiario_id) return;
    createMutation.mutate({
      ...form,
      anio: Number(anio),
      monto: esPrimeraVez ? 0 : parseFloat(form.monto) || 0,
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
            <Select value={form.beneficiario_id} onValueChange={v => setForm(p => ({ ...p, beneficiario_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario..." /></SelectTrigger>
              <SelectContent>
                {beneficiarios.filter(b => b.activo !== false).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre} {b.dni ? `(${b.dni})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {beneficiarioSel && (
            <div className={cn('p-3 rounded-lg text-sm', esPrimeraVez ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-200 text-blue-800')}>
              {esPrimeraVez
                ? '⭐ Primera afiliación — No abona seguro'
                : `Ya afiliado desde ${beneficiarioSel.fecha_primer_afiliacion} — Debe abonar seguro`}
            </div>
          )}

          {yaAfiliado && (
            <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
              ⚠️ Este beneficiario ya tiene afiliación registrada para {anio}
            </div>
          )}

          {!esPrimeraVez && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto seguro</Label>
                  <Input type="number" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label>Fecha de pago</Label>
                  <Input type="date" value={form.fecha_pago} onChange={e => setForm(p => ({ ...p, fecha_pago: e.target.value }))} />
                </div>
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
            </>
          )}

          {esPrimeraVez && (
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
          <Button onClick={handleSave} disabled={!form.beneficiario_id || yaAfiliado}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Afiliaciones() {
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const queryClient = useQueryClient();

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: afiliaciones = [], isLoading } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Afiliacion.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['afiliaciones'] }); toast.success('Eliminado'); }
  });

  const afiliacionesAnio = useMemo(() =>
    afiliaciones.filter(a => Number(a.anio) === Number(anio)),
    [afiliaciones, anio]
  );

  // Lista de beneficiarios activos con su estado de afiliación para el año
  const beneficiariosActivos = useMemo(() =>
    beneficiarios.filter(b => b.activo !== false && b.tipo !== 'Voluntario'),
    [beneficiarios]
  );

  const mapAfiliados = useMemo(() => {
    const map = {};
    afiliacionesAnio.forEach(a => { map[a.beneficiario_id] = a; });
    return map;
  }, [afiliacionesAnio]);

  const filas = useMemo(() => {
    return beneficiariosActivos
      .filter(b => !busqueda || b.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || b.dni?.includes(busqueda))
      .map(b => ({
        beneficiario: b,
        afiliacion: mapAfiliados[b.id] || null,
        esPrimeraVez: !b.fecha_primer_afiliacion,
      }))
      .sort((a, b) => {
        // Primero los sin afiliar, luego por nombre
        if (!a.afiliacion && b.afiliacion) return -1;
        if (a.afiliacion && !b.afiliacion) return 1;
        return a.beneficiario.nombre?.localeCompare(b.beneficiario.nombre);
      });
  }, [beneficiariosActivos, mapAfiliados, busqueda]);

  const totalAfiliados = afiliacionesAnio.length;
  const totalSinAfiliar = beneficiariosActivos.length - totalAfiliados;
  const totalRecaudado = afiliacionesAnio.filter(a => !a.es_primera_vez).reduce((s, a) => s + (a.monto || 0), 0);

  return (
    <div>
      <PageHeader title="Afiliaciones" description={`Registro de afiliaciones y seguros — ${anio}`}>
        <Select value={anio} onValueChange={setAnio}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AÑOS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />Registrar Afiliación
        </Button>
      </PageHeader>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recaudado (seguro)</p>
              <p className="text-xl font-bold text-blue-600">{formatMoney(totalRecaudado)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nota informativa */}
      <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        El dinero de afiliaciones/seguros se rinde directamente a la asociación y <strong className="ml-1">no impacta en Caja ni Banco.</strong>
      </div>

      {/* Buscador */}
      <Card className="p-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o DNI..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Beneficiario</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead>Estado {anio}</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha Pago</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filas.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay beneficiarios</TableCell></TableRow>
            ) : filas.map(({ beneficiario: b, afiliacion, esPrimeraVez }) => (
              <TableRow key={b.id} className={!afiliacion ? 'bg-red-50/30' : ''}>
                <TableCell className="font-medium">{b.nombre}</TableCell>
                <TableCell className="text-muted-foreground">{b.dni || '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{b.rama || '—'}</Badge>
                </TableCell>
                <TableCell>
                  {afiliacion ? (
                    afiliacion.es_primera_vez ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">⭐ Primera vez</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">✓ Afiliado</Badge>
                    )
                  ) : esPrimeraVez ? (
                    <Badge className="bg-slate-100 text-slate-600 border text-xs">Primera vez (pendiente)</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">✗ Sin afiliar</Badge>
                  )}
                </TableCell>
                <TableCell className="font-semibold">
                  {afiliacion
                    ? afiliacion.es_primera_vez ? <span className="text-amber-600 text-xs">No abona</span> : formatMoney(afiliacion.monto)
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
            ))}
          </TableBody>
        </Table>
      </Card>

      {showForm && (
        <AfiliacionForm
          open
          onClose={() => setShowForm(false)}
          beneficiarios={beneficiarios}
          afiliacionesExistentes={afiliacionesAnio}
          anio={anio}
        />
      )}
    </div>
  );
}