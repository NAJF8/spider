const fs = require('fs');

function patchAdminHtml() {
    let html = fs.readFileSync('public/admin.html', 'utf8');

    // 1. Sidebar link
    html = html.replace(
        /<li(?:[^>]*)><a href="#" class="nav-item nav-item-disabled" data-view="view-placeholder" data-title="إدارة الموظفين"(?:[^>]*)><i class="fa-solid fa-users-gear"><\/i> <span>الموظفين<\/span> <span class="badge-sub">قريباً<\/span><\/a><\/li>/,
        `<li><a href="#" class="nav-item" data-view="view-managers"><i class="fa-solid fa-shield-halved"></i> <span>المدراء والصلاحيات</span></a></li>`
    );

    // 2. Add Manager view section before the closing </main>
    const managerViewHtml = `
            <!-- ================= VIEW: MANAGERS & PERMISSIONS ================= -->
            <section id="view-managers" class="admin-view hidden">
                <div class="view-header">
                    <div>
                        <h2><i class="fa-solid fa-shield-halved"></i> المدراء والصلاحيات</h2>
                        <p>إدارة فريق العمل، الأدوار، وصلاحيات الوصول للنظام.</p>
                    </div>
                    <button class="btn btn-primary" onclick="openManagerModal()"><i class="fa-solid fa-user-plus"></i> إضافة مدير جديد</button>
                </div>

                <div class="table-container">
                    <div class="filters-bar">
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="managersSearch" placeholder="بحث بالاسم، البريد أو الهاتف...">
                        </div>
                        <select id="managersRoleFilter" class="form-control" style="width: 200px;">
                            <option value="">كل الأدوار</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager / مشرف</option>
                            <option value="Staff">Staff</option>
                            <option value="Viewer">Viewer</option>
                        </select>
                        <select id="managersStatusFilter" class="form-control" style="width: 200px;">
                            <option value="">كل الحالات</option>
                            <option value="active">مفعل</option>
                            <option value="inactive">معطل</option>
                        </select>
                    </div>

                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>المدير</th>
                                <th>الدور</th>
                                <th>تاريخ الإضافة</th>
                                <th>الحالة</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="managersTableBody">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>

                <!-- Manager Modal -->
                <div id="managerModal" class="modal">
                    <div class="modal-content" style="max-width: 700px;">
                        <span class="close-modal" onclick="closeManagerModal()">&times;</span>
                        <h2 id="managerModalTitle">إضافة مدير جديد</h2>
                        
                        <form id="managerForm">
                            <input type="hidden" id="managerId">
                            
                            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                                <div class="form-group">
                                    <label>الاسم الكامل</label>
                                    <input type="text" id="managerName" required>
                                </div>
                                <div class="form-group">
                                    <label>البريد الإلكتروني</label>
                                    <input type="email" id="managerEmail">
                                </div>
                                <div class="form-group">
                                    <label>رقم الهاتف</label>
                                    <input type="tel" id="managerPhone" dir="ltr">
                                </div>
                                <div class="form-group">
                                    <label>الدور (Role)</label>
                                    <select id="managerRole" required>
                                        <option value="Admin">Admin</option>
                                        <option value="Manager">Manager / مشرف</option>
                                        <option value="Staff">Staff</option>
                                        <option value="Viewer">Viewer</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>الحالة</label>
                                    <select id="managerStatus">
                                        <option value="active">مفعل</option>
                                        <option value="inactive">معطل</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>ملاحظات (اختياري)</label>
                                    <input type="text" id="managerNotes">
                                </div>
                            </div>

                            <div class="permissions-section">
                                <h3 style="margin-bottom: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">صلاحيات الوصول</h3>
                                <div class="permissions-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;" id="managerPermissions">
                                    <label class="checkbox-label"><input type="checkbox" value="dashboard"> لوحة القيادة</label>
                                    <label class="checkbox-label"><input type="checkbox" value="products_view"> عرض المنتجات</label>
                                    <label class="checkbox-label"><input type="checkbox" value="products_add"> إضافة منتجات</label>
                                    <label class="checkbox-label"><input type="checkbox" value="products_edit"> تعديل منتجات</label>
                                    <label class="checkbox-label"><input type="checkbox" value="products_delete"> حذف منتجات</label>
                                    <label class="checkbox-label"><input type="checkbox" value="categories"> الأقسام</label>
                                    <label class="checkbox-label"><input type="checkbox" value="public_prices"> الأسعار العامة</label>
                                    <label class="checkbox-label"><input type="checkbox" value="special_prices"> الأسعار الخاصة</label>
                                    <label class="checkbox-label"><input type="checkbox" value="wholesale_prices"> أسعار الجملة</label>
                                    <label class="checkbox-label"><input type="checkbox" value="pricing_customers"> تسعير العملاء</label>
                                    <label class="checkbox-label"><input type="checkbox" value="orders"> الطلبات</label>
                                    <label class="checkbox-label"><input type="checkbox" value="customers"> العملاء</label>
                                    <label class="checkbox-label"><input type="checkbox" value="chatbot"> إعدادات البوت</label>
                                    <label class="checkbox-label"><input type="checkbox" value="store_settings"> إعدادات المتجر</label>
                                    <label class="checkbox-label"><input type="checkbox" value="reports"> التقارير</label>
                                    <label class="checkbox-label"><input type="checkbox" value="audit_logs"> سجل النشاطات</label>
                                    <label class="checkbox-label"><input type="checkbox" value="manage_staff"> إدارة الموظفين</label>
                                    <label class="checkbox-label"><input type="checkbox" value="manage_permissions"> إدارة الصلاحيات</label>
                                </div>
                            </div>
                            
                            <div class="modal-actions" style="margin-top: 20px;">
                                <button type="button" class="btn btn-outline" onclick="closeManagerModal()">إلغاء</button>
                                <button type="submit" class="btn btn-primary" id="saveManagerBtn">حفظ التغييرات</button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
`;
    // Insert before </main>
    html = html.replace('</main>', managerViewHtml + '\n        </main>');
    fs.writeFileSync('public/admin.html', html);
    console.log('admin.html patched');
}

function patchAdminJs() {
    let js = fs.readFileSync('public/admin.js', 'utf8');

    // Add `get` to imports
    js = js.replace(/import { getDatabase, ref, onValue, push, set, update, remove }/g, 'import { getDatabase, ref, onValue, push, set, update, remove, get }');

    // Replace auth state listener
    const oldAuth = /onAuthStateChanged\(auth, \(user\) => \{[\s\S]*?\}\);/m;
    
    const newAuth = `window.currentAdminPermissions = {};
window.isSuperAdmin = false;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentAdminUser = user;
        let isAuthorized = false;
        let role = '';
        let roleIcon = '';
        
        if (user.uid === SUPER_ADMIN_UID) {
            isAuthorized = true;
            window.isSuperAdmin = true;
            role = 'سوبر مشرف';
            roleIcon = '<i class="fa-solid fa-crown"></i>';
            window.currentAdminPermissions = { _super: true };
        } else {
            window.isSuperAdmin = false;
            try {
                // Check admins
                const adminRef = ref(db, \`admins/\${user.uid}\`);
                const adminSnap = await get(adminRef);
                
                if (adminSnap.exists() && adminSnap.val().status === 'active') {
                    isAuthorized = true;
                    role = adminSnap.val().role || 'مشرف';
                    roleIcon = '<i class="fa-solid fa-shield-halved"></i>';
                    window.currentAdminPermissions = adminSnap.val().permissions || {};
                } else {
                    // Check pending admins
                    if (user.email) {
                        const emailKey = user.email.replace(/\\./g, ',');
                        const pendingRef = ref(db, \`pending_admins/\${emailKey}\`);
                        const pendingSnap = await get(pendingRef);
                        if (pendingSnap.exists() && pendingSnap.val().status === 'active') {
                            const data = pendingSnap.val();
                            await set(ref(db, \`admins/\${user.uid}\`), {
                                email: user.email,
                                name: user.displayName || '',
                                role: data.role,
                                permissions: data.permissions || {},
                                status: data.status,
                                addedAt: Date.now(),
                                uid: user.uid
                            });
                            await remove(pendingRef);
                            isAuthorized = true;
                            role = data.role;
                            roleIcon = '<i class="fa-solid fa-shield-halved"></i>';
                            window.currentAdminPermissions = data.permissions || {};
                        }
                    }
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
            
            adminName.textContent = user.displayName || user.email || 'مسؤول';
            adminRole.innerHTML = \`\${roleIcon} \${role}\`;
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
});`;

    js = js.replace(oldAuth, newAuth);
    
    // Add Managers logic
    const managersLogic = `

// ================= MANAGERS & PERMISSIONS MODULE =================
let allAdminsData = {};
let allPendingAdminsData = {};

window.initManagersModule = function() {
    if (!window.isSuperAdmin && !window.currentAdminPermissions.manage_staff && !window.currentAdminPermissions.manage_permissions) {
        document.querySelector('[data-view="view-managers"]').parentElement.style.display = 'none';
        return;
    }
    document.querySelector('[data-view="view-managers"]').parentElement.style.display = 'block';

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
        name: 'Super Admin (System Owner)',
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
        
        if (search && !name.toLowerCase().includes(search) && !email.toLowerCase().includes(search) && !(m.phone||'').includes(search)) return;
        if (roleFilter && m.role !== roleFilter && !m.isSuper) return;
        if (statusFilter && m.status !== statusFilter && !m.isSuper) return;

        let actions = '';
        if (m.isSuper) {
            actions = '<span class="badge badge-primary">محمي</span>';
        } else {
            actions = \`
                <button class="btn btn-sm btn-outline" onclick="editManager('\${m.id}', '\${m.type}')"><i class="fa-solid fa-pen"></i></button>
            \`;
        }
        
        html += \`
            <tr>
                <td>
                    <strong>\${name}</strong>
                    <div style="font-size: 0.85em; color: #6b7280;">\${email} \${m.type === 'pending' ? '(في الانتظار)' : ''}</div>
                </td>
                <td><span class="badge">\${m.role || 'Admin'}</span></td>
                <td>\${m.addedAt ? new Date(m.addedAt).toLocaleDateString('ar-IQ') : '---'}</td>
                <td><span class="badge \${m.status === 'active' ? 'badge-success' : 'badge-danger'}">\${m.status === 'active' ? 'مفعل' : 'معطل'}</span></td>
                <td>\${actions}</td>
            </tr>
        \`;
    });
    tbody.innerHTML = html;
};

window.openManagerModal = function() {
    document.getElementById('managerModalTitle').textContent = 'إضافة مدير جديد';
    document.getElementById('managerForm').reset();
    document.getElementById('managerId').value = '';
    
    // Clear permissions
    document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    document.getElementById('managerModal').style.display = 'flex';
};

window.closeManagerModal = function() {
    document.getElementById('managerModal').style.display = 'none';
};

window.editManager = function(id, type) {
    document.getElementById('managerModalTitle').textContent = 'تعديل مدير';
    
    let data = type === 'active' ? allAdminsData[id] : allPendingAdminsData[id];
    if (!data) return;
    
    document.getElementById('managerId').value = type === 'active' ? id : 'pending_' + id;
    document.getElementById('managerName').value = data.name || '';
    document.getElementById('managerEmail').value = data.email || '';
    document.getElementById('managerPhone').value = data.phone || '';
    document.getElementById('managerRole').value = data.role || 'Admin';
    document.getElementById('managerStatus').value = data.status || 'active';
    document.getElementById('managerNotes').value = data.notes || '';
    
    document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => {
        cb.checked = !!(data.permissions && data.permissions[cb.value]);
    });
    
    document.getElementById('managerModal').style.display = 'flex';
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

    let perms = {};
    document.querySelectorAll('#managerPermissions input[type="checkbox"]').forEach(cb => {
        if (cb.checked) perms[cb.value] = true;
    });

    const data = {
        name: document.getElementById('managerName').value.trim(),
        email: email,
        phone: phone,
        role: document.getElementById('managerRole').value,
        status: document.getElementById('managerStatus').value,
        notes: document.getElementById('managerNotes').value.trim(),
        permissions: perms,
        updatedAt: Date.now()
    };
    
    try {
        if (!isEdit) {
            // New -> add to pending
            const emailKey = email ? email.replace(/\\./g, ',') : 'phone_' + phone;
            data.addedAt = Date.now();
            await set(ref(db, \`pending_admins/\${emailKey}\`), data);
        } else {
            if (isPendingEdit) {
                await update(ref(db, \`pending_admins/\${realId}\`), data);
            } else {
                await update(ref(db, \`admins/\${realId}\`), data);
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
        alert('تم حفظ البيانات بنجاح!');
    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء الحفظ. تأكد من صلاحياتك.');
    }
});

`;

    js = js + managersLogic;
    fs.writeFileSync('public/admin.js', js);
    console.log('admin.js patched');
}

patchAdminHtml();
patchAdminJs();
