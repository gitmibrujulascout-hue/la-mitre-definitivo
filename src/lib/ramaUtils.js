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

// Marzo está bonificado si la afiliación fue pagada antes del 14 de Marzo
// para beneficiarios que ya asistían años anteriores (renovación, no primera vez)
export const MESES_BONIFICADOS = []; // Ya no es constante fija, se calcula dinámicamente

/**
 * Devuelve true si Marzo está bonificado (no genera deuda) para un beneficiario.
 * Bonificado cuando: es renovación (no primera vez) Y la afiliación del año
 * fue pagada en fecha <= 14 de Marzo de ese año.
 */
export function marzoEsBonificado(afiliacionAnio, esPrimeraVez) {
  if (esPrimeraVez) return true; // Primera vez no paga cuota de marzo tampoco
  if (!afiliacionAnio) return false; // Sin afiliación registrada → no bonificado
  if (afiliacionAnio.es_primera_vez) return true;
  if (!afiliacionAnio.fecha_pago) return false;
  // Parsear como fecha local para evitar desfase de zona horaria (UTC vs AR)
  const [anio, mes, dia] = afiliacionAnio.fecha_pago.split('T')[0].split('-').map(Number);
  // Bonificado si pagó la afiliación en o antes del 31 de Marzo
  return anio * 10000 + mes * 100 + dia <= anio * 10000 + 3 * 100 + 31;
}

export const CUOTA_EFECTIVO = 25000;
export const CUOTA_TRANSFERENCIA = 27000;

// === Configuración de cuotas por mes ===
// Permite definir valores específicos por mes. null = usa CUOTA_EFECTIVO.
// Meses sin actividad (Enero, Febrero) = 0 (no generan deuda)
export const CUOTAS_MENSUALES = {
  'Enero': 0,
  'Febrero': 0,
  'Marzo': null,    // usa CUOTA_EFECTIVO (bonificado si pagó afiliación a tiempo)
  'Abril': null,
  'Mayo': null,
  'Junio': null,
  'Julio': null,    // 50% descuento para beneficiarios al día (ver JULIO_DESCUENTO)
  'Agosto': null,
  'Septiembre': null,
  'Octubre': null,
  'Noviembre': null,
  'Diciembre': null,
};

// Julio: la cuota se divide en 2 — $12.500 como pago y $12.500 como crédito
// para beneficiarios al día. Valores fijos independientes del modo de pago.
export const JULIO_MONTO_CUOTA = 12500;
export const JULIO_MONTO_CREDITO = 12500;
export const JULIO_LABEL_CREDITO = 'Crédito Julio';

/**
 * Calcula el monto de crédito de Julio para un beneficiario.
 * - No familiares (pagan cuota completa): valor fijo JULIO_MONTO_CREDITO.
 * - Hermanos con descuento (pagan menos de la cuota): 50% de su cuota efectiva de Julio.
 */
export function getCreditoJulioBeneficiario(b, todosBeneficiarios = [], cuotaBaseJulio = CUOTA_EFECTIVO) {
  const cuotaEfectiva = getCuotaBeneficiario(b, todosBeneficiarios, cuotaBaseJulio);
  if (cuotaEfectiva >= cuotaBaseJulio) return JULIO_MONTO_CREDITO;
  return Math.round(cuotaEfectiva * 0.5);
}

// Verifica si el beneficiario tiene todos los meses (excluyendo Julio) pagados
export function estaAlDia(b, pagosCuotasAnio, mesesQueGeneranDeuda) {
  const mesesCubiertos = new Set(
    pagosCuotasAnio.flatMap(p => p.meses || (p.mes ? [p.mes] : []))
  );
  return mesesQueGeneranDeuda
    .filter(m => m !== 'Julio')
    .every(m => mesesCubiertos.has(m));
}

// Devuelve la cuota base para un mes específico (antes de descuentos)
// Soporta valores dinámicos por mes/año desde la entidad ConfigCuota
export function getCuotaBaseMes(mes, anio, configCuotas = []) {
  if (MESES_SIN_CUOTA.includes(mes)) return 0;
  // Buscar configuración dinámica (mes + año)
  if (anio && configCuotas.length > 0) {
    const config = configCuotas.find(c => c.mes === mes && Number(c.anio) === Number(anio));
    if (config && config.monto_efectivo != null) return config.monto_efectivo;
  }
  // Fallback a valores estáticos
  const staticConfig = CUOTAS_MENSUALES[mes];
  if (staticConfig !== null && staticConfig !== undefined) return staticConfig;
  return CUOTA_EFECTIVO;
}

// Devuelve la cuota por transferencia para un mes/año específico
export function getCuotaTransferenciaMes(mes, anio, configCuotas = []) {
  if (MESES_SIN_CUOTA.includes(mes)) return 0;
  if (anio && configCuotas.length > 0) {
    const config = configCuotas.find(c => c.mes === mes && Number(c.anio) === Number(anio));
    if (config && config.monto_transferencia != null) return config.monto_transferencia;
  }
  return CUOTA_TRANSFERENCIA;
}

/**
 * Calcula los intervalos activos (índices de mes 0-based, [inicio, fin] inclusive)
 * para el año dado, considerando alta (afiliación), baja y reingreso.
 *   - Alta: la deuda corre desde el mes de alta (fecha_primer_afiliacion, o la
 *     fecha de pago de la afiliación del año si es primera vez y no hay fecha_primer_afiliacion).
 *   - Baja: no genera deuda a partir del mes siguiente a la baja (el mes de baja sí genera).
 *   - Reingreso: vuelve a generar deuda desde el mes de reingreso.
 */
export function calcularIntervalosActivos(b, anio, afiliaciones = []) {
  const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === b.id && Number(a.anio) === Number(anio));
  const esPrimeraVez = !b.fecha_primer_afiliacion;
  const fechaAlta = b.fecha_primer_afiliacion || (esPrimeraVez && afiliacionAnio?.fecha_pago ? afiliacionAnio.fecha_pago : null);

  let inicio1 = 0;
  if (fechaAlta) {
    const [y, m] = fechaAlta.split('T')[0].split('-').map(Number);
    if (y > anio) return []; // alta en un año futuro → sin actividad este año
    if (y === anio) inicio1 = m - 1; // alta este año → desde ese mes (inclusive)
    // y < anio → activo desde enero
  }

  let fin1 = 11;
  if (b.activo === false && b.fecha_baja) {
    const [y, m] = b.fecha_baja.split('T')[0].split('-').map(Number);
    if (y < anio) fin1 = -1; // dado de baja antes del año → sin período 1
    else if (y === anio) fin1 = m - 1; // mes de baja incluido
  }

  const intervalos = [];
  if (fin1 >= inicio1) intervalos.push([inicio1, fin1]);

  // Reingreso → segundo período activo
  if (b.fecha_reingreso) {
    const [y, m] = b.fecha_reingreso.split('T')[0].split('-').map(Number);
    if (y < anio) intervalos.push([0, 11]);
    else if (y === anio) intervalos.push([m - 1, 11]); // mes de reingreso incluido
  }

  return intervalos;
}

/**
 * Devuelve true si el mes (índice 0-based) NO está dentro de ningún período activo
 * (antes del alta, después de la baja, o entre la baja y el reingreso).
 * Útil para mostrar "no corresponde" en grillas mensuales.
 */
export function mesExcluidoPorActividad(mesIdx, b, anio, afiliaciones = []) {
  const intervalos = calcularIntervalosActivos(b, anio, afiliaciones);
  return !intervalos.some(([ini, fin]) => mesIdx >= ini && mesIdx <= fin);
}

/**
 * Calcula los meses (nombres) que generan deuda de cuota para un beneficiario en un año.
 * Considera alta, baja y reingreso (ver calcularIntervalosActivos).
 * Reutilizable desde múltiples componentes (EstadoCuenta, PagoForm, etc.)
 */
export function calcularMesesQueGeneranDeuda(b, anio, afiliaciones = []) {
  const AÑO_INICIO = 2026;
  if (anio < AÑO_INICIO) return [];

  const mesActual = new Date().getMonth();
  const mesesTranscurridos = anio < new Date().getFullYear() ? 12 : anio > new Date().getFullYear() ? 0 : mesActual + 1;

  const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === b.id && Number(a.anio) === Number(anio));
  const esPrimeraVez = !b.fecha_primer_afiliacion;
  const marzoGratis = marzoEsBonificado(afiliacionAnio, esPrimeraVez);

  const intervalos = calcularIntervalosActivos(b, anio, afiliaciones);
  const enIntervalo = (idx) => intervalos.some(([ini, fin]) => idx >= ini && idx <= fin);

  return MESES.slice(0, mesesTranscurridos).filter((m, idx) => {
    if (MESES_SIN_CUOTA.includes(m)) return false;
    if (m === 'Marzo' && marzoGratis) return false;
    if (!enIntervalo(idx)) return false;
    return true;
  });
}

// Devuelve la cuota efectiva para un mes específico.
// Julio se cobra como mes normal (cuota completa); el split en crédito
// se maneja al registrar el pago, no en el cálculo de deuda.
export function getCuotaMes(mes, cuotaBase, alDia = false) {
  return cuotaBase;
}

// Descuentos por grupo familiar (hermanos que pagan cuota)
// 2 hermanos: 50% de descuento c/u ($22.500 cada uno sobre base $45.000)
// 4 hermanos: 25% de descuento c/u
const DESCUENTO_HERMANOS = { 2: 0.10, 4: 0.25 }; // porcentaje de descuento sobre la cuota

export function esBeneficiarioConCuota(b) {
  return b.tipo !== 'Voluntario' && !b.becado && !['Voluntario', 'Educador'].includes(b.rama);
}

/**
 * Devuelve el valor de la cuota efectivo para un beneficiario,
 * aplicando descuento si tiene hermanos en el mismo grupo_familiar.
 * @param {object} b - beneficiario
 * @param {array} todosBeneficiarios - lista completa de beneficiarios activos
 */
export function getCuotaBeneficiario(b, todosBeneficiarios = [], baseEfectivo = CUOTA_EFECTIVO) {
  if (!esBeneficiarioConCuota(b)) return 0;
  if (!b.grupo_familiar) return baseEfectivo;

  // Contar hermanos que también pagan cuota (activos, mismo grupo_familiar)
  const hermanos = todosBeneficiarios.filter(x =>
    x.id !== b.id &&
    x.activo !== false &&
    x.grupo_familiar === b.grupo_familiar &&
    esBeneficiarioConCuota(x)
  );
  const cantidadTotal = hermanos.length + 1; // incluye al propio beneficiario

  // Buscar el descuento más cercano hacia abajo
  const niveles = Object.keys(DESCUENTO_HERMANOS).map(Number).sort((a, z) => a - z);
  let descuento = 0;
  for (const nivel of niveles) {
    if (cantidadTotal >= nivel) descuento = DESCUENTO_HERMANOS[nivel];
  }

  return Math.round(baseEfectivo * (1 - descuento));
}

/**
 * Calcula el monto efectivo pagado por mes para un beneficiario.
 * Devuelve { [mes]: montoPagado }.
 * Para transferencias, computa a valor efectivo (cuota base, los $2.000 extra son impuestos bancarios).
 * Para efectivo/subsidio/crédito, usa el monto real dividido entre los meses del pago.
 */
export function calcularMontoPorMes(pagosCuota, beneficiario, todosBeneficiarios = []) {
  const cuotaEfectiva = getCuotaBeneficiario(beneficiario, todosBeneficiarios);
  const resultado = {};
  pagosCuota.forEach(p => {
    const meses = p.meses || (p.mes ? [p.mes] : []);
    if (meses.length === 0) return;
    let montoPorMes;
    if (p.forma_pago === 'Transferencia') {
      // Convierte el monto real transferido a su valor efectivo equivalente.
      // Así un pago por transferencia menor al esperado se detecta como parcial.
      const cuotaTransfBen = getCuotaBeneficiario(beneficiario, todosBeneficiarios, CUOTA_TRANSFERENCIA);
      const ratio = cuotaTransfBen > 0 ? cuotaEfectiva / cuotaTransfBen : 1;
      montoPorMes = ((p.monto || 0) / meses.length) * ratio;
    } else {
      montoPorMes = (p.monto || 0) / meses.length;
    }
    meses.forEach(m => {
      resultado[m] = (resultado[m] || 0) + montoPorMes;
    });
  });
  return resultado;
}

export function getRamaBadge(rama) {
  const config = RAMA_CONFIG[rama];
  if (!config) return 'bg-muted text-muted-foreground';
  return config.badge;
}

/**
 * Devuelve el apellido (última palabra del nombre completo) para ordenamiento.
 * Si el nombre no tiene apellido claro, devuelve el nombre completo.
 */
export function getApellido(nombre) {
  if (!nombre) return '';
  const parts = nombre.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0].toLowerCase();
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Comparador para ordenar por rama (según TODOS_LOS_ROLES) y luego por apellido.
 * Los que no tienen rama conocida van al final.
 */
export function compararPorRamaYApellido(ramaA, nombreA, ramaB, nombreB) {
  const ra = TODOS_LOS_ROLES.indexOf(ramaA);
  const rb = TODOS_LOS_ROLES.indexOf(ramaB);
  const raIdx = ra === -1 ? 999 : ra;
  const rbIdx = rb === -1 ? 999 : rb;
  if (raIdx !== rbIdx) return raIdx - rbIdx;
  return getApellido(nombreA).localeCompare(getApellido(nombreB), 'es');
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
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const cumplioEsteAnio =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  if (!cumplioEsteAnio) edad--;
  if (edad >= 23) return 'Voluntario';
  if (edad >= 18) return 'Rovers';
  if (edad >= 14) return 'KM';
  if (edad >= 10) return 'Tropa';
  if (edad >= 7) return 'Lobatos';
  return null;
}