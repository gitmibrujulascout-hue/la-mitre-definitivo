import { z } from 'zod';
const valuesSchema = z.record(z.unknown()).refine(value => Object.keys(value).length > 0);
export function normalizeBulkUpdatePlan(filters, values) {
  if (Array.isArray(filters)) {
    if (!filters.length || filters.length > 1000) throw new Error('Seleccioná entre 1 y 1000 registros.');
    const ids = new Set();
    return filters.map((row) => {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id)) {
        throw new Error('Cada actualización masiva necesita un id.');
      }
      ids.add(row.id);
      const { id, ...rest } = row;
      if (!valuesSchema.safeParse(rest).success) throw new Error('Faltan datos para actualizar.');
      return { id, values: rest };
    });
  }

  if (!valuesSchema.safeParse(values).success || !valuesSchema.safeParse(filters).success) {
    throw new Error('Falta el payload de actualización.');
  }

  return { filters, values };
}
