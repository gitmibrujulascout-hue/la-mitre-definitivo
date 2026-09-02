import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Scale, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

// Costo esperado de una persona (individual o default según tipo)
export const costoEsperado = (campamento, ben) => {
  if (!ben) return 0;
  const costoInd = campamento.costos_individuales?.[ben.id];
  if (costoInd != null) return costoInd;
  const esAdulto = ben.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(ben.rama);
  if (esAdulto && campamento.adultos_pagan) {
    return campamento.costo_adultos || campamento.costo_por_persona || 0;
  }
  if (esAdulto && !campamento.adultos_pagan) return 0;
  return campamento.costo_por_persona || 0;
};

export default function BalanceCampamento({ campamento, beneficiarios = [], pagos = [], gastos = [] }) {
  const getBen = (id) => beneficiarios.find(b => b.id === id);

  // Pagos de este campamento agrupados por beneficiario
  const pagosMap = useMemo(() => {
    const map = {};
    pagos
      .filter(p => p.tipo_pago === 'Campamento' && p.campamento_id === campamento.id)
      .forEach(p => {
        map[p.beneficiario_id] = (map[p.beneficiario_id] || 0) + (p.monto || 0);
      });
    return map;
  }, [pagos, campamento.id]);

  const pagosCamp = pagos.filter(p => p.tipo_pago === 'Campamento' && p.campamento_id === campamento.id);
  const totalIngresos = pagosCamp.reduce((s, p) => s + (p.monto || 0), 0);

  const gastosCamp = gastos.filter(g => g.campamento_id === campamento.id);
  const totalEgresos = gastosCamp.reduce((s, g) => s + (g.monto || 0), 0);
  const saldo = totalIngresos - totalEgresos;
  const positivo = saldo >= 0;

  // Lista de personas con costo esperado, pagado y pendiente
  const personas = useMemo(() => {
    const todosIds = [...(campamento.beneficiarios_ids || []), ...(campamento.adultos_ids || [])];
    return todosIds
      .map(id => {
        const ben = getBen(id);
        if (!ben) return null;
        const esperado = costoEsperado(campamento, ben);
        const pagado = pagosMap[id] || 0;
        return { id, nombre: ben.nombre, rama: ben.rama, esAdulto: ben.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(ben.rama), esperado, pagado, pendiente: esperado - pagado };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.esAdulto !== b.esAdulto) return a.esAdulto ? 1 : -1;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }, [campamento, beneficiarios, pagosMap]);

  const totalEsperado = personas.reduce((s, p) => s + p.esperado, 0);
  const totalPendiente = totalEsperado - totalIngresos;
  const noAbonan = personas.filter(p => p.esperado === 0 && p.esAdulto).length;

  return (
    <Card className={campamento.es_privado ? 'border-purple-200' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="w-4 h-4" />Balance del campamento
          {campamento.es_privado && (
            <Badge className="bg-purple-100 text-purple-700 border-purple-300 border text-xs ml-auto">🔒 Privado</Badge>
          )}
        </CardTitle>
        {campamento.es_privado && (
          <p className="text-xs text-purple-600 mt-1">Los movimientos de este campamento son independientes de la caja general del grupo.</p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Esperado vs Recaudado vs Pendiente */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-center">
            <p className="text-xs text-blue-600">Esperado</p>
            <p className="text-sm font-bold text-blue-700">{formatMoney(totalEsperado)}</p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-center">
            <p className="text-xs text-green-600">Recaudado</p>
            <p className="text-sm font-bold text-green-700">{formatMoney(totalIngresos)}</p>
          </div>
          <div className={cn('p-2 rounded-lg border text-center', totalPendiente > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100')}>
            <p className={cn('text-xs', totalPendiente > 0 ? 'text-red-600' : 'text-green-600')}>Pendiente</p>
            <p className={cn('text-sm font-bold', totalPendiente > 0 ? 'text-red-700' : 'text-green-700')}>{formatMoney(totalPendiente)}</p>
          </div>
        </div>

        {/* Egresos */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Gastos del campamento</p>
              <p className="text-xs text-red-600">{gastosCamp.length} gasto{gastosCamp.length !== 1 ? 's' : ''}</p>
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

        {/* Detalle por persona */}
        {personas.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">
              Deuda por persona ({personas.filter(p => p.pendiente > 0).length} con deuda)
            </p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto border rounded-lg">
              {personas.map(p => (
                <div key={p.id} className={cn(
                  'flex items-center gap-2 px-2 py-1 text-xs border-b last:border-0',
                  p.pendiente > 0 ? 'bg-red-50/50' : p.pagado > 0 ? 'bg-green-50/50' : ''
                )}>
                  <span className="flex-1 truncate font-medium">{p.nombre}</span>
                  {p.esAdulto && p.esperado === 0 && <Badge variant="secondary" className="text-[10px] py-0">No abona</Badge>}
                  {p.esperado > 0 && (
                    <>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {formatMoney(p.pagado)}/{formatMoney(p.esperado)}
                      </span>
                      {p.pendiente > 0 ? (
                        <Badge className="bg-red-100 text-red-700 text-[10px] py-0">Debe {formatMoney(p.pendiente)}</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 text-[10px] py-0">✓</Badge>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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