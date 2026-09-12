export function normalizeBulkUpdatePlan(filters, values) {
  if (Array.isArray(filters)) {
    return filters.map((row) => {
      if (!row || typeof row !== 'object' || !row.id) {
        throw new Error('Cada actualización masiva necesita un id.');
      }
      const { id, ...rest } = row;
      return { id, values: rest };
    });
  }

  if (values === undefined) {
    throw new Error('Falta el payload de actualización.');
  }

  return { filters, values };
}
