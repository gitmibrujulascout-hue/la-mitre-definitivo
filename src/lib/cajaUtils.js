import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Lógica centralizada de cálculo de caja/banco.
 * Una sola fuente de verdad: cada entidad (Pago, Gasto, VentaTienda, PreEncargoTienda)
 * es la única fuente de sus movimientos. MovimientoBanco solo se usa para entradas
 * manuales (sin referencia a otra entidad) y rendiciones de afiliación.
 *
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

// Destino de una venta de tienda: Caja, Banco, o null (Caja exclusiva / Crédito)
export const destinoVenta = (v) => {
  if (v.destino === 'Caja exclusiva') return null; // se trackea en CajaExclusivaPanel
  if (v.forma_pago === 'Crédito actividad') return null; // no mueve dinero nuevo
  if (v.destino === 'Banco') return 'Banco';
  return 'Caja';
};

// Orígenes de MovimientoBanco que se incluyen como movimientos extra.
// Solo manuales sin referencia_id (sin duplicar otra entidad) y rendiciones/afiliación.
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
  const { data: ventasTienda = [] } = useQuery({ queryKey: ['ventas_tienda'], queryFn: () => base44.entities.VentaTienda.list('-fecha', 5000) });
  const { data: preEncargos = [] } = useQuery({ queryKey: ['pre_encargos'], queryFn: () => base44.entities.PreEncargoTienda.list('-fecha', 5000) });
  const { data: productosTienda = [] } = useQuery({ queryKey: ['productos_tienda'], queryFn: () => base44.entities.ProductoTienda.list() });

  const privateCampIds = useMemo(() => new Set(
    campamentos.filter(c => c.es_privado).map(c => c.id)
  ), [campamentos]);

  // IDs de VentaTienda para excluir MovimientoBanco duplicados del sistema anterior
  const ventaTiendaIds = useMemo(() => new Set(ventasTienda.map(v => v.id)), [ventasTienda]);

  // Productos con caja exclusiva (para saber qué señas van a caja exclusiva vs general)
  const productosCajaExclusiva = useMemo(() => new Set(
    productosTienda.filter(p => p.caja_exclusiva).map(p => p.id)
  ), [productosTienda]);

  const filtraAnio = (fecha) => !anio || (fecha || '').startsWith(anio);

  const fondos = useMemo(() => {
    const calcular = (cuenta) => {
      // 1. Ingresos por pagos (cuotas, campamentos)
      const ingresosPagos = pagos
        .filter(p => filtraAnio(p.fecha_pago) && destinoPago(p) === cuenta)
        .filter(p => !(filtrarPrivados && p.tipo_pago === 'Campamento' && privateCampIds.has(p.campamento_id)))
        .reduce((s, p) => s + (p.monto || 0), 0);

      // 2. Egresos por gastos
      const egresosGastos = gastos
        .filter(g => filtraAnio(g.fecha) && destinoGasto(g) === cuenta)
        .filter(g => !(filtrarPrivados && privateCampIds.has(g.campamento_id)))
        .reduce((s, g) => s + (g.monto || 0), 0);

      // 3. Ingresos por ventas de tienda (fuente única: VentaTienda)
      const ingresosVentas = ventasTienda
        .filter(v => filtraAnio(v.fecha) && destinoVenta(v) === cuenta)
        .reduce((s, v) => s + (v.monto_total || 0), 0);

      // 4. Ingresos por señas de pre-encargos no entregados (fuente única: PreEncargoTienda)
      // Solo se cuentan señas de encargos pendientes/confirmados.
      // Cuando se entrega, el ingreso completo se registra vía VentaTienda.
      const esCajaExclusivaSeña = (e) => productosCajaExclusiva.has(e.producto_id);
      const cuentaSeña = (e) => {
        if (esCajaExclusivaSeña(e)) return null;
        if (e.forma_pago === 'Crédito actividad') return null; // el dinero ya entró vía la actividad
        return e.forma_pago === 'Transferencia' ? 'Banco' : 'Caja';
      };
      const ingresosSeñas = preEncargos
        .filter(e => ['Pendiente', 'Confirmado'].includes(e.estado) && (e.monto_pagado || 0) > 0)
        .filter(e => filtraAnio(e.fecha_pago))
        .filter(e => cuentaSeña(e) === cuenta)
        .reduce((s, e) => s + (e.monto_pagado || 0), 0);

      // 5. Movimientos manuales y de afiliación (excluyendo duplicados del sistema anterior)
      const movs = movimientosExtra
        .filter(m => {
          if ((m.cuenta || 'Caja') !== cuenta) return false;
          if (!filtraAnio(m.fecha)) return false;
          if (!EXTRA_ORIGENES.includes(m.origen)) return false;
          // Excluir MovimientoBanco que duplican una VentaTienda (sistema anterior)
          if (m.origen === 'Manual' && m.referencia_id && ventaTiendaIds.has(m.referencia_id)) return false;
          return true;
        });

      const ingresosExtra = movs.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
      const egresosExtra = movs.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + (m.monto || 0), 0);

      const ingresos = ingresosPagos + ingresosVentas + ingresosSeñas + ingresosExtra;
      const egresos = egresosGastos + egresosExtra;
      return { ingresos, egresos, saldo: ingresos - egresos };
    };
    return { caja: calcular('Caja'), banco: calcular('Banco') };
  }, [pagos, gastos, ventasTienda, preEncargos, movimientosExtra, privateCampIds, ventaTiendaIds, productosCajaExclusiva, anio, filtrarPrivados]);

  return { ...fondos, pagos, gastos, ventasTienda, preEncargos, movimientosExtra, privateCampIds, campamentos, ventaTiendaIds, productosCajaExclusiva };
}

/**
 * Versión SIN hook: construye la lista de movimientos detallados para una cuenta.
 * Usado por Caja.jsx y ReporteCajaDialog para la tabla de movimientos.
 */
export function buildMovimientos({ pagos, gastos, ventasTienda, preEncargos, movimientosExtra, privateCampIds, ventaTiendaIds, productosCajaExclusiva, cuenta, anio = null, filtrarPrivados = true }) {
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

  // Ingresos por ventas de tienda (fuente única)
  const ingresoVentas = (ventasTienda || [])
    .filter(v => filtraAnio(v.fecha) && destinoVenta(v) === cuenta)
    .map(v => ({
      id: `venta-${v.id}`, refId: v.id, fecha: v.fecha, tipo: 'Ingreso',
      concepto: `Venta tienda — ${v.producto_nombre}${v.beneficiario_nombre ? ` (${v.beneficiario_nombre})` : ''}`,
      monto: v.monto_total, origen: 'Venta tienda', forma_pago: v.forma_pago,
    }));

  // Ingresos por señas de pre-encargos no entregados
  const cuentaSeña = (e) => {
    if ((productosCajaExclusiva || new Set()).has(e.producto_id)) return null;
    if (e.forma_pago === 'Crédito actividad') return null;
    return e.forma_pago === 'Transferencia' ? 'Banco' : 'Caja';
  };
  const ingresoSeñas = (preEncargos || [])
    .filter(e => ['Pendiente', 'Confirmado'].includes(e.estado) && (e.monto_pagado || 0) > 0)
    .filter(e => filtraAnio(e.fecha_pago))
    .filter(e => cuentaSeña(e) === cuenta)
    .map(e => ({
      id: `seña-${e.id}`, refId: e.id, fecha: e.fecha_pago, tipo: 'Ingreso',
      concepto: `Seña tienda — ${e.producto_nombre} (${e.beneficiario_nombre})`,
      monto: e.monto_pagado, origen: 'Seña tienda', forma_pago: e.forma_pago,
    }));

  // Movimientos manuales (excluyendo duplicados del sistema anterior)
  const extras = movimientosExtra
    .filter(m => {
      if ((m.cuenta || 'Caja') !== cuenta) return false;
      if (!filtraAnio(m.fecha)) return false;
      if (!EXTRA_ORIGENES.includes(m.origen)) return false;
      if (m.origen === 'Manual' && m.referencia_id && (ventaTiendaIds || new Set()).has(m.referencia_id)) return false;
      return true;
    })
    .map(m => ({ ...m, id: `extra-${m.id}`, refId: m.id, esManual: m.origen === 'Manual' }));

  return [...ingresoPagos, ...ingresoVentas, ...ingresoSeñas, ...egresoGastos, ...extras].sort((a, b) => {
    const diff = (a.fecha || '').localeCompare(b.fecha || '');
    if (diff !== 0) return diff;
    if (a.tipo === 'Ingreso' && b.tipo !== 'Ingreso') return -1;
    if (a.tipo !== 'Ingreso' && b.tipo === 'Ingreso') return 1;
    return 0;
  });
}