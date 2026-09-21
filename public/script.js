import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA3_h6cWLhOx3nBgH2mGBAUpVaGpqQOxz0',
  authDomain: 'spider-aaa19.firebaseapp.com',
  databaseURL: 'https://spider-aaa19-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'spider-aaa19',
  storageBucket: 'spider-aaa19.firebasestorage.app'
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const CART_STORAGE_KEY = 'spider.cart.v1';
const FAVORITES_KEY = 'spider.favorites.v1';
const ALERTS_KEY = 'spider.availability-alerts.v1';
const BACKEND_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8787'
  : 'https://spider-backend.coffee101.workers.dev';

const state = {
  products: [],
  categories: [],
  cart: [],
  favorites: [],
  settings: {},
  filters: { category: '', brand: '', search: '' },
  showCategories: false,
  showBrands: false,
  compare: ['', ''],
  builder: {},
  availabilityProductId: ''
};

let deliveryFee = 0;
let lowStockThreshold = 3;
let authUser = null;

// ===== Utilities =====
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const formatPrice = (value) => `${Number(value || 0).toLocaleString('ar-IQ')} د.ع`;
const normalizeWhatsApp = (v) => String(v || '').replace(/[^0-9]/g, '').replace(/^00/, '');
const safeUrl = (v) => { try { const u = new URL(String(v || '').trim()); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const productStock = (p) => p?.stockQuantity ?? p?.stock;
const isAvailable = (p) => p && p.inStock !== false && (productStock(p) === undefined || Number(productStock(p)) > 0);
const stockLabel = (p) => { if (!isAvailable(p)) return ['غير متوفر', 'out']; const s = productStock(p); if (s !== undefined && Number(s) <= lowStockThreshold) return ['كمية محدودة', 'limited']; return ['متوفر', 'in']; };
const imageFor = (p) => p?.image || 'images/default-product.svg';
const categoryName = (id) => state.categories.find((c) => c.id === id)?.name || id || 'غير محدد';
const categoryIdFor = (p) => p?.categoryId || p?.category || '';
const productText = (p) => [p?.name, p?.brand, p?.model, p?.description, ...Object.values(p?.specifications || {})].filter(Boolean).join(' ').toLowerCase();
const showToast = (msg) => { const t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(showToast._t); showToast._t = setTimeout(() => t.classList.remove('show'), 2800); };
const modal = (id, open) => $(id)?.classList.toggle('open', open);

// ===== Fallback images per category keyword =====
const FALLBACK_IMAGES = {
  cpu: 'assets/cpu.jpg',
  معالج: 'assets/cpu.jpg',
  gpu: 'assets/gpu.jpg',
  كرت: 'assets/gpu.jpg',
  شاشة: 'assets/monitor.jpg',
  monitor: 'assets/monitor.jpg',
  لابتوب: 'assets/laptop.jpg',
  laptop: 'assets/laptop.jpg',
  سماعة: 'assets/headset.jpg',
  headset: 'assets/headset.jpg',
  gaming: 'assets/gaming-pc.jpg',
  ألعاب: 'assets/gaming-pc.jpg'
};
function categoryFallback(cat) {
  const key = `${cat.id || ''} ${cat.name || ''}`.toLowerCase();
  for (const [k, src] of Object.entries(FALLBACK_IMAGES)) {
    if (key.includes(k.toLowerCase())) return src;
  }
  return 'images/default-category.svg';
}

// ===== Product category matching =====
function productCategoryMatch(product, categoryId) {
  if (!categoryId) return true;
  const selected = state.categories.find((c) => c.id === categoryId);
  const pc = categoryIdFor(product);
  return pc === categoryId ||
    selected?.subcategoryIds?.includes(pc) ||
    state.categories.find((c) => c.id === pc)?.parentCategory === categoryId;
}

function filteredProducts() {
  const { category, brand, search } = state.filters;
  return state.products.filter((p) =>
    productCategoryMatch(p, category) &&
    (!brand || String(p.brand || '').toLowerCase() === brand.toLowerCase()) &&
    (!search || productText(p).includes(search.toLowerCase()))
  );
}

// ===== Settings =====
function applySettings(settings = {}) {
  state.settings = settings || {};
  deliveryFee = Number(settings.deliveryFee || 0);
  lowStockThreshold = Number(settings.lowStockThreshold ?? 3);

  const storeName = String(settings.storeNameAr || 'سبايدر للإلكترونيات');
  const [name, ...tagline] = storeName.split(' ');
  $('brandName').textContent = name || 'سبايدر';
  $('brandTagline').textContent = tagline.join(' ') || 'للإلكترونيات';

  if (settings.logoUrl && safeUrl(settings.logoUrl)) $('brandLogo').src = settings.logoUrl;
  // The approved storefront hero copy is intentionally not overwritten by
  // optional admin settings. Product, category, image, and store data remain live.
  if (settings.heroImage && safeUrl(settings.heroImage)) $('heroImage').src = settings.heroImage;
  if (settings.welcomeMessage) $('chatWelcome').textContent = settings.welcomeMessage;

  // Hero CTA button
  $('heroBuilderBtn').replaceChildren(document.createTextNode('ابنِ تجميعتك الآن '));
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-arrow-left';
  $('heroBuilderBtn').append(icon);

  const instagram = safeUrl(settings.instagramUrl);
  const whatsapp = normalizeWhatsApp(settings.whatsappNumber || settings.whatsapp || settings.storePhone || '9647827337942');
  const map = safeUrl(settings.googleMapsUrl || settings.mapUrl);

  [['instagramLink', instagram], ['footerWhatsapp', whatsapp ? `https://wa.me/${whatsapp}` : ''], ['mapLink', map]].forEach(([id, url]) => {
    const el = $(id); if (!el) return;
    if (url) { el.href = url; el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
  });

  if (settings.chatbotEnabled === false) { $('chatbotFab')?.classList.add('hidden'); }
  else { $('chatbotFab')?.classList.remove('hidden'); }
}

// ===== Categories — Circular Row =====
function renderCategories() {
  const categories = [...state.categories].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const row = $('categoriesRow');

  // Always show categories (no toggle)
  row.classList.remove('is-collapsed');
  state.showCategories = true;

  if (!categories.length) {
    row.innerHTML = '<div class="loading-state">لا توجد أقسام منشورة حالياً.</div>';
    return;
  }


  row.innerHTML = categories.map((cat) => {
    const imgSrc = cat.image || categoryFallback(cat);
    const imgHtml = `<img src="${esc(imgSrc)}" alt="${esc(cat.name)}" loading="lazy" onerror="this.src='${categoryFallback(cat)}'">`;
    return `<button class="cat-circle-item" type="button" data-category-id="${esc(cat.id)}" title="${esc(cat.name)}">
      <span class="cat-circle">${imgHtml}</span>
      <span class="cat-name">${esc(cat.name)}</span>
    </button>`;
  }).join('');

  row.querySelectorAll('[data-category-id]').forEach((btn) =>
    btn.addEventListener('click', () => filterProductsByCategory(btn.dataset.categoryId))
  );

  // Sidebar nav
  $('sidebarNav').innerHTML = categories.map((cat) => {
    const hasSubs = cat.subcategoryIds && cat.subcategoryIds.length > 0;
    const imgHtml = cat.image
      ? `<img class="cat-icon" src="${esc(cat.image)}" alt="">`
      : `<i class="fa-solid ${esc(cat.icon || 'fa-folder')}"></i>`;
    return `<li>
      <button type="button" data-category-id="${esc(cat.id)}" ${hasSubs ? `aria-expanded="false"` : ''}>
        <span>${imgHtml} ${esc(cat.name)}</span>
        ${hasSubs ? '<i class="fa-solid fa-chevron-down chevron"></i>' : ''}
      </button>
      ${hasSubs ? `<ul class="sidebar-sub" id="sub-${esc(cat.id)}">${cat.subcategoryIds.map(sid => {
        const sub = state.categories.find(c => c.id === sid);
        if (!sub) return '';
        return `<li><button type="button" data-category-id="${esc(sid)}">${esc(sub.name)}</button></li>`;
      }).join('')}</ul>` : ''}
    </li>`;
  }).join('');

  $('sidebarNav').querySelectorAll('[data-category-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hasSubs = btn.hasAttribute('aria-expanded');
      if (hasSubs) {
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        const subList = document.getElementById(`sub-${btn.dataset.categoryId}`);
        if (subList) subList.classList.toggle('open', !isExpanded);
      } else {
        filterProductsByCategory(btn.dataset.categoryId);
        closeSidebar();
      }
    });
  });
}

// ===== Products =====
function availabilityMarkup(p) {
  const [label, tone] = stockLabel(p);
  return `<span class="stock ${tone}">${label}</span>`;
}

function productCard(p) {
  const [label] = stockLabel(p);
  const fav = state.favorites.includes(p.id);
  return `<article class="product-card ${label === 'غير متوفر' ? 'is-out' : ''}">
    <button class="heart-btn ${fav ? 'active' : ''}" type="button" data-favorite="${esc(p.id)}" aria-label="${fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}">
      <i class="fa-${fav ? 'solid' : 'regular'} fa-heart"></i>
    </button>
    <div class="product-image" data-details="${esc(p.id)}">
      <img src="${esc(imageFor(p))}" alt="${esc(p.name)}" loading="lazy">
    </div>
    <div class="product-body">
      <span class="product-brand">${esc(p.brand || 'سبايدر')}</span>
      <div class="product-title" data-details="${esc(p.id)}">${esc(p.name)}</div>
      <div class="product-model">${esc(p.model || p.subcategory || '')}</div>
      <div>${availabilityMarkup(p)}</div>
      <div class="price-row">
        <strong class="product-price">${formatPrice(p.price)}</strong>
        ${p.originalPrice ? `<span class="old-price">${formatPrice(p.originalPrice)}</span>` : ''}
      </div>
      <div class="product-actions">
        ${isAvailable(p)
          ? `<button class="btn btn-primary" type="button" data-add="${esc(p.id)}"><i class="fa-solid fa-cart-plus"></i> أضف للسلة</button>`
          : `<button class="btn stock-btn" type="button" data-alert="${esc(p.id)}"><i class="fa-regular fa-bell"></i> نبّهني عند التوفر</button>`
        }
        <button class="btn btn-outline" type="button" data-details="${esc(p.id)}">التفاصيل</button>
      </div>
    </div>
  </article>`;
}

function bindProductActions(root = document) {
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.add)));
  root.querySelectorAll('[data-details]').forEach((b) => b.addEventListener('click', () => openProductDetails(b.dataset.details)));
  root.querySelectorAll('[data-favorite]').forEach((b) => b.addEventListener('click', () => toggleFavorite(b.dataset.favorite)));
  root.querySelectorAll('[data-alert]').forEach((b) => b.addEventListener('click', () => openAvailability(b.dataset.alert)));
}

function renderProducts() {
  const filtered = filteredProducts();
  $('productsGrid').innerHTML = filtered.length
    ? filtered.map(productCard).join('')
    : '<div class="empty-state">لا توجد منتجات منشورة مطابقة للبحث أو الفلتر.</div>';
  bindProductActions($('productsGrid'));
  const bits = [
    state.filters.search && `بحث: ${state.filters.search}`,
    state.filters.brand && `ماركة: ${state.filters.brand}`,
    state.filters.category && `قسم: ${categoryName(state.filters.category)}`
  ].filter(Boolean);
  $('activeFilter').textContent = bits.join(' · ');
  $('activeFilter').classList.toggle('hidden', !bits.length);
  $('productsSectionTitle').textContent = bits.length ? 'نتائج المنتجات' : 'أحدث المنتجات';
}

function filterProductsByCategory(categoryId) {
  state.filters = { category: categoryId || '', brand: '', search: '' };
  $('searchInput').value = '';
  renderProducts();
  document.querySelector('#productsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.filterProductsByCategory = filterProductsByCategory;

function clearFilters() {
  state.filters = { category: '', brand: '', search: '' };
  $('searchInput').value = '';
  document.querySelectorAll('.brand-item').forEach((b) => b.classList.remove('active'));
  $('clearBrandBtn').classList.add('hidden');
  renderBrands();
  renderProducts();
}

// ===== Brands =====
function renderBrands() {
  const brands = [...new Set(state.products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $('brandsGrid').classList.toggle('is-collapsed', !state.showBrands);
  $('toggleBrandsBtn').setAttribute('aria-expanded', String(state.showBrands));
  $('toggleBrandsBtn').innerHTML = `${state.showBrands ? 'اضغط لإخفاء العلامات التجارية' : 'اضغط لإظهار العلامات التجارية'} <i class="fa-solid ${state.showBrands ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>`;
  $('brandsGrid').innerHTML = brands.length
    ? brands.map((brand) => {
        const prod = state.products.find((p) => p.brand === brand);
        const logo = prod?.brandLogo || prod?.logo;
        return `<button type="button" class="brand-item ${state.filters.brand === brand ? 'active' : ''}" data-brand="${esc(brand)}">${logo ? `<img class="brand-logo" src="${esc(logo)}" alt="${esc(brand)}">` : `<span class="brand-mark">${esc(brand.slice(0, 3).toUpperCase())}</span>`}<span>${esc(brand)}</span></button>`;
      }).join('')
    : '<div class="empty-state">لا توجد علامات في المنتجات المنشورة.</div>';
  $('brandsGrid').querySelectorAll('[data-brand]').forEach((b) => b.addEventListener('click', () => {
    state.filters = { category: '', brand: b.dataset.brand, search: '' };
    $('searchInput').value = '';
    $('clearBrandBtn').classList.remove('hidden');
    renderBrands();
    renderProducts();
    document.querySelector('#productsSection').scrollIntoView({ behavior: 'smooth' });
  }));
}

// ===== Sidebar All Products =====
function renderSidebarAll() {
  $('sidebarAllProducts').addEventListener('click', () => {
    clearFilters();
    closeSidebar();
    document.querySelector('#productsSection').scrollIntoView({ behavior: 'smooth' });
  });
}

// ===== Search Suggestions =====
function renderSuggestions(query) {
  const val = query.trim().toLowerCase();
  const box = $('searchSuggestions');
  if (!val) { box.classList.add('hidden'); return; }
  const matches = state.products.filter((p) => productText(p).includes(val)).slice(0, 5);
  box.innerHTML = matches.length
    ? matches.map((p) => `<button class="suggestion" type="button" data-suggestion="${esc(p.id)}"><img src="${esc(imageFor(p))}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(p.brand || '')} · ${stockLabel(p)[0]}</small></div><b>${formatPrice(p.price)}</b></button>`).join('')
    : '<div class="suggestion"><div><strong>لا توجد نتائج منشورة</strong><small>جرّب اسم شركة أو موديل آخر</small></div></div>';
  box.classList.remove('hidden');
  box.querySelectorAll('[data-suggestion]').forEach((b) => b.addEventListener('click', () => {
    box.classList.add('hidden');
    openProductDetails(b.dataset.suggestion);
  }));
}

// ===== COMPARE =====
function populateCompareFilters() {
  $('compareCategorySelect').innerHTML = '<option value="">كل الأقسام</option>' +
    state.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  const brands = [...new Set(state.products.map((p) => p.brand).filter(Boolean))].sort();
  $('compareBrandSelect').innerHTML = '<option value="">كل العلامات</option>' +
    brands.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
  populateCompareProducts();
}

function comparePool() {
  return state.products.filter((p) =>
    productCategoryMatch(p, $('compareCategorySelect').value) &&
    (!$('compareBrandSelect').value || p.brand === $('compareBrandSelect').value)
  );
}

function populateCompareProducts() {
  const pool = comparePool();
  ['compareProd1Select', 'compareProd2Select'].forEach((id, idx) => {
    const sel = $(id);
    const curr = state.compare[idx];
    sel.innerHTML = `<option value="">اختر المنتج ${idx + 1}</option>` +
      pool.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (pool.some((p) => p.id === curr)) sel.value = curr;
  });
  updateCompareView();
}

function previewCompare(id, previewId) {
  const p = state.products.find((item) => item.id === id);
  const el = $(previewId);
  if (!el) return;
  if (p) {
    el.className = 'compare-picker-card';
    el.innerHTML = `
      <img src="${esc(imageFor(p))}" alt="${esc(p.name)}">
      <div class="cpc-name">${esc(p.name)}</div>
      <div class="cpc-model">${esc(p.model || p.brand || '')}</div>
      <div class="cpc-price">${formatPrice(p.price)}</div>
      <div class="cpc-actions">
        <button class="btn btn-outline" type="button" data-compare-change="${esc(previewId)}">تغيير</button>
        <button class="btn btn-outline" type="button" data-compare-clear="${esc(previewId)}">إزالة</button>
      </div>`;
    // Change button shows the select
    el.querySelector('[data-compare-change]')?.addEventListener('click', () => {
      el.className = 'picker-empty';
      el.innerHTML = '<i class="fa-regular fa-image"></i><span>اختر منتجاً</span>';
      if (previewId === 'comparePreview1') { $('compareProd1Select').value = ''; state.compare[0] = ''; }
      else { $('compareProd2Select').value = ''; state.compare[1] = ''; }
      $('compareResults').classList.add('hidden');
    });
    el.querySelector('[data-compare-clear]')?.addEventListener('click', () => {
      el.className = 'picker-empty';
      el.innerHTML = '<i class="fa-regular fa-image"></i><span>اختر منتجاً</span>';
      if (previewId === 'comparePreview1') { $('compareProd1Select').value = ''; state.compare[0] = ''; }
      else { $('compareProd2Select').value = ''; state.compare[1] = ''; }
      $('compareResults').classList.add('hidden');
    });
  } else {
    el.className = 'picker-empty';
    el.innerHTML = '<i class="fa-regular fa-image"></i><span>اختر منتجاً</span>';
  }
}

function updateCompareView() {
  state.compare = [$('compareProd1Select').value, $('compareProd2Select').value];
  previewCompare(state.compare[0], 'comparePreview1');
  previewCompare(state.compare[1], 'comparePreview2');

  const [first, second] = state.compare.map((id) => state.products.find((p) => p.id === id));
  if (!first || !second || first.id === second.id) {
    $('compareResults').classList.add('hidden');
    return;
  }
  if (categoryIdFor(first) !== categoryIdFor(second)) {
    $('compareResults').innerHTML = '<div class="empty-state">اختر منتجين من نفس القسم لإظهار مقارنة عادلة.</div>';
    $('compareResults').classList.remove('hidden');
    return;
  }

  const keys = [...new Set([...Object.keys(first.specifications || {}), ...Object.keys(second.specifications || {})])];
  const rows = keys.length
    ? keys.map((key) => `<div class="spec-row">
        <span>${esc(first.specifications?.[key] ?? 'غير متوفر')}</span>
        <span class="spec-key">${esc(key)}</span>
        <span>${esc(second.specifications?.[key] ?? 'غير متوفر')}</span>
      </div>`).join('')
    : '<div class="empty-state">لا توجد مواصفات منشورة للمقارنة.</div>';

  $('compareResults').innerHTML = `
    <div class="compare-result-cards">
      <div class="compare-card">
        <img src="${esc(imageFor(first))}" alt="${esc(first.name)}">
        <h3>${esc(first.name)}</h3>
        <strong>${formatPrice(first.price)}</strong>
        <div class="compare-result-actions">
          <button class="btn btn-primary" type="button" data-add="${esc(first.id)}">أضف للسلة</button>
          <button class="btn btn-outline" type="button" data-details="${esc(first.id)}">التفاصيل</button>
        </div>
      </div>
      <div class="compare-card">
        <img src="${esc(imageFor(second))}" alt="${esc(second.name)}">
        <h3>${esc(second.name)}</h3>
        <strong>${formatPrice(second.price)}</strong>
        <div class="compare-result-actions">
          <button class="btn btn-primary" type="button" data-add="${esc(second.id)}">أضف للسلة</button>
          <button class="btn btn-outline" type="button" data-details="${esc(second.id)}">التفاصيل</button>
        </div>
      </div>
    </div>
    <div class="spec-table">
      <div class="spec-row">
        <span>${esc(first.brand || 'غير متوفر')}</span>
        <span class="spec-key">العلامة</span>
        <span>${esc(second.brand || 'غير متوفر')}</span>
      </div>
      ${rows}
      <div class="spec-row">
        <span>${esc(first.warranty || 'غير متوفر')}</span>
        <span class="spec-key">الضمان</span>
        <span>${esc(second.warranty || 'غير متوفر')}</span>
      </div>
    </div>`;

  $('compareResults').classList.remove('hidden');
  bindProductActions($('compareResults'));
}

// ===== BUILDER — Card-based UI =====
const builderParts = [
  { id: 'cpu',         label: 'المعالج CPU',       icon: 'fa-microchip',       match: /cpu|cpus|معالج|معالجات/i },
  { id: 'motherboard', label: 'اللوحة الأم',        icon: 'fa-border-all',      match: /motherboard|motherboards|لوحة|مذربورد/i },
  { id: 'ram',         label: 'الذاكرة RAM',        icon: 'fa-memory',          match: /ram|ذاكرة|رام/i },
  { id: 'gpu',         label: 'كرت الشاشة GPU',     icon: 'fa-display',         match: /gpu|كرت|كروت|vga/i },
  { id: 'storage',     label: 'التخزين',            icon: 'fa-hard-drive',      match: /ssd|nvme|m\.2|hdd|hard|هارد|تخزين/i },
  { id: 'psu',         label: 'مزود الطاقة PSU',    icon: 'fa-plug',            match: /psu|power|طاقة|مجهز/i },
  { id: 'case',        label: 'الصندوق Case',       icon: 'fa-box',             match: /case|صندوق/i },
  { id: 'cooling',     label: 'التبريد',            icon: 'fa-fan',             match: /cooling|تبريد/i }
];

function productsForPart(part) {
  return state.products.filter((p) => {
    const text = `${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name || ''}`;
    if (part.id === 'gpu') return /gpu|gpus|كرت|كروت/i.test(text);
    if (part.id === 'storage') return /ssd|nvme|m\.2|hdd|hard|هارد|تخزين/i.test(text);
    return part.match.test(text);
  });
}

// Get top 3 specs of a product for builder card display
function topSpecs(product) {
  const specs = Object.entries(product?.specifications || {});
  return specs.slice(0, 3).map(([k, v]) => `${k}: ${v}`);
}

function renderBuilder() {
  const list = $('builderPartsList');
  list.innerHTML = builderParts.map((part) => {
    const options = productsForPart(part);
    const selectedId = state.builder[part.id];
    const product = state.products.find((p) => p.id === selectedId);

    if (product) {
      // Filled card
      const specs = topSpecs(product);
      return `<div class="builder-part" data-part-id="${esc(part.id)}">
        <div class="builder-part-filled">
          <div class="builder-part-filled-inner">
            <div class="part-filled-top">
              <img class="part-filled-img" src="${esc(imageFor(product))}" alt="${esc(product.name)}"
                onerror="this.src='images/default-product.svg'">
              <div class="part-filled-info">
                <div class="part-filled-category"><i class="fa-solid ${esc(part.icon)}"></i> ${esc(part.label)}</div>
                <div class="part-filled-name">${esc(product.name)}</div>
                <div class="part-filled-model">${esc(product.model || product.brand || '')}</div>
              </div>
            </div>
            ${specs.length ? `<div class="part-filled-specs">${specs.map((s) => `<span class="part-spec-chip">${esc(s)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="part-filled-price">
            <strong>${formatPrice(product.price)}</strong>
            <span>${availabilityMarkup(product)}</span>
          </div>
          <div class="part-filled-actions">
            <button class="btn btn-outline" type="button" data-builder-change="${esc(part.id)}">
              <i class="fa-solid fa-rotate"></i> تغيير
            </button>
            <button class="btn btn-outline" type="button" data-builder-remove="${esc(part.id)}">
              <i class="fa-solid fa-xmark"></i> مسح
            </button>
          </div>
        </div>
      </div>`;
    } else {
      // Empty card — show select dropdown
      const noProducts = options.length === 0;
      return `<div class="builder-part" data-part-id="${esc(part.id)}">
        <div class="builder-part-empty">
          <div class="part-header">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="part-icon-wrap"><i class="fa-solid ${esc(part.icon)}"></i></div>
              <span class="part-label">${esc(part.label)}</span>
            </div>
            ${!noProducts ? `<div class="part-add-btn"><i class="fa-solid fa-plus"></i></div>` : ''}
          </div>
          ${noProducts
            ? `<span class="no-products-note">لا توجد قطعة منشورة حالياً</span>`
            : `<select data-builder-part="${esc(part.id)}" style="width:100%;border:1px solid var(--line);border-radius:9px;padding:9px;background:var(--soft);font-size:13px;color:var(--ink);outline:none;margin-top:8px">
                <option value="">اختر ${esc(part.label)}</option>
                ${options.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} · ${formatPrice(item.price)}</option>`).join('')}
              </select>`
          }
        </div>
      </div>`;
    }
  }).join('');

  // Delegate interactions from the stable list container so freshly rendered
  // cards always retain working تغيير/مسح and selection controls.
  list.onclick = (event) => {
    const remove = event.target.closest('[data-builder-remove]');
    const change = event.target.closest('[data-builder-change]');
    const partId = remove?.dataset.builderRemove || change?.dataset.builderChange;
    if (!partId) return;
    delete state.builder[partId];
    renderBuilder();
  };
  list.onchange = (event) => {
    const select = event.target.closest('[data-builder-part]');
    if (!select) return;
    if (select.value) state.builder[select.dataset.builderPart] = select.value;
    else delete state.builder[select.dataset.builderPart];
    renderBuilder();
  };

  updateBuilder();
}

function selectedBuilderProducts() {
  return Object.values(state.builder)
    .map((id) => state.products.find((p) => p.id === id))
    .filter(Boolean);
}

function specValue(p, names) {
  const specs = p?.specifications || {};
  const key = Object.keys(specs).find((k) => names.some((n) => k.toLowerCase().includes(n.toLowerCase())));
  return key ? String(specs[key]) : '';
}

function compatibilityStatus(selected) {
  if (!selected.length) return ['اختر القطع لفحص التوافق.', ''];
  const cpu = selected.find((p) => /cpu|cpus|معالج|معالجات/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))}`));
  const mb  = selected.find((p) => /motherboard|لوحة|مذربورد/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))}`));
  const ram = selected.find((p) => /ram|ذاكرة|رام/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))}`));

  const reasons = [];
  const cpuSocket = specValue(cpu, ['socket', 'مقبس']);
  const mbSocket  = specValue(mb,  ['socket', 'مقبس']);
  if (cpuSocket && mbSocket && cpuSocket.toLowerCase() !== mbSocket.toLowerCase())
    reasons.push(`مقبس المعالج ${cpuSocket} لا يطابق اللوحة ${mbSocket}.`);

  const ramType = specValue(ram, ['نوع الذاكرة', 'memory type', 'type']);
  const mbRam   = specValue(mb,  ['نوع الذاكرة', 'memory type', 'ram']);
  if (ramType && mbRam && /ddr[45]/i.test(ramType) && /ddr[45]/i.test(mbRam) &&
      ramType.match(/ddr[45]/i)?.[0].toLowerCase() !== mbRam.match(/ddr[45]/i)?.[0].toLowerCase())
    reasons.push(`نوع الذاكرة ${ramType} لا يطابق ${mbRam}.`);

  if (reasons.length) return [reasons.join(' '), 'bad'];

  // If some pairing parts exist but missing counterpart — inconclusive
  if ((cpu && !mb) || (mb && !cpu) || (ram && !mb))
    return ['التوافق يحتاج مراجعة فنية: بعض مواصفات القطع المقابلة غير كافية للحكم.', ''];

  if (selected.length >= 2)
    return ['المواصفات المنشورة لا تظهر تعارضاً معروفاً؛ راجع الأبعاد والطاقة قبل الشراء.', 'ok'];

  return ['اختر القطع لفحص التوافق.', ''];
}

function updateBuilder() {
  const selected = selectedBuilderProducts();
  const total = selected.reduce((sum, p) => sum + Number(p.price || 0), 0);
  $('builderTotal').textContent = formatPrice(total);
  $('builderStatus').textContent = `${selected.length} قطع`;
  const [msg, tone] = compatibilityStatus(selected);
  $('compatibilityBox').className = `compatibility-box ${tone}`;
  $('compatibilityBox').innerHTML = `<i class="fa-solid ${tone === 'bad' ? 'fa-circle-xmark' : tone === 'ok' ? 'fa-circle-check' : 'fa-circle-info'}"></i><span>${esc(msg)}</span>`;
  $('addBuilderToCartBtn').disabled = !selected.length;
  $('quoteBuilderBtn').disabled = !selected.length;
}

function quoteLines(products) {
  return products.map((p) => `<div class="quote-line"><img src="${esc(imageFor(p))}" alt=""><div>${esc(p.name)}<strong>${formatPrice(p.price)}</strong></div></div>`).join('');
}

function openQuote(products = selectedBuilderProducts()) {
  if (!products.length) return;
  const total = products.reduce((sum, p) => sum + Number(p.price || 0), 0);
  $('quoteSummary').innerHTML = `${quoteLines(products)}<div class="quote-total"><span>الإجمالي</span><span>${formatPrice(total)}</span></div>`;
  $('quoteModal').dataset.text = products.map((p) => `${p.name}: ${formatPrice(p.price)}`).join('\n') + `\nالإجمالي: ${formatPrice(total)}`;
  modal('quoteModal', true);
}

// ===== UPGRADE =====
function renderUpgrade() {
  const fields = [
    { id: 'cpu',       label: 'المعالج الحالي',      match: /cpu|cpus|معالج/i },
    { id: 'motherboard',label: 'اللوحة الأم الحالية', match: /motherboard|لوحة|مذربورد/i },
    { id: 'ram',       label: 'الرام الحالية',        match: /ram|ذاكرة|رام/i },
    { id: 'gpu',       label: 'كرت الشاشة الحالي',   match: /gpu|كرت|كروت/i },
    { id: 'storage',   label: 'التخزين الحالي',       match: /storage|هارد|ssd|hdd/i }
  ];
  $('upgradeForm').innerHTML = fields.map((field) => {
    const options = state.products.filter((p) => field.match.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name}`));
    return `<label class="upgrade-field">${field.label}<select data-upgrade="${field.id}"><option value="">غير معروف</option>${options.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>`;
  }).join('');
  $('upgradeForm').querySelectorAll('[data-upgrade]').forEach((sel) => sel.addEventListener('change', renderUpgradeResults));
}

function renderUpgradeResults() {
  const selected = [...$('upgradeForm').querySelectorAll('select')].map((sel) => state.products.find((p) => p.id === sel.value)).filter(Boolean);
  if (!selected.length) { $('upgradeResults').innerHTML = '<div class="empty-state">اختر مواصفة واحدة على الأقل لبدء الاقتراح.</div>'; return; }
  const usedIds = new Set(selected.map((p) => p.id));
  const recs = state.products.filter((p) => !usedIds.has(p.id) && isAvailable(p)).filter((p) => /gpu|gpus|كرت|ram|ذاكرة|storage|تخزين|ssd|hdd|cpu|cpus|معالج/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name}`)).slice(0, 4);
  $('upgradeResults').innerHTML = `<p class="upgrade-note">الاقتراحات مبنية على القسم والمواصفات المتاحة فقط؛ لا ندّعي التوافق الكامل عند نقص بيانات جهازك.</p>${recs.length ? recs.map(productCard).join('') : '<div class="empty-state">لا توجد ترقية منشورة مطابقة حالياً.</div>'}`;
  bindProductActions($('upgradeResults'));
}

// ===== CART =====
function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    state.cart = Array.isArray(saved)
      ? saved.filter((i) => i?.id && Number(i.qty) > 0).map((i) => ({ id: String(i.id), qty: Math.min(100, Math.floor(Number(i.qty))) }))
      : [];
  } catch { state.cart = []; }
}
function saveCart() { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart)); }
function cartProduct(item) { return state.products.find((p) => p.id === item.id); }

function addToCart(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  if (!isAvailable(product)) { openAvailability(productId); return; }
  const item = state.cart.find((e) => e.id === productId);
  if (item) item.qty = Math.min(100, item.qty + 1);
  else state.cart.push({ id: productId, qty: 1 });
  renderCart();
  openCart();
  showToast('تمت إضافة المنتج إلى السلة');
}
window.addToCart = addToCart;

function renderCart() {
  saveCart();
  const count = state.cart.reduce((sum, i) => sum + i.qty, 0);
  $('cartBadge').textContent = count;
  $('floatingCartBadge').textContent = count;
  let total = 0;
  const rows = state.cart.map((item, idx) => {
    const p = cartProduct(item);
    if (!p) return '';
    total += Number(p.price || 0) * item.qty;
    return `<div class="cart-item"><img src="${esc(imageFor(p))}" alt="${esc(p.name)}"><div>
      <div class="cart-item-title">${esc(p.name)}</div>
      <div class="cart-item-price">${formatPrice(Number(p.price || 0) * item.qty)}</div>
      <div class="cart-item-actions">
        <button class="qty-btn" type="button" data-qty="${idx}:1">+</button>
        <span>${item.qty}</span>
        <button class="qty-btn" type="button" data-qty="${idx}:-1">−</button>
        <button class="remove-btn" type="button" data-remove="${idx}"><i class="fa-solid fa-trash"></i></button>
      </div></div></div>`;
  }).filter(Boolean);
  $('cartItemsList').innerHTML = rows.length ? rows.join('') : '<div class="empty-state">السلة فارغة</div>';
  $('cartTotalValue').textContent = formatPrice(total);
  $('checkoutBtn').disabled = !rows.length;
  $('cartItemsList').querySelectorAll('[data-qty]').forEach((btn) => btn.addEventListener('click', () => {
    const [idx, delta] = btn.dataset.qty.split(':').map(Number);
    state.cart[idx].qty += delta;
    if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
    renderCart();
  }));
  $('cartItemsList').querySelectorAll('[data-remove]').forEach((btn) => btn.addEventListener('click', () => {
    state.cart.splice(Number(btn.dataset.remove), 1);
    renderCart();
  }));
}

function openCart() { $('cartSidebar').classList.add('open'); $('cartOverlay').classList.add('open'); }
function closeCart() { $('cartSidebar').classList.remove('open'); $('cartOverlay').classList.remove('open'); }

// ===== Product Details Modal =====
function openProductDetails(id) {
  const p = state.products.find((item) => item.id === id);
  if (!p) return;
  const specs = Object.entries(p.specifications || {});
  $('modalProductTitle').textContent = p.name;
  $('productDetailsBody').innerHTML = `<div class="product-detail">
    <img src="${esc(imageFor(p))}" alt="${esc(p.name)}">
    <div>
      <h3>${esc(p.name)}</h3>
      <div class="detail-meta">${esc(p.brand || '')} ${p.model ? `· ${esc(p.model)}` : ''}</div>
      <div class="detail-price">${formatPrice(p.price)}</div>
      ${availabilityMarkup(p)}
      <p class="detail-meta">${esc(p.description || 'لا يوجد وصف إضافي منشور.')}</p>
      <div class="spec-list">${specs.length ? specs.map(([k, v]) => `<div><strong>${esc(k)}</strong><span>${esc(v)}</span></div>`).join('') : '<div>لا توجد مواصفات إضافية منشورة</div>'}</div>
      <div class="detail-actions">
        ${isAvailable(p)
          ? `<button class="btn btn-primary" type="button" data-detail-add="${esc(p.id)}">أضف للسلة</button>`
          : `<button class="btn stock-btn" type="button" data-alert="${esc(p.id)}">نبّهني عند التوفر</button>`}
        <button class="btn btn-outline" type="button" data-favorite="${esc(p.id)}">${state.favorites.includes(p.id) ? 'إزالة من المفضلة' : 'أضف للمفضلة'}</button>
      </div>
    </div>
  </div>`;
  $('productDetailsBody').querySelector('[data-detail-add]')?.addEventListener('click', () => { addToCart(id); modal('productDetailsModal', false); });
  $('productDetailsBody').querySelector('[data-alert]')?.addEventListener('click', () => openAvailability(id));
  $('productDetailsBody').querySelector('[data-favorite]')?.addEventListener('click', () => { toggleFavorite(id); openProductDetails(id); });
  modal('productDetailsModal', true);
}
window.openProductDetails = openProductDetails;

function openAvailability(id) {
  const p = state.products.find((item) => item.id === id);
  if (!p) return;
  state.availabilityProductId = id;
  $('availabilityProductName').textContent = `المنتج: ${p.name}`;
  $('availabilityContact').value = '';
  modal('availabilityModal', true);
}

// ===== Favorites =====
function updateFavoriteBadge() {
  const badge = $('favBadge');
  if (!badge) return;
  badge.textContent = state.favorites.length;
  badge.classList.toggle('hidden', !state.favorites.length);
}

function toggleFavorite(id) {
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((i) => i !== id)
    : [...state.favorites, id];
  localStorage.setItem(authUser ? `${FAVORITES_KEY}.${authUser.uid}` : `${FAVORITES_KEY}.guest`, JSON.stringify(state.favorites));
  updateFavoriteBadge();
  renderProducts();
  renderAccount();
  showToast(state.favorites.includes(id) ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة');
}

function loadFavorites() {
  try { state.favorites = JSON.parse(localStorage.getItem(authUser ? `${FAVORITES_KEY}.${authUser.uid}` : `${FAVORITES_KEY}.guest`) || '[]'); }
  catch { state.favorites = []; }
}

function renderAccount() {
  const box = $('accountState');
  if (authUser) {
    box.innerHTML = `<div class="favorite-row"><img src="${esc(authUser.photoURL || 'assets/spider-bot.png')}" alt=""><div>${esc(authUser.displayName || authUser.email || 'حساب Google')}<small>${esc(authUser.email || '')}</small></div><button class="btn btn-outline" id="logoutBtn" type="button">خروج</button></div>`;
    $('logoutBtn').addEventListener('click', () => signOut(auth));
  } else {
    box.innerHTML = '<p>سجّل دخولك لحفظ المفضلة على هذا الجهاز باسم حسابك.</p><button class="btn btn-google" id="googleSignInBtn" type="button"><i class="fa-brands fa-google"></i> متابعة عبر Google</button><button class="btn btn-outline" id="phoneSignInBtn" type="button">متابعة برقم الهاتف OTP</button><small>تسجيل الهاتف يحتاج تفعيل Phone Auth وreCAPTCHA في Firebase؛ لن نستخدم رمزاً وهمياً.</small>';
    $('googleSignInBtn').addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (e) { showToast(`تعذر تسجيل Google: ${e.code || 'AUTH_ERROR'}`); } });
    $('phoneSignInBtn').addEventListener('click', () => showToast('تسجيل الهاتف يحتاج تفعيل Phone Auth وreCAPTCHA في Firebase.'));
  }
  const favs = state.products.filter((p) => state.favorites.includes(p.id));
  $('favoritesList').innerHTML = `<h3>المفضلة (${favs.length})</h3>${favs.length ? favs.map((p) => `<div class="favorite-row"><img src="${esc(imageFor(p))}" alt=""><div>${esc(p.name)}<strong>${formatPrice(p.price)}</strong></div><button class="btn btn-outline" type="button" data-favorite-open="${esc(p.id)}">فتح</button></div>`).join('') : '<div class="empty-state">لم تضف منتجات إلى المفضلة بعد.</div>'}`;
  $('favoritesList').querySelectorAll('[data-favorite-open]').forEach((btn) => btn.addEventListener('click', () => { modal('accountModal', false); openProductDetails(btn.dataset.favoriteOpen); }));
}

// ===== Chatbot =====
function openChat() { $('chatbotContainer').classList.remove('hidden'); }
function closeChat() { $('chatbotContainer').classList.add('hidden'); }

function appendChat(text, user = false, products = []) {
  const msg = document.createElement('div');
  msg.className = `message ${user ? 'user-message' : 'bot-message'}`;
  msg.textContent = text;
  products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'chat-product';
    card.innerHTML = `<img src="${esc(imageFor(p))}" alt=""><div><strong>${esc(p.name)}</strong><span>${formatPrice(p.price)}</span></div>`;
    card.addEventListener('click', () => openProductDetails(p.id));
    msg.append(card);
  });
  $('chatMessages').append(msg);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

function respondChat(text) {
  const query = text.toLowerCase();
  const published = state.products.filter((p) => p.status === 'published');
  let matches = [];
  let reply = 'أكدر أساعدك من المنتجات المنشورة فقط. جرّب اسم منتج أو اختر سؤالاً جاهزاً.';
  if (/لابتوب|laptop/.test(query)) { matches = published.filter((p) => /لابتوب|laptop/i.test(productText(p))).slice(0, 3); reply = matches.length ? 'هذه لابتوبات منشورة حالياً:' : 'لا توجد لابتوبات منشورة مطابقة حالياً.'; }
  else if (/ميزان|budget|سعر|بشكد/.test(query)) { matches = published.filter(isAvailable).sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 3); reply = 'هذه خيارات متوفرة مرتبة من الأقل سعراً:'; }
  else if (/حاسبة|تجميع|ألعاب|gaming/.test(query)) { document.querySelector('#pcBuilderSection').scrollIntoView({ behavior: 'smooth' }); reply = 'فتحت لك ابنِ حاسبتك. القطع الظاهرة هي المنتجات المنشورة فقط.'; }
  else if (/طوّر|ترقية|upgrade/.test(query)) { document.querySelector('#upgradeSection').scrollIntoView({ behavior: 'smooth' }); reply = 'فتحت لك طوّر حاسبتك حتى تدخل مواصفات جهازك الحالي.'; }
  else if (/قارن|مقارنة/.test(query)) { document.querySelector('#compareSection').scrollIntoView({ behavior: 'smooth' }); reply = 'فتحت قسم المقارنة. اختر منتجين من نفس القسم.'; }
  else { matches = published.filter((p) => productText(p).includes(query)).slice(0, 3); if (matches.length) reply = 'وجدت هذه المنتجات المنشورة:'; }
  setTimeout(() => appendChat(reply, false, matches), 250);
}

function handleChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  appendChat(text, true);
  input.value = '';
  respondChat(text);
}

// ===== Checkout =====
function openCheckout() {
  const total = state.cart.reduce((sum, item) => { const p = cartProduct(item); return sum + (p ? Number(p.price || 0) * item.qty : 0); }, 0);
  $('checkoutSubtotal').textContent = formatPrice(total);
  $('checkoutDeliveryFee').textContent = formatPrice(deliveryFee);
  $('checkoutTotal').textContent = formatPrice(total + deliveryFee);
  closeCart();
  modal('checkoutModal', true);
}

function requestId() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function checkoutPayload(form) {
  const data = new FormData(form);
  const items = state.cart.map((i) => ({ id: String(i.id), qty: Number(i.qty) })).filter((i) => i.id && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 100);
  if (!items.length || items.length !== state.cart.length) throw new Error('CART_INVALID');
  return { requestId: requestId(), items, customer: { name: String(data.get('customerName') || '').trim(), phone: String(data.get('customerPhone') || '').trim(), gov: String(data.get('governorate') || '').trim(), city: String(data.get('city') || '').trim(), address: String(data.get('address') || '').trim(), notes: String(data.get('notes') || '').trim() } };
}

async function submitCheckout(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  const label = submit.textContent;
  try {
    const payload = checkoutPayload(event.currentTarget);
    submit.disabled = true; submit.textContent = 'جارٍ التحقق والحفظ...';
    const response = await fetch(`${BACKEND_URL}/api/store/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': payload.requestId }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'CHECKOUT_FAILED');
    const lines = (result.items || []).map((i) => `- ${i.name} × ${i.quantity}: ${formatPrice(i.price * i.quantity)}`).join('\n');
    const message = [`طلب سبايدر رقم ${result.orderNumber}`, lines, `المجموع: ${formatPrice(result.subtotal)}`, `التوصيل: ${formatPrice(result.deliveryFee)}`, `الإجمالي: ${formatPrice(result.grandTotal)}`, `الاسم: ${payload.customer.name}`, `الهاتف: ${payload.customer.phone}`, `العنوان: ${payload.customer.gov} - ${payload.customer.city} - ${payload.customer.address}`].join('\n');
    state.cart = []; renderCart(); modal('checkoutModal', false);
    const wa = normalizeWhatsApp(state.settings.whatsappNumber || state.settings.whatsapp || '9647827337942');
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    showToast(`تم حفظ الطلب رقم ${result.orderNumber}. أرسل الرسالة من واتساب.`);
  } catch (e) {
    const code = e.message;
    showToast(code === 'ORDER_BACKEND_NOT_CONFIGURED' ? 'إتمام الطلب متوقف: يحتاج Worker إلى سر Firebase قبل الحفظ.' : code === 'DELIVERY_FEE_NOT_CONFIGURED' ? 'اعتمد رسم التوصيل من الأدمن أولاً.' : 'تعذر حفظ الطلب؛ بقيت السلة كما هي.');
  } finally { submit.disabled = false; submit.textContent = label; }
}

// ===== Sidebar Close =====
function closeSidebar() { $('sidebarMenu').classList.remove('open'); $('sidebarOverlay').classList.remove('open'); }

// ===== Bind All Events =====
function bindEvents() {
  // Categories are always visible — no toggle needed
  const catToggleBtn = $('viewAllCatBtn');
  if (catToggleBtn) catToggleBtn.addEventListener('click', () => { state.showCategories = !state.showCategories; renderCategories(); });
  $('viewAllProdBtn').addEventListener('click', clearFilters);
  $('clearBrandBtn').addEventListener('click', clearFilters);
  $('searchInput').addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    state.filters.category = '';
    state.filters.brand = '';
    renderSuggestions(e.target.value);
    renderProducts();
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) $('searchSuggestions').classList.add('hidden'); });

  $('compareCategorySelect').addEventListener('change', populateCompareProducts);
  $('compareBrandSelect').addEventListener('change', populateCompareProducts);
  ['compareProd1Select', 'compareProd2Select'].forEach((id, index) => {
    $(id).addEventListener('change', () => {
      const otherId = index === 0 ? 'compareProd2Select' : 'compareProd1Select';
      if ($(id).value && $(id).value === $(otherId).value) {
        $(id).value = '';
        showToast('لا يمكن اختيار المنتج نفسه في المقارنة مرتين.');
      }
      updateCompareView();
    });
  });
  $('clearCompareBtn').addEventListener('click', () => {
    state.compare = ['', ''];
    $('compareCategorySelect').value = '';
    $('compareBrandSelect').value = '';
    populateCompareFilters();
  });
  $('compareNowBtn').addEventListener('click', updateCompareView);

  $('heroBuilderBtn').addEventListener('click', () => $('pcBuilderSection').scrollIntoView({ behavior: 'smooth' }));

  $('floatingCartBtn').addEventListener('click', openCart);
  $('openCartBtn').addEventListener('click', openCart);
  $('closeCartBtn').addEventListener('click', closeCart);
  $('cartOverlay').addEventListener('click', closeCart);
  $('checkoutBtn').addEventListener('click', openCheckout);
  $('closeCheckoutBtn').addEventListener('click', () => modal('checkoutModal', false));
  $('checkoutForm').addEventListener('submit', submitCheckout);

  $('closeProductDetailsBtn').addEventListener('click', () => modal('productDetailsModal', false));
  $('closeQuoteBtn').addEventListener('click', () => modal('quoteModal', false));
  $('closeAccountBtn').addEventListener('click', () => modal('accountModal', false));
  $('closeAvailabilityBtn').addEventListener('click', () => modal('availabilityModal', false));

  $('availabilityForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const alerts = JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
    alerts.push({ productId: state.availabilityProductId, contact: $('availabilityContact').value.trim(), createdAt: Date.now() });
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    modal('availabilityModal', false);
    showToast('تم حفظ طلب التنبيه على جهازك. الإرسال يحتاج خدمة مفعّلة.');
  });

  $('mobileMenuBtn').addEventListener('click', () => { $('sidebarMenu').classList.add('open'); $('sidebarOverlay').classList.add('open'); });
  $('closeSidebarBtn').addEventListener('click', closeSidebar);
  $('sidebarOverlay').addEventListener('click', closeSidebar);

  $('accountBtn').addEventListener('click', () => { renderAccount(); modal('accountModal', true); });
  $('favBtn').addEventListener('click', () => { renderAccount(); modal('accountModal', true); });

  $('chatbotFab').addEventListener('click', openChat);
  $('closeChatBtn').addEventListener('click', closeChat);
  $('sendChatBtn').addEventListener('click', handleChat);
  $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleChat(); });
  $('chatQuickReplies').querySelectorAll('[data-chat]').forEach((btn) => btn.addEventListener('click', () => { $('chatInput').value = btn.dataset.chat; handleChat(); }));

  $('addBuilderToCartBtn').addEventListener('click', () => { selectedBuilderProducts().forEach((p) => addToCart(p.id)); showToast('تمت إضافة القطع المنشورة إلى السلة.'); });
  $('quoteBuilderBtn').addEventListener('click', () => openQuote());
  $('copyQuoteBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('quoteModal').dataset.text || ''); showToast('تم نسخ عرض السعر.'); } catch { showToast('تعذر النسخ؛ استخدم المشاركة عبر واتساب.'); } });
  $('shareQuoteBtn').addEventListener('click', () => { const wa = normalizeWhatsApp(state.settings.whatsappNumber || state.settings.whatsapp || '9647827337942'); if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent($('quoteModal').dataset.text || '')}`, '_blank', 'noopener'); });

  $('toggleBrandsBtn').addEventListener('click', () => { state.showBrands = !state.showBrands; renderBrands(); });

  // viewFullBuildBtn — scroll to builder
  const vfbBtn = $('viewFullBuildBtn');
  if (vfbBtn) vfbBtn.addEventListener('click', () => $('pcBuilderSection').scrollIntoView({ behavior: 'smooth' }));

  renderSidebarAll();
}

// ===== Firebase Listeners =====
onValue(ref(db, 'categories'), (snapshot) => {
  state.categories = [];
  if (snapshot.exists()) snapshot.forEach((child) => {
    const cat = { id: child.key, ...child.val() };
    if (!cat.isHidden && !/^[-_]?test/i.test(`${cat.id} ${cat.name || ''}`)) state.categories.push(cat);
  });
  renderCategories();
  renderBuilder();
  renderUpgrade();
  populateCompareFilters();
});

onValue(ref(db, 'products'), (snapshot) => {
  state.products = [];
  if (snapshot.exists()) snapshot.forEach((child) => {
    const p = { id: child.key, ...child.val() };
    if (p.status === 'published' && !p.isHidden) state.products.push(p);
  });
  renderProducts();
  renderBrands();
  renderBuilder();
  renderUpgrade();
  populateCompareFilters();
  renderCart();
  renderAccount();
});

onValue(ref(db, 'settings'), (snapshot) => {
  applySettings(snapshot.exists() ? snapshot.val() : {});
  renderCart();
});

onAuthStateChanged(auth, (user) => {
  authUser = user;
  loadFavorites();
  updateFavoriteBadge();
  renderProducts();
  renderAccount();
});

// ===== Init =====
readCart();
loadFavorites();
bindEvents();
updateFavoriteBadge();
renderCart();
renderAccount();
