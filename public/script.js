import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
let cart = JSON.parse(localStorage.getItem('spider_cart')) || [];
if (!Array.isArray(cart)) cart = [];

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const categoriesGrid = document.getElementById('categoriesGrid');
const cartBadge = document.getElementById('cartBadge');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const cartItemsList = document.getElementById('cartItemsList');
const cartTotalValue = document.getElementById('cartTotalValue');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const checkoutForm = document.getElementById('checkoutForm');
const searchInput = document.getElementById('searchInput');

// Initialize
function init() {
    setupListeners();
    fetchData();
    updateCartUI();
}

function formatPrice(price) {
    if (!price || isNaN(price)) return '0 د.ع';
    return Number(price).toLocaleString('ar-IQ') + ' د.ع';
}

function fetchData() {
    // Fetch Categories
    onValue(ref(db, 'categories'), (snapshot) => {
        categoriesGrid.innerHTML = '';
        if (snapshot.exists()) {
            categories = [];
            snapshot.forEach(child => {
                categories.push({ id: child.key, ...child.val() });
            });
            renderCategories();
        } else {
            categoriesGrid.innerHTML = `
                <div class="empty-state-card">
                    <i class="fa-solid fa-folder-open"></i>
                    <h4>أقسام المتجر قيد التحديث</h4>
                    <p>نعمل على تجهيز أفضل تصنيفات البي سي واللابتوبات الاحترافية.</p>
                </div>`;
        }
    }, (error) => {
        console.error("Firebase categories read error:", error);
        categoriesGrid.innerHTML = `<div class="empty-state-card"><i class="fa-solid fa-triangle-exclamation"></i><h4>خطأ في جلب الأقسام</h4><p>${error.message}</p></div>`;
    });

    // Fetch Products
    onValue(ref(db, 'products'), (snapshot) => {
        productsGrid.innerHTML = '';
        if (snapshot.exists()) {
            products = [];
            snapshot.forEach(child => {
                products.push({ id: child.key, ...child.val() });
            });
            renderProducts(products);
        } else {
            productsGrid.innerHTML = `
                <div class="empty-state-card">
                    <i class="fa-solid fa-boxes-stacked"></i>
                    <h4>لا توجد منتجات معروضة حالياً</h4>
                    <p>سيتم إضافة عروض وتجهيزات الألعاب والكمبيوتر قريباً عبر لوحة الإدارة.</p>
                </div>`;
        }
    }, (error) => {
        console.error("Firebase products read error:", error);
        productsGrid.innerHTML = `<div class="empty-state-card"><i class="fa-solid fa-triangle-exclamation"></i><h4>خطأ في جلب المنتجات</h4><p>${error.message}</p></div>`;
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

    const defaultIcons = ['fa-gamepad', 'fa-headphones', 'fa-desktop', 'fa-microchip', 'fa-memory', 'fa-laptop', 'fa-tv'];
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
            </div>`;
        return;
    }
    
    visibleProducts.forEach(prod => {
        const price = prod.price || 0;
        const html = `
            <div class="product-card">
                <button class="fav-btn"><i class="fa-regular fa-heart"></i></button>
                <img src="${prod.image || '/images/default-product.svg'}" alt="${prod.name}" class="product-image">
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

window.filterByCategory = function(categoryId) {
    if(!categoryId) {
        renderProducts(products);
    } else {
        const filtered = products.filter(p => (p.categoryId === categoryId || p.category === categoryId) && !p.isHidden);
        renderProducts(filtered);
    }
    document.getElementById('products-section').scrollIntoView({behavior: 'smooth'});
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
    document.getElementById('cartSidebar').classList.add('open');
    document.getElementById('cartOverlay').style.display = 'block';
}

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
}

window.removeFromCart = function(productId) {
    cart = cart.filter(i => i.id !== productId);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('spider_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = count;
    
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
                <img src="${item.image || '/images/default-product.svg'}" class="cart-item-img">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${formatPrice(item.price)}</div>
                    <div class="cart-item-actions">
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                        <input type="text" class="qty-input" value="${item.quantity}" readonly>
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <button class="remove-btn" onclick="removeFromCart('${item.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
        cartItemsList.insertAdjacentHTML('beforeend', html);
    });
    
    cartTotalValue.textContent = formatPrice(total);
    document.getElementById('checkoutSubtotal').textContent = formatPrice(total);
    document.getElementById('checkoutTotal').textContent = formatPrice(total + 5000); // 5000 approx delivery
}

function setupListeners() {
    document.getElementById('openCartBtn').addEventListener('click', (e) => {
        e.preventDefault();
        cartSidebar.classList.add('open');
        cartOverlay.style.display = 'block';
    });
    
    document.getElementById('closeCartBtn').addEventListener('click', () => {
        cartSidebar.classList.remove('open');
        cartOverlay.style.display = 'none';
    });
    
    cartOverlay.addEventListener('click', () => {
        cartSidebar.classList.remove('open');
        cartOverlay.style.display = 'none';
    });
    
    checkoutBtn.addEventListener('click', () => {
        cartSidebar.classList.remove('open');
        cartOverlay.style.display = 'none';
        checkoutModal.classList.add('open');
    });
    
    document.getElementById('closeCheckoutBtn').addEventListener('click', () => {
        checkoutModal.classList.remove('open');
    });
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query === '') {
            renderProducts(products);
        } else {
            const filtered = products.filter(p => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
            renderProducts(filtered);
        }
    });

    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (cart.length === 0) return;
        
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const orderData = {
            orderNumber: 'ORD-' + Math.floor(Math.random() * 1000000),
            customerName: document.getElementById('orderName').value,
            customerPhone: document.getElementById('orderPhone').value,
            governorate: document.getElementById('orderGov').value,
            city: document.getElementById('orderCity').value,
            address: document.getElementById('orderAddress').value,
            notes: document.getElementById('orderNotes').value,
            items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
            subtotal: subtotal,
            deliveryFee: 5000,
            grandTotal: subtotal + 5000,
            status: 'pending',
            timestamp: Date.now()
        };
        
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
            console.error(error);
            alert('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً');
        }
    });

    // Chatbot Logic
    const chatFab = document.getElementById('chatFab');
    const chatWindow = document.getElementById('chatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    chatFab.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
    });

    closeChatBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
    });

    sendChatBtn.addEventListener('click', handleChat);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChat();
    });

    function handleChat() {
        const text = chatInput.value.trim();
        if (!text) return;
        
        // Add user message
        chatMessages.innerHTML += `<div class="message user-message">${text}</div>`;
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Bot response (Simulated AI/Search)
        setTimeout(() => {
            let response = "عذراً، لم أفهم طلبك. هل تبحث عن لابتوب أو قطعة معينة؟";
            
            const results = products.filter(p => p.name.toLowerCase().includes(text.toLowerCase()) || (p.description && p.description.toLowerCase().includes(text.toLowerCase())));
            
            if (results.length > 0) {
                response = `وجدت ${results.length} منتجات قد تهمك:<br>`;
                results.slice(0, 3).forEach(p => {
                    response += `<br>- <strong>${p.name}</strong> بسعر ${formatPrice(p.price)}`;
                });
                if (results.length > 3) response += `<br>وغيرها الكثير في المتجر!`;
            } else if (text.includes("لابتوب") || text.includes("laptop")) {
                response = "لدينا مجموعة رائعة من اللابتوبات! يمكنك تصفح قسم اللابتوبات من القائمة العلوية لرؤية أحدث العروض.";
            } else if (text.includes("سعر")) {
                response = "يمكنك العثور على أسعار جميع المنتجات في بطاقات المنتجات. هل تبحث عن سعر منتج محدد؟";
            }
            
            chatMessages.innerHTML += `<div class="message bot-message">${response}</div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
    }
}

init();
