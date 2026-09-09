const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const hasImportValue = value => value !== undefined && value !== null && value !== '';
export function importDate(value) {
  if (!hasImportValue(value)) return '';
  const text = String(value).trim();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Hay una fecha inválida. Usá día/mes/año o AAAA-MM-DD.');
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error('Hay una fecha que no existe en el calendario.');
  return iso;
}
export function importBoolean(value) {
  if (!hasImportValue(value)) return undefined;
  if (['si', 'true', '1', 'activo', 'becado', 'alta'].includes(clean(value))) return true;
  if (['no', 'false', '0', 'inactivo', 'baja', 'no becado'].includes(clean(value))) return false;
  throw new Error('Hay un estado o una beca no reconocidos. Usá Sí/No, true/false o 1/0.');
}
const branches = {
  lobatos: 'Lobatos', 'lobatos y lobeznas': 'Lobatos', manada: 'Lobatos',
  tropa: 'Tropa', scout: 'Tropa', scouts: 'Tropa', unidad: 'Tropa', 'unidad scout': 'Tropa',
  km: 'KM', caminantes: 'KM', caminante: 'KM', 'comunidad caminante': 'KM',
  rover: 'Rovers', rovers: 'Rovers', 'comunidad rover': 'Rovers',
  educador: 'Educador', educadores: 'Educador', dirigente: 'Educador',
  voluntario: 'Voluntario', voluntarios: 'Voluntario'
};
export function normalizeMember(row) {
  const result = { ...row };
  for (const field of ['fecha_nacimiento', 'fecha_primer_afiliacion', 'fecha_baja', 'fecha_reingreso']) {
    if (hasImportValue(row[field])) result[field] = importDate(row[field]);
  }
  for (const field of ['becado', 'activo']) {
    if (hasImportValue(row[field])) result[field] = importBoolean(row[field]);
    else delete result[field];
  }
  const explicit = clean(row.rama);
  if (explicit && !branches[explicit]) throw new Error('Hay una rama no reconocida. Corregí la columna Rama antes de importar.');
  const branch = branches[explicit] || branches[clean(row.categoria)];
  const adult = /educador|dirigente|responsable|jefe|coordinador/.test(clean(row.funcion));
  result.rama = branch || (adult ? 'Educador' : /voluntario|apoyo/.test(clean(row.funcion)) ? 'Voluntario' : '');
  // La edad nunca sustituye la ubicación institucional informada por el grupo.
  if (!result.rama) throw new Error('Falta la rama. Completá Rama o Categoría antes de importar.');
  result.tipo = adult || ['Voluntario', 'Educador'].includes(result.rama) ? 'Voluntario' : 'Beneficiario';
  if (adult && !['Voluntario', 'Educador'].includes(result.rama)) result.rama_educador = result.rama;
  return result;
}
