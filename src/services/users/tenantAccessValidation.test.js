import assert from 'node:assert/strict';
import test from 'node:test';
import {
  invitationAccountSchema,
  invitationInputSchema,
  invitationTokenSchema,
  roleUpdateSchema
} from './tenantAccessValidation.js';

test('an invitation accepts multiple valid tenant roles', () => {
  const result = invitationInputSchema.safeParse({
    fullName: 'Persona de Prueba',
    email: 'admin@example.local',
    roles: ['administration', 'treasury']
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.roles, ['administration', 'treasury']);
});

test('an invitation rejects unknown roles and invalid emails', () => {
  const result = invitationInputSchema.safeParse({
    fullName: 'A',
    email: 'not-an-email',
    roles: ['owner']
  });

  assert.equal(result.success, false);
});

test('role updates cannot leave an account without roles', () => {
  assert.equal(roleUpdateSchema.safeParse([]).success, false);
});

test('invitation tokens must be 64 hexadecimal characters', () => {
  assert.equal(invitationTokenSchema.safeParse('a'.repeat(64)).success, true);
  assert.equal(invitationTokenSchema.safeParse('short-token').success, false);
});

test('new invitation accounts require a strong minimum password length', () => {
  assert.equal(invitationAccountSchema.safeParse({
    email: 'family@example.local',
    password: 'short'
  }).success, false);
});

