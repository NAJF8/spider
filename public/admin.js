import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
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

// ================= AUTHENTICATION =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.uid === SUPER_ADMIN_UID) {
            isDemoMode = false;
            const banner = document.getElementById('adminDemoBanner');
            if (banner) banner.style.display = 'none';

            loginScreen.classList.add('hidden');
            adminScreen.classList.remove('hidden');
            errorMsg.classList.add('hidden');
            
            adminName.textContent = user.displayName || 'محمد مسلم';
            adminRole.innerHTML = '<i class="fa-solid fa-crown"></i> سوبر مشرف';
            if (user.photoURL) adminAvatar.src = user.photoURL;
            
            loadDashboardData();
        } else {
            // Reject unauthorized accounts
            signOut(auth);
            loginScreen.classList.remove('hidden');
            adminScreen.classList.add('hidden');
            errorMsg.textContent = 'عذراً، هذا الحساب غير مخول. صلاحية سوبر مشرف محصورة للمالك فقط.';
            errorMsg.classList.remove('hidden');
        }
    } else {
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
}

function updateCategorySelects() {
    const prodSelect = document.getElementById('prodCategory');
    const filterSelect = document.getElementById('productCategoryFilter');

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
}

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
    const prodData = {
        name: document.getElementById('prodName').value.trim(),
        category: document.getElementById('prodCategory').value,
        categoryId: document.getElementById('prodCategory').value,
        subcategory: document.getElementById('prodSubcategory').value.trim(),
        brand: document.getElementById('prodBrand').value.trim(),
        model: document.getElementById('prodModel').value.trim(),
        price: Number(document.getElementById('prodPrice').value),
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
            alert('تم تحديث المنتج بنجاح!');
        } else {
            prodData.createdAt = Date.now();
            await set(push(ref(db, 'products')), prodData);
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
let storeSettings = { whatsapp: '+9647827337942', deliveryFee: 5000 };

onValue(ref(db, 'settings'), (snapshot) => {
    if (snapshot.exists()) {
        storeSettings = { ...storeSettings, ...snapshot.val() };
    }
    
    // Store in localStorage for storefront
    localStorage.setItem('spider_store_settings', JSON.stringify(storeSettings));
    
    // Update UI
    const elWa = document.getElementById('settingWhatsapp');
    const elDf = document.getElementById('settingDeliveryFee');
    if (elWa) elWa.value = storeSettings.whatsapp || '';
    if (elDf) elDf.value = storeSettings.deliveryFee || 5000;
});

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isDemoMode) {
        alert('لا يمكن حفظ الإعدادات في وضع المعاينة.');
        return;
    }
    
    const wa = document.getElementById('settingWhatsapp').value.trim();
    const df = Number(document.getElementById('settingDeliveryFee').value);
    
    try {
        await update(ref(db, 'settings'), { whatsapp: wa, deliveryFee: df });
        alert('تم حفظ الإعدادات بنجاح.');
    } catch(err) {
        alert('فشل حفظ الإعدادات: ' + err.message);
    }
});
