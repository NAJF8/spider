import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';

const allowedOrigin = 'https://spider-aaa19.web.app';
const disallowedOrigin = 'https://example.com';
const baseEnv = {
  FIREBASE_API_KEY: 'test-api-key',
  FIREBASE_PROJECT_ID: 'spider-aaa19',
  FIREBASE_DATABASE_SECRET: 'test-database-secret',
  KIE_API_KEY: 'test-kie-key'
};

function request(path, options = {}) {
  return new Request(`https://worker.test${path}`, {
    ...options,
    headers: { Origin: allowedOrigin, ...(options.headers || {}) }
  });
}

function assertCors(response, origin = allowedOrigin) {
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization, X-Request-Id');
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.match(response.headers.get('X-Worker-Build') || '', /^spider-store-cors-/);
}

test('allowed OPTIONS preflight does not execute API logic', async () => {
  const response = await worker.fetch(request('/api/store/chat', {
    method: 'OPTIONS',
    headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
  }), baseEnv);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assertCors(response);
});

test('disallowed OPTIONS is rejected without API execution', async () => {
  const response = await worker.fetch(new Request('https://worker.test/api/store/chat', {
    method: 'OPTIONS',
    headers: { Origin: disallowedOrigin, 'Access-Control-Request-Method': 'POST' }
  }), baseEnv);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Vary'), 'Origin');
});

test('chat missing API key returns CORS-bearing error', async () => {
  const response = await worker.fetch(request('/api/store/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'مرحبا' })
  }), { ...baseEnv, KIE_API_KEY: '' });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'CHAT_BACKEND_NOT_CONFIGURED' });
  assertCors(response);
});

test('prices missing authorization returns CORS-bearing 401', async () => {
  const response = await worker.fetch(request('/api/store/prices'), baseEnv);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'AUTH_REQUIRED' });
  assertCors(response);
});

test('chat provider/server failure retains CORS headers and hides secrets', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return new Response('provider failed', { status: 500 });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'مرحبا' })
    }), baseEnv);
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.equal(body, JSON.stringify({ error: 'CHAT_PROVIDER_ERROR' }));
    assert.ok(!body.includes('test-kie-key'));
    assertCors(response);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('all requested production origins are allowlisted', async () => {
  for (const origin of [
    'https://spider-aaa19.web.app',
    'https://spider-aaa19.firebaseapp.com',
    'https://spidernajaf.com',
    'https://www.spidernajaf.com'
  ]) {
    const response = await worker.fetch(new Request('https://worker.test/api/store/prices', { headers: { Origin: origin } }), baseEnv);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Vary'), 'Origin');
  }
});
