/**
 * Constantes y funciones centralizadas para registros financieros.
 * Todo pago o cobro debe pasar por estas funciones para garantizar
 * que se registren en todos los lugares necesarios automáticamente.
 */

import { base44 } from '@/api/base44Client';
import { splitFeePayment } from '@/services/access/feePayments';

// ──────────────────────────────────────────────
// Constantes centralizadas
// ──────────────────────────────────────────────
export const MONTO_SEGURO_AFILIACION = 42000;

// ──────────────────────────────────────────────
// Registro de PAGOS (cuota / campamento)
// La entidad Pago es la fuente única — cajaUtils deriva el movimiento de caja.
// ──────────────────────────────────────────────
export async function registrarPagos(pagos,context) {
  const rows=context?pagos.flatMap(p=>splitFeePayment(p,context.people,context.config,context.affiliations)):pagos;
  return base44.entities.Pago.bulkCreate(rows);
}

// ──────────────────────────────────────────────
// Registro de GASTOS
// La entidad Gasto es la fuente única — cajaUtils deriva el movimiento de caja.
// ──────────────────────────────────────────────
export async function registrarGasto(data) {
  return base44.entities.Gasto.create(data);
}

// ──────────────────────────────────────────────
// Actualización de GASTOS
// ──────────────────────────────────────────────
export async function actualizarGasto(id, data) {
  return base44.entities.Gasto.update(id, data);
}
