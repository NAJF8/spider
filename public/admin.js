import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_ORDERS } from "./demo-data.js";
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from './catalog-seed.js';

const firebaseConfig = {
    apiKey: "AIzaSyA3_h6cWLhOx3nBgH2mGBAUpVaGpqQOxz0",
    authDomain: "spider-aaa19.firebaseapp.com",
    databaseURL: "https://spider-aaa19-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "spider-aaa19",
    storageBucket: "spider-aaa19.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// Strict Super Admin Configuration
const SUPER_ADMIN_UID = 'e8uTdYi5TQOsrztxPnlD7X4GKAx1';
const SPIDER_BACKEND_ENDPOINT = 'https://spider-backend.coffee101.workers.dev';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const adminScreen = document.getElementById('admin-screen');
const loginBtn = document.getElementById('login-google-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorMsg = document.getElementById('login-error');
const adminName = document.getElementById('adminName');
const adminRole = document.getElementById('adminRole');
const adminAvatar = document.getElementById('adminAvatar');
const googleLoginDefaultLabel = loginBtn?.innerHTML || 'تسجيل الدخول باستخدام Google';
let googleLoginInProgress = false;

// Global Data State
let orders = [];
let products = [];
let categories = [];
let activeOrderTab = 'all';
let isDemoMode = false;
let currentProcessedImageBase64 = null;
let currentProcessedImageName = null;
let productImageItems = [];
let activeProductImageId = null;
let originalCategoryImageFile = null;
let categoryImageObjectUrl = null;
let activeProductImageUpload = null;
let isUploadingImage = false;
let salesChart = null;
let categoriesChart = null;
let currentAdminUser = null;
let customers = [];
let privatePricesByProduct = {};
let pendingPricingIdentities = {};
let englishDescriptionManuallyEdited = false;
let descriptionTranslationTimer = null;
const specificationTranslationTimers = new WeakMap();
let adminModalDepth = 0;
let adminModalScrollY = 0;
const productDescriptionParts = (value) => {
    if (value && typeof value === 'object') return { ar: String(value.ar || ''), en: String(value.en || '') };
    return { ar: String(value || ''), en: '' };
};

function setAdminModalOpen(element, open) {
    if (!element) return;
    const wasOpen = element.classList.contains('open');
    if (open) {
        if (wasOpen) return;
        if (adminModalDepth === 0) {
            adminModalScrollY = window.scrollY;
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.documentElement.style.setProperty('--admin-scrollbar-width', `${scrollbarWidth}px`);
            document.body.classList.add('admin-modal-open');
        }
        adminModalDepth += 1;
        element.classList.add('open');
        return;
    }
    if (!wasOpen) return;
    element.classList.remove('open');
    adminModalDepth = Math.max(0, adminModalDepth - 1);
    if (adminModalDepth === 0) {
        const restoreY = adminModalScrollY;
        document.body.classList.remove('admin-modal-open');
        document.documentElement.style.removeProperty('--admin-scrollbar-width');
        window.scrollTo({ left: 0, top: restoreY, behavior: 'auto' });
    }
}

// ================= AUTHENTICATION =================
window.currentAdminPermissions = {};
window.currentAdminData = null;
window.isSuperAdmin = false;

function isAdminActive(admin) {
    if (!admin) return false;
    if (admin.status === 'disabled') return false;
    if (admin.active === false) return false;
    if (admin.enabled === false) return false;

    return (
      admin.status === 'active' ||
      admin.active === true ||
      admin.enabled === true
    );
}

function getAdminDisplayName(user, adminData) {
    if (adminData?.name?.trim()) return adminData.name.trim();
    if (user?.displayName?.trim()) return user.displayName.trim();
    if (user?.email) return user.email.split('@')[0];
    return 'المستخدم';
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentAdminUser = user;
        let isAuthorized = false;
        let role = '';
        let roleIcon = '';
        let currentAdminData = null;

        if (user.uid === SUPER_ADMIN_UID) {
            isAuthorized = true;
            window.isSuperAdmin = true;
            role = 'سوبر مشرف';
            roleIcon = '<i class="fa-solid fa-crown"></i>';
            window.currentAdminPermissions = { _super: true };
            currentAdminData = { name: 'محمد مسلم' };
        } else {
            window.isSuperAdmin = false;
            try {
                // Check admins
                const adminRef = ref(db, `admins/${user.uid}`);
                let adminSnap = await get(adminRef);

                if (!adminSnap.exists() || !isAdminActive(adminSnap.val())) {
                    // Check pending admins securely on the server
                    if (user.email) {
                        try {
                            const token = await user.getIdToken();
                            const claimRes = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/claim-pending`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                }
                            });

                            if (claimRes.ok) {
                                const claimData = await claimRes.json();
                                if (claimData.linked || claimData.alreadyAdmin) {
                                    adminSnap = await get(adminRef); // Re-read
                                }
                            }
                        } catch (err) {
                            console.error("Error claiming pending admin", err);
                        }
                    }
                }

                if (adminSnap.exists() && isAdminActive(adminSnap.val())) {
                    currentAdminData = adminSnap.val();
                    isAuthorized = true;
                    role = currentAdminData.role || 'مشرف';
                    roleIcon = '<i class="fa-solid fa-shield-halved"></i>';
                    window.currentAdminPermissions = currentAdminData.permissions || {};
                }
            } catch (e) {
                console.error("Auth check failed", e);
            }
        }

        if (isAuthorized) {
            window.currentAdminData = currentAdminData;
            isDemoMode = false;
            const banner = document.getElementById('adminDemoBanner');
            if (banner) banner.style.display = 'none';

            loginScreen.classList.add('hidden');
            adminScreen.classList.remove('hidden');
            errorMsg.classList.add('hidden');

            const displayName = getAdminDisplayName(user, currentAdminData);
            adminName.textContent = displayName;
            const greetingName = document.getElementById('dashboardGreetingName');
            if (greetingName) greetingName.textContent = displayName;

            adminRole.innerHTML = `${roleIcon} ${role}`;
            if (user.photoURL) adminAvatar.src = user.photoURL;

            loadDashboardData();
            if(window.initManagersModule) window.initManagersModule();
        } else {
            signOut(auth);
            loginScreen.classList.remove('hidden');
            adminScreen.classList.add('hidden');
            errorMsg.textContent = 'عذراً، هذا الحساب غير مخول بالدخول للوحة التحكم.';
            errorMsg.classList.remove('hidden');
        }
    } else {
        currentAdminUser = null;
        window.currentAdminData = null;
        window.isSuperAdmin = false;
        window.currentAdminPermissions = {};
        if (!isDemoMode) {
            loginScreen.classList.remove('hidden');
            adminScreen.classList.add('hidden');
        }
    }
});

loginBtn.addEventListener('click', async () => {
    if (googleLoginInProgress) return;

    googleLoginInProgress = true;
    loginBtn.disabled = true;
    loginBtn.textContent = 'جارٍ تسجيل الدخول...';
    errorMsg.classList.add('hidden');

    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        const errorMessages = {
            'auth/cancelled-popup-request': 'تم إلغاء محاولة تسجيل الدخول السابقة، حاول مرة أخرى.',
            'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول.',
            'auth/popup-blocked': 'المتصفح منع نافذة تسجيل الدخول، اسمح بالنوافذ المنبثقة لهذا الموقع.'
        };
        errorMsg.textContent = errorMessages[error?.code] || 'فشل تسجيل الدخول: ' + (error?.message || 'خطأ غير معروف');
        errorMsg.classList.remove('hidden');
    } finally {
        googleLoginInProgress = false;
        loginBtn.disabled = false;
        loginBtn.innerHTML = googleLoginDefaultLabel;
    }
});

logoutBtn.addEventListener('click', () => {
    if (isDemoMode) {
        isDemoMode = false;
        adminScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        const banner = document.getElementById('adminDemoBanner');
        if (banner) banner.style.display = 'none';
    } else {
        signOut(auth);
    }
});

// Demo Mode Preview Handlers
document.getElementById('demo-preview-btn')?.addEventListener('click', () => {
    isDemoMode = true;
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    errorMsg.classList.add('hidden');

    const banner = document.getElementById('adminDemoBanner');
    if (banner) banner.style.display = 'flex';

    adminName.textContent = 'محمد مسلم (معاينة تجريبية)';
    const greetingName = document.getElementById('dashboardGreetingName');
    if (greetingName) greetingName.textContent = 'محمد مسلم';
    adminRole.innerHTML = '<i class="fa-solid fa-crown"></i> سوبر مشرف <span style="font-size:0.75rem;opacity:0.85;">(وضع المعاينة)</span>';

    categories = JSON.parse(JSON.stringify(DEMO_CATEGORIES));
    products = JSON.parse(JSON.stringify(DEMO_PRODUCTS));
    orders = JSON.parse(JSON.stringify(DEMO_ORDERS));

    updateAllDashboardViews();
});

document.getElementById('adminExitDemoBtn')?.addEventListener('click', () => {
    isDemoMode = false;
    adminScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    const banner = document.getElementById('adminDemoBanner');
    if (banner) banner.style.display = 'none';
});

// ================= NAVIGATION & VIEW SWITCHER =================
window.switchView = function(viewId, title = '') {
    // Deactivate all views
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-links .nav-item').forEach(link => link.classList.remove('active'));

    // Activate requested view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Activate corresponding nav item
    const activeLink = document.querySelector(`.nav-links a[data-view="${viewId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Handle placeholder titles
    if (viewId === 'view-placeholder') {
        const pTitle = document.getElementById('placeholderTitle');
        if (pTitle) pTitle.textContent = title || 'قسم قيد التطوير';
    }

    // Close mobile drawer
    closeMobileSidebar();
};

function closeMobileSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function openMobileSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
}

// Event Delegation for Navigation clicks (handles inner icons/spans)
document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem) {
        e.preventDefault();
        const viewId = navItem.getAttribute('data-view');
        const title = navItem.getAttribute('data-title');
        if (viewId) {
            window.switchView(viewId, title);
        }
    }
});

// Mobile Sidebar toggle buttons
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', openMobileSidebar);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

// ================= UTILITIES =================
function formatPrice(price) {
    if (!price || isNaN(price)) return '0 د.ع';
    return Number(price).toLocaleString('ar-IQ') + ' د.ع';
}

function formatDate(timestamp) {
    if (!timestamp) return 'غير محدد';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-IQ', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCategoryName(categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : 'عام';
}

// Unified function to update all UI views & metrics
function updateAllDashboardViews() {
    // 1. Categories metrics
    const navCategories = document.getElementById('navCategoriesCount');
    const statCategories = document.getElementById('statCategoriesSummary');
    if (navCategories) navCategories.textContent = categories.length;
    if (statCategories) statCategories.textContent = `${categories.length} أقسام`;

    // 2. Products metrics
    const statProducts = document.getElementById('statProducts');
    const navProducts = document.getElementById('navProductsCount');
    if (statProducts) statProducts.textContent = products.length;
    if (navProducts) navProducts.textContent = products.length;

    // 3. Orders metrics
    let totalSales = 0;
    let uniqueCustomers = new Set();
    orders.forEach(order => {
        if (order.status === 'completed' || order.status === 'مكتمل') {
            totalSales += (order.grandTotal || 0);
        }
        if (order.customerPhone) uniqueCustomers.add(order.customerPhone);
    });

    const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'جديد').length;
    const completedCount = orders.filter(o => o.status === 'completed' || o.status === 'مكتمل').length;
    const cancelledCount = orders.filter(o => o.status === 'cancelled' || o.status === 'ملغي').length;

    const elStatOrders = document.getElementById('statOrders');
    const elOrdersBadge = document.getElementById('ordersBadge');
    const elStatSales = document.getElementById('statSales');
    const elStatCustomers = document.getElementById('statCustomers');
    const elCountAll = document.getElementById('countOrdersAll');
    const elCountPending = document.getElementById('countOrdersPending');
    const elCountCompleted = document.getElementById('countOrdersCompleted');
    const elCountCancelled = document.getElementById('countOrdersCancelled');

    if (elStatOrders) elStatOrders.textContent = orders.length;
    if (elOrdersBadge) elOrdersBadge.textContent = pendingCount;
    if (elStatSales) elStatSales.textContent = formatPrice(totalSales);
    if (elStatCustomers) elStatCustomers.textContent = uniqueCustomers.size;
    if (elCountAll) elCountAll.textContent = orders.length;
    if (elCountPending) elCountPending.textContent = pendingCount;
    if (elCountCompleted) elCountCompleted.textContent = completedCount;
    if (elCountCancelled) elCountCancelled.textContent = cancelledCount;

    updateCategorySelects();
    renderRecentOrders();
    renderTopProducts();
    renderDashboardCharts();
    renderCategoryDistribution();
    renderProductsManagementTable();
    renderPricingManagementTable();
    renderBuilderSectionsSettings();
    renderPricingCustomers();
    renderCategoriesManagementTable();
    renderOrdersManagementTable();
    renderBrandLogoOptions();
}

// ================= REALTIME FIREBASE LISTENERS =================
function loadDashboardData() {
    // 1. Categories
    onValue(ref(db, 'categories'), (snapshot) => {
        if (isDemoMode) return;
        categories = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                categories.push({ id: child.key, ...child.val() });
            });
        }
        updateAllDashboardViews();
    });

    // 2. Products
    onValue(ref(db, 'products'), (snapshot) => {
        if (isDemoMode) return;
        products = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                products.push({ id: child.key, ...child.val() });
            });
        }
        updateAllDashboardViews();
    });

    // 3. Orders
    onValue(ref(db, 'orders'), (snapshot) => {
        if (isDemoMode) return;
        orders = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                orders.push({ id: child.key, ...child.val() });
            });
        }
        orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        updateAllDashboardViews();
    });

    onValue(ref(db, 'profiles'), (snapshot) => {
        if (isDemoMode) return;
        customers = [];
        if (snapshot.exists()) { snapshot.forEach((child) => { customers.push({ uid: child.key, ...child.val() }); }); }
        renderCustomers();
    });

    onValue(ref(db, 'private_prices'), (snapshot) => {
        if (isDemoMode) return;
        privatePricesByProduct = snapshot.exists() ? snapshot.val() || {} : {};
        renderPricingManagementTable();
    });
    onValue(ref(db, 'pricing_identities'), (snapshot) => {
        if (isDemoMode) return;
        pendingPricingIdentities = snapshot.exists() ? snapshot.val() || {} : {};
        renderPricingCustomers();
    });
}

function customerDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ar-IQ') : 'غير متوفر';
}

function renderCustomers() {
    const body = document.getElementById('customersTableBody');
    if (!body) return;
    const query = String(document.getElementById('customerSearch')?.value || '').trim().toLowerCase();
    const filtered = customers.filter((customer) => `${customer.name || ''} ${customer.displayName || ''} ${customer.email || ''} ${customer.phone || customer.phoneNumber || ''} ${customer.uid}`.toLowerCase().includes(query));
    const count = document.getElementById('navCustomersCount');
    const stat = document.getElementById('statCustomers');
    if (count) count.textContent = customers.length;
    if (stat) stat.textContent = customers.length;
    body.innerHTML = filtered.length ? filtered.map((customer) => {
        const type = customerPricingType(customer);
        return `<tr><td><div class="cell-content">${escapeHtml(customer.name || customer.displayName || 'غير متوفر')}</div></td><td dir="ltr"><div class="cell-content ltr-field">${escapeHtml(customer.email || 'غير متوفر')}</div></td><td dir="ltr"><div class="cell-content ltr-field">${escapeHtml(customer.phone || customer.phoneNumber || 'غير متوفر')}</div></td><td title="${escapeHtml(customer.uid)}"><div class="uid-cell ltr-field"><span>${escapeHtml(customer.uid.slice(0, 8))}…</span><button type="button" class="btn-copy" onclick="navigator.clipboard.writeText('${escapeHtml(customer.uid)}')" title="نسخ UID"><i class="fa-regular fa-copy"></i></button></div></td><td><select class="form-select account-type-select" data-customer-type="${escapeHtml(customer.uid)}"><option value="retail" ${type === 'retail' ? 'selected' : ''}>Retail</option><option value="wholesale" ${type === 'wholesale' ? 'selected' : ''}>Wholesale</option><option value="special" ${type === 'special' ? 'selected' : ''}>Special</option></select></td><td><div class="cell-content">${customerDate(customer.createdAt || customer.creationTime || customer.created_at)}</div></td><td><div style="display:flex; gap:6px; flex-wrap:wrap;"><button class="btn btn-primary action-save-btn" style="flex:1;" data-save-customer="${escapeHtml(customer.uid)}">حفظ</button>${currentAdminUser?.uid === SUPER_ADMIN_UID ? `<button class="btn btn-outline btn-sm" style="flex:1;" onclick="openResetPinModal('${escapeHtml(customer.uid)}')" title="إعادة تعيين PIN"><i class="fa-solid fa-key"></i> PIN</button>` : ''}${(currentAdminUser?.uid === SUPER_ADMIN_UID || currentAdminUser?.permissions?.customers_delete) ? `<button class="btn btn-outline btn-sm" style="flex:1; color: var(--primary); border-color: var(--primary);" onclick="deleteCustomer('${escapeHtml(customer.uid)}')" title="حذف"><i class="fa-solid fa-trash"></i></button>` : ''}</div></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="text-center">لا يوجد عملاء في المسار الموثوق /profiles.</td></tr>';
    body.querySelectorAll('[data-save-customer]').forEach((button) => button.addEventListener('click', () => updateCustomerType(button.dataset.saveCustomer)));
    renderPricingCustomers();
}

const CUSTOMER_PRICING = Object.freeze({
    retail: { accountType: 'retail', pricing_tier: 'public' },
    special: { accountType: 'special', pricing_tier: 'special' },
    wholesale: { accountType: 'wholesale', pricing_tier: 'wholesale' }
});

function customerPricingType(customer) {
    if (customer?.pricing_tier === 'special' || customer?.pricing_tier === 'wholesale') return customer.pricing_tier;
    if (customer?.pricing_tier === 'public') return 'retail';
    return ['retail', 'special', 'wholesale'].includes(customer?.accountType) ? customer.accountType : 'retail';
}

function canManageCustomerPricing() {
    return Boolean(currentAdminUser && (currentAdminUser.uid === SUPER_ADMIN_UID || window.currentAdminPermissions?.pricing_customers === true));
}

function renderPricingCustomers() {
    const body = document.getElementById('pricingCustomersTableBody');
    if (!body) return;
    const rows = customers.map((customer) => {
        const type = CUSTOMER_PRICING[customerPricingType(customer)].pricing_tier;
        return `<tr><td>${escapeHtml(customer.name || customer.displayName || 'غير متوفر')}</td><td dir="ltr">${escapeHtml(customer.email || 'غير متوفر')}</td><td dir="ltr">${escapeHtml(customer.phone || customer.phoneNumber || 'غير متوفر')}</td><td>${escapeHtml(customer.uid)}</td><td><span class="visibility-badge ${type === 'public' ? 'visible' : 'limited'}">${type}</span></td><td>${customerDate(customer.createdAt || customer.creationTime)}</td><td><button class="btn btn-outline btn-sm" data-pricing-customer="${escapeHtml(customer.uid)}">تعديل من جدول العملاء</button></td></tr>`;
    });
    Object.entries(pendingPricingIdentities).forEach(([key, item]) => rows.push(`<tr><td>معلق</td><td dir="ltr">${escapeHtml(item.email || item.identity || '')}</td><td dir="ltr">${escapeHtml(item.phone || '')}</td><td>${escapeHtml(item.uid || 'pending')}</td><td><span class="visibility-badge limited">${escapeHtml(item.pricing_tier || 'public')} / pending</span></td><td>${customerDate(item.createdAt)}</td><td><button class="btn btn-outline btn-sm" data-delete-pending="${escapeHtml(key)}">حذف التصنيف</button></td></tr>`));
    body.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="7" class="text-center">لا توجد فئات عملاء.</td></tr>';
    body.querySelectorAll('[data-pricing-customer]').forEach((button) => button.addEventListener('click', () => switchView('view-customers')));
    body.querySelectorAll('[data-delete-pending]').forEach((button) => button.addEventListener('click', async () => { if (confirm('حذف التصنيف المعلق؟')) await remove(ref(db, `pricing_identities/${button.dataset.deletePending}`)); }));
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

async function updateCustomerType(uid) {
    if (!canManageCustomerPricing()) {
        alert('ليس لديك صلاحية تعديل تسعير العملاء.');
        return;
    }
    const customer = customers.find((item) => item.uid === uid);
    const select = document.querySelector(`[data-customer-type="${CSS.escape(uid)}"]`);
    const nextType = select?.value;
    if (!customer || !CUSTOMER_PRICING[nextType]) return;
    const selected = CUSTOMER_PRICING[nextType];
    if (nextType === customerPricingType(customer)) return;
    const previousType = customerPricingType(customer);
    const now = Date.now();
    const profilePath = ref(db, `profiles/${uid}`);
    const auditKey = push(ref(db, 'auditLogs')).key;

    try {
        const payload = {
            [`profiles/${uid}/accountType`]: selected.accountType,
            [`profiles/${uid}/pricing_tier`]: selected.pricing_tier
        };
        await update(ref(db), payload);

        const readBack = await get(profilePath);
        const saved = readBack.exists() ? readBack.val() : null;
        if (saved?.accountType !== selected.accountType || saved?.pricing_tier !== selected.pricing_tier) {
            throw new Error(`RTDB read-back mismatch: accountType=${saved?.accountType || 'missing'}, pricing_tier=${saved?.pricing_tier || 'missing'}`);
        }

        customer.accountType = saved.accountType;
        customer.pricing_tier = saved.pricing_tier;
        renderCustomers();
        try {
            await set(ref(db, `auditLogs/${auditKey}`), { action: 'account_type_changed', targetUid: uid, actorUid: currentAdminUser.uid, actorEmail: currentAdminUser.email || '', previousType, nextType, timestamp: now });
        } catch (auditError) {
            console.error('Customer pricing audit log failed after profile read-back succeeded', auditError);
        }
        alert('تم حفظ تصنيف العميل والتحقق منه من Firebase.');
    } catch (error) {
        console.error('Customer pricing save/read-back failed', { actorUid: currentAdminUser.uid, actorEmail: currentAdminUser.email || '', targetUid: uid, selectedTier: selected.pricing_tier, selectedAccountType: selected.accountType, error });
        alert(`فشل حفظ تصنيف العميل: ${error.message || 'خطأ غير معروف'}`);
    }
}
window.updateCustomerType = updateCustomerType;
document.getElementById('customerSearch')?.addEventListener('input', renderCustomers);
document.getElementById('pendingPricingForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canManageCustomerPricing()) {
        alert('ليس لديك صلاحية تعديل تسعير العملاء.');
        return;
    }
    const identity = document.getElementById('pendingPricingIdentity').value.trim();
    const tier = document.getElementById('pendingPricingTier').value;
    const notes = document.getElementById('pendingPricingNotes').value.trim();
    if (!identity || !['public', 'special', 'wholesale'].includes(tier)) return;
    const matched = customers.find((customer) => customer.uid === identity || customer.email?.toLowerCase() === identity.toLowerCase() || customer.phone === identity);
    const now = Date.now();
    if (matched) {
        const selected = tier === 'public' ? CUSTOMER_PRICING.retail : CUSTOMER_PRICING[tier];
        await update(ref(db), { [`profiles/${matched.uid}/pricing_tier`]: selected.pricing_tier, [`profiles/${matched.uid}/accountType`]: selected.accountType });
        const readBack = await get(ref(db, `profiles/${matched.uid}`));
        const saved = readBack.exists() ? readBack.val() : null;
        if (saved?.pricing_tier !== selected.pricing_tier || saved?.accountType !== selected.accountType) throw new Error('RTDB read-back mismatch');
        try {
            await set(ref(db, `auditLogs/${push(ref(db, 'auditLogs')).key}`), { action: 'pricing_tier_changed', targetUid: matched.uid, nextTier: tier, actorUid: currentAdminUser.uid, timestamp: now });
        } catch (auditError) { console.error('Pending pricing audit log failed after profile read-back succeeded', auditError); }
    } else {
        const key = encodeURIComponent(identity).replace(/\./g, '%2E');
        await set(ref(db, `pricing_identities/${key}`), { identity, pricing_tier: tier, notes, createdAt: now, createdBy: currentAdminUser.uid });
    }
    event.target.reset();
    alert('تم حفظ تصنيف السعر.');
});

function updateCategorySelects() {
    const prodSelect = document.getElementById('prodCategory');
    const filterSelect = document.getElementById('productCategoryFilter');
    const pricingFilterSelect = document.getElementById('pricingCategoryFilter');

    if (prodSelect) {
        prodSelect.innerHTML = '<option value="">اختر القسم المناسب...</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name + (cat.isHidden ? ' (مخفي)' : '');
            prodSelect.appendChild(opt);
        });
    }

    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">جميع الأقسام</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = currentVal;
    }
    if (pricingFilterSelect) {
        const currentVal = pricingFilterSelect.value;
        pricingFilterSelect.innerHTML = '<option value="">كل الأقسام</option>';
        categories.forEach(cat => { const opt = document.createElement('option'); opt.value = cat.id; opt.textContent = cat.name; pricingFilterSelect.appendChild(opt); });
        pricingFilterSelect.value = currentVal;
    }
}

function renderPricingManagementTable() {
    const tbody = document.getElementById('pricingManagementBody');
    if (!tbody) return;
    const query = String(document.getElementById('pricingSearch')?.value || '').trim().toLowerCase();
    const category = document.getElementById('pricingCategoryFilter')?.value || '';
    const status = document.getElementById('pricingStatusFilter')?.value || '';
    const filtered = products.filter((p) => {
        const text = `${p.name || ''} ${p.brand || ''} ${p.model || ''}`.toLowerCase();
        return (!query || text.includes(query)) && (!category || (p.categoryId || p.category) === category) && (!status || (p.status || (p.isHidden ? 'hidden' : 'published')) === status);
    });
    tbody.innerHTML = filtered.length ? filtered.map((p) => {
        const prices = privatePricesByProduct[p.id] || {};
        return `<tr><td><img src="${escapeHtml(p.image || '/images/default-product.svg')}" class="tp-img" alt=""></td><td>${escapeHtml(p.name || '')}</td><td>${escapeHtml(categories.find((c) => c.id === (p.categoryId || p.category))?.name || p.category || '')}</td><td><input class="pricing-input" type="number" min="1" step="1" data-public-price="${escapeHtml(p.id)}" value="${Number(p.public_price ?? p.price) || ''}"></td><td><input class="pricing-input" type="number" min="1" step="1" data-wholesale-price="${escapeHtml(p.id)}" value="${prices.wholesale_price || ''}" placeholder="fallback"></td><td><input class="pricing-input" type="number" min="1" step="1" data-special-price="${escapeHtml(p.id)}" value="${prices.special_price || ''}" placeholder="fallback"></td><td><span class="visibility-badge ${p.isHidden ? 'hidden' : 'visible'}">${p.isHidden ? 'مخفي' : 'نشط'}</span></td><td><button class="btn btn-primary btn-sm" data-save-pricing="${escapeHtml(p.id)}">حفظ</button></td></tr>`;
    }).join('') : '<tr><td colspan="8" class="text-center">لا توجد منتجات مطابقة.</td></tr>';
    tbody.querySelectorAll('[data-save-pricing]').forEach((button) => button.addEventListener('click', () => saveProductPricing(button.dataset.savePricing)));
}

async function saveProductPricing(id) {
    if (!currentAdminUser || (!window.isSuperAdmin && window.currentAdminPermissions?.special_prices !== true)) {
        alert('ليست لديك صلاحية تعديل الأسعار.');
        return;
    }
    const product = products.find((p) => p.id === id);
    const publicInput = document.querySelector(`[data-public-price="${CSS.escape(id)}"]`);
    const specialInput = document.querySelector(`[data-special-price="${CSS.escape(id)}"]`);
    const wholesaleInput = document.querySelector(`[data-wholesale-price="${CSS.escape(id)}"]`);
    const publicPrice = Number(publicInput?.value);
    const specialPrice = specialInput?.value === '' ? null : Number(specialInput.value);
    const wholesalePrice = wholesaleInput?.value === '' ? null : Number(wholesaleInput.value);
    if (!product || !Number.isFinite(publicPrice) || publicPrice <= 0 || (specialPrice !== null && (!Number.isFinite(specialPrice) || specialPrice <= 0)) || (wholesalePrice !== null && (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0))) {
        alert('السعر العام موجب، والخاص/الجملة إما فارغ أو رقم موجب.');
        return;
    }
    const now = Date.now();
    try {
        await update(ref(db), {
            [`products/${id}/price`]: publicPrice,
            [`products/${id}/public_price`]: publicPrice,
            [`private_prices/${id}`]: { special_price: specialPrice, wholesale_price: wholesalePrice, updatedAt: now, updatedBy: currentAdminUser.uid },
            [`auditLogs/${push(ref(db, 'auditLogs')).key}`]: { action: 'product_pricing_changed', productId: id, actorUid: currentAdminUser.uid, publicPrice, specialPrice, wholesalePrice, timestamp: now }
        });
        const [productSnapshot, privateSnapshot] = await Promise.all([get(ref(db, `products/${id}`)), get(ref(db, `private_prices/${id}`))]);
        if (!productSnapshot.exists()) throw new Error('PRODUCT_READBACK_MISSING');
        const readProduct = productSnapshot.val() || {};
        const readPrivate = privateSnapshot.exists() ? privateSnapshot.val() || {} : {};
        const readPublic = Number(readProduct.public_price ?? readProduct.price);
        const readSpecial = readPrivate.special_price == null ? null : Number(readPrivate.special_price);
        const readWholesale = readPrivate.wholesale_price == null ? null : Number(readPrivate.wholesale_price);
        if (readPublic !== publicPrice || readSpecial !== specialPrice || readWholesale !== wholesalePrice) throw new Error('PRICE_READBACK_MISMATCH');
        const productIndex = products.findIndex((item) => item.id === id);
        if (productIndex >= 0) products[productIndex] = { ...products[productIndex], ...readProduct };
        privatePricesByProduct[id] = readPrivate;
        renderPricingManagementTable();
        alert('تم حفظ الأسعار والتحقق منها من Firebase.');
    } catch (error) {
        console.error('Pricing save failed', { code: error?.message || 'PRICING_SAVE_FAILED' });
        alert(`تعذر حفظ الأسعار: ${error?.message || 'خطأ غير معروف'}`);
    }
}
window.saveProductPricing = saveProductPricing;
document.getElementById('pricingSearch')?.addEventListener('input', renderPricingManagementTable);
document.getElementById('pricingCategoryFilter')?.addEventListener('change', renderPricingManagementTable);
document.getElementById('pricingStatusFilter')?.addEventListener('change', renderPricingManagementTable);

// ================= BUILDER PRODUCT DISCOUNTS =================
const DEFAULT_BUILDER_INVOICE_TIERS = [
    { id: 'tier-1', min: 500000, max: 999999, discount: 25000, enabled: true, order: 1 },
    { id: 'tier-2', min: 1000000, max: 1499999, discount: 50000, enabled: true, order: 2 },
    { id: 'tier-3', min: 1500000, max: 1999999, discount: 75000, enabled: true, order: 3 }
];

function builderInvoiceConfig() {
    const configured = storeSettings?.buildGlobalDiscount?.invoiceTiers;
    const tiers = configured && typeof configured === 'object'
        ? Object.entries(configured).map(([id, tier]) => ({ id, ...tier }))
        : DEFAULT_BUILDER_INVOICE_TIERS.map((tier) => ({ ...tier }));
    return { enabled: storeSettings?.buildGlobalDiscount?.invoiceDiscountEnabled === true, tiers };
}

function sortedBuilderInvoiceTiers(config = builderInvoiceConfig()) {
    return config.tiers.filter((tier) => tier && typeof tier === 'object').map((tier, index) => ({
        id: String(tier.id || `tier-${index + 1}`),
        min: Number(tier.min),
        max: tier.max === null || tier.max === '' || tier.max === undefined ? null : Number(tier.max),
        discount: Number(tier.discount),
        enabled: tier.enabled !== false,
        order: Number(tier.order) || index + 1
    })).sort((a, b) => a.min - b.min || a.order - b.order);
}

function builderInvoiceTierOverlaps(candidate, tiers, ignoreId = '') {
    return tiers.some((tier) => tier.id !== ignoreId && tier.enabled && candidate.enabled
        && candidate.min <= (tier.max === null ? Infinity : tier.max)
        && (candidate.max === null || candidate.max >= tier.min));
}

function renderBuilderInvoiceTiers() {
    const body = document.getElementById('builderInvoiceTiersBody');
    const toggle = document.getElementById('builderInvoiceDiscountEnabled');
    if (!body) return;
    const config = builderInvoiceConfig();
    if (toggle) toggle.checked = config.enabled;
    const tiers = sortedBuilderInvoiceTiers(config);
    body.innerHTML = tiers.length ? tiers.map((tier) => `<tr><td>${formatPrice(tier.min)}</td><td>${tier.max === null ? 'مفتوح' : formatPrice(tier.max)}</td><td>${formatPrice(tier.discount)}</td><td><span class="status-badge ${tier.enabled ? 'status-published' : 'status-hidden'}">${tier.enabled ? 'مفعّل' : 'معطّل'}</span></td><td><button type="button" class="btn btn-outline btn-sm" data-edit-builder-invoice-tier="${escapeHtml(tier.id)}">تعديل</button> <button type="button" class="btn btn-danger btn-sm" data-delete-builder-invoice-tier="${escapeHtml(tier.id)}">حذف</button></td></tr>`).join('') : '<tr><td colspan="5" class="text-center">لا توجد شرائح محفوظة.</td></tr>';
    body.querySelectorAll('[data-edit-builder-invoice-tier]').forEach((button) => button.addEventListener('click', () => openBuilderInvoiceTierForm(button.dataset.editBuilderInvoiceTier)));
    body.querySelectorAll('[data-delete-builder-invoice-tier]').forEach((button) => button.addEventListener('click', () => deleteBuilderInvoiceTier(button.dataset.deleteBuilderInvoiceTier)));
}

function openBuilderInvoiceTierForm(id = '') {
    const form = document.getElementById('builderInvoiceTierForm');
    if (!form) return;
    const tier = sortedBuilderInvoiceTiers().find((item) => item.id === id);
    document.getElementById('builderInvoiceTierId').value = tier?.id || '';
    document.getElementById('builderInvoiceTierMin').value = tier?.min ?? '';
    document.getElementById('builderInvoiceTierMax').value = tier?.max ?? '';
    document.getElementById('builderInvoiceTierDiscount').value = tier?.discount ?? '';
    document.getElementById('builderInvoiceTierEnabled').checked = tier?.enabled !== false;
    form.hidden = false;
}

function closeBuilderInvoiceTierForm() { const form = document.getElementById('builderInvoiceTierForm'); if (form) form.hidden = true; }

async function saveBuilderInvoiceConfig(config) {
    if (!canManageBuilderInvoiceDiscounts()) throw new Error('ليس لديك صلاحية إدارة خصومات فاتورة التجميعة.');
    if (isDemoMode) throw new Error('لا يمكن الحفظ في وضع المعاينة.');
    const tiers = Object.fromEntries(sortedBuilderInvoiceTiers(config).map((tier, index) => [tier.id, { min: tier.min, max: tier.max, discount: tier.discount, enabled: tier.enabled, order: index + 1 }]));
    const previous = storeSettings?.buildGlobalDiscount && typeof storeSettings.buildGlobalDiscount === 'object' ? storeSettings.buildGlobalDiscount : {};
    const payload = { ...previous, invoiceDiscountEnabled: config.enabled === true, invoiceTiers: tiers, updatedAt: Date.now(), updatedBy: currentAdminUser.uid };
    await update(ref(db), { 'settings/buildGlobalDiscount': payload });
    const snapshot = await get(ref(db, 'settings/buildGlobalDiscount'));
    const saved = snapshot.exists() ? snapshot.val() : null;
    if (!saved || saved.invoiceDiscountEnabled !== payload.invoiceDiscountEnabled || Object.keys(saved.invoiceTiers || {}).length !== Object.keys(tiers).length) throw new Error('BUILDER_INVOICE_SETTINGS_READBACK_MISMATCH');
    storeSettings = { ...storeSettings, buildGlobalDiscount: saved };
    localStorage.setItem('spider_store_settings', JSON.stringify(storeSettings));
    renderBuilderInvoiceTiers();
}

async function saveBuilderInvoiceTier(event) {
    event.preventDefault();
    const id = String(document.getElementById('builderInvoiceTierId').value || '').trim();
    const min = Number(document.getElementById('builderInvoiceTierMin').value);
    const maxRaw = String(document.getElementById('builderInvoiceTierMax').value || '').trim();
    const max = maxRaw === '' ? null : Number(maxRaw);
    const discount = Number(document.getElementById('builderInvoiceTierDiscount').value);
    const enabled = document.getElementById('builderInvoiceTierEnabled').checked === true;
    const config = builderInvoiceConfig();
    const current = sortedBuilderInvoiceTiers(config);
    const candidate = { id: id || `tier-${Date.now()}`, min, max, discount, enabled, order: current.length + 1 };
    if (!Number.isFinite(min) || min < 0 || (max !== null && (!Number.isFinite(max) || max <= min)) || !Number.isFinite(discount) || discount < 0 || (max !== null && discount > max) || builderInvoiceTierOverlaps(candidate, current, id)) {
        alert(builderInvoiceTierOverlaps(candidate, current, id) ? 'هذه الشريحة تتداخل مع شريحة موجودة' : 'تحقق من الحدود وقيمة الخصم: الحد الأدنى غير سالب، والحد الأعلى أكبر منه، والخصم غير سالب ولا يتجاوز الحد الأعلى.');
        return;
    }
    const next = current.filter((tier) => tier.id !== id).concat(candidate);
    try { await saveBuilderInvoiceConfig({ enabled: config.enabled, tiers: next }); closeBuilderInvoiceTierForm(); alert('تم حفظ شريحة خصم الفاتورة والتحقق من Firebase.'); }
    catch (error) { alert(`فشل حفظ شريحة خصم الفاتورة: ${error.message || 'خطأ غير معروف'}`); }
}

async function deleteBuilderInvoiceTier(id) {
    if (!window.confirm('هل تريد حذف شريحة الخصم هذه؟')) return;
    const config = builderInvoiceConfig();
    try { await saveBuilderInvoiceConfig({ enabled: config.enabled, tiers: sortedBuilderInvoiceTiers(config).filter((tier) => tier.id !== id) }); closeBuilderInvoiceTierForm(); alert('تم حذف الشريحة والتحقق من Firebase.'); }
    catch (error) { alert(`فشل حذف الشريحة: ${error.message || 'خطأ غير معروف'}`); }
}

function canManageBuilderInvoiceDiscounts() {
    return isDemoMode || Boolean(currentAdminUser && (currentAdminUser.uid === SUPER_ADMIN_UID || window.currentAdminPermissions?.store_settings === true));
}

document.getElementById('addBuilderInvoiceTierBtn')?.addEventListener('click', () => openBuilderInvoiceTierForm());
document.getElementById('cancelBuilderInvoiceTierBtn')?.addEventListener('click', closeBuilderInvoiceTierForm);
document.getElementById('builderInvoiceTierForm')?.addEventListener('submit', saveBuilderInvoiceTier);
document.getElementById('builderInvoiceDiscountEnabled')?.addEventListener('change', async (event) => {
    const config = builderInvoiceConfig();
    try { await saveBuilderInvoiceConfig({ enabled: event.target.checked === true, tiers: config.tiers }); alert('تم تحديث تفعيل خصومات فاتورة التجميعة والتحقق من Firebase.'); }
    catch (error) { event.target.checked = config.enabled; alert(`فشل تحديث التفعيل: ${error.message || 'خطأ غير معروف'}`); }
});

// ================= DASHBOARD RENDERING =================
function renderRecentOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:30px;color:#888;">لا توجد أي طلبات مسجلة حتى الآن</td></tr>';
        return;
    }

    const recent = orders.slice(0, 5);
    recent.forEach((order, idx) => {
        const statusClass = (order.status === 'pending' || order.status === 'جديد') ? 'status-pending' : (order.status === 'cancelled' ? 'status-cancelled' : 'status-completed');
        const statusText = (order.status === 'pending' || order.status === 'جديد') ? 'قيد التجهيز' : (order.status === 'cancelled' ? 'ملغي' : 'مكتمل');
        const itemsCount = order.items ? (Array.isArray(order.items) ? order.items.length : Object.keys(order.items).length) : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${order.orderNumber || idx + 1}</strong></td>
            <td>${order.customerName || 'عميل'}</td>
            <td>${itemsCount} قطع</td>
            <td><strong style="color:var(--dark);">${formatPrice(order.grandTotal || 0)}</strong></td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td><button class="table-btn btn-edit" onclick="viewOrder('${order.id}')"><i class="fa-solid fa-eye"></i> عرض</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTopProducts() {
    const list = document.getElementById('topProductsList');
    if (!list) return;
    list.innerHTML = '';

    if (products.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:25px;color:#888;grid-column:1/-1;">لا توجد منتجات مسجلة</div>';
        return;
    }

    const top = products.slice(0, 5);
    top.forEach(prod => {
        const html = `
            <div class="top-product-item">
                <img src="${prod.image || '/images/default-product.svg'}" class="tp-img" alt="${prod.name}">
                <div class="tp-info">
                    <div class="tp-name">${prod.name}</div>
                    <div class="tp-price">${formatPrice(prod.price || 0)}</div>
                </div>
                <span class="visibility-badge ${prod.isHidden ? 'hidden' : 'visible'}">${prod.isHidden ? 'مخفي' : 'نشط'}</span>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

function renderDashboardCharts() {
    if (typeof Chart === 'undefined') return;

    const salesCanvas = document.getElementById('salesChart');
    if (salesCanvas) {
        const salesData = buildSalesSeries();
        if (salesChart) salesChart.destroy();
        salesChart = new Chart(salesCanvas, {
            type: 'line',
            data: {
                labels: salesData.labels,
                datasets: [{
                    label: 'المبيعات',
                    data: salesData.values,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#6b7280' } },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#eef1f6' },
                        ticks: {
                            color: '#6b7280',
                            callback: (value) => formatCompactCurrency(value)
                        }
                    }
                }
            }
        });
    }

    const catCanvas = document.getElementById('categoriesChart');
    if (catCanvas) {
        const distribution = getCategoryBreakdown();
        if (categoriesChart) categoriesChart.destroy();
        categoriesChart = new Chart(catCanvas, {
            type: 'doughnut',
            data: {
                labels: distribution.map(item => item.name),
                datasets: [{
                    data: distribution.map(item => item.count),
                    backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#94a3b8'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: { legend: { display: false } }
            }
        });
    }
}

function buildSalesSeries() {
    const labels = [];
    const values = [];
    const days = 7;
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - i);
        const next = new Date(date);
        next.setDate(date.getDate() + 1);
        labels.push(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
        const total = orders.reduce((sum, order) => {
            const ts = order.timestamp || 0;
            if (ts >= date.getTime() && ts < next.getTime() && (order.status === 'completed' || order.status === 'مكتمل' || order.status === 'pending' || order.status === 'جديد')) {
                return sum + Number(order.grandTotal || 0);
            }
            return sum;
        }, 0);
        values.push(total);
    }
    return { labels, values };
}

function getCategoryBreakdown() {
    const counts = new Map();
    products.forEach(prod => {
        const key = prod.categoryId || prod.category || 'other';
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    const breakdown = Array.from(counts.entries()).map(([id, count]) => ({ id, count, name: getCategoryName(id) }));
    breakdown.sort((a, b) => b.count - a.count);
    return breakdown.slice(0, 6);
}

function renderCategoryDistribution() {
    const list = document.getElementById('categoryDistributionList');
    const totalEl = document.getElementById('distributionTotal');
    if (totalEl) totalEl.textContent = products.length;
    if (!list) return;

    const distribution = getCategoryBreakdown();
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#94a3b8'];
    list.innerHTML = '';
    if (distribution.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#888;padding:15px 0;">لا توجد بيانات أقسام كافية</div>';
        return;
    }

    distribution.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'distribution-row';
        row.innerHTML = `
            <span class="distribution-dot" style="background:${colors[index % colors.length]}"></span>
            <span>${item.name}</span>
            <strong>${item.count}</strong>
        `;
        list.appendChild(row);
    });
}

function formatCompactCurrency(value) {
    if (!value) return '0';
    if (value >= 1000000) return (value / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
    return value;
}

// ================= PRODUCTS MANAGEMENT =================
// ================= PRODUCTS MANAGEMENT =================
function renderProductsManagementTable() {
    const tbody = document.getElementById('productsFullTableBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('productSearchInput')?.value || '').toLowerCase().trim();
    const categoryVal = document.getElementById('productCategoryFilter')?.value || '';
    const statusVal = document.getElementById('productStatusFilter')?.value || '';

    let filtered = products.filter(p => {
        const description = productDescriptionParts(p.description);
        const matchesSearch = !searchVal || (p.name && p.name.toLowerCase().includes(searchVal)) || description.ar.toLowerCase().includes(searchVal) || description.en.toLowerCase().includes(searchVal);
        const matchesCategory = !categoryVal || (p.categoryId === categoryVal || p.category === categoryVal);
        const matchesStatus = !statusVal || (statusVal === 'visible' && !p.isHidden) || (statusVal === 'hidden' && p.isHidden);
        return matchesSearch && matchesCategory && matchesStatus;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:#888;">لا توجد منتجات مطابقة لخيارات البحث أو الفلترة</td></tr>';
        return;
    }

    filtered.forEach(prod => {
        const tr = document.createElement('tr');
        const isHidden = !!prod.isHidden;
        const categoryName = getCategoryName(prod.categoryId || prod.category);

        tr.innerHTML = `
            <td><img src="${prod.image || '/images/default-product.svg'}" class="tp-img" alt="${prod.name}"></td>
            <td><strong>${prod.name}</strong><br><small style="color:#777;">ID: ${prod.id.slice(0, 10)}...</small></td>
            <td><span style="font-weight:700;color:#555;">${categoryName}</span></td>
            <td><strong style="color:var(--primary);">${formatPrice(prod.price)}</strong></td>
            <td>
                <span class="visibility-badge ${isHidden ? 'hidden' : 'visible'}">
                    <i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isHidden ? 'مخفي مؤقتاً' : 'معروض بالمتجر'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="table-btn btn-edit" title="تعديل المنتج" onclick="openProductModal('${prod.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> تعديل
                    </button>
                    <button class="table-btn btn-toggle" title="${isHidden ? 'إظهار في المتجر' : 'إخفاء من المتجر'}" onclick="toggleProductVisibility('${prod.id}', ${isHidden})">
                        <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'إظهار' : 'إخفاء'}
                    </button>
                    <button class="table-btn btn-delete" title="حذف نهائي" onclick="deleteProduct('${prod.id}')">
                        <i class="fa-solid fa-trash"></i> حذف
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Product Filters Event Listeners
document.getElementById('productSearchInput')?.addEventListener('input', renderProductsManagementTable);
document.getElementById('productCategoryFilter')?.addEventListener('change', renderProductsManagementTable);
document.getElementById('productStatusFilter')?.addEventListener('change', renderProductsManagementTable);

// Product CRUD
function productImageId() {
    return globalThis.crypto?.randomUUID?.() || `product-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function productImagePreviewItem(item) {
    return item?.previewUrl || item?.uploadedUrl || item?.url || '';
}

function productImagePrimary() {
    return productImageItems.find((item) => item.isPrimary) || productImageItems[0] || null;
}

function syncProductImageFields() {
    const primary = productImagePrimary();
    const uploaded = productImageItems.map((item) => item.uploadedUrl).filter(Boolean).slice(0, 5);
    const primaryUrl = primary?.uploadedUrl || '';
    const hidden = document.getElementById('prodImage');
    if (hidden) hidden.value = primaryUrl;
    return { primaryUrl, uploaded };
}

function revokeProductImagePreview(item) {
    if (item?.sourceType === 'local' && item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
}

function setProductImageState(items, activeId = null) {
    productImageItems = items.filter(Boolean).slice(0, 5);
    if (productImageItems.length && !productImageItems.some((item) => item.isPrimary)) productImageItems[0].isPrimary = true;
    const primary = productImagePrimary();
    productImageItems.forEach((item, index) => { item.isPrimary = index === 0; });
    activeProductImageId = productImageItems.some((item) => item.id === activeId)
        ? activeId
        : (primary?.id || productImageItems[0]?.id || null);
    syncProductImageFields();
    if (typeof window.renderAdminGallery === 'function') window.renderAdminGallery();
}

function createRemoteProductImageItem(url, isPrimary = false) {
    return { id: productImageId(), sourceType: 'remote', file: null, url, previewUrl: url, uploadedUrl: url, isPrimary, uploadStatus: 'uploaded' };
}

function createLocalProductImageItem(file) {
    const previewUrl = URL.createObjectURL(file);
    return { id: productImageId(), sourceType: 'local', file, url: previewUrl, previewUrl, uploadedUrl: null, isPrimary: false, uploadStatus: 'pending', signature: `${file.name}:${file.size}:${file.lastModified}` };
}

function productImageItemsFromProduct(product) {
    const urls = [...(Array.isArray(product?.images) ? product.images : []), product?.image].filter(Boolean);
    return [...new Set(urls)].slice(0, 5).map((url, index) => createRemoteProductImageItem(url, index === 0));
}

function updateProductMainPreview() {
    const preview = document.getElementById('imagePreview');
    const details = document.getElementById('imageDetails');
    const container = document.getElementById('imagePreviewContainer');
    const active = productImageItems.find((item) => item.id === activeProductImageId) || productImagePrimary();
    const source = productImagePreviewItem(active);
    if (!preview || !container) return;
    if (!source) {
        preview.removeAttribute('src');
        container.style.display = 'none';
        if (details) details.textContent = '';
        return;
    }
    preview.src = source;
    container.style.display = 'block';
    if (details) details.textContent = active?.sourceType === 'local'
        ? `${productImageItems.filter((item) => item.sourceType === 'local' && !item.uploadedUrl).length} صورة جاهزة للرفع`
        : 'الصورة الحالية للمنتج';
}

function resetProductImageState() {
    if (activeProductImageUpload) {
        activeProductImageUpload.abort();
        activeProductImageUpload = null;
    }
    productImageItems.forEach(revokeProductImagePreview);
    productImageItems = [];
    activeProductImageId = null;
    currentProcessedImageBase64 = null;
    currentProcessedImageName = null;
    isUploadingImage = false;
    const file = document.getElementById('prodImageFile');
    const hidden = document.getElementById('prodImage');
    const preview = document.getElementById('imagePreview');
    const container = document.getElementById('imagePreviewContainer');
    const details = document.getElementById('imageDetails');
    const status = document.getElementById('imageUploadStatus');
    const progress = document.getElementById('imageUploadProgress');
    if (file) file.value = '';
    if (hidden) hidden.value = '';
    if (preview) preview.removeAttribute('src');
    if (preview) { preview.onload = null; preview.onerror = null; }
    if (container) container.style.display = 'none';
    if (details) details.textContent = '';
    if (status) status.textContent = '';
    if (progress) { progress.value = 0; progress.hidden = true; }
    const prepareButton = document.getElementById('uploadImageBtn');
    const uploadButton = document.getElementById('confirmUploadBtn');
    if (prepareButton) { prepareButton.disabled = false; prepareButton.textContent = 'معاينة الصورة'; }
    if (uploadButton) { uploadButton.disabled = false; uploadButton.textContent = 'رفع الصور إلى GitHub'; }
    if (typeof window.renderAdminGallery === 'function') window.renderAdminGallery();
}

function updateProductCompatibilityFields() {
    const category = document.getElementById('prodCategory')?.value || '';
    const wrapper = document.getElementById('productCompatibilityFields');
    if (!wrapper) return;
    const isCpu = category === 'cat-cpus';
    const isMotherboard = category === 'cat-motherboards';
    const isRam = category === 'cat-ram';
    wrapper.hidden = !(isCpu || isMotherboard || isRam);
    const show = (id, visible) => { const element = document.getElementById(id); if (element) element.hidden = !visible; };
    show('cpuSocketField', isCpu);
    show('motherboardSocketField', isMotherboard);
    show('ramTypeField', isRam);
    show('supportedRamTypesField', isMotherboard);
}

function adminSpecificationEntries(source) {
    if (Array.isArray(source)) return source.map((item) => ({
        key_ar: String(item?.key_ar ?? item?.keyAr ?? item?.key ?? ''), key_en: String(item?.key_en ?? item?.keyEn ?? item?.key ?? ''),
        value_ar: String(item?.value_ar ?? item?.valueAr ?? item?.value ?? ''), value_en: String(item?.value_en ?? item?.valueEn ?? item?.en ?? item?.value ?? '')
    }));
    return Object.entries(source && typeof source === 'object' ? source : {}).map(([key, value]) => ({
        key_ar: key, key_en: typeof value === 'object' ? String(value.key_en ?? value.keyEn ?? value.en ?? '') : '',
        value_ar: typeof value === 'object' ? String(value.value_ar ?? value.valueAr ?? value.ar ?? value.value ?? '') : String(value ?? ''),
        value_en: typeof value === 'object' ? String(value.value_en ?? value.valueEn ?? value.en ?? value.value ?? '') : ''
    }));
}
function parseBulkSpecifications(text) {
    const rows = [], invalid = [];
    String(text || '').split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        if (!line) return;
        const match = line.match(/^(.*?)(?:\s*:\s*|\s*：\s*|\s+-\s+|\s*=\s*)(.+)$/);
        if (!match || !match[1].trim() || !match[2].trim()) { invalid.push({ line: index + 1, text: line }); return; }
        rows.push({ key_ar: match[1].trim(), key_en: '', value_ar: match[2].trim(), value_en: '' });
    });
    return { rows, invalid };
}
function bulkSpecificationsText(rows) {
    return rows.filter((item) => item.key_ar || item.value_ar).map((item) => item.key_ar && item.value_ar ? `${item.key_ar}: ${item.value_ar}` : item.key_ar || item.value_ar).join('\n');
}
function setBulkSpecificationStatus(text = '') { const status = document.getElementById('specBulkStatus'); if (status) status.textContent = text; }
function renderBulkSpecificationInvalid(invalid) {
    const box = document.getElementById('specBulkInvalid');
    if (!box) return;
    box.hidden = !invalid.length;
    box.innerHTML = invalid.length ? `<strong>يوجد ${invalid.length} سطر يحتاج مراجعة</strong>${invalid.map((item) => `<div>السطر ${item.line}: ${escapeHtml(item.text)}</div>`).join('')}` : '';
}
function renderProductSpecsEditor(source = []) {
    const editor = document.getElementById('prodSpecsEditor');
    if (!editor) return;
    const entries = adminSpecificationEntries(source);
    editor.innerHTML = `<div class="spec-editor-head"><span>الاسم بالعربي</span><span>Property in English</span><span>القيمة بالعربي</span><span>Value in English</span><span></span><span></span></div>` +
        entries.map((item) => `<div class="spec-editor-row"><input type="text" data-spec-field="key_ar" value="${escapeHtml(item.key_ar)}" maxlength="80"><input type="text" data-spec-field="key_en" value="${escapeHtml(item.key_en)}" maxlength="180"${item._keyManual ? ' data-manual="true"' : ''}><input type="text" data-spec-field="value_ar" value="${escapeHtml(item.value_ar)}" maxlength="180"><input type="text" data-spec-field="value_en" value="${escapeHtml(item.value_en)}" maxlength="180"${item._valueManual ? ' data-manual="true"' : ''}><button type="button" class="btn btn-outline spec-retranslate-btn" data-retranslate-spec aria-label="إعادة ترجمة المواصفة">↻</button><button type="button" class="btn btn-outline" data-remove-spec aria-label="حذف المواصفة"><i class="fa-solid fa-xmark"></i></button><small class="spec-translation-status" data-spec-status aria-live="polite"></small></div>`).join('');
    bindSpecificationTranslation(editor);
}
function readProductSpecsEditor() {
    return [...document.querySelectorAll('#prodSpecsEditor .spec-editor-row')].map((row) => Object.fromEntries([...row.querySelectorAll('[data-spec-field]')].map((input) => [input.dataset.specField, input.value.trim()]))).filter((item) => item.key_ar || item.key_en || item.value_ar || item.value_en).slice(0, 18);
}
function syncBulkSpecificationTextFromRows() {
    const bulk = document.getElementById('prodSpecsBulk');
    if (bulk) {
        const invalid = parseBulkSpecifications(bulk.value).invalid;
        const parsedRows = bulkSpecificationsText(readProductSpecsEditor());
        bulk.value = [parsedRows, ...invalid.map((item) => item.text)].filter(Boolean).join('\n');
    }
}
function applyBulkSpecifications(translate = true) {
    const bulk = document.getElementById('prodSpecsBulk');
    if (!bulk) return;
    const parsed = parseBulkSpecifications(bulk.value);
    const previous = [...document.querySelectorAll('#prodSpecsEditor .spec-editor-row')].map((row) => Object.fromEntries([...row.querySelectorAll('[data-spec-field]')].map((input) => [input.dataset.specField, input.value.trim()])));
    parsed.rows = parsed.rows.map((item, index) => {
        const prior = previous.find((candidate) => candidate.key_ar === item.key_ar) || previous[index];
        return prior ? { ...item, key_en: prior.key_en, value_en: prior.value_en, _keyManual: document.querySelectorAll('#prodSpecsEditor .spec-editor-row')[previous.indexOf(prior)]?.querySelector('[data-spec-field="key_en"]')?.dataset.manual === 'true', _valueManual: document.querySelectorAll('#prodSpecsEditor .spec-editor-row')[previous.indexOf(prior)]?.querySelector('[data-spec-field="value_en"]')?.dataset.manual === 'true' } : item;
    });
    renderProductSpecsEditor(parsed.rows);
    renderBulkSpecificationInvalid(parsed.invalid);
    setBulkSpecificationStatus(parsed.invalid.length ? `يوجد ${parsed.invalid.length} سطر يحتاج مراجعة` : `تم تحليل ${parsed.rows.length} مواصفة`);
    if (translate && parsed.rows.length) translateSpecificationsBatch(false);
}
document.getElementById('addSpecRowBtn')?.addEventListener('click', () => {
    const current = readProductSpecsEditor();
    current.push({ key_ar: '', key_en: '', value_ar: '', value_en: '' });
    renderProductSpecsEditor(current);
    syncBulkSpecificationTextFromRows();
});
document.getElementById('prodSpecsEditor')?.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-spec]');
    if (!remove) return;
    const rows = readProductSpecsEditor();
    rows.splice([...document.querySelectorAll('#prodSpecsEditor .spec-editor-row')].indexOf(remove.closest('.spec-editor-row')), 1);
    renderProductSpecsEditor(rows);
    syncBulkSpecificationTextFromRows();
});
document.getElementById('parseSpecsBtn')?.addEventListener('click', () => applyBulkSpecifications(true));
document.getElementById('prodSpecsBulk')?.addEventListener('input', () => {
    setBulkSpecificationStatus('جاري تحليل المواصفات...');
    clearTimeout(window.bulkSpecificationTimer);
    window.bulkSpecificationTimer = setTimeout(() => applyBulkSpecifications(true), 450);
});

function bindSpecificationTranslation(editor) {
    editor.querySelectorAll('.spec-editor-row').forEach((row) => {
        row.querySelectorAll('[data-spec-field="key_en"],[data-spec-field="value_en"]').forEach((input) => input.addEventListener('input', () => { input.dataset.manual = 'true'; }));
        row.querySelectorAll('[data-spec-field="key_ar"],[data-spec-field="value_ar"]').forEach((input) => input.addEventListener('input', () => { syncBulkSpecificationTextFromRows(); scheduleSpecificationTranslation(row); }));
        row.querySelector('[data-retranslate-spec]')?.addEventListener('click', () => translateSpecificationRow(row, true));
    });
}

function scheduleSpecificationTranslation(row) {
    const existing = specificationTranslationTimers.get(row);
    if (existing) clearTimeout(existing);
    specificationTranslationTimers.set(row, setTimeout(() => translateSpecificationRow(row, false), 850));
}

async function translateSpecificationRow(row, force = false) {
    await translateSpecificationsBatch(force, [row]);
}
async function translateSpecificationsBatch(force = false, onlyRows = null) {
    const rows = onlyRows || [...document.querySelectorAll('#prodSpecsEditor .spec-editor-row')];
    const items = rows.map((row) => ({ row, propertyInput: row.querySelector('[data-spec-field="key_ar"]'), valueInput: row.querySelector('[data-spec-field="value_ar"]'), propertyEnglish: row.querySelector('[data-spec-field="key_en"]'), valueEnglish: row.querySelector('[data-spec-field="value_en"]'), status: row.querySelector('[data-spec-status]'), button: row.querySelector('[data-retranslate-spec]') }))
        .filter((item) => item.propertyInput?.value.trim() && item.valueInput?.value.trim() && (force || item.propertyEnglish?.dataset.manual !== 'true' || item.valueEnglish?.dataset.manual !== 'true'));
    if (!items.length) return;
    if (!auth.currentUser) { items.forEach((item) => { if (item.status) item.status.textContent = 'تسجيل دخول الأدمن مطلوب'; }); return; }
    items.forEach((item) => { if (item.status) item.status.textContent = 'جارٍ الترجمة...'; if (item.button) item.button.disabled = true; });
    setBulkSpecificationStatus('جاري الترجمة...');
    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/translate-description`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'specifications_batch', items: items.map((item) => ({ key_ar: item.propertyInput.value.trim(), value_ar: item.valueInput.value.trim() })) }) });
        const result = await response.json().catch(() => ({}));
        let translatedItems = result.items;
        if (!response.ok || !result.success || !Array.isArray(translatedItems) || translatedItems.length !== items.length) {
            // Keep compatibility with a Worker that has the older one-row endpoint.
            translatedItems = await Promise.all(items.map(async (item) => {
                const fallbackResponse = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/translate-description`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'specification', property: item.propertyInput.value.trim(), value: item.valueInput.value.trim() }) });
                const fallback = await fallbackResponse.json().catch(() => ({}));
                if (!fallbackResponse.ok || !fallback.success) throw new Error(fallback.error || 'TRANSLATION_FAILED');
                return fallback;
            }));
        }
        translatedItems.forEach((translated, index) => {
            const item = items[index];
            if (force || item.propertyEnglish?.dataset.manual !== 'true') { item.propertyEnglish.value = translated.key_en || translated.property || ''; item.propertyEnglish.dataset.manual = 'false'; }
            if (force || item.valueEnglish?.dataset.manual !== 'true') { item.valueEnglish.value = translated.value_en || translated.value || ''; item.valueEnglish.dataset.manual = 'false'; }
            if (item.status) item.status.textContent = 'تمت الترجمة';
        });
        setBulkSpecificationStatus('تمت الترجمة');
    } catch (error) {
        console.error('Specification translation failed', { code: error.message });
        items.forEach((item) => { if (item.status) item.status.textContent = 'تعذرت الترجمة؛ يمكنك إدخال English يدويًا.'; });
        setBulkSpecificationStatus('تعذرت الترجمة؛ يمكنك إدخال English يدويًا.');
    } finally { items.forEach((item) => { if (item.button) item.button.disabled = false; }); }
}
/* Legacy single-row function retained as a safe fallback for older callers. */
async function translateSpecificationRowLegacy(row, force = false) {
    const propertyInput = row.querySelector('[data-spec-field="key_ar"]');
    const valueInput = row.querySelector('[data-spec-field="value_ar"]');
    const propertyEnglish = row.querySelector('[data-spec-field="key_en"]');
    const valueEnglish = row.querySelector('[data-spec-field="value_en"]');
    const status = row.querySelector('[data-spec-status]');
    const property = propertyInput?.value.trim() || '';
    const value = valueInput?.value.trim() || '';
    if (!property || !value || (!force && propertyEnglish?.dataset.manual === 'true' && valueEnglish?.dataset.manual === 'true')) return;
    if (!auth.currentUser) { if (status) status.textContent = 'تسجيل دخول الأدمن مطلوب'; return; }
    const button = row.querySelector('[data-retranslate-spec]');
    if (status) status.textContent = 'جارٍ الترجمة...';
    if (button) button.disabled = true;
    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/translate-description`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'specification', property, value }) });
        const result = await response.json().catch(() => ({}));
        const translatedProperty = result.property || result.key_en;
        const translatedValue = result.value || result.value_en;
        if (!response.ok || !result.success || !translatedProperty || !translatedValue) throw new Error(result.error || 'TRANSLATION_FAILED');
        if (force || propertyEnglish?.dataset.manual !== 'true') { propertyEnglish.value = translatedProperty; propertyEnglish.dataset.manual = 'false'; }
        if (force || valueEnglish?.dataset.manual !== 'true') { valueEnglish.value = translatedValue; valueEnglish.dataset.manual = 'false'; }
        if (status) status.textContent = 'تمت الترجمة';
    } catch (error) { console.error('Specification translation failed', { code: error.message }); if (status) status.textContent = 'تعذرت الترجمة؛ يمكنك إدخال English يدويًا.'; }
    finally { if (button) button.disabled = false; }
}

window.openProductModal = function(id = null) {
    closeCategoryModal();
    closeOrderModal();

    const form = document.getElementById('productForm');
    englishDescriptionManuallyEdited = false;
    if (descriptionTranslationTimer) clearTimeout(descriptionTranslationTimer);
    const translationStatus = document.getElementById('translationStatus');
    if (translationStatus) translationStatus.textContent = '';
    form.reset();
    document.getElementById('prodId').value = '';
    resetProductImageState();
    ['prodCpuSocket', 'prodMotherboardSocket', 'prodRamType', 'prodSupportedRamTypes'].forEach((field) => { const element = document.getElementById(field); if (element) element.value = ''; });

    if (id) {
        document.getElementById('productModalTitle').textContent = 'تعديل بيانات المنتج';
        const prod = products.find(p => p.id === id);
        if (prod) {
            document.getElementById('prodId').value = prod.id;
            document.getElementById('prodName').value = prod.name || '';
            document.getElementById('prodCategory').value = prod.categoryId || prod.category || '';
            document.getElementById('prodSubcategory').value = prod.subcategory || '';
            document.getElementById('prodBrand').value = prod.brand || '';
            document.getElementById('prodModel').value = prod.model || '';
            document.getElementById('prodPrice').value = prod.price || '';
            const privatePrice = privatePricesByProduct[id] || {};
            document.getElementById('prodWholesalePrice').value = privatePrice.wholesale_price ?? prod.wholesale_price ?? '';
            document.getElementById('prodSpecialPrice').value = privatePrice.special_price ?? prod.special_price ?? '';
            document.getElementById('prodOriginalPrice').value = prod.originalPrice || '';
            document.getElementById('prodStock').value = prod.stock || '';
            document.getElementById('prodWarranty').value = prod.warranty || '';
            const description = productDescriptionParts(prod.description);
            document.getElementById('prodDescAr').value = description.ar;
            document.getElementById('prodDescEn').value = description.en;
            const existingSpecifications = adminSpecificationEntries(prod.specifications || prod.specs || {});
            document.getElementById('prodSpecsBulk').value = bulkSpecificationsText(existingSpecifications);
            renderBulkSpecificationInvalid([]);
            setBulkSpecificationStatus(existingSpecifications.length ? `تم تحميل ${existingSpecifications.length} مواصفة قديمة` : '');
            renderProductSpecsEditor(existingSpecifications);
            document.getElementById('prodBuilderOnly').checked = prod.builderOnly === true;
            const imageItems = productImageItemsFromProduct(prod);
            setProductImageState(imageItems, imageItems[0]?.id || null);

            const compatibility = prod.compatibility || {};
            document.getElementById('prodCpuSocket').value = compatibility.socket || compatibility.cpuSocket || prod.socket || prod.cpuSocket || '';
            document.getElementById('prodMotherboardSocket').value = compatibility.socket || compatibility.cpuSocket || prod.socket || prod.cpuSocket || '';
            document.getElementById('prodRamType').value = compatibility.ramType || prod.ramType || prod.memoryType || '';
            const supportedRamTypes = compatibility.ramTypes || compatibility.supportedMemory || prod.ramTypes || prod.supportedMemory || [];
            document.getElementById('prodSupportedRamTypes').value = Array.isArray(supportedRamTypes) ? supportedRamTypes.join(', ') : String(supportedRamTypes);

            // Map legacy isHidden to status if status is not explicitly set
            let currentStatus = prod.status;
            if (!currentStatus) {
                currentStatus = prod.isHidden ? 'hidden' : 'published';
            }
            document.getElementById('prodStatus').value = currentStatus;

            renderAdminGallery();
        }
    } else {
        document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد';
        document.getElementById('prodStatus').value = 'published';
        document.getElementById('prodSpecsBulk').value = '';
        renderBulkSpecificationInvalid([]);
        setBulkSpecificationStatus('');
        renderProductSpecsEditor([]);
        document.getElementById('prodBuilderOnly').checked = false;
    }

    updateProductCompatibilityFields();
    setAdminModalOpen(document.getElementById('productModal'), true);
};

window.closeProductModal = function() {
    setAdminModalOpen(document.getElementById('productModal'), false);
    resetProductImageState();
};

document.getElementById('prodCategory')?.addEventListener('change', updateProductCompatibilityFields);

async function translateProductDescription(force = false) {
    const arabic = document.getElementById('prodDescAr')?.value.trim() || '';
    const english = document.getElementById('prodDescEn');
    const status = document.getElementById('translationStatus');
    if (!arabic || (!force && englishDescriptionManuallyEdited)) return;
    if (!auth.currentUser) return;
    if (status) status.textContent = 'جارٍ الترجمة...';
    const button = document.getElementById('retranslateDescriptionBtn');
    if (button) button.disabled = true;
    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/translate-description`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text: arabic })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || !result.translation) throw new Error(result.error || 'TRANSLATION_FAILED');
        english.value = result.translation;
        if (force) englishDescriptionManuallyEdited = false;
        if (status) status.textContent = '';
    } catch (error) {
        console.error('Product description translation failed', { code: error.message });
        if (status) status.textContent = 'تعذرت الترجمة؛ يمكنك إدخال English يدويًا.';
    } finally { if (button) button.disabled = false; }
}

document.getElementById('prodDescEn')?.addEventListener('input', () => { englishDescriptionManuallyEdited = true; });
document.getElementById('prodDescAr')?.addEventListener('input', () => {
    if (descriptionTranslationTimer) clearTimeout(descriptionTranslationTimer);
    if (englishDescriptionManuallyEdited) return;
    descriptionTranslationTimer = setTimeout(() => translateProductDescription(false), 850);
});
document.getElementById('retranslateDescriptionBtn')?.addEventListener('click', () => translateProductDescription(true));

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const specifications = readProductSpecsEditor();
    if (specifications.some((item) => [item.key_ar, item.key_en].some((value) => value.includes('/') || value.includes('.')))) { alert('لا تستخدم / أو . داخل اسم المواصفة.'); return; }
    const retailPrice = Number(document.getElementById('prodPrice').value);
    const wholesaleRaw = document.getElementById('prodWholesalePrice').value;
    const specialRaw = document.getElementById('prodSpecialPrice').value;
    if (!Number.isFinite(retailPrice) || retailPrice <= 0 || (wholesaleRaw && (!Number.isFinite(Number(wholesaleRaw)) || Number(wholesaleRaw) <= 0)) || (specialRaw && (!Number.isFinite(Number(specialRaw)) || Number(specialRaw) <= 0))) { alert('السعر العام يجب أن يكون رقمًا موجبًا. اترك الخاص/الجملة فارغًا أو أدخل رقمًا موجبًا.'); return; }
    const categoryId = document.getElementById('prodCategory').value;
    const existingProduct = id ? products.find((product) => product.id === id) : null;
    let compatibility = existingProduct?.compatibility && typeof existingProduct.compatibility === 'object' ? { ...existingProduct.compatibility } : null;
    if (categoryId === 'cat-cpus') {
        const socket = document.getElementById('prodCpuSocket').value.trim();
        compatibility = socket ? { socket } : {};
    } else if (categoryId === 'cat-motherboards') {
        const socket = document.getElementById('prodMotherboardSocket').value.trim();
        const ramTypes = document.getElementById('prodSupportedRamTypes').value.split(/[,،/|]/).map((item) => item.trim()).filter(Boolean);
        compatibility = { ...(socket ? { socket } : {}), ...(ramTypes.length ? { ramTypes } : {}) };
    } else if (categoryId === 'cat-ram') {
        const ramType = document.getElementById('prodRamType').value.trim();
        compatibility = ramType ? { ramType } : {};
    }
    const imageFields = syncProductImageFields();
    if (productImageItems.some((item) => item.uploadStatus !== 'uploaded' || !item.uploadedUrl)) {
        alert('يرجى رفع جميع صور المنتج إلى GitHub قبل الحفظ.');
        return;
    }
    const prodData = {
        name: document.getElementById('prodName').value.trim(),
        category: categoryId,
        categoryId,
        subcategory: document.getElementById('prodSubcategory').value.trim(),
        brand: canonicalProductBrand(document.getElementById('prodBrand').value, id),
        model: document.getElementById('prodModel').value.trim(),
        price: retailPrice,
        public_price: retailPrice,
        originalPrice: document.getElementById('prodOriginalPrice').value ? Number(document.getElementById('prodOriginalPrice').value) : null,
        stock: document.getElementById('prodStock').value ? Number(document.getElementById('prodStock').value) : null,
        warranty: document.getElementById('prodWarranty').value.trim(),
        description: {
            ar: document.getElementById('prodDescAr').value.trim(),
            en: document.getElementById('prodDescEn').value.trim()
        },
        specifications,
        builderOnly: document.getElementById('prodBuilderOnly').checked === true,
        image: imageFields.primaryUrl,
        images: imageFields.uploaded,
        ...(compatibility && Object.keys(compatibility).length ? { compatibility } : {}),
        status: document.getElementById('prodStatus').value,
        isHidden: document.getElementById('prodStatus').value !== 'published',
        updatedAt: Date.now()
    };
    const privatePrices = { wholesale_price: wholesaleRaw ? Number(wholesaleRaw) : null, special_price: specialRaw ? Number(specialRaw) : null, updatedAt: Date.now(), updatedBy: currentAdminUser?.uid || null };

    if (isDemoMode) {
        if (id) {
            const index = products.findIndex(p => p.id === id);
            if (index !== -1) {
                products[index] = { ...products[index], ...prodData, id };
            }
            alert('تم تعديل المنتج بنجاح في الذاكرة (وضع العرض التجريبي).');
        } else {
            const newId = 'demo-prod-' + Date.now();
            products.unshift({ id: newId, ...prodData, createdAt: Date.now() });
            alert('تمت إضافة المنتج الجديد بنجاح في الذاكرة (وضع العرض التجريبي).');
        }
        updateAllDashboardViews();
        closeProductModal();
        return;
    }

    try {
        if (id) {
            await update(ref(db, 'products/' + id), prodData);
            await update(ref(db, 'private_prices/' + id), privatePrices);
            await set(ref(db, `auditLogs/${push(ref(db, 'auditLogs')).key}`), { action: 'product_pricing_changed', productId: id, actorUid: currentAdminUser.uid, publicPrice: retailPrice, specialPrice: privatePrices.special_price, wholesalePrice: privatePrices.wholesale_price, timestamp: Date.now() });
            alert('تم تحديث المنتج بنجاح!');
        } else {
            prodData.createdAt = Date.now();
            const productRef = push(ref(db, 'products'));
            await set(productRef, prodData);
            await set(ref(db, 'private_prices/' + productRef.key), privatePrices);
            await set(ref(db, `auditLogs/${push(ref(db, 'auditLogs')).key}`), { action: 'product_pricing_created', productId: productRef.key, actorUid: currentAdminUser.uid, publicPrice: retailPrice, specialPrice: privatePrices.special_price, wholesalePrice: privatePrices.wholesale_price, timestamp: Date.now() });
            alert('تمت إضافة المنتج الجديد بنجاح!');
        }
        closeProductModal();
    } catch (error) {
        console.error(error);
        alert('خطأ أثناء حفظ المنتج في Firebase: ' + error.message);
    }
});

window.toggleProductVisibility = async function(id, currentHidden) {
    if (isDemoMode) {
        const prod = products.find(p => p.id === id);
        if (prod) {
            prod.isHidden = !currentHidden;
            updateAllDashboardViews();
        }
        return;
    }
    try {
        await update(ref(db, 'products/' + id), { isHidden: !currentHidden });
    } catch (err) {
        alert('فشل تغيير حالة العرض: ' + err.message);
    }
};

window.deleteProduct = async function(id) {
    if (!confirm('هل أنت متأكد تماماً من رغبتك بحذف هذا المنتج نهائياً من المتجر وقاعدة البيانات؟')) return;
    if (isDemoMode) {
        products = products.filter(p => p.id !== id);
        updateAllDashboardViews();
        alert('تم حذف المنتج بنجاح من قائمة المعاينة.');
        return;
    }
    try {
        await remove(ref(db, 'products/' + id));
        alert('تم حذف المنتج بنجاح.');
    } catch (err) {
        alert('فشل حذف المنتج: ' + err.message);
    }
};

// ================= CATEGORIES MANAGEMENT =================
function categoryOrderValue(category) {
    const value = Number(category?.order);
    return Number.isInteger(value) && value >= 1 ? value : Number.POSITIVE_INFINITY;
}

function sortCategoriesForOrder(items) {
    return [...items].sort((a, b) => categoryOrderValue(a) - categoryOrderValue(b) || String(a.id || '').localeCompare(String(b.id || '')));
}

function categoryParentId(category) {
    const value = category && Object.prototype.hasOwnProperty.call(category, 'parentId')
        ? category.parentId
        : category?.parentCategory ?? category?.parent
            ?? categories.find((parent) => (parent.subcategoryIds || []).includes(category?.id))?.id;
    return value === undefined || value === null || value === '' ? null : String(value);
}

function categoryChildrenOf(parentId, items = categories) {
    return items.filter((category) => categoryParentId(category) === String(parentId)
        || items.some((parent) => parent.id === parentId && (parent.subcategoryIds || []).includes(category.id)));
}

function categoryIsChild(category, items = categories) {
    return !!categoryParentId(category) || items.some((parent) => (parent.subcategoryIds || []).includes(category.id));
}

function categoryHasCycle(categoryId, parentId, items = categories) {
    if (!parentId) return false;
    const byId = new Map(items.map((category) => [category.id, category]));
    let current = String(parentId);
    const visited = new Set();
    while (current) {
        if (current === String(categoryId) || visited.has(current)) return true;
        visited.add(current);
        current = categoryParentId(byId.get(current));
    }
    return false;
}

function categoryGroup(items, parentId) {
    return sortCategoriesForOrder(items.filter((category) => categoryParentId(category) === (parentId || null)));
}

function reorderCategoryGroup(items, movingId, requestedPosition, parentId) {
    const ordered = categoryGroup(items, parentId);
    const movingIndex = ordered.findIndex((category) => category.id === movingId);
    const moving = movingIndex === -1 ? null : ordered.splice(movingIndex, 1)[0];
    if (!moving) return ordered;
    const position = clampCategoryPosition(requestedPosition, ordered.length + 1);
    ordered.splice(position - 1, 0, moving);
    return ordered.map((category, index) => ({ ...category, order: index + 1 }));
}

function categoryOrderUpdatesForGroups(items, parentIds) {
    const updates = {};
    [...new Set(parentIds.map((parentId) => parentId || null))].forEach((parentId) => {
        categoryGroup(items, parentId).forEach((category, index) => {
            updates[`categories/${category.id}/order`] = index + 1;
        });
    });
    return updates;
}

function updateCategoryParentSelect(currentId = null, selectedParentId = null) {
    const select = document.getElementById('catParent');
    if (!select) return;
    const candidates = sortCategoriesForOrder(categories).filter((category) => {
        if (category.id === currentId) return false;
        // Level-one hierarchy only: a child cannot become a parent.
        return !categoryIsChild(category, categories) && !categoryHasCycle(currentId, category.id, categories);
    });
    select.innerHTML = '<option value="">بدون قسم أب / قسم رئيسي</option>' + candidates
        .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name || category.id)}</option>`)
        .join('');
    select.value = selectedParentId || '';
}

function clampCategoryPosition(value, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return max;
    return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function reorderCategories(items, movingId, requestedPosition) {
    const ordered = sortCategoriesForOrder(items);
    const movingIndex = ordered.findIndex((category) => category.id === movingId);
    const moving = movingIndex === -1 ? null : ordered.splice(movingIndex, 1)[0];
    if (!moving) return ordered;
    const position = clampCategoryPosition(requestedPosition, ordered.length + 1);
    ordered.splice(position - 1, 0, moving);
    return ordered.map((category, index) => ({ ...category, order: index + 1 }));
}

function categoryOrderUpdates(ordered, extraUpdates = {}) {
    const updates = { ...extraUpdates };
    ordered.forEach((category, index) => {
        updates[`categories/${category.id}/order`] = index + 1;
    });
    return updates;
}

function categoryDataUpdates(id, data) {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [`categories/${id}/${key}`, value]));
}

function renderCategoriesManagementTable() {
    const tbody = document.getElementById('categoriesFullTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    categories = sortCategoriesForOrder(categories);

    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:40px;color:#888;">لا توجد أقسام مسجلة. انقر على "إضافة قسم جديد" للبدء</td></tr>';
        return;
    }

    categories.forEach(cat => {
        const prodCount = products.filter(p => p.categoryId === cat.id || p.category === cat.id).length;
        const isHidden = !!cat.isHidden;
        const imageUrl = cat.image || '/images/default-category.svg';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${imageUrl}" class="tp-img" alt="${cat.name}" style="border-radius:4px;"></td>
            <td><strong>${cat.name}</strong><br><small style="color:#777;">${cat.description || 'لا يوجد وصف'}</small></td>
            <td><code>${cat.id}</code></td>
            <td>${escapeHtml(categoryParentId(cat) ? getCategoryName(categoryParentId(cat)) : 'قسم رئيسي')}</td>
            <td><strong>${Number(cat.order) || '—'}</strong></td>
            <td><strong style="color:var(--dark);">${prodCount} منتج</strong></td>
            <td>
                <span class="visibility-badge ${isHidden ? 'hidden' : 'visible'}">
                    <i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isHidden ? 'مخفي' : 'ظاهر'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="table-btn btn-edit" title="تعديل القسم" onclick="openCategoryModal('${cat.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> تعديل
                    </button>
                    <button class="table-btn btn-toggle" title="${isHidden ? 'إظهار القسم' : 'إخفاء القسم'}" onclick="toggleCategoryVisibility('${cat.id}', ${isHidden})">
                        <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'إظهار' : 'إخفاء'}
                    </button>
                    <button class="table-btn btn-delete" title="حذف القسم" onclick="deleteCategory('${cat.id}')">
                        <i class="fa-solid fa-trash"></i> حذف
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openCategoryModal = function(id = null) {
    closeProductModal();
    closeOrderModal();
    originalCategoryImageFile = null;
    if (categoryImageObjectUrl) {
        URL.revokeObjectURL(categoryImageObjectUrl);
        categoryImageObjectUrl = null;
    }

    const form = document.getElementById('categoryForm');
    form.reset();
    document.getElementById('catId').value = '';
    updateCategoryParentSelect();

    if (id) {
        document.getElementById('categoryModalTitle').textContent = 'تعديل القسم';
        const cat = categories.find(c => c.id === id);
        if (cat) {
            document.getElementById('catId').value = cat.id;
            document.getElementById('catName').value = cat.name || '';
            document.getElementById('catImage').value = cat.image || '';
            document.getElementById('catOrder').value = Number.isFinite(Number(cat.order)) && Number(cat.order) >= 1 ? Number(cat.order) : '';
            updateCategoryParentSelect(cat.id, categoryParentId(cat));
            document.getElementById('catDesc').value = cat.description || '';
            document.getElementById('catHidden').checked = !!cat.isHidden;
        }
    } else {
        document.getElementById('categoryModalTitle').textContent = 'إضافة قسم جديد';
        document.getElementById('catImage').value = '';
        document.getElementById('catOrder').value = categories.length + 1;
        updateCategoryParentSelect();
        document.getElementById('catHidden').checked = false;
    }

    setAdminModalOpen(document.getElementById('categoryModal'), true);
};

window.closeCategoryModal = function() {
    setAdminModalOpen(document.getElementById('categoryModal'), false);
};

document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('catId').value;
    const parentId = document.getElementById('catParent')?.value || null;
    if (id && parentId === id) {
        alert('لا يمكن للقسم أن يختار نفسه كقسم أب.');
        return;
    }
    if (categoryHasCycle(id, parentId, categories)) {
        alert('العلاقة المطلوبة تسبب تداخلاً دائريًا غير مسموح.');
        return;
    }
    const orderInput = document.getElementById('catOrder')?.value.trim();
    const requestedOrder = orderInput === '' ? categories.length + 1 : Number(orderInput);
    const existingParentId = id ? categoryParentId(categories.find((category) => category.id === id)) : null;
    const siblingCount = categoryGroup(categories.filter((category) => category.id !== id), parentId).length;
    const maxPosition = Math.max(siblingCount + 1, 1);
    const rawOrder = clampCategoryPosition(requestedOrder, maxPosition);
    const catData = {
        name: document.getElementById('catName').value.trim(),
        image: document.getElementById('catImage').value,
        description: document.getElementById('catDesc').value.trim(),
        isHidden: document.getElementById('catHidden').checked,
        parentId,
        order: rawOrder,
        updatedAt: Date.now()
    };

    if (isDemoMode) {
        if (id) {
            const current = categories.find((category) => category.id === id);
            if (current) {
                const next = categories.map((category) => category.id === id ? { ...category, ...catData } : category);
                const reordered = reorderCategoryGroup(next, id, rawOrder, parentId);
                categories = next.map((category) => reordered.find((item) => item.id === category.id) || category);
                const oldGroup = categoryGroup(categories, existingParentId);
                oldGroup.forEach((category, index) => { category.order = index + 1; });
            }
            alert('تم تعديل القسم بنجاح في الذاكرة (وضع العرض التجريبي).');
        } else {
            const newId = 'demo-cat-' + Date.now();
            const next = [...categories, { id: newId, ...catData, createdAt: Date.now() }];
            const reordered = reorderCategoryGroup(next, newId, rawOrder, parentId);
            categories = next.map((category) => reordered.find((item) => item.id === category.id) || category);
            alert('تمت إضافة القسم بنجاح إلى قائمة المعاينة (وضع العرض التجريبي).');
        }
        updateAllDashboardViews();
        closeCategoryModal();
        return;
    }

    try {
        if (id) {
            const next = categories.map((category) => category.id === id ? { ...category, ...catData } : category);
            const reordered = reorderCategoryGroup(next, id, rawOrder, parentId);
            const updates = { ...categoryDataUpdates(id, catData), ...categoryOrderUpdatesForGroups(next, [existingParentId, parentId]) };
            await update(ref(db), updates);
            categories = next.map((category) => reordered.find((item) => item.id === category.id) || category);
            categoryGroup(categories, existingParentId).forEach((category, index) => { category.order = index + 1; });
            alert('تم تعديل القسم بنجاح!');
        } else {
            catData.createdAt = Date.now();
            const categoryRef = push(ref(db, 'categories'));
            const newCategory = { id: categoryRef.key, ...catData };
            const next = [...categories, newCategory];
            const reordered = reorderCategoryGroup(next, categoryRef.key, rawOrder, parentId);
            await update(ref(db), { ...categoryDataUpdates(categoryRef.key, catData), ...categoryOrderUpdatesForGroups(next, [parentId]) });
            categories = next.map((category) => reordered.find((item) => item.id === category.id) || category);
            alert('تمت إضافة القسم بنجاح!');
        }
        updateAllDashboardViews();
        closeCategoryModal();
    } catch (err) {
        alert('خطأ أثناء حفظ القسم: ' + err.message);
    }
});

window.toggleCategoryVisibility = async function(id, currentHidden) {
    if (isDemoMode) {
        const cat = categories.find(c => c.id === id);
        if (cat) {
            cat.isHidden = !currentHidden;
            updateAllDashboardViews();
        }
        return;
    }
    try {
        await update(ref(db, 'categories/' + id), { isHidden: !currentHidden });
    } catch (err) {
        alert('فشل تغيير حالة القسم: ' + err.message);
    }
};

window.deleteCategory = async function(id) {
    const relatedCount = products.filter(p => p.categoryId === id || p.category === id).length;
    const childCategories = categoryChildrenOf(id, categories);
    let msg = 'هل أنت متأكد من حذف هذا القسم؟';
    if (childCategories.length > 0) {
        msg = `هذا القسم يحتوي ${childCategories.length} أقسامًا فرعية. سيتم تحويلها إلى أقسام رئيسية دون حذفها. هل تريد المتابعة؟`;
    }
    if (relatedCount > 0) {
        msg = `تحذير: يوجد ${relatedCount} منتج مرتبط بهذا القسم! هل أنت متأكد من حذفه؟`;
    }
    if (!confirm(msg)) return;

    if (isDemoMode) {
        const remaining = categories.filter(c => c.id !== id).map((category) => categoryParentId(category) === id ? { ...category, parentId: null } : category);
        categories = remaining;
        categoryGroup(categories, null).forEach((category, index) => { category.order = index + 1; });
        updateAllDashboardViews();
        alert('تم حذف القسم بنجاح من قائمة المعاينة.');
        return;
    }

    try {
        const remaining = categories.filter((category) => category.id !== id).map((category) => categoryParentId(category) === id ? { ...category, parentId: null } : category);
        const updates = { [`categories/${id}`]: null, ...categoryOrderUpdatesForGroups(remaining, [null]) };
        childCategories.forEach((child) => { updates[`categories/${child.id}/parentId`] = null; });
        await update(ref(db), updates);
        alert('تم حذف القسم بنجاح.');
    } catch (err) {
        alert('فشل حذف القسم: ' + err.message);
    }
};

// ================= ORDERS MANAGEMENT =================
window.filterOrdersTab = function(status) {
    activeOrderTab = status;
    document.querySelectorAll('.order-status-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));

    // Set active tab styling
    const tabs = document.querySelectorAll('.order-status-tabs .tab-btn');
    if (status === 'all') tabs[0]?.classList.add('active');
    else if (status === 'pending') tabs[1]?.classList.add('active');
    else if (status === 'completed') tabs[2]?.classList.add('active');
    else if (status === 'cancelled') tabs[3]?.classList.add('active');

    renderOrdersManagementTable();
};

function renderOrdersManagementTable() {
    const tbody = document.getElementById('ordersFullTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = orders;
    if (activeOrderTab === 'pending') {
        filtered = orders.filter(o => o.status === 'pending' || o.status === 'جديد');
    } else if (activeOrderTab === 'completed') {
        filtered = orders.filter(o => o.status === 'completed' || o.status === 'مكتمل');
    } else if (activeOrderTab === 'cancelled') {
        filtered = orders.filter(o => o.status === 'cancelled' || o.status === 'ملغي');
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:40px;color:#888;">لا توجد طلبات في هذا التبويب</td></tr>';
        return;
    }

    filtered.forEach((order, idx) => {
        const statusClass = (order.status === 'pending' || order.status === 'جديد') ? 'status-pending' : (order.status === 'cancelled' ? 'status-cancelled' : 'status-completed');
        const statusText = (order.status === 'pending' || order.status === 'جديد') ? 'قيد التجهيز' : (order.status === 'cancelled' ? 'ملغي' : 'مكتمل');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${order.orderNumber || idx + 1}</strong></td>
            <td><strong>${order.customerName || 'عميل'}</strong></td>
            <td><a href="tel:${order.customerPhone}" style="color:var(--primary);font-weight:700;">${order.customerPhone || '-'}</a></td>
            <td>${order.governorate || ''} - ${order.city || ''}</td>
            <td><strong style="color:var(--dark);">${formatPrice(order.grandTotal || 0)}</strong></td>
            <td>${formatDate(order.timestamp)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="table-btn btn-edit" onclick="viewOrder('${order.id}')">
                    <i class="fa-solid fa-list-check"></i> تفاصيل وتحديث
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// View and Update Order Modal
window.viewOrder = function(orderId) {
    closeProductModal();
    closeCategoryModal();

    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const content = document.getElementById('orderDetailsContent');

    let itemsHtml = '<ul style="list-style:none;padding:0;margin-top:12px;">';
    if (order.items) {
        const itemsArray = Array.isArray(order.items) ? order.items : Object.values(order.items);
        itemsArray.forEach(item => {
            itemsHtml += `
                <li style="padding:10px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${item.name}</strong>
                        <span style="display:block;font-size:0.8rem;color:#777;">الكمية: ${item.quantity}</span>
                    </div>
                    <strong>${formatPrice((item.price || 0) * (item.quantity || 1))}</strong>
                </li>`;
        });
    }
    itemsHtml += '</ul>';

    const currentStatus = order.status || 'pending';

    content.innerHTML = `
        <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;border:1px solid #eee;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <p><strong>رقم الطلب:</strong> #${order.orderNumber || orderId}</p>
                <p><strong>تاريخ الطلب:</strong> ${formatDate(order.timestamp)}</p>
                <p><strong>اسم العميل:</strong> ${order.customerName}</p>
                <p><strong>رقم الهاتف:</strong> <a href="tel:${order.customerPhone}" style="color:var(--primary);">${order.customerPhone}</a></p>
            </div>
            <p style="margin-top:8px;"><strong>طريقة الاستلام:</strong> ${order.deliveryMethod === 'pickup' ? 'استلام من المتجر' : 'توصيل'}</p>
            ${order.deliveryMethod === 'pickup' ? '' : `<p style="margin-top:8px;"><strong>العنوان بالتفصيل:</strong> ${order.governorate} - ${order.city} - ${order.address}</p>`}
            ${order.notes ? `<p style="margin-top:8px;color:#c62828;"><strong>ملاحظات العميل:</strong> ${order.notes}</p>` : ''}
        </div>

        <h4 style="font-weight:800;color:var(--dark);"><i class="fa-solid fa-boxes-packing"></i> المنتجات المطلوبة</h4>
        ${itemsHtml}

        <div style="margin-top:20px;padding-top:15px;border-top:2px solid #eee;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>مجموع المنتجات:</span> <strong>${formatPrice(order.subtotal || 0)}</strong></div>
            ${order.deliveryMethod === 'pickup' ? '' : `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>أجور التوصيل:</span> <strong>${formatPrice(order.deliveryFee || 0)}</strong></div>`}
            <div style="display:flex;justify-content:space-between;color:var(--primary);font-size:1.25rem;font-weight:900;margin-top:10px;padding-top:10px;border-top:1px dashed #ddd;">
                <span>المبلغ الكلي:</span> <strong>${formatPrice(order.grandTotal || 0)}</strong>
            </div>
        </div>

        <div style="margin-top:25px;background:#fff8e1;padding:16px;border-radius:8px;border:1px solid #ffe082;">
            <label style="font-weight:800;display:block;margin-bottom:8px;color:#f57f17;"><i class="fa-solid fa-pen-to-square"></i> تحديث حالة الطلب بصلاحية سوبر مشرف:</label>
            <div style="display:flex;gap:10px;">
                <select id="updateOrderStatus" style="padding:10px;border-radius:6px;border:1px solid #ccc;flex-grow:1;font-weight:700;">
                    <option value="pending" ${currentStatus==='pending'||currentStatus==='جديد'?'selected':''}>قيد التجهيز</option>
                    <option value="completed" ${currentStatus==='completed'||currentStatus==='مكتمل'?'selected':''}>مكتمل (تم التسليم)</option>
                    <option value="cancelled" ${currentStatus==='cancelled'||currentStatus==='ملغي'?'selected':''}>ملغي</option>
                </select>
                <button class="btn btn-primary" onclick="saveOrderStatus('${order.id}')"><i class="fa-solid fa-check"></i> حفظ الحالة</button>
            </div>
        </div>
    `;

    setAdminModalOpen(document.getElementById('orderModal'), true);
};

window.closeOrderModal = function() {
    setAdminModalOpen(document.getElementById('orderModal'), false);
};

window.saveOrderStatus = async function(orderId) {
    const newStatus = document.getElementById('updateOrderStatus').value;
    if (isDemoMode) {
        const ord = orders.find(o => o.id === orderId);
        if (ord) {
            ord.status = newStatus;
            updateAllDashboardViews();
            alert('تم تحديث حالة الطلب بنجاح في الذاكرة (وضع العرض التجريبي).');
            closeOrderModal();
        }
        return;
    }
    try {
        await update(ref(db, 'orders/' + orderId), {
            status: newStatus,
            updatedAt: Date.now()
        });
        alert('تم تحديث حالة الطلب بنجاح في Firebase.');
        closeOrderModal();
    } catch (error) {
        console.error(error);
        alert('فشل تحديث حالة الطلب: ' + error.message);
    }
};

// ================= MODAL GLOBAL OUTSIDE CLICK & ESCAPE =================
window.addEventListener('click', (e) => {
    const modals = [
        document.getElementById('productModal'),
        document.getElementById('categoryModal'),
        document.getElementById('orderModal')
    ];
    modals.forEach(modal => {
        if (modal && e.target === modal) {
            if (modal.id === 'productModal') closeProductModal();
            else if (modal.id === 'categoryModal') closeCategoryModal();
            else if (modal.id === 'orderModal') closeOrderModal();
        }
    });
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProductModal();
        closeCategoryModal();
        closeOrderModal();
    }
});

/* ================= LEGACY IMAGE UPLOAD (REMOVED) =================
   The original implementation compressed every file to WebP and waited for
   a fixed deployment polling timeout. It is intentionally disabled below;
   the original-file flow is implemented after this block. */
/*
// (currentProcessedImageBase64, currentProcessedImageName, isUploadingImage declared at top of file)

document.getElementById('uploadImageBtn')?.addEventListener('click', () => {
    const fileInput = document.getElementById('prodImageFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('الرجاء اختيار صورة أولاً.');
        return;
    }

    const file = fileInput.files[0];
    if (!file.type.match(/image\/(png|jpeg|webp)/)) {
        alert('صيغة غير مدعومة. الرجاء اختيار صورة بصيغة PNG أو JPEG أو WebP.');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 900;
            const MAX_HEIGHT = 900;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const webpDataUrl = canvas.toDataURL('image/webp', 0.85);
            currentProcessedImageBase64 = webpDataUrl.split(',')[1];

            const cleanName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const uniqueId = Date.now().toString(36);
            currentProcessedImageName = `product-${cleanName}-${uniqueId}.webp`;

            document.getElementById('imagePreview').src = webpDataUrl;

            const estimatedBytes = Math.round((currentProcessedImageBase64.length * 3) / 4);
            const kbSize = (estimatedBytes / 1024).toFixed(1);

            document.getElementById('imageDetails').textContent = `الأبعاد: ${Math.round(width)}×${Math.round(height)} بكسل | الحجم المحسّن: ${kbSize} KB | الصيغة: WebP`;
            document.getElementById('imagePreviewContainer').style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

// Category Image Upload Logic
document.getElementById('uploadCatImageBtn')?.addEventListener('click', () => {
    const fileInput = document.getElementById('catImageFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('الرجاء اختيار صورة أولاً.');
        return;
    }

    const file = fileInput.files[0];
    if (!file.type.match(/image\/(png|jpeg|webp)/)) {
        alert('صيغة غير مدعومة. الرجاء اختيار صورة بصيغة PNG أو JPEG أو WebP.');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const webpDataUrl = canvas.toDataURL('image/webp', 0.85);
            currentProcessedImageBase64 = webpDataUrl.split(',')[1];

            const cleanName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const uniqueId = Date.now().toString(36);
            // using product prefix because CF worker expects it for some checks
            currentProcessedImageName = `product-cat-${cleanName}-${uniqueId}.webp`;

            document.getElementById('catImagePreview').src = webpDataUrl;

            const estimatedBytes = Math.round((currentProcessedImageBase64.length * 3) / 4);
            const kbSize = (estimatedBytes / 1024).toFixed(1);

            document.getElementById('catImageDetails').textContent = `الأبعاد: ${Math.round(width)}×${Math.round(height)} بكسل | الحجم المحسّن: ${kbSize} KB | الصيغة: WebP`;
            document.getElementById('catImagePreviewContainer').style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('confirmUploadBtn')?.addEventListener('click', async () => {
    if (isUploadingImage) return;
    if (!currentProcessedImageBase64) {
        alert('الرجاء اختيار صورة ومعاينتها أولاً قبل الرفع.');
        return;
    }

    isUploadingImage = true;

    const btn = document.getElementById('confirmUploadBtn');
    const prepBtn = document.getElementById('uploadImageBtn');
    const prodImageInput = document.getElementById('prodImage');
    const originalText = 'رفع الصورة إلى GitHub';
    const previousImageValue = prodImageInput ? prodImageInput.value : '';

    btn.textContent = 'جاري الرفع إلى GitHub...';
    btn.disabled = true;
    if (prepBtn) prepBtn.disabled = true;

    try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        if (!idToken) throw new Error('AUTH_REQUIRED');

        const byteCharacters = atob(currentProcessedImageBase64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, { type: 'image/webp' });

        const formData = new FormData();
        formData.append('image', blob, currentProcessedImageName);
        formData.append('filename', currentProcessedImageName);

        const response = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/products/upload-image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'IMAGE_UPLOAD_FAILED');
        }

        btn.textContent = 'تم الرفع! بانتظار اكتمال النشر...';

        let attempts = 0;
        const maxAttempts = 15;
        let isAvailable = false;

        while (attempts < maxAttempts) {
            attempts++;
            btn.textContent = `جاري التحقق من النشر (${attempts}/${maxAttempts})...`;
            try {
                const verifyUrl = `${data.imageUrl}?_t=${Date.now()}`;
                const checkRes = await fetch(verifyUrl, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Accept': 'image/webp,image/*;q=0.8' }
                });

                const contentType = (checkRes.headers.get('content-type') || '').toLowerCase();
                if (checkRes.ok && (contentType.includes('image/webp') || contentType.startsWith('image/')) && !contentType.includes('text/html')) {
                    isAvailable = true;
                    break;
                }
            } catch (e) {
                console.warn('Polling check error:', e);
            }
            await new Promise(r => setTimeout(r, 4000));
        }

        if (!isAvailable) {
            if (prodImageInput) prodImageInput.value = previousImageValue;
            btn.textContent = 'انتهت المهلة - لم تُنشر بعد';
            btn.style.backgroundColor = '#c62828';
            alert('تم الرفع إلى GitHub بنجاح، ولكن انتهت مهلة الانتظار قبل اكتمال نشر الصورة على المتجر. تم الاحتفاظ بالصورة السابقة للمنتج تجنباً للروابط المكسورة.');
            return;
        }

        const canonicalImageUrl = data.rawUrl || data.imageUrl || data.path;
        if (prodImageInput) prodImageInput.value = canonicalImageUrl;
        if (prodImageInput && document.getElementById('imagePreviewContainer')) {
            if (productImageItems.length < 5) {
                setProductImageState([...productImageItems, createRemoteProductImageItem(canonicalImageUrl, productImageItems.length === 0)]);
            } else {
                alert('لا يمكن إضافة أكثر من 5 صور للمنتج.');
            }
        }
        btn.textContent = 'تم توفر الصورة بنجاح!';
        btn.style.backgroundColor = '#2e7d32';

        setTimeout(() => {
            const preview = document.getElementById('imagePreviewContainer');
            if (preview) preview.style.display = 'none';
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 3000);

    } catch (error) {
        if (prodImageInput) prodImageInput.value = previousImageValue;
        console.error("Upload failed:", error);
        alert(error.message === 'Failed to fetch' ? 'فشل الاتصال بالخادم. يرجى التأكد من إعداد Cloudflare Worker وتحديث رابط SPIDER_BACKEND_ENDPOINT.' : `فشل الرفع: ${error.message}`);
        btn.textContent = 'إعادة المحاولة';
        btn.style.backgroundColor = '#c62828';
    } finally {
        isUploadingImage = false;
        btn.disabled = false;
        if (prepBtn) prepBtn.disabled = false;
    }
});

// Category Image Upload API call
document.getElementById('confirmCatUploadBtn')?.addEventListener('click', async () => {
    if (isUploadingImage) return;
    if (!currentProcessedImageBase64) {
        alert('الرجاء اختيار صورة ومعاينتها أولاً قبل الرفع.');
        return;
    }

    isUploadingImage = true;

    const btn = document.getElementById('confirmCatUploadBtn');
    const prepBtn = document.getElementById('uploadCatImageBtn');
    const catImageInput = document.getElementById('catImage');
    const originalText = 'رفع الصورة إلى GitHub';
    const previousImageValue = catImageInput ? catImageInput.value : '';

    btn.textContent = 'جاري الرفع إلى GitHub...';
    btn.disabled = true;
    if (prepBtn) prepBtn.disabled = true;

    try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        if (!idToken) throw new Error('AUTH_REQUIRED');

        const byteCharacters = atob(currentProcessedImageBase64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, { type: 'image/webp' });

        const formData = new FormData();
        formData.append('image', blob, currentProcessedImageName);
        formData.append('filename', currentProcessedImageName);

        const response = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/products/upload-image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'IMAGE_UPLOAD_FAILED');
        }

        btn.textContent = 'تم الرفع! بانتظار اكتمال النشر...';

        let attempts = 0;
        const maxAttempts = 15;
        let isAvailable = false;

        while (attempts < maxAttempts) {
            attempts++;
            btn.textContent = `جاري التحقق من النشر (${attempts}/${maxAttempts})...`;
            try {
                const verifyUrl = `${data.imageUrl}?_t=${Date.now()}`;
                const checkRes = await fetch(verifyUrl, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Accept': 'image/webp,image/*;q=0.8' }
                });

                const contentType = (checkRes.headers.get('content-type') || '').toLowerCase();
                if (checkRes.ok && (contentType.includes('image/webp') || contentType.startsWith('image/')) && !contentType.includes('text/html')) {
                    isAvailable = true;
                    break;
                }
            } catch (e) {
                console.warn('Polling check error:', e);
            }
            await new Promise(r => setTimeout(r, 4000));
        }

        if (!isAvailable) {
            if (catImageInput) catImageInput.value = previousImageValue;
            btn.textContent = 'انتهت المهلة - لم تُنشر بعد';
            btn.style.backgroundColor = '#c62828';
            alert('تم الرفع إلى GitHub بنجاح، ولكن انتهت مهلة الانتظار. سيتم استخدام الصورة السابقة مؤقتاً.');
            return;
        }

        if (catImageInput) catImageInput.value = data.path;
        btn.textContent = 'تم توفر الصورة بنجاح!';
        btn.style.backgroundColor = '#2e7d32';

        setTimeout(() => {
            const preview = document.getElementById('catImagePreviewContainer');
            if (preview) preview.style.display = 'none';
        }, 1500);

    } catch (err) {
        if (catImageInput) catImageInput.value = previousImageValue;
        btn.textContent = 'فشل الرفع!';
        btn.style.backgroundColor = '#c62828';
        console.error("Upload Error:", err);
        alert('حدث خطأ أثناء الرفع: ' + err.message);
    } finally {
        isUploadingImage = false;
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
            btn.disabled = false;
            if (prepBtn) prepBtn.disabled = false;
            currentProcessedImageBase64 = null;
        }, 3000);
    }
});

*/
// ================= CATALOG REVIEW (DRAFTS) =================

// Original-file upload flow. The legacy handlers above are intercepted in the
// capture phase so existing unrelated Admin flows remain untouched.
const IMAGE_UPLOAD_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'image/bmp', 'image/heic', 'image/heif'
]);

function imageUploadErrorMessage(code, upstreamStatus = '') {
    const messages = {
        AUTH_REQUIRED: 'انتهت جلسة الدخول. سجّل الدخول مجدداً.',
        IMAGE_REQUIRED: 'لم يتم اختيار صورة.',
        IMAGE_LIMIT: 'لا يمكن إضافة أكثر من 5 صور للمنتج.',
        IMAGE_DUPLICATE: 'هذه الصورة مضافة مسبقاً.',
        IMAGE_TYPE_UNSUPPORTED: 'نوع الصورة غير مدعوم أو لا يطابق محتوى الملف.',
        IMAGE_TOO_LARGE: 'حجم الصورة أكبر من الحد المسموح به للخدمة.',
        GITHUB_UPLOAD_NOT_CONFIGURED: 'خدمة تخزين الصور غير مهيأة.',
        GITHUB_UNAUTHORIZED: 'رمز GitHub غير صالح أو منتهي الصلاحية.',
        GITHUB_FORBIDDEN: 'رمز GitHub لا يملك صلاحية الكتابة إلى المستودع.',
        GITHUB_PATH_INVALID: 'مسار الصورة أو المستودع غير صحيح في GitHub.',
        GITHUB_CONFLICT: 'تعذر إنشاء ملف الصورة بسبب تعارض في GitHub.',
        GITHUB_VALIDATION_FAILED: 'رفض GitHub بيانات ملف الصورة أو مساره.',
        GITHUB_UPLOAD_FAILED: 'فشل تخزين الصورة في الخدمة. راجع حالة GitHub في Network.',
        AUTH_INVALID: 'تعذر التحقق من صلاحية الحساب.',
        FORBIDDEN: 'لا تملك صلاحية رفع الصور.',
        NETWORK_ERROR: 'انقطع الاتصال أثناء رفع الصورة.'
    };
    const message = messages[code] || `فشل رفع الصورة: ${code || 'خطأ غير معروف'}`;
    return upstreamStatus ? `${message} (GitHub ${upstreamStatus})` : message;
}

function safeImageName(name, fallback = 'image') {
    const parts = String(name || '').split('.');
    const extension = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const base = parts.join('.').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || fallback;
    return `${base}.${extension || 'img'}`;
}

function prepareOriginalImage(file, previewId, detailsId, containerId, kind) {
    if (!file || !String(file.type || '').toLowerCase().startsWith('image/')) {
        throw new Error('IMAGE_TYPE_UNSUPPORTED');
    }
    if (file.type && !IMAGE_UPLOAD_MIME_TYPES.has(file.type.toLowerCase())) {
        throw new Error('IMAGE_TYPE_UNSUPPORTED');
    }
    const nextUrl = URL.createObjectURL(file);
    const previousUrl = categoryImageObjectUrl;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    categoryImageObjectUrl = nextUrl;
    originalCategoryImageFile = file;
    const preview = document.getElementById(previewId);
    const details = document.getElementById(detailsId);
    const container = document.getElementById(containerId);
    preview.src = nextUrl;
    preview.onload = () => {
        details.textContent = `الأبعاد الأصلية: ${preview.naturalWidth}×${preview.naturalHeight} بكسل | الحجم الأصلي: ${(file.size / 1024 / 1024).toFixed(2)} MB | MIME: ${file.type || 'غير معروف'}`;
    };
    preview.onerror = () => {
        details.textContent = `تم اختيار الملف الأصلي (${(file.size / 1024 / 1024).toFixed(2)} MB). المعاينة تعتمد على دعم المتصفح لهذا النوع.`;
    };
    container.style.display = 'block';
}

function prepareProductImages(files) {
    const selected = [...(files || [])];
    if (!selected.length) throw new Error('IMAGE_REQUIRED');
    if (selected.some((file) => !file || !String(file.type || '').toLowerCase().startsWith('image/'))) throw new Error('IMAGE_TYPE_UNSUPPORTED');
    if (selected.some((file) => !IMAGE_UPLOAD_MIME_TYPES.has(String(file.type || '').toLowerCase()))) throw new Error('IMAGE_TYPE_UNSUPPORTED');
    const signatures = new Set(productImageItems.filter((item) => item.sourceType === 'local').map((item) => item.signature));
    const available = Math.max(0, 5 - productImageItems.length);
    const accepted = [];
    for (const file of selected) {
        const signature = `${file.name}:${file.size}:${file.lastModified}`;
        if (signatures.has(signature)) continue;
        if (accepted.length >= available) break;
        signatures.add(signature);
        accepted.push(createLocalProductImageItem(file));
    }
    if (!accepted.length) throw new Error(selected.length > available ? 'IMAGE_LIMIT' : 'IMAGE_DUPLICATE');
    if (accepted.length < selected.length) alert(`تمت إضافة ${accepted.length} صورة فقط. الحد الأقصى هو 5 صور، وتم تجاهل الصور المكررة أو الزائدة.`);
    const nextItems = [...productImageItems, ...accepted];
    setProductImageState(nextItems, activeProductImageId || accepted[0]?.id);
    const fileInput = document.getElementById('prodImageFile');
    if (fileInput) fileInput.value = '';
}

function uploadOriginalImage(file, targetInputId, buttonId, prepButtonId, progressId, statusId, kind) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!file) throw new Error('IMAGE_REQUIRED');
            const uploadKind = String(kind || 'category').toLowerCase();
            const permission = uploadKind === 'brand' ? 'brands' : 'categories';
            if (uploadKind === 'brand' ? !canManageBrandManagement() : (!window.isSuperAdmin && window.currentAdminPermissions?.[permission] !== true)) {
                throw new Error('FORBIDDEN');
            }
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
            if (!token) throw new Error('AUTH_REQUIRED');
            const formData = new FormData();
            const uniqueSuffix = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12);
            const operation = uploadKind === 'brand' ? 'brand' : 'category';
            const filename = `${uploadKind}-${Date.now()}-${uniqueSuffix}-${safeImageName(file.name)}`;
            formData.append('image', file, file.name);
            formData.append('filename', filename);
            formData.append('contentType', file.type || '');
            formData.append('kind', kind);
            formData.append('operation', operation);

            const xhr = new XMLHttpRequest();
            const button = document.getElementById(buttonId);
            const prepButton = document.getElementById(prepButtonId);
            const progress = document.getElementById(progressId);
            const status = document.getElementById(statusId);
            const previousValue = document.getElementById(targetInputId)?.value || '';
            progress.hidden = false;
            progress.value = 0;
            status.textContent = 'جاري رفع الصورة... 0%';
            button.disabled = true;
            prepButton.disabled = true;
            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                progress.value = percent;
                status.textContent = `جاري رفع الصورة... ${percent}%`;
            };
            xhr.onerror = () => reject(new Error('NETWORK_ERROR'));
            xhr.onload = () => {
                let data = {};
                try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* handled below */ }
                if (xhr.status < 200 || xhr.status >= 300 || !data.success) {
                    const error = new Error(data.error || 'IMAGE_UPLOAD_FAILED');
                    error.previousValue = previousValue;
                    error.upstreamStatus = Number.isInteger(data.upstreamStatus) ? data.upstreamStatus : 0;
                    reject(error);
                    return;
                }
                // GitHub Contents does not trigger a Firebase Hosting deploy.
                // Persist the direct raw URL so the storefront can render the
                // just-uploaded file immediately; keep path only as a legacy fallback.
                const canonicalUrl = data.rawUrl || data.imageUrl || data.path;
                document.getElementById(targetInputId).value = canonicalUrl;
                progress.value = 100;
                status.textContent = 'تم رفع الصورة الأصلية بنجاح. يمكنك الآن حفظ المنتج.';
                resolve(data);
            };
            xhr.onloadend = () => {
            };
            xhr.open('POST', `${SPIDER_BACKEND_ENDPOINT}/api/admin/products/upload-image`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        } catch (error) {
            reject(error);
        }
    });
}

function uploadProductImageItem(item, index, total) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!item?.file) throw new Error('IMAGE_REQUIRED');
            const permission = document.getElementById('prodId')?.value ? 'products_edit' : 'products_add';
            if (!window.isSuperAdmin && window.currentAdminPermissions?.[permission] !== true) throw new Error('FORBIDDEN');
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
            if (!token) throw new Error('AUTH_REQUIRED');
            const formData = new FormData();
            const uniqueSuffix = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12);
            const filename = `product-${Date.now()}-${uniqueSuffix}-${safeImageName(item.file.name)}`;
            formData.append('image', item.file, item.file.name);
            formData.append('filename', filename);
            formData.append('contentType', item.file.type || '');
            formData.append('kind', 'product');
            formData.append('operation', permission === 'products_edit' ? 'edit' : 'add');
            const xhr = new XMLHttpRequest();
            activeProductImageUpload = xhr;
            const button = document.getElementById('confirmUploadBtn');
            const prepButton = document.getElementById('uploadImageBtn');
            const progress = document.getElementById('imageUploadProgress');
            const status = document.getElementById('imageUploadStatus');
            item.uploadStatus = 'uploading';
            if (button) { button.disabled = true; button.textContent = `رفع الصور إلى GitHub (${index + 1}/${total})`; }
            if (prepButton) prepButton.disabled = true;
            if (progress) { progress.hidden = false; progress.value = 0; }
            if (status) status.textContent = `جاري رفع الصورة ${index + 1} من ${total}... 0%`;
            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                if (progress) progress.value = percent;
                if (status) status.textContent = `جاري رفع الصورة ${index + 1} من ${total}... ${percent}%`;
            };
            xhr.onerror = () => { item.uploadStatus = 'error'; reject(new Error('NETWORK_ERROR')); };
            xhr.onload = () => {
                let data = {};
                try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* handled below */ }
                if (xhr.status < 200 || xhr.status >= 300 || !data.success) {
                    item.uploadStatus = 'error';
                    const error = new Error(data.error || 'IMAGE_UPLOAD_FAILED');
                    error.upstreamStatus = Number.isInteger(data.upstreamStatus) ? data.upstreamStatus : 0;
                    reject(error);
                    return;
                }
                const canonicalUrl = data.rawUrl || data.imageUrl || data.path;
                revokeProductImagePreview(item);
                item.url = canonicalUrl;
                item.previewUrl = canonicalUrl;
                item.uploadedUrl = canonicalUrl;
                item.file = null;
                item.uploadStatus = 'uploaded';
                syncProductImageFields();
                renderAdminGallery();
                resolve(data);
            };
            xhr.onloadend = () => { if (activeProductImageUpload === xhr) activeProductImageUpload = null; };
            xhr.open('POST', `${SPIDER_BACKEND_ENDPOINT}/api/admin/products/upload-image`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        } catch (error) {
            item.uploadStatus = 'error';
            reject(error);
        }
    });
}

async function uploadPendingProductImages() {
    const pending = productImageItems.filter((item) => item.sourceType === 'local' && item.uploadedUrl === null);
    if (!pending.length) throw new Error('IMAGE_REQUIRED');
    for (let index = 0; index < pending.length; index += 1) await uploadProductImageItem(pending[index], index, pending.length);
    syncProductImageFields();
    updateProductMainPreview();
    document.getElementById('imageDetails').textContent = 'تم رفع الصور الأصلية بنجاح. يمكنك الآن حفظ المنتج.';
}

document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#uploadImageBtn, #uploadCatImageBtn, #confirmUploadBtn, #confirmCatUploadBtn');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const product = target.id.includes('Cat') === false;
    if (target.id === 'uploadImageBtn' || target.id === 'uploadCatImageBtn') {
        const fileInput = document.getElementById(product ? 'prodImageFile' : 'catImageFile');
        try {
            if (product) {
                if (fileInput?.files?.length) prepareProductImages(fileInput.files);
                else updateProductMainPreview();
            }
            else prepareOriginalImage(fileInput?.files?.[0], 'catImagePreview', 'catImageDetails', 'catImagePreviewContainer', 'category');
        } catch (error) {
            console.error('Image preview failed:', error);
            alert(imageUploadErrorMessage(error.message));
        }
        return;
    }
    const file = product
        ? productImageItems.find((item) => item.sourceType === 'local' && item.uploadedUrl === null)?.file
        : originalCategoryImageFile;
    if (!file || isUploadingImage) {
        alert('الرجاء اختيار الصورة ومعاينتها أولاً.');
        return;
    }
    isUploadingImage = true;
    const uploadPromise = product
        ? uploadPendingProductImages()
        : uploadOriginalImage(file, 'catImage', target.id, 'uploadCatImageBtn', 'catImageUploadProgress', 'catImageUploadStatus', 'category');
    uploadPromise
        .then(() => {
            const preview = document.getElementById(product ? 'imagePreviewContainer' : 'catImagePreviewContainer');
            if (preview) preview.style.display = 'block';
        })
        .catch((error) => {
            console.error('Original image upload failed:', error);
            alert(imageUploadErrorMessage(error.message, error.upstreamStatus));
        })
        .finally(() => { isUploadingImage = false; });
}, true);

document.getElementById('prodImageFile')?.addEventListener('change', (event) => {
    try {
        prepareProductImages(event.target.files);
    } catch (error) {
        console.error('Image selection failed:', error);
        alert(imageUploadErrorMessage(error.message));
    } finally {
        event.target.value = '';
    }
});

window.seedDraftCatalog = async function() {
    let newCatsCount = 0;
    let newProdsCount = 0;
    let existingCount = 0;

    const updates = {};

    // Check existing categories
    INITIAL_CATEGORIES.forEach(cat => {
        const exists = categories.find(c => c.id === cat.id);
        if (!exists) {
            updates['categories/' + cat.id] = { ...cat, isHidden: true, status: 'draft' };
            newCatsCount++;
        } else {
            existingCount++;
        }
    });

    // Check existing products
    INITIAL_PRODUCTS.forEach(prod => {
        const exists = products.find(p => p.id === prod.id);
        if (!exists) {
            updates['products/' + prod.id] = { ...prod, isHidden: true, status: 'draft', createdAt: Date.now() };
            newProdsCount++;
        } else {
            existingCount++;
        }
    });

    if (newCatsCount === 0 && newProdsCount === 0) {
        alert('جميع السجلات موجودة مسبقاً. لم يتم العثور على سجلات جديدة لرفعها.');
        return;
    }

    if (!confirm(`معاينة قبل الرفع:\n- أقسام جديدة (مسودات): ${newCatsCount}\n- منتجات جديدة (مسودات): ${newProdsCount}\n- سجلات موجودة مسبقاً (تم تجاهلها): ${existingCount}\n\nهل أنت متأكد من الرفع؟ لا تقلق، لن يتم استبدال أي بيانات حالية.`)) return;

    try {
        await update(ref(db, '/'), updates);
        alert('تم إضافة الكتالوگ كمسودات بنجاح!');
    } catch(err) {
        alert('خطأ أثناء الرفع: ' + err.message);
    }
}

function renderReviewTable() {
    const tbody = document.getElementById('reviewTableBody');
    if (!tbody) return;

    // Only show products with status = 'draft'
    const drafts = products.filter(p => p.status === 'draft');

    tbody.innerHTML = '';

    if (drafts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:40px;color:#888;">لا توجد مسودات بانتظار المراجعة.</td></tr>';
        return;
    }

    drafts.forEach(prod => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${prod.image || '/images/default-product.svg'}" class="tp-img" alt="${prod.name}"></td>
            <td><strong>${prod.name}</strong><br><small>${getCategoryName(prod.categoryId || prod.category)}</small></td>
            <td><strong style="color:var(--primary);">${formatPrice(prod.price)}</strong></td>
            <td><span class="status-badge status-pending">مسودة</span></td>
            <td>
                <div class="table-actions">
                    <button class="table-btn btn-edit" title="مراجعة وتعديل" onclick="openProductModal('${prod.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> مراجعة
                    </button>
                    <button class="table-btn btn-toggle" title="نشر فوراً" onclick="publishDraft('${prod.id}')" style="background:#10b981; color:white; border-color:#10b981;">
                        <i class="fa-solid fa-check"></i> نشر
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.publishDraft = async function(id) {
    if (isDemoMode) {
        const p = products.find(p => p.id === id);
        if (p) {
            p.status = 'published';
            p.isHidden = false;
            updateAllDashboardViews();
        }
        return;
    }

    try {
        await update(ref(db, 'products/' + id), { status: 'published', isHidden: false });
    } catch(err) {
        alert('فشل النشر: ' + err.message);
    }
}

// Ensure updateAllDashboardViews triggers review table rendering
const originalUpdateAllDashboardViews = updateAllDashboardViews;
window.updateAllDashboardViews = function() {
    originalUpdateAllDashboardViews();
    renderReviewTable();

    // Update review badge
    const badge = document.getElementById('reviewBadge');
    if (badge) {
        const draftsCount = products.filter(p => p.status === 'draft').length;
        badge.textContent = draftsCount;
        badge.style.display = draftsCount > 0 ? 'inline-block' : 'none';
    }
};

// ================= SETTINGS MANAGEMENT =================
const DEFAULT_CHATBOT_SETTINGS = { welcomeMessageAr: 'هلا بيك في سبايدر 👋\nشلون أگدر أساعدك اليوم؟', welcomeMessageEn: 'Welcome to SPIDER 👋\nHow can I help you today?', suggestion1Ar: 'أريد أبني تجميعة', suggestion1En: 'I want to build a PC', suggestion2Ar: 'أبحث عن منتج', suggestion2En: 'I am looking for a product', suggestion3Ar: 'أريد أطوّر حاسبتي', suggestion3En: 'I want to upgrade my PC', aiUnavailableAr: 'المساعد غير متاح حالياً، جرّب مرة ثانية بعد شوي.', aiUnavailableEn: 'The assistant is currently unavailable. Please try again later.', noInfoAr: 'ما لكيت هذه المعلومة ضمن المنتجات المنشورة حالياً.', noInfoEn: 'I could not find that information in the published catalog.', botFontSize: 16, userFontSize: 16, suggestionFontSize: 15, inputFontSize: 16 };
let storeSettings = { storeNameAr: 'سبايدر للإلكترونيات', storeNameEn: 'Spider Electronics', whatsappNumber: '+9647805700503', deliveryFee: 5000, chatbotEnabled: true, chatbotSettings: { ...DEFAULT_CHATBOT_SETTINGS } };

function normalizeBrandLogoKey(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const CANONICAL_BRAND_NAMES = Object.freeze({ asus: 'ASUS', 'tp-link': 'TP-Link', kingston: 'Kingston', gigabyte: 'Gigabyte', msi: 'MSI', intel: 'Intel' });
function canonicalBrandName(value) {
    const raw = String(value || '').normalize('NFKC').trim();
    return CANONICAL_BRAND_NAMES[normalizeBrandLogoKey(raw)] || raw;
}
function canonicalBrandRecords(items) {
    const grouped = new Map();
    (items || []).forEach((product) => {
        const raw = String(product?.brand || '').normalize('NFKC').trim();
        const key = normalizeBrandLogoKey(raw);
        if (!key) return;
        const record = grouped.get(key) || { key, first: raw, count: 0, values: new Map() };
        record.count += 1;
        record.values.set(raw, (record.values.get(raw) || 0) + 1);
        grouped.set(key, record);
    });
    return [...grouped.values()].map((record) => ({ key: record.key, name: CANONICAL_BRAND_NAMES[record.key] || [...record.values.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || record.first, count: record.count })).sort((a, b) => a.name.localeCompare(b.name));
}
function canonicalProductBrand(value, excludedId = '') {
    const normalized = normalizeBrandLogoKey(value);
    const existing = products.find((product) => product.id !== excludedId && normalizeBrandLogoKey(product.brand) === normalized)?.brand;
    return canonicalBrandName(existing || value);
}
function canManageBrandManagement() {
    return Boolean(currentAdminUser && (window.isSuperAdmin || isAdminActive(window.currentAdminData || { status: 'active' })));
}
function isValidUploadedImageUrl(value) {
    const url = String(value || '').trim();
    return Boolean(url) && !url.startsWith('blob:') && !url.startsWith('data:') && (/^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('images/'));
}
function renderBrandLogoOptions() {
    const select = document.getElementById('brandLogoBrand');
    if (!select) return;
    const brands = canonicalBrandRecords(products);
    const previous = select.value;
    select.innerHTML = brands.length ? brands.map((brand) => `<option value="${escapeHtml(brand.name)}">${escapeHtml(brand.name)}</option>`).join('') : '<option value="">لا توجد علامات في المنتجات بعد</option>';
    if (brands.some((brand) => normalizeBrandLogoKey(brand.name) === normalizeBrandLogoKey(previous))) select.value = canonicalBrandName(previous);
    syncBrandLogoPreview();
    renderBrandManagement();
}

function brandManagementRecords() {
    const byKey = new Map(canonicalBrandRecords(products).map((record) => [record.key, record]));
    Object.keys(storeSettings.brandLogos || {}).forEach((key) => {
        if (!byKey.has(key)) byKey.set(key, { key, name: key, count: 0 });
    });
    return [...byKey.entries()].map(([key, value]) => ({ ...value, key, logo: storeSettings.brandLogos?.[key] || '' })).sort((a, b) => a.name.localeCompare(b.name));
}

function renderBrandManagement() {
    const list = document.getElementById('brandManagementList');
    if (!list) return;
    const records = brandManagementRecords();
    list.innerHTML = records.length ? records.map((record) => {
        const fallback = escapeHtml(record.name.slice(0, 3).toUpperCase());
        const logo = record.logo ? `<img src="${escapeHtml(record.logo)}" alt="شعار ${escapeHtml(record.name)}" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className:'brand-management-fallback',textContent:'${fallback}'}))">` : `<span class="brand-management-fallback" aria-hidden="true">${fallback}</span>`;
        return `<article class="brand-management-card" data-brand-key="${escapeHtml(record.key)}" data-brand-name="${escapeHtml(record.name)}"><div class="brand-management-head">${logo}<div class="brand-management-copy"><strong>${escapeHtml(record.name)}</strong><small>${record.count} منتج مرتبط</small></div></div><div class="brand-management-edit"><input type="text" value="${escapeHtml(record.name)}" aria-label="اسم العلامة ${escapeHtml(record.name)}"><button type="button" class="btn btn-secondary" data-brand-action="rename">حفظ الاسم</button></div><div class="brand-management-actions"><button type="button" class="btn btn-outline" data-brand-action="replace">رفع/استبدال الشعار</button><button type="button" class="btn btn-outline" data-brand-action="delete-logo">حذف الشعار</button><button type="button" class="btn btn-outline btn-danger" data-brand-action="delete-brand">حذف العلامة</button></div></article>`;
    }).join('') : '<div class="brand-management-empty">لا توجد علامات تجارية بعد.</div>';
}

async function requestBrandManagement(payload) {
    if (!canManageBrandManagement()) throw new Error('FORBIDDEN');
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    if (!token) throw new Error('AUTH_REQUIRED');
    const response = await fetch(`${SPIDER_BACKEND_ENDPOINT}/api/admin/brands/manage`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) { const error = new Error(data.error || 'BRAND_MANAGEMENT_FAILED'); error.count = data.count; throw error; }
    storeSettings.brandLogos = data.brandLogos || {};
    products = Object.entries(data.products || {}).map(([id, product]) => ({ id, ...product }));
    updateAllDashboardViews();
    return data;
}

document.getElementById('brandManagementList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-brand-action]');
    const card = event.target.closest('[data-brand-key]');
    if (!button || !card) return;
    const brand = card.dataset.brandName || '';
    const action = button.dataset.brandAction;
    try {
        if (action === 'replace') { document.getElementById('brandLogoBrand').value = brand; syncBrandLogoPreview(); document.getElementById('brandLogoFile')?.click(); return; }
        if (action === 'rename') {
            const newName = card.querySelector('input')?.value.trim() || '';
            const count = brandManagementRecords().find((item) => item.key === card.dataset.brandKey)?.count || 0;
            if (!newName || newName === brand) return;
            if (!confirm(`سيتم تحديث اسم العلامة في ${count} منتج. هل تريد المتابعة؟`)) return;
            await requestBrandManagement({ operation: 'rename', brand, newName });
            alert('تم تعديل اسم العلامة وتأكيد الربط بالمنتجات.');
        } else if (action === 'delete-logo') {
            if (!confirm(`هل تريد حذف شعار «${brand}»؟ ستبقى العلامة والمنتجات دون تغيير.`)) return;
            await requestBrandManagement({ operation: 'deleteLogo', brand });
            alert('تم حذف الشعار وسيظهر الاختصار النصي تلقائياً.');
        } else if (action === 'delete-brand') {
            const count = brandManagementRecords().find((item) => item.key === card.dataset.brandKey)?.count || 0;
            if (count) { alert(`لا يمكن حذف العلامة لأنها مرتبطة بـ ${count} منتجات. انقل المنتجات أو غيّر علامتها أولاً.`); return; }
            if (!confirm(`هل تريد حذف بيانات العلامة «${brand}»؟`)) return;
            await requestBrandManagement({ operation: 'deleteBrand', brand });
            alert('تم حذف العلامة غير المستخدمة.');
        }
    } catch (error) {
        if (error.message === 'BRAND_NAME_EXISTS' || error.message === 'BRAND_KEY_EXISTS') alert('اسم العلامة مستخدم مسبقاً.');
        else if (error.message === 'BRAND_IN_USE') alert(`لا يمكن حذف العلامة لأنها مرتبطة بـ ${error.count || 'عدة'} منتجات.`);
        else alert('فشلت عملية إدارة العلامة: ' + error.message);
    }
});
function syncBrandLogoPreview() {
    const select = document.getElementById('brandLogoBrand');
    const urlInput = document.getElementById('brandLogoUrl');
    const previewBox = document.getElementById('brandLogoPreviewContainer');
    const preview = document.getElementById('brandLogoPreview');
    if (!select || !urlInput || !previewBox || !preview) return;
    const url = storeSettings.brandLogos?.[normalizeBrandLogoKey(select.value)] || '';
    urlInput.value = url;
    preview.src = url;
    previewBox.hidden = !url;
}

function chatbotFormValues() {
    const get = (id) => document.getElementById(id)?.value || '';
    const number = (id) => Math.min(22, Math.max(14, Number(document.getElementById(id)?.value || 16)));
    return { welcomeMessageAr: get('chatWelcomeAr').trim(), welcomeMessageEn: get('chatWelcomeEn').trim(), suggestion1Ar: get('chatSuggestion1Ar').trim(), suggestion1En: get('chatSuggestion1En').trim(), suggestion2Ar: get('chatSuggestion2Ar').trim(), suggestion2En: get('chatSuggestion2En').trim(), suggestion3Ar: get('chatSuggestion3Ar').trim(), suggestion3En: get('chatSuggestion3En').trim(), aiUnavailableAr: get('chatUnavailableAr').trim(), aiUnavailableEn: get('chatUnavailableEn').trim(), noInfoAr: get('chatNoInfoAr').trim(), noInfoEn: get('chatNoInfoEn').trim(), botFontSize: number('chatBotFontSize'), userFontSize: number('chatUserFontSize'), suggestionFontSize: number('chatSuggestionFontSize'), inputFontSize: number('chatInputFontSize') };
}
function renderChatbotPreview(settings) {
    const s = { ...DEFAULT_CHATBOT_SETTINGS, ...settings };
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
    Object.entries({ chatWelcomeAr: s.welcomeMessageAr, chatWelcomeEn: s.welcomeMessageEn, chatSuggestion1Ar: s.suggestion1Ar, chatSuggestion1En: s.suggestion1En, chatSuggestion2Ar: s.suggestion2Ar, chatSuggestion2En: s.suggestion2En, chatSuggestion3Ar: s.suggestion3Ar, chatSuggestion3En: s.suggestion3En, chatUnavailableAr: s.aiUnavailableAr, chatUnavailableEn: s.aiUnavailableEn, chatNoInfoAr: s.noInfoAr, chatNoInfoEn: s.noInfoEn, chatBotFontSize: s.botFontSize, chatUserFontSize: s.userFontSize, chatSuggestionFontSize: s.suggestionFontSize, chatInputFontSize: s.inputFontSize }).forEach(([id, value]) => set(id, value));
    const welcome = document.getElementById('chatPreviewWelcome'); if (welcome) { welcome.textContent = s.welcomeMessageAr; welcome.style.fontSize = `${s.botFontSize}px`; }
    const suggestion = document.getElementById('chatPreviewSuggestion'); if (suggestion) { suggestion.textContent = s.suggestion1Ar; suggestion.style.fontSize = `${s.suggestionFontSize}px`; }
    const input = document.getElementById('chatPreviewInput'); if (input) input.style.fontSize = `${s.inputFontSize}px`;
}

const ADMIN_BUILDER_SECTIONS = [
    ['cpu', 'المعالج CPU', 'cat-cpus'], ['motherboard', 'اللوحة الأم', 'cat-motherboards'], ['ram', 'الذاكرة RAM', 'cat-ram'],
    ['storage', 'التخزين', 'cat-storage'], ['gpu', 'كرت الشاشة GPU', 'cat-gpus'], ['psu', 'مزود الطاقة PSU', 'cat-psu'],
    ['cooling', 'التبريد', 'cat-cooling'], ['case', 'الصندوق Case', 'cat-cases'], ['monitors', 'الشاشات', 'cat-monitors'], ['accessories', 'ملحقات الكمبيوتر', 'cat-accessories']
];
let pendingBuilderSections = null;
function renderBuilderSectionsSettings() {
    const root = document.getElementById('builderSectionsSettings');
    if (!root) return;
    const query = String(document.getElementById('builderSectionsProductSearch')?.value || '').trim().toLowerCase();
    const configured = pendingBuilderSections || storeSettings.builderSections || {};
    root.innerHTML = ADMIN_BUILDER_SECTIONS.map(([id, label, categoryId]) => {
        const selected = new Set(Array.isArray(configured[id]?.allowedProductIds) ? configured[id].allowedProductIds.map(String) : []);
        const matches = products.filter((product) => (product.categoryId || product.category) === categoryId && (!query || `${product.name || ''} ${product.nameAr || ''} ${product.sku || ''} ${product.model || ''}`.toLowerCase().includes(query)));
        return `<details class="builder-section-setting" open><summary><strong>${escapeHtml(label)}</strong><span class="builder-section-count" data-builder-section-count="${id}">${selected.size} مختار</span></summary><div class="builder-section-products">${matches.length ? matches.map((product) => `<label class="checkbox-label"><input type="checkbox" data-builder-section="${id}" data-builder-product-id="${escapeHtml(product.id)}" ${selected.has(String(product.id)) ? 'checked' : ''}><span>${escapeHtml(product.name || product.nameAr || product.id)}${product.sku ? ` <small>${escapeHtml(product.sku)}</small>` : ''}</span></label>`).join('') : '<small class="form-hint">لا توجد منتجات مطابقة في هذا القسم.</small>'}</div></details>`;
    }).join('');
    root.querySelectorAll('[data-builder-section]').forEach((input) => input.addEventListener('change', () => {
        const section = input.dataset.builderSection;
        const current = pendingBuilderSections || configured;
        const selected = new Set(Array.isArray(current[section]?.allowedProductIds) ? current[section].allowedProductIds.map(String) : []);
        if (input.checked) selected.add(String(input.dataset.builderProductId));
        else selected.delete(String(input.dataset.builderProductId));
        pendingBuilderSections = { ...current, [section]: { ...(current[section] || {}), allowedProductIds: [...selected] } };
        const count = root.querySelectorAll(`[data-builder-section="${CSS.escape(section)}"]:checked`).length;
        const output = root.querySelector(`[data-builder-section-count="${CSS.escape(section)}"]`);
        if (output) output.textContent = `${count} مختار`;
    }));
}
document.getElementById('builderSectionsProductSearch')?.addEventListener('input', renderBuilderSectionsSettings);
function collectBuilderSections() {
    const root = document.getElementById('builderSectionsSettings');
    return pendingBuilderSections || Object.fromEntries(ADMIN_BUILDER_SECTIONS.map(([id]) => [id, { allowedProductIds: [...(root?.querySelectorAll(`[data-builder-section="${CSS.escape(id)}"]:checked`) || [])].map((input) => String(input.dataset.builderProductId)) } ]));
}
document.getElementById('saveBuilderSectionsBtn')?.addEventListener('click', async () => {
    if (isDemoMode) { alert('لا يمكن حفظ أقسام Builder في وضع المعاينة.'); return; }
    const button = document.getElementById('saveBuilderSectionsBtn');
    const builderSections = collectBuilderSections();
    try {
        button.disabled = true;
        await update(ref(db, 'settings'), { builderSections });
        const readBack = await get(ref(db, 'settings/builderSections'));
        const saved = readBack.exists() ? readBack.val() : {};
        for (const [id, section] of Object.entries(builderSections)) {
            const expected = [...new Set(section.allowedProductIds.map(String))].sort().join(',');
            const actual = [...new Set((saved?.[id]?.allowedProductIds || []).map(String))].sort().join(',');
            if (expected !== actual) throw new Error(`BUILDER_SECTION_READBACK_MISMATCH:${id}`);
        }
        storeSettings = { ...storeSettings, builderSections: saved };
        pendingBuilderSections = null;
        localStorage.setItem('spider_store_settings', JSON.stringify(storeSettings));
        renderBuilderSectionsSettings();
        alert('تم حفظ أقسام ومنتجات Builder والتحقق من Firebase.');
    } catch (error) {
        alert(`فشل حفظ أقسام Builder: ${error.message || 'خطأ غير معروف'}`);
    } finally { button.disabled = false; }
});

onValue(ref(db, 'settings'), (snapshot) => {
    if (snapshot.exists()) {
        storeSettings = { ...storeSettings, ...snapshot.val() };
    }

    pendingBuilderSections = null;
    // Store in localStorage for storefront
    localStorage.setItem('spider_store_settings', JSON.stringify(storeSettings));

    // Update UI
    const fields = {
        settingStoreNameAr: storeSettings.storeNameAr || '',
        settingStoreNameEn: storeSettings.storeNameEn || '',
        settingWhatsapp: storeSettings.whatsappNumber || storeSettings.whatsapp || storeSettings.storePhone || '',
        settingPhone: storeSettings.phoneNumber || storeSettings.storePhone || '',
        settingInstagramUrl: storeSettings.instagramUrl || '',
        settingGoogleMapsUrl: storeSettings.googleMapsUrl || '',
        settingStoreAddress: storeSettings.storeAddress || '',
        settingWelcomeMessage: storeSettings.welcomeMessage || '',
        settingHeroTitle: storeSettings.heroTitle || '',
        settingHeroSubtitle: storeSettings.heroSubtitle || '',
        settingHeroCta: storeSettings.heroCta || '',
        settingHeroImage: storeSettings.heroImage || '',
        settingLowStockThreshold: storeSettings.lowStockThreshold ?? 3
    };
    Object.entries(fields).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
    const chatbotEnabled = document.getElementById('settingChatbotEnabled');
    if (chatbotEnabled) chatbotEnabled.checked = storeSettings.chatbotEnabled !== false;
    renderBuilderInvoiceTiers();
    renderBuilderSectionsSettings();
    const elWa = document.getElementById('settingWhatsapp');
    const elDf = document.getElementById('settingDeliveryFee');
    if (elWa) elWa.value = storeSettings.whatsappNumber || storeSettings.whatsapp || storeSettings.storePhone || '';
    if (elDf) elDf.value = storeSettings.deliveryFee || 5000;
    renderChatbotPreview(storeSettings.chatbotSettings || DEFAULT_CHATBOT_SETTINGS);
    renderBrandLogoOptions();
});

document.getElementById('brandLogoBrand')?.addEventListener('change', syncBrandLogoPreview);
document.getElementById('brandLogoFile')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    const preview = document.getElementById('brandLogoPreview');
    const previewBox = document.getElementById('brandLogoPreviewContainer');
    if (!file || !preview || !previewBox) return;
    if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    const objectUrl = URL.createObjectURL(file);
    preview.dataset.objectUrl = objectUrl;
    preview.src = objectUrl;
    previewBox.hidden = false;
    const status = document.getElementById('brandLogoUploadStatus');
    if (status) status.textContent = `تم اختيار ${file.name}. اضغط رفع وحفظ الشعار.`;
});
document.getElementById('prepareBrandLogoBtn')?.addEventListener('click', () => document.getElementById('brandLogoFile')?.click());
document.getElementById('confirmBrandLogoBtn')?.addEventListener('click', async () => {
    if (isDemoMode) { alert('لا يمكن رفع الشعارات في وضع المعاينة.'); return; }
    const select = document.getElementById('brandLogoBrand');
    const file = document.getElementById('brandLogoFile')?.files?.[0];
    const brand = String(select?.value || '').trim();
    if (!brand || !file) { alert('اختر العلامة وملف الشعار أولاً.'); return; }
    const button = document.getElementById('confirmBrandLogoBtn');
    let uploadCompleted = false;
    try {
        button.disabled = true;
        const data = await uploadOriginalImage(file, 'brandLogoUrl', 'confirmBrandLogoBtn', 'prepareBrandLogoBtn', 'brandLogoUploadProgress', 'brandLogoUploadStatus', 'brand');
        uploadCompleted = true;
        const url = String(data.rawUrl || data.imageUrl || data.path || '').trim();
        const key = normalizeBrandLogoKey(brand);
        if (!key) throw new Error('BRAND_KEY_INVALID');
        if (!isValidUploadedImageUrl(url)) throw new Error('IMAGE_UPLOAD_URL_INVALID');

        // RTDB update() requires an object of child values. The previous code
        // passed the URL directly to settings/brandLogos/{key}, which caused
        // Firebase to reject the write after the GitHub upload had succeeded.
        const result = await requestBrandManagement({ operation: 'saveLogo', brand, url });
        const savedUrl = String(result.brandLogos?.[key] || '').trim();
        if (savedUrl !== url) throw new Error('BRAND_LOGO_READBACK_MISMATCH');
        syncBrandLogoPreview();
        document.getElementById('brandLogoUploadStatus').textContent = 'تم رفع الشعار وحفظ رابطه للعلامة بنجاح.';
    } catch (error) {
        const status = document.getElementById('brandLogoUploadStatus');
        if (uploadCompleted) {
            console.error('Brand logo Firebase save/read-back failed:', { brandKey: normalizeBrandLogoKey(brand), error });
            if (status) status.textContent = 'تم رفع الصورة إلى GitHub لكن فشل حفظ رابط الشعار في Firebase.';
            alert('تم رفع الصورة إلى GitHub لكن فشل حفظ رابط الشعار في Firebase: ' + (error.message || 'خطأ غير معروف'));
        } else {
            console.error('Brand logo upload failed:', error);
            if (status) status.textContent = 'فشل رفع الشعار.';
            alert(imageUploadErrorMessage(error.message, error.upstreamStatus));
        }
    } finally {
        button.disabled = false;
    }
});

document.getElementById('chatbotSettingsForm')?.addEventListener('input', () => renderChatbotPreview(chatbotFormValues()));
document.getElementById('resetChatbotSettingsBtn')?.addEventListener('click', () => renderChatbotPreview(DEFAULT_CHATBOT_SETTINGS));
document.getElementById('chatbotSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isDemoMode) { alert('لا يمكن حفظ الإعدادات في وضع المعاينة.'); return; }
    try { await update(ref(db, 'settings/chatbotSettings'), chatbotFormValues()); alert('تم حفظ إعدادات المساعد بنجاح.'); } catch (err) { alert('فشل حفظ إعدادات المساعد: ' + err.message); }
});

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isDemoMode) {
        alert('لا يمكن حفظ الإعدادات في وضع المعاينة.');
        return;
    }

    const wa = document.getElementById('settingWhatsapp').value.replace(/[^0-9]/g, '').replace(/^00/, '');
    const df = Number(document.getElementById('settingDeliveryFee').value);
    try {
        await update(ref(db, 'settings'), {
            storeNameAr: document.getElementById('settingStoreNameAr').value.trim(),
            storeNameEn: document.getElementById('settingStoreNameEn').value.trim(),
            whatsappNumber: wa,
            phoneNumber: document.getElementById('settingPhone').value.trim(),
            instagramUrl: document.getElementById('settingInstagramUrl').value.trim(),
            googleMapsUrl: document.getElementById('settingGoogleMapsUrl').value.trim(),
            storeAddress: document.getElementById('settingStoreAddress').value.trim(),
            welcomeMessage: document.getElementById('settingWelcomeMessage').value.trim(),
            heroTitle: document.getElementById('settingHeroTitle').value.trim(),
            heroSubtitle: document.getElementById('settingHeroSubtitle').value.trim(),
            heroCta: document.getElementById('settingHeroCta').value.trim(),
            heroImage: document.getElementById('settingHeroImage').value.trim(),
            lowStockThreshold: Math.max(0, Number(document.getElementById('settingLowStockThreshold').value || 3)),
            chatbotEnabled: document.getElementById('settingChatbotEnabled').checked,
            deliveryFee: df
        });
        alert('تم حفظ الإعدادات بنجاح.');
    } catch(err) {
        alert('فشل حفظ الإعدادات: ' + err.message);
    }
});


// ================= MANAGERS & PERMISSIONS MODULE =================
let allAdminsData = {};
let allPendingAdminsData = {};

window.initManagersModule = function() {
    const canSee = window.isSuperAdmin || (window.currentAdminPermissions && (window.currentAdminPermissions.manage_staff || window.currentAdminPermissions.manage_permissions));
    const navLink = document.querySelector('[data-view="view-managers"]');
    if (navLink && navLink.parentElement) {
        navLink.parentElement.style.display = canSee ? 'block' : 'none';
    }
    if (!canSee) return;

    const adminsRef = ref(db, 'admins');
    onValue(adminsRef, (snapshot) => {
        allAdminsData = snapshot.val() || {};
        renderManagersTable();
    });

    if (window.isSuperAdmin || window.currentAdminPermissions.manage_staff) {
        const pendingRef = ref(db, 'pending_admins');
        onValue(pendingRef, (snapshot) => {
            allPendingAdminsData = snapshot.val() || {};
            renderManagersTable();
        });
    }

    document.getElementById('managersSearch').addEventListener('input', renderManagersTable);
    document.getElementById('managersRoleFilter').addEventListener('change', renderManagersTable);
    document.getElementById('managersStatusFilter').addEventListener('change', renderManagersTable);
};

window.renderManagersTable = function() {
    const tbody = document.getElementById('managersTableBody');
    if (!tbody) return;

    const search = document.getElementById('managersSearch').value.toLowerCase();
    const roleFilter = document.getElementById('managersRoleFilter').value;
    const statusFilter = document.getElementById('managersStatusFilter').value;

    let combined = [];

    // Add Super Admin explicitly
    combined.push({
        id: SUPER_ADMIN_UID,
        isSuper: true,
        name: 'Super Admin',
        role: 'Super Admin',
        status: 'active',
        addedAt: 0,
        email: '---'
    });

    Object.keys(allAdminsData).forEach(uid => {
        combined.push({ id: uid, type: 'active', ...allAdminsData[uid] });
    });

    Object.keys(allPendingAdminsData).forEach(key => {
        combined.push({ id: key, type: 'pending', ...allPendingAdminsData[key] });
    });

    let html = '';
    combined.forEach(m => {
        const email = m.email || '';
        const name = m.name || m.email || 'غير معروف';
        const phone = m.phone || '';

        if (search && !name.toLowerCase().includes(search) && !email.toLowerCase().includes(search) && !(phone).includes(search)) return;
        if (roleFilter && m.role !== roleFilter && !m.isSuper) return;

        if (statusFilter) {
            if (statusFilter === 'pending' && m.type !== 'pending') return;
            if (statusFilter !== 'pending' && m.type === 'pending') return;
            if (statusFilter !== 'pending' && m.status !== statusFilter && !m.isSuper) return;
        }

        let actions = '';
        if (m.isSuper) {
            actions = '<span class="badge" style="background:#4b5563;color:white;"><i class="fa-solid fa-lock"></i> محمي</span>';
        } else {
            actions = `
                <button class="btn btn-sm btn-outline" title="تعديل / الصلاحيات" onclick="editManager('${m.id}', '${m.type}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-outline" title="تفعيل / تعطيل" onclick="toggleManagerStatus('${m.id}', '${m.type}', '${m.status}')"><i class="fa-solid fa-power-off"></i></button>
                <button class="btn btn-sm btn-outline btn-danger" title="حذف" onclick="deleteManager('${m.id}', '${m.type}')"><i class="fa-solid fa-trash"></i></button>
            `;
        }

        let permissionsCount = m.isSuper ? 'الكل' : (m.permissions ? Object.keys(m.permissions).length : 0);
        let addedAt = m.addedAt ? new Date(m.addedAt).toLocaleDateString('ar-IQ') : '---';
        let updatedAt = m.updatedAt ? new Date(m.updatedAt).toLocaleDateString('ar-IQ') : '---';

        let statusBadge = '';
        if (m.type === 'pending') {
            statusBadge = '<span class="badge" style="background:#f59e0b;color:white;">Pending</span>';
        } else {
            statusBadge = m.status === 'active' ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Disabled</span>';
        }

        let roleBadge = m.isSuper ? '<span class="badge" style="background:#e63946;color:white;"><i class="fa-solid fa-crown"></i> Super Admin / المالك</span>' : `<span class="badge">${m.role || 'Admin'}</span>`;

        html += `
            <tr>
                <td>
                    <strong>${name}</strong>
                    <div style="font-size: 0.85em; color: #6b7280;">${email}</div>
                    ${phone ? `<div style="font-size: 0.85em; color: #6b7280;" dir="ltr">${phone}</div>` : ''}
                </td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td><span class="badge badge-light">${permissionsCount}</span></td>
                <td>${addedAt}</td>
                <td>${updatedAt}</td>
                <td><div style="display:flex;gap:5px;">${actions}</div></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.openManagerModal = function() {
    document.getElementById('managerModalTitle').textContent = 'إضافة مدير جديد';
    document.getElementById('saveManagerBtn').textContent = 'إضافة المدير';
    document.getElementById('managerForm').reset();
    document.getElementById('managerId').value = '';
    document.getElementById('managerModalError').style.display = 'none';

    const emailInput = document.getElementById('managerEmail');
    emailInput.readOnly = false;
    document.getElementById('managerEmailNote').style.display = 'none';

    // Clear permissions
    document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => cb.checked = false);

    const canManagePerms = window.isSuperAdmin || (window.currentAdminPermissions && window.currentAdminPermissions.manage_permissions);
    if (!canManagePerms) {
        document.getElementById('permissionsSectionWrapper').style.display = 'none';
    } else {
        document.getElementById('permissionsSectionWrapper').style.display = 'block';
    }

    const modal = document.getElementById('managerModal');
    setAdminModalOpen(modal, true);
    modal.style.display = 'flex';
};

window.closeManagerModal = function() {
    const modal = document.getElementById('managerModal');
    setAdminModalOpen(modal, false);
    setTimeout(() => { modal.style.display = 'none'; }, 200);
};

window.toggleManagerStatus = async function(id, type, currentStatus) {
    if (!window.isSuperAdmin && !window.currentAdminPermissions.manage_staff) {
        alert('عذراً، لا تملك صلاحية تعديل المشرفين.');
        return;
    }
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const path = type === 'active' ? `admins/${id}` : `pending_admins/${id}`;

    try {
        await update(ref(db, path), {
            status: newStatus,
            updatedAt: Date.now()
        });

        await push(ref(db, 'auditLogs'), {
            actor: currentAdminUser.email || currentAdminUser.uid,
            action: 'TOGGLE_MANAGER_STATUS',
            targetId: id,
            newStatus: newStatus,
            timestamp: Date.now()
        });

    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء تغيير الحالة.');
    }
};

window.deleteManager = async function(id, type) {
    if (!window.isSuperAdmin && !window.currentAdminPermissions.manage_staff) {
        alert('عذراً، لا تملك صلاحية تعديل المشرفين.');
        return;
    }
    if (!confirm('هل أنت متأكد من حذف هذا المدير نهائياً؟')) return;

    const path = type === 'active' ? `admins/${id}` : `pending_admins/${id}`;
    try {
        await remove(ref(db, path));

        await push(ref(db, 'auditLogs'), {
            actor: currentAdminUser.email || currentAdminUser.uid,
            action: 'DELETE_MANAGER',
            targetId: id,
            timestamp: Date.now()
        });

    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء الحذف.');
    }
};

window.editManager = function(id, type) {
    document.getElementById('managerModalTitle').textContent = 'تحديث المدير';
    document.getElementById('saveManagerBtn').textContent = 'تحديث المدير';
    document.getElementById('managerModalError').style.display = 'none';

    let data = type === 'active' ? allAdminsData[id] : allPendingAdminsData[id];
    if (!data) return;

    document.getElementById('managerId').value = type === 'active' ? id : 'pending_' + id;
    document.getElementById('managerName').value = data.name || '';

    const emailInput = document.getElementById('managerEmail');
    emailInput.value = data.email || '';

    // If active and has UID, email is generally safer as readOnly to avoid accidental duplicate account creation, etc.
    if (type === 'active') {
        emailInput.readOnly = true;
        document.getElementById('managerEmailNote').style.display = 'block';
    } else {
        emailInput.readOnly = false;
        document.getElementById('managerEmailNote').style.display = 'none';
    }

    document.getElementById('managerPhone').value = data.phone || '';
    document.getElementById('managerRole').value = data.role || 'Admin';
    document.getElementById('managerStatus').value = data.status || 'active';
    document.getElementById('managerNotes').value = data.notes || '';

    document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => {
        cb.checked = !!(data.permissions && data.permissions[cb.value]);
    });

    const canManagePerms = window.isSuperAdmin || (window.currentAdminPermissions && window.currentAdminPermissions.manage_permissions);
    if (!canManagePerms) {
        document.getElementById('permissionsSectionWrapper').style.display = 'none';
    } else {
        document.getElementById('permissionsSectionWrapper').style.display = 'block';
    }

    const modal = document.getElementById('managerModal');
    setAdminModalOpen(modal, true);
    modal.style.display = 'flex';
};

document.getElementById('managerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.isSuperAdmin && !window.currentAdminPermissions.manage_staff) {
        alert('ليس لديك صلاحية لإدارة الموظفين.');
        return;
    }

    const idField = document.getElementById('managerId').value;
    const isEdit = !!idField;
    const isPendingEdit = idField.startsWith('pending_');
    const realId = isPendingEdit ? idField.replace('pending_', '') : idField;

    const email = document.getElementById('managerEmail').value.trim();
    const phone = document.getElementById('managerPhone').value.trim();
    if (!email && !phone) {
        alert('يرجى إدخال البريد الإلكتروني أو رقم الهاتف على الأقل.');
        return;
    }

    const data = {
        name: document.getElementById('managerName').value.trim(),
        email: email,
        phone: phone,
        role: document.getElementById('managerRole').value,
        status: document.getElementById('managerStatus').value,
        notes: document.getElementById('managerNotes').value.trim(),
        updatedAt: Date.now()
    };

    const canManagePerms = window.isSuperAdmin || (window.currentAdminPermissions && window.currentAdminPermissions.manage_permissions);
    if (canManagePerms) {
        let perms = {};
        document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => {
            if (cb.checked) perms[cb.value] = true;
        });
        data.permissions = perms;
    }

    const btn = document.getElementById('saveManagerBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';
    document.getElementById('managerModalError').style.display = 'none';

    try {
        if (!isEdit) {
            // Check if email or phone already exists in admins
            let existingUid = null;
            if (email || phone) {
                existingUid = Object.keys(allAdminsData).find(uid => {
                    const u = allAdminsData[uid];
                    return (email && u.email && u.email.toLowerCase() === email.toLowerCase()) ||
                           (phone && u.phone && u.phone === phone);
                });
            }

            if (existingUid) {
                // Already registered -> update existing using its UID
                await update(ref(db, `admins/${existingUid}`), data);
            } else {
                // New -> add to pending
                const emailKey = email ? btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : 'phone_' + phone;
                data.addedAt = Date.now();
                await set(ref(db, `pending_admins/${emailKey}`), data);
            }
        } else {
            if (isPendingEdit) {
                await update(ref(db, `pending_admins/${realId}`), data);
            } else {
                await update(ref(db, `admins/${realId}`), data);
            }
        }

        // Log Audit
        await push(ref(db, 'auditLogs'), {
            actor: currentAdminUser.email || currentAdminUser.uid,
            action: isEdit ? 'EDIT_MANAGER' : 'ADD_MANAGER',
            target: email || phone,
            role: data.role,
            timestamp: Date.now()
        });

        closeManagerModal();
        if (window.showToast) {
            showToast('تم حفظ البيانات بنجاح!');
        } else {
            alert('تم حفظ البيانات بنجاح!');
        }

        // Refresh table manually in case onValue doesn't trigger fast enough or if we want to ensure immediate feedback
        if (typeof renderManagersTable === 'function') {
            // Give Firebase a tiny moment to sync
            setTimeout(renderManagersTable, 300);
        }

    } catch (err) {
        console.error(err);
        const errDiv = document.getElementById('managerModalError');
        errDiv.textContent = 'تعذر حفظ التعديلات. ' + (err.message || '');
        errDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

window.selectAllPermissions = function() {
    document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => {
        if (!cb.disabled) cb.checked = true;
    });
};

window.deselectAllPermissions = function() {
    document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => {
        if (!cb.disabled) cb.checked = false;
    });
};



window.deleteCustomer = async function(uid) {
    if (!currentAdminUser) return;
    const isSuperAdmin = currentAdminUser.uid === SUPER_ADMIN_UID;
    const canDelete = isSuperAdmin || currentAdminUser.permissions?.customers_delete;
    if (!canDelete) {
        alert("ليس لديك صلاحية لحذف العملاء.");
        return;
    }

    if (!confirm("هل أنت متأكد من حذف هذا العميل؟\nتنبيه: سيتم إخفاء/حذف بيانات العميل الشخصية، لكن السجلات المالية وسجل الطلبات المرتبطة به ستبقى محفوظة لضمان سلامة النظام.")) return;

    try {
        const auditKey = push(ref(db, 'auditLogs')).key;
        await update(ref(db), {
            [`profiles/${uid}`]: null,
            [`auditLogs/${auditKey}`]: {
                action: 'delete_customer',
                targetUid: uid,
                actorUid: currentAdminUser.uid,
                timestamp: Date.now()
            }
        });
        alert('تم حذف العميل بنجاح.');
    } catch (e) {
        alert('فشل حذف العميل.');
    }
};

window.openResetPinModal = function(uid) {
    if (!currentAdminUser || currentAdminUser.uid !== SUPER_ADMIN_UID) return;
    const customer = customers.find(c => c.uid === uid);
    if (!customer) return;
    
    document.getElementById('resetPinUid').value = uid;
    document.getElementById('resetPinName').value = customer.name || customer.displayName || 'غير متوفر';
    document.getElementById('resetPinPhone').value = customer.phone || customer.phoneNumber || 'غير متوفر';
    document.getElementById('resetPinNew').value = '';
    document.getElementById('resetPinConfirm').value = '';
    document.getElementById('resetPinError').classList.add('hidden');
    
    setAdminModalOpen(document.getElementById('resetPinModal'), true);
};

window.closeResetPinModal = function() {
    setAdminModalOpen(document.getElementById('resetPinModal'), false);
};

document.getElementById('resetPinForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentAdminUser || currentAdminUser.uid !== SUPER_ADMIN_UID) return;
    
    const uid = document.getElementById('resetPinUid').value;
    const newPassword = document.getElementById('resetPinNew').value;
    const confirmPassword = document.getElementById('resetPinConfirm').value;
    const errorDiv = document.getElementById('resetPinError');
    const submitBtn = document.getElementById('resetPinSubmitBtn');
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'كلمتا المرور غير متطابقتين!';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (!/^\S{6,128}$/.test(newPassword)) {
        errorDiv.textContent = 'كلمة المرور يجب أن تكون من 6 إلى 128 حرفاً بدون مسافات.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    errorDiv.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحديث...';
    
    try {
        const idToken = await auth.currentUser.getIdToken();
        const res = await fetch(SPIDER_BACKEND_ENDPOINT + '/api/auth/admin-reset-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ targetUid: uid, newPassword: newPassword, confirmPassword: confirmPassword })
        });
        
        const data = await res.json().catch(()=>null);
        if (res.ok && data?.success) {
            alert('تم إعادة تعيين كلمة المرور بنجاح!');
            closeResetPinModal();
        } else {
            errorDiv.textContent = 'تعذر تحديث الرمز: ' + (data?.error || 'خطأ غير معروف');
            errorDiv.classList.remove('hidden');
        }
    } catch (err) {
        errorDiv.textContent = 'خطأ في الاتصال بالخادم.';
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-key"></i> تحديث كلمة المرور';
    }
});


window.renderAdminGallery = function() {
    const container = document.getElementById('adminGalleryContainer');
    if (!container) return;
    container.innerHTML = '';
    const uploadBtn = document.getElementById('uploadImageBtn');
    if (uploadBtn) uploadBtn.style.display = productImageItems.length >= 5 ? 'none' : 'block';
    const uploadButton = document.getElementById('confirmUploadBtn');
    const hasPending = productImageItems.some((item) => item.sourceType === 'local' && item.uploadedUrl === null);
    if (uploadButton) {
        uploadButton.textContent = hasPending ? 'رفع الصور إلى GitHub' : 'رفع الصور إلى GitHub';
        uploadButton.disabled = !hasPending;
    }
    productImageItems.forEach((imageItem) => {
        const isPrimary = imageItem.isPrimary;
        const imageUrl = productImagePreviewItem(imageItem);
        const cardItem = document.createElement('div');
        cardItem.className = 'admin-gallery-item' + (isPrimary ? ' primary' : '') + (imageItem.id === activeProductImageId ? ' active' : '');
        cardItem.innerHTML = `
            ${isPrimary ? '<div class="admin-gallery-badge">الرئيسية</div>' : ''}
            <img src="${String(imageUrl).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}" data-image-preview="${imageItem.id}">
            <div class="admin-gallery-actions">
                ${!isPrimary ? '<button type="button" class="admin-gallery-btn" data-image-action="primary" title="جعلها الرئيسية"><i class="fa-solid fa-star"></i></button>' : ''}
                <button type="button" class="admin-gallery-btn" data-image-action="up" title="تقديم"><i class="fa-solid fa-arrow-right"></i></button>
                <button type="button" class="admin-gallery-btn" data-image-action="down" title="تأخير"><i class="fa-solid fa-arrow-left"></i></button>
                <button type="button" class="admin-gallery-btn" data-image-action="remove" title="حذف"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        cardItem.dataset.imageId = imageItem.id;
        container.appendChild(cardItem);
    });
    syncProductImageFields();
    updateProductMainPreview();
};

document.getElementById('adminGalleryContainer')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-image-id]');
    if (!card) return;
    const image = productImageItems.find((item) => item.id === card.dataset.imageId);
    if (!image) return;
    const action = event.target.closest('[data-image-action]')?.dataset.imageAction;
    if (action === 'remove') {
        if (!confirm('هل أنت متأكد من إزالة هذه الصورة؟')) return;
        revokeProductImagePreview(image);
        productImageItems = productImageItems.filter((item) => item.id !== image.id);
        setProductImageState(productImageItems, activeProductImageId === image.id ? null : activeProductImageId);
        return;
    }
    if (action === 'primary') {
        const index = productImageItems.indexOf(image);
        if (index > 0) productImageItems.splice(index, 1), productImageItems.unshift(image);
        setProductImageState(productImageItems, image.id);
        return;
    }
    if (action === 'up' || action === 'down') {
        const index = productImageItems.indexOf(image);
        const next = action === 'up' ? index - 1 : index + 1;
        if (index >= 0 && next >= 0 && next < productImageItems.length) {
            [productImageItems[index], productImageItems[next]] = [productImageItems[next], productImageItems[index]];
            setProductImageState(productImageItems, image.id);
        }
        return;
    }
    activeProductImageId = image.id;
    renderAdminGallery();
});
