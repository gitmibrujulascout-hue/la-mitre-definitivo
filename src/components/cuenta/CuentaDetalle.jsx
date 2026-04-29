import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, XCircle, Award, Tent } from 'lucide-react';
import RamaBadge from '@/components/shared/RamaBadge';
import { MESES, MESES_SIN_CUOTA, MESES_BONIFICADOS, CUOTA_EFECTIVO, formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function CuentaDetalle({ beneficiario, pagos, campamentos, anio, onBack }) {
  if (!beneficiario) return null;

  const pagosAnio = pagos.filter(p => p.anio === anio);
  const mesesPagados = pagosAnio.map(p => p.mes);

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

      {/* Grilla de meses */}
      <h3 className="font-semibold mb-3">Cuotas {anio}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
        {MESES.map(mes => {
          const pago = pagosAnio.find(p => p.mes === mes);
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
                <p className="font-medium">{p.mes} {p.anio}</p>
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