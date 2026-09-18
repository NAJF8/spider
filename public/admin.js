import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const adminUid = 'e8uTdYi5TQOsrztxPnlD7X4GKAx1';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const adminScreen = document.getElementById('admin-screen');
const loginBtn = document.getElementById('login-google-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorMsg = document.getElementById('login-error');

// Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.uid === adminUid) {
            loginScreen.classList.add('hidden');
            adminScreen.classList.remove('hidden');
            document.getElementById('adminName').textContent = user.displayName || 'مدير النظام';
            if(user.photoURL) document.getElementById('adminAvatar').src = user.photoURL;
            loadDashboardData();
        } else {
            auth.signOut();
            errorMsg.textContent = 'ليس لديك صلاحيات الدخول للوحة التحكم.';
        }
    } else {
        loginScreen.classList.remove('hidden');
        adminScreen.classList.add('hidden');
    }
});

// Login
loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
        errorMsg.textContent = error.message;
    });
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// Data state
let orders = [];
let products = [];
let categories = [];

function formatPrice(price) {
    if (!price || isNaN(price)) return '0 د.ع';
    return Number(price).toLocaleString('ar-IQ') + ' د.ع';
}

function loadDashboardData() {
    // Load Categories
    onValue(ref(db, 'categories'), (snapshot) => {
        categories = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                categories.push({ id: child.key, ...child.val() });
            });
        }
        updateCategorySelect();
    });

    // Load Products
    onValue(ref(db, 'products'), (snapshot) => {
        products = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                products.push({ id: child.key, ...child.val() });
            });
        }
        document.getElementById('statProducts').textContent = products.length;
        renderTopProducts();
    });

    // Load Orders
    onValue(ref(db, 'orders'), (snapshot) => {
        orders = [];
        let totalSales = 0;
        let uniqueCustomers = new Set();
        
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const order = { id: child.key, ...child.val() };
                orders.push(order);
                if (order.status === 'completed' || order.status === 'مكتمل') {
                    totalSales += order.grandTotal || 0;
                }
                if(order.customerPhone) uniqueCustomers.add(order.customerPhone);
            });
        }
        
        // Sort orders by timestamp descending
        orders.sort((a, b) => b.timestamp - a.timestamp);
        
        document.getElementById('statOrders').textContent = orders.length;
        document.getElementById('ordersBadge').textContent = orders.filter(o => o.status === 'pending' || o.status === 'جديد').length;
        document.getElementById('statSales').textContent = formatPrice(totalSales);
        document.getElementById('statCustomers').textContent = uniqueCustomers.size;
        
        renderOrders();
    });
}

function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد طلبات</td></tr>';
        return;
    }
    
    // Show only recent 5 for dashboard
    const recentOrders = orders.slice(0, 5);
    
    recentOrders.forEach((order, index) => {
        const statusClass = order.status === 'pending' ? 'status-pending' : (order.status === 'cancelled' ? 'status-cancelled' : 'status-completed');
        const statusText = order.status === 'pending' ? 'قيد التجهيز' : (order.status === 'cancelled' ? 'ملغي' : 'مكتمل');
        const itemsCount = order.items ? order.items.length : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${order.orderNumber || index}</td>
            <td>${order.customerName}</td>
            <td>${itemsCount} منتجات</td>
            <td>${formatPrice(order.grandTotal || 0)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td><button class="btn" style="background:#eee;color:#333;padding:5px 10px;" onclick="viewOrder('${order.id}')">عرض</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTopProducts() {
    const list = document.getElementById('topProductsList');
    list.innerHTML = '';
    const top = products.slice(0, 4); // Dummy top for now
    top.forEach(prod => {
        const html = `
            <div class="top-product-item">
                <img src="${prod.image || '/images/default-product.svg'}" class="tp-img">
                <div class="tp-info">
                    <div class="tp-name">${prod.name}</div>
                    <div class="tp-price">${formatPrice(prod.price || 0)}</div>
                </div>
                <div class="tp-sales">مبيعات: ${Math.floor(Math.random() * 30) + 1}</div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

function updateCategorySelect() {
    const select = document.getElementById('prodCategory');
    select.innerHTML = '<option value="">اختر القسم</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

// Product Management
window.openProductModal = function(id = null) {
    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('prodId').value = '';
    
    if (id) {
        document.getElementById('productModalTitle').textContent = 'تعديل منتج';
        const prod = products.find(p => p.id === id);
        if(prod) {
            document.getElementById('prodId').value = prod.id;
            document.getElementById('prodName').value = prod.name;
            document.getElementById('prodCategory').value = prod.categoryId || prod.category || '';
            document.getElementById('prodPrice').value = prod.price;
            document.getElementById('prodDesc').value = prod.description || '';
            document.getElementById('prodImage').value = prod.image || '';
        }
    } else {
        document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد';
    }
    
    document.getElementById('productModal').classList.add('open');
};

window.closeProductModal = function() {
    document.getElementById('productModal').classList.remove('open');
};

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const prodData = {
        name: document.getElementById('prodName').value,
        category: document.getElementById('prodCategory').value,
        categoryId: document.getElementById('prodCategory').value,
        price: Number(document.getElementById('prodPrice').value),
        description: document.getElementById('prodDesc').value,
        image: document.getElementById('prodImage').value
    };
    
    try {
        if (id) {
            await update(ref(db, 'products/' + id), prodData);
        } else {
            await set(push(ref(db, 'products')), prodData);
        }
        closeProductModal();
        alert('تم حفظ المنتج بنجاح!');
    } catch (error) {
        console.error(error);
        alert('خطأ أثناء حفظ المنتج');
    }
});

// Order Management
window.viewOrder = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if(!order) return;
    
    const content = document.getElementById('orderDetailsContent');
    
    let itemsHtml = '<ul style="list-style:none;padding:0;margin-top:10px;">';
    if(order.items) {
        order.items.forEach(item => {
            itemsHtml += `<li style="padding:10px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
                <span>${item.name} (x${item.quantity})</span>
                <strong>${formatPrice(item.price * item.quantity)}</strong>
            </li>`;
        });
    }
    itemsHtml += '</ul>';
    
    const currentStatus = order.status || 'pending';
    
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p><strong>رقم الطلب:</strong> ${order.orderNumber}</p>
            <p><strong>العميل:</strong> ${order.customerName}</p>
            <p><strong>رقم الهاتف:</strong> ${order.customerPhone}</p>
            <p><strong>العنوان:</strong> ${order.governorate} - ${order.city} - ${order.address}</p>
            <p><strong>ملاحظات:</strong> ${order.notes || 'لا يوجد'}</p>
        </div>
        
        <h4>المنتجات</h4>
        ${itemsHtml}
        
        <div style="margin-top:20px;padding-top:10px;border-top:2px solid #eee;">
            <div style="display:flex;justify-content:space-between;"><span>المجموع:</span> <strong>${formatPrice(order.subtotal || 0)}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>التوصيل:</span> <strong>${formatPrice(order.deliveryFee || 5000)}</strong></div>
            <div style="display:flex;justify-content:space-between;color:var(--primary);font-size:1.2rem;margin-top:10px;">
                <span>الإجمالي:</span> <strong>${formatPrice(order.grandTotal || 0)}</strong>
            </div>
        </div>
        
        <div style="margin-top: 30px;">
            <label style="font-weight:bold;display:block;margin-bottom:10px;">تحديث حالة الطلب:</label>
            <div style="display:flex;gap:10px;">
                <select id="updateOrderStatus" style="padding:10px;border-radius:6px;border:1px solid #ccc;flex-grow:1;">
                    <option value="pending" ${currentStatus==='pending'?'selected':''}>قيد التجهيز</option>
                    <option value="completed" ${currentStatus==='completed'?'selected':''}>مكتمل</option>
                    <option value="cancelled" ${currentStatus==='cancelled'?'selected':''}>ملغي</option>
                </select>
                <button class="btn btn-danger" onclick="saveOrderStatus('${order.id}')">تحديث</button>
            </div>
        </div>
    `;
    
    document.getElementById('orderModal').classList.add('open');
}

window.closeOrderModal = function() {
    document.getElementById('orderModal').classList.remove('open');
}

window.saveOrderStatus = async function(orderId) {
    const newStatus = document.getElementById('updateOrderStatus').value;
    try {
        await update(ref(db, 'orders/' + orderId), { status: newStatus });
        alert('تم تحديث حالة الطلب بنجاح');
        closeOrderModal();
    } catch (error) {
        console.error(error);
        alert('خطأ أثناء التحديث');
    }
}

// Modal Management Fixes
document.addEventListener('DOMContentLoaded', () => {
    const modals = [document.getElementById('productModal'), document.getElementById('orderModal')];
    
    // Close when clicking outside
    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.classList.remove('open');
            }
        });
    });
    
    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modals.forEach(modal => modal.classList.remove('open'));
        }
    });
});

// Ensure only one modal opens at a time
const originalOpenProductModal = window.openProductModal;
window.openProductModal = function(id = null) {
    document.getElementById('orderModal').classList.remove('open');
    originalOpenProductModal(id);
};

const originalViewOrder = window.viewOrder;
window.viewOrder = function(orderId) {
    document.getElementById('productModal').classList.remove('open');
    originalViewOrder(orderId);
};
// Image Upload Logic (Client-side Compression & Preview)
let currentProcessedImageBase64 = null;
let currentProcessedImageName = null;

document.getElementById('uploadImageBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('prodImageFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('الرجاء اختيار صورة أولاً');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Validate type
    if (!file.type.match(/image\/(png|jpeg|webp)/)) {
        alert('صيغة غير مدعومة. الرجاء اختيار PNG, JPEG, أو WebP');
        return;
    }
    
    // Validate size (e.g. max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Compress and convert to WebP using Canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
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
            
            // Fill background white in case of transparent PNG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Output WebP
            const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
            currentProcessedImageBase64 = webpDataUrl.split(',')[1];
            
            const originalName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '-');
            const uniqueId = Date.now().toString(36);
            currentProcessedImageName = `${originalName}-${uniqueId}.webp`;
            
            // Show Preview
            document.getElementById('imagePreview').src = webpDataUrl;
            
            // Estimate size
            const base64Length = currentProcessedImageBase64.length - (currentProcessedImageBase64.indexOf(',') + 1);
            const padding = (currentProcessedImageBase64.charAt(currentProcessedImageBase64.length - 2) === '=') ? 2 : ((currentProcessedImageBase64.charAt(currentProcessedImageBase64.length - 1) === '=') ? 1 : 0);
            const fileSize = (base64Length * 0.75) - padding;
            const kbSize = (fileSize / 1024).toFixed(2);
            
            document.getElementById('imageDetails').textContent = `الأبعاد: ${Math.round(width)}x${Math.round(height)} | الحجم المقدر: ${kbSize} KB | الصيغة: WebP`;
            document.getElementById('imagePreviewContainer').style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('confirmUploadBtn').addEventListener('click', async () => {
    if (!currentProcessedImageBase64) return;
    
    // Simulate Backend Requirement
    const backendExists = false; // We do not have a secure Cloud Function running
    
    if (!backendExists) {
        alert('ملاحظة هامة:\n\nلرفع الصورة مباشرة إلى GitHub بشكل آمن، يتطلب المشروع خادماً خلفياً (Backend) مثل Cloud Functions.\n\nبما أن خطة Firebase الحالية مجانية (Spark) ولا تدعم الوظائف السحابية أو الاتصالات الخارجية، لا يمكن استكمال الرفع برمجياً من المتصفح بدون كشف الـ GitHub Token للعلن (وهو خطر أمني كبير).\n\nالرجاء إما ترقية المشروع إلى Blaze لإنشاء Cloud Function، أو رفع الصورة يدوياً عبر موقع GitHub إلى مجلد public/images/products.');
        
        // We will assign a fallback local path for testing purposes
        const fakePath = `/images/products/${currentProcessedImageName}`;
        document.getElementById('prodImage').value = fakePath;
        document.getElementById('imagePreviewContainer').style.display = 'none';
        alert(`تم اعتماد مسار الصورة كالتالي:\n${fakePath}\n\nيرجى رفع الملف الفعلي بنفس الاسم إلى مستودع GitHub الخاص بك ليتم عرضه بنجاح.`);
        return;
    }
    
});

// Hide preview container when modal closes
const origCloseProductModalForImg = window.closeProductModal;
window.closeProductModal = function() {
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('prodImageFile').value = '';
    origCloseProductModalForImg();
};
