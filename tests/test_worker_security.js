const assert = require('assert');

console.log('--- بدء اختبارات حماية ومصادقة Cloudflare Worker ---');

// Mock Request & FormData for testing worker fetch handler in Node.js
class MockFile {
    constructor(buffer, name, type) {
        this.buffer = buffer;
        this.name = name;
        this.type = type;
        this.size = buffer.length;
    }
    async arrayBuffer() {
        return this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.byteLength);
    }
}

class MockFormData {
    constructor() {
        this.map = new Map();
    }
    append(key, val) {
        this.map.set(key, val);
    }
    get(key) {
        return this.map.get(key);
    }
}

// Import worker module
let worker;
try {
    worker = require('../cloudflare-worker/src/index.js').default;
} catch (e) {
    // ES module import wrapper for CommonJS test
    // Or we can import via dynamic import
}

async function runWorkerSecurityTests() {
    const workerModule = await import('../cloudflare-worker/src/index.js');
    const worker = workerModule.default;

    const env = {
        FIREBASE_API_KEY: 'mock-key',
        ADMIN_UID: 'e8uTdYi5TQOsrztxPnlD7X4GKAx1',
        GITHUB_TOKEN: 'ghp_mock_token'
    };

    // Test 1: Missing Token
    console.log('\n[Worker Test 1] رفض الطلب عند غياب Authorization Token:');
    const req1 = {
        method: 'POST',
        url: 'https://worker.test/api/admin/products/upload-image',
        headers: new Map()
    };
    const res1 = await worker.fetch(req1, env);
    const body1 = await res1.json();
    assert.strictEqual(res1.status, 401);
    assert.strictEqual(body1.error, 'AUTH_REQUIRED');
    console.log('✓ نجح الاختبار: أعاد 401 AUTH_REQUIRED');

    // Test 2: Invalid Token from Identity Toolkit
    console.log('\n[Worker Test 2] رفض الرمز غير الصالح أو منتهي الصلاحية:');
    // Mock global fetch for identity toolkit call
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
        if (url.includes('identitytoolkit.googleapis.com')) {
            return {
                ok: false,
                status: 400,
                json: async () => ({ error: { message: 'INVALID_ID_TOKEN' } })
            };
        }
        return originalFetch(url, opts);
    };

    const req2 = {
        method: 'POST',
        url: 'https://worker.test/api/admin/products/upload-image',
        headers: new Map([['Authorization', 'Bearer invalid-token']])
    };
    const res2 = await worker.fetch(req2, env);
    const body2 = await res2.json();
    assert.strictEqual(res2.status, 401);
    assert.strictEqual(body2.error, 'AUTH_INVALID');
    console.log('✓ نجح الاختبار: أعاد 401 AUTH_INVALID');

    // Test 3: Non-Admin User Token (Forbidden)
    console.log('\n[Worker Test 3] رفض مستخدم مسجل ولكن ليس أدمن SPIDER:');
    global.fetch = async (url, opts) => {
        if (url.includes('identitytoolkit.googleapis.com')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    users: [{ localId: 'unauthorized-user-uid-999', email: 'normal@user.com' }]
                })
            };
        }
        return originalFetch(url, opts);
    };

    const req3 = {
        method: 'POST',
        url: 'https://worker.test/api/admin/products/upload-image',
        headers: new Map([['Authorization', 'Bearer normal-user-token']])
    };
    const res3 = await worker.fetch(req3, env);
    const body3 = await res3.json();
    assert.strictEqual(res3.status, 403);
    assert.strictEqual(body3.error, 'FORBIDDEN');
    console.log('✓ نجح الاختبار: أعاد 403 FORBIDDEN لمنع المستخدم غير المخول');

    // Test 4: Unsupported Image / Fake Magic Bytes
    console.log('\n[Worker Test 4] رفض ملف غير صالح أو خبيث (Fake Magic Bytes):');
    global.fetch = async (url, opts) => {
        if (url.includes('identitytoolkit.googleapis.com')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    users: [{ localId: env.ADMIN_UID }]
                })
            };
        }
        return originalFetch(url, opts);
    };

    const badFormData = new MockFormData();
    // Plain text content disguised as webp
    badFormData.append('image', new MockFile(Buffer.from('MALICIOUS_SCRIPT_CONTENT'), 'script.webp', 'image/webp'));
    badFormData.append('filename', 'test.webp');

    const req4 = {
        method: 'POST',
        url: 'https://worker.test/api/admin/products/upload-image',
        headers: new Map([['Authorization', 'Bearer admin-token']]),
        formData: async () => badFormData
    };

    const res4 = await worker.fetch(req4, env);
    const body4 = await res4.json();
    assert.strictEqual(res4.status, 400);
    assert.strictEqual(body4.error, 'IMAGE_TYPE_UNSUPPORTED');
    console.log('✓ نجح الاختبار: تم كشف الملف غير المطابق للبنية (Magic Bytes) ورفضه بـ 400 IMAGE_TYPE_UNSUPPORTED');

    // Restore fetch
    global.fetch = originalFetch;

    console.log('\n=============================================');
    console.log(' جميع اختبارات أمان الخادم الخلفي نجحت 100%! ');
    console.log('=============================================\n');
}

runWorkerSecurityTests().catch(err => {
    console.error('فشل في اختبارات Worker:', err);
    process.exit(1);
});
