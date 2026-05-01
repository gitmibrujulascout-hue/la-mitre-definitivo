import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle2, XCircle, Award, Tent, Gift, Zap } from 'lucide-react';
import RamaBadge from '@/components/shared/RamaBadge';
import { MESES, MESES_SIN_CUOTA, MESES_BONIFICADOS, CUOTA_EFECTIVO, formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CuentaDetalle({ beneficiario, pagos, campamentos, anio, onBack }) {
  const [showAplicar, setShowAplicar] = useState(false);
  const [creditoSeleccionado, setCreditoSeleccionado] = useState(null);
  const queryClient = useQueryClient();

  if (!beneficiario) return null;

  const pagosAnio = pagos.filter(p => p.anio === anio);
  const mesesPagados = pagosAnio.flatMap(p => p.meses || (p.mes ? [p.mes] : []));

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />Volver
      </Button>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">{beneficiario.nombre}</h2>
            <div className="flex items-center gap-2 mt-2">
              <RamaBadge rama={beneficiario.rama} />
              {beneficiario.becado && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 border"><Award className="w-3 h-3 mr-1" />Becado</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Saldo {anio}</p>
            <p className={cn('text-3xl font-bold', beneficiario.saldo >= 0 ? 'text-green-600' : 'text-red-500')}>
              {formatMoney(beneficiario.saldo)}
            </p>
          </div>
        </div>
      </Card>

      {/* Créditos de actividades económicas */}
      <CreditosPanel
        beneficiarioId={beneficiario.id}
        beneficiarioNombre={beneficiario.nombre}
        campamentos={campamentos}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['pagos'] })}
      />

      {/* Grilla de meses */}
      <h3 className="font-semibold mb-3">Cuotas {anio}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
        {MESES.map(mes => {
          const pago = pagosAnio.find(p => (p.meses || [p.mes]).includes(mes));
          const pagado = !!pago;
          const sinCuota = MESES_SIN_CUOTA.includes(mes);
          const bonificado = MESES_BONIFICADOS.includes(mes);

          return (
            <Card key={mes} className={cn(
              'p-3 text-center transition-all',
              sinCuota ? 'bg-slate-50 border-slate-200 opacity-50' :
              beneficiario.becado || bonificado ? 'bg-amber-50 border-amber-200' :
              pagado ? 'bg-green-50 border-green-200' : 'bg-muted/50'
            )}>
              <p className="text-xs font-medium text-muted-foreground">{mes.substring(0, 3)}</p>
              {sinCuota ? (
                <p className="text-xs text-slate-400 mt-1">—</p>
              ) : beneficiario.becado ? (
                <Award className="w-5 h-5 text-amber-500 mx-auto mt-1" />
              ) : bonificado && !pagado ? (
                <>
                  <Award className="w-5 h-5 text-amber-400 mx-auto mt-1" />
                  <p className="text-xs text-amber-600 mt-1">Bonif.</p>
                </>
              ) : pagado ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">{pago.forma_pago}</p>
                </>
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground/30 mx-auto mt-1" />
              )}
            </Card>
          );
        })}
      </div>

      {/* Campamentos */}
      {campamentos.length > 0 && (
        <>
          <h3 className="font-semibold mb-3">Campamentos</h3>
          <div className="space-y-2 mb-6">
            {campamentos.map(c => (
              <Card key={c.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tent className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.fecha_inicio}</p>
                  </div>
                </div>
                <p className="font-semibold text-red-500">{formatMoney(c.costo_por_persona)}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Historial de pagos */}
      <h3 className="font-semibold mb-3">Historial de pagos</h3>
      {pagos.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">No hay pagos registrados</Card>
      ) : (
        <div className="space-y-2">
          {pagos.map(p => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {p.tipo_pago === 'Campamento' ? p.campamento_nombre : (p.meses?.join(', ') || p.mes)} {p.anio}
                </p>
                <p className="text-xs text-muted-foreground">{p.forma_pago} · {p.fecha_pago}</p>
              </div>
              <p className="font-semibold text-green-600">{formatMoney(p.monto)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Subcomponente: panel de créditos disponibles del beneficiario
function CreditosPanel({ beneficiarioId, beneficiarioNombre, campamentos, onSaved }) {
  const [showAplicar, setShowAplicar] = useState(false);
  const [creditoSel, setCreditoSel] = useState(null);
  const queryClient = useQueryClient();

  const { data: creditos = [] } = useQuery({
    queryKey: ['creditos-beneficiario', beneficiarioId],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ beneficiario_id: beneficiarioId }),
  });

  const disponibles = creditos.filter(c => (c.monto_disponible || 0) > 0);

  if (disponibles.length === 0) return null;

  return (
    <>
      <div className="mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />Créditos de actividades económicas
        </h3>
        <div className="space-y-2">
          {disponibles.map(cr => (
            <Card key={cr.id} className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-sm">{cr.actividad_nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    Disponible: <span className="font-semibold text-primary">{formatMoney(cr.monto_disponible)}</span>
                    {cr.monto_original !== cr.monto_disponible && ` (original: ${formatMoney(cr.monto_original)})`}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => { setCreditoSel(cr); setShowAplicar(true); }}
                >
                  <Zap className="w-3 h-3 mr-1" />Aplicar crédito
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {showAplicar && creditoSel && (
        <AplicarCreditoDialog
          credito={creditoSel}
          beneficiarioId={beneficiarioId}
          beneficiarioNombre={beneficiarioNombre}
          campamentos={campamentos}
          onClose={() => { setShowAplicar(false); setCreditoSel(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['creditos-beneficiario', beneficiarioId] });
            queryClient.invalidateQueries({ queryKey: ['pagos'] });
            setShowAplicar(false);
            setCreditoSel(null);
            onSaved();
          }}
        />
      )}
    </>
  );
}

// Dialog para aplicar un crédito a cuota o campamento
function AplicarCreditoDialog({ credito, beneficiarioId, beneficiarioNombre, campamentos, onClose, onSaved }) {
  const [tipo, setTipo] = useState('Cuota');
  const [meses, setMeses] = useState([]);
  const [campamentoId, setCampamentoId] = useState('');
  const [monto, setMonto] = useState(credito.monto_disponible.toString());

  const montoNum = parseFloat(monto) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const campamento = campamentos.find(c => c.id === campamentoId);
      // Registrar el pago
      await base44.entities.Pago.create({
        beneficiario_id: beneficiarioId,
        beneficiario_nombre: beneficiarioNombre,
        tipo_pago: tipo === 'Cuota' ? 'Cuota' : 'Campamento',
        meses: tipo === 'Cuota' ? meses : [],
        mes: tipo === 'Cuota' ? meses[0] : undefined,
        anio: new Date().getFullYear(),
        campamento_id: tipo === 'Campamento' ? campamentoId : undefined,
        campamento_nombre: tipo === 'Campamento' ? campamento?.nombre : undefined,
        forma_pago: 'Crédito actividad',
        destino: 'Caja',
        monto: montoNum,
        fecha_pago: new Date().toISOString().split('T')[0],
        observaciones: `Crédito aplicado de: ${credito.actividad_nombre}`,
      });
      // Descontar del crédito disponible
      const nuevoDisponible = Math.max(0, credito.monto_disponible - montoNum);
      await base44.entities.CreditoBeneficiario.update(credito.id, {
        monto_disponible: nuevoDisponible,
      });
    },
    onSuccess: () => { toast.success('Crédito aplicado correctamente'); onSaved(); },
  });

  const canSave = montoNum > 0 && montoNum <= credito.monto_disponible &&
    (tipo === 'Campamento' ? !!campamentoId : meses.length > 0);

  const toggleMes = (mes) => setMeses(prev =>
    prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar crédito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Crédito disponible de "{credito.actividad_nombre}"</p>
            <p className="text-2xl font-bold text-primary">{formatMoney(credito.monto_disponible)}</p>
          </div>

          <div>
            <Label>Aplicar a</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cuota">Cuotas mensuales</SelectItem>
                <SelectItem value="Campamento">Campamento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === 'Cuota' && (
            <div>
              <Label className="mb-2 block">Meses a acreditar</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {MESES.map(mes => (
                  <button
                    key={mes}
                    type="button"
                    onClick={() => toggleMes(mes)}
                    className={cn(
                      'text-xs py-1.5 px-2 rounded border transition-all',
                      meses.includes(mes) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {mes.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'Campamento' && (
            <div>
              <Label>Campamento</Label>
              <Select value={campamentoId} onValueChange={setCampamentoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar campamento" /></SelectTrigger>
                <SelectContent>
                  {campamentos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre} · {formatMoney(c.costo_por_persona)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Monto a aplicar</Label>
            <Input
              type="number"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              max={credito.monto_disponible}
            />
            <p className="text-xs text-muted-foreground mt-1">Máximo: {formatMoney(credito.monto_disponible)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending}>
            Aplicar {formatMoney(montoNum)} de crédito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}