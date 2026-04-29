export const RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];
export const TODOS_LOS_ROLES = ['Lobatos', 'Tropa', 'KM', 'Rovers', 'Voluntario', 'Educador'];

export const RAMA_CONFIG = {
  Lobatos:    { color: 'bg-yellow-400', text: 'text-yellow-900', border: 'border-yellow-400', badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-400', edad: '7-9 años' },
  Tropa:      { color: 'bg-green-500',  text: 'text-green-900',  border: 'border-green-500',  badge: 'bg-green-100 text-green-800 border-green-300',   dot: 'bg-green-500',  edad: '10-13 años' },
  KM:         { color: 'bg-blue-400',   text: 'text-blue-900',   border: 'border-blue-400',   badge: 'bg-blue-100 text-blue-800 border-blue-300',     dot: 'bg-blue-400',   edad: '14-17 años' },
  Rovers:     { color: 'bg-red-500',    text: 'text-red-900',    border: 'border-red-500',    badge: 'bg-red-100 text-red-800 border-red-300',        dot: 'bg-red-500',    edad: '18-21 años' },
  Voluntario: { color: 'bg-purple-500', text: 'text-purple-900', border: 'border-purple-500', badge: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500', edad: '22+ años' },
  Educador:   { color: 'bg-slate-500',  text: 'text-slate-900',  border: 'border-slate-500',  badge: 'bg-slate-100 text-slate-700 border-slate-300',   dot: 'bg-slate-500',  edad: 'Educador' },
};

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Meses que NO generan deuda de cuota
export const MESES_SIN_CUOTA = ['Enero', 'Febrero']; // No hay actividad
export const MESES_BONIFICADOS = ['Marzo']; // Bonificado por la asociación

export const CUOTA_EFECTIVO = 25000;
export const CUOTA_TRANSFERENCIA = 27000;

export function esBeneficiarioConCuota(b) {
  return b.tipo !== 'Voluntario' && !b.becado && !['Voluntario', 'Educador'].includes(b.rama);
}

export function getRamaBadge(rama) {
  const config = RAMA_CONFIG[rama];
  if (!config) return 'bg-muted text-muted-foreground';
  return config.badge;
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount || 0);
}

/**
 * Determina la rama automáticamente en base a la fecha de nacimiento
 */
export function ramaDesdeEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  const edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (edad >= 22) return 'Voluntario';
  if (edad >= 18) return 'Rovers';
  if (edad >= 14) return 'KM';
  if (edad >= 10) return 'Tropa';
  return 'Lobatos';
}