import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { differenceInYears, parseISO } from 'date-fns';
import {
  Users, MapPin, Calendar, AlertTriangle,
  HeartPulse, Phone, Plus, Trash2, UserPlus, CreditCard, Tent, Printer, FileCheck
} from 'lucide-react';
import { SALUD_FIELDS } from '@/lib/saludFields';
import { formatMoney } from '@/lib/ramaUtils';
import BalanceCampamento from '@/components/campamentos/BalanceCampamento';
import AutorizacionesPanel from '@/components/campamentos/AutorizacionesPanel';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ORDEN_RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];

// ——— Mini formulario de pago de campamento ———
function PagoCampamentoDialog({ open, onClose, campamento, beneficiarios, pagos, onSaved }) {
  const [benId, setBenId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  const listaAsistentes = useMemo(() => {
    const ids = [...(campamento.beneficiarios_ids || []), ...(campamento.adultos_ids || [])];
    return beneficiarios.filter(b => ids.includes(b.id)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [campamento, beneficiarios]);

  const pagadoPor = (id) => pagos.filter(p => p.campamento_id === campamento.id && p.beneficiario_id === id).reduce((s, p) => s + p.monto, 0);
  const costo = (ben) => {
    if (!ben) return campamento.costo_por_persona;
    const esAdulto = ben.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(ben.rama);
    if (esAdulto && campamento.adultos_pagan) return campamento.costo_adultos || campamento.costo_por_persona;
    return campamento.costo_por_persona;
  };

  const benSeleccionado = beneficiarios.find(b => b.id === benId);
  const costoBen = costo(benSeleccionado);
  const yaPageBen = pagadoPor(benId);
  const saldo = costoBen - yaPageBen;

  const mut = useMutation({
    mutationFn: (data) => base44.entities.Pago.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos_pub'] });
      toast.success('Pago registrado');
      onClose();
      setBenId(''); setMonto('');
      if (onSaved) onSaved();
    },
  });

  const handleSave = () => {
    if (!benId || !monto) return;
    mut.mutate({
      beneficiario_id: benId,
      beneficiario_nombre: benSeleccionado?.nombre || '',
      tipo_pago: 'Campamento',
      campamento_id: campamento.id,
      campamento_nombre: campamento.nombre,
      anio: new Date().getFullYear(),
      monto: parseFloat(monto),
      forma_pago: 'Efectivo',
      destino: 'Caja',
      fecha_pago: fecha,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tent className="w-4 h-4" />Registrar pago de campamento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Persona</Label>
            <Select value={benId} onValueChange={v => {
              setBenId(v);
              const ben = beneficiarios.find(b => b.id === v);
              const c = costo(ben);
              const p = pagadoPor(v);
              setMonto(c - p > 0 ? String(c - p) : '');
            }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>{listaAsistentes.map(b => <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {benId && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Costo:</span><span className="font-medium">{formatMoney(costoBen)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ya pagado:</span><span className="font-medium text-green-600">{formatMoney(yaPageBen)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-semibold">Saldo:</span><span className={`font-bold ${saldo > 0 ? 'text-red-500' : 'text-green-600'}`}>{formatMoney(saldo)}</span></div>
            </div>
          )}
          <div>
            <Label>Monto</Label>
            <Input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder={saldo > 0 ? saldo.toString() : '0'} />
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
            💵 Pago en efectivo
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!benId || !monto || mut.isPending}>
            {mut.isPending ? 'Registrando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ——— Ficha médica de una persona ———
function FichaMedicaDialog({ open, onClose, beneficiario }) {
  if (!beneficiario) return null;
  const campos = SALUD_FIELDS.filter(f => beneficiario[f.key] != null && String(beneficiario[f.key]).trim() !== '');
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-primary" />{beneficiario.nombre}
          </DialogTitle>
        </DialogHeader>
        {campos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin datos médicos cargados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {campos.map(f => (
              <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium">{beneficiario[f.key]}</p>
              </div>
            ))}
          </div>
        )}
        {beneficiario.contacto_emergencia_nombre && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-800 mb-1">Contacto de emergencia</p>
            <p className="text-sm">{beneficiario.contacto_emergencia_nombre}</p>
            {beneficiario.contacto_emergencia_telefono && (
              <a href={`tel:${beneficiario.contacto_emergencia_telefono}`} className="text-sm text-primary flex items-center gap-1 mt-0.5">
                <Phone className="w-3.5 h-3.5" />{beneficiario.contacto_emergencia_telefono}
              </a>
            )}
            {beneficiario.contacto_emergencia_relacion && (
              <p className="text-xs text-muted-foreground">{beneficiario.contacto_emergencia_relacion}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ——— Agregar/quitar participante ———
function ModificarParticipantesDialog({ open, onClose, campamento, beneficiarios, onSaved }) {
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('beneficiarios'); // 'beneficiarios' | 'adultos'
  const queryClient = useQueryClient();

  const idsActualesNinos = campamento.beneficiarios_ids || [];
  const idsActualesAdultos = campamento.adultos_ids || [];

  const candidatos = useMemo(() => {
    const q = busqueda.toLowerCase();
    const ramasPart = campamento.ramas_participantes || [];
    return beneficiarios
      .filter(b => b.activo !== false && b.nombre?.toLowerCase().includes(q))
      .sort((a, b) => {
        const aInRama = ramasPart.includes(a.rama) ? 0 : 1;
        const bInRama = ramasPart.includes(b.rama) ? 0 : 1;
        if (aInRama !== bInRama) return aInRama - bInRama;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }, [beneficiarios, busqueda, campamento.ramas_participantes]);

  const mut = useMutation({
    mutationFn: (data) => base44.entities.Campamento.update(campamento.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campamento_pub'] });
      toast.success('Participantes actualizados');
      if (onSaved) onSaved();
    },
  });

  const toggle = (benId) => {
    if (tipo === 'beneficiarios') {
      const nueva = idsActualesNinos.includes(benId)
        ? idsActualesNinos.filter(id => id !== benId)
        : [...idsActualesNinos, benId];
      mut.mutate({ beneficiarios_ids: nueva });
    } else {
      const nueva = idsActualesAdultos.includes(benId)
        ? idsActualesAdultos.filter(id => id !== benId)
        : [...idsActualesAdultos, benId];
      mut.mutate({ adultos_ids: nueva });
    }
  };

  const idsActuales = tipo === 'beneficiarios' ? idsActualesNinos : idsActualesAdultos;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" />Modificar participantes</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          {['beneficiarios', 'adultos'].map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-all ${tipo === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}>
              {t === 'beneficiarios' ? `Beneficiarios (${idsActualesNinos.length})` : `Adultos (${idsActualesAdultos.length})`}
            </button>
          ))}
        </div>
        <Input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="mb-2" />
        <div className="flex-1 overflow-y-auto space-y-1">
          {candidatos.map(b => {
            const enLista = idsActuales.includes(b.id);
            return (
              <div key={b.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${enLista ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                <div>
                  <p className="text-sm font-medium">{b.nombre}</p>
                  {b.rama && <p className="text-xs text-muted-foreground">{b.rama}</p>}
                </div>
                <Button
                  size="sm"
                  variant={enLista ? 'destructive' : 'default'}
                  disabled={mut.isPending}
                  onClick={() => toggle(b.id)}
                  className="ml-2"
                >
                  {enLista ? <Trash2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ——— Página principal ———
export default function CampamentoPublico() {
  const { codigo } = useParams();
  const [showPago, setShowPago] = useState(false);
  const [showModificar, setShowModificar] = useState(false);
  const [fichaBen, setFichaBen] = useState(null);

  const { data: accesos = [], isLoading: loadingAcceso } = useQuery({
    queryKey: ['acceso_pub', codigo],
    queryFn: () => base44.entities.AccesoCampamento.filter({ codigo }),
    enabled: !!codigo,
  });

  const acceso = accesos.find(a => a.activo !== false);

  const { data: campamento, isLoading: loadingCamp } = useQuery({
    queryKey: ['campamento_pub', acceso?.campamento_id],
    queryFn: () => base44.entities.Campamento.filter({ id: acceso.campamento_id }).then(r => r[0]),
    enabled: !!acceso?.campamento_id,
  });

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
    enabled: !!acceso,
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos_pub', acceso?.campamento_id],
    queryFn: () => base44.entities.Pago.filter({ campamento_id: acceso.campamento_id }),
    enabled: !!acceso?.campamento_id,
  });

  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos_pub', acceso?.campamento_id],
    queryFn: () => base44.entities.Gasto.filter({ campamento_id: acceso.campamento_id }).catch(() => []),
    enabled: !!acceso?.campamento_id,
  });

  const getBen = (id) => beneficiarios.find(b => b.id === id);
  const ninos = useMemo(
    () => (campamento?.beneficiarios_ids || []).map(getBen).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [campamento, beneficiarios]
  );
  const adultos = useMemo(
    () => (campamento?.adultos_ids || []).map(getBen).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [campamento, beneficiarios]
  );

  const conAlertas = useMemo(
    () => [...ninos, ...adultos].filter(b => b.alergias || b.regimen_dietario || b.condicion_medica || b.medicacion_habitual),
    [ninos, adultos]
  );

  const menoresCount = useMemo(() =>
    (campamento?.beneficiarios_ids || []).map(getBen).filter(Boolean)
      .filter(b => !b.fecha_nacimiento || differenceInYears(new Date(), parseISO(b.fecha_nacimiento)) < 18).length,
    [campamento, beneficiarios]
  );
  const autorizacionesCount = (campamento?.autorizaciones_ids || []).length;

  const ninosPorRama = useMemo(() => {
    const map = {};
    ninos.forEach(b => {
      const r = b.rama || 'Sin rama';
      if (!map[r]) map[r] = [];
      map[r].push(b);
    });
    const ordenadas = ORDEN_RAMAS.filter(r => map[r]).map(r => [r, map[r]]);
    const otras = Object.entries(map).filter(([r]) => !ORDEN_RAMAS.includes(r));
    return [...ordenadas, ...otras];
  }, [ninos]);

  const pagadoPor = (id) => pagos.filter(p => p.beneficiario_id === id).reduce((s, p) => s + p.monto, 0);
  const costo = (ben) => {
    const esAdulto = ben.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(ben.rama);
    if (esAdulto && campamento?.adultos_pagan) return campamento.costo_adultos || campamento.costo_por_persona;
    return campamento?.costo_por_persona;
  };

  const handlePrint = () => {
    if (!campamento) return;
    const autorizadosSet = new Set(campamento.autorizaciones_ids || []);
    const pagosMap = {};
    pagos.forEach(p => {
      if (p.tipo_pago === 'Campamento' && p.campamento_id === campamento.id) {
        pagosMap[p.beneficiario_id] = (pagosMap[p.beneficiario_id] || 0) + (p.monto || 0);
      }
    });
    let contador = 0;
    const ramasHtml = ninosPorRama.map(([rama, lista]) => {
      const rows = lista.map(b => {
        contador++;
        const autorizo = autorizadosSet.has(b.id) ? '✓' : '';
        const montoPagado = pagosMap[b.id] ? `$${pagosMap[b.id].toLocaleString('es-AR')}` : '';
        return `<tr>
          <td>${contador}</td><td>${b.nombre}</td><td>${b.dni || ''}</td>
          <td style="text-align:center;${autorizadosSet.has(b.id) ? 'color:green;font-weight:bold' : ''}">${autorizo}</td>
          <td style="text-align:center;${pagosMap[b.id] ? 'color:green;font-weight:bold' : ''}">${montoPagado}</td>
        </tr>`;
      }).join('');
      const color = rama === 'Lobatos' ? '#fef9c3' : rama === 'Tropa' ? '#dcfce7' : rama === 'KM' ? '#dbeafe' : rama === 'Rovers' ? '#fee2e2' : '#f1f5f9';
      return `<div style="font-weight:bold;font-size:13px;padding:6px 10px;border-radius:4px;margin-top:16px;border:1px solid #ccc;background:${color}">${rama} (${lista.length})</div>
        <table><thead><tr><th>#</th><th>Nombre</th><th>DNI</th><th style="width:80px;text-align:center">Autorización</th><th style="width:90px;text-align:center">Pago</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }).join('');
    const adultosRows = adultos.map((b, i) => {
      const pagadoAdulto = pagosMap[b.id] || 0;
      const pagoStr = campamento.adultos_pagan
        ? (pagadoAdulto ? `$${pagadoAdulto.toLocaleString('es-AR')}` : '')
        : 'No abona';
      const pagoStyle = pagadoAdulto ? 'style="text-align:center;color:green;font-weight:bold"' : 'style="text-align:center"';
      return `<tr><td>${i+1}</td><td>${b.nombre}</td><td>${b.funcion || b.rama_educador || b.rama || ''}</td><td>${b.dni || ''}</td><td ${pagoStyle}>${pagoStr}</td></tr>`;
    }).join('');
    const resumenTexto = ninosPorRama.map(([r, l]) => `${r}: ${l.length}`).join(' | ');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Listado ${campamento.nombre}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}h1{margin-bottom:4px;font-size:18px}.meta{color:#555;margin-bottom:16px;font-size:11px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f0f0f0;font-size:12px}td{font-size:12px}.seccion{margin-top:20px;font-weight:bold;font-size:14px;border-bottom:2px solid #333;padding-bottom:4px}.resumen{margin-top:20px;padding:10px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:12px}</style>
    </head><body>
    <h1>${campamento.nombre}</h1>
    <div class="meta">${campamento.ubicacion ? `📍 ${campamento.ubicacion} &nbsp;` : ''}${campamento.fecha_inicio ? `📅 ${campamento.fecha_inicio}${campamento.fecha_fin ? ` al ${campamento.fecha_fin}` : ''}` : ''} &nbsp;|&nbsp; Costo beneficiarios: ${formatMoney(campamento.costo_por_persona)}</div>
     ${ninos.length > 0 ? `<div class="seccion">Beneficiarios (${ninos.length})</div>${ramasHtml}` : ''}
    ${adultos.length > 0 ? `<div class="seccion" style="margin-top:24px">Adultos / Voluntarios (${adultos.length})</div><table><thead><tr><th>#</th><th>Nombre</th><th>Rol</th><th>DNI</th><th>Pago</th></tr></thead><tbody>${adultosRows}</tbody></table>` : ''}
    <div class="resumen"><strong>Resumen:</strong> ${resumenTexto}${adultos.length > 0 ? ` | Adultos: ${adultos.length}` : ''} | <strong>TOTAL: ${ninos.length + adultos.length} personas</strong></div>
    </body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  if (loadingAcceso || loadingCamp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!acceso || !campamento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-sm w-full mx-4 p-8 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-xl font-bold mb-2">Código no válido</h1>
          <p className="text-muted-foreground text-sm">El código de acceso no existe o fue desactivado. Pedí un nuevo link al responsable del grupo.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-5 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs opacity-70 mb-1 uppercase tracking-wide">Acceso externo</p>
          <h1 className="text-2xl font-bold">{campamento.nombre}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm opacity-90">
            {campamento.ubicacion && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{campamento.ubicacion}</span>}
            {campamento.fecha_inicio && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{campamento.fecha_inicio}{campamento.fecha_fin ? ` — ${campamento.fecha_fin}` : ''}</span>}
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{ninos.length + adultos.length} personas</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Stats resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold">{ninos.length}</p>
            <p className="text-xs text-muted-foreground">Beneficiarios</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold">{adultos.length}</p>
            <p className="text-xs text-muted-foreground">Adultos</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{ninos.length + adultos.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-3 text-center">
            <p className={`text-2xl font-bold ${autorizacionesCount === menoresCount && menoresCount > 0 ? 'text-green-600' : 'text-amber-500'}`}>
              {autorizacionesCount}/{menoresCount}
            </p>
            <p className="text-xs text-muted-foreground">Autorizaciones</p>
          </Card>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => setShowPago(true)} className="flex-1 sm:flex-none">
            <CreditCard className="w-4 h-4 mr-2" />Registrar pago
          </Button>
          <Button variant="outline" onClick={() => setShowModificar(true)} className="flex-1 sm:flex-none">
            <UserPlus className="w-4 h-4 mr-2" />Modificar participantes
          </Button>
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="w-4 h-4 mr-2" />Exportar listado
          </Button>
        </div>

        {/* Autorizaciones y Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <AutorizacionesPanel campamento={campamento} beneficiarios={beneficiarios} invalidateKey="campamento_pub" />
          <BalanceCampamento campamento={campamento} pagos={pagos} gastos={gastos} />
        </div>

        {/* Alertas médicas */}
        {conAlertas.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" />Alertas médicas y dietarias ({conAlertas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {conAlertas.map(b => (
                <div key={b.id} className="py-2 border-b border-amber-200 last:border-0">
                  <button className="text-left w-full" onClick={() => setFichaBen(b)}>
                    <p className="font-semibold text-sm text-amber-900 hover:underline">{b.nombre}</p>
                  </button>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {b.alergias && <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">🚫 Alergia: {b.alergias}</Badge>}
                    {b.regimen_dietario && <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">🥗 Dieta: {b.regimen_dietario}</Badge>}
                    {b.condicion_medica && <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">🏥 {b.condicion_medica}</Badge>}
                    {b.medicacion_habitual && <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">💊 {b.medicacion_habitual}</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Listado beneficiarios */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />Beneficiarios ({ninos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {ninos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin beneficiarios asignados</p>
            ) : ninosPorRama.map(([rama, lista]) => (
              <div key={rama} className="mb-4 last:mb-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1 px-1">{rama}</p>
                {lista.map((b, i) => {
                  const pagado = pagadoPor(b.id);
                  const costoB = costo(b);
                  const saldo = costoB - pagado;
                  return (
                    <div key={b.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 text-sm border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground w-5 text-xs">{i + 1}.</span>
                      <span className="flex-1 font-medium">{b.nombre}</span>
                      <button onClick={() => setFichaBen(b)} className="text-muted-foreground hover:text-primary p-1" title="Ver ficha médica">
                        <HeartPulse className="w-3.5 h-3.5" />
                      </button>
                      <div className="text-right">
                        <p className={`text-xs font-semibold ${saldo <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {saldo <= 0 ? '✓ Pagado' : `Debe ${formatMoney(saldo)}`}
                        </p>
                        {pagado > 0 && <p className="text-xs text-muted-foreground">{formatMoney(pagado)} abonado</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Adultos */}
        {adultos.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />Adultos / Voluntarios ({adultos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {adultos.map((b, i) => {
                const esAdultoQ = campamento.adultos_pagan;
                const pagado = pagadoPor(b.id);
                const costoB = costo(b);
                const saldo = costoB - pagado;
                return (
                  <div key={b.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 text-sm border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground w-5 text-xs">{i + 1}.</span>
                    <span className="flex-1 font-medium">{b.nombre}</span>
                    {b.rama_educador && <Badge variant="outline" className="text-xs">{b.rama_educador}</Badge>}
                    <button onClick={() => setFichaBen(b)} className="text-muted-foreground hover:text-primary p-1">
                      <HeartPulse className="w-3.5 h-3.5" />
                    </button>
                    {esAdultoQ ? (
                      <span className={`text-xs font-semibold ${saldo <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {saldo <= 0 ? '✓ Pagado' : `Debe ${formatMoney(saldo)}`}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No abona</Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <PagoCampamentoDialog
        open={showPago}
        onClose={() => setShowPago(false)}
        campamento={campamento}
        beneficiarios={beneficiarios}
        pagos={pagos}
      />
      <ModificarParticipantesDialog
        open={showModificar}
        onClose={() => setShowModificar(false)}
        campamento={campamento}
        beneficiarios={beneficiarios}
      />
      <FichaMedicaDialog
        open={!!fichaBen}
        onClose={() => setFichaBen(null)}
        beneficiario={fichaBen}
      />
    </div>
  );
}