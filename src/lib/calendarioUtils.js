// Colores de fondo para eventos de calendario, alineados con RAMA_CONFIG del dashboard.
const EVENTO_RAMA_COLOR = {
  Lobatos: 'bg-yellow-400',
  Tropa: 'bg-green-500',
  KM: 'bg-blue-400',
  Rovers: 'bg-red-500',
  Adultos: 'bg-purple-500',
};

const GRUPO_COLOR = 'bg-indigo-500';
const NEUTRO_COLOR = 'bg-slate-400';

/**
 * Devuelve { bg, dots } para un evento de calendario.
 * - todo_el_grupo → indigo
 * - una sola rama → color de esa rama
 * - múltiples ramas → indigo con dots de cada rama
 */
export function getEventoColor(ev) {
  if (ev.todo_el_grupo) return { bg: GRUPO_COLOR, dots: [] };
  const ramas = ev.ramas_participantes || [];
  if (ramas.length === 0) return { bg: NEUTRO_COLOR, dots: [] };
  if (ramas.length === 1) return { bg: EVENTO_RAMA_COLOR[ramas[0]] || NEUTRO_COLOR, dots: [] };
  return {
    bg: GRUPO_COLOR,
    dots: ramas.map((r) => EVENTO_RAMA_COLOR[r]).filter(Boolean),
  };
}

/**
 * Determina si un evento es relevante para un conjunto de ramas de beneficiarios.
 * - todo_el_grupo → siempre relevante
 * - 'Adultos' → matchea Voluntario o Educador
 * - cualquier otra rama → matchea directa
 */
export function eventoRelevanteParaRamas(ev, ramasBeneficiario) {
  if (ev.todo_el_grupo) return true;
  const ramas = ev.ramas_participantes || [];
  if (ramas.includes('Adultos') && (ramasBeneficiario.includes('Voluntario') || ramasBeneficiario.includes('Educador'))) {
    return true;
  }
  return ramas.some((r) => ramasBeneficiario.includes(r));
}