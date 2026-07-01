import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, CreditCard, Receipt, TrendingUp, TrendingDown, Wallet, Landmark, CalendarDays, Cake } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import { RAMA_CONFIG, RAMAS, formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function Dashboard() {
  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list()
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-fecha_pago', 5000)
  });

  const { data: gastos = [] } = useQuery({
    queryKey: ['gastos'],
    queryFn: () => base44.entities.Gasto.list('-fecha', 5000)
  });

  const { data: movimientosExtra = [] } = useQuery({
    queryKey: ['movimientos_banco'],
    queryFn: () => base44.entities.MovimientoBanco.list('-fecha', 2000),
  });

  const { data: actividades = [] } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => base44.entities.ActividadEconomica.list('-fecha', 100),
  });

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list(),
  });

  const privateCampIds = useMemo(() => new Set(
    campamentos.filter(c => c.es_privado).map(c => c.id)
  ), [campamentos]);

  const navigate = useNavigate();

  const activos = beneficiarios.filter((b) => b.activo !== false);
  const becados = activos.filter((b) => b.becado);

  const ramaCount = RAMAS.reduce((acc, r) => {
    acc[r] = activos.filter((b) => b.rama === r).length;
    return acc;
  }, {});

  // Helper: destino de un pago/gasto
  const destinoPago = (p) => {
    if (p.destino === 'Banco') return 'Banco';
    if (p.destino === 'Caja') return 'Caja';
    if (p.forma_pago === 'Transferencia') return 'Banco';
    return 'Caja';
  };
  const destinoGasto = (g) => {
    if (g.destino === 'Banco') return 'Banco';
    if (g.destino === 'Caja') return 'Caja';
    if (g.forma_pago === 'Transferencia') return 'Banco';
    return 'Caja';
  };

  const fondos = useMemo(() => {
    const calcular = (cuenta) => {
      const ingresosPagos = pagos
        .filter(p => destinoPago(p) === cuenta)
        .filter(p => !(p.tipo_pago === 'Campamento' && privateCampIds.has(p.campamento_id)))
        .reduce((s, p) => s + (p.monto || 0), 0);
      const egresosGastos = gastos
        .filter(g => destinoGasto(g) === cuenta)
        .filter(g => !privateCampIds.has(g.campamento_id))
        .reduce((s, g) => s + (g.monto || 0), 0);
      // Solo movimientos manuales (igual que Caja)
      const movs = movimientosExtra.filter(m => (m.cuenta || 'Caja') === cuenta && m.origen === 'Manual');
      const ingresosExtra = movs.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
      const egresosExtra = movs.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + (m.monto || 0), 0);
      const ingresos = ingresosPagos + ingresosExtra;
      const egresos = egresosGastos + egresosExtra;
      return { ingresos, egresos, saldo: ingresos - egresos };
    };
    return { caja: calcular('Caja'), banco: calcular('Banco') };
  }, [pagos, gastos, movimientosExtra, privateCampIds]);

  // --- Calendario ---
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();
  const diaHoy = hoy.getDate();

  const cumpleanerosMes = useMemo(() => {
    return activos
      .filter(b => {
        if (!b.fecha_nacimiento) return false;
        const mes = new Date(b.fecha_nacimiento + 'T12:00:00').getMonth();
        return mes === mesActual;
      })
      .map(b => {
        const fechaNac = new Date(b.fecha_nacimiento + 'T12:00:00');
        return { id: b.id, nombre: b.nombre, rama: b.rama, dia: fechaNac.getDate() };
      })
      .sort((a, b) => a.dia - b.dia);
  }, [activos, mesActual]);

  // Eventos del mes (actividades, campamentos)
  const eventosMes = useMemo(() => {
    const eventos = [];
    // Actividades económicas
    actividades.forEach(a => {
      if (a.fecha) {
        const f = new Date(a.fecha + 'T12:00:00');
        if (f.getMonth() === mesActual && f.getFullYear() === anioActual) {
          eventos.push({ tipo: 'actividad', dia: f.getDate(), titulo: a.nombre, color: 'bg-green-500' });
        }
      }
    });
    // Campamentos
    campamentos.forEach(c => {
      if (c.fecha_inicio) {
        const f = new Date(c.fecha_inicio + 'T12:00:00');
        if (f.getMonth() === mesActual && f.getFullYear() === anioActual) {
          eventos.push({ tipo: 'campamento', dia: f.getDate(), titulo: c.nombre, color: 'bg-blue-500' });
        }
      }
    });
    return eventos;
  }, [actividades, campamentos, mesActual, anioActual]);

  // Generar matriz del calendario
  const primerDiaMes = new Date(anioActual, mesActual, 1).getDay(); // 0=Dom
  const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
  const celdasCalendario = useMemo(() => {
    const celdas = [];
    // Días vacíos al inicio
    for (let i = 0; i < primerDiaMes; i++) celdas.push(null);
    // Días del mes
    for (let d = 1; d <= diasEnMes; d++) {
      const cumples = cumpleanerosMes.filter(c => c.dia === d);
      const eventos = eventosMes.filter(e => e.dia === d);
      celdas.push({ dia: d, cumples, eventos });
    }
    return celdas;
  }, [primerDiaMes, diasEnMes, cumpleanerosMes, eventosMes]);

  const getRamaColor = (rama) => {
    const config = RAMA_CONFIG[rama];
    return config?.text || 'text-foreground';
  };

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen general de tesorería" />

      {/* 1. Stats principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Beneficiarios activos" value={activos.length} subtitle={`${becados.length} becados`} icon={Users} />
        <StatsCard title="Balance total" value={formatMoney(fondos.caja.saldo + fondos.banco.saldo)} subtitle="Caja + Banco" icon={CreditCard} />
        <StatsCard title="Saldo Caja" value={formatMoney(fondos.caja.saldo)} subtitle={`+${formatMoney(fondos.caja.ingresos)} / −${formatMoney(fondos.caja.egresos)}`} icon={Wallet} />
        <StatsCard title="Saldo Banco" value={formatMoney(fondos.banco.saldo)} subtitle={`+${formatMoney(fondos.banco.ingresos)} / −${formatMoney(fondos.banco.egresos)}`} icon={Landmark} />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            {MESES_CORTOS[mesActual]} {anioActual}
          </h3>
          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Días */}
          <div className="grid grid-cols-7 gap-1">
            {celdasCalendario.map((celda, i) => {
              if (!celda) return <div key={i} className="min-h-[60px] rounded-lg bg-muted/20" />;
              const esHoy = celda.dia === diaHoy;
              const tieneEventos = celda.cumples.length > 0 || celda.eventos.length > 0;
              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[60px] rounded-lg border p-1 text-xs transition-colors',
                    esHoy ? 'border-primary bg-primary/5' : 'border-border bg-card',
                    tieneEventos ? 'shadow-sm' : ''
                  )}
                >
                  <div className={cn('font-medium text-right', esHoy ? 'text-primary' : 'text-muted-foreground')}>{celda.dia}</div>
                  {/* Eventos */}
                  {celda.eventos.map((e, idx) => (
                    <div key={idx} className={cn('text-[9px] text-white rounded px-1 truncate mb-0.5', e.color)}>
                      {e.titulo}
                    </div>
                  ))}
                  {/* Cumpleaños */}
                  {celda.cumples.map(c => (
                    <div key={c.id} className={cn('text-[9px] font-medium truncate', getRamaColor(c.rama))}>
                      🎂 {c.nombre.split(' ')[0]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Cumpleaños del mes */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Cake className="w-4 h-4 text-primary" />
            Cumpleaños de {MESES_CORTOS[mesActual]}
          </h3>
          {cumpleanerosMes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cumpleaños este mes</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {cumpleanerosMes.map(c => (
                <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {c.dia}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', getRamaColor(c.rama))}>{c.nombre}</p>
                    {c.rama && <p className="text-xs text-muted-foreground">{c.rama}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 4. Resumen de caja y banco */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[{ label: 'Caja (Efectivo)', data: fondos.caja, icon: Wallet }, { label: 'Banco (Transferencia)', data: fondos.banco, icon: Landmark }].map(({ label, data, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{label}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="font-bold text-green-700 text-sm">{formatMoney(data.ingresos)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Egresos</p>
                <p className="font-bold text-red-600 text-sm">{formatMoney(data.egresos)}</p>
              </div>
              <div className={cn('rounded-lg p-2', data.saldo >= 0 ? 'bg-blue-50' : 'bg-red-50')}>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={cn('font-bold text-sm', data.saldo >= 0 ? 'text-blue-700' : 'text-red-600')}>{formatMoney(data.saldo)}</p>
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