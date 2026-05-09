/**
 * Constantes y funciones centralizadas para registros financieros.
 * Todo pago o cobro debe pasar por estas funciones para garantizar
 * que se registren en todos los lugares necesarios automáticamente.
 */

import { base44 } from '@/api/base44Client';

// ──────────────────────────────────────────────
// Constantes centralizadas
// ──────────────────────────────────────────────
export const MONTO_SEGURO_AFILIACION = 42000;

// ──────────────────────────────────────────────
// Registro encadenado de PAGOS (cuota / campamento)
// Crea el Pago y el MovimientoBanco en paralelo.
// ──────────────────────────────────────────────
export async function registrarPagos(pagos) {
  // Solo crea los pagos — la Caja los lee directamente de la entidad Pago
  const pagoCreados = await Promise.all(pagos.map(p => base44.entities.Pago.create(p)));
  return pagoCreados;
}

// ──────────────────────────────────────────────
// Registro encadenado de GASTOS
// Crea el Gasto y el MovimientoBanco en paralelo.
// ──────────────────────────────────────────────
export async function registrarGasto(data) {
  // Solo crea el gasto — la Caja lo lee directamente de la entidad Gasto
  return base44.entities.Gasto.create(data);
}

// ──────────────────────────────────────────────
// Actualización encadenada de GASTOS
// Actualiza el Gasto (no toca el MovimientoBanco ya creado).
// ──────────────────────────────────────────────
export async function actualizarGasto(id, data) {
  return base44.entities.Gasto.update(id, data);
}