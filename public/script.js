import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3_h6cWLhOx3nBgH2mGBAUpVaGpqQOxz0",
    authDomain: "spider-aaa19.firebaseapp.com",
    databaseURL: "https://spider-aaa19-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "spider-aaa19",
    storageBucket: "spider-aaa19.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Data State
let products = [];
let categories = [];
let cart = [];
let whatsappNumber = "+9647827337942";
let deliveryFee = 5000;

// DOM Elements
const categoriesGrid = document.getElementById('categoriesGrid');
const productsGrid = document.getElementById('productsGrid');
const sidebarNav = document.getElementById('sidebarNav');
const compareProd1Select = document.getElementById('compareProd1Select');
const compareProd2Select = document.getElementById('compareProd2Select');
const compareCategorySelect = document.getElementById('compareCategorySelect');
const compareResults = document.getElementById('compareResults');
const changeCompareBtn = document.getElementById('changeCompareBtn');
const cartBadge = document.getElementById('cartBadge');
const cartItemsList = document.getElementById('cartItemsList');
const cartTotalValue = document.getElementById('cartTotalValue');
const checkoutBtn = document.getElementById('checkoutBtn');
const builderPartsList = document.getElementById('builderPartsList');
const builderTotal = document.getElementById('builderTotal');
const addBuilderToCartBtn = document.getElementById('addBuilderToCartBtn');

// Modals
const cartOverlay = document.getElementById('cartOverlay');
const cartSidebar = document.getElementById('cartSidebar');
const checkoutModal = document.getElementById('checkoutModal');
const productDetailsModal = document.getElementById('productDetailsModal');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarMenu = document.getElementById('sidebarMenu');
const chatbotContainer = document.getElementById('chatbotContainer');

// Utility Functions
function formatPrice(price) {
    if (!price || isNaN(price)) return '0 د.ع';
    return Number(price).toLocaleString('ar-IQ') + ' د.ع';
}

// Fetch Firebase Data
onValue(ref(db, 'categories'), (snapshot) => {
    categories = [];
    if (snapshot.exists()) {
        snapshot.forEach(child => {
            const cat = { id: child.key, ...child.val() };
            if (!cat.isHidden) categories.push(cat);
        });
    }
    renderCategories();
    populateCompareCategories();
});

onValue(ref(db, 'products'), (snapshot) => {
    products = [];
    if (snapshot.exists()) {
        snapshot.forEach(child => {
            const prod = { id: child.key, ...child.val() };
            if (prod.status === 'published' && !prod.isHidden) {
                products.push(prod);
            }
        });
    }
    renderProducts();
    populateCompareSelects();
    renderPCBuilder();
});

onValue(ref(db, 'settings'), (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.storePhone) whatsappNumber = data.storePhone;
        if (data.deliveryFee !== undefined) deliveryFee = Number(data.deliveryFee);
    }
});

// Render Categories
function renderCategories() {
    if (!categoriesGrid || !sidebarNav) return;
    categoriesGrid.innerHTML = '';
    sidebarNav.innerHTML = '';
    
    if (categories.length === 0) {
        categoriesGrid.innerHTML = '<div class="loading-state">لا توجد أقسام متاحة حالياً.</div>';
        return;
    }

    const categoryFallbacks = {
        'معالجات': 'fa-microchip',
        'شاشات': 'fa-tv',
        'كروت': 'fa-memory',
        'ذاكرة': 'fa-memory',
        'لابتوب': 'fa-laptop',
        'تخزين': 'fa-hard-drive',
        'طاقة': 'fa-plug',
        'صندوق': 'fa-box'
    };

    categories.forEach(cat => {
        let fallbackIcon = 'fa-folder';
        for (const [key, icon] of Object.entries(categoryFallbacks)) {
            if (cat.name.includes(key)) {
                fallbackIcon = icon;
                break;
            }
        }
        
        const mediaHtml = cat.image 
            ? `<img src="${cat.image}" alt="${cat.name}">` 
            : `<i class="fa-solid ${fallbackIcon}" style="font-size:2rem;color:var(--primary);"></i>`;
            
        const sidebarMediaHtml = cat.image
            ? `<img src="${cat.image}" alt="${cat.name}" style="width:24px; height:24px; object-fit:cover; border-radius:4px; margin-left:8px;">`
            : `<i class="fa-solid ${fallbackIcon}" style="width:24px; text-align:center; margin-left:8px; color:var(--primary);"></i>`;

        // Grid
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-card-media">
                ${mediaHtml}
            </div>
            <div class="category-name">${cat.name}</div>
        `;
        card.onclick = () => filterProductsByCategory(cat.id);
        categoriesGrid.appendChild(card);

        // Sidebar
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="#productsSection" onclick="filterProductsByCategory('${cat.id}'); document.getElementById('closeSidebarBtn').click();">
                ${sidebarMediaHtml} ${cat.name}
            </a>
        `;
        sidebarNav.appendChild(li);
    });
}

// Render Products
let currentCategoryFilter = null;
let currentBrandFilter = null;
let currentSearchFilter = '';

function renderProducts() {
    if (!productsGrid) return;
    
    let filtered = products;
    if (currentCategoryFilter) {
        filtered = filtered.filter(p => p.categoryId === currentCategoryFilter || p.category === currentCategoryFilter);
    }
    if (currentBrandFilter) {
        filtered = filtered.filter(p => p.brand?.toLowerCase() === currentBrandFilter.toLowerCase());
    }
    if (currentSearchFilter) {
        const search = currentSearchFilter.toLowerCase();
        filtered = filtered.filter(p => p.name?.toLowerCase().includes(search) || p.description?.toLowerCase().includes(search));
    }

    productsGrid.innerHTML = '';
    if (filtered.length === 0) {
        productsGrid.innerHTML = '<div class="loading-state">لا توجد منتجات مطابقة.</div>';
        return;
    }

    filtered.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <button class="fav-btn"><i class="fa-regular fa-heart"></i></button>
            <div class="product-photo" onclick="openProductDetails('${prod.id}')" style="cursor:pointer;">
                <img src="${prod.image || 'assets/spider-logo.png'}" alt="${prod.name}">
            </div>
            <div class="product-info">
                <div class="product-title" onclick="openProductDetails('${prod.id}')" style="cursor:pointer;">${prod.name}</div>
                <div class="product-subtitle">${prod.subcategory || prod.brand || 'منتج مميز'}</div>
                <div class="product-price-row">
                    ${prod.originalPrice ? `<span class="product-old-price">${formatPrice(prod.originalPrice)}</span>` : ''}
                    <span class="product-price">${formatPrice(prod.price)}</span>
                </div>
                <div class="product-buttons">
                    <button class="btn btn-add-cart" onclick="addToCart('${prod.id}')"><i class="fa-solid fa-cart-plus"></i> أضف للسلة</button>
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

function filterProductsByCategory(categoryId) {
    currentCategoryFilter = categoryId;
    currentBrandFilter = null;
    currentSearchFilter = '';
    const cat = categories.find(c => c.id === categoryId);
    document.getElementById('productsSectionTitle').innerHTML = cat ? `منتجات قسم: ${cat.name} <button onclick="clearAllFilters()" style="margin-right:10px; font-size:0.75rem; padding:4px 8px; background:var(--primary); color:white; border:none; border-radius:4px; cursor:pointer;">إلغاء الفلتر <i class="fa-solid fa-xmark"></i></button>` : 'جميع المنتجات';
    document.getElementById('productsSection').scrollIntoView({behavior:'smooth'});
    renderProducts();
}

document.getElementById('viewAllCatBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllFilters();
});
document.getElementById('viewAllProdBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllFilters();
});

document.getElementById('searchInput')?.addEventListener('input', (e) => {
    currentSearchFilter = e.target.value;
    document.getElementById('productsSectionTitle').innerHTML = currentSearchFilter ? `نتائج البحث <button onclick="clearAllFilters()" style="margin-right:10px; font-size:0.75rem; padding:4px 8px; background:var(--primary); color:white; border:none; border-radius:4px; cursor:pointer;">إلغاء الفلتر <i class="fa-solid fa-xmark"></i></button>` : 'جميع المنتجات';
    renderProducts();
});

// Brands Event Listeners
document.querySelectorAll('.brand-item').forEach(btn => {
    btn.addEventListener('click', () => {
        currentBrandFilter = btn.getAttribute('data-brand');
        currentCategoryFilter = null;
        currentSearchFilter = '';
        document.getElementById('productsSectionTitle').innerHTML = `منتجات ماركة: ${currentBrandFilter} <button onclick="clearAllFilters()" style="margin-right:10px; font-size:0.75rem; padding:4px 8px; background:var(--primary); color:white; border:none; border-radius:4px; cursor:pointer;">إلغاء الفلتر <i class="fa-solid fa-xmark"></i></button>`;
        document.getElementById('productsSection').scrollIntoView({behavior:'smooth'});
        renderProducts();
    });
});

window.clearAllFilters = function() {
    currentCategoryFilter = null;
    currentBrandFilter = null;
    currentSearchFilter = '';
    document.getElementById('productsSectionTitle').innerHTML = 'جميع المنتجات';
    document.getElementById('searchInput').value = '';
    renderProducts();
};

document.getElementById('viewAllBrandsBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllFilters();
});


// ================= CART & CHECKOUT =================
function addToCart(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...prod, qty: 1 });
    }
    updateCartUI();
    
    // Show Cart Sidebar
    cartOverlay.classList.add('open');
    cartSidebar.classList.add('open');
}

function updateCartUI() {
    cartBadge.textContent = cart.reduce((acc, item) => acc + item.qty, 0);
    cartItemsList.innerHTML = '';
    let total = 0;
    
    if (cart.length === 0) {
        cartItemsList.innerHTML = '<div class="empty-cart">السلة فارغة</div>';
        checkoutBtn.disabled = true;
        cartTotalValue.textContent = '0 د.ع';
        return;
    }
    
    checkoutBtn.disabled = false;
    cart.forEach((item, index) => {
        total += (item.price * item.qty);
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <img src="${item.image || 'assets/spider-logo.png'}" class="cart-item-img" alt="${item.name}">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="updateCartQty(${index}, 1)"><i class="fa-solid fa-plus"></i></button>
                    <input type="text" class="qty-input" value="${item.qty}" readonly>
                    <button class="qty-btn" onclick="updateCartQty(${index}, -1)"><i class="fa-solid fa-minus"></i></button>
                    <button class="remove-btn" onclick="removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        cartItemsList.appendChild(el);
    });
    cartTotalValue.textContent = formatPrice(total);
}

window.updateCartQty = function(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    updateCartUI();
};
window.removeFromCart = function(index) {
    cart.splice(index, 1);
    updateCartUI();
};

checkoutBtn.addEventListener('click', () => {
    cartSidebar.classList.remove('open');
    cartOverlay.classList.remove('open');
    
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById('checkoutSubtotal').textContent = formatPrice(subtotal);
    document.getElementById('checkoutTotal').textContent = formatPrice(subtotal + deliveryFee);
    
    checkoutModal.classList.add('open');
});

document.getElementById('closeCheckoutBtn').addEventListener('click', () => {
    checkoutModal.classList.remove('open');
});

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    alert('عذراً، وظيفة إرسال الطلبات معطلة مؤقتاً لأغراض الصيانة الأمنية. سيتم تفعيلها قريباً بعد إضافة التحقق من الخادم.');
});


// ================= PRODUCT DETAILS MODAL =================
window.openProductDetails = function(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const specsHtml = prod.specifications ? Object.entries(prod.specifications).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('') : '<div style="color:var(--gray-500)">لا توجد مواصفات إضافية</div>';
    
    document.getElementById('productDetailsBody').innerHTML = `
        <img src="${prod.image || 'assets/spider-logo.png'}" class="product-modal-img" alt="${prod.name}">
        <div style="flex:1;">
            <div class="product-modal-title">${prod.name}</div>
            <div style="font-size:0.8rem;color:var(--gray-500);margin-bottom:10px;">${prod.brand || ''} | ${prod.model || ''}</div>
            <div class="product-modal-price-wrap">${formatPrice(prod.price)}</div>
            ${prod.originalPrice ? `<div style="font-size:0.8rem;color:var(--gray-500);text-decoration:line-through;margin-bottom:10px;text-align:right;direction:ltr;">${formatPrice(prod.originalPrice)}</div>` : ''}
            
            <div class="product-modal-desc" style="margin: 16px 0;">${(prod.description || 'لا يوجد وصف متاح').replace(/\n/g, '<br>')}</div>
            
            <div class="product-modal-specs-box">
                <h4 style="margin-bottom:8px;font-size:0.9rem;">المواصفات</h4>
                ${specsHtml}
                ${prod.warranty ? `<div style="margin-top:10px;color:var(--primary);"><i class="fa-solid fa-shield-halved"></i> <strong>الضمان:</strong> ${prod.warranty}</div>` : ''}
            </div>
            
            <button class="btn-checkout" style="margin-top:16px;" onclick="addToCart('${prod.id}'); closeProductDetailsModal();"><i class="fa-solid fa-cart-plus"></i> أضف للسلة</button>
        </div>
    `;
    productDetailsModal.classList.add('open');
};

document.getElementById('closeProductDetailsBtn').addEventListener('click', closeProductDetailsModal);
function closeProductDetailsModal() {
    productDetailsModal.classList.remove('open');
}


// ================= COMPARISON =================
function populateCompareCategories() {
    compareCategorySelect.innerHTML = '<option value="">-- فلترة حسب القسم --</option>';
    categories.forEach(cat => {
        compareCategorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
}

function populateCompareSelects() {
    const filterCatId = compareCategorySelect.value;
    let list = products;
    if (filterCatId) {
        list = list.filter(p => p.categoryId === filterCatId || p.category === filterCatId);
    }
    
    let opts = '<option value="">اختر منتجاً...</option>';
    list.forEach(p => {
        opts += `<option value="${p.id}">${p.name}</option>`;
    });
    
    const v1 = compareProd1Select.value;
    const v2 = compareProd2Select.value;
    
    compareProd1Select.innerHTML = opts;
    compareProd2Select.innerHTML = opts;
    
    // Restore if still available
    if(list.find(p=>p.id === v1)) compareProd1Select.value = v1;
    if(list.find(p=>p.id === v2)) compareProd2Select.value = v2;
    
    updateCompareView();
}

compareCategorySelect.addEventListener('change', populateCompareSelects);
compareProd1Select.addEventListener('change', updateCompareView);
compareProd2Select.addEventListener('change', updateCompareView);

function updateCompareView() {
    const p1Id = compareProd1Select.value;
    const p2Id = compareProd2Select.value;
    
    const p1 = products.find(p => p.id === p1Id);
    const p2 = products.find(p => p.id === p2Id);
    
    if (p1 && p2) {
        document.getElementById('compareSelectors').classList.add('hidden');
        compareResults.classList.remove('hidden');
        renderComparison(p1, p2);
    } else {
        document.getElementById('compareSelectors').classList.remove('hidden');
        compareResults.classList.add('hidden');
        
        // Update placeholders
        if(p1) {
            document.getElementById('compareBox1').querySelector('.compare-img-placeholder').innerHTML = `<img src="${p1.image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            document.getElementById('compareBox1').querySelector('.compare-img-placeholder').innerHTML = `<i class="fa-solid fa-image"></i>`;
        }
        
        if(p2) {
            document.getElementById('compareBox2').querySelector('.compare-img-placeholder').innerHTML = `<img src="${p2.image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            document.getElementById('compareBox2').querySelector('.compare-img-placeholder').innerHTML = `<i class="fa-solid fa-image"></i>`;
        }
    }
}

changeCompareBtn.addEventListener('click', () => {
    compareProd1Select.value = "";
    compareProd2Select.value = "";
    updateCompareView();
});

function renderComparison(p1, p2) {
    const allSpecsKeys = new Set([
        ...Object.keys(p1.specifications || {}),
        ...Object.keys(p2.specifications || {})
    ]);
    
    let specsHtml = '';
    allSpecsKeys.forEach(key => {
        specsHtml += `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid var(--gray-200); font-size:0.75rem;">
                <div style="flex:1; text-align:right;">${(p1.specifications || {})[key] || '-'}</div>
                <div style="flex:1; text-align:center; font-weight:800; color:var(--gray-600);">${key}</div>
                <div style="flex:1; text-align:left;">${(p2.specifications || {})[key] || '-'}</div>
            </div>
        `;
    });
    
    compareResults.innerHTML = `
        <div class="compare-card" style="text-align:center;">
            <img src="${p1.image || 'assets/spider-logo.png'}">
            <h4>${p1.name}</h4>
            <div class="c-price">${formatPrice(p1.price)}</div>
            <button class="btn-checkout" style="padding:6px; font-size:0.8rem;" onclick="addToCart('${p1.id}')">أضف للسلة</button>
        </div>
        <div style="display:flex; flex-direction:column; background:var(--white); border-radius:var(--radius-md); border:1px solid var(--gray-200); overflow:hidden;">
            <div style="background:var(--gray-100); text-align:center; padding:10px; font-weight:900;">المواصفات</div>
            ${specsHtml}
            <div style="display:flex; justify-content:space-between; padding:8px; font-size:0.75rem;">
                <div style="flex:1; text-align:right;">${p1.warranty || '-'}</div>
                <div style="flex:1; text-align:center; font-weight:800; color:var(--gray-600);">الضمان</div>
                <div style="flex:1; text-align:left;">${p2.warranty || '-'}</div>
            </div>
        </div>
        <div class="compare-card" style="text-align:center;">
            <img src="${p2.image || 'assets/spider-logo.png'}">
            <h4>${p2.name}</h4>
            <div class="c-price">${formatPrice(p2.price)}</div>
            <button class="btn-checkout" style="padding:6px; font-size:0.8rem;" onclick="addToCart('${p2.id}')">أضف للسلة</button>
        </div>
    `;
}


// ================= PC BUILDER =================
const pcPartsConfig = [
    { id: 'cpu', name: 'المعالج (CPU)', icon: 'fa-microchip', categoryHints: ['معالجات', 'cpu'] },
    { id: 'motherboard', name: 'اللوحة الأم (Motherboard)', icon: 'fa-chess-board', categoryHints: ['لوحة', 'مذربورد', 'motherboard'] },
    { id: 'ram', name: 'الرامات (RAM)', icon: 'fa-memory', categoryHints: ['رام', 'ذاكرة', 'ram'] },
    { id: 'gpu', name: 'كرت الشاشة (GPU)', icon: 'fa-vr-cardboard', categoryHints: ['شاشة', 'gpu', 'vga'] },
    { id: 'storage', name: 'التخزين (Storage)', icon: 'fa-hard-drive', categoryHints: ['تخزين', 'هارد', 'ssd', 'hdd'] },
    { id: 'psu', name: 'مزود الطاقة (PSU)', icon: 'fa-plug', categoryHints: ['طاقة', 'باور', 'psu'] },
    { id: 'case', name: 'الصندوق (Case)', icon: 'fa-box', categoryHints: ['صندوق', 'كيس', 'case'] }
];

let builderSelections = {};

function renderPCBuilder() {
    builderPartsList.innerHTML = '';
    pcPartsConfig.forEach(part => {
        // Find matching categories
        const matchingCatIds = categories.filter(c => part.categoryHints.some(hint => c.name.toLowerCase().includes(hint))).map(c => c.id);
        
        // Find products in these categories
        const partProducts = products.filter(p => matchingCatIds.includes(p.categoryId || p.category));
        
        let selectHtml = `<select class="form-select builder-select" data-part="${part.id}">
            <option value="">-- اختر ${part.name} --</option>
            ${partProducts.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} - ${formatPrice(p.price)}</option>`).join('')}
        </select>`;

        builderPartsList.innerHTML += `
            <div class="builder-part-row">
                <div class="builder-part-header">
                    <div class="builder-part-icon"><i class="fa-solid ${part.icon}"></i></div>
                    <div class="builder-part-title">${part.name}</div>
                </div>
                ${selectHtml}
            </div>
        `;
    });

    document.querySelectorAll('.builder-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const partId = e.target.getAttribute('data-part');
            const val = e.target.value;
            if (val) {
                const price = Number(e.target.options[e.target.selectedIndex].getAttribute('data-price'));
                builderSelections[partId] = { id: val, price: price };
            } else {
                delete builderSelections[partId];
            }
            updateBuilderTotal();
        });
    });
}

function updateBuilderTotal() {
    let sum = 0;
    let partsCount = 0;
    for (const key in builderSelections) {
        sum += builderSelections[key].price;
        partsCount++;
    }
    builderTotal.innerHTML = `<span>${formatPrice(sum)}</span>`;
    addBuilderToCartBtn.disabled = partsCount === 0;
}

addBuilderToCartBtn.addEventListener('click', () => {
    for (const key in builderSelections) {
        addToCart(builderSelections[key].id);
    }
    builderSelections = {};
    document.querySelectorAll('.builder-select').forEach(sel => sel.value = "");
    updateBuilderTotal();
    alert('تم إضافة القطع المحددة إلى السلة بنجاح!');
});


// ================= CHATBOT =================
document.getElementById('openChatbotBtn').addEventListener('click', () => {
    chatbotContainer.style.display = 'flex';
});

document.getElementById('closeChatBtn').addEventListener('click', () => {
    chatbotContainer.style.display = 'none';
});

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

function appendMessage(text, isUser = false) {
    const el = document.createElement('div');
    el.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    el.textContent = text;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendChatBtn.addEventListener('click', handleChatSubmit);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
});

function handleChatSubmit() {
    const txt = chatInput.value.trim();
    if (!txt) return;
    appendMessage(txt, true);
    chatInput.value = '';
    
    // Simple mock response logic
    setTimeout(() => {
        if (txt.includes('لابتوب')) {
            appendMessage('عدنا لابتوبات ممتازة من ASUS و Lenovo. تحب تشوف قسم اللابتوبات؟');
        } else if (txt.includes('سعر') || txt.includes('بشكد')) {
            appendMessage('الأسعار مكتوبة تحت كل منتج، وتكدر تقارن بيناتهم بسهولة.');
        } else {
            appendMessage('أهلاً بيك! للأسف ما فهمت قصدك بالضبط. تكدر تطلب أي منتج من السلة وتكمل عبر الواتساب.');
        }
    }, 800);
}

// Sidebars & Overlays Setup
document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    sidebarOverlay.classList.add('open');
    sidebarMenu.classList.add('open');
});
document.getElementById('closeSidebarBtn').addEventListener('click', () => {
    sidebarOverlay.classList.remove('open');
    sidebarMenu.classList.remove('open');
});
sidebarOverlay.addEventListener('click', () => {
    sidebarOverlay.classList.remove('open');
    sidebarMenu.classList.remove('open');
});

document.getElementById('openCartBtn').addEventListener('click', () => {
    cartOverlay.classList.add('open');
    cartSidebar.classList.add('open');
});
document.getElementById('closeCartBtn').addEventListener('click', () => {
    cartOverlay.classList.remove('open');
    cartSidebar.classList.remove('open');
});
cartOverlay.addEventListener('click', () => {
    cartOverlay.classList.remove('open');
    cartSidebar.classList.remove('open');
});

document.getElementById('whatsappOrderBtn').addEventListener('click', () => {
    window.open(`https://wa.me/${whatsappNumber.replace('+', '')}`, '_blank');
});
