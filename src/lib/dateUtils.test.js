import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDisplayDate, toInputDate, todayInputDate } from './dateUtils.js';

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
  assert.equal(formatDisplayDate('31/02/2026'), '31/02/2026');
});

test('todayInputDate devuelve fecha actual en formato ISO', () => {
  const value = todayInputDate();
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
});
