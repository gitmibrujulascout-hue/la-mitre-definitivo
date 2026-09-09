import { z } from 'zod';
import { csvRows } from './csvRows.js';

const fields = {
  documento: 'dni', dni: 'dni', nombre: 'nombre', sexo: 'sexo',
  fechanacimiento: 'fecha_nacimiento', provincia: 'provincia', localidad: 'localidad',
  calle: 'calle', codigopostal: 'codigo_postal', estadocivil: 'estado_civil',
  celular: 'telefono_contacto', telefono: 'telefono_contacto', email: 'email_contacto',
  religion: 'religion', religiondescripcion: 'religion_descripcion', estudios: 'estudios',
  titulo: 'titulo', discapacidad: 'discapacidad', detallediscapacidad: 'detalle_discapacidad',
  nacionalidad: 'nacionalidad', funcion: 'funcion', categoria: 'categoria', rama: 'rama',
  zona: 'zona', distrito: 'distrito', codigo: 'codigo', organismo: 'organismo',
  fechaprimerafiliacion: 'fecha_primer_afiliacion',
  tipodocumento: 'tipo_documento', empresa: 'empresa', becado: 'becado', beca: 'becado',
  activo: 'activo', estado: 'activo', fechabaja: 'fecha_baja', fechareingreso: 'fecha_reingreso',
  grupofamiliar: 'grupo_familiar', idfamilia: 'grupo_familiar',
  telefonocontacto: 'telefono_contacto', emailcontacto: 'email_contacto',
};
const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
export const memberSchema = { type: 'object', properties: { personas: { type: 'array', items: { type: 'object', properties: Object.fromEntries([...new Set(Object.values(fields))].map(name => [name, { type: 'string' }])) } } } };
const person = z.object({ nombre: z.string().trim().min(1), dni: z.string().regex(/^\d{7,8}$/) }).catchall(z.string());
export function validateMembers(records, expectedIds) {
  const result = z.array(person).min(1).max(3000).parse(records);
  const ids = result.map(row => row.dni);
  if (new Set(ids).size !== ids.length) throw new Error('Hay DNI repetidos en el archivo. Corregilos antes de importar.');
  if (expectedIds && (ids.length !== expectedIds.length || expectedIds.some(id => !ids.includes(id)))) throw new Error('La extracción quedó incompleta. No se guardaron personas. Probá con el Excel original.');
  return result;
}
function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result);
    if ('text' in value) return String(value.text);
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text).join('');
    throw new Error('Hay una celda que no se puede interpretar. Guardá el archivo como XLSX e intentá nuevamente.');
  }
  return String(value).trim();
}
export function rowsToMembers(rows) {
  const headerIndex = rows.findIndex(row => row.some(v => key(v) === 'nombre') && row.some(v => ['documento', 'dni'].includes(key(v))));
  if (headerIndex < 0) throw new Error('Faltan las columnas Nombre y Documento (DNI).');
  const columns = rows[headerIndex].map(v => fields[key(v)]);
  const records = rows.slice(headerIndex + 1).filter(row => row.some(v => cellText(v) !== '')).map(row => {
    const record = {};
    columns.forEach((field, i) => { if (field) record[field] = cellText(row[i]); });
    record.dni = (record.dni || '').replace(/[.\s-]/g, '');
    // Una columna vacía no impone un valor ni exige una columna nueva en la base.
    Object.keys(record).forEach(field => { if (field !== 'nombre' && field !== 'dni' && record[field] === '') delete record[field]; });
    return record;
  });
  return validateMembers(records);
}
export function pdfRows(lines) {
  const result = lines.map(line => ({ line, id: line.match(/^\s*DNI\s*([\d.]{7,10})/i)?.[1]?.replace(/\./g, '') })).filter(row => row.id);
  if (!result.length || result.some(row => !/^\d{7,8}$/.test(row.id))) throw new Error('No se reconoció el listado completo del PDF. Usá el Excel original para importar todas las personas.');
  if (new Set(result.map(row => row.id)).size !== result.length) throw new Error('El PDF contiene DNI repetidos. Usá el Excel original.');
  return result;
}

export function pdfTable(items) {
  const groups = new Map();
  for (const item of items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] * 2) / 2;
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push(item);
  }
  const lines = [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a,b) => a.transform[4] - b.transform[4]));
  const header = lines.find(row => row.some(item => key(item.str) === 'documento') && row.some(item => key(item.str) === 'nombre'));
  if (!header) return null;
  const records = lines.slice(lines.indexOf(header) + 1).filter(row => /^DNI\s/i.test(row.map(item=>item.str).join(' '))).map(row => {
    const cells = header.map(()=>'');
    for (const item of row) {
      let column = -1;
      for (let i=0; i<header.length; i++) if (item.transform[4] >= header[i].transform[4] - 1) column = i;
      if (column >= 0 && key(header[column].str) === 'documento') {
        const merged = item.str.match(/^([\d.]{7,10})\s*(.+)$/);
        if (merged) {
          cells[column] = merged[1];
          const nameColumn = header.findIndex(item=>key(item.str)==='nombre');
          cells[nameColumn] = merged[2];
          continue;
        }
      }
      if (column >= 0) cells[column] += (cells[column] ? ' ' : '') + item.str;
    }
    return cells;
  });
  if (!records.length) return null;
  try { return rowsToMembers([header.map(item=>item.str), ...records]); } catch { return null; }
}

export async function extractMembers(file, invoke, progress) {
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('Elegí un archivo de hasta 10 MB.');
  const bytes = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('windows-1252').decode(bytes); }
    const result = rowsToMembers(csvRows(text));
    progress(`${result.length} personas leídas del CSV`);
    return result;
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    const people = [];
    for (const sheet of book.worksheets) {
      if (!sheet.actualRowCount) continue;
      if (sheet.rowCount > 3001 || sheet.columnCount > 100) throw new Error('El Excel supera el límite de 3000 filas o 100 columnas.');
      const rows = [];
      sheet.eachRow(row => rows.push(Array.from({ length: sheet.columnCount }, (_, i) => row.getCell(i + 1).value)));
      people.push(...rowsToMembers(rows));
    }
    const result = validateMembers(people);
    progress(`${result.length} personas leídas del Excel`);
    return result;
  }
  if (!/\.pdf$/i.test(file.name)) throw new Error('Guardá el archivo como CSV, XLSX o PDF con texto.');
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
  const pdf = await task.promise;
  const lines = [];
  const tableRecords = [];
  let allPagesHaveTables = true;
  try {
    if (pdf.numPages > 100) throw new Error('El PDF supera las 100 páginas.');
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const table = pdfTable(content.items);
      if (table) tableRecords.push(...table); else allPagesHaveTables = false;
      const groups = new Map();
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = Math.round(item.transform[5] * 2) / 2;
        if (!groups.has(y)) groups.set(y, []);
        groups.get(y).push(item);
      }
      for (const [, items] of [...groups.entries()].sort((a, b) => b[0] - a[0])) lines.push(items.sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' '));
    }
  } finally { await task.destroy(); }
  const rows = pdfRows(lines);
  if (rows.length > 3000) throw new Error('El PDF supera las 3000 personas.');
  if (allPagesHaveTables) {
    const verified = validateMembers(tableRecords, rows.map(row=>row.id));
    progress(`${verified.length} de ${rows.length} personas leídas de la tabla PDF`);
    return verified;
  }
  const result = [];
  for (let start = 0; start < rows.length; start += 15) {
    progress(`PDF: ${result.length} de ${rows.length} personas verificadas`);
    const batches = [0, 5, 10].map(offset => rows.slice(start + offset, start + offset + 5)).filter(batch => batch.length);
    const completed = await Promise.all(batches.map(async batch => {
      let timer;
      try {
        const response = await Promise.race([
          invoke({ prompt: `Extraé exactamente ${batch.length} personas del listado, una por fila. No inventes datos. Fechas YYYY-MM-DD; datos ausentes cadena vacía. DNI sin puntos. Las columnas del archivo son: ${lines[0]}. Filas:\n${batch.map(row => row.line).join('\n')}`, response_json_schema: memberSchema }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('La extracción tardó demasiado. Probá con el Excel original.')), 90000); }),
        ]);
        return validateMembers(response?.personas, batch.map(row => row.id));
      } finally { clearTimeout(timer); }
    }));
    result.push(...completed.flat());
  }
  progress(`${result.length} de ${rows.length} personas verificadas`);
  return validateMembers(result, rows.map(row => row.id));
}
