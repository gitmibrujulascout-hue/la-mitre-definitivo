import test from 'node:test';
import assert from 'node:assert/strict';
import { extractionSchema } from './extractionSchema.js';

test('normalizes nested extraction schemas without changing the caller', () => {
  const source = { type: 'object', properties: { personas: { type: 'array', items: { type: 'object', properties: { nombre: { type: 'string' } } } } } };
  const result = extractionSchema(source);
  assert.equal(result.additionalProperties, false);
  assert.deepEqual(result.required, ['personas']);
  assert.equal(result.properties.personas.items.additionalProperties, false);
  assert.deepEqual(result.properties.personas.items.required, ['nombre']);
  assert.equal(source.additionalProperties, undefined);
  assert.deepEqual(result.properties.personas.items.properties.nombre, { type: 'string' });
});

test('absent schema stays optional and valid schemas remain stable', () => {
  assert.equal(extractionSchema(undefined), undefined);
  const schema = { type: 'object', properties: {}, required: [], additionalProperties: false };
  assert.deepEqual(extractionSchema(schema), schema);
});
