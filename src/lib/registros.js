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
  // Crear todos los pagos en paralelo
  const pagoCreados = await Promise.all(pagos.map(p => base44.entities.Pago.create(p)));

  // Crear los movimientos de banco correspondientes en paralelo
  await Promise.all(pagoCreados.map((pago, i) => {
    const origen = pagos[i].tipo_pago === 'Campamento' ? 'Pago campamento' : 'Pago cuota';
    return base44.entities.MovimientoBanco.create({
      fecha: pagos[i].fecha_pago || new Date().toISOString().split('T')[0],
      tipo: 'Ingreso',
      concepto: origen === 'Pago campamento'
        ? `Pago campamento: ${pagos[i].campamento_nombre || ''} — ${pagos[i].beneficiario_nombre || ''}`
        : `Cuota ${(pagos[i].meses || []).join(', ')} ${pagos[i].anio} — ${pagos[i].beneficiario_nombre || ''}`,
      monto: pagos[i].monto,
      cuenta: pagos[i].destino || (pagos[i].forma_pago === 'Transferencia' ? 'Banco' : 'Caja'),
      origen,
      referencia_id: pago.id,
      observaciones: pagos[i].observaciones || '',
    });
  }));

  return pagoCreados;
}

// ──────────────────────────────────────────────
// Registro encadenado de GASTOS
// Crea el Gasto y el MovimientoBanco en paralelo.
// ──────────────────────────────────────────────
export async function registrarGasto(data) {
  const gasto = await base44.entities.Gasto.create(data);

  await base44.entities.MovimientoBanco.create({
    fecha: data.fecha || new Date().toISOString().split('T')[0],
    tipo: 'Egreso',
    concepto: `Gasto: ${data.descripcion}${data.proveedor ? ` — ${data.proveedor}` : ''}`,
    monto: data.monto,
    cuenta: data.destino || (data.forma_pago === 'Transferencia' ? 'Banco' : 'Caja'),
    origen: 'Gasto',
    referencia_id: gasto.id,
    observaciones: data.observaciones || '',
  });

  return gasto;
}

// ──────────────────────────────────────────────
// Actualización encadenada de GASTOS
// Actualiza el Gasto (no toca el MovimientoBanco ya creado).
// ──────────────────────────────────────────────
export async function actualizarGasto(id, data) {
  return base44.entities.Gasto.update(id, data);
}