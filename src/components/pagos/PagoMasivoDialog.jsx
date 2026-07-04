import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { MESES, CUOTA_EFECTIVO, CUOTA_TRANSFERENCIA, formatMoney, estaAlDia, calcularMesesQueGeneranDeuda, JULIO_MONTO_CREDITO, JULIO_LABEL_CREDITO } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { Users, X, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registrarPagos } from '@/lib/registros';

export default function PagoMasivoDialog({ open, onClose, beneficiarios }) {
  const [mesesSeleccionados, setMesesSeleccionados] = useState([]);
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [formaPago, setFormaPago] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [bensSeleccionados, setBensSeleccionados] = useState([]);
  const [searchBen, setSearchBen] = useState('');

  const queryClient = useQueryClient();

  const { data: pagosExistentes = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  const { data: todosCreditos = [] } = useQuery({
    queryKey: ['creditos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list(),
  });

  // Solo beneficiarios activos que abonen cuota
  const bensFiltrados = useMemo(() => {
    const lista = beneficiarios
      .filter(b => b.activo !== false && b.tipo !== 'Voluntario' && !b.becado && !['Voluntario', 'Educador'].includes(b.rama))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!searchBen) return lista;
    return lista.filter(b => b.nombre.toLowerCase().includes(searchBen.toLowerCase()));
  }, [beneficiarios, searchBen]);

  const bulkMutation = useMutation({
    mutationFn: async (pagos) => {
      await registrarPagos(pagos);
      // Procesar crédito de Julio para cada beneficiario al día
      const anioNum = parseInt(anio);
      const labelJulio = `${JULIO_LABEL_CREDITO} ${anioNum}`;
      for (const p of pagos) {
        if (p.tipo_pago !== 'Cuota' || !(p.meses?.includes('Julio'))) continue;
        const ben = beneficiarios.find(b => b.id === p.beneficiario_id);
        if (!ben) continue;
        // Verificar si ya tiene crédito de Julio
        const yaTiene = todosCreditos.some(
          c => c.beneficiario_id === ben.id && c.observaciones === labelJulio
        );
        if (yaTiene) continue;
        // Verificar si está al día
        const mesesDeuda = calcularMesesQueGeneranDeuda(ben, anioNum, afiliaciones);
        const pagosBen = pagosExistentes.filter(
          x => x.beneficiario_id === ben.id && Number(x.anio) === anioNum && x.tipo_pago !== 'Campamento'
        );
        if (!estaAlDia(ben, pagosBen, mesesDeuda)) continue;
        await base44.entities.CreditoBeneficiario.create({
          beneficiario_id: ben.id,
          beneficiario_nombre: ben.nombre,
          monto_original: JULIO_MONTO_CREDITO,
          monto_disponible: JULIO_MONTO_CREDITO,
          fecha: new Date().toISOString().split('T')[0],
          observaciones: labelJulio,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario'] });
      queryClient.invalidateQueries({ queryKey: ['creditos-todos'] });
      toast.success(`Pagos registrados correctamente`);
      onClose();
    },
  });

  const cuotaUnitaria = formaPago === 'Efectivo' ? CUOTA_EFECTIVO : formaPago === 'Transferencia' ? CUOTA_TRANSFERENCIA : 0;
  const destino = formaPago === 'Transferencia' ? 'Banco' : 'Caja';
  const montoPorPersona = mesesSeleccionados.length * cuotaUnitaria;
  const totalGeneral = montoPorPersona * bensSeleccionados.length;

  // Meses ya pagados por cada beneficiario
  const mesesPagadosPorBen = useMemo(() => {
    const map = {};
    for (const b of bensSeleccionados) {
      map[b] = pagosExistentes
        .filter(p => p.beneficiario_id === b && p.anio === parseInt(anio) && p.tipo_pago === 'Cuota')
        .flatMap(p => p.meses || (p.mes ? [p.mes] : []));
    }
    return map;
  }, [bensSeleccionados, pagosExistentes, anio]);

  const toggleBen = (id) => {
    setBensSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    if (bensSeleccionados.length === bensFiltrados.length) {
      setBensSeleccionados([]);
    } else {
      setBensSeleccionados(bensFiltrados.map(b => b.id));
    }
  };

  const toggleMes = (mes) => {
    setMesesSeleccionados(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]);
  };

  const handleGuardar = () => {
    if (!formaPago || mesesSeleccionados.length === 0 || bensSeleccionados.length === 0) return;

    const pagos = [];
    for (const benId of bensSeleccionados) {
      const ben = beneficiarios.find(b => b.id === benId);
      const yaPagados = mesesPagadosPorBen[benId] || [];
      const mesesNuevos = mesesSeleccionados.filter(m => !yaPagados.includes(m));
      if (mesesNuevos.length === 0) continue;
      pagos.push({
        beneficiario_id: benId,
        beneficiario_nombre: ben?.nombre || '',
        tipo_pago: 'Cuota',
        anio: parseInt(anio),
        meses: mesesNuevos,
        mes: mesesNuevos[0],
        forma_pago: formaPago,
        destino,
        monto: mesesNuevos.length * cuotaUnitaria,
        fecha_pago: fechaPago,
      });
    }

    if (pagos.length === 0) {
      toast.error('Todos los meses seleccionados ya están pagados para los beneficiarios elegidos');
      return;
    }

    bulkMutation.mutate(pagos);
  };

  const canSave = formaPago && mesesSeleccionados.length > 0 && bensSeleccionados.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Registro Masivo de Cuotas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Año y forma de pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Año *</Label>
              <Select value={anio} onValueChange={setAnio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2026, 2027, 2028].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pago *</Label>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo → Caja ({formatMoney(CUOTA_EFECTIVO)}/mes)</SelectItem>
                  <SelectItem value="Transferencia">Transferencia → Banco ({formatMoney(CUOTA_TRANSFERENCIA)}/mes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fecha */}
          <div>
            <Label>Fecha de pago</Label>
            <Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
          </div>

          {/* Meses */}
          <div>
            <Label className="mb-2 block">Meses a abonar * — {mesesSeleccionados.length} seleccionado(s)</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {MESES.map(mes => {
                const sel = mesesSeleccionados.includes(mes);
                return (
                  <button
                    key={mes}
                    type="button"
                    onClick={() => toggleMes(mes)}
                    className={cn(
                      'p-2 rounded-md text-xs font-medium border transition-all',
                      sel ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {mes.substring(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Beneficiarios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Beneficiarios * — {bensSeleccionados.length} seleccionado(s)</Label>
              <button
                type="button"
                onClick={toggleTodos}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                {bensSeleccionados.length === bensFiltrados.length
                  ? <><Square className="w-3 h-3" />Desmarcar todos</>
                  : <><CheckSquare className="w-3 h-3" />Seleccionar todos</>}
              </button>
            </div>
            <Input
              placeholder="Buscar beneficiario..."
              value={searchBen}
              onChange={e => setSearchBen(e.target.value)}
              className="mb-2"
            />
            <div className="border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
              {bensFiltrados.map((b, i) => {
                const sel = bensSeleccionados.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBen(b.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors border-b last:border-0',
                      sel ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted/50'
                    )}
                  >
                    <span>{b.nombre}</span>
                    <div className="flex items-center gap-2">
                      {b.rama && <Badge variant="outline" className="text-xs py-0">{b.rama}</Badge>}
                      {sel
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumen */}
          {canSave && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm space-y-1">
              <p className="font-semibold text-green-800 mb-2">Resumen del registro masivo</p>
              <div className="flex justify-between text-green-700">
                <span>{bensSeleccionados.length} beneficiarios × {mesesSeleccionados.length} mes(es)</span>
                <span>{formatMoney(montoPorPersona)} c/u</span>
              </div>
              <div className="flex justify-between font-bold text-green-800 border-t border-green-200 pt-1 mt-1">
                <span>Total a registrar</span>
                <span>{formatMoney(totalGeneral)}</span>
              </div>
              <p className="text-xs text-green-600">* Se omitirán meses ya pagados automáticamente</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={!canSave || bulkMutation.isPending}>
            {bulkMutation.isPending ? 'Registrando...' : `Registrar ${bensSeleccionados.length > 0 ? bensSeleccionados.length : ''} pago(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}