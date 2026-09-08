import { z } from 'zod';

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

export async function extractMembers(file, invoke, progress) {
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('Elegí un archivo de hasta 10 MB.');
  const bytes = await file.arrayBuffer();
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
  if (!/\.pdf$/i.test(file.name)) throw new Error('Guardá el archivo como XLSX o PDF con texto.');
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
  const pdf = await task.promise;
  const lines = [];
  try {
    if (pdf.numPages > 100) throw new Error('El PDF supera las 100 páginas.');
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
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
  const result = [];
  for (let start = 0; start < rows.length; start += 5) {
    const batch = rows.slice(start, start + 5);
    progress(`PDF: ${start} de ${rows.length} personas verificadas`);
    const response = await invoke({ prompt: `Extraé exactamente ${batch.length} personas del listado, una por fila. No inventes datos. Fechas YYYY-MM-DD; datos ausentes cadena vacía. DNI sin puntos. Las columnas del archivo son: ${lines[0]}. Filas:\n${batch.map(row => row.line).join('\n')}`, response_json_schema: memberSchema });
    result.push(...validateMembers(response?.personas, batch.map(row => row.id)));
  }
  progress(`${result.length} de ${rows.length} personas verificadas`);
  return validateMembers(result, rows.map(row => row.id));
}
