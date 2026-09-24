import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, normalizeIraqPhone, validatePin, verifyPin } from './index.js';

test('normalizes Iraqi mobile numbers and rejects invalid formats', () => {
  assert.equal(normalizeIraqPhone('07812345678'), '+9647812345678');
  assert.equal(normalizeIraqPhone('+9647812345678'), '+9647812345678');
  assert.equal(normalizeIraqPhone('07112345678'), '');
});

test('validates four-digit PINs and verifies PBKDF2 credentials without exposing plaintext', async () => {
  assert.equal(validatePin('1234'), true);
  assert.equal(validatePin('12345'), false);
  const credential = await hashPin('1234');
  assert.equal(credential.algorithm, 'PBKDF2-SHA256');
  assert.equal(typeof credential.salt, 'string');
  assert.equal(typeof credential.hash, 'string');
  assert.equal(await verifyPin('1234', credential), true);
  assert.equal(await verifyPin('9999', credential), false);
  assert.equal('pin' in credential, false);
});
