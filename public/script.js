// --- البيانات التجريبية ---

// رقم الواتساب التجريبي (يمكنك تغييره هنا)
const WHATSAPP_NUMBER = "9647000000000"; // اكتب الرقم مع الرمز الدولي بدون أصفار أو +

// أسعار التوصيل التجريبية للمحافظات
const deliveryPrices = {
    "النجف": 5000,
    "كربلاء": 7000,
    "بابل": 8000,
    "الديوانية": 8000,
    "بغداد": 10000,
    "البصرة": 15000,
    "أربيل": 15000,
    "الموصل": 15000,
    "ذي قار": 12000,
    "ميسان": 12000,
    "واسط": 10000,
    "المثنى": 10000,
    "الأنبار": 12000,
    "صلاح الدين": 12000,
    "كركوك": 15000,
    "السليمانية": 15000,
    "دهوك": 15000,
    "ديالى": 10000
};

// --- الأقسام والمنتجات ---
let categoriesList = [];
let products = [];

// قاعدة بيانات المنتجات التجريبية محفوظة كمرجع لو احتجت رفعها للأدمن
const defaultCategories = [
    { name: "Laptops", title: "لابتوبات", icon: "fa-laptop" },
    { name: "Desktop PCs", title: "حاسبات مكتبية", icon: "fa-desktop" },
    { name: "Gaming", title: "ألعاب (Gaming)", icon: "fa-gamepad" },
    { name: "PC Components", title: "قطع الكمبيوتر", icon: "fa-microchip" },
    { name: "Monitors", title: "شاشات", icon: "fa-display" },
    { name: "Accessories", title: "إكسسوارات", icon: "fa-keyboard" },
    { name: "Networking", title: "شبكات", icon: "fa-wifi" },
    { name: "Printers", title: "طابعات", icon: "fa-print" },
    { name: "Phones", title: "موبايلات", icon: "fa-mobile-screen" },
    { name: "Electronics", title: "إلكترونيات", icon: "fa-bolt" }
];

const defaultProducts = [
    { id: 1, name: "Laptop Lenovo LOQ 15", category: "Laptops", brand: "Lenovo", price: 1250000, oldPrice: 1350000, image: "https://placehold.co/400x300/2a2a2a/fff?text=Lenovo+LOQ", description: "لابتوب ألعاب بأداء عالي الجودة وتصميم عصري.", specifications: { "المعالج (CPU)": "Intel Core i7 13th Gen", "الرام (RAM)": "16GB DDR5", "التخزين": "512GB SSD NVMe", "كارت الشاشة (GPU)": "RTX 4050 6GB", "الضمان": "سنة واحدة" }, stock: "متوفر" },
    { id: 2, name: "ASUS ROG Strix G16", category: "Laptops", brand: "ASUS", price: 2100000, oldPrice: null, image: "https://placehold.co/400x300/2a2a2a/fff?text=ASUS+ROG", description: "لابتوب ألعاب احترافي موجه للقيمرز والمصممين.", specifications: { "المعالج": "Intel Core i9 13th Gen", "الرام": "32GB", "التخزين": "1TB SSD", "كارت الشاشة": "RTX 4070 8GB" }, stock: "متوفر" },
    { id: 3, name: "MSI GeForce RTX 4060 Ti", category: "PC Components", brand: "MSI", price: 650000, oldPrice: 700000, image: "https://placehold.co/400x300/2a2a2a/fff?text=RTX+4060+Ti", description: "كارت شاشة لتشغيل أقوى الألعاب بدقة عالية.", specifications: { "الذاكرة": "8GB GDDR6", "الواجهة": "PCIe 4.0" }, stock: "متوفر" },
    { id: 4, name: "Gaming Monitor LG UltraGear 27", category: "Monitors", brand: "LG", price: 350000, oldPrice: 400000, image: "https://placehold.co/400x300/2a2a2a/fff?text=LG+Monitor", description: "شاشة ألعاب سريعة بمعدل تحديث 165 هرتز.", specifications: { "الحجم": "27 بوصة", "الدقة": "2K QHD", "التردد": "165Hz", "نوع اللوحة": "IPS" }, stock: "متوفر" },
    { id: 5, name: "Mechanical Keyboard Razer BlackWidow", category: "Accessories", brand: "Razer", price: 150000, oldPrice: null, image: "https://placehold.co/400x300/2a2a2a/fff?text=Razer+Keyboard", description: "كيبورد ميكانيكي سويتش أخضر مع إضاءة RGB.", specifications: { "النوع": "ميكانيكي (Mechanical)", "السويتش": "Razer Green", "إضاءة": "RGB" }, stock: "متوفر" },
    { id: 6, name: "Logitech G Pro X Superlight", category: "Accessories", brand: "Logitech", price: 195000, oldPrice: 220000, image: "https://placehold.co/400x300/2a2a2a/fff?text=G+Pro+X", description: "ماوس ألعاب لاسلكي خفيف جداً مفضل لدى المحترفين.", specifications: { "الحساس (Sensor)": "HERO 25K", "الوزن": "63 غرام", "الاتصال": "لاسلكي" }, stock: "متوفر" },
    { id: 7, name: "Intel Core i5-13400F", category: "PC Components", brand: "Intel", price: 290000, oldPrice: null, image: "https://placehold.co/400x300/2a2a2a/fff?text=Intel+i5", description: "معالج ممتاز للألعاب والتجميعات المتوسطة.", specifications: { "الأنوية": "10 Cores", "المسارات": "16 Threads", "السوكت": "LGA 1700" }, stock: "نفذت الكمية" },
    { id: 8, name: "Corsair Vengeance RGB 32GB", category: "PC Components", brand: "Corsair", price: 140000, oldPrice: null, image: "https://placehold.co/400x300/2a2a2a/fff?text=Corsair+RAM", description: "رامات ألعاب سريعة مع إضاءة RGB.", specifications: { "النوع": "DDR5", "السعة": "32GB (2x16)", "السرعة": "6000MHz" }, stock: "متوفر" },
    { id: 9, name: "Samsung 980 PRO 1TB", category: "PC Components", brand: "Samsung", price: 125000, oldPrice: 140000, image: "https://placehold.co/400x300/2a2a2a/fff?text=Samsung+NVMe", description: "وحدة تخزين سريعة جداً للأنظمة الحديثة.", specifications: { "النوع": "NVMe M.2", "السعة": "1TB", "الجيل": "PCIe 4.0" }, stock: "متوفر" },
    { id: 10, name: "Desktop PC Gamer XT", category: "Desktop PCs", brand: "Custom", price: 1450000, oldPrice: null, image: "https://placehold.co/400x300/2a2a2a/fff?text=Desktop+PC", description: "تجميعة حاسبة ألعاب جاهزة بأسعار مناسبة.", specifications: { "المعالج": "i5 12400F", "كارت الشاشة": "RTX 3060", "الرام": "16GB", "التخزين": "1TB NVMe" }, stock: "متوفر" },
    { id: 11, name: "HP LaserJet Pro Printer", category: "Printers", brand: "HP", price: 210000, oldPrice: 230000, image: "https://placehold.co/400x300/2a2a2a/fff?text=HP+Printer", description: "طابعة ليزرية عملية وسريعة للمكاتب.", specifications: { "النوع": "ليزر", "اللون": "أبيض وأسود", "واي فاي": "نعم" }, stock: "متوفر" },
    { id: 12, name: "TP-Link Archer AX50", category: "Networking", brand: "TP-Link", price: 85000, oldPrice: null, image: "https://placehold.co/400x300/2a2a2a/fff?text=TP-Link+Router", description: "راوتر واي فاي 6 لتغطية واسعة وسرعة عالية.", specifications: { "المعيار": "Wi-Fi 6", "السرعة": "AX3000" }, stock: "متوفر" },
    { id: 13, name: "Apple iPhone 15 Pro", category: "Phones", brand: "Apple", price: 1650000, oldPrice: 1700000, image: "https://placehold.co/400x300/2a2a2a/fff?text=iPhone+15", description: "هاتف أبل الرائد بتصميم التيتانيوم.", specifications: { "التخزين": "256GB", "اللون": "تيتانيوم طبيعي" }, stock: "متوفر" },
    { id: 14, name: "Sony PlayStation 5", category: "Gaming", brand: "Sony", price: 720000, oldPrice: 750000, image: "https://placehold.co/400x300/2a2a2a/fff?text=PS5", description: "جهاز ألعاب بلايستيشن 5 إصدار الأقراص.", specifications: { "الإصدار": "قرص (Disc)", "التخزين": "825GB SSD" }, stock: "متوفر" }
];

let cart = []; // مصفوفة السلة

// --- الوظائف المساعدة ---

// تنسيق السعر (إضافة فواصل وإضافة العملة)
function formatPrice(price) {
    if(price == null) return "";
    return price.toLocaleString('en-US') + " د.ع";
}

// حساب نسبة الخصم
function calculateDiscount(price, oldPrice) {
    if (!oldPrice || oldPrice <= price) return 0;
    return Math.round(((oldPrice - price) / oldPrice) * 100);
}

// --- إعدادات Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyA3_h6cWLhOx3nBgH2mGBAUpVaGpqQOxz0",
    authDomain: "spider-aaa19.firebaseapp.com",
    databaseURL: "https://spider-aaa19-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "spider-aaa19",
    storageBucket: "spider-aaa19.firebasestorage.app",
    messagingSenderId: "963155566410",
    appId: "1:963155566410:web:aa4b9ea73e90c9535e6bb3",
    measurementId: "G-G9KRZBSKW5"
};

// --- التهيئة (Initialization) ---
document.addEventListener("DOMContentLoaded", () => {
    // تهيئة Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();

    // جلب الأقسام
    db.ref('categories').on('value', (snapshot) => {
        const data = snapshot.val();
        categoriesList = data ? Object.values(data) : [];
        renderCategories();
    });

    // جلب المنتجات
    db.ref('products').on('value', (snapshot) => {
        const data = snapshot.val();
        products = [];
        if (data) {
            // تحويل Object إلى Array
            for (let key in data) {
                products.push({ id: key, ...data[key] });
            }
        }
        
        // عرض جميع المنتجات
        renderProducts(products, 'main-products-grid');
        
        // عرض المنتجات المخفضة في قسم العروض
        const offerProducts = products.filter(p => p.oldPrice && p.oldPrice > p.price).slice(0, 4);
        renderProducts(offerProducts, 'offers-grid');
    });

    populateGovernorates();
    
    // إعداد البحث
    const searchInput = document.getElementById("search-input");
    if(searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = products.filter(p => 
                (p.name && p.name.toLowerCase().includes(query)) || 
                (p.category && p.category.toLowerCase().includes(query)) ||
                (p.brand && p.brand.toLowerCase().includes(query))
            );
            renderProducts(filtered, 'main-products-grid');
            
            if(query.length > 1) {
                document.getElementById("products-section").scrollIntoView({behavior: "smooth"});
            }
        });
    }
});

// --- العرض والواجهة (Rendering) ---

// توليد بطاقات الأقسام
function renderCategories() {
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = '';
    categoriesList.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.onclick = () => filterProducts(cat.name, null, true);
        card.innerHTML = `
            <i class="fa-solid ${cat.icon}"></i>
            <h3>${cat.title}</h3>
        `;
        grid.appendChild(card);
    });
}

// توليد بطاقات المنتجات في حاوية معينة
function renderProducts(productsArray, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (productsArray.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">لم يتم العثور على منتجات.</p>`;
        return;
    }

    productsArray.forEach(product => {
        const discount = calculateDiscount(product.price, product.oldPrice);
        const oldPriceHtml = product.oldPrice ? `<span class="old-price">${formatPrice(product.oldPrice)}</span>` : '';
        const badgeHtml = discount > 0 ? `<div class="discount-badge">خصم ${discount}%</div>` : '';
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div style="position:relative;">
                <img src="${product.image}" alt="${product.name}" class="product-image" onclick="openProductModal(${product.id})">
                <div style="position:absolute; top:10px; left:10px;">${badgeHtml}</div>
            </div>
            <div class="product-info">
                <div class="product-category">${product.category} - ${product.brand}</div>
                <div class="product-title" onclick="openProductModal(${product.id})">${product.name}</div>
                <div class="product-prices">
                    ${oldPriceHtml}
                    <div class="current-price">${formatPrice(product.price)}</div>
                </div>
                <div class="product-actions">
                    <button class="btn btn-primary" onclick="addToCart(${product.id})"><i class="fa-solid fa-cart-plus"></i> أضف للسلة</button>
                    <button class="btn btn-outline" style="border-color:var(--border-color); color:var(--text-main);" onclick="openProductModal(${product.id})">التفاصيل</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// فلترة المنتجات حسب القسم
function filterProducts(categoryName, btnElement, scroll = false) {
    // تحديث الأزرار النشطة (إذا كان الفلتر عبر الأزرار)
    if(btnElement) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        // مجرد تحديد الزر "الكل" كإجراء افتراضي
        document.querySelector('.filter-btn').classList.add('active');
    }

    let filtered = products;
    if (categoryName !== 'All') {
        filtered = products.filter(p => p.category === categoryName);
    }
    
    renderProducts(filtered, 'main-products-grid');
    
    if(scroll) {
        document.getElementById("products-section").scrollIntoView({behavior: "smooth"});
    }
}

// --- نظام السلة (Cart Logic) ---

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if(product.stock !== "متوفر") {
        alert("عذراً، هذا المنتج غير متوفر حالياً.");
        return;
    }

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartUI();
    // فتح السلة تلقائياً عند الإضافة لتوضيح التجربة للمستخدم
    if(!document.getElementById('cart-sidebar').classList.contains('open')){
        toggleCart();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function updateQuantity(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if(item) {
        item.quantity += delta;
        if(item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartUI();
        }
    }
}

function updateCartUI() {
    // تحديث الأيقونة
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').innerText = totalItems;

    // تحديث واجهة السلة
    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = '';
    
    let subtotal = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; margin-top:20px;">السلة فارغة.</p>';
    } else {
        cart.forEach(item => {
            subtotal += item.price * item.quantity;
            const el = document.createElement('div');
            el.className = 'cart-item';
            el.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${formatPrice(item.price)}</div>
                    <div class="cart-qty-controls">
                        <button onclick="updateQuantity(${item.id}, 1)">+</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQuantity(${item.id}, -1)">-</button>
                    </div>
                    <span class="cart-item-remove" onclick="removeFromCart(${item.id})">حذف</span>
                </div>
            `;
            cartItemsContainer.appendChild(el);
        });
    }

    document.getElementById('cart-subtotal-price').innerText = formatPrice(subtotal);
}

// --- النوافذ المنبثقة (Modals & Sidebar) ---

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('hidden');
}

function toggleMobileMenu() {
    const nav = document.getElementById('mobile-nav');
    nav.classList.toggle('hidden');
}

function closeModals(e) {
    // إغلاق المودال إذا تم الضغط على الخلفية أو زر الإغلاق
    if (!e || e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-btn') || e.target.tagName === 'BUTTON' && e.target.innerHTML === '&times;') {
        document.getElementById('product-modal').classList.add('hidden');
        document.getElementById('delivery-modal').classList.add('hidden');
    }
}

function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if(!product) return;

    let specsHtml = '';
    if(product.specifications) {
        for (const [key, value] of Object.entries(product.specifications)) {
            specsHtml += `<tr><td>${key}</td><td>${value}</td></tr>`;
        }
    }

    const modalContent = document.getElementById('product-details-content');
    modalContent.innerHTML = `
        <div class="pd-image">
            <img src="${product.image}" alt="${product.name}">
        </div>
        <div class="pd-info">
            <span class="stock-status"><i class="fa-solid fa-check-circle"></i> ${product.stock}</span>
            <h2>${product.name}</h2>
            <div class="pd-price">${formatPrice(product.price)}</div>
            <p class="pd-desc">${product.description}</p>
            <table class="pd-specs">
                ${specsHtml}
            </table>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn btn-primary w-100" onclick="addToCart(${product.id}); document.getElementById('product-modal').classList.add('hidden');">إضافة للسلة</button>
            </div>
        </div>
    `;

    document.getElementById('product-modal').classList.remove('hidden');
}

// --- نظام التوصيل وتأكيد الطلب (Delivery & Checkout) ---

function populateGovernorates() {
    const select = document.getElementById('cust-gov');
    for (const gov in deliveryPrices) {
        const option = document.createElement('option');
        option.value = gov;
        option.innerText = gov;
        select.appendChild(option);
    }
}

function openDeliveryModal(e) {
    if(e) e.preventDefault();
    
    if(cart.length === 0) {
        alert("سلة المشتريات فارغة، يرجى إضافة منتجات أولاً.");
        return;
    }

    // إغلاق السلة إذا كانت مفتوحة
    document.getElementById('cart-sidebar').classList.remove('open');
    document.getElementById('cart-overlay').classList.add('hidden');

    // تحديث ملخص الطلب
    const list = document.getElementById('checkout-items-list');
    list.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        subtotal += item.price * item.quantity;
        list.innerHTML += `
            <div class="checkout-item-row">
                <span>${item.name} × ${item.quantity}</span>
                <span>${formatPrice(item.price * item.quantity)}</span>
            </div>
        `;
    });

    document.getElementById('summary-subtotal').innerText = formatPrice(subtotal);
    calculateDeliveryFee(); // الحساب المبدئي

    document.getElementById('delivery-modal').classList.remove('hidden');
}

function proceedToDelivery() {
    openDeliveryModal();
}

function calculateDeliveryFee() {
    const govSelect = document.getElementById('cust-gov');
    const selectedGov = govSelect.value;
    const deliveryFee = deliveryPrices[selectedGov] || 0;
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const grandTotal = subtotal + deliveryFee;

    document.getElementById('summary-delivery').innerText = formatPrice(deliveryFee);
    document.getElementById('summary-total').innerText = formatPrice(grandTotal);
}

// --- نظام الطلب عبر واتساب (WhatsApp Order) ---

function generateOrderNumber() {
    return "SN-" + (Math.floor(Math.random() * 9000) + 1000);
}

function submitOrderViaWhatsApp() {
    // جمع البيانات
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const gov = document.getElementById('cust-gov').value;
    const city = document.getElementById('cust-city').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const notes = document.getElementById('cust-notes').value.trim();

    if(!name || !phone || !gov || !city) {
        alert("يرجى تعبئة جميع الحقول المطلوبة (الاسم، الهاتف، المحافظة، المدينة).");
        return;
    }

    const orderNumber = generateOrderNumber();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = deliveryPrices[gov] || 0;
    const grandTotal = subtotal + deliveryFee;

    // تجهيز كائن الطلب لحفظه في Firebase
    const cleanItems = cart.map(item => ({
        id: String(item.id),
        name: item.name,
        price: item.price,
        quantity: item.quantity
    }));

    const orderData = {
        orderNumber: orderNumber,
        customerName: name,
        customerPhone: phone,
        governorate: gov,
        city: city,
        address: address,
        notes: notes,
        items: cleanItems,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        grandTotal: grandTotal,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'جديد'
    };

    // حفظ الطلب في Firebase
    firebase.database().ref('orders').push(orderData).then(() => {
        // بعد الحفظ بنجاح، بناء نص الرسالة للواتساب
        let msg = `*طلب جديد من متجر سبايدر النجف 🕷️*\n`;
        msg += `-------------------------\n`;
        msg += `*رقم الطلب:* #${orderNumber}\n`;
        msg += `*اسم الزبون:* ${name}\n`;
        msg += `*رقم الهاتف:* ${phone}\n`;
        msg += `*المحافظة:* ${gov}\n`;
        msg += `*المنطقة/المدينة:* ${city}\n`;
        if(address) msg += `*العنوان:* ${address}\n`;
        if(notes) msg += `*ملاحظات:* ${notes}\n`;
        msg += `-------------------------\n`;
        msg += `*المنتجات المطلوبة:*\n`;
        
        cart.forEach(item => {
            msg += `- ${item.name} × ${item.quantity} (${formatPrice(item.price * item.quantity)})\n`;
        });
        
        msg += `-------------------------\n`;
        msg += `*مجموع المنتجات:* ${formatPrice(subtotal)}\n`;
        msg += `*أجور التوصيل:* ${formatPrice(deliveryFee)}\n`;
        msg += `*المجموع النهائي:* ${formatPrice(grandTotal)}\n`;
        msg += `-------------------------\n`;
        msg += `شكراً لاختياركم سبايدر النجف!`;

        // إفراغ السلة
        cart = [];
        updateCartUI();
        document.getElementById('delivery-modal').classList.add('hidden');

        // ترميز النص وفتح واتساب
        const encodedMsg = encodeURIComponent(msg);
        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMsg}`;
        window.open(whatsappUrl, '_blank');
    }).catch((error) => {
        console.error("Error saving order: ", error);
        alert("حدث خطأ أثناء حفظ الطلب، يرجى المحاولة مرة أخرى.");
    });
}

function openWhatsAppContact(e) {
    if(e) e.preventDefault();
    const msg = "مرحباً متجر سبايدر النجف، لدي استفسار بخصوص المنتجات.";
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}
