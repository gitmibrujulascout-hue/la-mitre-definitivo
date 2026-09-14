import { z } from 'zod';
const rowsSchema = z.array(z.record(z.union([z.string(),z.number().finite(),z.boolean(),z.null(),z.undefined()])));

export async function buildXlsx(rows, sheetName, headers) {
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) throw new Error('El reporte contiene datos inválidos.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const columns = headers || [...new Set(parsed.data.flatMap(row => Object.keys(row)))];
  worksheet.columns = columns.map((key) => ({ header: key, key }));
  worksheet.addRows(parsed.data);
  return workbook.xlsx.writeBuffer();
}

export async function downloadXlsx(rows, sheetName, filename, headers) {
  const buffer = await buildXlsx(rows, sheetName, headers);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
