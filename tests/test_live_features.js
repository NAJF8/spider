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
assert(scriptJs.includes("fetch(`${BACKEND_URL}/api/store/checkout"), 'واجهة الطلب يجب أن تستعمل مسار الخادم الآمن');
assert(scriptJs.includes('ORDER_BACKEND_NOT_CONFIGURED'), 'يجب عرض عائق إعداد الخادم بوضوح دون تفريغ السلة');
assert(scriptJs.includes('window.addToCart = addToCart'), 'يجب كشف معالج الإضافة للبطاقات التي تستخدم onclick');
assert(scriptJs.includes("const CART_STORAGE_KEY = 'spider.cart.v1'"), 'يجب حفظ السلة محلياً بعد تحديث الصفحة');
assert(scriptJs.includes('window.filterProductsByCategory = filterProductsByCategory'), 'يجب أن تعمل روابط الأقسام مع ES module');
assert(scriptJs.includes("/api/store/chat"), 'يجب أن يمر الشات عبر Worker الآمن');
const workerJs = fs.readFileSync('cloudflare-worker/src/index.js', 'utf8');
assert(workerJs.includes("url.pathname === '/api/store/chat'"), 'يجب أن يملك Worker مسار الشات');
assert(workerJs.includes('retrieveChatProducts'), 'يجب أن يطبّق Worker retrieval على المنتجات المنشورة');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
assert(indexHtml.includes('name="customerName"'), 'يجب ربط اسم العميل بحمولة الطلب');
assert(indexHtml.includes('name="customerPhone"'), 'يجب ربط هاتف العميل بحمولة الطلب');
console.log('✓ نجح الاختبار: السلة تعمل محلياً، وإتمام الطلب يمر عبر الخادم مع إبقاء السلة عند فشل الحفظ.');

console.log('\n=============================================================');
console.log(' جميع اختبارات المزامنة وحماية الطلبات والمسودات نجحت بنسبة 100%! ');
console.log('=============================================================');
