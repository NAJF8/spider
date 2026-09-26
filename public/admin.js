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

// Global Data State
let orders = [];
let products = [];
let categories = [];
let activeOrderTab = 'all';
let isDemoMode = false;
let currentProcessedImageBase64 = null;
let currentProcessedImageName = null;
let isUploadingImage = false;
let salesChart = null;
let categoriesChart = null;
let currentAdminUser = null;
let customers = [];
let privatePricesByProduct = {};
let pendingPricingIdentities = {};

// ================= AUTHENTICATION =================
window.currentAdminPermissions = {};
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
        window.isSuperAdmin = false;
        window.currentAdminPermissions = {};
        if (!isDemoMode) {
            loginScreen.classList.remove('hidden');
            adminScreen.classList.add('hidden');
        }
    }
});

loginBtn.addEventListener('click', () => {
    errorMsg.classList.add('hidden');
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
        errorMsg.textContent = 'فشل تسجيل الدخول: ' + error.message;
        errorMsg.classList.remove('hidden');
    });
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
    renderPricingCustomers();
    renderCategoriesManagementTable();
    renderOrdersManagementTable();
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
        if (snapshot.exists()) snapshot.forEach((child) => customers.push({ uid: child.key, ...child.val() }));
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
        const type = ['retail', 'wholesale', 'special'].includes(customer.accountType) ? customer.accountType : 'retail';
        return `<tr><td><div class="cell-content">${escapeHtml(customer.name || customer.displayName || 'غير متوفر')}</div></td><td dir="ltr"><div class="cell-content ltr-field">${escapeHtml(customer.email || 'غير متوفر')}</div></td><td dir="ltr"><div class="cell-content ltr-field">${escapeHtml(customer.phone || customer.phoneNumber || 'غير متوفر')}</div></td><td title="${escapeHtml(customer.uid)}"><div class="uid-cell ltr-field"><span>${escapeHtml(customer.uid.slice(0, 8))}…</span><button type="button" class="btn-copy" onclick="navigator.clipboard.writeText('${escapeHtml(customer.uid)}')" title="نسخ UID"><i class="fa-regular fa-copy"></i></button></div></td><td><select class="form-select account-type-select" data-customer-type="${escapeHtml(customer.uid)}"><option value="retail" ${type === 'retail' ? 'selected' : ''}>Retail</option><option value="wholesale" ${type === 'wholesale' ? 'selected' : ''}>Wholesale</option><option value="special" ${type === 'special' ? 'selected' : ''}>Special</option></select></td><td><div class="cell-content">${customerDate(customer.createdAt || customer.creationTime || customer.created_at)}</div></td><td><div style="display:flex; gap:6px; flex-wrap:wrap;"><button class="btn btn-primary action-save-btn" style="flex:1;" data-save-customer="${escapeHtml(customer.uid)}">حفظ</button>${currentAdminUser?.uid === SUPER_ADMIN_UID ? `<button class="btn btn-outline btn-sm" style="flex:1;" onclick="openResetPinModal('${escapeHtml(customer.uid)}')" title="إعادة تعيين PIN"><i class="fa-solid fa-key"></i> PIN</button>` : ''}${(currentAdminUser?.uid === SUPER_ADMIN_UID || currentAdminUser?.permissions?.customers_delete) ? `<button class="btn btn-outline btn-sm" style="flex:1; color: var(--primary); border-color: var(--primary);" onclick="deleteCustomer('${escapeHtml(customer.uid)}')" title="حذف"><i class="fa-solid fa-trash"></i></button>` : ''}</div></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="text-center">لا يوجد عملاء في المسار الموثوق /profiles.</td></tr>';
    body.querySelectorAll('[data-save-customer]').forEach((button) => button.addEventListener('click', () => updateCustomerType(button.dataset.saveCustomer)));
    renderPricingCustomers();
}

function renderPricingCustomers() {
    const body = document.getElementById('pricingCustomersTableBody');
    if (!body) return;
    const rows = customers.map((customer) => {
        const type = ['public', 'special', 'wholesale'].includes(customer.pricing_tier) ? customer.pricing_tier : (customer.accountType === 'retail' ? 'public' : (customer.accountType || 'public'));
        return `<tr><td>${escapeHtml(customer.name || customer.displayName || 'غير متوفر')}</td><td dir="ltr">${escapeHtml(customer.email || 'غير متوفر')}</td><td dir="ltr">${escapeHtml(customer.phone || customer.phoneNumber || 'غير متوفر')}</td><td>${escapeHtml(customer.uid)}</td><td><span class="visibility-badge ${type === 'public' ? 'visible' : 'limited'}">${type}</span></td><td>${customerDate(customer.createdAt || customer.creationTime)}</td><td><button class="btn btn-outline btn-sm" data-pricing-customer="${escapeHtml(customer.uid)}">تعديل من جدول العملاء</button></td></tr>`;
    });
    Object.entries(pendingPricingIdentities).forEach(([key, item]) => rows.push(`<tr><td>معلق</td><td dir="ltr">${escapeHtml(item.email || item.identity || '')}</td><td dir="ltr">${escapeHtml(item.phone || '')}</td><td>${escapeHtml(item.uid || 'pending')}</td><td><span class="visibility-badge limited">${escapeHtml(item.pricing_tier || 'public')} / pending</span></td><td>${customerDate(item.createdAt)}</td><td><button class="btn btn-outline btn-sm" data-delete-pending="${escapeHtml(key)}">حذف التصنيف</button></td></tr>`));
    body.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="7" class="text-center">لا توجد فئات عملاء.</td></tr>';
    body.querySelectorAll('[data-pricing-customer]').forEach((button) => button.addEventListener('click', () => switchView('view-customers')));
    body.querySelectorAll('[data-delete-pending]').forEach((button) => button.addEventListener('click', async () => { if (confirm('حذف التصنيف المعلق؟')) await remove(ref(db, `pricing_identities/${button.dataset.deletePending}`)); }));
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

async function updateCustomerType(uid) {
    if (!currentAdminUser || currentAdminUser.uid !== SUPER_ADMIN_UID) return;
    const customer = customers.find((item) => item.uid === uid);
    const select = document.querySelector(`[data-customer-type="${CSS.escape(uid)}"]`);
    const nextType = select?.value;
    if (!customer || !['retail', 'wholesale', 'special'].includes(nextType) || nextType === (customer.accountType || 'retail')) return;
    const previousType = customer.pricing_tier || customer.accountType || 'retail';
    const pricingTier = nextType === 'retail' ? 'public' : nextType;
    const now = Date.now();
    const auditKey = push(ref(db, 'auditLogs')).key;
    await update(ref(db), {
        [`profiles/${uid}/accountType`]: nextType,
        [`profiles/${uid}/pricing_tier`]: pricingTier,
        [`profiles/${uid}/accountTypeUpdatedAt`]: now,
        [`profiles/${uid}/accountTypeUpdatedBy`]: currentAdminUser.uid,
        [`auditLogs/${auditKey}`]: { action: 'account_type_changed', targetUid: uid, actorUid: currentAdminUser.uid, actorEmail: currentAdminUser.email || '', previousType, nextType, timestamp: now }
    });
    customer.accountType = nextType;
    customer.pricing_tier = pricingTier;
    renderCustomers();
}
window.updateCustomerType = updateCustomerType;
document.getElementById('customerSearch')?.addEventListener('input', renderCustomers);
document.getElementById('pendingPricingForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentAdminUser || currentAdminUser.uid !== SUPER_ADMIN_UID) return;
    const identity = document.getElementById('pendingPricingIdentity').value.trim();
    const tier = document.getElementById('pendingPricingTier').value;
    const notes = document.getElementById('pendingPricingNotes').value.trim();
    if (!identity || !['public', 'special', 'wholesale'].includes(tier)) return;
    const matched = customers.find((customer) => customer.uid === identity || customer.email?.toLowerCase() === identity.toLowerCase() || customer.phone === identity);
    const now = Date.now();
    if (matched) {
        const auditKey = push(ref(db, 'auditLogs')).key;
        await update(ref(db), { [`profiles/${matched.uid}/pricing_tier`]: tier, [`profiles/${matched.uid}/accountType`]: tier === 'public' ? 'retail' : tier, [`profiles/${matched.uid}/pricing_tier_updated_at`]: now, [`auditLogs/${auditKey}`]: { action: 'pricing_tier_changed', targetUid: matched.uid, nextTier: tier, actorUid: currentAdminUser.uid, timestamp: now } });
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
        return `<tr><td><img src="${escapeHtml(p.image || '/images/default-product.svg')}" class="tp-img" alt=""></td><td>${escapeHtml(p.name || '')}</td><td>${escapeHtml(categories.find((c) => c.id === (p.categoryId || p.category))?.name || p.category || '')}</td><td><input class="pricing-input" type="number" min="1" step="1" data-public-price="${escapeHtml(p.id)}" value="${Number(p.public_price ?? p.price) || ''}"></td><td><input class="pricing-input" type="number" min="1" step="1" data-special-price="${escapeHtml(p.id)}" value="${prices.special_price || ''}" placeholder="fallback"></td><td><input class="pricing-input" type="number" min="1" step="1" data-wholesale-price="${escapeHtml(p.id)}" value="${prices.wholesale_price || ''}" placeholder="fallback"></td><td><span class="visibility-badge ${p.isHidden ? 'hidden' : 'visible'}">${p.isHidden ? 'مخفي' : 'نشط'}</span></td><td><button class="btn btn-primary btn-sm" data-save-pricing="${escapeHtml(p.id)}">حفظ</button></td></tr>`;
    }).join('') : '<tr><td colspan="8" class="text-center">لا توجد منتجات مطابقة.</td></tr>';
    tbody.querySelectorAll('[data-save-pricing]').forEach((button) => button.addEventListener('click', () => saveProductPricing(button.dataset.savePricing)));
}

async function saveProductPricing(id) {
    if (!currentAdminUser || currentAdminUser.uid !== SUPER_ADMIN_UID) return;
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
    await update(ref(db), {
        [`products/${id}/price`]: publicPrice,
        [`products/${id}/public_price`]: publicPrice,
        [`private_prices/${id}`]: { special_price: specialPrice, wholesale_price: wholesalePrice, updatedAt: now, updatedBy: currentAdminUser.uid },
        [`auditLogs/${push(ref(db, 'auditLogs')).key}`]: { action: 'product_pricing_changed', productId: id, actorUid: currentAdminUser.uid, publicPrice, specialPrice, wholesalePrice, timestamp: now }
    });
    alert('تم حفظ مستويات السعر وتسجيل التعديل.');
}
window.saveProductPricing = saveProductPricing;
document.getElementById('pricingSearch')?.addEventListener('input', renderPricingManagementTable);
document.getElementById('pricingCategoryFilter')?.addEventListener('change', renderPricingManagementTable);
document.getElementById('pricingStatusFilter')?.addEventListener('change', renderPricingManagementTable);

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
        const matchesSearch = !searchVal || (p.name && p.name.toLowerCase().includes(searchVal)) || (p.description && p.description.toLowerCase().includes(searchVal));
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
window.openProductModal = function(id = null) {
    closeCategoryModal();
    closeOrderModal();

    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('prodId').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
    currentProcessedImageBase64 = null;
    currentProcessedImageName = null;

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
            document.getElementById('prodDesc').value = prod.description || '';
            document.getElementById('prodSpecs').value = Object.entries(prod.specifications || prod.specs || {}).map(([key, value]) => `${key}: ${value}`).join('\n');
            document.getElementById('prodImage').value = prod.image || '';

            // Map legacy isHidden to status if status is not explicitly set
            let currentStatus = prod.status;
            if (!currentStatus) {
                currentStatus = prod.isHidden ? 'hidden' : 'published';
            }
            document.getElementById('prodStatus').value = currentStatus;

            if (prod.image) {
                document.getElementById('imagePreview').src = prod.image;
                document.getElementById('imageDetails').textContent = 'الصورة الحالية للمنتج';
                document.getElementById('imagePreviewContainer').style.display = 'block';
            }
        }
    } else {
        document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد';
        document.getElementById('prodStatus').value = 'published';
    }

    document.getElementById('productModal').classList.add('open');
};

window.closeProductModal = function() {
    document.getElementById('productModal').classList.remove('open');
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('prodImageFile').value = '';
    currentProcessedImageBase64 = null;
    currentProcessedImageName = null;
};

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const specsText = document.getElementById('prodSpecs').value.trim();
    const specifications = {};
    for (const line of specsText.split(/\r?\n/).filter(Boolean)) {
        const separator = line.indexOf(':');
        if (separator <= 0 || separator >= line.length - 1) {
            alert('صيغة المواصفات غير صحيحة. استخدم «اسم المواصفة: القيمة» بكل سطر.');
            return;
        }
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        if (!key || !value || key.length > 80 || value.length > 180 || key.includes('/') || key.includes('.')) {
            alert('تأكد من طول اسم المواصفة وقيمتها، ولا تستخدم / أو . داخل اسم المواصفة.');
            return;
        }
        if (Object.keys(specifications).length >= 18 && !Object.hasOwn(specifications, key)) {
            alert('الحد الأقصى 18 مواصفة لكل منتج.');
            return;
        }
        specifications[key] = value;
    }
    const retailPrice = Number(document.getElementById('prodPrice').value);
    const wholesaleRaw = document.getElementById('prodWholesalePrice').value;
    const specialRaw = document.getElementById('prodSpecialPrice').value;
    if (!Number.isFinite(retailPrice) || retailPrice <= 0 || (wholesaleRaw && (!Number.isFinite(Number(wholesaleRaw)) || Number(wholesaleRaw) <= 0)) || (specialRaw && (!Number.isFinite(Number(specialRaw)) || Number(specialRaw) <= 0))) { alert('السعر العام يجب أن يكون رقمًا موجبًا. اترك الخاص/الجملة فارغًا أو أدخل رقمًا موجبًا.'); return; }
    const prodData = {
        name: document.getElementById('prodName').value.trim(),
        category: document.getElementById('prodCategory').value,
        categoryId: document.getElementById('prodCategory').value,
        subcategory: document.getElementById('prodSubcategory').value.trim(),
        brand: document.getElementById('prodBrand').value.trim(),
        model: document.getElementById('prodModel').value.trim(),
        price: retailPrice,
        public_price: retailPrice,
        originalPrice: document.getElementById('prodOriginalPrice').value ? Number(document.getElementById('prodOriginalPrice').value) : null,
        stock: document.getElementById('prodStock').value ? Number(document.getElementById('prodStock').value) : null,
        warranty: document.getElementById('prodWarranty').value.trim(),
        description: document.getElementById('prodDesc').value.trim(),
        specifications,
        image: document.getElementById('prodImage').value.trim(),
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
function renderCategoriesManagementTable() {
    const tbody = document.getElementById('categoriesFullTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort categories by order
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));

    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:#888;">لا توجد أقسام مسجلة. انقر على "إضافة قسم جديد" للبدء</td></tr>';
        return;
    }

    categories.forEach(cat => {
        const prodCount = products.filter(p => p.categoryId === cat.id || p.category === cat.id).length;
        const isHidden = !!cat.isHidden;
        const imageUrl = cat.image || '/images/default-product.svg';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${imageUrl}" class="tp-img" alt="${cat.name}" style="border-radius:4px;"></td>
            <td><strong>${cat.name}</strong><br><small style="color:#777;">${cat.description || 'لا يوجد وصف'}</small></td>
            <td><code>${cat.id}</code></td>
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

    const form = document.getElementById('categoryForm');
    form.reset();
    document.getElementById('catId').value = '';

    if (id) {
        document.getElementById('categoryModalTitle').textContent = 'تعديل القسم';
        const cat = categories.find(c => c.id === id);
        if (cat) {
            document.getElementById('catId').value = cat.id;
            document.getElementById('catName').value = cat.name || '';
            document.getElementById('catImage').value = cat.image || '';
            document.getElementById('catDesc').value = cat.description || '';
            document.getElementById('catHidden').checked = !!cat.isHidden;
        }
    } else {
        document.getElementById('categoryModalTitle').textContent = 'إضافة قسم جديد';
        document.getElementById('catImage').value = '';
        document.getElementById('catHidden').checked = false;
    }

    document.getElementById('categoryModal').classList.add('open');
};

window.closeCategoryModal = function() {
    document.getElementById('categoryModal').classList.remove('open');
};

document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('catId').value;
    const catData = {
        name: document.getElementById('catName').value.trim(),
        image: document.getElementById('catImage').value,
        description: document.getElementById('catDesc').value.trim(),
        isHidden: document.getElementById('catHidden').checked,
        order: document.getElementById('catOrder') ? Number(document.getElementById('catOrder').value) || 0 : 0,
        updatedAt: Date.now()
    };

    if (isDemoMode) {
        if (id) {
            const index = categories.findIndex(c => c.id === id);
            if (index !== -1) {
                categories[index] = { ...categories[index], ...catData, id };
            }
            alert('تم تعديل القسم بنجاح في الذاكرة (وضع العرض التجريبي).');
        } else {
            const newId = 'demo-cat-' + Date.now();
            categories.push({ id: newId, ...catData, createdAt: Date.now() });
            alert('تمت إضافة القسم بنجاح إلى قائمة المعاينة (وضع العرض التجريبي).');
        }
        updateAllDashboardViews();
        closeCategoryModal();
        return;
    }

    try {
        if (id) {
            await update(ref(db, 'categories/' + id), catData);
            alert('تم تعديل القسم بنجاح!');
        } else {
            catData.createdAt = Date.now();
            await set(push(ref(db, 'categories')), catData);
            alert('تمت إضافة القسم بنجاح!');
        }
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
    let msg = 'هل أنت متأكد من حذف هذا القسم؟';
    if (relatedCount > 0) {
        msg = `تحذير: يوجد ${relatedCount} منتج مرتبط بهذا القسم! هل أنت متأكد من حذفه؟`;
    }
    if (!confirm(msg)) return;

    if (isDemoMode) {
        categories = categories.filter(c => c.id !== id);
        updateAllDashboardViews();
        alert('تم حذف القسم بنجاح من قائمة المعاينة.');
        return;
    }

    try {
        await remove(ref(db, 'categories/' + id));
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
            <p style="margin-top:8px;"><strong>العنوان بالتفصيل:</strong> ${order.governorate} - ${order.city} - ${order.address}</p>
            ${order.notes ? `<p style="margin-top:8px;color:#c62828;"><strong>ملاحظات العميل:</strong> ${order.notes}</p>` : ''}
        </div>

        <h4 style="font-weight:800;color:var(--dark);"><i class="fa-solid fa-boxes-packing"></i> المنتجات المطلوبة</h4>
        ${itemsHtml}

        <div style="margin-top:20px;padding-top:15px;border-top:2px solid #eee;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>مجموع المنتجات:</span> <strong>${formatPrice(order.subtotal || 0)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>أجور التوصيل:</span> <strong>${formatPrice(order.deliveryFee || 5000)}</strong></div>
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

    document.getElementById('orderModal').classList.add('open');
};

window.closeOrderModal = function() {
    document.getElementById('orderModal').classList.remove('open');
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
            modal.classList.remove('open');
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

// ================= SECURE IMAGE UPLOAD & VERIFICATION =================
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

        if (prodImageInput) prodImageInput.value = data.path;
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

// ================= CATALOG REVIEW (DRAFTS) =================

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
let storeSettings = { storeNameAr: 'سبايدر للإلكترونيات', storeNameEn: 'Spider Electronics', whatsappNumber: '+9647827337942', deliveryFee: 5000, chatbotEnabled: true, chatbotSettings: { ...DEFAULT_CHATBOT_SETTINGS } };

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

onValue(ref(db, 'settings'), (snapshot) => {
    if (snapshot.exists()) {
        storeSettings = { ...storeSettings, ...snapshot.val() };
    }

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
    const elWa = document.getElementById('settingWhatsapp');
    const elDf = document.getElementById('settingDeliveryFee');
    if (elWa) elWa.value = storeSettings.whatsappNumber || storeSettings.whatsapp || storeSettings.storePhone || '';
    if (elDf) elDf.value = storeSettings.deliveryFee || 5000;
    renderChatbotPreview(storeSettings.chatbotSettings || DEFAULT_CHATBOT_SETTINGS);
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
    modal.classList.add('open');
    modal.style.display = 'flex';
};

window.closeManagerModal = function() {
    const modal = document.getElementById('managerModal');
    modal.classList.remove('open');
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
    modal.classList.add('open');
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
    
    document.getElementById('resetPinModal').classList.add('open');
};

window.closeResetPinModal = function() {
    document.getElementById('resetPinModal').classList.remove('open');
};

document.getElementById('resetPinForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentAdminUser || currentAdminUser.uid !== SUPER_ADMIN_UID) return;
    
    const uid = document.getElementById('resetPinUid').value;
    const newPin = document.getElementById('resetPinNew').value;
    const confirmPin = document.getElementById('resetPinConfirm').value;
    const errorDiv = document.getElementById('resetPinError');
    const submitBtn = document.getElementById('resetPinSubmitBtn');
    
    if (newPin !== confirmPin) {
        errorDiv.textContent = 'رمز PIN غير متطابق!';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (!/^\d{4}$/.test(newPin)) {
        errorDiv.textContent = 'الرمز يجب أن يكون 4 أرقام.';
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
            body: JSON.stringify({ targetUid: uid, newPin: newPin, confirmPin: confirmPin })
        });
        
        const data = await res.json().catch(()=>null);
        if (res.ok && data?.success) {
            alert('تم إعادة تعيين الرمز بنجاح!');
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
        submitBtn.innerHTML = '<i class="fa-solid fa-key"></i> تحديث الرمز';
    }
});
