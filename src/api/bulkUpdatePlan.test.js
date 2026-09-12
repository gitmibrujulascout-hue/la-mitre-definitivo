import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBulkUpdatePlan } from './bulkUpdatePlan.js';

test('normaliza lotes por id para bulkUpdate', () => {
  const plan = normalizeBulkUpdatePlan([
    { id: 'a1', estado_panuelo: 'Paturuzú' },
    { id: 'b2', estado_panuelo: '' },
  ]);

  assert.deepEqual(plan, [
    { id: 'a1', values: { estado_panuelo: 'Paturuzú' } },
    { id: 'b2', values: { estado_panuelo: '' } },
  ]);
});

test('mantiene filtros y valores para bulkUpdate con filtro', () => {
  const plan = normalizeBulkUpdatePlan({ rama: 'Tropa' }, { activo: true });

  assert.deepEqual(plan, {
    filters: { rama: 'Tropa' },
    values: { activo: true },
  });
});
