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
  assert.equal(response.headers.get('X-Worker-Build'), 'spider-deepseek-v4-1-flash-2026-09-24');
}

test('chat sends the documented KIE Responses request with thinking disabled', async () => {
  const originalFetch = globalThis.fetch;
  let providerRequest;
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url === 'https://api.kie.ai/openai/v1/responses') {
      providerRequest = { url, options, body: JSON.parse(options.body) };
      return Response.json({ id: 'resp_test', model: 'deepseek-v4-1-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'إجابة DeepSeek' }] }] });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'رشح لي شاشة' }) }), baseEnv);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, 'إجابة DeepSeek');
    assert.equal(providerRequest.url, 'https://api.kie.ai/openai/v1/responses');
    assert.equal(providerRequest.options.headers.Authorization, 'Bearer test-kie-key');
    assert.equal(providerRequest.body.model, 'deepseek-v4-1-flash');
    assert.equal(providerRequest.body.stream, false);
    assert.deepEqual(providerRequest.body.thinking, { type: 'disabled' });
    assert.ok(Array.isArray(providerRequest.body.input));
    assert.equal(providerRequest.body.input.at(-1).content[0].type, 'input_text');
  } finally { globalThis.fetch = originalFetch; }
});

test('chat maps an unauthorized KIE key or model safely', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url === 'https://api.kie.ai/openai/v1/responses') return Response.json({ error: { message: 'unauthorized model or key' } }, { status: 401 });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'CHAT_PROVIDER_UNAUTHORIZED' });
  } finally { globalThis.fetch = originalFetch; }
});

test('chat extracts the documented Responses output schema', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url === 'https://api.kie.ai/openai/v1/responses') return Response.json({ output: [
      { type: 'reasoning', summary: [{ type: 'summary_text', text: 'لا يجب إرجاع هذا' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'النص الحقيقي فقط' }] }
    ] });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مواصفات' }) }), baseEnv);
    assert.equal((await response.json()).reply, 'النص الحقيقي فقط');
  } finally { globalThis.fetch = originalFetch; }
});

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

test('/api/store/prices returns authorized catalog pricing without exposing secrets', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('identitytoolkit.googleapis.com')) return Response.json({ users: [{ localId: 'uid-test' }] });
    if (url.includes('/profiles/uid-test.json')) return Response.json({ accountType: 'wholesale' });
    if (url.endsWith('/private_prices.json?auth=test-database-secret')) return Response.json({ p1: { wholesale_price: 123 } });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/prices', { headers: { Authorization: 'Bearer test-id-token' } }), baseEnv);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, accountType: 'wholesale', prices: { p1: { wholesale_price: 123 } } });
    assertCors(response);
  } finally { globalThis.fetch = originalFetch; }
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

test('chat accepts KIE text-part content without exposing provider payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return Response.json({ choices: [{ message: { content: [{ type: 'text', text: 'مرحبا من KIE' }] } }] });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'مرحبا' })
    }), baseEnv);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, 'مرحبا من KIE');
    assertCors(response);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chat accepts documented string content', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return Response.json({ choices: [{ message: { content: 'نص KIE' } }] });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, 'نص KIE');
  } finally { globalThis.fetch = originalFetch; }
});

test('chat accepts KIE response envelope with data choices', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return Response.json({ code: 200, msg: 'success', data: { choices: [{ message: { content: 'نص داخل data' } }] } });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, 'نص داخل data');
  } finally { globalThis.fetch = originalFetch; }
});

test('chat accepts nested KIE parts content', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return Response.json({ choices: [{ message: { content: [{ parts: [{ text: 'جزء أول' }, { content: 'جزء ثان' }] }] } }] });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, 'جزء أول جزء ثان');
  } finally { globalThis.fetch = originalFetch; }
});

test('chat reports provider success without usable content clearly', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return Response.json({ choices: [{ message: { content: '' } }] });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'CHAT_PROVIDER_EMPTY_CONTENT' });
  } finally { globalThis.fetch = originalFetch; }
});

test('chat maps KIE error response without exposing provider body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return Response.json({ error: { message: 'provider-safe-error' } }, { status: 500 });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'CHAT_PROVIDER_ERROR' });
  } finally { globalThis.fetch = originalFetch; }
});

test('chat reports KIE application-level rejection clearly', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return Response.json({ code: 200, msg: 'The API key is not authorized to use this model.', data: {} });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'CHAT_PROVIDER_REJECTED' });
  } finally { globalThis.fetch = originalFetch; }
});

test('chat maps malformed provider response to empty-content error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('firebasedatabase.app/products.json')) return new Response('{}', { status: 200 });
    if (url.includes('api.kie.ai')) return new Response('{not-json', { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }) }), baseEnv);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'CHAT_PROVIDER_EMPTY_CONTENT' });
  } finally { globalThis.fetch = originalFetch; }
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
