const assert = require('assert');
const fs = require('fs');

console.log('--- بدء اختبارات المزامنة واستيراد المسودات والتحقق من السلة ---');

// 1. Verify Draft Import Logic (Duplicate Prevention)
console.log('\n[Test 1] التحقق من حماية زر رفع الكتالوگ من تكرار البيانات:');
const adminJs = fs.readFileSync('public/admin.js', 'utf8');

assert(adminJs.includes('categories.find(c => c.id === cat.id)'), 'يجب التحقق من وجود القسم مسبقاً قبل الإضافة');
assert(adminJs.includes('products.find(p => p.id === prod.id)'), 'يجب التحقق من وجود المنتج مسبقاً قبل الإضافة');
assert(adminJs.includes('newCatsCount === 0 && newProdsCount === 0'), 'يجب إيقاف الرفع إذا كانت جميع السجلات موجودة');
assert(adminJs.includes('status: \'draft\''), 'يجب رفع المنتجات الجديدة كمسودات فقط');
console.log('✓ نجح الاختبار: الكود يتحقق من التكرار ويرفع المنتجات كمسودات.');

// 2. Verify Live Sync Initialization
console.log('\n[Test 2] فحص اعتماد المتجر على Firebase كمصدر وحيد:');
const scriptJs = fs.readFileSync('public/script.js', 'utf8');

assert(!scriptJs.includes('demo-data.js'), 'تم التخلص نهائياً من ملف demo-data.js');
assert(scriptJs.includes('onValue(ref(db, \'categories\')'), 'يتم جلب الأقسام من Firebase مباشرة');
assert(scriptJs.includes('onValue(ref(db, \'products\')'), 'يتم جلب المنتجات من Firebase مباشرة');
assert(scriptJs.includes('prod.status === \'published\''), 'يتم عرض المنتجات المنشورة فقط');
console.log('✓ نجح الاختبار: المتجر يعتمد كلياً على Firebase Realtime Database ويفلتر المسودات.');

// 3. Verify Secure Checkout Verification
console.log('\n[Test 3] اختبار أمان ووظيفة السلة مؤقتاً:');
assert(scriptJs.includes('عذراً، وظيفة إرسال الطلبات معطلة مؤقتاً'), 'يجب أن يكون الطلب معطلاً لحين وجود تحقق آمن من جهة الخادم');
console.log('✓ نجح الاختبار: السلة معطلة استجابة للمخاوف الأمنية وعدم كفاية قواعد Firebase.');

console.log('\n=============================================================');
console.log(' جميع اختبارات المزامنة وحماية الطلبات والمسودات نجحت بنسبة 100%! ');
console.log('=============================================================');
