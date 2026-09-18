document.addEventListener("DOMContentLoaded", () => {
    // نهيئ Firebase إذا لم يكن مهيأ
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const auth = firebase.auth();

    // DOM Elements
    const loginScreen = document.getElementById('login-screen');
    const adminScreen = document.getElementById('admin-screen');
    
    // تسجيل الدخول
    document.getElementById('login-google-btn').addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        const errorMsg = document.getElementById('login-error');
        
        auth.signInWithPopup(provider).catch(err => {
            errorMsg.innerText = "خطأ في تسجيل الدخول: " + err.message;
        });
    });

    // تسجيل الخروج
    document.getElementById('logout-btn').addEventListener('click', () => {
        auth.signOut();
    });

    // مراقبة حالة تسجيل الدخول
    auth.onAuthStateChanged(user => {
        if (user) {
            if (user.uid === 'e8uTdYi5TQOsrztxPnlD7X4GKAx1') {
                loginScreen.classList.add('hidden');
                adminScreen.classList.remove('hidden');
                fetchData();
            } else {
                // تسجيل خروج فوري لأي شخص غير الأدمن
                auth.signOut();
                document.getElementById('login-error').innerText = "عذراً، هذا الحساب غير مصرّح له بالدخول كأدمن.";
            }
        } else {
            loginScreen.classList.remove('hidden');
            adminScreen.classList.add('hidden');
        }
    });

    // التبديل بين التبويبات
    document.querySelectorAll('.nav-links li[data-target]').forEach(li => {
        li.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            document.getElementById(li.getAttribute('data-target')).classList.remove('hidden');
        });
    });

    // المتغيرات لحفظ البيانات
    let adminProducts = [];
    let adminOrders = [];
    let editingProductId = null;
    let viewingOrderId = null;

    function fetchData() {
        // الأقسام
        db.ref('categories').on('value', snap => {
            const data = snap.val();
            const select = document.getElementById('p-category');
            select.innerHTML = '';
            if(data) {
                Object.values(data).forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat.name;
                    opt.innerText = cat.title;
                    select.appendChild(opt);
                });
            }
        });

        // المنتجات
        db.ref('products').on('value', snap => {
            const data = snap.val();
            adminProducts = [];
            const tbody = document.getElementById('products-tbody');
            tbody.innerHTML = '';
            
            if(data) {
                for(let key in data) {
                    const p = { id: key, ...data[key] };
                    adminProducts.push(p);
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><img src="${p.image}" width="50" style="border-radius:4px;"></td>
                        <td>${p.name}</td>
                        <td>${p.category}</td>
                        <td>${formatPrice(p.price)}</td>
                        <td><span style="padding:4px 8px; border-radius:4px; background:${p.stock==='متوفر'?'#d4edda':'#f8d7da'}">${p.stock}</span></td>
                        <td>
                            <button class="btn btn-primary" style="padding:5px 10px; font-size:12px;" onclick="editProduct('${p.id}')">تعديل</button>
                            <button class="btn btn-outline" style="padding:5px 10px; font-size:12px; color:red; border-color:red;" onclick="deleteProduct('${p.id}')">حذف</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
            }
            document.getElementById('total-products').innerText = adminProducts.length;
        });

        // الطلبات
        db.ref('orders').on('value', snap => {
            const data = snap.val();
            adminOrders = [];
            const tbody = document.getElementById('orders-tbody');
            tbody.innerHTML = '';
            
            if(data) {
                for(let key in data) {
                    const o = { id: key, ...data[key] };
                    adminOrders.push(o);
                }
                
                // ترتيب حسب الأحدث
                adminOrders.sort((a,b) => b.timestamp - a.timestamp);
                
                adminOrders.forEach(o => {
                    const tr = document.createElement('tr');
                    const d = new Date(o.timestamp).toLocaleString('ar-EG');
                    tr.innerHTML = `
                        <td>#${o.orderNumber}</td>
                        <td>${o.customerName}</td>
                        <td>${o.governorate}</td>
                        <td>${formatPrice(o.grandTotal)}</td>
                        <td dir="ltr" style="text-align:right;">${d}</td>
                        <td><span style="padding:4px 8px; border-radius:4px; background:#e2e3e5">${o.status || 'جديد'}</span></td>
                        <td><button class="btn btn-outline" style="padding:5px 10px; font-size:12px;" onclick="viewOrder('${o.id}')">عرض</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            document.getElementById('total-orders').innerText = adminOrders.length;
        });
    }

    // إدارة النوافذ المنبثقة للمنتجات
    const pModal = document.getElementById('product-modal');
    
    document.getElementById('add-product-btn').addEventListener('click', () => {
        editingProductId = null;
        document.getElementById('modal-title').innerText = "إضافة منتج جديد";
        // تصفير الحقول
        document.getElementById('p-name').value = '';
        document.getElementById('p-brand').value = '';
        document.getElementById('p-price').value = '';
        document.getElementById('p-oldprice').value = '';
        document.getElementById('p-image').value = '';
        document.getElementById('p-desc').value = '';
        document.getElementById('p-stock').value = 'متوفر';
        
        pModal.classList.remove('hidden');
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        pModal.classList.add('hidden');
    });

    document.getElementById('save-product-btn').addEventListener('click', () => {
        const name = document.getElementById('p-name').value;
        const category = document.getElementById('p-category').value;
        const brand = document.getElementById('p-brand').value;
        const price = parseFloat(document.getElementById('p-price').value);
        const oldPrice = parseFloat(document.getElementById('p-oldprice').value);
        const image = document.getElementById('p-image').value;
        const stock = document.getElementById('p-stock').value;
        const desc = document.getElementById('p-desc').value;

        if(!name || !price || !image) {
            alert("يرجى ملء الاسم، السعر، والصورة كحد أدنى.");
            return;
        }

        const productData = {
            name, category, brand, price,
            oldPrice: isNaN(oldPrice) ? null : oldPrice,
            image, stock, description: desc
        };

        if(editingProductId) {
            db.ref('products/' + editingProductId).update(productData)
              .then(() => pModal.classList.add('hidden'));
        } else {
            db.ref('products').push(productData)
              .then(() => pModal.classList.add('hidden'));
        }
    });

    window.editProduct = function(id) {
        const p = adminProducts.find(x => x.id === id);
        if(!p) return;
        
        editingProductId = id;
        document.getElementById('modal-title').innerText = "تعديل منتج";
        
        document.getElementById('p-name').value = p.name || '';
        document.getElementById('p-category').value = p.category || '';
        document.getElementById('p-brand').value = p.brand || '';
        document.getElementById('p-price').value = p.price || '';
        document.getElementById('p-oldprice').value = p.oldPrice || '';
        document.getElementById('p-image').value = p.image || '';
        document.getElementById('p-desc').value = p.description || '';
        document.getElementById('p-stock').value = p.stock || 'متوفر';
        
        pModal.classList.remove('hidden');
    };

    window.deleteProduct = function(id) {
        if(confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
            db.ref('products/' + id).remove();
        }
    };

    // إدارة الطلبات
    const oModal = document.getElementById('order-modal');
    
    window.viewOrder = function(id) {
        const o = adminOrders.find(x => x.id === id);
        if(!o) return;
        
        viewingOrderId = id;
        const content = document.getElementById('order-details-content');
        
        let itemsHtml = '<ul>';
        if(o.items) {
            o.items.forEach(i => {
                itemsHtml += `<li>${i.name} - الكمية: ${i.quantity}</li>`;
            });
        }
        itemsHtml += '</ul>';

        content.innerHTML = `
            <p><strong>الاسم:</strong> ${o.customerName}</p>
            <p><strong>الهاتف:</strong> ${o.customerPhone}</p>
            <p><strong>العنوان:</strong> ${o.governorate} - ${o.city} - ${o.address}</p>
            <p><strong>ملاحظات:</strong> ${o.notes || 'لا يوجد'}</p>
            <hr>
            <h4>المنتجات:</h4>
            ${itemsHtml}
            <hr>
            <p><strong>المجموع الكلي:</strong> ${formatPrice(o.grandTotal)}</p>
        `;
        
        document.getElementById('order-status-select').value = o.status || 'جديد';
        oModal.classList.remove('hidden');
    };

    document.getElementById('close-order-modal-btn').addEventListener('click', () => {
        oModal.classList.add('hidden');
    });

    document.getElementById('update-order-btn').addEventListener('click', () => {
        if(viewingOrderId) {
            const status = document.getElementById('order-status-select').value;
            db.ref('orders/' + viewingOrderId).update({ status: status })
              .then(() => oModal.classList.add('hidden'));
        }
    });

    // استيراد البيانات التجريبية
    document.getElementById('import-data-btn').addEventListener('click', async () => {
        if(confirm("سيتم رفع الأقسام والمنتجات التجريبية إلى قاعدة البيانات. هل أنت متأكد؟")) {
            const btn = document.getElementById('import-data-btn');
            btn.innerText = "جاري الرفع...";
            btn.disabled = true;

            try {
                // التحقق من عدم وجود بيانات مسبقاً لمنع التكرار
                const snap = await db.ref('products').once('value');
                if(snap.exists()) {
                    alert("عذراً، قاعدة البيانات تحتوي على منتجات بالفعل. تم إيقاف الاستيراد لمنع التكرار.");
                    btn.innerText = "استيراد البيانات الأساسية";
                    btn.disabled = false;
                    return;
                }

                // رفع الأقسام
                for(let cat of defaultCategories) {
                    await db.ref('categories').push(cat);
                }
                // رفع المنتجات
                for(let prod of defaultProducts) {
                    const {id, ...rest} = prod;
                    await db.ref('products').push(rest);
                }
                alert("تم استيراد البيانات بنجاح!");
            } catch(e) {
                alert("حدث خطأ: " + e.message);
            } finally {
                btn.innerText = "استيراد البيانات الأساسية";
                btn.disabled = false;
            }
        }
    });
});
