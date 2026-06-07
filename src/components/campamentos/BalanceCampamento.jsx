import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function BalanceCampamento({ campamento, pagos = [], gastos = [] }) {
  // Ingresos: pagos de tipo Campamento para este campamento
  const pagosCamp = pagos.filter(p => p.tipo_pago === 'Campamento' && p.campamento_id === campamento.id);
  const totalIngresos = pagosCamp.reduce((s, p) => s + (p.monto || 0), 0);

  // Egresos: gastos con campamento_id igual a este campamento
  const gastosCamp = gastos.filter(g => g.campamento_id === campamento.id);
  const totalEgresos = gastosCamp.reduce((s, g) => s + (g.monto || 0), 0);

  const saldo = totalIngresos - totalEgresos;
  const positivo = saldo >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="w-4 h-4" />Balance del campamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Ingresos */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Ingresos (pagos recibidos)</p>
              <p className="text-xs text-green-600">{pagosCamp.length} pago{pagosCamp.length !== 1 ? 's' : ''} registrado{pagosCamp.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <p className="text-lg font-bold text-green-700">{formatMoney(totalIngresos)}</p>
        </div>

        {/* Egresos */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Egresos (gastos del campamento)</p>
              <p className="text-xs text-red-600">{gastosCamp.length} gasto{gastosCamp.length !== 1 ? 's' : ''} registrado{gastosCamp.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <p className="text-lg font-bold text-red-700">{formatMoney(totalEgresos)}</p>
        </div>

        {/* Saldo */}
        <div className={cn(
          'flex items-center justify-between p-3 rounded-lg border-2',
          positivo ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
        )}>
          <div>
            <p className={cn('text-sm font-bold', positivo ? 'text-green-800' : 'text-red-800')}>
              {positivo ? '✓ Superávit' : '⚠ Déficit — el grupo cubrió la diferencia'}
            </p>
            <p className={cn('text-xs', positivo ? 'text-green-600' : 'text-red-600')}>
              Ingresos − Egresos
            </p>
          </div>
          <p className={cn('text-2xl font-bold', positivo ? 'text-green-700' : 'text-red-700')}>
            {positivo ? '+' : ''}{formatMoney(saldo)}
          </p>
        </div>

        {/* Detalle de gastos si hay */}
        {gastosCamp.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">Detalle de gastos</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {gastosCamp.map(g => (
                <div key={g.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                  <span className="text-foreground">{g.descripcion}</span>
                  <span className="font-medium text-red-700 ml-4 shrink-0">{formatMoney(g.monto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}