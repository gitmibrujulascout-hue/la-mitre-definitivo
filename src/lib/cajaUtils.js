import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Lógica centralizada de cálculo de caja/banco.
 * Usada por Dashboard, Caja y ReporteCajaDialog para que los números siempre coincidan.
 */

// Destino efectivo de un pago (a qué fondo va el dinero, o null si no mueve dinero real)
export const destinoPago = (p) => {
  if (p.forma_pago === 'Subsidio del grupo' || p.destino === 'Grupo') return null;
  // Crédito actividad: el dinero ya entró a caja cuando se rindió la actividad
  if (p.forma_pago === 'Crédito actividad') return null;
  // Afiliación: el dinero se trackea vía rendición (MovimientoBanco origen Afiliación)
  if (p.tipo_pago === 'Afiliación') return null;
  if (p.destino === 'Banco') return 'Banco';
  if (p.destino === 'Caja') return 'Caja';
  if (p.forma_pago === 'Transferencia') return 'Banco';
  return 'Caja';
};

export const destinoGasto = (g) => {
  if (g.destino === 'Banco') return 'Banco';
  if (g.destino === 'Caja') return 'Caja';
  if (g.forma_pago === 'Transferencia') return 'Banco';
  return 'Caja';
};

// Orígenes de MovimientoBanco que se incluyen como movimientos extra (no duplican Pagos/Gastos)
const EXTRA_ORIGENES = ['Manual', 'Crédito', 'Afiliación'];

/**
 * Hook que centraliza la carga de datos y el cálculo de fondos.
 * Devuelve { caja, banco } con { ingresos, egresos, saldo } para cada cuenta.
 * @param {object} opts - { anio: string|null, filtrarPrivados: bool }
 */
export function useFondos({ anio = null, filtrarPrivados = true } = {}) {
  const { data: pagos = [] } = useQuery({ queryKey: ['pagos'], queryFn: () => base44.entities.Pago.list('-fecha_pago', 5000) });
  const { data: gastos = [] } = useQuery({ queryKey: ['gastos'], queryFn: () => base44.entities.Gasto.list('-fecha', 5000) });
  const { data: movimientosExtra = [] } = useQuery({ queryKey: ['movimientos_banco'], queryFn: () => base44.entities.MovimientoBanco.list('-fecha', 2000) });
  const { data: campamentos = [] } = useQuery({ queryKey: ['campamentos'], queryFn: () => base44.entities.Campamento.list() });

  const privateCampIds = useMemo(() => new Set(
    campamentos.filter(c => c.es_privado).map(c => c.id)
  ), [campamentos]);

  const filtraAnio = (fecha) => !anio || (fecha || '').startsWith(anio);

  const fondos = useMemo(() => {
    const calcular = (cuenta) => {
      const ingresosPagos = pagos
        .filter(p => filtraAnio(p.fecha_pago) && destinoPago(p) === cuenta)
        .filter(p => !(filtrarPrivados && p.tipo_pago === 'Campamento' && privateCampIds.has(p.campamento_id)))
        .reduce((s, p) => s + (p.monto || 0), 0);

      const egresosGastos = gastos
        .filter(g => filtraAnio(g.fecha) && destinoGasto(g) === cuenta)
        .filter(g => !(filtrarPrivados && privateCampIds.has(g.campamento_id)))
        .reduce((s, g) => s + (g.monto || 0), 0);

      const movs = movimientosExtra
        .filter(m => (m.cuenta || 'Caja') === cuenta && filtraAnio(m.fecha) && EXTRA_ORIGENES.includes(m.origen));

      const ingresosExtra = movs.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
      const egresosExtra = movs.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + (m.monto || 0), 0);

      const ingresos = ingresosPagos + ingresosExtra;
      const egresos = egresosGastos + egresosExtra;
      return { ingresos, egresos, saldo: ingresos - egresos };
    };
    return { caja: calcular('Caja'), banco: calcular('Banco') };
  }, [pagos, gastos, movimientosExtra, privateCampIds, anio, filtrarPrivados]);

  return { ...fondos, pagos, gastos, movimientosExtra, privateCampIds };
}

/**
 * Versión SIN hook: construye la lista de movimientos detalldos para una cuenta.
 * Usado por Caja.jsx y ReporteCajaDialog para la tabla de movimientos.
 */
export function buildMovimientos({ pagos, gastos, movimientosExtra, privateCampIds, cuenta, anio = null, filtrarPrivados = true }) {
  const filtraAnio = (fecha) => !anio || (fecha || '').startsWith(anio);

  const ingresoPagos = pagos
    .filter(p => filtraAnio(p.fecha_pago) && destinoPago(p) === cuenta)
    .filter(p => !(filtrarPrivados && p.tipo_pago === 'Campamento' && privateCampIds.has(p.campamento_id)))
    .map(p => ({
      id: `pago-${p.id}`, refId: p.id, fecha: p.fecha_pago, tipo: 'Ingreso',
      concepto: p.tipo_pago === 'Campamento'
        ? `Campamento: ${p.campamento_nombre || ''} — ${p.beneficiario_nombre}`
        : p.tipo_pago === 'Afiliación'
          ? `Afiliación/Seguro — ${p.beneficiario_nombre}`
          : `Cuota ${(p.meses || [p.mes]).filter(Boolean).join(', ')} — ${p.beneficiario_nombre}`,
      monto: p.monto, origen: 'Pago cuota', forma_pago: p.forma_pago,
    }));

  const egresoGastos = gastos
    .filter(g => filtraAnio(g.fecha) && destinoGasto(g) === cuenta)
    .filter(g => !(filtrarPrivados && privateCampIds.has(g.campamento_id)))
    .map(g => ({
      id: `gasto-${g.id}`, refId: g.id, fecha: g.fecha, tipo: 'Egreso',
      concepto: `${g.descripcion}${g.proveedor ? ` (${g.proveedor})` : ''}`,
      monto: g.monto, origen: 'Gasto', categoria: g.categoria, forma_pago: g.forma_pago,
    }));

  const extras = movimientosExtra
    .filter(m => (m.cuenta || 'Caja') === cuenta && filtraAnio(m.fecha) && EXTRA_ORIGENES.includes(m.origen))
    .map(m => ({ ...m, id: `extra-${m.id}`, refId: m.id, esManual: m.origen === 'Manual' }));

  return [...ingresoPagos, ...egresoGastos, ...extras].sort((a, b) => {
    const diff = (a.fecha || '').localeCompare(b.fecha || '');
    if (diff !== 0) return diff;
    if (a.tipo === 'Ingreso' && b.tipo !== 'Ingreso') return -1;
    if (a.tipo !== 'Ingreso' && b.tipo === 'Ingreso') return 1;
    return 0;
  });
}