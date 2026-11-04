const assert = require('assert');
const fs = require('fs');

const adminHtml = fs.readFileSync('public/admin.html', 'utf8');
const adminJs = fs.readFileSync('public/admin.js', 'utf8');
const scriptJs = fs.readFileSync('public/script.js', 'utf8');

assert(adminHtml.includes('pricing-management-table'), 'إدارة الأسعار يجب أن تستخدم جدول inline واضحاً');
assert(adminHtml.includes('سعر الجملة') && adminHtml.includes('السعر الخاص'), 'يجب عرض حقول الجملة والخاص في الجدول');
assert(adminJs.includes('data-pricing-field="public"'), 'يجب أن يحتوي كل صف على حقل السعر العام');
assert(adminJs.includes('data-pricing-field="wholesale"'), 'يجب أن يحتوي كل صف على حقل الجملة');
assert(adminJs.includes('data-pricing-field="special"'), 'يجب أن يحتوي كل صف على حقل الخاص');
assert(adminJs.includes('catalogVersion: now'), 'حفظ السعر يجب أن يطلق إصدار كتالوج جديداً');
assert(adminJs.includes('pricingSaveInFlight'), 'يجب منع طلبات الحفظ المتزامنة للصف نفسه');
assert(adminJs.includes('capturePricingDrafts'), 'يجب حفظ قيم الصف غير المحفوظة عند وصول تحديث خارجي');
assert(scriptJs.includes('loadPublicCatalog({ force: true })'), 'مستمع catalogVersion يجب أن يعيد جلب السعر الجديد');
assert(scriptJs.includes('info.price > 0'), 'المنتجات بلا سعر لا تدخل في نطاق السعر');
assert(scriptJs.includes('return { min, max: max > min ? max : min + 1 }'), 'نطاق السعر يجب أن يعتمد على القيم الفعلية');

console.log('✅ PASS: Inline price management, live catalog invalidation and actual price bounds are wired.');
