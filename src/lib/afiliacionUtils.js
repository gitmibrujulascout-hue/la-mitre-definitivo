// Utilidades para afiliaciones: tipo de beneficiario, montos y bonificación por fecha.

// Determina si un beneficiario es acompañante (adulto / voluntario / educador)
export function esAcompanante(b) {
  if (!b) return false;
  return b.tipo === 'Voluntario' || ['Voluntario', 'Educador'].includes(b.rama);
}

// Devuelve el monto del seguro según el tipo de beneficiario y la config del año.
// Si no hay config, usa fallback (42.000 general / 25.000 acompañante).
const FALLBACK_GENERAL = 42000;
const FALLBACK_ACOMPANANTE = 25000;

export function getMontoSeguro(b, config) {
  if (b?.tipo_afiliacion === 'Acompañante') {
    return config?.monto_acompanante != null ? config.monto_acompanante : FALLBACK_ACOMPANANTE;
  }
  return config?.monto_general || FALLBACK_GENERAL;
}

/**
 * Determina si la primera afiliación está bonificada (no abona).
 * - Si tiene fecha de primera afiliación ANTERIOR a este año → renovación (debe pagar)
 * - Si tiene fecha de primera afiliación de este año o después → bonificado (primera vez este año)
 * - Si no tiene fecha (nunca afiliado) → bonificado, salvo que la fecha de pago supere la fecha límite
 */
export function esPrimeraVezBonificado(b, config, fechaPago) {
  if (!b) return false;
  const anioNum = config?.anio ? Number(config.anio) : new Date().getFullYear();
  if (b.fecha_primer_afiliacion) {
    const yearPrimera = new Date(b.fecha_primer_afiliacion + 'T00:00:00').getFullYear();
    // Si la primera afiliación fue antes de este año → renovación
    if (yearPrimera < anioNum) return false;
    // Si fue este año o después → bonificado
    return true;
  }
  // Sin fecha → primera vez, bonificado salvo fecha límite
  if (!config?.fecha_limite_primera_vez) return true;
  const fecha = fechaPago || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  return fecha <= config.fecha_limite_primera_vez;
}

/**
 * Construye el objeto MovimientoBanco (ingreso) para un pago de afiliación.
 * Devuelve null si no corresponde (primera vez sin costo, o monto 0).
 * El dinero entra directamente a caja/banco cuando la familia paga.
 */
export function buildMovimientoAfiliacion(afiliacion) {
  if (!afiliacion || afiliacion.es_primera_vez) return null;
  const montoIngreso = Math.max(0, (afiliacion.monto_pagado || 0) - (afiliacion.monto_pagado_credito || 0));
  if (montoIngreso <= 0) return null;
  const cuenta = afiliacion.forma_pago === 'Transferencia' ? 'Banco' : 'Caja';
  return {
    fecha: afiliacion.fecha_pago,
    tipo: 'Ingreso',
    cuenta,
    origen: 'Afiliación',
    concepto: `Afiliación ${afiliacion.anio} — ${afiliacion.beneficiario_nombre}`,
    monto: montoIngreso,
    referencia_id: afiliacion.id,
  };
}

// Determina si es primera vez (sin afiliación previa registrada)
export function esPrimeraVez(b) {
  return !b?.fecha_primer_afiliacion;
}