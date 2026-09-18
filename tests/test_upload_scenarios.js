const assert = require('assert');

// Test suite for admin image upload & verification logic
console.log('--- بدء اختبارات منطق رفع وتحقق صور المنتجات ---');

// Simulated UI State Engine
function createMockUI(initialProdImage = '/images/products/old-prod.webp') {
    return {
        prodImage: { value: initialProdImage },
        confirmUploadBtn: {
            textContent: 'رفع الصورة إلى GitHub',
            disabled: false,
            style: { backgroundColor: '' }
        },
        uploadImageBtn: { disabled: false },
        imagePreviewContainer: { style: { display: 'block' } },
        alerts: []
    };
}

// Upload handler wrapper mimicking admin.js logic exactly
async function runUploadFlow({
    ui,
    mockFetch,
    currentProcessedImageBase64 = 'UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2wAA', // 1x1 valid webp base64
    currentProcessedImageName = 'test-1.webp',
    pollingIntervalMs = 1,
    maxAttempts = 3
}) {
    let isUploadingImage = false;

    async function handleConfirmUpload() {
        if (isUploadingImage) {
            return { skippedDueToConcurrency: true };
        }
        if (!currentProcessedImageBase64) {
            ui.alerts.push('الرجاء اختيار صورة ومعاينتها أولاً قبل الرفع.');
            return { aborted: true };
        }

        isUploadingImage = true;
        const btn = ui.confirmUploadBtn;
        const prepBtn = ui.uploadImageBtn;
        const prodImageInput = ui.prodImage;
        const originalText = 'رفع الصورة إلى GitHub';
        const previousImageValue = prodImageInput ? prodImageInput.value : '';

        btn.textContent = 'جاري الرفع إلى GitHub...';
        btn.disabled = true;
        if (prepBtn) prepBtn.disabled = true;

        try {
            const idToken = 'mock-valid-id-token';
            if (!idToken) throw new Error('AUTH_REQUIRED');

            const response = await mockFetch('https://worker.test/api/admin/products/upload-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${idToken}` }
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'IMAGE_UPLOAD_FAILED');
            }

            btn.textContent = 'تم الرفع! بانتظار اكتمال النشر...';

            let attempts = 0;
            let isAvailable = false;

            while (attempts < maxAttempts) {
                attempts++;
                btn.textContent = `جاري التحقق من النشر (${attempts}/${maxAttempts})...`;
                try {
                    const verifyUrl = `${data.imageUrl}?_t=${Date.now()}`;
                    const checkRes = await mockFetch(verifyUrl, {
                        method: 'GET',
                        cache: 'no-store',
                        headers: { 'Accept': 'image/webp,image/*;q=0.8' }
                    });

                    const contentType = (checkRes.headers.get('content-type') || '').toLowerCase();

                    // Must be HTTP 200 and image/webp or image/*, never text/html rewrite!
                    if (checkRes.ok && (contentType.includes('image/webp') || contentType.startsWith('image/')) && !contentType.includes('text/html')) {
                        isAvailable = true;
                        break;
                    }
                } catch (e) {
                    // ignore network errors in polling
                }
                await new Promise(r => setTimeout(r, pollingIntervalMs));
            }

            if (!isAvailable) {
                if (prodImageInput) prodImageInput.value = previousImageValue;
                btn.textContent = 'انتهت المهلة - لم تُنشر بعد';
                btn.style.backgroundColor = '#c62828';
                ui.alerts.push('تم الرفع إلى GitHub بنجاح، ولكن انتهت مهلة الانتظار قبل اكتمال نشر الصورة على المتجر. تم الاحتفاظ بالصورة السابقة للمنتج تجنباً للروابط المكسورة.');
                return { success: false, timeout: true };
            }

            if (prodImageInput) prodImageInput.value = data.path;
            btn.textContent = 'تم توفر الصورة بنجاح!';
            btn.style.backgroundColor = '#2e7d32';
            return { success: true, path: data.path };

        } catch (error) {
            if (prodImageInput) prodImageInput.value = previousImageValue;
            ui.alerts.push(`فشل الرفع: ${error.message}`);
            btn.textContent = 'إعادة المحاولة';
            btn.style.backgroundColor = '#c62828';
            return { success: false, error: error.message };
        } finally {
            isUploadingImage = false;
            btn.disabled = false;
            if (prepBtn) prepBtn.disabled = false;
        }
    }

    return { handleConfirmUpload, getIsUploading: () => isUploadingImage };
}

// ================= TEST CASES =================

async function testScenario1_SuccessWithDelayedDeploy() {
    console.log('\n[Test 1] نجاح الرفع وتخطي ردود HTML للـ SPA Rewrite ثم قبول image/webp:');
    const ui = createMockUI('/images/products/old-image.webp');
    let pollCount = 0;

    const mockFetch = async (url) => {
        if (url.includes('/api/admin/products/upload-image')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    path: '/images/products/product-new.webp',
                    imageUrl: 'https://spider-aaa19.web.app/images/products/product-new.webp'
                })
            };
        }
        if (url.includes('/images/products/product-new.webp')) {
            pollCount++;
            // Poll 1: Returns 200 but text/html (SPA rewrite!)
            if (pollCount === 1) {
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'text/html; charset=utf-8']])
                };
            }
            // Poll 2: Returns 200 with image/webp (Deployment complete!)
            return {
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'image/webp']])
            };
        }
        throw new Error('Unknown URL: ' + url);
    };

    const flow = await runUploadFlow({ ui, mockFetch, maxAttempts: 5 });
    const result = await flow.handleConfirmUpload();

    assert.strictEqual(result.success, true, 'يجب أن ينجح بعد التأكد من نوع المحتوى image/webp');
    assert.strictEqual(ui.prodImage.value, '/images/products/product-new.webp', 'يجب تحديث مسار الصورة بعد نجاح التحقق');
    assert.strictEqual(ui.confirmUploadBtn.textContent, 'تم توفر الصورة بنجاح!', 'يجب عرض رسالة التوفر الناجح');
    assert.strictEqual(ui.confirmUploadBtn.style.backgroundColor, '#2e7d32', 'يجب تحويل الزر للأخضر');
    assert.strictEqual(pollCount, 2, 'يجب تخطي المحاولة الأولى لأنها أعادت HTML');
    console.log('✓ نجح الاختبار: تم تجاوز رد HTML Rewrite واعتمد مسار الصورة فقط عند عودة image/webp بنجاح.');
}

async function testScenario2_GitHubFailure() {
    console.log('\n[Test 2] فشل رفع GitHub عبر الخادم (500 GITHUB_UPLOAD_FAILED):');
    const oldImage = '/images/products/safe-old-image.webp';
    const ui = createMockUI(oldImage);

    const mockFetch = async (url) => {
        if (url.includes('/api/admin/products/upload-image')) {
            return {
                ok: false,
                status: 500,
                json: async () => ({ error: 'GITHUB_UPLOAD_FAILED' })
            };
        }
        throw new Error('Should not poll');
    };

    const flow = await runUploadFlow({ ui, mockFetch });
    const result = await flow.handleConfirmUpload();

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'GITHUB_UPLOAD_FAILED');
    assert.strictEqual(ui.prodImage.value, oldImage, 'يجب الاحتفاظ بالصورة القديمة دون تعديل');
    assert.strictEqual(ui.confirmUploadBtn.textContent, 'إعادة المحاولة');
    assert.strictEqual(ui.confirmUploadBtn.style.backgroundColor, '#c62828');
    assert.strictEqual(ui.confirmUploadBtn.disabled, false, 'يجب إعادة تفعيل الزر للمحاولة');
    console.log('✓ نجح الاختبار: تم الحفاظ على الصورة القديمة بالكامل وعرض حالة الخطأ وإعادة المحاولة.');
}

async function testScenario3_TimeoutPreservesOldImage() {
    console.log('\n[Test 3] تأخر النشر وانتهاء مهلة الانتظار (Timeout):');
    const oldImage = '/images/products/preserve-me.webp';
    const ui = createMockUI(oldImage);
    let pollAttempts = 0;

    const mockFetch = async (url) => {
        if (url.includes('/api/admin/products/upload-image')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    path: '/images/products/product-delayed.webp',
                    imageUrl: 'https://spider-aaa19.web.app/images/products/product-delayed.webp'
                })
            };
        }
        if (url.includes('/images/products/product-delayed.webp')) {
            pollAttempts++;
            // Keeps returning 200 with text/html or 404
            return {
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'text/html']])
            };
        }
        throw new Error('Unknown URL');
    };

    const flow = await runUploadFlow({ ui, mockFetch, maxAttempts: 3 });
    const result = await flow.handleConfirmUpload();

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.timeout, true);
    assert.strictEqual(ui.prodImage.value, oldImage, 'يجب ألا تتغير قيمة حقل الصورة عند انتهاء المهلة');
    assert.strictEqual(ui.confirmUploadBtn.textContent, 'انتهت المهلة - لم تُنشر بعد');
    assert.strictEqual(ui.confirmUploadBtn.style.backgroundColor, '#c62828');
    assert(ui.alerts.some(a => a.includes('تم الاحتفاظ بالصورة السابقة')), 'يجب تنبيه المستخدم بالاحتفاظ بالصورة السابقة');
    assert.strictEqual(pollAttempts, 3, 'يجب استنفاذ جميع محاولات التحقق');
    console.log('✓ نجح الاختبار: عند انتهاء المهلة لم يُعدّل حقل الصورة وأُبقيت الصورة السابقة ولم تظهر رسالة النجاح.');
}

async function testScenario4_PreventDuplicateClicks() {
    console.log('\n[Test 4] منع تكرار الرفع عند الضغط المتكرر (Anti-Double-Click Guard):');
    const ui = createMockUI();
    let networkCalls = 0;

    const mockFetch = async (url) => {
        if (url.includes('/api/admin/products/upload-image')) {
            networkCalls++;
            // Simulate slow network request
            await new Promise(r => setTimeout(r, 50));
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    path: '/images/products/single.webp',
                    imageUrl: 'https://spider-aaa19.web.app/images/products/single.webp'
                })
            };
        }
        return {
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'image/webp']])
        };
    };

    const flow = await runUploadFlow({ ui, mockFetch });

    // Click 1 and Click 2 fired simultaneously
    const promise1 = flow.handleConfirmUpload();
    const promise2 = flow.handleConfirmUpload();

    const [res1, res2] = await Promise.all([promise1, promise2]);

    assert.strictEqual(networkCalls, 1, 'يجب إرسال طلب شبكة واحد فقط');
    assert.strictEqual(res2.skippedDueToConcurrency, true, 'يجب رفض الضغطة الثانية فوراً');
    assert.strictEqual(res1.success, true, 'الضغطة الأولى تكتمل بنجاح');
    console.log('✓ نجح الاختبار: تم حجب الضغطة المتكررة فوراً ومنع تكرار طلب الرفع.');
}

async function runAll() {
    await testScenario1_SuccessWithDelayedDeploy();
    await testScenario2_GitHubFailure();
    await testScenario3_TimeoutPreservesOldImage();
    await testScenario4_PreventDuplicateClicks();
    console.log('\n=========================================');
    console.log(' جميع الاختبارات الأربعة نجحت بنسبة 100%! ');
    console.log('=========================================\n');
}

runAll().catch(err => {
    console.error('فشل أحد الاختبارات:', err);
    process.exit(1);
});
