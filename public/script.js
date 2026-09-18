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
        renderProducts(products);
        renderBundles(bundles);
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
            renderProducts(products);
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

function renderCategories() {
    categoriesGrid.innerHTML = '';
    const visibleCategories = categories.filter(c => !c.isHidden);
    
    if (visibleCategories.length === 0) {
        categoriesGrid.innerHTML = `
            <div class="empty-state-card">
                <i class="fa-solid fa-folder-open"></i>
                <h4>لا توجد أقسام ظاهرة حالياً</h4>
                <p>يمكنك تفعيل ظهور الأقسام من لوحة الأدمن.</p>
            </div>`;
        return;
    }

    const defaultIcons = ['fa-microchip', 'fa-memory', 'fa-border-all', 'fa-bars', 'fa-hard-drive', 'fa-laptop', 'fa-tv', 'fa-desktop', 'fa-headphones'];
    visibleCategories.forEach((cat, index) => {
        const icon = cat.icon || defaultIcons[index % defaultIcons.length];
        const html = `
            <div class="category-card" onclick="filterByCategory('${cat.id}')">
                <i class="fa-solid ${icon} category-icon"></i>
                <div class="category-name">${cat.name}</div>
                <div class="category-arrow"><i class="fa-solid fa-arrow-left"></i></div>
            </div>
        `;
        categoriesGrid.insertAdjacentHTML('beforeend', html);
    });
}

function renderProducts(productsToRender) {
    productsGrid.innerHTML = '';
    const visibleProducts = productsToRender.filter(p => !p.isHidden);
    
    if (visibleProducts.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state-card">
                <i class="fa-solid fa-box-open"></i>
                <h4>لم يتم العثور على منتجات في هذا القسم</h4>
                <p>جرب تصفح باقي الأقسام أو إزالة فلاتر البحث.</p>
                <button class="btn btn-outline btn-sm" onclick="filterByCategory('')" style="margin-top: 10px;">
                    عرض جميع المنتجات
                </button>
            </div>`;
        return;
    }
    
    visibleProducts.forEach(prod => {
        const price = prod.price || 0;
        const html = `
            <div class="product-card">
                <button class="fav-btn" title="إضافة للمفضلة"><i class="fa-regular fa-heart"></i></button>
                <img src="${prod.image || '/images/default-product.svg'}" alt="${prod.name}" class="product-image" loading="lazy">
                <div class="product-info">
                    <h3 class="product-title">${prod.name}</h3>
                    <div class="product-specs">${prod.description || ''}</div>
                    <div class="product-price">${formatPrice(price)}</div>
                    <button class="add-to-cart-btn" onclick="addToCart('${prod.id}')"><i class="fa-solid fa-cart-shopping"></i> أضف إلى السلة</button>
                </div>
            </div>
        `;
        productsGrid.insertAdjacentHTML('beforeend', html);
    });
}

function renderBundles(bundlesToRender) {
    if (!bundlesGrid) return;
    bundlesGrid.innerHTML = '';

    if (!bundlesToRender || bundlesToRender.length === 0) {
        return;
    }

    bundlesToRender.forEach(b => {
        const partsHtml = (b.parts || []).map(p => `<li><i class="fa-solid fa-check"></i> ${p}</li>`).join('');
        const html = `
            <div class="bundle-card">
                <div class="bundle-image-box">
                    <span class="bundle-discount-badge">${b.discountBadge || 'توفير خاص'}</span>
                    <img src="${b.image || '/images/products/bundle-spider-pro.svg'}" alt="${b.name}">
                </div>
                <div class="bundle-content">
                    <div>
                        <h3 class="bundle-title">${b.name}</h3>
                        <p class="bundle-subtitle">${b.subtitle || ''}</p>
                        <ul class="bundle-parts-list">
                            ${partsHtml}
                        </ul>
                    </div>
                    <div class="bundle-pricing">
                        <div class="bundle-price-box">
                            <span class="bundle-price">${formatPrice(b.price)}</span>
                            ${b.oldPrice ? `<span class="bundle-old-price">${formatPrice(b.oldPrice)}</span>` : ''}
                        </div>
                        <button class="btn btn-primary" onclick="addBundleToCart('${b.id}')">
                            <i class="fa-solid fa-cart-plus"></i> طلب التجميعة
                        </button>
                    </div>
                </div>
            </div>
        `;
        bundlesGrid.insertAdjacentHTML('beforeend', html);
    });
}

window.filterByCategory = function(categoryId) {
    if (!categoryId) {
        renderProducts(products);
    } else {
        const filtered = products.filter(p => {
            const matchesId = p.categoryId === categoryId || p.category === categoryId || p.parentCategory === categoryId;
            return matchesId && !p.isHidden;
        });
        renderProducts(filtered);
    }
    const section = document.getElementById('products-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
};

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
    if (toggleDemoBtn) {
        toggleDemoBtn.addEventListener('click', () => {
            const nextMode = !isPreviewMode();
            setPreviewMode(nextMode);
            updateDemoBannerUI();
            applyCurrentDataMode();
        });
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
