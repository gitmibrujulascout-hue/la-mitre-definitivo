import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, CreditCard, Receipt, Tent, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import RamaBadge from '@/components/shared/RamaBadge';
import { RAMA_CONFIG, RAMAS, formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list(),
  });

  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos'],
    queryFn: () => base44.entities.Gasto.list(),
  });

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list(),
  });

  const totalIngresos = pagos.reduce((sum, p) => sum + (p.monto || 0), 0);
  const totalGastos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
  const activos = beneficiarios.filter(b => b.activo !== false);
  const becados = activos.filter(b => b.becado);

  const ramaCount = RAMAS.reduce((acc, r) => {
    acc[r] = activos.filter(b => b.rama === r).length;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen general de tesorería" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Beneficiarios" value={activos.length} subtitle={`${becados.length} becados`} icon={Users} />
        <StatsCard title="Ingresos" value={formatMoney(totalIngresos)} subtitle={`${pagos.length} pagos`} icon={TrendingUp} />
        <StatsCard title="Gastos" value={formatMoney(totalGastos)} subtitle={`${gastos.length} registros`} icon={TrendingDown} />
        <StatsCard title="Balance" value={formatMoney(totalIngresos - totalGastos)} subtitle="Ingresos - Gastos" icon={CreditCard} />
      </div>

      {/* Ramas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {RAMAS.map(rama => {
          const config = RAMA_CONFIG[rama];
          return (
            <Card key={rama} className="p-4 relative overflow-hidden">
              <div className={cn('absolute top-0 left-0 w-1 h-full', config.color)} />
              <div className="pl-3">
                <p className="text-xs font-medium text-muted-foreground">{rama}</p>
                <p className="text-2xl font-bold">{ramaCount[rama] || 0}</p>
                <p className="text-xs text-muted-foreground">{config.edad}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Últimos pagos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Últimos pagos
          </h3>
          {pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pagos registrados aún</p>
          ) : (
            <div className="space-y-3">
              {pagos.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{p.beneficiario_nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.mes} {p.anio} · {p.forma_pago}</p>
                  </div>
                  <p className="text-sm font-semibold text-green-600">{formatMoney(p.monto)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Últimos gastos
          </h3>
          {gastos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay gastos registrados aún</p>
          ) : (
            <div className="space-y-3">
              {gastos.slice(0, 5).map(g => (
                <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{g.descripcion}</p>
                    <p className="text-xs text-muted-foreground">{g.categoria} · {g.fecha}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-500">{formatMoney(g.monto)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}