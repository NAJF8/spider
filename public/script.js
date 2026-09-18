import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { 
    DEMO_NOTICE, 
    DEMO_CATEGORIES, 
    DEMO_PRODUCTS, 
    DEMO_BUNDLES, 
    isPreviewMode, 
    setPreviewMode 
} from "./demo-data.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3_h6cWLhOx3nBgH2mGBAUpVaGpqQOxz0",
    authDomain: "spider-aaa19.firebaseapp.com",
    databaseURL: "https://spider-aaa19-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "spider-aaa19",
    storageBucket: "spider-aaa19.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State
let products = [];
let categories = [];
let bundles = [...DEMO_BUNDLES];
let liveProducts = [];
let liveCategories = [];
let hasLiveProducts = false;
let hasLiveCategories = false;
let cart = JSON.parse(localStorage.getItem('spider_cart')) || [];
if (!Array.isArray(cart)) cart = [];

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const categoriesGrid = document.getElementById('categoriesGrid');
const bundlesGrid = document.getElementById('bundlesGrid');
const cartBadge = document.getElementById('cartBadge');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const cartItemsList = document.getElementById('cartItemsList');
const cartTotalValue = document.getElementById('cartTotalValue');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const checkoutForm = document.getElementById('checkoutForm');
const searchInput = document.getElementById('searchInput');

// Demo Banner DOM Elements
const demoBanner = document.getElementById('demoNoticeBanner');
const toggleDemoBtn = document.getElementById('toggleDemoBtn');
const toggleDemoIcon = document.getElementById('toggleDemoIcon');
const toggleDemoLabel = document.getElementById('toggleDemoLabel');

// Initialize
function init() {
    updateDemoBannerUI();
    setupListeners();
    fetchData();
    updateCartUI();
}

function formatPrice(price) {
    if (!price || isNaN(price)) return '0 د.ع';
    return Number(price).toLocaleString('ar-IQ') + ' د.ع';
}

function updateDemoBannerUI() {
    const isDemo = isPreviewMode();
    if (toggleDemoIcon) {
        toggleDemoIcon.className = isDemo ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off';
    }
    if (toggleDemoLabel) {
        toggleDemoLabel.textContent = isDemo ? 'وضع المعاينة مفعّل' : 'البيانات الحية (إنتاج)';
    }
    if (demoBanner) {
        demoBanner.style.backgroundColor = isDemo ? '#141419' : '#1e293b';
    }
}

function applyCurrentDataMode() {
    if (isPreviewMode()) {
        categories = [...DEMO_CATEGORIES];
        products = [...DEMO_PRODUCTS];
        bundles = [...DEMO_BUNDLES];
        renderCategories();
        activeCategoryId ? window.filterByCategory(activeCategoryId) : renderProducts(products);
        renderBundles(bundles);
        renderOffersGrid();
    } else {
        categories = [...liveCategories];
        products = [...liveProducts];
        bundles = [];
        
        if (hasLiveCategories && categories.length > 0) {
            renderCategories();
        } else {
            categoriesGrid.innerHTML = `
                <div class="empty-state-card">
                    <i class="fa-solid fa-folder-open"></i>
                    <h4>أقسام المتجر قيد التحديث</h4>
                    <p>قاعدة البيانات الحالية لا تحتوي على أقسام منشورة بعد.</p>
                    <button class="btn btn-primary btn-sm" onclick="enableDemoMode()" style="margin-top: 10px;">
                        <i class="fa-solid fa-eye"></i> تشغيل وضع المعاينة لعرض الأقسام النموذجية
                    </button>
                </div>`;
        }

        if (hasLiveProducts && products.length > 0) {
            activeCategoryId ? window.filterByCategory(activeCategoryId) : renderProducts(products);
        } else {
            productsGrid.innerHTML = `
                <div class="empty-state-card">
                    <i class="fa-solid fa-boxes-stacked"></i>
                    <h4>لا توجد منتجات منشورة حالياً</h4>
                    <p>يمكنك إضافة منتجات حقيقية عبر لوحة الإدارة، أو تفعيل وضع المعاينة لتجربة تصفح المتجر.</p>
                    <button class="btn btn-primary btn-sm" onclick="enableDemoMode()" style="margin-top: 10px;">
                        <i class="fa-solid fa-eye"></i> تفعيل وضع المعاينة
                    </button>
                </div>`;
        }
        renderOffersGrid();

        if (bundlesGrid) {
            bundlesGrid.innerHTML = `
                <div class="empty-state-card" style="grid-column: 1 / -1;">
                    <i class="fa-solid fa-desktop"></i>
                    <h4>لا توجد تجميعات منشورة في وضع الإنتاج</h4>
                    <p>قم بتفعيل وضع المعاينة للاطلاع على التجميعات النموذجية ومواصفاتها وتجربة إضافتها للسلة.</p>
                </div>`;
        }
    }
}

window.enableDemoMode = function() {
    setPreviewMode(true);
    updateDemoBannerUI();
    applyCurrentDataMode();
};

function fetchData() {
    if (isPreviewMode()) {
        applyCurrentDataMode();
    }

    onValue(ref(db, 'categories'), (snapshot) => {
        liveCategories = [];
        hasLiveCategories = snapshot.exists();
        if (hasLiveCategories) {
            snapshot.forEach(child => {
                liveCategories.push({ id: child.key, ...child.val() });
            });
        }
        if (!isPreviewMode()) {
            applyCurrentDataMode();
        }
    }, (error) => {
        console.error("Firebase categories read error:", error);
        if (!isPreviewMode()) {
            categoriesGrid.innerHTML = `<div class="empty-state-card"><i class="fa-solid fa-triangle-exclamation"></i><h4>خطأ في جلب الأقسام</h4><p>${error.message}</p></div>`;
        }
    });

    onValue(ref(db, 'products'), (snapshot) => {
        liveProducts = [];
        hasLiveProducts = snapshot.exists();
        if (hasLiveProducts) {
            snapshot.forEach(child => {
                liveProducts.push({ id: child.key, ...child.val() });
            });
        }
        if (!isPreviewMode()) {
            applyCurrentDataMode();
        }
    }, (error) => {
        console.error("Firebase products read error:", error);
        if (!isPreviewMode()) {
            productsGrid.innerHTML = `<div class="empty-state-card"><i class="fa-solid fa-triangle-exclamation"></i><h4>خطأ في جلب المنتجات</h4><p>${error.message}</p></div>`;
        }
    });
}

function getPublicCategoryImage(cat) {
    const token = `${cat.id || ''} ${cat.name || ''}`.toLowerCase();
    if (/gpu|كرت|شاشة رسومية/.test(token)) return 'assets/gpu.jpg';
    if (/laptop|لابتوب/.test(token)) return 'assets/laptop.jpg';
    if (/cpu|معالج/.test(token)) return 'assets/cpu.jpg';
    if (/monitor|شاشات|عرض/.test(token)) return 'assets/monitor.jpg';
    if (/accessor|ملحق|سماعات/.test(token)) return 'assets/headset.jpg';
    if (/bundle|computer|pc|كمبيوتر|تجميعة/.test(token)) return 'assets/gaming-pc.jpg';
    if (/game|كونسول|ألعاب/.test(token)) return 'assets/gamepad.jpg';
    if (/ram|ذاكرة/.test(token)) return 'assets/cpu.jpg';
    return 'assets/gaming-pc.jpg';
}
function renderCategories() {
    if (!categoriesGrid) return;
    categoriesGrid.innerHTML = '';
    const visible = categories.filter(cat => !cat.isHidden);
    const topLevel = visible.filter(cat => !cat.parentCategory);
    if (!topLevel.length) {
        categoriesGrid.innerHTML = '<div class="empty-state-card">لا توجد أقسام ظاهرة حالياً</div>';
        return;
    }
    // The seven-card visual layout is a presentation choice, never a substitute for Firebase categories.
    const rank = ['cat-bundles','cat-laptops','cat-cpus','cat-gpus','cat-monitors','cat-accessories'];
    const ordered = [...topLevel].sort((a,b) => (rank.indexOf(a.id) < 0 ? 99 : rank.indexOf(a.id)) - (rank.indexOf(b.id) < 0 ? 99 : rank.indexOf(b.id)));
    ordered.forEach(cat => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'category-card';
        const image = cat.image || getPublicCategoryImage(cat);
        card.innerHTML = `<div class="category-card-media"><img src="${image}" alt="" loading="lazy" onerror="this.onerror=null;this.src='images/default-category.svg'"></div><span class="category-name">${cat.name}</span><span class="category-arrow" aria-hidden="true">→</span>`;
        card.addEventListener('click', () => window.filterByCategory(cat.id));
        categoriesGrid.appendChild(card);
    });
}

function truncateArabicText(text, maxLength = 90) {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength).trim() + '...' : text;
}

const DEMO_ART = {
    'demo-laptop-1': 'assets/product-laptop.jpg',
    'demo-gpu-1': 'assets/product-gpu.jpg',
    'demo-cpu-1': 'assets/product-cpu.jpg',
    'demo-monitor-1': 'assets/product-monitor.jpg',
    'demo-headset-1': 'assets/product-headset.jpg'
};
const PRODUCT_IMAGE_FALLBACK = 'images/default-product.svg';
function getProductImage(product) {
    return isPreviewMode() && DEMO_ART[product.id] ? DEMO_ART[product.id] : (product.image || PRODUCT_IMAGE_FALLBACK);
}
function renderProducts(productsToRender) {
    productsGrid.innerHTML = '';
    const visibleProducts = productsToRender.filter(p => !p.isHidden);
    if (!visibleProducts.length) {
        productsGrid.innerHTML = '<div class="empty-state-card"><i class="fa-solid fa-box-open"></i><h4>ماكو منتجات متوفرة بهذا القسم حالياً</h4><p>جرّب قسم ثاني أو اضغط عرض الكل.</p><button class="btn btn-primary" onclick="filterByCategory('')">عرض كل المنتجات</button></div>';
        return;
    }
    // Show featured items on the initial landing view, all matching items in a filtered section.
    const showAll = Boolean(activeCategoryId || activeSearchQuery);
    const items = showAll ? visibleProducts : visibleProducts.slice().sort((a,b) => Number(!!b.isFeatured)-Number(!!a.isFeatured)).slice(0,5);
    items.forEach(prod => {
        const price = Number(prod.price || 0);
        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-photo"><img src="${getProductImage(prod)}" alt="${prod.name}" loading="lazy" onerror="this.onerror=null;this.src='${PRODUCT_IMAGE_FALLBACK}'"></div>
            <div class="product-info">
              <h3 class="product-title">${prod.name}</h3>
              <p class="product-subtitle">${truncateArabicText(prod.description || '', 65)}</p>
              <div class="product-price-row" dir="rtl"><span class="product-price" dir="ltr">${formatPrice(price)}</span>${prod.originalPrice > price ? `<span class="product-old-price" dir="ltr">${formatPrice(prod.originalPrice)}</span>` : ''}</div>
              <button class="btn btn-primary add-product-button"><i class="fa-solid fa-cart-shopping"></i> أضف إلى السلة</button>
            </div>`;
        card.querySelector('.add-product-button').addEventListener('click', () => window.addToCart(prod.id));
        productsGrid.appendChild(card);
    });
}

function renderBundles(bundlesToRender) {
    if (!bundlesGrid) return;
    bundlesGrid.innerHTML = '';

    if (!bundlesToRender || bundlesToRender.length === 0) {
        bundlesGrid.innerHTML = `<div class="empty-state-card" style="grid-column:1 / -1;"><i class="fa-solid fa-desktop"></i><h4>لا توجد تجميعات منشورة حالياً</h4><p>فعّل وضع المعاينة لعرض التجميعات النموذجية.</p></div>`;
        return;
    }

    bundlesToRender.slice(0, 2).forEach(b => {
        const bundleName = b.name || b.title || 'تجميعة SPIDER';
        const discountBadge = b.discount || b.discountBadge || 'عرض خاص';
        const partsHtml = (b.parts || []).slice(0, 5).map(p => `<li>${p}</li>`).join('');
        const html = `
            <div class="bundle-card">
                <span class="bundle-badge">${discountBadge}</span>
                <img class="bundle-image" src="${b.image || 'images/products/bundle-spider-pro.svg'}" alt="${bundleName}" loading="lazy" onerror="this.onerror=null;this.src='images/default-product.svg'">
                <h3 class="bundle-title">${bundleName}</h3>
                <p class="bundle-subtitle">${b.subtitle || ''}</p>
                <ul class="bundle-parts">${partsHtml}</ul>
                <div class="bundle-prices">
                    <span class="bundle-price">${formatPrice(b.price)}</span>
                    ${b.oldPrice ? `<span class="bundle-old-price">${formatPrice(b.oldPrice)}</span>` : ''}
                </div>
                <button class="btn btn-primary" onclick="addBundleToCart('${b.id}')"><i class="fa-solid fa-cart-plus"></i> طلب التجميعة</button>
            </div>
        `;
        bundlesGrid.insertAdjacentHTML('beforeend', html);
    });
}

let activeCategoryId = '';
let activeSearchQuery = '';
window.filterByCategory = function(categoryId = '') {
    activeCategoryId = categoryId;
    activeSearchQuery = '';
    if (searchInput) searchInput.value = '';
    const title = document.getElementById('productsSectionTitle');
    const cat = categories.find(c => c.id === categoryId);
    if (title) title.textContent = cat ? cat.name : 'المنتجات المميزة';
    if (!categoryId) {
        renderProducts(products);
    } else {
        const visibleChildIds = categories.filter(c => c.parentCategory === categoryId && !c.isHidden).map(c => c.id);
        const matchIds = new Set([categoryId, ...visibleChildIds]);
        if (cat && Array.isArray(cat.subcategoryIds)) cat.subcategoryIds.forEach(id => {
            if (categories.some(c => c.id === id && !c.isHidden)) matchIds.add(id);
        });
        renderProducts(products.filter(p => matchIds.has(p.categoryId || p.category)));
    }
    document.getElementById('products-section')?.scrollIntoView({behavior: 'smooth',block:'start'});
};

function renderOffersGrid() {
    const offersGrid = document.getElementById('offersProductsGrid');
    if (!offersGrid) return;
    offersGrid.innerHTML = '';
    const discounted = products.filter(p => p.originalPrice && p.originalPrice > p.price && !p.isHidden);
    if (discounted.length === 0) {
        offersGrid.innerHTML = `<div class="empty-state-card"><i class="fa-solid fa-tag"></i><h4>لا توجد عروض حالياً</h4><p>تفقد قريباً لأقوى خصومات الأسبوع</p></div>`;
        return;
    }
    discounted.slice(0, 5).forEach(prod => {
        const discount = Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100);
        const html = `
            <div class="product-card">
                <span class="bundle-badge" style="left:16px;right:auto;">خصم ${discount}%</span>
                <button class="fav-btn" title="إضافة للمفضلة"><i class="fa-regular fa-heart"></i></button>
                <img src="${prod.image || 'images/default-product.svg'}" alt="${prod.name}" class="product-image" loading="lazy">
                <div class="product-info">
                    <h3 class="product-title">${prod.name}</h3>
                    <div class="product-subtitle">${truncateArabicText(prod.description || '', 62)}</div>
                    <div class="product-price-row">
                        <span class="product-price">${formatPrice(prod.price)}</span>
                        <span class="product-old-price">${formatPrice(prod.originalPrice)}</span>
                    </div>
                    <button class="btn btn-primary" onclick="addToCart('${prod.id}')"><i class="fa-solid fa-cart-shopping"></i> أضف إلى السلة</button>
                </div>
            </div>
        `;
        offersGrid.insertAdjacentHTML('beforeend', html);
    });
}

window.addToCart = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }
    saveCart();
    updateCartUI();
    cartSidebar.classList.add('open');
    cartOverlay.style.display = 'block';
};

window.addBundleToCart = function(bundleId) {
    const bundle = bundles.find(b => b.id === bundleId) || DEMO_BUNDLES.find(b => b.id === bundleId);
    if (!bundle) return;

    const cartId = 'bundle-' + bundle.id;
    const existing = cart.find(item => item.id === cartId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: cartId,
            name: bundle.name,
            price: bundle.price,
            image: bundle.image,
            quantity: 1,
            isBundle: true
        });
    }
    saveCart();
    updateCartUI();
    cartSidebar.classList.add('open');
    cartOverlay.style.display = 'block';
};

window.updateQuantity = function(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== productId);
        }
        saveCart();
        updateCartUI();
    }
};

window.removeFromCart = function(productId) {
    cart = cart.filter(i => i.id !== productId);
    saveCart();
    updateCartUI();
};

function saveCart() {
    localStorage.setItem('spider_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartBadge) cartBadge.textContent = count;
    
    if (cart.length === 0) {
        cartItemsList.innerHTML = '<div class="empty-cart">السلة فارغة</div>';
        cartTotalValue.textContent = '0 د.ع';
        checkoutBtn.disabled = true;
        return;
    }
    
    checkoutBtn.disabled = false;
    let total = 0;
    cartItemsList.innerHTML = '';
    
    cart.forEach(item => {
        total += (item.price * item.quantity);
        const html = `
            <div class="cart-item">
                <img src="${item.image || '/images/default-product.svg'}" class="cart-item-img" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name} ${item.isBundle ? '<span style="color:var(--primary-red);font-size:0.75rem;">(تجميعة جاهزة)</span>' : ''}</div>
                    <div class="cart-item-price">${formatPrice(item.price)}</div>
                    <div class="cart-item-actions">
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                        <input type="text" class="qty-input" value="${item.quantity}" readonly>
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <button class="remove-btn" onclick="removeFromCart('${item.id}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
        cartItemsList.insertAdjacentHTML('beforeend', html);
    });
    
    cartTotalValue.textContent = formatPrice(total);
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const totalEl = document.getElementById('checkoutTotal');
    if (subtotalEl) subtotalEl.textContent = formatPrice(total);
    if (totalEl) totalEl.textContent = formatPrice(total + 5000);
}

function setupListeners() {
    document.getElementById('showAllProducts')?.addEventListener('click', (event) => {
        event.preventDefault();
        window.filterByCategory('');
    });
    if (toggleDemoBtn) {
        toggleDemoBtn.addEventListener('click', () => {
            const nextMode = !isPreviewMode();
            setPreviewMode(nextMode);
            updateDemoBannerUI();
            applyCurrentDataMode();
        });
    }

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNavLinks = document.getElementById('mobileNavLinks');
    if (mobileMenuBtn && mobileNavLinks) {
        mobileMenuBtn.addEventListener('click', () => mobileNavLinks.classList.toggle('open'));
    }

    const openCartBtn = document.getElementById('openCartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    
    if (openCartBtn) {
        openCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cartSidebar.classList.add('open');
            cartOverlay.style.display = 'block';
        });
    }
    
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', () => {
            cartSidebar.classList.remove('open');
            cartOverlay.style.display = 'none';
        });
    }
    
    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => {
            cartSidebar.classList.remove('open');
            cartOverlay.style.display = 'none';
        });
    }
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            cartSidebar.classList.remove('open');
            cartOverlay.style.display = 'none';
            checkoutModal.classList.add('open');
        });
    }
    
    const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
    if (closeCheckoutBtn) {
        closeCheckoutBtn.addEventListener('click', () => {
            checkoutModal.classList.remove('open');
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            activeSearchQuery = query;
            activeCategoryId = '';
            if (query === '') {
                renderProducts(products);
                renderBundles(bundles);
            } else {
                const filtered = products.filter(p => 
                    p.name.toLowerCase().includes(query) || 
                    (p.description && p.description.toLowerCase().includes(query))
                );
                renderProducts(filtered);

                if (bundlesGrid) {
                    const filteredBundles = bundles.filter(b => 
                        b.name.toLowerCase().includes(query) || 
                        (b.subtitle && b.subtitle.toLowerCase().includes(query)) ||
                        (b.parts && b.parts.some(part => part.toLowerCase().includes(query)))
                    );
                    renderBundles(filteredBundles);
                }
            }
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (cart.length === 0) return;
            
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const orderData = {
                orderNumber: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
                customerName: document.getElementById('orderName').value,
                customerPhone: document.getElementById('orderPhone').value,
                governorate: document.getElementById('orderGov').value,
                city: document.getElementById('orderCity').value,
                address: document.getElementById('orderAddress').value,
                notes: document.getElementById('orderNotes').value,
                items: cart.map(item => ({ 
                    id: item.id, 
                    name: item.name, 
                    price: item.price, 
                    quantity: item.quantity 
                })),
                subtotal: subtotal,
                deliveryFee: 5000,
                grandTotal: subtotal + 5000,
                status: 'pending',
                timestamp: Date.now()
            };

            if (isPreviewMode()) {
                alert(`🎉 تم تأكيد طلبك التجريبي بنجاح!\n\n` +
                      `رقم الطلب: ${orderData.orderNumber}\n` +
                      `الاسم: ${orderData.customerName}\n` +
                      `الإجمالي مع التوصيل: ${formatPrice(orderData.grandTotal)}\n\n` +
                      `(تنويه: هذا طلب محاكاة في وضع المعاينة. لم يتم إرسال بيانات إلى قاعدة بيانات الإنتاج ولم يتم إنشاء طلب تجاري حقيقي).`);
                cart = [];
                saveCart();
                updateCartUI();
                checkoutModal.classList.remove('open');
                checkoutForm.reset();
                return;
            }
            
            try {
                const newOrderRef = push(ref(db, 'orders'));
                await set(newOrderRef, orderData);
                alert('تم إرسال طلبك بنجاح! رقم الطلب: ' + orderData.orderNumber);
                cart = [];
                saveCart();
                updateCartUI();
                checkoutModal.classList.remove('open');
                checkoutForm.reset();
            } catch (error) {
                console.error("Order submission error:", error);
                alert('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً: ' + error.message);
            }
        });
    }

    const chatFab = document.getElementById('chatFab');
    const chatWindow = document.getElementById('chatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    if (chatFab && chatWindow) {
        chatFab.addEventListener('click', () => {
            chatWindow.classList.remove('hidden');
        });
    }

    if (closeChatBtn && chatWindow) {
        closeChatBtn.addEventListener('click', () => {
            chatWindow.classList.add('hidden');
        });
    }

    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', handleChat);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChat();
        });
    }

    function handleChat() {
        const text = chatInput.value.trim();
        if (!text) return;
        
        chatMessages.innerHTML += `<div class="message user-message">${text}</div>`;
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        setTimeout(() => {
            let response = "مرحباً بك في SPIDER NAJAF! هل تبحث عن قطعة بي سي معينة أو لابتوب أو تجميعة ألعاب كاملة؟";
            
            const results = products.filter(p => 
                p.name.toLowerCase().includes(text.toLowerCase()) || 
                (p.description && p.description.toLowerCase().includes(text.toLowerCase()))
            );
            
            if (results.length > 0) {
                response = `وجدت لك ${results.length} قطع مميزة تناسب بحثك:<br>`;
                results.slice(0, 3).forEach(p => {
                    response += `<br>• <strong>${p.name}</strong> بسعر ${formatPrice(p.price)}`;
                });
                if (results.length > 3) response += `<br>وغيرها في قسم المنتجات!`;
            } else if (text.includes("تجميع") || text.includes("تجميعة") || text.includes("bundle") || text.includes("بي سي")) {
                response = "لدينا تجميعات ألعاب احترافية جاهزة مثل <strong>Spider Beast Gaming Pro</strong> مع RTX 4070 Ti Super وRyzen 7800X3D! يمكنك تصفح قسم التجميعات في الصفحة الرئيسية.";
            } else if (text.includes("لابتوب") || text.includes("laptop")) {
                response = "نوفر أحدث لابتوبات ROG Strix و Lenovo Legion المخصصة للألعاب بأفضل الأسعار المعتمدة في العراق.";
            } else if (text.includes("سعر") || text.includes("اسعار")) {
                response = "جميع الأسعار معروضة بالدينار العراقي (د.ع) وتتضمن الضمان الفعلي والدعم الفني.";
            }
            
            chatMessages.innerHTML += `<div class="message bot-message">${response}</div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 800);
    }
}

init();
