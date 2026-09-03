import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, CreditCard, Receipt, TrendingUp, TrendingDown, Wallet, Landmark } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import CalendarioDashboard from '@/components/dashboard/CalendarioDashboard';
import { RAMA_CONFIG, RAMAS, formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import { useFondos } from '@/lib/cajaUtils';

export default function Dashboard() {
  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list()
  });

  const { data: actividades = [] } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => base44.entities.ActividadEconomica.list('-fecha', 100),
  });

  // Fondos calculados con lógica centralizada (compartida con Caja y Reporte)
  const { caja, banco, pagos, gastos, campamentos, isLoading: isLoadingFondos } = useFondos();
  const fondos = { caja, banco };

  const navigate = useNavigate();

  const activos = beneficiarios.filter((b) => b.activo !== false);
  const becados = activos.filter((b) => b.becado);

  const ramaCount = RAMAS.reduce((acc, r) => {
    acc[r] = activos.filter((b) => b.rama === r).length;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen general de tesorería" />

      {/* 1. Stats principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Beneficiarios activos" value={activos.length} subtitle={`${becados.length} becados`} icon={Users} />
        <StatsCard title="Balance total" value={isLoadingFondos ? '—' : formatMoney(fondos.caja.saldo + fondos.banco.saldo)} subtitle={isLoadingFondos ? 'Cargando...' : 'Caja + Banco'} icon={CreditCard} />
        <StatsCard title="Saldo Caja" value={isLoadingFondos ? '—' : formatMoney(fondos.caja.saldo)} subtitle={isLoadingFondos ? 'Cargando...' : `+${formatMoney(fondos.caja.ingresos)} / −${formatMoney(fondos.caja.egresos)}`} icon={Wallet} />
        <StatsCard title="Saldo Banco" value={isLoadingFondos ? '—' : formatMoney(fondos.banco.saldo)} subtitle={isLoadingFondos ? 'Cargando...' : `+${formatMoney(fondos.banco.ingresos)} / −${formatMoney(fondos.banco.egresos)}`} icon={Landmark} />
      </div>

      {/* 2. Beneficiarios por rama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {RAMAS.map((rama) => {
          const config = RAMA_CONFIG[rama];
          return (
            <Card
              key={rama}
              onClick={() => navigate(`/beneficiarios?rama=${encodeURIComponent(rama)}`)}
              className={cn('text-card-foreground p-4 rounded-xl border-2 shadow relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow', config.border)}
              style={{ backgroundColor: 'transparent' }}>
              <div className={cn('absolute inset-0 opacity-[0.08]', config.color)} />
              <div className="relative pl-3">
                <p className="text-xs font-medium text-muted-foreground">{rama}</p>
                <p className="text-2xl font-bold">{ramaCount[rama] || 0}</p>
                <p className="text-xs text-muted-foreground">{config.edad}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 3. Calendario */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <CalendarioDashboard actividades={actividades} campamentos={campamentos} beneficiarios={beneficiarios} />
      </div>

      {/* 4. Resumen de caja y banco */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[{ label: 'Caja (Efectivo)', data: fondos.caja, icon: Wallet }, { label: 'Banco (Transferencia)', data: fondos.banco, icon: Landmark }].map(({ label, data, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{label}</span>
              {isLoadingFondos && <span className="text-xs text-muted-foreground animate-pulse">cargando...</span>}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="font-bold text-green-700 text-sm">{isLoadingFondos ? '—' : formatMoney(data.ingresos)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Egresos</p>
                <p className="font-bold text-red-600 text-sm">{isLoadingFondos ? '—' : formatMoney(data.egresos)}</p>
              </div>
              <div className={cn('rounded-lg p-2', data.saldo >= 0 ? 'bg-blue-50' : 'bg-red-50')}>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={cn('font-bold text-sm', data.saldo >= 0 ? 'text-blue-700' : 'text-red-600')}>{isLoadingFondos ? '—' : formatMoney(data.saldo)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 5. Últimos movimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Últimos pagos
          </h3>
          {pagos.length === 0 ?
          <p className="text-sm text-muted-foreground">No hay pagos registrados aún</p> :

          <div className="space-y-3">
              {pagos.slice(0, 5).map((p) =>
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{p.beneficiario_nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.mes} {p.anio} · {p.forma_pago}</p>
                  </div>
                  <p className="text-sm font-semibold text-green-600">{formatMoney(p.monto)}</p>
                </div>
            )}
            </div>
          }
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Últimos gastos
          </h3>
          {gastos.length === 0 ?
          <p className="text-sm text-muted-foreground">No hay gastos registrados aún</p> :

          <div className="space-y-3">
              {gastos.slice(0, 5).map((g) =>
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{g.descripcion}</p>
                    <p className="text-xs text-muted-foreground">{g.categoria} · {g.fecha}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-500">{formatMoney(g.monto)}</p>
                </div>
            )}
            </div>
          }
        </Card>
      </div>
    </div>
  );
}