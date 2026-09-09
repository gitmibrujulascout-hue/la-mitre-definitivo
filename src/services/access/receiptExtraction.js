import { z } from 'zod';
import { importDate } from './memberNormalization.js';
export const receiptSchema = { type: 'object', properties: {
  descripcion: { type: ['string', 'null'], description: 'Producto o servicio visible. null si ilegible.' },
  monto_total: { type: ['number', 'null'], description: 'Total final a pagar, no subtotal, IVA, vuelto ni número de factura. Ejemplo argentino 1.234,56 equivale a 1234.56. null si no se puede leer.' },
  fecha: { type: ['string', 'null'], description: 'Fecha de emisión YYYY-MM-DD. Nunca fecha actual, vencimiento ni fecha inferida. null si ilegible.' },
  proveedor: { type: ['string', 'null'] }, numero_factura: { type: ['string', 'null'] },
  categoria: { type: ['string', 'null'], enum: ['Materiales', 'Alimentos', 'Transporte', 'Servicios', 'Mantenimiento', 'Campamento', 'Otro', null] }
} };
const draftSchema = z.object({
  descripcion: z.string().max(2000).nullable(), monto_total: z.number().finite().positive().nullable(),
  fecha: z.string().nullable(), proveedor: z.string().max(500).nullable(),
  numero_factura: z.string().max(200).nullable(), categoria: z.string().nullable()
});
export function receiptDraft(input) {
  const data = draftSchema.parse(input);
  return { ...data, fecha: data.fecha ? importDate(data.fecha) : '' };
}
export function validReceipt(input) {
  try { return Boolean(input.descripcion?.trim() && Number(input.monto) > 0 && Number.isFinite(Number(input.monto)) && importDate(input.fecha)); }
  catch { return false; }
}
