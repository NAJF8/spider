import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  createGoogleOAuthAssertion,
  getFirebaseDatabaseAccessToken,
  hashPin,
  normalizeIraqPhone,
  parseServiceAccount,
  validatePin,
  verifyPin,
  writeServiceDatabase
} from './index.js';

const rsaKeyPair = await webcrypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify']
);
const pkcs8 = new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', rsaKeyPair.privateKey));
const pemBody = Buffer.from(pkcs8).toString('base64').replace(/(.{64})/g, '$1\n');
const account = { project_id: 'spider-test', client_email: 'svc@spider-test.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\\n${pemBody}\\n-----END PRIVATE KEY-----` };
const env = { FIREBASE_PROJECT_ID: 'spider-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account) };

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
  assert.equal(credential.iterations, 100000);
  assert.equal(typeof credential.salt, 'string');
  assert.equal(typeof credential.hash, 'string');
  assert.equal(await verifyPin('1234', credential), true);
  assert.equal(await verifyPin('9999', credential), false);
  assert.equal('pin' in credential, false);
});

test('parses service account JSON and handles escaped private-key newlines', () => {
  const parsed = parseServiceAccount(JSON.stringify(account));
  assert.equal(parsed.client_email, account.client_email);
  assert.equal(parsed.private_key.includes('\\n'), true);
  assert.equal(parseServiceAccount('{bad json'), null);
});

test('creates a verifiable Google OAuth2 JWT with the required claims', async () => {
  const assertion = await createGoogleOAuthAssertion(account, 1700000000);
  const [encodedHeader, encodedPayload, encodedSignature] = assertion.split('.');
  const decode = (value) => JSON.parse(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const header = decode(encodedHeader);
  const payload = decode(encodedPayload);
  const publicKey = await webcrypto.subtle.exportKey('spki', rsaKeyPair.publicKey);
  const importedPublicKey = await webcrypto.subtle.importKey('spki', publicKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  assert.deepEqual(header, { alg: 'RS256', typ: 'JWT' });
  assert.equal(payload.iss, account.client_email);
  assert.equal(payload.aud, 'https://oauth2.googleapis.com/token');
  assert.match(payload.scope, /firebase\.database/);
  assert.match(payload.scope, /userinfo\.email/);
  assert.equal(payload.iat, 1700000000);
  assert.equal(payload.exp, 1700003600);
  assert.equal(await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5', importedPublicKey, Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'), new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)), true);
});

test('requests and caches the Firebase database OAuth2 token', async () => {
  const originalFetch = globalThis.fetch;
  let tokenRequests = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    tokenRequests += 1;
    const params = new URLSearchParams(options.body);
    assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    assert.ok(params.get('assertion'));
    return Response.json({ access_token: 'test-access-token', expires_in: 3600 });
  };
  try {
    assert.equal(await getFirebaseDatabaseAccessToken(env), 'test-access-token');
    assert.equal(await getFirebaseDatabaseAccessToken(env), 'test-access-token');
    assert.equal(tokenRequests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses Bearer authorization for successful RTDB writes without a legacy secret', async () => {
  const originalFetch = globalThis.fetch;
  let databaseRequest;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'write-token', expires_in: 3600 });
    databaseRequest = { url, options };
    return Response.json({ ok: true });
  };
  try {
    await writeServiceDatabase({ ...env, FIREBASE_DATABASE_SECRET: undefined }, '', { phone_index: { test: 'uid' } }, 'PATCH');
    assert.equal(databaseRequest.options.headers.get('Authorization'), 'Bearer test-access-token');
    assert.equal(databaseRequest.url.includes('?auth='), false);
    assert.match(databaseRequest.url, /default-rtdb\.asia-southeast1\.firebasedatabase\.app\/\.json$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('maps an RTDB denied write to AUTH_DATABASE_ERROR without exposing credentials', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'denied-token', expires_in: 3600 });
    return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await assert.rejects(() => writeServiceDatabase({ ...env, FIREBASE_DATABASE_SECRET: undefined }, 'profiles/test', { uid: 'test' }), { message: 'AUTH_DATABASE_ERROR' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
