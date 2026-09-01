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
  if (!config) return esAcompanante(b) ? FALLBACK_ACOMPANANTE : FALLBACK_GENERAL;
  if (esAcompanante(b)) {
    return config.monto_acompanante != null ? config.monto_acompanante : (config.monto_general || FALLBACK_ACOMPANANTE);
  }
  return config.monto_general || FALLBACK_GENERAL;
}

/**
 * Determina si la primera afiliación está bonificada (no abona) según la fecha límite.
 * - Si ya tiene afiliación previa → no es primera vez → false
 * - Si no hay fecha límite configurada → siempre bonificado
 * - Si hay fecha límite → bonificado solo si fechaPago <= fecha límite
 */
export function esPrimeraVezBonificado(b, config, fechaPago) {
  if (!b) return false;
  if (b.fecha_primer_afiliacion) return false; // ya afiliado antes → renovación
  if (!config?.fecha_limite_primera_vez) return true; // sin límite → bonificado
  const fecha = fechaPago || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos Aires' });
  return fecha <= config.fecha_limite_primera_vez;
}

// Determina si es primera vez (sin afiliación previa registrada)
export function esPrimeraVez(b) {
  return !b?.fecha_primer_afiliacion;
}