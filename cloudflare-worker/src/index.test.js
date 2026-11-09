import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { publicCatalogProduct, resolveConfiguredPrice } from './index.js';

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
    assert.deepEqual(await response.json(), { success: true, accountType: 'wholesale', prices: {} });
    assertCors(response);
  } finally { globalThis.fetch = originalFetch; }
});

test('pricing resolver uses only the site percentage and rounds the final dinar once', () => {
  const product = { id: 'p1', basePrice: 123400, categoryId: 'child', pricingOverride: { percentAdjustment: 10, roundTo: 1000 } };
  const settings = { pricingConfig: { site: { percentAdjustment: 50, roundTo: 250 }, categoryOverrides: { parent: { percentAdjustment: 20, roundTo: 500 }, child: { percentAdjustment: 30, roundTo: 250 } } } };
  const resolved = resolveConfiguredPrice(product, {}, 'public', settings, { child: { parentId: 'parent' } });
  assert.equal(resolved.basePrice, 123400);
  assert.equal(resolved.price, 185100);
  assert.equal(resolved.visible, true);
});

test('pricing resolver prefers the live Admin public price over the legacy base snapshot', () => {
  const resolved = resolveConfiguredPrice({ basePrice: 220000, price: 221111, public_price: 221111 }, {}, 'public', {}, {});
  assert.equal(resolved.basePrice, 221111);
  assert.equal(resolved.price, 221111);
});

test('public catalog sanitizer never returns source price fields or hidden price values', () => {
  const hidden = publicCatalogProduct('p1', { name: 'Hidden', price: 123400, basePrice: 123400, metadata: { originalPrice: 123400, safeLabel: 'GPU' }, pricingOverride: { hidePrice: true }, status: 'published' }, {}, 'public', {}, {});
  assert.equal(hidden.priceVisible, false);
  assert.equal(Object.prototype.hasOwnProperty.call(hidden, 'customerPrice'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(hidden, 'price'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(hidden, 'basePrice'), false);
  assert.equal(JSON.stringify(hidden).includes('123400'), false);
  const visible = publicCatalogProduct('p2', { name: 'Visible', price: 123400, status: 'published' }, {}, 'public', {}, {});
  assert.equal(visible.customerPrice, 123400);
  assert.equal(Object.prototype.hasOwnProperty.call(visible, 'price'), false);
});

test('public catalog endpoint strips hidden prices and pricing policy', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/products.json')) return Response.json({ hidden: { name: 'Hidden', price: 900000, status: 'published', pricingOverride: { hidePrice: true } }, visible: { name: 'Visible', price: 100000, status: 'published' } });
    if (url.includes('/settings.json')) return Response.json({ deliveryFee: 5000, pricingConfig: { forceHideAll: true, site: { percentAdjustment: 10 } }, storeNameAr: 'Spider' });
    if (url.includes('/categories.json')) return Response.json({});
    if (url.includes('/catalogVersion.json')) return Response.json(123);
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/catalog'), baseEnv);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.products.hidden.priceVisible, false);
    assert.equal(Object.prototype.hasOwnProperty.call(body.products.hidden, 'customerPrice'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body.products.hidden, 'price'), false);
    assert.equal(body.products.visible.priceVisible, false, 'global hide must override an otherwise visible product');
    assert.equal(Object.prototype.hasOwnProperty.call(body.products.visible, 'customerPrice'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body.settings, 'pricingConfig'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('public catalog reads the pinned Production RTDB without cacheable responses', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    calls.push({ url, options });
    if (url.includes('/products.json')) return Response.json({ p1: { name: 'AMD Ryzen 5 5600X Tray', price: 221111, status: 'published' } });
    if (url.includes('/settings.json')) return Response.json({});
    if (url.includes('/categories.json')) return Response.json({});
    if (url.includes('/catalogVersion.json')) return Response.json(456);
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/catalog'), baseEnv);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.catalogVersion, 456);
    assert.equal(body.products.p1.customerPrice, 221111);
    assert.equal(response.headers.get('Cache-Control'), 'no-store, no-cache, max-age=0, must-revalidate');
    assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Catalog-Version'), '456');
    const catalogCalls = calls.filter(({ url }) => /\/(products|settings|categories|catalogVersion)\.json/.test(url));
    assert.ok(catalogCalls.length >= 4);
    catalogCalls.forEach(({ url, options }) => {
      assert.match(url, /^https:\/\/spider-aaa19-default-rtdb\.asia-southeast1\.firebasedatabase\.app\//);
      assert.deepEqual(options.cf, { cacheTtl: 0, cacheEverything: false });
      assert.equal(options.headers['Cache-Control'], 'no-cache');
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('checkout rejects a hidden or unspecified-price product instead of creating a zero-price order', async () => {
  const originalFetch = globalThis.fetch;
  let savedOrder;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.includes('/products.json')) return Response.json({ p1: { name: 'Hidden GPU', price: 123400, status: 'published', stock: 3, pricingOverride: { hidePrice: true } } });
    if (url.includes('/settings.json')) return Response.json({ deliveryFee: 5000, whatsappNumber: '9647827337942' });
    if (url.includes('/categories.json')) return Response.json({});
    if (url.includes('/private_prices.json')) return Response.json({});
    if (url.includes('/orders/') && options.method === 'PUT') { savedOrder = JSON.parse(options.body); return Response.json({ name: 'saved' }); }
    if (url.includes('/checkout_requests/')) return Response.json(null, { status: 404 });
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(request('/api/store/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'hidden-price-request-1234' }, body: JSON.stringify({ requestId: 'hidden-price-request-1234', items: [{ id: 'p1', qty: 1 }], customer: { name: 'Ali', phone: '07812345678', governorate: 'Najaf', district: 'Center', addressDetails: 'Street 1' } }) }), baseEnv);
    const result = await response.json();
    assert.equal(response.status, 400);
    assert.equal(result.error, 'PRODUCT_PRICE_UNAVAILABLE_p1');
    assert.equal(savedOrder, undefined);
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

test('GET /api/store/orders requires authentication', async () => {
  const response = await worker.fetch(request('/api/store/orders', { method: 'GET' }), baseEnv);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'AUTH_REQUIRED' });
});

test('GET /api/store/orders strictly matches verified claims and prevents IDOR', async () => {
  const originalFetch = globalThis.fetch;
  const mockOrders = {
    'order-1': { uid: 'user-alice', grandTotal: 50000, customerName: 'Alice' },
    'order-2': { uid: 'user-bob', grandTotal: 90000, customerName: 'Bob' },
    'order-3': { customerPhone: '07801112233', grandTotal: 15000, customerName: 'Guest Charlie' },
    'order-4': { customerEmail: 'david@test.com', grandTotal: 25000, customerName: 'Guest David' }
  };

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('identitytoolkit.googleapis.com')) {
      return new Response(JSON.stringify({
        users: [{
          localId: 'user-alice',
          phoneNumber: '+9647801112233',
          email: 'alice@test.com',
          emailVerified: true
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('firebasedatabase.app/orders.json')) {
      return new Response(JSON.stringify(mockOrders), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const response = await worker.fetch(request('/api/store/orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-alice-token' }
    }), baseEnv);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    const returnedIds = body.orders.map(o => o.id);
    assert.ok(returnedIds.includes('order-1'), 'Alice should see her own order');
    assert.ok(returnedIds.includes('order-3'), 'Alice should see guest order matching verified phone');
    assert.ok(!returnedIds.includes('order-2'), 'Alice must NOT see Bob order (IDOR prevented)');
    assert.ok(!returnedIds.includes('order-4'), 'Alice must NOT see David order (IDOR prevented)');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
