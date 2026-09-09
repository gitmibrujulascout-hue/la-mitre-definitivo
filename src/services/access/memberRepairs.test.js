import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMember, importDate, hasImportValue } from './memberNormalization.js';
import { csvRows } from './csvRows.js';
import { rowsToMembers, extractMembers } from './memberImport.js';
import { saveMemberBulkEdit } from './memberBulkEdit.js';
import { receiptDraft, validReceipt } from './receiptExtraction.js';

test('CSV respeta familia explícita, baja y beca falsa con BOM y comillas', async () => {
  const text = '\uFEFFNombre;DNI;Rama;Becado;Activo;Grupo familiar\r\n"Persona, Prueba";10000000;Scouts;No;No;F-1';
  const [row] = rowsToMembers(csvRows(text));
  const result = normalizeMember(row);
  assert.equal(result.rama, 'Tropa'); assert.equal(result.becado, false);
  assert.equal(result.activo, false); assert.equal(result.grupo_familiar, 'F-1');
  assert.equal(hasImportValue(false), true);
  const bytes = new TextEncoder().encode(text);
  const extracted = await extractMembers({ name: 'archivo.csv', size: bytes.length, arrayBuffer: async () => bytes.buffer }, () => assert.fail('CSV no usa IA'), () => {});
  assert.equal(extracted.length, 1);
});
test('rama del archivo prevalece sobre edad y educador conserva función', () => {
  assert.equal(normalizeMember({ rama: 'Caminantes', fecha_nacimiento: '01/01/2000' }).rama, 'KM');
  const adult = normalizeMember({ rama: 'Scouts', funcion: 'Educador' });
  assert.equal(adult.tipo, 'Voluntario'); assert.equal(adult.rama_educador, 'Tropa');
  assert.equal(normalizeMember({ categoria: 'Rover' }).rama, 'Rovers');
  assert.equal(normalizeMember({ rama: 'Rovers' }).becado, undefined);
  assert.throws(() => normalizeMember({ rama: 'Desconocida' }));
  assert.throws(() => normalizeMember({ rama: 'Rovers', becado: 'quizás' }));
});
test('fechas válidas, imposibles y sin ambigüedad', () => {
  assert.equal(importDate('4/3/2020'), '2020-03-04');
  assert.equal(importDate('29/02/2024'), '2024-02-29');
  assert.throws(() => importDate('31/02/2024')); assert.throws(() => importDate('2023-02-29'));
});
test('CSV soporta saltos y comillas escapadas, rechaza filas rotas', () => {
  assert.deepEqual(csvRows('Nombre,DNI\n"Prueba ""A""\nB",10000000')[1], ['Prueba "A"\nB', '10000000']);
  assert.throws(() => csvRows('Nombre;DNI\nA;10000000;extra'));
  assert.throws(() => csvRows('Nombre;DNI\n"A;10000000'));
});
const id = '00000000-0000-4000-8000-000000000001';
test('actualización masiva limita tenant e IDs y permite falso', async () => {
  const calls = []; const client = { from(table) { calls.push(table); return this; }, update(patch) { calls.push(patch); return this; }, eq(...args) { calls.push(args); return this; }, in(...args) { calls.push(args); return this; }, select() { return { data: [{ id }], error: null }; } };
  assert.equal(await saveMemberBulkEdit(client, 'tenant-a', [id], ['becado'], { becado: false }), 1);
  assert.deepEqual(calls[2], ['tenant_id', 'tenant-a']); assert.deepEqual(calls[3], ['id', [id]]);
  assert.equal(calls[1].becado, false);
});
test('actualización masiva deniega sin tenant, incompleta o rechazada por RLS', async () => {
  await assert.rejects(saveMemberBulkEdit({}, null, [id], ['becado'], { becado: true }));
  await assert.rejects(saveMemberBulkEdit({}, 'tenant-a', [id], ['becado'], {}));
  const denied = { from() { return this; }, update() { return this; }, eq() { return this; }, in() { return this; }, select() { return { data: [], error: null }; } };
  await assert.rejects(saveMemberBulkEdit(denied, 'tenant-a', [id], ['becado'], { becado: true }));
});
test('recibos sin fecha o total no se transforman en gastos válidos', () => {
  const draft = receiptDraft({ descripcion: 'Prueba', monto_total: null, fecha: null, proveedor: null, numero_factura: null, categoria: null });
  assert.equal(draft.fecha, ''); assert.equal(draft.monto_total, null);
  assert.equal(validReceipt({ descripcion: 'Prueba', monto: 0, fecha: '2026-09-09' }), false);
  assert.equal(validReceipt({ descripcion: 'Prueba', monto: 1234.56, fecha: '2026-09-09' }), true);
});
