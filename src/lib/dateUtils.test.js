import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateValue, formatDisplayDate, toInputDate, todayInputDate } from './dateUtils.js';

test('formatDisplayDate convierte ISO a dd/mm/yyyy', () => {
  assert.equal(formatDisplayDate('2025-06-15'), '15/06/2025');
  assert.equal(formatDisplayDate('15/06/2025'), '15/06/2025');
});

test('toInputDate normaliza valores para input type=date', () => {
  assert.equal(toInputDate('15/06/2025'), '2025-06-15');
  assert.equal(toInputDate('2025-06-15'), '2025-06-15');
});

test('rechaza fechas imposibles sin corregirlas silenciosamente', () => {
  assert.equal(toInputDate('31/02/2026'), '');
  assert.equal(toInputDate('2026-02-31'), '');
  assert.equal(formatDisplayDate('31/02/2026'), '');
});

test('interpreta día/mes argentino y valida bisiestos, timestamp y entradas externas', () => {
  assert.equal(toInputDate('1/2/2026'), '2026-02-01');
  assert.equal(toInputDate('29/2/2024'), '2024-02-29');
  for (const value of ['29/2/2026','2026-13-01','0/1/2026','31/4/2026','2026-02-31T12:00:00Z','2026-02-01T24:00:00Z','2026-02-01T12:60:00Z','2026-02-01T12:00:00+15:00','2026-02-01T12:00:00','Feb 1 2026',{},42,null,new Date('invalid')]) {
    assert.equal(parseDateValue(value), null);
  }
  assert.equal(parseDateValue('2026-02-01T12:00:00-03:00').toISOString(), '2026-02-01T15:00:00.000Z');
  assert.equal(parseDateValue('2026-02-01T12:00:00.123456+00:00').toISOString(),'2026-02-01T12:00:00.123Z');
  assert.equal(toInputDate('0001-01-01'),'0001-01-01');
});

test('todayInputDate devuelve fecha actual en formato ISO', () => {
  const value = todayInputDate();
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
});
