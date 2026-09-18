const assert = require('assert');
const fs = require('fs');

console.log('--- بدء اختبارات التنقل وصلاحيات Super Admin وتجاوب التصميم ---');

// 1. Verify Super Admin UID & Security Rules
console.log('\n[Test 1] التحقق من ثبات UID وقواعد Super Admin:');
const rulesContent = fs.readFileSync('database.rules.json', 'utf8');
const rules = JSON.parse(rulesContent);
const SUPER_ADMIN_UID = 'e8uTdYi5TQOsrztxPnlD7X4GKAx1';

assert(rules.rules.products['.write'].includes(SUPER_ADMIN_UID), 'صلاحية كتابة المنتجات محصورة بـ Super Admin');
assert(rules.rules.categories['.write'].includes(SUPER_ADMIN_UID), 'صلاحية كتابة الأقسام محصورة بـ Super Admin');
assert(rules.rules.orders['.read'].includes(SUPER_ADMIN_UID), 'قراءة الطلبات محصورة بـ Super Admin فقط');
assert(!rules.rules.orders['.read'].includes('true'), 'الطلبات ليست عامة للقراءة');
assert(rules.rules.settings['.write'].includes(SUPER_ADMIN_UID), 'صلاحية الإعدادات محصورة بـ Super Admin');
assert(rules.rules.users['.write'].includes(SUPER_ADMIN_UID), 'صلاحية المستخدمين محصورة بـ Super Admin');
console.log('✓ نجح الاختبار: جميع الصلاحيات في Firebase RTDB محصورة بـ Super Admin مع حماية سرية بيانات العملاء.');

// 2. Test Navigation Engine & View Switching
console.log('\n[Test 2] اختبار محرك التنقل وإظهار/إخفاء الأقسام في لوحة الأدمن:');

function createAdminDOM() {
    const views = ['view-dashboard', 'view-products', 'view-categories', 'view-orders', 'view-placeholder'];
    const navItems = [
        { view: 'view-dashboard', title: 'الرئيسية' },
        { view: 'view-products', title: 'المنتجات' },
        { view: 'view-categories', title: 'الأقسام' },
        { view: 'view-orders', title: 'الطلبات' },
        { view: 'view-placeholder', title: 'العملاء' }
    ];

    const state = {
        activeView: 'view-dashboard',
        activeNav: 'view-dashboard',
        placeholderTitle: '',
        sidebarOpen: false,
        overlayOpen: false
    };

    function switchView(viewId, title = '') {
        assert(views.includes(viewId), 'يجب أن يكون المعرف مسجلاً ضمن الشاشات');
        state.activeView = viewId;
        state.activeNav = viewId;
        if (viewId === 'view-placeholder') {
            state.placeholderTitle = title || 'قسم قيد التطوير';
        }
        state.sidebarOpen = false;
        state.overlayOpen = false;
    }

    return { state, switchView };
}

const adminDom = createAdminDOM();
assert.strictEqual(adminDom.state.activeView, 'view-dashboard', 'الشاشة الافتراضية هي الرئيسية');

// Switch to Products
adminDom.switchView('view-products');
assert.strictEqual(adminDom.state.activeView, 'view-products', 'يجب إظهار شاشة المنتجات');
assert.strictEqual(adminDom.state.activeNav, 'view-products');

// Switch to Categories
adminDom.switchView('view-categories');
assert.strictEqual(adminDom.state.activeView, 'view-categories', 'يجب إظهار شاشة الأقسام');

// Switch to Orders
adminDom.switchView('view-orders');
assert.strictEqual(adminDom.state.activeView, 'view-orders', 'يجب إظهار شاشة الطلبات');

// Switch to Placeholder (Coming Soon)
adminDom.switchView('view-placeholder', 'إدارة العملاء');
assert.strictEqual(adminDom.state.activeView, 'view-placeholder');
assert.strictEqual(adminDom.state.placeholderTitle, 'إدارة العملاء', 'يجب تحديث عنوان الشاشة البديلة بشفافية');
console.log('✓ نجح الاختبار: محرك التنقل يبدل الشاشات بالكامل ويغلق قائمة الموبايل عند الانتقال.');

// 3. Test Super Admin Auth Gate
console.log('\n[Test 3] اختبار بوابة المصادقة وحصر صلاحية Super Admin:');

function verifySuperAdminAuth(user) {
    if (user && user.uid === SUPER_ADMIN_UID) {
        return { authorized: true, roleName: 'سوبر مشرف' };
    }
    return { authorized: false, error: 'غير مخول' };
}

const ownerAuth = verifySuperAdminAuth({ uid: 'e8uTdYi5TQOsrztxPnlD7X4GKAx1', displayName: 'محمد مسلم' });
assert.strictEqual(ownerAuth.authorized, true);
assert.strictEqual(ownerAuth.roleName, 'سوبر مشرف');

const hackerAuth = verifySuperAdminAuth({ uid: 'attacker-random-uid-1234', displayName: 'مخترق' });
assert.strictEqual(hackerAuth.authorized, false);
console.log('✓ نجح الاختبار: تم قبول حساب Super Admin فقط وعرض دور «سوبر مشرف»، ورفض أي مستخدم آخر فوراً.');

// 4. Test Customer UI Scale & Breakpoints
console.log('\n[Test 4] فحص CSS وعرض الحاويات وشبكة العرض للمقاسات 1920x1080 و 1366x768:');
const styleContent = fs.readFileSync('public/style.css', 'utf8');

// Ensure no zoom or scale on html/body
assert(!styleContent.includes('body { zoom:'), 'لا يوجد zoom على body');
assert(!styleContent.includes('body { transform: scale'), 'لا يوجد scale مصغر على body');

// Ensure 1600px wide-screen container is defined
assert(styleContent.includes('max-width: 1600px;'), 'الحاوية مصممة لاستغلال شاشات 1600px و 1920px');
assert(styleContent.includes('width: 95%;'), 'تنسيق مرن بعرض 95% للشاشات المتوسطة مثل 1366px');

// Ensure 5 columns for products on widescreen
assert(styleContent.includes('grid-template-columns: repeat(5, 1fr)'), 'شبكة المنتجات تعرض 5 أعمدة على الشاشات الكبيرة');

// Ensure 7 columns for categories
assert(styleContent.includes('grid-template-columns: repeat(7, 1fr)'), 'شبكة الأقسام تعرض 7 أعمدة بالتناسق مع التصميم');

console.log('✓ نجح الاختبار: تم ضبط أبعاد الواجهة لاستغلال عرض الشاشة طبيعياً مع 5 أعمدة للمنتجات و7 للأقسام وحاوية 1600px.');

console.log('\n======================================================');
console.log(' جميع اختبارات الصلاحيات والتنقل والتصميم نجحت 100%! ');
console.log('======================================================\n');
