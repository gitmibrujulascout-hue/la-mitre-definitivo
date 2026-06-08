// Definición centralizada de campos de salud — usada en todos los componentes
export const SALUD_FIELDS = [
  { key: 'grupo_sanguineo', label: 'Grupo sanguíneo', placeholder: 'Ej: A, B, AB, O' },
  { key: 'factor_rh', label: 'Factor RH', placeholder: 'Positivo / Negativo' },
  { key: 'peso_kg', label: 'Peso (kg)', placeholder: 'Ej: 65', type: 'number' },
  { key: 'talla_m', label: 'Talla (m)', placeholder: 'Ej: 1.65', type: 'number' },
  { key: 'alergias', label: 'Alergias conocidas', placeholder: 'Alimentos, medicamentos, látex... (o "Ninguna")' },
  { key: 'condicion_medica', label: 'Afección / Enfermedad crónica', placeholder: 'Asma, diabetes, epilepsia... (o "Ninguna")' },
  { key: 'medicacion_habitual', label: 'Medicación habitual', placeholder: 'Nombre y dosis (o "No toma")' },
  { key: 'regimen_dietario', label: 'Régimen dietario especial', placeholder: 'Celíaco, vegetariano, sin TACC... (o "Ninguno")' },
  { key: 'anticoagulacion', label: 'Anticoagulación', placeholder: 'Droga utilizada (o dejar vacío si no)' },
  { key: 'salud_mental', label: 'Salud mental', placeholder: 'Diagnóstico o tratamiento relevante (si lo hay)' },
  { key: 'discapacidad', label: 'Discapacidad / CUD', placeholder: 'N° de certificado o descripción (si tiene)' },
  { key: 'obra_social', label: 'Obra social / Prepaga', placeholder: 'Nombre de la cobertura' },
  { key: 'numero_obra_social', label: 'N° de afiliado', placeholder: 'N° de credencial' },
  { key: 'contacto_emergencia_nombre', label: 'Contacto emergencia (nombre)', placeholder: 'Nombre completo' },
  { key: 'contacto_emergencia_telefono', label: 'Contacto emergencia (teléfono)', placeholder: 'Teléfono' },
  { key: 'contacto_emergencia_relacion', label: 'Relación del contacto', placeholder: 'Madre, padre, tutor...' },
  { key: 'observaciones_salud', label: 'Observaciones adicionales', placeholder: 'Cualquier dato importante que debamos saber', wide: true },
];

export const SALUD_SCHEMA = {
  type: 'object',
  properties: {
    grupo_sanguineo: { type: 'string', description: 'Grupo sanguíneo (A, B, AB, O). Solo la letra, null si no figura.' },
    factor_rh: { type: 'string', description: 'Factor RH: "Positivo" o "Negativo". Null si no figura.' },
    peso_kg: { type: 'number', description: 'Peso en kilogramos (número). Null si no figura.' },
    talla_m: { type: 'number', description: 'Talla/altura en metros (número, ej: 1.65). Null si no figura.' },
    alergias: { type: 'string', description: 'Alergias conocidas. Null si "NO" o no figura.' },
    condicion_medica: { type: 'string', description: 'Enfermedades crónicas o afecciones. Null si no tiene.' },
    medicacion_habitual: { type: 'string', description: 'Medicación habitual. Null si no toma.' },
    regimen_dietario: { type: 'string', description: 'Régimen alimentario especial. Null si no tiene.' },
    anticoagulacion: { type: 'string', description: 'Si está anticoagulado: indicar la droga. Null si no está.' },
    salud_mental: { type: 'string', description: 'Diagnóstico de salud mental. Null si no tiene.' },
    discapacidad: { type: 'string', description: 'CUD o necesidades especiales físicas. Null si no tiene.' },
    obra_social: { type: 'string', description: 'Nombre de la obra social o prepaga. Null si no tiene.' },
    numero_obra_social: { type: 'string', description: 'Número de credencial o afiliado.' },
    contacto_emergencia_nombre: { type: 'string', description: 'Nombre del contacto de emergencia.' },
    contacto_emergencia_telefono: { type: 'string', description: 'Teléfono del contacto de emergencia.' },
    contacto_emergencia_relacion: { type: 'string', description: 'Relación del contacto (madre, padre, tutor, etc.).' },
    observaciones_salud: { type: 'string', description: 'Otras observaciones médicas relevantes.' },
  }
};

export function buildSaludForm(beneficiario) {
  const form = {};
  SALUD_FIELDS.forEach(({ key }) => {
    form[key] = beneficiario?.[key] != null ? String(beneficiario[key]) : '';
  });
  return form;
}

export function parseSaludForm(form) {
  const result = {};
  SALUD_FIELDS.forEach(({ key, type }) => {
    const val = form[key];
    if (val && String(val).trim() !== '') {
      result[key] = type === 'number' ? parseFloat(val) : String(val).trim();
    } else {
      result[key] = null;
    }
  });
  return result;
}