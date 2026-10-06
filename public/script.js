import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { CATALOG_TRANSLATIONS } from './catalog-translations.js';
import { generateOrderReceiptPdf } from './pdf-receipt.js?v=20261003-3';

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
let pendingReceipt = null;

const state = {
  products: [],
  productsLoaded: false,
  categories: [],
  categoryLoad: 'loading',
  cart: [],
  favorites: [],
  settings: {},
  brandLogos: {},
  builderDiscounts: {},
  filters: { category: '', brand: '', search: '' },
  showCategories: false,
  showBrands: true,
  compare: ['', ''],
  comparePickerSlot: 0,
  builder: {},
  builderPriceVisible: false,
  upgrade: {}, upgradeIsNew: {},
  builderCatalog: { part: '', category: '', brand: '', search: '' },
  upgradeCatalog: { category: '', brand: '', search: '' },
  availabilityProductId: '',
  accountProfile: null,
  accountMode: 'account',
  privatePrices: {},
  accountOrders: []
};

function normalizeAccountProfile(user, profile = {}) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const fullName = String(source.name || user?.displayName || '').trim();
  const firstName = String(source.firstName || fullName.split(/\s+/)[0] || '').trim();
  const lastName = String(source.lastName || (fullName.split(/\s+/).slice(1).join(' ')) || '').trim();
  return { ...source, uid: user?.uid || source.uid || '', firstName, lastName, name: String(source.name || [firstName, lastName].filter(Boolean).join(' ')).trim(), email: source.email || user?.email || '', phone: source.phone || user?.phoneNumber || '' };
}

function updateAccountGreeting() {
  const greeting = $('accountGreeting');
  if (!greeting) return;
  const firstName = String(state.accountProfile?.firstName || '').trim();
  greeting.hidden = !authUser || !firstName;
  greeting.textContent = firstName ? `${language === 'en' ? 'Hello,' : 'مرحباً،'} ${firstName}` : '';
}

async function loadAccountProfile(user) {
  if (!user) { state.accountProfile = null; state.accountOrders = []; return; }
  const profileSnapshot = await get(ref(db, `profiles/${user.uid}`));
  state.accountProfile = normalizeAccountProfile(user, profileSnapshot.exists() ? profileSnapshot.val() : {});
  state.accountOrders = [];
  try {
    const ordersSnapshot = await get(ref(db, 'orders'));
    const orders = [];
    if (ordersSnapshot.exists()) ordersSnapshot.forEach((child) => {
      const order = child.val() || {};
      if (order.uid === user.uid || order.userId === user.uid || order.customerUid === user.uid || order.customer?.uid === user.uid) orders.push({ id: child.key, ...order });
    });
    state.accountOrders = orders.sort((a, b) => Number(b.createdAt || b.timestamp || 0) - Number(a.createdAt || a.timestamp || 0)).slice(0, 20);
  } catch (error) { console.error('Account orders load skipped', { code: error?.code || 'ORDERS_READ_UNAVAILABLE' }); }
}

const LANGUAGE_STORAGE_KEY = 'spider.language.v1';
const THEME_STORAGE_KEY = 'spider.theme.v1';
const I18N = {
  ar: {
    languageButton: 'EN', themeLight: 'الوضع النهاري', themeDark: 'الوضع الليلي',
    electronicsWorld: 'عالم الإلكترونيات بين إيديك', store: 'سبايدر للإلكترونيات', electronics: 'للإلكترونيات',
    originalPerformance: 'أجهزة أصلية .. أداء أعلى .. تجربة أفضل', buildNow: 'ابنِ تجميعتك الآن',
    searchPlaceholder: 'ابحث عن منتج، شركة أو موديل ...', browseSections: 'تصفح الأقسام', allProducts: 'جميع المنتجات',
    latestProducts: 'أحدث المنتجات', productResults: 'نتائج المنتجات', showAll: 'عرض الكل', brands: 'العلامات التجارية', searchFilter: 'بحث', brandFilter: 'علامة تجارية', categoryFilter: 'قسم',
    show: 'إظهار', hide: 'إخفاء', clearFilter: 'إلغاء الفلتر', compare: 'مقارنة المنتجات', clearCompare: 'مسح المقارنة',
    category: 'القسم', brand: 'العلامة التجارية', allCategories: 'كل الأقسام', allBrands: 'كل العلامات', firstProduct: 'المنتج الأول', secondProduct: 'المنتج الثاني', chooseProduct: 'اختر منتجاً', compareNow: 'قارن الآن',
    upgrade: 'طوّر حاسبتك', chooseSpec: 'اختر مواصفة واحدة على الأقل لبدء الاقتراح.',
    footerPride: 'نعتز بثقتكم', whatsapp: 'واتساب', instagram: 'إنستغرام', map: 'الموقع الجغرافي', facebook: 'فيسبوك',
    cart: 'سلة المشتريات', emptyCart: 'السلة فارغة', total: 'المجموع الكلي', checkout: 'إتمام الطلب', clearCart: 'مسح جميع محتويات السلة', clearCartTitle: 'مسح السلة', clearCartMessage: 'هل تريد مسح جميع المنتجات من السلة؟', cancel: 'إلغاء', close: 'إغلاق',
    checkoutTitle: 'إتمام الطلب', fullName: 'الاسم الكامل', phone: 'رقم الهاتف (07XXXXXXXXX)', chooseGovernorate: 'اختر المحافظة...', city: 'المدينة / المنطقة', address: 'العنوان التفصيلي', notes: 'ملاحظات إضافية (اختياري)', confirmOrder: 'تأكيد وحفظ الطلب ثم فتح واتساب', orderNote: 'لن تُفرغ السلة إذا فشل التحقق أو حفظ الطلب.',
    details: 'التفاصيل', addToCart: 'أضف للسلة', notify: 'نبّهني عند التوفر', available: 'متوفر', limited: 'كمية محدودة', unavailable: 'غير متوفر', builderOnlyLabel: 'يباع مع التجميعة فقط', builderOnlyMessage: 'هذا المنتج يباع مع التجميعة فقط',
    account: 'حسابي والمفضلة', loginHint: 'سجّل دخولك لحفظ المفضلة على هذا الجهاز باسم حسابك.', google: 'متابعة عبر Google', phoneOtp: 'تسجيل الدخول برقم الهاتف',
    favorites: 'المفضلة', open: 'فتح', noFavorites: 'لم تضف منتجات إلى المفضلة بعد.', logout: 'خروج',
    builderTitle: 'ابنِ تجميعتك', builderIntro: 'اختر القطع المنشورة فعلياً، وشاهد الإجمالي وفحص التوافق قبل إضافة التجميعة إلى السلة.', parts: 'قطع التجميعة', savedBuild: 'اختياراتك محفوظة عند الرجوع إلى المتجر.', buildTotal: 'إجمالي التجميعة', addBuild: 'أضف التجميعة إلى السلة', quote: 'اطلب عرض سعر', backStore: 'العودة إلى المتجر',
    choosePart: 'اختر القطعة', searchPart: 'ابحث بالاسم أو الموديل', quoteTitle: 'عرض سعر للتجميعة', copyQuote: 'نسخ العرض', shareWhatsApp: 'مشاركة عبر واتساب', quoteNote: 'هذا عرض سعر قابل للتغير، وليس طلب شراء مؤكداً.',
    compatibility: 'اختر القطع لفحص التوافق.', noPublished: 'لا توجد منتجات منشورة مطابقة.', noDescription: 'لا يوجد وصف إضافي منشور.',
    chatbot: 'مساعد SPIDER', chatPlaceholder: 'اكتب سؤالك...', chatbotWelcome: 'هلا بيك بـ SPIDER! اختار سؤالاً حتى أساعدك من المنتجات المنشورة.',
    noSections: 'لا توجد أقسام منشورة حالياً.', noProducts: 'لا توجد منتجات منشورة مطابقة للبحث أو الفلتر.', noBrands: 'لا توجد علامات في المنتجات المنشورة.', noResults: 'لا توجد نتائج منشورة', tryAnother: 'جرّب اسم شركة أو موديل آخر',
    selectedParts: 'قطع', unknown: 'غير معروف', change: 'تغيير', remove: 'إزالة', clear: 'مسح', chooseProductNumber: 'اختر المنتج', comparisonSameCategory: 'اختر منتجين من نفس القسم لإظهار مقارنة عادلة.', noSpecs: 'لا توجد مواصفات منشورة للمقارنة.', notAvailable: 'غير متوفر', showBrands: 'اضغط لإظهار العلامات التجارية', hideBrands: 'اضغط لإخفاء العلامات التجارية',
    builderCatalogTitle: 'منتجات التجميعة', builderSearch: 'ابحث بالاسم أو الموديل', builderCategory: 'القسم', builderBrand: 'العلامة التجارية', chooseForBuild: 'اختيار لهذه التجميعة', selectedForBuild: 'مختارة', allParts: 'كل القطع', builderSummary: 'ملخص التجميعة', builderHint: 'أجزاؤك المختارة', productCount: 'منتجات', notificationsSaved: 'تم حفظ طلب التنبيه على جهازك. الإرسال يحتاج خدمة مفعّلة.', added: 'تمت إضافة المنتج إلى السلة', buildAdded: 'تمت إضافة القطع المنشورة إلى السلة.', sameProduct: 'لا يمكن اختيار المنتج نفسه في المقارنة مرتين.'
  },
  en: {
    languageButton: 'AR', themeLight: 'Light mode', themeDark: 'Dark mode',
    electronicsWorld: 'The world of electronics in your hands', store: 'Spider Electronics', electronics: 'Electronics',
    originalPerformance: 'Original devices .. Higher performance .. Better experience', buildNow: 'Build your PC now',
    searchPlaceholder: 'Search by product, brand or model ...', browseSections: 'Browse categories', allProducts: 'All products',
    latestProducts: 'Latest products', productResults: 'Product results', showAll: 'View all', brands: 'Brands', searchFilter: 'Search', brandFilter: 'Brand', categoryFilter: 'Category', show: 'Show', hide: 'Hide', clearFilter: 'Clear filter',
    compare: 'Compare products', clearCompare: 'Clear comparison', category: 'Category', brand: 'Brand', allCategories: 'All categories', allBrands: 'All brands', firstProduct: 'First product', secondProduct: 'Second product', chooseProduct: 'Choose a product', compareNow: 'Compare now',
    upgrade: 'Upgrade your PC', chooseSpec: 'Choose at least one specification to start suggestions.', footerPride: 'We value your trust', whatsapp: 'WhatsApp', instagram: 'Instagram', map: 'Location', facebook: 'Facebook',
    cart: 'Shopping cart', emptyCart: 'Your cart is empty', total: 'Total', checkout: 'Checkout', clearCart: 'Clear Cart', clearCartTitle: 'Clear Cart', clearCartMessage: 'Do you want to clear all products from the cart?', cancel: 'Cancel', close: 'Close', checkoutTitle: 'Checkout', fullName: 'Full name', phone: 'Phone number (07XXXXXXXXX)', chooseGovernorate: 'Choose governorate...', city: 'City / area', address: 'Detailed address', notes: 'Additional notes (optional)', confirmOrder: 'Confirm order, save, then open WhatsApp', orderNote: 'Your cart will stay intact if validation or saving fails.',
    details: 'Details', addToCart: 'Add to cart', notify: 'Notify me when available', available: 'Available', limited: 'Limited quantity', unavailable: 'Unavailable', builderOnlyLabel: 'Available with a PC build only', builderOnlyMessage: 'This product is available only with a PC build', account: 'Account & favorites', loginHint: 'Sign in to save favorites on this device.', google: 'Continue with Google', phoneOtp: 'Sign in with phone number', favorites: 'Favorites', open: 'Open', noFavorites: 'You have not added any favorites yet.', logout: 'Sign out',
    builderTitle: 'Build your PC', builderIntro: 'Choose published parts, see the total and compatibility check before adding the build to your cart.', parts: 'Build parts', savedBuild: 'Your choices are saved when you return to the store.', buildTotal: 'Build total', addBuild: 'Add build to cart', quote: 'Request a quote', backStore: 'Back to store', choosePart: 'Choose a part', searchPart: 'Search by name or model', quoteTitle: 'Build quote', copyQuote: 'Copy quote', shareWhatsApp: 'Share via WhatsApp', quoteNote: 'This quote may change and is not a confirmed purchase.', compatibility: 'Choose parts to check compatibility.', noPublished: 'No matching published products.', noDescription: 'No additional published description.', chatbot: 'SPIDER assistant', chatPlaceholder: 'Type your question...', chatbotWelcome: 'Welcome to SPIDER! Choose a question and I will help from published products.', noSections: 'No published categories yet.', noProducts: 'No published products match your search or filter.', noBrands: 'No brands found in published products.', noResults: 'No published results', tryAnother: 'Try another brand or model', selectedParts: 'parts', unknown: 'Unknown', change: 'Change', remove: 'Remove', clear: 'Clear', chooseProductNumber: 'Choose product', comparisonSameCategory: 'Choose two products from the same category for a fair comparison.', noSpecs: 'No published specifications for comparison.', notAvailable: 'Not available', showBrands: 'Show brands', hideBrands: 'Hide brands', builderCatalogTitle: 'Build products', builderSearch: 'Search by name or model', builderCategory: 'Category', builderBrand: 'Brand', chooseForBuild: 'Choose for this build', selectedForBuild: 'Selected', allParts: 'All parts', builderSummary: 'Build summary', builderHint: 'Your selected parts', productCount: 'products', notificationsSaved: 'The alert request was saved on this device. Sending needs an enabled service.', added: 'Product added to cart', buildAdded: 'Published parts were added to the cart.', sameProduct: 'The same product cannot be selected twice.'
  }
};

let language = localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'ar';
let theme = localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
const t = (key) => I18N[language][key] || I18N.ar[key] || key;
const previewTranslation = (kind, item) => language === 'en'
  ? (item?.nameEn || item?.nameEnglish || item?.localizedText?.en || CATALOG_TRANSLATIONS[kind]?.[item?.id] || '')
  : (item?.nameAr || item?.localizedText?.ar || item?.name || '');
const productName = (p) => language === 'en' ? (previewTranslation('products', p) || p?.name || '') : (p?.nameAr || p?.localizedText?.ar || p?.name || '');
const categoryLabel = (c) => language === 'en' ? (previewTranslation('categories', c) || c?.name || '') : (c?.nameAr || c?.localizedText?.ar || c?.name || '');
const ATTRIBUTE_TRANSLATIONS = {
  'الأنوية': 'Cores', 'المسارات': 'Threads', 'الاتصال': 'Connectivity', 'التخزين': 'Storage',
  'التردد': 'Refresh Rate', 'معدل التحديث': 'Refresh Rate', 'الحجم': 'Size', 'حجم الشاشة': 'Screen Size', 'الدقة': 'Resolution',
  'الصوت': 'Audio', 'المنافذ': 'Ports', 'زمن الاستجابة': 'Response Time', 'نوع الإضاءة': 'Lighting Type', 'نوع الاضائة': 'Lighting Type', 'نوع الشاشة': 'Panel Type', 'الرام': 'RAM',
  'السرعة': 'Speed', 'السعة': 'Capacity', 'الشاشة': 'Display', 'الصوت المحيطي': 'Surround sound',
  'المعالج': 'Processor', 'المعمارية': 'Architecture', 'النوع': 'Type', 'ذاكرة الرسوميات': 'Graphics memory',
  'كرت الشاشة': 'Graphics card', 'منحنية': 'Curved', 'بوصة': 'inch'
};
const localizedAttribute = (value) => {
  if (typeof value === 'object') return value?.[language] || value?.ar || value?.en || '';
  return language === 'en' ? (ATTRIBUTE_TRANSLATIONS[String(value)] || value) : value;
};
function specificationEntries(product) {
  const source = product?.specifications ?? product?.specs;
  if (Array.isArray(source)) return source.map((item) => ({
    keyAr: String(item?.key_ar ?? item?.keyAr ?? item?.key ?? '').trim(),
    keyEn: String(item?.key_en ?? item?.keyEn ?? item?.key ?? '').trim(),
    valueAr: String(item?.value_ar ?? item?.valueAr ?? item?.value ?? '').trim(),
    valueEn: String(item?.value_en ?? item?.valueEn ?? item?.en ?? item?.value ?? '').trim()
  })).filter((item) => item.keyAr || item.keyEn || item.valueAr || item.valueEn);
  return Object.entries(source && typeof source === 'object' ? source : {}).map(([key, value]) => ({
    keyAr: key,
    keyEn: typeof value === 'object' ? String(value.key_en ?? value.keyEn ?? value.en ?? key) : '',
    valueAr: typeof value === 'object' ? String(value.value_ar ?? value.valueAr ?? value.ar ?? value.value ?? '') : String(value ?? ''),
    valueEn: typeof value === 'object' ? String(value.value_en ?? value.valueEn ?? value.en ?? value.value ?? '') : ''
  }));
}
const localizedSpecification = (item) => language === 'en'
  ? { key: item.keyEn || localizedAttribute(item.keyAr), value: item.valueEn || item.valueAr }
  : { key: item.keyAr || item.keyEn, value: item.valueAr || item.valueEn };
let activeProductDetailsId = null;

const DIRECT_TRANSLATIONS = {
  'عالم الإلكترونيات بين إيديك': ['The world of electronics in your hands', 'عالم الإلكترونيات بين إيديك'], 'أجهزة أصلية .. أداء أعلى .. تجربة أفضل': ['Original devices .. Higher performance .. Better experience', 'أجهزة أصلية .. أداء أعلى .. تجربة أفضل'], 'ابحث عن منتج، شركة أو موديل ...': ['Search by product, brand or model ...', 'ابحث عن منتج، شركة أو موديل ...'], 'ابنِ تجميعتك الآن': ['Build your PC now', 'ابنِ تجميعتك الآن'], 'اختياراتك محفوظة عند الرجوع إلى المتجر.': ['Your choices are saved when you return to the store.', 'اختياراتك محفوظة عند الرجوع إلى المتجر.'], 'اختر القطع لفحص التوافق.': ['Choose parts to check compatibility.', 'اختر القطع لفحص التوافق.'], 'العلامة': ['Brand', 'العلامة'], 'الضمان': ['Warranty', 'الضمان'], 'SPIDER BUILD LAB': ['SPIDER BUILD LAB', 'SPIDER BUILD LAB'], 'اختر القطع المنشورة فعلياً، وشاهد الإجمالي وفحص التوافق قبل إضافة التجميعة إلى السلة.': ['Choose published parts, see the total and compatibility check before adding the build to your cart.', 'اختر القطع المنشورة فعلياً، وشاهد الإجمالي وفحص التوافق قبل إضافة التجميعة إلى السلة.'],
  'سبايدر': ['Spider', 'سبايدر'], 'للإلكترونيات': ['Electronics', 'للإلكترونيات'], 'لوكو سبايدر للإلكترونيات': ['Spider Electronics logo', 'لوكو سبايدر للإلكترونيات'],
  'حسابي': ['Account', 'حسابي'], 'المفضلة': ['Favorites', 'المفضلة'], 'فتح السلة': ['Open cart', 'فتح السلة'], 'فتح قائمة الأقسام': ['Open categories', 'فتح قائمة الأقسام'], 'إغلاق القائمة': ['Close menu', 'إغلاق القائمة'], 'إغلاق السلة': ['Close cart', 'إغلاق السلة'], 'إغلاق': ['Close', 'إغلاق'],
  'أقسام المتجر': ['Store categories', 'أقسام المتجر'], 'جاري تحميل الأقسام...': ['Loading categories...', 'جاري تحميل الأقسام...'], 'انقر لعرض الأقسام': ['Click to show categories', 'انقر لعرض الأقسام'], 'أظهر': ['Show', 'أظهر'],
  'القسم': ['Category', 'القسم'], 'العلامة التجارية': ['Brand', 'العلامة التجارية'], 'المنتج الأول': ['First product', 'المنتج الأول'], 'المنتج الثاني': ['Second product', 'المنتج الثاني'], 'اختر المنتج الأول': ['Choose first product', 'اختر المنتج الأول'], 'اختر المنتج الثاني': ['Choose second product', 'اختر المنتج الثاني'], 'اختر منتجاً': ['Choose a product', 'اختر منتجاً'], 'اختر منتج المقارنة': ['Choose comparison product', 'اختر منتج المقارنة'], 'فلتر القسم': ['Category filter', 'فلتر القسم'], 'فلتر العلامة التجارية': ['Brand filter', 'فلتر العلامة التجارية'], 'ابحث بالاسم أو الموديل': ['Search by name or model', 'ابحث بالاسم أو الموديل'],
  'مقارنة المنتجات': ['Compare products', 'مقارنة المنتجات'], 'مسح المقارنة': ['Clear comparison', 'مسح المقارنة'], 'قارن الآن': ['Compare now', 'قارن الآن'], 'أحدث المنتجات': ['Latest products', 'أحدث المنتجات'], 'عرض الكل': ['View all', 'عرض الكل'], 'العلامات التجارية': ['Brands', 'العلامات التجارية'], 'إظهار': ['Show', 'إظهار'], 'إلغاء الفلتر': ['Clear filter', 'إلغاء الفلتر'], 'طوّر حاسبتك': ['Upgrade your PC', 'طوّر حاسبتك'],
  'تفاصيل المنتج': ['Product details', 'تفاصيل المنتج'], 'عرض سعر للتجميعة': ['Build quote', 'عرض سعر للتجميعة'], 'حسابي والمفضلة': ['Account & favorites', 'حسابي والمفضلة'], 'نبّهني عند التوفر': ['Notify me when available', 'نبّهني عند التوفر'], 'مساعد SPIDER': ['SPIDER assistant', 'مساعد SPIDER'], 'الموقع الجغرافي': ['Location', 'الموقع الجغرافي'], 'نعتز بثقتكم': ['We value your trust', 'نعتز بثقتكم'],
  'السلة فارغة': ['Your cart is empty', 'السلة فارغة'], 'المجموع الكلي': ['Total', 'المجموع الكلي'], 'إتمام الطلب': ['Checkout', 'إتمام الطلب'], 'إتمام الطلب': ['Checkout', 'إتمام الطلب'], 'عرض سعر': ['Quote', 'عرض سعر'], 'نسخ العرض': ['Copy quote', 'نسخ العرض'], 'مشاركة عبر واتساب': ['Share via WhatsApp', 'مشاركة عبر واتساب'], 'فتح': ['Open', 'فتح'], 'خروج': ['Sign out', 'خروج'], 'أضف للسلة': ['Add to cart', 'أضف للسلة'], 'التفاصيل': ['Details', 'التفاصيل'], 'إزالة من المفضلة': ['Remove from favorites', 'إزالة من المفضلة'], 'أضف للمفضلة': ['Add to favorites', 'أضف للمفضلة'], 'حفظ طلب التنبيه': ['Save alert request', 'حفظ طلب التنبيه'],
  'الاسم الكامل': ['Full name', 'الاسم الكامل'], 'رقم الهاتف (07XXXXXXXXX)': ['Phone number (07XXXXXXXXX)', 'رقم الهاتف (07XXXXXXXXX)'], 'اختر المحافظة...': ['Choose governorate...', 'اختر المحافظة...'], 'المدينة / المنطقة': ['City / area', 'المدينة / المنطقة'], 'العنوان التفصيلي': ['Detailed address', 'العنوان التفصيلي'], 'ملاحظات إضافية (اختياري)': ['Additional notes (optional)', 'ملاحظات إضافية (اختياري)'], 'تأكيد وحفظ الطلب ثم فتح واتساب': ['Confirm order, save, then open WhatsApp', 'تأكيد وحفظ الطلب ثم فتح واتساب'], 'لن تُفرغ السلة إذا فشل التحقق أو حفظ الطلب.': ['Your cart will stay intact if validation or saving fails.', 'لن تُفرغ السلة إذا فشل التحقق أو حفظ الطلب.'],
  'ابنِ تجميعتك': ['Build your PC', 'ابنِ تجميعتك'], 'قطع التجميعة': ['Build parts', 'قطع التجميعة'], 'إجمالي التجميعة': ['Build total', 'إجمالي التجميعة'], 'أضف التجميعة إلى السلة': ['Add build to cart', 'أضف التجميعة إلى السلة'], 'اطلب عرض سعر': ['Request a quote', 'اطلب عرض سعر'], 'العودة إلى المتجر': ['Back to store', 'العودة إلى المتجر'], 'اختر قطعة': ['Choose a part', 'اختر قطعة'], 'هذا عرض سعر قابل للتغير، وليس طلب شراء مؤكداً.': ['This quote may change and is not a confirmed purchase.', 'هذا عرض سعر قابل للتغير، وليس طلب شراء مؤكداً.'],
  'هلا بيك بـ SPIDER! اختار سؤالاً حتى أساعدك من المنتجات المنشورة.': ['Welcome to SPIDER! Choose a question and I will help from published products.', 'هلا بيك بـ SPIDER! اختار سؤالاً حتى أساعدك من المنتجات المنشورة.'], 'اكتب سؤالك...': ['Type your question...', 'اكتب سؤالك...'],
  'سبايدر للإلكترونيات': ['Spider Electronics', 'سبايدر للإلكترونيات'], 'تصفح الأقسام': ['Browse categories', 'تصفح الأقسام'], 'قائمة الأقسام': ['Categories menu', 'قائمة الأقسام'], 'اختصارات المتجر': ['Store shortcuts', 'اختصارات المتجر'], 'البحث عن المنتجات': ['Search products', 'البحث عن المنتجات'], 'العودة إلى متجر سبايدر': ['Back to Spider store', 'العودة إلى متجر سبايدر'], 'تجهيز ألعاب وكمبيوتر من سبايدر': ['Gaming and computer setup by Spider', 'تجهيز ألعاب وكمبيوتر من سبايدر'], 'تجميع حاسبة': ['PC build', 'تجميع حاسبة'], 'لوكو سبايدر': ['Spider logo', 'لوكو سبايدر'], 'مساعد سبايدر': ['Spider assistant', 'مساعد سبايدر'], 'فيسبوك': ['Facebook', 'فيسبوك'], 'واتساب': ['WhatsApp', 'واتساب'], 'إنستغرام': ['Instagram', 'إنستغرام'],
  'سلة المشتريات': ['Shopping cart', 'سلة المشتريات'], 'المجموع': ['Subtotal', 'المجموع'], 'التوصيل': ['Delivery', 'التوصيل'], 'الإجمالي': ['Total', 'الإجمالي'],
  'اختر مواصفة واحدة على الأقل لبدء الاقتراح.': ['Choose at least one specification to start suggestions.', 'اختر مواصفة واحدة على الأقل لبدء الاقتراح.'],
  'سيُحفظ الطلب على جهازك فقط ما لم تُفعّل خدمة إرسال من الأدمن.': ['The request is saved on your device unless an admin sending service is enabled.', 'سيُحفظ الطلب على جهازك فقط ما لم تُفعّل خدمة إرسال من الأدمن.'],
  'البحث في منتجات المقارنة': ['Search comparison products', 'البحث في منتجات المقارنة'], 'إرسال': ['Send', 'إرسال'], 'فتح مساعد سبايدر': ['Open Spider assistant', 'فتح مساعد سبايدر'],
  'تبديل اللغة': ['Switch language', 'تبديل اللغة'], 'جميع الأقسام': ['All Categories', 'جميع الأقسام'], 'النجف': ['Najaf', 'النجف'], 'بغداد': ['Baghdad', 'بغداد'], 'كربلاء': ['Karbala', 'كربلاء'], 'بابل': ['Babylon', 'بابل'], 'البصرة': ['Basra', 'البصرة'], 'أربيل': ['Erbil', 'أربيل'], 'أخرى': ['Other', 'أخرى']
};

function localizeDom() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const raw = node.nodeValue.trim();
    const pair = DIRECT_TRANSLATIONS[raw] || Object.values(DIRECT_TRANSLATIONS).find((item) => item.includes(raw));
    if (pair) node.nodeValue = node.nodeValue.replace(raw, language === 'en' ? pair[0] : pair[1]);
  });
  document.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => ['placeholder','aria-label','title'].forEach((attr) => {
    const current = el.getAttribute(attr);
    const pair = DIRECT_TRANSLATIONS[current] || Object.values(DIRECT_TRANSLATIONS).find((item) => item.includes(current));
    if (pair) el.setAttribute(attr, language === 'en' ? pair[0] : pair[1]);
  }));
}

function applyAppearance() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
  document.documentElement.dataset.theme = theme;
  document.documentElement?.setAttribute('data-theme', theme);
  document.body?.setAttribute('data-theme', theme);
  const page = document.body?.dataset.page;
  document.title = language === 'en'
    ? (page === 'builder' ? 'Build your PC | Spider Electronics' : page === 'upgrade' ? 'Upgrade your PC | Spider Electronics' : 'Spider Electronics | Computer & Electronics Store')
    : (page === 'builder' ? 'ابنِ تجميعتك | سبايدر للإلكترونيات' : page === 'upgrade' ? 'طوّر حاسبتك | سبايدر للإلكترونيات' : 'سبايدر للإلكترونيات | متجر الأجهزة والكمبيوتر');
  const themeButton = $('themeToggle');
  const languageButton = $('languageToggle');
  if (themeButton) { themeButton.innerHTML = `<i class="fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`; themeButton.title = theme === 'dark' ? t('themeLight') : t('themeDark'); themeButton.setAttribute('aria-label', themeButton.title); }
  if (languageButton) { languageButton.textContent = t('languageButton'); languageButton.title = language === 'ar' ? 'English' : 'العربية'; }
  localizeBuilderPage();
}

function localizeBuilderPage() {
  const page = document.body?.dataset.page;
  if (page === 'upgrade') {
    const text = { builderPageTitle: t('upgrade'), builderPageIntro: language === 'en' ? 'Enter your current PC specifications and choose suitable parts to upgrade it.' : 'أدخل مواصفات جهازك الحالي ثم اختر القطع المناسبة لترقيته.', upgradeTitle: t('upgrade'), upgradeIntro: language === 'en' ? 'Choose your current specifications, then browse suggested parts to improve performance.' : 'اختر مواصفات جهازك الحالي، ثم تصفح القطع المقترحة لترقية أدائه.', upgradeResultsTitle: language === 'en' ? 'Suggested upgrade parts' : 'القطع المقترحة للترقية', upgradeCatalogCategoryLabel: t('builderCategory'), upgradeCatalogBrandLabel: t('builderBrand') };
    Object.entries(text).forEach(([id, value]) => { const el = $(id); if (el) el.textContent = value; });
    const upgradeSearch = $('upgradeCatalogSearch'); if (upgradeSearch) { upgradeSearch.placeholder = t('builderSearch'); upgradeSearch.setAttribute('aria-label', t('builderSearch')); }
    return;
  }
  if (page !== 'builder') return;
  const text = { builderPageTitle: t('builderTitle'), builderPageIntro: language === 'en' ? 'Build a new PC from scratch, check compatibility, and add it to your cart.' : 'ابنِ حاسبتك الجديدة من الصفر، وافحص التوافق قبل إضافة التجميعة إلى السلة.', builderTitle: t('builderTitle'), builderIntro: language === 'en' ? 'Choose CPU, motherboard, memory and the rest of the parts step by step.' : 'اختر المعالج واللوحة والذاكرة وبقية القطع لبناء حاسبتك خطوة بخطوة.', builderCategoryLabel: t('builderCategory'), builderBrandLabel: t('builderBrand'), builderCatalogTitle: t('builderCatalogTitle'), builderSummaryTitle: t('builderSummary'), builderSummaryHint: t('builderHint') };
  Object.entries(text).forEach(([id, value]) => { const el = $(id); if (el) el.textContent = value; });
  const search = $('builderCatalogSearch'); if (search) { search.placeholder = t('builderSearch'); search.setAttribute('aria-label', t('builderSearch')); }
}

function setTheme(next = theme === 'dark' ? 'light' : 'dark') {
  theme = next === 'dark' ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, theme); applyAppearance();
}

function setLanguage(next = language === 'ar' ? 'en' : 'ar') {
  language = next === 'en' ? 'en' : 'ar';
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  applyAppearance();
  applySettings(state.settings);
  renderCategories(); renderProducts(); renderBrands(); renderUpgrade(); renderBuilder();
  populateCompareFilters(); updateCompareView(); renderCart(); renderAccount();
  localizeDom();
  if (activeProductDetailsId && $('productDetailsModal')?.classList.contains('open')) openProductDetails(activeProductDetailsId);
}

function bindAppearanceEvents() {
  $('themeToggle')?.addEventListener('click', () => setTheme());
  $('languageToggle')?.addEventListener('click', () => setLanguage());
  applyAppearance();
}

let deliveryFee = 0;
let lowStockThreshold = 3;
let authUser = null;
let scrollLockDepth = 0;
let lockedScrollY = 0;

// ===== Utilities =====
const $ = (id) => document.getElementById(id);
const englishDigits = (v) => String(v ?? '').replace(/[٠-٩۰-۹]/g, (digit) => {
  const code = digit.charCodeAt(0);
  return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
});
const esc = (v) => englishDigits(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const builderOnlyLabelMarkup = () => `<span class="builder-only-label">${esc(t('builderOnlyLabel'))}</span>`;
const normalizePricingTier = (profile) => {
  const tier = String(profile?.pricing_tier || profile?.accountType || 'public').toLowerCase();
  return tier === 'wholesale' || tier === 'special' ? tier : 'public';
};
const validPrice = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const getEffectivePrice = (product, profile = null) => {
  const tier = normalizePricingTier(profile);
  const privatePrice = state.privatePrices?.[product?.id] || {};
  const publicPrice = validPrice(product?.public_price ?? product?.retail_price ?? product?.price);
  const tierPrice = tier === 'wholesale'
    ? validPrice(privatePrice.wholesale_price ?? privatePrice.wholesalePrice)
    : tier === 'special' ? validPrice(privatePrice.special_price ?? privatePrice.specialPrice) : null;
  return tierPrice ?? publicPrice ?? 0;
};
const formatPrice = (value) => `${Number(value || 0).toLocaleString('en-IQ')} د.ع`;
const productPrice = (product) => getEffectivePrice(product, state.accountProfile);
const builderDiscountRecord = (product) => {
  const value = state.builderDiscounts?.[product?.id];
  return value && typeof value === 'object'
    ? { enabled: value.enabled === true, type: value.type === 'percentage' ? 'percentage' : 'fixed', value: Number(value.value) }
    : { enabled: false, type: 'percentage', value: 0 };
};
const builderPriceDetails = (product) => {
  const basePrice = productPrice(product);
  const record = builderDiscountRecord(product);
  const value = Number(record.value);
  const discount = record.enabled && Number.isFinite(value) && value > 0
    ? Math.min(basePrice, record.type === 'percentage' ? Math.round(basePrice * Math.min(100, value) / 100) : Math.round(value))
    : 0;
  return { basePrice, discount, finalPrice: Math.max(0, basePrice - discount), record };
};
const builderProductPrice = (product) => builderPriceDetails(product).finalPrice;
const builderPriceMarkup = (product, variant = 'catalog') => {
  const details = builderPriceDetails(product);
  const priceClass = variant === 'part' ? 'builder-part-price' : 'builder-product-price';
  return `<div class="${priceClass}"><strong>${formatPrice(details.basePrice)}</strong></div>`;
};
const normalizeWhatsApp = (v) => String(v || '').replace(/[^0-9]/g, '').replace(/^00/, '');
const storeWhatsAppNumber = () => normalizeWhatsApp(state.settings.storeWhatsApp || state.settings.whatsappNumber || state.settings.whatsapp || state.settings.storePhone || '9647805700503');
const setReceiptShareMode = () => {
  const button = $('whatsappOrderBtn');
  const note = $('receiptWhatsappNote');
  if (button) button.innerHTML = `<i class="fa-brands fa-whatsapp"></i> ${language === 'en' ? 'Download receipt and open WhatsApp' : 'تحميل الوصل وفتح واتساب'}`;
  if (note) note.textContent = language === 'en'
    ? 'The receipt will download and the store WhatsApp chat will open. Attach the downloaded PDF there.'
    : 'سيُحمّل الوصل وتفتح محادثة واتساب المتجر. أرفق ملف PDF المحمّل في المحادثة.';
};
const safeUrl = (v) => { try { const u = new URL(String(v || '').trim()); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const productStock = (p) => p?.stockQuantity ?? p?.stock;
const isAvailable = (p) => p && p.inStock !== false && (productStock(p) === undefined || Number(productStock(p)) > 0);
const stockLabel = (p) => { if (!isAvailable(p)) return [t('unavailable'), 'out']; const s = productStock(p); if (s !== undefined && Number(s) <= lowStockThreshold) return [t('limited'), 'limited']; return [t('available'), 'in']; };
const imageFor = (p) => {
  const images = Array.isArray(p?.images) ? p.images.filter(Boolean).slice(0, 5) : [];
  return images.length ? images[0] : (p?.image || 'images/default-product.svg?v=2');
};
const categoryName = (id) => categoryLabel(state.categories.find((c) => c.id === id)) || id || (language === 'en' ? 'Unknown' : 'غير محدد');
function categoryOrderValue(category) {
  const value = Number(category?.order);
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}
function compareCategoryOrder(a, b) {
  const diff = categoryOrderValue(a) - categoryOrderValue(b);
  return diff !== 0 ? diff : String(a?.id || '').localeCompare(String(b?.id || ''));
}
function orderedCategories(categories = state.categories) {
  return [...categories]
    .filter((cat) => cat && cat.enabled !== false && cat.isHidden !== true)
    .sort(compareCategoryOrder);
}
function normalizeCategoryRecord(id, value) {
  return { id: String(id), ...(value && typeof value === 'object' ? value : {}) };
}
function categoryParentId(category) {
  if (!category) return null;
  const value = Object.prototype.hasOwnProperty.call(category, 'parentId') ? category.parentId : (category.parentCategory ?? category.parent);
  return value === undefined || value === null || value === '' ? null : String(value);
}
function categoryChildren(parentId, categories = state.categories) {
  return orderedCategories(categories).filter((category) => categoryParentId(category) === String(parentId));
}
function categoryIsTopLevel(category, categories = state.categories) {
  return !categoryParentId(category);
}
function categorySiblings(parentId, categories = state.categories) {
  return orderedCategories(categories.filter((category) => categoryParentId(category) === (parentId || null)));
}
function sidebarCategories() {
  const visible = orderedCategories();
  const topLevel = visible.filter((category) => categoryIsTopLevel(category, visible));
  return topLevel.map((parent) => ({
    ...parent,
    children: categoryChildren(parent.id, visible).filter((child) => child.id !== parent.id).sort(compareCategoryOrder),
  }));
}
const categoryIdFor = (p) => p?.categoryId || p?.category || '';
const productText = (p) => [productName(p), p?.name, p?.nameAr, p?.nameEn, p?.brand, p?.model, categoryName(categoryIdFor(p)), typeof p?.description === 'object' ? p.description.ar : p?.description, typeof p?.description === 'object' ? p.description.en : '', ...specificationEntries(p).flatMap((item) => [item.keyAr, item.keyEn, item.valueAr, item.valueEn])].filter(Boolean).join(' ').toLowerCase();
const showToast = (msg) => { const t = $('toast'); if (!t) return; t.textContent = englishDigits(msg); t.classList.add('show'); clearTimeout(showToast._t); showToast._t = setTimeout(() => t.classList.remove('show'), 2800); };
function setScrollLock(locked) {
  if (locked) {
    if (scrollLockDepth++ > 0) return;
    lockedScrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
    document.body.classList.add('overlay-open');
    document.body.style.top = `-${lockedScrollY}px`;
    return;
  }
  if (scrollLockDepth === 0 || --scrollLockDepth > 0) return;
  const restoreScrollY = lockedScrollY;
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  // html{scroll-behavior:smooth} must not animate the lock restore.
  root.style.scrollBehavior = 'auto';
  document.body.classList.remove('overlay-open');
  document.body.style.top = '';
  root.style.removeProperty('--scrollbar-width');
  void document.body.offsetHeight;
  root.scrollTop = restoreScrollY;
  document.body.scrollTop = restoreScrollY;
  window.scrollTo({ left: 0, top: restoreScrollY, behavior: 'auto' });
  requestAnimationFrame(() => { root.style.scrollBehavior = previousScrollBehavior; });
}
const modal = (id, open) => {
  const element = $(id);
  if (!element) return;
  const wasOpen = element.classList.contains('open');
  element.classList.toggle('open', open);
  if (open && !wasOpen) setScrollLock(true);
  if (!open && wasOpen) setScrollLock(false);
};

// ===== Category fallbacks =====
// Firebase keeps any valid custom image URL. These local GitHub-hosted assets
// are used only when that URL is absent or fails to load.

const UNIFIED_CATEGORY_ICONS = {
  // Top-Level Categories
  'cat-computers': 'assets/category-fallbacks/computer.svg?v=3',
  'cat-pc-parts': 'assets/category-fallbacks/pc-parts.svg?v=3',
  'cat-security': 'assets/category-fallbacks/security.svg?v=3',
  'cat-printers': 'assets/category-fallbacks/printer.svg?v=3',
  'cat-monitors': 'assets/category-fallbacks/monitor.svg?v=3',
  'cat-network': 'assets/category-fallbacks/network.svg?v=3',
  'cat-power': 'assets/category-fallbacks/power.svg?v=3',
  'cat-accessories': 'assets/category-fallbacks/accessories.svg?v=3',

  // PC Parts Subcategories
  'cat-storage': 'assets/category-fallbacks/storage.svg?v=3',
  'cat-ram': 'assets/category-fallbacks/ram.svg?v=3',
  'cat-motherboards': 'assets/category-fallbacks/motherboard.svg?v=3',
  'cat-cpus': 'assets/category-fallbacks/cpu.svg?v=3',
  'cat-cases': 'assets/category-fallbacks/computer.svg?v=3',
  'cat-psu': 'assets/category-fallbacks/power.svg?v=3',
  'cat-cooling': 'assets/category-fallbacks/cooling.svg?v=3',
  'cat-gpus': 'assets/category-fallbacks/gpu.svg?v=3'
};

const CUSTOM_ICONS = UNIFIED_CATEGORY_ICONS;
const SIDEBAR_ICONS = UNIFIED_CATEGORY_ICONS;

// Main category cards keep the modern icon family. The browse drawer uses the
// historical FontAwesome contract from `cat.icon` so the two surfaces stay
// visually independent.
function sidebarCategoryIcon(cat) {
  const key = `${cat?.id || ''} ${cat?.name || ''} ${cat?.nameAr || ''}`.toLowerCase();
  const icon = key.includes('network') || key.includes('شبك') ? 'fa-circle-nodes'
    : key.includes('power') || key.includes('طاقة') || key.includes('psu') ? 'fa-power-off'
      : key.includes('accessor') || key.includes('ملحق') ? 'fa-keyboard'
        : (cat.icon || 'fa-folder');
  return `<i class="fa-solid ${esc(icon)} sidebar-category-fa"></i>`;
}

const FALLBACK_IMAGES = {
  'cat-computers': 'assets/category-fallbacks/computer.svg?v=3',
  'cat-storage': 'assets/category-fallbacks/storage.svg?v=3',
  'cat-ram': 'assets/category-fallbacks/ram.svg?v=3',
  'cat-monitors': 'assets/category-fallbacks/monitor.svg?v=3',
  'cat-printers': 'assets/category-fallbacks/printer.svg?v=3',
  'cat-network': 'assets/category-fallbacks/network.svg?v=3',
  'cat-pc-parts': 'assets/category-fallbacks/pc-parts.svg?v=3',
  'cat-cpus': 'assets/category-fallbacks/cpu.svg?v=3',
  'cat-gpus': 'assets/category-fallbacks/gpu.svg?v=3',
  'cat-motherboards': 'assets/category-fallbacks/motherboard.svg?v=3',
  'cat-psu': 'assets/category-fallbacks/power.svg?v=3',
  'cat-cooling': 'assets/category-fallbacks/cooling.svg?v=3',
  'cat-cases': 'assets/category-fallbacks/computer.svg?v=3',
  'cat-accessories': 'assets/category-fallbacks/accessories.svg?v=3',
  'cat-power': 'assets/category-fallbacks/power.svg?v=3',
  'cat-security': 'assets/category-fallbacks/security.svg?v=3'
};
const FALLBACK_KEYWORDS = [
  ['معالج', 'cpu'], ['cpu', 'cpu'], ['رام', 'ram'], ['ذاكرة', 'ram'],
  ['لوحة', 'motherboard'], ['motherboard', 'motherboard'], ['كرت', 'gpu'], ['gpu', 'gpu'],
  ['تخزين', 'storage'], ['ssd', 'storage'], ['hdd', 'storage'], ['شاشة', 'monitor'], ['monitor', 'monitor'],
  ['طابعة', 'printer'], ['ماسح', 'printer'], ['شبك', 'network'], ['router', 'network'], ['راوتر', 'network'],
  ['تبريد', 'cooling'], ['مجهز', 'power'], ['طاقة', 'power'], ['كاميرا', 'security'], ['أمان', 'security'],
  ['ملحق', 'accessories'], ['سماعة', 'accessories'], ['حاسوب', 'computer'], ['كمبيوتر', 'computer']
];
function categoryFallback(cat) {
  const key = `${cat.id || ''} ${cat.name || ''}`.toLowerCase();
  if (FALLBACK_IMAGES[cat.id]) return FALLBACK_IMAGES[cat.id];
  for (const [keyword, asset] of FALLBACK_KEYWORDS) {
    if (key.includes(keyword)) return `assets/category-fallbacks/${asset}.svg?v=2`;
  }
  return 'assets/category-fallbacks/pc-parts.svg?v=2';
}

// ===== Product category matching =====
function productCategoryMatch(product, categoryId) {
  if (!categoryId) return true;
  const selected = state.categories.find((c) => c.id === categoryId);
  const pc = categoryIdFor(product);
  return pc === categoryId ||
    selected?.subcategoryIds?.includes(pc) ||
    categoryParentId(state.categories.find((c) => c.id === pc)) === String(categoryId);
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
  state.brandLogos = settings.brandLogos && typeof settings.brandLogos === 'object' ? settings.brandLogos : {};
  deliveryFee = Number(settings.deliveryFee || 0);
  lowStockThreshold = Number(settings.lowStockThreshold ?? 3);

  const storeName = String(language === 'en' ? (settings.storeNameEn || 'Spider Electronics') : (settings.storeNameAr || settings.storeName || 'سبايدر للإلكترونيات'));
  const [name, ...tagline] = storeName.split(' ');
  if ($('brandName')) $('brandName').textContent = englishDigits(name || (language === 'en' ? 'Spider' : 'سبايدر'));
  if ($('brandTagline')) $('brandTagline').textContent = englishDigits(tagline.join(' ') || t('electronics'));

  if (settings.logoUrl && safeUrl(settings.logoUrl) && $('brandLogo')) $('brandLogo').src = settings.logoUrl;
  if ($('brandsGrid')) renderBrands();
  // The approved storefront hero copy is intentionally not overwritten by
  // optional admin settings. Product, category, image, and store data remain live.
  const chat = settings.chatbotSettings || settings;
  const defaults = { welcomeMessageAr: 'هلا بيك في سبايدر 👋\nشلون أگدر أساعدك اليوم؟', welcomeMessageEn: 'Welcome to SPIDER 👋\nHow can I help you today?', suggestion1Ar: 'أريد أبني تجميعة', suggestion1En: 'I want to build a PC', suggestion2Ar: 'أبحث عن منتج', suggestion2En: 'I am looking for a product', suggestion3Ar: 'أريد أطوّر حاسبتي', suggestion3En: 'I want to upgrade my PC', botFontSize: 16, userFontSize: 16, suggestionFontSize: 15, inputFontSize: 16 };
  const chatSettings = { ...defaults, ...chat };
  if ($('clearCartBtn')) $('clearCartBtn').textContent = t('clearCart');
  if ($('clearCartTitle')) $('clearCartTitle').textContent = t('clearCartTitle');
  if ($('clearCartMessage')) $('clearCartMessage').textContent = t('clearCartMessage');
  if ($('cancelClearCartBtn')) $('cancelClearCartBtn').textContent = t('cancel');
  if ($('confirmClearCartBtn')) $('confirmClearCartBtn').textContent = t('clearCart');
  const welcome = language === 'en' ? chatSettings.welcomeMessageEn : chatSettings.welcomeMessageAr;
  if ($('chatWelcome')) $('chatWelcome').textContent = englishDigits(welcome || defaults.welcomeMessageAr);
  ['suggestion1', 'suggestion2', 'suggestion3'].forEach((key) => { const button = document.querySelector(`[data-chat-key="${key}"]`); const value = language === 'en' ? chatSettings[`${key}En`] : chatSettings[`${key}Ar`]; if (button && value) { button.textContent = englishDigits(value); button.dataset.chat = value; } });
  const clampFont = (value) => Math.min(22, Math.max(14, Number(value) || 16));
  document.documentElement.style.setProperty('--chat-bot-size', `${clampFont(chatSettings.botFontSize)}px`);
  document.documentElement.style.setProperty('--chat-user-size', `${clampFont(chatSettings.userFontSize)}px`);
  document.documentElement.style.setProperty('--chat-suggestion-size', `${clampFont(chatSettings.suggestionFontSize)}px`);
  document.documentElement.style.setProperty('--chat-input-size', `${clampFont(chatSettings.inputFontSize)}px`);

  // Hero CTA button
  if ($('heroBuilderBtn')) {
    $('heroBuilderBtn').replaceChildren(document.createTextNode(`${t('buildNow')} `));
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-arrow-left';
    $('heroBuilderBtn').append(icon);
  }
  if ($('heroKicker')) $('heroKicker').textContent = t('store');
  if ($('upgradePromoTitle')) $('upgradePromoTitle').textContent = t('upgrade');
  if ($('upgradePromoDescription')) $('upgradePromoDescription').textContent = language === 'en' ? 'Choose the right parts to improve your computer performance.' : 'اختَر القطع المناسبة لتطوير أداء جهازك';

  const instagram = safeUrl(settings.instagramUrl || 'https://www.instagram.com/spider_najaf?stkn=MTM2ZXZpZXlxb2kzcg==') || 'https://www.instagram.com/spider_najaf?stkn=MTM2ZXZpZXlxb2kzcg==';
  const whatsapp = normalizeWhatsApp(settings.storeWhatsApp || settings.whatsappNumber || settings.whatsapp || settings.storePhone || '9647805700503');
  const map = safeUrl(settings.googleMapsUrl || settings.mapUrl || 'https://maps.app.goo.gl/J53JRrLtw2JK27My6?g_st=ic') || 'https://maps.app.goo.gl/J53JRrLtw2JK27My6?g_st=ic';

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
  if (!$('categoriesRow')) return;
  if (state.categoryLoad === 'loading') {
    $('categoriesRow').innerHTML = `<div class="loading-state">${language === 'en' ? 'Loading categories...' : 'جاري تحميل الأقسام...'}</div>`;
    return;
  }
  if (state.categoryLoad === 'error') {
    $('categoriesRow').innerHTML = `<div class="loading-state">${language === 'en' ? 'Categories could not be loaded.' : 'تعذر تحميل الأقسام حالياً.'}</div>`;
    return;
  }
  const categories = orderedCategories().filter((cat) => categoryIsTopLevel(cat));
  const row = $('categoriesRow');

  // Always show categories (no toggle)
  row.classList.remove('is-collapsed');
  state.showCategories = true;

  if (!categories.length) {
    row.innerHTML = `<div class="loading-state">${t('noSections')}</div>`;
    return;
  }


  row.innerHTML = categories.map((cat) => {
    const imgSrc = CUSTOM_ICONS[cat.id] || cat.image || categoryFallback(cat);
    const fallback = categoryFallback(cat);
    const imgHtml = `<img src="${esc(imgSrc)}" alt="${esc(categoryLabel(cat))}" loading="lazy" onerror="this.onerror=null;this.src='${esc(fallback)}'">`;
    return `<button class="cat-circle-item" type="button" data-category-id="${esc(cat.id)}" title="${esc(categoryLabel(cat))}">
      <span class="cat-circle">${imgHtml}</span>
      <span class="cat-name">${esc(categoryLabel(cat))}</span>
    </button>`;
  }).join('');

  row.querySelectorAll('[data-category-id]').forEach((btn) =>
    btn.addEventListener('click', () => filterProductsByCategory(btn.dataset.categoryId))
  );

  const sidebar = $('sidebarNav');
  if (!sidebar) return;
  const sidebarItems = sidebarCategories();
  sidebar.innerHTML = sidebarItems.map((cat) => {
    const imgHtml = sidebarCategoryIcon(cat);
    const children = cat.children || [];
    const childMarkup = children.length ? `<ul class="sidebar-sub" data-subcategory-of="${esc(cat.id)}">${children.map((child) => {
      const childImgHtml = sidebarCategoryIcon(child);
      return `<li><button type="button" data-category-id="${esc(child.id)}"><span>${childImgHtml} ${esc(categoryLabel(child))}</span></button></li>`;
    }).join('')}</ul>` : '';
    return `<li>
      <button type="button" data-category-id="${esc(cat.id)}" ${children.length ? 'aria-expanded="false"' : ''}>
        <span>${imgHtml} ${esc(categoryLabel(cat))}</span>${children.length ? '<i class="fa-solid fa-chevron-down chevron" aria-hidden="true"></i>' : ''}
      </button>${childMarkup}
    </li>`;
  }).join('');

  sidebar.querySelectorAll(':scope > li > button[data-category-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sub = btn.parentElement.querySelector(':scope > .sidebar-sub');
      if (sub) {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        sub.classList.toggle('open', !expanded);
      } else {
        filterProductsByCategory(btn.dataset.categoryId);
        closeSidebar();
      }
    });
  });
  sidebar.querySelectorAll('.sidebar-sub [data-category-id]').forEach((btn) => btn.addEventListener('click', () => {
    filterProductsByCategory(btn.dataset.categoryId);
    closeSidebar();
  }));
}

// ===== Products =====
function availabilityMarkup(p) {
  const [label, tone] = stockLabel(p);
  return `<span class="stock ${tone}">${label}</span>`;
}

function productCard(p, ctx) {
  const [label] = stockLabel(p);
  const fav = state.favorites.includes(p.id);
  return `<article class="product-card ${!isAvailable(p) ? 'is-out' : ''}">
      <button class="heart-btn ${fav ? 'active' : ''}" type="button" data-favorite="${esc(p.id)}" aria-label="${fav ? t('remove') : t('favorites')} ">
      <i class="fa-${fav ? 'solid' : 'regular'} fa-heart"></i>
    </button>
    <div class="product-image" data-details="${esc(p.id)}">
      <img src="${esc(imageFor(p))}" alt="${esc(productName(p))}" loading="lazy">
    </div>
    <div class="product-body">
      <span class="product-brand">${esc(p.brand || 'سبايدر')}</span>
      <div class="product-title" data-details="${esc(p.id)}">${esc(productName(p))}</div>
      ${p.model || p.subcategory ? `<div class="product-model">${esc(p.model || p.subcategory || '')}</div>` : ''}
      <div class="product-stock-wrap">${availabilityMarkup(p)}</div>
      <div class="price-row">
        <strong class="product-price">${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(productPrice(p))}</strong>
        ${!p.builderOnly && p.originalPrice ? `<span class="old-price">${formatPrice(p.originalPrice)}</span>` : ''}
      </div>
      <div class="product-actions">
        ${isAvailable(p) && !p.builderOnly
          ? `<button class="btn product-add-btn" type="button" data-add="${esc(p.id)}"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> ${t('addToCart')}</button>`
          : `<button class="btn stock-btn" type="button" data-alert="${esc(p.id)}"><i class="fa-regular fa-bell"></i> ${t('notify')}</button>`
        }
        <button class="btn btn-outline" type="button" data-details="${esc(p.id)}">${t('details')}</button>
          ${ctx === 'upgrade' && isAvailable(p) ? `<button class="btn btn-outline" type="button" data-upgrade-select="${esc(p.id)}"><i class="fa-solid fa-check"></i> ${language === 'en' ? 'Choose' : 'اختيار'}</button>` : ''}
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

// A vertical mobile swipe can synthesize a click after pointerup. Track only
// touch pointers and suppress that synthetic click after the movement crosses
// a small threshold; native scrolling remains untouched.
let touchGesture = null;
document.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  touchGesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
}, true);
document.addEventListener('pointermove', (event) => {
  if (!touchGesture || event.pointerId !== touchGesture.pointerId) return;
  if (Math.hypot(event.clientX - touchGesture.startX, event.clientY - touchGesture.startY) >= 8) touchGesture.moved = true;
}, true);
document.addEventListener('pointerup', (event) => {
  if (!touchGesture || event.pointerId !== touchGesture.pointerId) return;
  if (touchGesture.moved) {
    document.documentElement.dataset.suppressTouchClickUntil = String(Date.now() + 350);
  }
  touchGesture = null;
}, true);
document.addEventListener('pointercancel', () => { touchGesture = null; }, true);
document.addEventListener('click', (event) => {
  const until = Number(document.documentElement.dataset.suppressTouchClickUntil || 0);
  if (until && Date.now() < until) {
    event.stopImmediatePropagation();
    delete document.documentElement.dataset.suppressTouchClickUntil;
  }
}, true);

function renderProducts() {
  if (!$('productsGrid')) return;
  const filtered = filteredProducts();
  $('productsGrid').innerHTML = filtered.length
    ? filtered.map(productCard).join('')
    : `<div class="empty-state">${t('noProducts')}</div>`;
  bindProductActions($('productsGrid'));
  const bits = [
    state.filters.search && `${t('searchFilter')}: ${state.filters.search}`,
    state.filters.brand && `${t('brandFilter')}: ${state.filters.brand}`,
    state.filters.category && `${t('categoryFilter')}: ${categoryName(state.filters.category)}`
  ].filter(Boolean);
  $('activeFilter').textContent = englishDigits(bits.join(' · '));
  $('activeFilter').classList.toggle('hidden', !bits.length);
  $('productsSectionTitle').textContent = bits.length ? t('productResults') : t('latestProducts');
}

function filterProductsByCategory(categoryId) {
  state.filters = { category: categoryId || '', brand: '', search: '' };
  if ($('searchInput')) $('searchInput').value = '';
  renderProducts();
  closeSidebar();
  requestAnimationFrame(() => document.querySelector('#productsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
const STATIC_BRAND_LOGOS = {
  amd: 'images/brands/amd.svg',
  intel: 'images/brands/intel.svg',
  msi: 'images/brands/msi.svg',
  asus: 'images/brands/asus.svg',
  gigabyte: 'images/brands/gigabyte.svg',
  'tp-link': 'images/brands/tp-link.svg',
  corsair: 'images/brands/corsair.svg',
  dahua: 'images/brands/dahua.svg',
  lexar: 'images/brands/lexar.svg',
  pny: 'images/brands/pny.svg'
};
function brandLogoKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function brandLogoFor(brand) {
  const configured = state.brandLogos?.[brandLogoKey(brand)];
  if (configured && (safeUrl(configured) || String(configured).startsWith('images/'))) return configured;
  return STATIC_BRAND_LOGOS[brandLogoKey(brand)] || '';
}
function brandLogoMarkup(logo, fallback) {
  if (!logo) return `<span class="brand-logo-fallback" aria-hidden="true">${esc(fallback)}</span>`;
  return `<img class="brand-logo" src="${esc(logo)}" alt="شعار العلامة" loading="lazy" data-fallback="${esc(fallback)}" onerror="this.onerror=null;const f=document.createElement('span');f.className='brand-logo-fallback';f.setAttribute('aria-hidden','true');f.textContent=this.dataset.fallback||'';this.replaceWith(f)">`;
}
function renderBrands() {
  if (!$('brandsGrid')) return;
  const brands = [...new Set(state.products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $('brandsGrid').classList.toggle('is-collapsed', !state.showBrands);
  $('toggleBrandsBtn').setAttribute('aria-expanded', String(state.showBrands));
  $('toggleBrandsBtn').innerHTML = `${state.showBrands ? t('hideBrands') : t('showBrands')} <i class="fa-solid ${state.showBrands ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>`;
  $('brandsGrid').innerHTML = brands.length
    ? brands.map((brand) => {
        const prod = state.products.find((p) => p.brand === brand);
        const fallback = brand.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase();
        const logo = brandLogoFor(brand) || prod?.brandLogo || prod?.logo;
        return `<button type="button" class="brand-item ${state.filters.brand === brand ? 'active' : ''}" data-brand="${esc(brand)}" aria-label="${esc(`عرض منتجات ${brand}`)}">${brandLogoMarkup(logo, fallback || brand.slice(0, 3).toUpperCase())}<span class="brand-name">${esc(brand)}</span></button>`;
      }).join('')
    : `<div class="empty-state">${t('noBrands')}</div>`;
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
    ? matches.map((p) => `<button class="suggestion" type="button" data-suggestion="${esc(p.id)}"><img src="${esc(imageFor(p))}" alt=""><div><strong>${esc(productName(p))}</strong><small>${esc(p.brand || '')} · ${stockLabel(p)[0]}</small></div><b>${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(productPrice(p))}</b></button>`).join('')
    : `<div class="suggestion"><div><strong>${t('noResults')}</strong><small>${t('tryAnother')}</small></div></div>`;
  box.classList.remove('hidden');
  box.querySelectorAll('[data-suggestion]').forEach((b) => b.addEventListener('click', () => {
    box.classList.add('hidden');
    openProductDetails(b.dataset.suggestion);
  }));
}

// ===== COMPARE =====
function populateCompareFilters() {
  if (!$('compareCategorySelect')) return;
  $('compareCategorySelect').innerHTML = `<option value="">${t('allCategories')}</option>` +
    orderedCategories().map((c) => `<option value="${esc(c.id)}">${esc(categoryLabel(c))}</option>`).join('');
  const brands = [...new Set(state.products.map((p) => p.brand).filter(Boolean))].sort();
  $('compareBrandSelect').innerHTML = `<option value="">${t('allBrands')}</option>` +
    brands.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
  if ($('comparePickerCategory')) $('comparePickerCategory').innerHTML = $('compareCategorySelect').innerHTML;
  if ($('comparePickerBrand')) $('comparePickerBrand').innerHTML = $('compareBrandSelect').innerHTML;
  populateCompareProducts();
}

function comparePool() {
  return state.products.filter((p) =>
    productCategoryMatch(p, $('compareCategorySelect').value) &&
    (!$('compareBrandSelect').value || p.brand === $('compareBrandSelect').value)
  );
}

function populateCompareProducts() {
  if (!$('compareProd1Select')) return;
  const pool = comparePool();
  ['compareProd1Select', 'compareProd2Select'].forEach((id, idx) => {
    const sel = $(id);
    const curr = state.compare[idx];
    sel.innerHTML = `<option value="">${t('chooseProductNumber')} ${idx + 1}</option>` +
      pool.map((p) => `<option value="${esc(p.id)}">${esc(productName(p))}</option>`).join('');
    if (pool.some((p) => p.id === curr)) sel.value = curr;
  });
  updateCompareView();
}

function comparePickerPool() {
  const search = String($('comparePickerSearch')?.value || '').trim().toLowerCase();
  const category = $('comparePickerCategory')?.value || $('compareCategorySelect')?.value || '';
  const brand = $('comparePickerBrand')?.value || $('compareBrandSelect')?.value || '';
  return state.products.filter((p) => productCategoryMatch(p, category) &&
    (!brand || p.brand === brand) && (!search || productText(p).includes(search)));
}

function openComparePicker(slot) {
  if (!$('comparePickerModal')) return;
  state.comparePickerSlot = Number(slot);
  if ($('comparePickerCategory')) $('comparePickerCategory').value = $('compareCategorySelect')?.value || '';
  if ($('comparePickerBrand')) $('comparePickerBrand').value = $('compareBrandSelect')?.value || '';
  renderComparePickerGrid();
  modal('comparePickerModal', true);
}

function renderComparePickerGrid() {
  const grid = $('comparePickerGrid');
  if (!grid) return;
  const otherId = state.compare[Number(state.comparePickerSlot) === 0 ? 1 : 0];
  const pool = comparePickerPool();
  grid.innerHTML = pool.length ? pool.map((p) => {
    const disabled = p.id === otherId;
    const [availability, tone] = stockLabel(p);
    return `<button class="compare-picker-option${disabled ? ' is-disabled' : ''}" type="button" data-compare-pick="${esc(p.id)}" ${disabled ? 'disabled' : ''}>
      <img src="${esc(imageFor(p))}" alt="${esc(productName(p))}" onerror="this.src='images/default-product.svg?v=2'">
      <strong>${esc(productName(p))}</strong>
      <span>${esc(p.brand || t('unknown'))}${p.model ? ` · ${esc(p.model)}` : ''}</span>
      <b>${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(productPrice(p))}</b>
      <small class="stock ${tone}">${esc(availability)}</small>
    </button>`;
  }).join('') : `<div class="empty-state">${t('noProducts')}</div>`;
  grid.querySelectorAll('[data-compare-pick]').forEach((button) => button.addEventListener('click', () => {
    const slot = Number(state.comparePickerSlot);
    const id = button.dataset.comparePick;
    state.compare[slot] = id;
    if ($('compareProd1Select')) $('compareProd1Select').value = slot === 0 ? id : state.compare[0];
    if ($('compareProd2Select')) $('compareProd2Select').value = slot === 1 ? id : state.compare[1];
    updateCompareView();
    modal('comparePickerModal', false);
  }));
}

function previewCompare(id, previewId) {
  const p = state.products.find((item) => item.id === id);
  const el = $(previewId);
  if (!el) return;
  if (p) {
    el.className = 'compare-picker-card';
    el.removeAttribute('aria-label');
    el.innerHTML = `
      <img src="${esc(imageFor(p))}" alt="${esc(productName(p))}">
      <div class="cpc-name">${esc(productName(p))}</div>
      <div class="cpc-model">${esc(p.brand || t('unknown'))}${p.model ? ` · ${esc(p.model)}` : ''}</div>
      <div class="cpc-price">${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(productPrice(p))}</div>
      <div class="cpc-stock ${stockLabel(p)[1]}">${esc(stockLabel(p)[0])}</div>
      <div class="cpc-actions">
        <button class="btn btn-outline" type="button" data-compare-change="${esc(previewId)}">${t('change')}</button>
        <button class="btn btn-outline" type="button" data-compare-clear="${esc(previewId)}">${t('remove')}</button>
      </div>`;
    // Change button shows the select
    el.querySelector('[data-compare-change]')?.addEventListener('click', () => openComparePicker(previewId === 'comparePreview1' ? 0 : 1));
    el.querySelector('[data-compare-clear]')?.addEventListener('click', () => {
      el.className = 'picker-empty';
      el.innerHTML = `<i class="fa-regular fa-image"></i><span>${t('chooseProduct')}</span>`;
      if (previewId === 'comparePreview1') { $('compareProd1Select').value = ''; state.compare[0] = ''; }
      else { $('compareProd2Select').value = ''; state.compare[1] = ''; }
      $('compareResults').classList.add('hidden');
    });
  } else {
    el.className = 'picker-empty';
    el.innerHTML = `<i class="fa-regular fa-image"></i><span>${t('chooseProduct')}</span>`;
    el.setAttribute('aria-label', t('chooseProduct'));
  }
}

function updateCompareView() {
  if (!$('compareProd1Select')) return;
  state.compare = [$('compareProd1Select').value, $('compareProd2Select').value];
  previewCompare(state.compare[0], 'comparePreview1');
  previewCompare(state.compare[1], 'comparePreview2');

  const [first, second] = state.compare.map((id) => state.products.find((p) => p.id === id));
  if (!first || !second || first.id === second.id) {
    $('compareResults').classList.add('hidden');
    return;
  }
  if (categoryIdFor(first) !== categoryIdFor(second)) {
    $('compareResults').innerHTML = `<div class="empty-state">${t('comparisonSameCategory')}</div>`;
    $('compareResults').classList.remove('hidden');
    return;
  }

  const firstSpecs = specificationEntries(first);
  const secondSpecs = specificationEntries(second);
  const keys = [...new Set([...firstSpecs.map((item) => item.keyAr || item.keyEn), ...secondSpecs.map((item) => item.keyAr || item.keyEn)])];
  const rows = keys.length
    ? keys.map((key) => `<div class="spec-row">
        <span>${esc(localizedSpecification(firstSpecs.find((item) => (item.keyAr || item.keyEn) === key) || { value: '' }).value || t('notAvailable'))}</span>
        <span class="spec-key">${esc(localizedSpecification({ keyAr: key, keyEn: key }).key)}</span>
        <span>${esc(localizedSpecification(secondSpecs.find((item) => (item.keyAr || item.keyEn) === key) || { value: '' }).value || t('notAvailable'))}</span>
      </div>`).join('')
    : `<div class="empty-state">${t('noSpecs')}</div>`;

  $('compareResults').innerHTML = `
    <div class="compare-result-cards">
      <div class="compare-card">
        <img src="${esc(imageFor(first))}" alt="${esc(productName(first))}">
        <h3>${esc(productName(first))}</h3>
        <strong>${formatPrice(productPrice(first))}</strong>
        <div class="compare-result-actions">
          <button class="btn btn-primary" type="button" data-add="${esc(first.id)}">${t('addToCart')}</button>
          <button class="btn btn-outline" type="button" data-details="${esc(first.id)}">${t('details')}</button>
        </div>
      </div>
      <div class="compare-card">
        <img src="${esc(imageFor(second))}" alt="${esc(productName(second))}">
        <h3>${esc(productName(second))}</h3>
        <strong>${formatPrice(productPrice(second))}</strong>
        <div class="compare-result-actions">
          <button class="btn btn-primary" type="button" data-add="${esc(second.id)}">${t('addToCart')}</button>
          <button class="btn btn-outline" type="button" data-details="${esc(second.id)}">${t('details')}</button>
        </div>
      </div>
    </div>
    <div class="spec-table">
      <div class="spec-row">
        <span>${esc(first.brand || t('notAvailable'))}</span>
        <span class="spec-key">${esc(t('brand'))}</span>
        <span>${esc(second.brand || t('notAvailable'))}</span>
      </div>
      ${rows}
      <div class="spec-row">
        <span>${esc(first.warranty || t('notAvailable'))}</span>
        <span class="spec-key">${esc(language === 'en' ? 'Warranty' : 'الضمان')}</span>
        <span>${esc(second.warranty || t('notAvailable'))}</span>
      </div>
    </div>`;

  $('compareResults').classList.remove('hidden');
  bindProductActions($('compareResults'));
}

// ===== BUILDER — Card-based UI =====
const builderParts = [
  { id: 'cpu',         categoryId: 'cat-cpus',          label: 'المعالج CPU',       icon: 'fa-microchip' },
  { id: 'motherboard', categoryId: 'cat-motherboards',  label: 'اللوحة الأم',        icon: 'fa-border-all' },
  { id: 'ram',         categoryId: 'cat-ram',           label: 'الذاكرة RAM',        icon: 'fa-memory' },
  { id: 'storage',     categoryId: 'cat-storage',       label: 'التخزين',            icon: 'fa-hard-drive' },
  { id: 'gpu',         categoryId: 'cat-gpus',          label: 'كرت الشاشة GPU',     icon: 'fa-display' },
  { id: 'psu',         categoryId: 'cat-psu',           label: 'مزود الطاقة PSU',    icon: 'fa-plug' },
  { id: 'cooling',     categoryId: 'cat-cooling',       label: 'التبريد',            icon: 'fa-fan' },
  { id: 'case',        categoryId: 'cat-cases',         label: 'الصندوق Case',       icon: 'fa-box' },
  { id: 'monitors',    categoryId: 'cat-monitors',     label: 'الشاشات',            icon: 'fa-display' },
  { id: 'accessories', categoryId: 'cat-accessories',  label: 'ملحقات الكمبيوتر',  icon: 'fa-keyboard' }
];
const MULTI_BUILDER_PARTS = new Set(['ram', 'storage']);
function builderSelectionIds(partId) {
  const raw = state.builder?.[partId];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap((item) => {
    if (item && typeof item === 'object') return Array(Math.max(1, Math.min(10, Number(item.qty) || 1))).fill(String(item.id || ''));
    return [String(item || '')];
  }).filter(Boolean);
  return [String(raw)];
}
function builderSelectionsForPart(partId) {
  return builderSelectionIds(partId).map((id) => state.products.find((product) => product.id === id)).filter(Boolean);
}
function invalidateBuilderPricing() { state.builderPriceVisible = false; }
function setBuilderSelection(partId, productId) {
  if (MULTI_BUILDER_PARTS.has(partId)) {
    const ids = builderSelectionIds(partId);
    if (ids.length < 10) ids.push(String(productId));
    state.builder[partId] = ids;
  } else state.builder[partId] = String(productId);
  invalidateBuilderPricing();
}
function removeBuilderSelection(partId, productId) {
  const ids = builderSelectionIds(partId).filter((id) => id !== String(productId));
  if (ids.length) state.builder[partId] = MULTI_BUILDER_PARTS.has(partId) ? ids : ids[0];
  else delete state.builder[partId];
  invalidateBuilderPricing();
}
const builderPartLabel = (part) => {
  const labels = language === 'en'
    ? { cpu: 'CPU', motherboard: 'Motherboard', ram: 'RAM', gpu: 'GPU', storage: 'Storage', psu: 'Power supply', case: 'Case', cooling: 'Cooling', monitors: 'Monitors', accessories: 'Computer accessories' }
    : { cpu: 'المعالج CPU', motherboard: 'اللوحة الأم', ram: 'الذاكرة RAM', gpu: 'كرت الشاشة GPU', storage: 'التخزين', psu: 'مزود الطاقة PSU', case: 'الصندوق Case', cooling: 'التبريد', monitors: 'الشاشات', accessories: 'ملحقات الكمبيوتر' };
  return labels[part?.id] || part?.label || (language === 'en' ? 'Part' : 'قطعة');
};

function productsForPart(part) {
  return state.products.filter((p) => isAvailable(p) && categoryIdFor(p) === part.categoryId);
}

function builderPartForProduct(product) {
  const active = builderParts.find((part) => part.id === state.builderCatalog.part);
  if (active && productsForPart(active).some((item) => item.id === product.id)) return active;
  return builderParts.find((part) => productsForPart(part).some((item) => item.id === product.id));
}

function builderCatalogProducts() {
  const filter = state.builderCatalog;
  const part = builderParts.find((item) => item.id === filter.part);
  const pool = part ? productsForPart(part) : state.products.filter((product) => builderPartForProduct(product));
  return pool.filter((product) => productCategoryMatch(product, filter.category))
    .filter((product) => !filter.brand || String(product.brand || '').toLowerCase() === filter.brand.toLowerCase())
    .filter((product) => !filter.search || productText(product).includes(filter.search.toLowerCase()));
}

function renderBuilderCatalogFilters() {
  const category = $('builderCatalogCategory');
  const brand = $('builderCatalogBrand');
  if (!category || !brand) return;
  const currentCategory = state.builderCatalog.category;
  const currentBrand = state.builderCatalog.brand;
  category.innerHTML = `<option value="">${esc(t('allCategories'))}</option>` + orderedCategories().map((c) => `<option value="${esc(c.id)}">${esc(categoryLabel(c))}</option>`).join('');
  brand.innerHTML = `<option value="">${esc(t('allBrands'))}</option>` + [...new Set(state.products.filter((p) => builderPartForProduct(p)).map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
  category.value = currentCategory;
  brand.value = currentBrand;
}

function renderBuilderPartTabs() {
  const tabs = $('builderPartTabs');
  if (!tabs) return;
  tabs.innerHTML = `<button type="button" class="builder-part-tab ${!state.builderCatalog.part ? 'active' : ''}" data-builder-part-filter="">${t('allParts')}</button>` + builderParts.map((part) => `<button type="button" class="builder-part-tab ${state.builderCatalog.part === part.id ? 'active' : ''}" data-builder-part-filter="${part.id}"><i class="fa-solid ${part.icon}"></i>${esc(builderPartLabel(part))}</button>`).join('');
  tabs.querySelectorAll('[data-builder-part-filter]').forEach((button) => button.addEventListener('click', () => {
    state.builderCatalog.part = button.dataset.builderPartFilter;
    renderBuilderCatalog();
  }));
}

function renderBuilderCatalog() {
  const grid = $('builderCatalogGrid');
  if (!grid) return;
  renderBuilderCatalogFilters();
  renderBuilderPartTabs();
  const products = builderCatalogProducts();
  const title = $('builderCatalogTitle');
  if (title) title.textContent = state.builderCatalog.part ? builderPartLabel(builderParts.find((p) => p.id === state.builderCatalog.part)) : t('builderCatalogTitle');
  if ($('builderCatalogCount')) $('builderCatalogCount').textContent = `${englishDigits(products.length)} ${t('productCount')}`;
  grid.innerHTML = products.length ? products.map((product) => {
    const part = builderPartForProduct(product);
    const selected = part && builderSelectionIds(part.id).includes(product.id);
    const available = isAvailable(product);
    const specs = topSpecs(product);
    return `<article class="builder-product-card ${selected ? 'is-selected' : ''}">
      <div class="builder-product-image"><img src="${esc(imageFor(product))}" alt="${esc(productName(product))}" loading="lazy" onerror="this.onerror=null;this.src='images/default-product.svg?v=2'"></div>
      <div class="builder-product-body"><span class="product-brand">${esc(product.brand || t('unknown'))}</span><h3>${esc(productName(product))}</h3><span class="builder-product-model">${esc(product.model || product.subcategory || '')}</span>${specs.length ? `<div class="builder-card-specs">${specs.map((spec) => `<span>${esc(spec)}</span>`).join('')}</div>` : ''}<div class="builder-product-meta">${builderPriceMarkup(product)}${availabilityMarkup(product)}</div><button class="btn ${selected ? 'btn-outline' : 'btn-primary'} builder-select-product" type="button" data-builder-product="${esc(product.id)}" ${!available ? 'disabled' : ''}><i class="fa-solid ${selected ? 'fa-check' : 'fa-plus'}"></i> ${selected ? t('selectedForBuild') : t('chooseForBuild')}</button></div>
    </article>`;
  }).join('') : `<div class="empty-state builder-empty-state">${t('noPublished')}</div>`;
  grid.querySelectorAll('[data-builder-product]').forEach((button) => button.addEventListener('click', () => {
    const product = state.products.find((item) => item.id === button.dataset.builderProduct);
    const part = product && builderPartForProduct(product);
    if (!product || !part) return;
    setBuilderSelection(part.id, product.id);
    saveBuilder(); renderBuilder();
  }));
}

function openBuilderPicker(partId) {
  if (!$('builderPickerModal')) return;
  state.builderPickerPart = partId;
  const part = builderParts.find((item) => item.id === partId);
  if ($('builderPickerTitle')) $('builderPickerTitle').textContent = `${t('choosePart')} ${builderPartLabel(part)}`;
  if ($('builderPickerSearch')) $('builderPickerSearch').value = '';
  renderBuilderPickerGrid();
  modal('builderPickerModal', true);
}

function renderBuilderPickerGrid() {
  const grid = $('builderPickerGrid');
  if (!grid) return;
  const part = builderParts.find((item) => item.id === state.builderPickerPart);
  const query = String($('builderPickerSearch')?.value || '').trim().toLowerCase();
  const products = (part ? productsForPart(part) : []).filter((p) => !query || productText(p).includes(query));
  grid.innerHTML = products.length ? products.map((p) => { const selected = builderSelectionIds(part?.id).includes(p.id); return `<button class="compare-picker-option ${selected ? 'is-selected' : ''}" type="button" data-builder-pick="${esc(p.id)}"><img src="${esc(imageFor(p))}" alt="${esc(productName(p))}" onerror="this.src='images/default-product.svg?v=2'"><strong>${esc(productName(p))}</strong><span>${esc(p.brand || t('unknown'))}${p.model ? ` · ${esc(p.model)}` : ''}</span>${builderPriceMarkup(p)}<small class="stock ${stockLabel(p)[1]}">${selected && MULTI_BUILDER_PARTS.has(part?.id) ? (language === 'en' ? 'Selected — click to add another' : 'مختارة — اضغط لإضافة أخرى') : esc(stockLabel(p)[0])}</small></button>`; }).join('') : `<div class="empty-state">${t('noPublished')}</div>`;
  grid.querySelectorAll('[data-builder-pick]').forEach((button) => button.addEventListener('click', () => {
    const pickerPart = state.builderPickerPart;
    const pickerId = button.dataset.builderPick;
    setBuilderSelection(pickerPart, pickerId);
    saveBuilder(); renderBuilder(); modal('builderPickerModal', false);
  }));
}

// Get top 3 specs of a product for builder card display
function topSpecs(product) {
  return specificationEntries(product).slice(0, 3).map((item) => { const spec = localizedSpecification(item); return `${spec.key}: ${spec.value}`; });
}

function renderBuilder() {
  if (!$('builderPartsList')) return;
  const list = $('builderPartsList');
  const incompatibleChecks = builderCompatibilityReport(selectedBuilderProducts()).filter((check) => check.status === 'incompatible');
  list.innerHTML = builderParts.map((part, index) => {
    const selectedProducts = builderSelectionsForPart(part.id);
    const product = selectedProducts[0];
    const fallback = `assets/category-fallbacks/${part.id === 'case' ? 'computer' : part.id === 'psu' ? 'power' : part.id}.svg?v=2`;
    const label = builderPartLabel(part);
    const warning = incompatibleChecks.some((check) => check.parts.includes(part.id))
      ? `<p class="builder-compatibility-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${language === 'en' ? 'This selected part is incompatible with another part.' : 'هذه القطعة غير متوافقة مع قطعة أخرى مختارة.'}</p>`
      : '';
    if (!product) return `<article class="builder-part-card is-empty" data-builder-part-card="${esc(part.id)}">
      <div class="builder-part-card-head"><div class="builder-part-heading"><span class="builder-part-icon"><i class="fa-solid ${part.icon}"></i></span><div><strong>${esc(label)}</strong><small>${language === 'en' ? 'Choose a published part' : 'اختر قطعة منشورة'}</small></div></div><b class="builder-part-number">${String(index + 1).padStart(2, '0')}</b></div>
      <button class="builder-empty-choose" type="button" data-builder-change="${esc(part.id)}"><img src="${fallback}" alt=""><span>${language === 'en' ? `Choose ${esc(label)}` : `اختر ${esc(label)}`}</span><i class="fa-solid fa-plus"></i></button>
    </article>`;
    if (MULTI_BUILDER_PARTS.has(part.id)) {
      const counts = selectedProducts.reduce((map, item) => map.set(item.id, (map.get(item.id) || 0) + 1), new Map());
      return `<article class="builder-part-card is-filled" data-builder-part-card="${esc(part.id)}">
        <div class="builder-part-card-head"><div class="builder-part-heading"><span class="builder-part-icon"><i class="fa-solid ${part.icon}"></i></span><div><strong>${esc(label)}</strong><small>${language === 'en' ? 'Multiple items allowed' : 'يمكن اختيار أكثر من قطعة'}</small></div></div><b class="builder-part-number">${String(index + 1).padStart(2, '0')}</b></div>
        <div class="builder-multi-selection">${[...counts.entries()].map(([productId, qty]) => { const item = state.products.find((entry) => entry.id === productId); return `<div class="builder-multi-row"><img src="${esc(imageFor(item))}" alt="${esc(productName(item))}"><div class="builder-part-product-copy"><strong>${esc(productName(item))}</strong><span>${esc(item.model || item.brand || '')}</span></div><span class="builder-qty-badge">×${qty}</span><button class="builder-remove" type="button" data-builder-remove-product="${esc(part.id)}" data-builder-product-id="${esc(productId)}" aria-label="${t('clear')}"><i class="fa-solid fa-xmark"></i></button></div>`; }).join('')}</div>
        ${warning}<div class="builder-part-actions"><button class="btn btn-primary" type="button" data-builder-change="${esc(part.id)}"><i class="fa-solid fa-plus"></i> ${language === 'en' ? 'Add item' : 'إضافة قطعة'}</button><button class="btn btn-outline" type="button" data-builder-remove="${esc(part.id)}"><i class="fa-solid fa-trash"></i> ${t('clear')}</button></div>
      </article>`;
    }
    return `<article class="builder-part-card is-filled" data-builder-part-card="${esc(part.id)}">
      <div class="builder-part-card-head"><div class="builder-part-heading"><span class="builder-part-icon"><i class="fa-solid ${part.icon}"></i></span><div><strong>${esc(label)}</strong><small>${language === 'en' ? 'Selected part' : 'القطعة المختارة'}</small></div></div><b class="builder-part-number">${String(index + 1).padStart(2, '0')}</b></div>
      <div class="builder-part-product"><img src="${esc(imageFor(product))}" alt="${esc(productName(product))}" onerror="this.onerror=null;this.src='images/default-product.svg?v=2'"><div class="builder-part-product-copy"><strong>${esc(productName(product))}</strong><span>${esc(product.model || product.brand || '')}</span>${topSpecs(product).length ? `<small>${esc(topSpecs(product).join(' · '))}</small>` : ''}</div>${builderPriceMarkup(product, 'part')}<button class="builder-remove" type="button" data-builder-remove="${esc(part.id)}" aria-label="${t('clear')}"><i class="fa-solid fa-xmark"></i></button></div>${warning}
      <div class="builder-part-actions"><button class="btn btn-primary builder-add-cart" type="button" data-builder-cart="${esc(part.id)}"><i class="fa-solid fa-cart-shopping"></i> ${language === 'en' ? 'Add to Cart' : 'إضافة للسلة'}</button><button class="btn btn-outline" type="button" data-builder-change="${esc(part.id)}"><i class="fa-solid fa-rotate"></i> ${t('change')}</button><button class="btn btn-outline" type="button" data-builder-remove="${esc(part.id)}"><i class="fa-solid fa-trash"></i> ${t('clear')}</button></div>
    </article>`;
  }).join('');

  // Delegate interactions from the stable list container so freshly rendered
  // cards always retain working تغيير/مسح and selection controls.
  list.onclick = (event) => {
    const remove = event.target.closest('[data-builder-remove]');
      const change = event.target.closest('[data-builder-change]');
      const cart = event.target.closest('[data-builder-cart]');
      const removeProduct = event.target.closest('[data-builder-remove-product]');
      if (removeProduct) { removeBuilderSelection(removeProduct.dataset.builderRemoveProduct, removeProduct.dataset.builderProductId); saveBuilder(); renderBuilder(); return; }
      const partId = remove?.dataset.builderRemove || change?.dataset.builderChange || cart?.dataset.builderCart;
      if (!partId) return;
      if (cart) { addToCart(state.builder[partId]); return; }
      if (change) { openBuilderPicker(partId); return; }
    delete state.builder[partId];
    invalidateBuilderPricing();
    saveBuilder();
    renderBuilder();
  };
  renderBuilderCatalog();
  updateBuilder();
}

const BUILDER_STORAGE_KEY = 'spider.builder.v1';
const UPGRADE_STORAGE_KEY = 'spider.upgrade.v1';
function readBuilder() {
  try { const saved = JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY) || '{}'); state.builder = saved && typeof saved === 'object' ? saved : {}; }
  catch { state.builder = {}; }
}
function saveBuilder() { localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(state.builder)); }
function readUpgrade() {
  try { const saved = JSON.parse(localStorage.getItem(UPGRADE_STORAGE_KEY) || '{}'); state.upgrade = saved && typeof saved === 'object' ? saved : {}; }
  catch { state.upgrade = {}; }
  try { const savedNew = JSON.parse(localStorage.getItem('spider.upgrade.isnew.v1') || '{}'); state.upgradeIsNew = savedNew && typeof savedNew === 'object' ? savedNew : {}; }
  catch { state.upgradeIsNew = {}; }
}
function saveUpgrade() { localStorage.setItem(UPGRADE_STORAGE_KEY, JSON.stringify(state.upgrade)); }
  localStorage.setItem('spider.upgrade.isnew.v1', JSON.stringify(state.upgradeIsNew));

function selectedBuilderProducts() {
  return builderParts.flatMap((part) => builderSelectionsForPart(part.id));
}

function specValue(p, names) {
  const item = specificationEntries(p).find((spec) => names.some((n) => `${spec.keyAr} ${spec.keyEn}`.toLowerCase().includes(n.toLowerCase())));
  return item ? (item.valueAr || item.valueEn) : '';
}

const normalizeCompatibilityToken = (value) => String(value || '').trim().replace(/[\s_-]+/g, '').toLowerCase();
const listCompatibilityValues = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : String(value || '').split(/[,،/|]/).map((item) => item.trim()).filter(Boolean);
function productCompatibility(product, field) {
  const compatibility = product?.compatibility && typeof product.compatibility === 'object' ? product.compatibility : {};
  const direct = product?.[field] ?? product?.specifications?.[field] ?? product?.specs?.[field];
  if (field === 'socket') return String(compatibility.socket ?? compatibility.cpuSocket ?? product?.socket ?? product?.cpuSocket ?? direct ?? specValue(product, ['socket', 'مقبس']) ?? '').trim();
  if (field === 'ramType') return String(compatibility.ramType ?? product?.ramType ?? product?.memoryType ?? direct ?? specValue(product, ['ram type', 'memory type', 'memory support', 'نوع الذاكرة', 'الذاكرة', 'ddr']) ?? '').trim();
  if (field === 'ramTypes') return listCompatibilityValues(compatibility.ramTypes ?? compatibility.supportedRamTypes ?? compatibility.supportedMemory ?? product?.ramTypes ?? product?.supportedRamTypes ?? product?.supportedMemory ?? product?.supportedRam ?? direct ?? specValue(product, ['ram types', 'supported ram', 'supported memory', 'memory support', 'memory type', 'نوع الذاكرة', 'الذاكرة', 'ddr']));
  return '';
}

function builderCompatibilityReport(selected = selectedBuilderProducts()) {
  const byCategory = (categoryId) => selected.find((product) => categoryIdFor(product) === categoryId);
  const allByCategory = (categoryId) => selected.filter((product) => categoryIdFor(product) === categoryId);
  const cpu = byCategory('cat-cpus');
  const motherboard = byCategory('cat-motherboards');
  const ramProducts = allByCategory('cat-ram');
  const checks = [];
  if (cpu && motherboard) {
    const cpuSocket = productCompatibility(cpu, 'socket');
    const motherboardSocket = productCompatibility(motherboard, 'socket');
    const status = cpuSocket && motherboardSocket
      ? normalizeCompatibilityToken(cpuSocket) === normalizeCompatibilityToken(motherboardSocket) ? 'compatible' : 'incompatible'
      : 'unknown';
    checks.push({ kind: 'cpu-motherboard', status, parts: ['cpu', 'motherboard'], cpuSocket, motherboardSocket });
  }
  if (motherboard && ramProducts.length) {
    const supported = productCompatibility(motherboard, 'ramTypes');
    ramProducts.forEach((ram, index) => {
      const ramType = productCompatibility(ram, 'ramType');
      const status = ramType && supported.length
        ? supported.some((item) => normalizeCompatibilityToken(item) === normalizeCompatibilityToken(ramType)) ? 'compatible' : 'incompatible'
        : 'unknown';
      checks.push({ kind: 'motherboard-ram', status, parts: ['motherboard', 'ram'], ramType, supported, ramIndex: index });
    });
  }
  return checks;
}

function compatibilityStatus(selected) {
  if (!selected.length) return [language === 'en' ? 'Choose parts to check compatibility.' : 'اختر القطع لفحص التوافق.', '', []];
  const checks = builderCompatibilityReport(selected);
  const incompatible = checks.filter((check) => check.status === 'incompatible');
  if (incompatible.length) {
    const messages = incompatible.map((check) => check.kind === 'cpu-motherboard'
      ? (language === 'en' ? `CPU socket ${check.cpuSocket} does not match motherboard socket ${check.motherboardSocket}.` : `مقبس المعالج ${check.cpuSocket} لا يطابق مقبس اللوحة ${check.motherboardSocket}.`)
      : (language === 'en' ? `The selected RAM is incompatible with the motherboard. The motherboard supports ${check.supported.join(', ')} while the selected RAM is ${check.ramType}.` : `الرام المختارة غير متوافقة مع اللوحة الأم. اللوحة تدعم ${check.supported.join(' أو ')} بينما الرام المختارة ${check.ramType}.`));
    return [messages.join(' '), 'bad', checks];
  }
  const unknown = checks.some((check) => check.status === 'unknown');
  if (unknown) return [language === 'en' ? 'Compatibility metadata is incomplete for one or more selected parts.' : 'معلومات التوافق غير متوفرة بالكامل لبعض القطع المختارة.', '', checks];
  if (checks.length) {
    const hasCpuCheck = checks.some((check) => check.kind === 'cpu-motherboard');
    const hasRamCheck = checks.some((check) => check.kind === 'motherboard-ram');
    const message = hasCpuCheck && hasRamCheck
      ? (language === 'en' ? 'The selected CPU, motherboard and RAM are compatible according to the published data.' : 'المعالج واللوحة والرام متوافقة حسب البيانات المنشورة.')
      : hasRamCheck
        ? (language === 'en' ? 'The selected motherboard and RAM are compatible according to the published data.' : 'اللوحة والرام متوافقتان حسب البيانات المنشورة.')
        : (language === 'en' ? 'The selected CPU and motherboard are compatible according to the published data.' : 'المعالج واللوحة متوافقان حسب البيانات المنشورة.');
    return [message, 'ok', checks];
  }
  return [language === 'en' ? 'Choose parts to check compatibility.' : 'اختر القطع لفحص التوافق.', '', checks];
}

function calculateBuilderTotals(selected) {
  const details = selected.map(builderPriceDetails);
  const subtotal = Math.max(0, Math.round(details.reduce((sum, item) => sum + item.basePrice, 0)));
  const productDiscount = Math.max(0, Math.round(details.reduce((sum, item) => sum + item.discount, 0)));
  const afterProductDiscount = Math.max(0, subtotal - productDiscount);
  const global = state.settings?.buildGlobalDiscount;
  const globalValue = global?.enabled === true ? Math.max(0, Number(global.value) || 0) : 0;
  const globalDiscount = global?.type === 'fixed'
    ? Math.min(afterProductDiscount, Math.round(globalValue))
    : Math.min(afterProductDiscount, Math.round(afterProductDiscount * Math.min(100, globalValue) / 100));
  return { subtotal, productDiscount, globalDiscount, discount: productDiscount + globalDiscount, finalTotal: Math.max(0, afterProductDiscount - globalDiscount) };
}

function updateBuilder() {
  if (!$('builderTotal')) return;
  const selected = selectedBuilderProducts();
  const totals = calculateBuilderTotals(selected);
  const total = totals.finalTotal;
  const visible = state.builderPriceVisible === true;
  $('builderTotal').textContent = visible ? formatPrice(total) : '—';
  if ($('builderPriceCards')) $('builderPriceCards').hidden = !visible;
  if ($('builderSubtotal')) $('builderSubtotal').textContent = formatPrice(totals.subtotal);
  if ($('builderDiscount')) $('builderDiscount').textContent = formatPrice(totals.productDiscount);
  if ($('builderDiscountRow')) $('builderDiscountRow').hidden = !visible || totals.productDiscount <= 0;
  if ($('builderGlobalDiscount')) $('builderGlobalDiscount').textContent = formatPrice(totals.globalDiscount);
  if ($('builderGlobalDiscountRow')) $('builderGlobalDiscountRow').hidden = !visible || totals.globalDiscount <= 0;
  if ($('builderFinalTotal')) $('builderFinalTotal').textContent = formatPrice(totals.finalTotal);
  if ($('builderStatus')) $('builderStatus').textContent = `${englishDigits(selected.length)} ${t('selectedParts')}`;
  const [msg, tone] = compatibilityStatus(selected);
  if ($('compatibilityBox')) { $('compatibilityBox').className = `compatibility-box ${tone}`; $('compatibilityBox').innerHTML = `<i class="fa-solid ${tone === 'bad' ? 'fa-circle-xmark' : tone === 'ok' ? 'fa-circle-check' : 'fa-circle-info'}"></i><span>${esc(msg)}</span>`; }
  if ($('addBuilderToCartBtn')) $('addBuilderToCartBtn').disabled = !selected.length || tone === 'bad' || !visible;
  if ($('quoteBuilderBtn')) $('quoteBuilderBtn').disabled = !selected.length || tone === 'bad' || !visible;
}

function quoteLines(products) {
  return products.map((p) => `<div class="quote-line"><img src="${esc(imageFor(p))}" alt=""><div>${esc(productName(p))}<strong>${formatPrice(builderProductPrice(p))}</strong></div></div>`).join('');
}

function openQuote(products = selectedBuilderProducts()) {
  if (!products.length) return;
  const totals = calculateBuilderTotals(products);
  $('quoteSummary').innerHTML = `${quoteLines(products)}<div class="quote-total"><span>مجموع القطع بعد خصومات المنتجات</span><span>${formatPrice(totals.subtotal)}</span></div><div class="quote-total"><span>${t('total')}</span><span>${formatPrice(totals.finalTotal)}</span></div>`;
  $('quoteModal').dataset.text = products.map((p) => `${productName(p)}: ${formatPrice(builderProductPrice(p))}`).join('\n') + `\nمجموع القطع بعد خصومات المنتجات: ${formatPrice(totals.subtotal)}\n${t('total')}: ${formatPrice(totals.finalTotal)}`;
  modal('quoteModal', true);
}

function clearBuilderSelections() {
  const selected = selectedBuilderProducts();
  if (selected.length > 1 && !window.confirm(language === 'en' ? 'Clear all selected build products?' : 'هل تريد مسح كل قطع التجميعة؟')) return;
  state.builder = {};
  invalidateBuilderPricing();
  saveBuilder();
  renderBuilder();
}

// ===== UPGRADE =====
const UPGRADE_FALLBACK_IMAGES = {
  cpu: 'assets/category-fallbacks/cpu.svg?v=2',
  motherboard: 'assets/category-fallbacks/motherboard.svg?v=2',
  ram: 'assets/category-fallbacks/ram.svg?v=2',
  gpu: 'assets/category-fallbacks/gpu.svg?v=2',
  storage: 'assets/category-fallbacks/storage.svg?v=2',
  case: 'assets/category-fallbacks/computer.svg?v=2',
  cooling: 'assets/category-fallbacks/cooling.svg?v=2',
  psu: 'assets/category-fallbacks/power.svg?v=2'
};

const upgradeFields = () => [
  { id: 'cpu', label: language === 'en' ? 'Current CPU' : 'المعالج الحالي', match: /cpu|cpus|معالج/i },
  { id: 'motherboard', label: language === 'en' ? 'Current motherboard' : 'اللوحة الأم الحالية', match: /motherboard|لوحة|مذربورد/i },
  { id: 'ram', label: language === 'en' ? 'Current RAM' : 'الرام الحالية', match: /ram|ذاكرة|رام/i },
  { id: 'gpu', label: language === 'en' ? 'Current GPU' : 'كرت الشاشة الحالي', match: /gpu|كرت|كروت/i },
  { id: 'storage', label: language === 'en' ? 'Current storage' : 'التخزين الحالي', match: /storage|هارد|ssd|hdd/i },
  { id: 'case', label: language === 'en' ? 'Current case' : 'الكيس الحالي', match: /case|صندوق/i },
  { id: 'cooling', label: language === 'en' ? 'Current cooling' : 'التبريد الحالي', match: /cooling|تبريد/i },
  { id: 'psu', label: language === 'en' ? 'Current power supply' : 'مزود الطاقة الحالي', match: /psu|power|طاقة|مجهز/i }
];

// Prefer the product-specific GitHub-hosted asset when the legacy Firebase
// record still points at a generic category image.
const upgradeImageFor = (product) => product?.id === 'seed-ram-1' ? 'images/products/ram-corsair-ddr5.svg?v=2' : imageFor(product);

function upgradeFallbackMarkup(field) {
  return `<div class="upgrade-preview-empty"><button type="button" data-upgrade-open="${field.id}" aria-label="${language === 'en' ? 'Choose' : 'اختيار'} ${esc(field.label)}"><img src="${UPGRADE_FALLBACK_IMAGES[field.id]}" alt="${esc(field.label)}"><strong>${esc(field.label)}</strong><span>${language === 'en' ? 'Choose a published part' : 'اضغط لاختيار قطعة منشورة'}</span></button></div>`;
}

function renderUpgrade() {
  if (!$('upgradeForm')) return;
  const fields = upgradeFields();
  $('upgradeForm').innerHTML = fields.map((field) => {
    return `<div class="upgrade-field"><label for="upgrade-${field.id}-picker">${esc(field.label)}</label><div class="upgrade-selection-preview" data-upgrade-preview="${field.id}">${upgradeFallbackMarkup(field)}</div></div>`;
  }).join('');
  renderUpgradeCatalogFilters();
  renderUpgradeSelectionPreviews();
  renderUpgradeResults();
}

function upgradeProductsFor(field) {
  return state.products.filter((p) => isAvailable(p) && field.match.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name || ''}`));
}

function openUpgradePicker(fieldId) {
  const field = upgradeFields().find((item) => item.id === fieldId);
  if (!$('upgradePickerModal') || !field) return;
  state.upgradePickerField = fieldId;
  if ($('upgradePickerTitle')) $('upgradePickerTitle').textContent = `${language === 'en' ? 'Choose' : 'اختيار'} ${field.label}`;
  if ($('upgradePickerSearch')) $('upgradePickerSearch').value = '';
  renderUpgradePickerGrid();
  modal('upgradePickerModal', true);
}

function renderUpgradePickerGrid() {
  const grid = $('upgradePickerGrid');
  const field = upgradeFields().find((item) => item.id === state.upgradePickerField);
  if (!grid || !field) return;
  const query = String($('upgradePickerSearch')?.value || '').trim().toLowerCase();
  const products = upgradeProductsFor(field).filter((p) => !query || productText(p).includes(query));
  grid.innerHTML = products.length ? products.map((p) => `<button class="compare-picker-option" type="button" data-upgrade-pick="${esc(p.id)}"><img src="${esc(upgradeImageFor(p))}" alt="${esc(productName(p))}" onerror="this.onerror=null;this.src='images/default-product.svg?v=2'"><strong>${esc(productName(p))}</strong><span>${esc(p.brand || t('unknown'))}${p.model ? ` · ${esc(p.model)}` : ''}</span><b>${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(productPrice(p))}</b><small class="stock ${stockLabel(p)[1]}">${esc(stockLabel(p)[0])}</small><span class="upgrade-picker-choice">${language === 'en' ? 'Choose' : 'اختيار'}</span></button>`).join('') : `<div class="empty-state">${language === 'en' ? 'No available published products are available in this category.' : 'لا توجد منتجات منشورة ومتاحة في هذه الفئة حالياً.'}</div>`;
  grid.querySelectorAll('[data-upgrade-pick]').forEach((button) => button.addEventListener('click', () => {
    state.upgrade[state.upgradePickerField] = button.dataset.upgradePick; state.upgradeIsNew[state.upgradePickerField] = false; saveUpgrade();
    renderUpgrade();
    modal('upgradePickerModal', false);
  }));
}

function renderUpgradeCatalogFilters() {
  const category = $('upgradeCatalogCategory');
  const brand = $('upgradeCatalogBrand');
  if (!category || !brand) return;
  category.innerHTML = `<option value="">${esc(t('allCategories'))}</option>` + orderedCategories().map((c) => `<option value="${esc(c.id)}">${esc(categoryLabel(c))}</option>`).join('');
  brand.innerHTML = `<option value="">${esc(t('allBrands'))}</option>` + [...new Set(state.products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
  category.value = state.upgradeCatalog.category;
  brand.value = state.upgradeCatalog.brand;
}

function renderUpgradeSelectionPreviews() {
  if (!$('upgradeForm')) return;
  $('upgradeForm').querySelectorAll('[data-upgrade-preview]').forEach((preview) => {
    const field = upgradeFields().find((item) => item.id === preview.dataset.upgradePreview) || { id: preview.dataset.upgradePreview, label: preview.dataset.upgradePreview };
    const product = state.products.find((p) => p.id === state.upgrade[field.id]);
    if (!product) {
      preview.innerHTML = upgradeFallbackMarkup(field);
      preview.querySelector('[data-upgrade-open]')?.addEventListener('click', () => openUpgradePicker(field.id));
      return;
    }
    const specs = topSpecs(product);
    preview.innerHTML = `<div class="upgrade-preview-card"><img src="${esc(upgradeImageFor(product))}" alt="${esc(productName(product))}" onerror="this.onerror=null;this.src='images/default-product.svg?v=2'"><div class="upgrade-preview-copy"><strong>${esc(productName(product))}</strong><span>${esc(product.brand || product.model || '')}</span>${specs.length ? `<small>${specs.map((spec) => esc(spec)).join(' · ')}</small>` : ''}</div><b>${formatPrice(productPrice(product))}</b><div class="upgrade-preview-actions">${state.upgradeIsNew[field.id] ? `<button class="btn btn-primary" type="button" data-upgrade-cart="${field.id}"><i class="fa-solid fa-cart-shopping"></i> ${language === 'en' ? 'Add to Cart' : 'إضافة للسلة'}</button>` : ''}<button class="btn btn-outline" type="button" data-upgrade-change="${field.id}">${t('change')}</button><button class="btn btn-outline" type="button" data-upgrade-clear="${field.id}">${t('clear')}</button></div></div>`;
    preview.querySelector('[data-upgrade-cart]')?.addEventListener('click', () => { addToCart(product.id); });
      preview.querySelector('[data-upgrade-change]')?.addEventListener('click', () => openUpgradePicker(field.id));
    preview.querySelector('[data-upgrade-clear]')?.addEventListener('click', () => { delete state.upgrade[field.id]; delete state.upgradeIsNew[field.id]; saveUpgrade(); renderUpgrade(); });
  });
}

function renderUpgradeResults() {
  if (!$('upgradeForm') || !$('upgradeResults')) return;
  const selected = upgradeFields().map((field) => state.products.find((p) => p.id === state.upgrade[field.id])).filter(Boolean);
  renderUpgradeSelectionPreviews();
  if (!selected.length) { $('upgradeResults').innerHTML = `<div class="empty-state">${t('chooseSpec')}</div>`; return; }
  const usedIds = new Set(selected.map((p) => p.id));
  const filter = state.upgradeCatalog;
  const recs = state.products.filter((p) => !usedIds.has(p.id) && isAvailable(p)).filter((p) => /gpu|gpus|كرت|ram|ذاكرة|storage|تخزين|ssd|hdd|cpu|cpus|معالج|motherboard|لوحة|power|طاقة|cooling|تبريد|case|صندوق/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name}`)).filter((p) => productCategoryMatch(p, filter.category)).filter((p) => !filter.brand || String(p.brand || '').toLowerCase() === filter.brand.toLowerCase()).filter((p) => !filter.search || productText(p).includes(filter.search.toLowerCase())).slice(0, 8);
  $('upgradeResults').innerHTML = `<p class="upgrade-note">${language === 'en' ? 'Suggestions use only published categories and specifications; compatibility is not guaranteed when device data is incomplete.' : 'الاقتراحات مبنية على القسم والمواصفات المتاحة فقط؛ لا ندّعي التوافق الكامل عند نقص بيانات جهازك.'}</p>${recs.length ? recs.map(p => productCard(p, 'upgrade')).join('') : `<div class="empty-state">${language === 'en' ? 'No matching published upgrade is available.' : 'لا توجد ترقية منشورة مطابقة حالياً.'}</div>`}`;
  bindProductActions($('upgradeResults'));
    $('upgradeResults').querySelectorAll('[data-upgrade-select]').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.dataset.upgradeSelect;
      const p = state.products.find(x => x.id === pid);
      if (!p) return;
      const field = upgradeFields().find(f => f.match.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name}`));
      if (field) {
        state.upgrade[field.id] = pid;
        state.upgradeIsNew[field.id] = true;
        saveUpgrade();
        renderUpgrade();
        showToast(language === 'en' ? 'Part selected for upgrade.' : 'تم اختيار القطعة للترقية.');
      }
    }));
}

// ===== CART =====
function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    state.cart = Array.isArray(saved)
      ? saved.filter((i) => i?.id && Number(i.qty) > 0).map((i) => ({ id: String(i.id), qty: Math.min(100, Math.floor(Number(i.qty))), ...(i.builderSource ? { builderSource: true } : {}), ...(i.nameSnapshot ? { nameSnapshot: String(i.nameSnapshot).slice(0, 200) } : {}) }))
      : [];
  } catch { state.cart = []; }
}
function saveCart() { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart)); }
function cartProduct(item) { return state.products.find((p) => p.id === item.id); }
const cartItemLabel = (item) => item?.nameSnapshot || CATALOG_TRANSLATIONS.products?.[String(item?.id || '')] || String(item?.id || '');

function _addItemToCartLogic(productId, source = 'store') {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return false;
  if (product.builderOnly === true && source !== 'builder') { showToast(t('builderOnlyMessage')); return false; }
  if (!isAvailable(product) || productPrice(product) <= 0) { openAvailability(productId); return false; }
  const item = state.cart.find((e) => e.id === productId);
  if (item) { item.qty = Math.min(100, item.qty + 1); item.builderSource = item.builderSource || source === 'builder'; }
  else state.cart.push({ id: productId, qty: 1, nameSnapshot: productName(product), ...(source === 'builder' ? { builderSource: true } : {}) });
  return true;
}

function addToCart(productId, source = 'store') {
  if (_addItemToCartLogic(productId, source)) {
    renderCart();
    openCart();
    showToast(t('added'));
  }
}
window.addToCart = addToCart;

function addMultipleToCart(productIds, successMsg, source = 'store') {
  if (!productIds || !productIds.length) return;
  let added = false;
  const addedIds = new Set();
  productIds.forEach((productId) => {
    if (addedIds.has(productId)) return; // prevent loop bug duplicate
    addedIds.add(productId);
    if (_addItemToCartLogic(productId, source)) added = true;
  });
  if (added) {
    renderCart();
    openCart();
    showToast(successMsg);
  }
}


function renderCart() {
  if (!$('cartItemsList')) return;
  saveCart();
  if (!state.productsLoaded) {
    $('cartItemsList').innerHTML = state.cart.length ? `<div class="empty-state">${language === 'en' ? 'Loading current product availability...' : 'جارٍ تحميل حالة المنتجات الحالية...'}</div>` : `<div class="empty-state">${t('emptyCart')}</div>`;
    $('cartTotalValue').textContent = formatPrice(0);
    $('checkoutBtn').disabled = true;
    if ($('clearCartBtn')) { $('clearCartBtn').disabled = !state.cart.length; $('clearCartBtn').classList.toggle('hidden', !state.cart.length); }
    return;
  }
  const count = state.cart.reduce((sum, i) => sum + i.qty, 0);
  $('cartBadge').textContent = count;
  $('floatingCartBadge').textContent = count;
  let total = 0;
  const tier = normalizePricingTier(state.accountProfile);
  let hasUnavailableItems = false;
  const unavailableLabels = [];
  const rows = state.cart.map((item, idx) => {
    const p = cartProduct(item);
    if (!p) {
      hasUnavailableItems = true;
      const label = cartItemLabel(item);
      unavailableLabels.push(label);
      return `<div class="cart-item cart-item-unavailable"><div class="cart-item-unavailable-copy"><div class="cart-item-title">${esc(label)}</div><div class="cart-item-price">${language === 'en' ? 'No longer available' : 'لم يعد متوفراً حالياً'}</div><div class="cart-item-actions"><button class="remove-btn" type="button" data-remove="${idx}"><i class="fa-solid fa-trash"></i> ${language === 'en' ? 'Remove' : 'إزالة'}</button></div></div></div>`;
    }
    const appliedPrice = item.builderSource ? builderProductPrice(p) : productPrice(p);
    item.applied_price = appliedPrice;
    item.pricing_tier = tier;
    item.public_price_snapshot = validPrice(p.public_price ?? p.retail_price ?? p.price);
    item.special_price_snapshot = validPrice(state.privatePrices?.[p.id]?.special_price);
    item.wholesale_price_snapshot = validPrice(state.privatePrices?.[p.id]?.wholesale_price);
    total += appliedPrice * item.qty;
    return `<div class="cart-item"><img src="${esc(imageFor(p))}" alt="${esc(productName(p))}"><div>
      <div class="cart-item-title">${esc(productName(p))}</div>
      <div class="cart-item-price">${formatPrice(appliedPrice * item.qty)}</div>
      <div class="cart-item-actions">
        <button class="qty-btn" type="button" data-qty="${idx}:1">+</button>
        <span>${item.qty}</span>
        <button class="qty-btn" type="button" data-qty="${idx}:-1">−</button>
        <button class="remove-btn" type="button" data-remove="${idx}"><i class="fa-solid fa-trash"></i></button>
      </div></div></div>`;
  }).filter(Boolean);
  const unavailableWarning = hasUnavailableItems
    ? `<div class="cart-unavailable-warning" role="alert"><strong>${language === 'en' ? 'Some products are no longer available' : 'بعض المنتجات لم تعد متوفرة'}</strong><span>${language === 'en' ? `Remove: ${unavailableLabels.map(esc).join(', ')}` : `أزل المنتجات التالية قبل إتمام الطلب: ${unavailableLabels.map(esc).join('، ')}`}</span></div>`
    : '';
  $('cartItemsList').innerHTML = rows.length ? `${unavailableWarning}${rows.join('')}` : `<div class="empty-state">${t('emptyCart')}</div>`;
  $('cartTotalValue').textContent = formatPrice(total);
  $('checkoutBtn').disabled = !rows.length || hasUnavailableItems;
  $('checkoutBtn').setAttribute('aria-disabled', String(!rows.length || hasUnavailableItems));
  $('checkoutBtn').title = hasUnavailableItems
    ? (language === 'en' ? 'Remove unavailable products before checkout' : 'أزل المنتجات غير المتوفرة قبل إتمام الطلب')
    : '';
  if ($('clearCartBtn')) { $('clearCartBtn').disabled = !state.cart.length; $('clearCartBtn').classList.toggle('hidden', !state.cart.length); }
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

function openClearCartConfirm() { if (state.cart.length) { closeCart(); modal('clearCartModal', true); } }
function clearCart() { state.cart = []; saveCart(); renderCart(); modal('clearCartModal', false); }

function openCart() { const wasOpen = $('cartSidebar')?.classList.contains('open'); $('cartSidebar').classList.add('open'); $('cartOverlay').classList.add('open'); if (!wasOpen) setScrollLock(true); }
function closeCart() { const wasOpen = $('cartSidebar')?.classList.contains('open'); $('cartSidebar').classList.remove('open'); $('cartOverlay').classList.remove('open'); if (wasOpen) setScrollLock(false); }

// ===== Product Details Modal =====
let activeProductGalleryIndex = 0;
function setProductGalleryImage(index) {
  const gallery = document.querySelector('#productDetailsBody .product-gallery');
  let images = [];
  try { images = gallery?.dataset.images ? JSON.parse(gallery.dataset.images) : []; } catch { images = []; }
  if (!images.length) return;
  activeProductGalleryIndex = (index + images.length) % images.length;
  const main = $('productMainImage');
  if (main) main.src = images[activeProductGalleryIndex];
  gallery.querySelectorAll('.product-thumbnail').forEach((thumb, thumbIndex) => thumb.classList.toggle('active', thumbIndex === activeProductGalleryIndex));
  const indicator = gallery.querySelector('.gallery-indicator');
  if (indicator) indicator.textContent = `${activeProductGalleryIndex + 1} / ${images.length}`;
}

function openProductDetails(id) {
  const p = state.products.find((item) => item.id === id);
  if (!p) return;
  activeProductDetailsId = id;
  activeProductGalleryIndex = 0;
  const specs = specificationEntries(p);
  $('modalProductTitle').textContent = englishDigits(productName(p));
  
    const productImages = (Array.isArray(p.images) ? p.images.filter(Boolean).slice(0, 5) : []).length
      ? p.images.filter(Boolean).slice(0, 5)
      : (p.image ? [p.image] : ['images/default-product.svg?v=2']);
    $('productDetailsBody').innerHTML = `<div class="product-detail">
      <div class="product-gallery" data-images='${esc(JSON.stringify(productImages))}'>
        <div class="product-gallery-stage">
        <img src="${esc(productImages[0])}" alt="${esc(productName(p))}" id="productMainImage">
        ${productImages.length > 1 ? `<span class="gallery-indicator">1 / ${productImages.length}</span>` : ''}
        </div>
        ${productImages.length > 1 ? `
        <div class="product-thumbnails">
          ${productImages.map((img, i) => `<button type="button" class="product-thumbnail ${i===0?'active':''}" data-gallery-index="${i}" aria-label="${language === 'en' ? `Image ${i + 1}` : `الصورة ${i + 1}`} "><img src="${esc(img)}" alt=""></button>`).join('')}
        </div>
        ` : ''}
      </div>
      <div>
      <h3>${esc(productName(p))}</h3>
      <div class="detail-meta">${esc(p.brand || '')} ${p.model ? `· ${esc(p.model)}` : ''}</div>
      <div class="detail-price">${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(productPrice(p))}</div>
      ${availabilityMarkup(p)}
      <p class="detail-meta">${esc(localizedAttribute(p.description) || t('noDescription'))}</p>
      <div class="spec-list">${specs.length ? specs.map((item) => { const spec = localizedSpecification(item); return `<div><strong>${esc(spec.key)}</strong><span>${esc(spec.value)}</span></div>`; }).join('') : `<div>${language === 'en' ? 'No additional published specifications' : 'لا توجد مواصفات إضافية منشورة'}</div>`}</div>
      <div class="detail-actions">
        ${isAvailable(p) && !p.builderOnly
           ? `<button class="btn product-add-btn" type="button" data-detail-add="${esc(p.id)}"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>${t('addToCart')}</button>`
          : `<button class="btn stock-btn" type="button" data-alert="${esc(p.id)}">${t('notify')}</button>`}
        <button class="btn btn-outline" type="button" data-favorite="${esc(p.id)}">${state.favorites.includes(p.id) ? (language === 'en' ? 'Remove from favorites' : 'إزالة من المفضلة') : (language === 'en' ? 'Add to favorites' : 'أضف للمفضلة')}</button>
      </div>
    </div>
  </div>`;
  $('productDetailsBody').querySelector('[data-detail-add]')?.addEventListener('click', () => { addToCart(id); modal('productDetailsModal', false); });
  $('productDetailsBody').querySelector('[data-alert]')?.addEventListener('click', () => openAvailability(id));
  $('productDetailsBody').querySelector('[data-favorite]')?.addEventListener('click', () => { toggleFavorite(id); openProductDetails(id); });
  $('productDetailsBody').querySelectorAll('[data-gallery-index]').forEach((button) => button.addEventListener('click', () => setProductGalleryImage(Number(button.dataset.galleryIndex))));
  const gallery = $('productDetailsBody').querySelector('.product-gallery');
  let touchStart = null;
  gallery?.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });
  gallery?.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    if (!touchStart || !touch || productImages.length < 2) { touchStart = null; return; }
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setProductGalleryImage(activeProductGalleryIndex + (deltaX > 0 ? -1 : 1));
    }
    touchStart = null;
  }, { passive: true });
  modal('productDetailsModal', true);
}
window.openProductDetails = openProductDetails;

function openAvailability(id) {
  const p = state.products.find((item) => item.id === id);
  if (!p) return;
  state.availabilityProductId = id;
  $('availabilityProductName').textContent = englishDigits(`${language === 'en' ? 'Product: ' : 'المنتج: '}${productName(p)}`);
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
  showToast(language === 'en'
    ? (state.favorites.includes(id) ? 'Added to favorites' : 'Removed from favorites')
    : (state.favorites.includes(id) ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة'));
}

function loadFavorites() {
  try { state.favorites = JSON.parse(localStorage.getItem(authUser ? `${FAVORITES_KEY}.${authUser.uid}` : `${FAVORITES_KEY}.guest`) || '[]'); }
  catch { state.favorites = []; }
}

function renderAccount(accountMode = state.accountMode || 'account') {
  if (!$('accountState') || !$('favoritesList')) return;
  updateAccountGreeting();
  state.accountMode = accountMode;
  const box = $('accountState');
  const showAccount = accountMode !== 'favorites';
  const showFavorites = accountMode === 'favorites';
  $('accountModal').querySelector('.modal-head h2').textContent = showFavorites ? t('favorites') : (language === 'en' ? 'Account' : 'حسابي');
  $('accountState').hidden = !showAccount;
  $('favoritesList').hidden = !showFavorites;
  if (authUser) {
    box.innerHTML = accountProfileMarkup();
    $('logoutBtn').addEventListener('click', () => signOut(auth));
    $('phoneLinkForm').addEventListener('submit', (event) => submitPhoneAuth(event, 'register', true));
    $('changePinForm')?.addEventListener('submit', submitChangePin);
    box.querySelectorAll('[data-account-section]').forEach((button) => button.addEventListener('click', () => {
      box.querySelectorAll('[data-account-section]').forEach((item) => item.classList.toggle('active', item === button));
      box.querySelectorAll('[data-account-panel]').forEach((panel) => { panel.hidden = panel.dataset.accountPanel !== button.dataset.accountSection; });
    }));
  } else {
    box.innerHTML = `<div class="auth-intro"><span class="auth-mark"><i class="fa-solid fa-spider"></i></span><div><strong>${language === 'en' ? 'Welcome back' : 'مرحباً بك من جديد'}</strong><small>${t('loginHint')}</small></div></div><div class="account-tabs auth-tabs" role="tablist"><button class="account-tab active" type="button" aria-selected="true">${language === 'en' ? 'Sign in' : 'تسجيل الدخول'}</button><button class="account-tab" id="phoneRegisterBtn" type="button" aria-selected="false">${language === 'en' ? 'Create account' : 'إنشاء حساب'}</button></div><form class="phone-auth-form" id="phoneLoginForm" novalidate><label for="phoneNumberInput">${language === 'en' ? 'Phone number' : 'رقم الهاتف'}</label><input id="phoneNumberInput" required type="tel" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="07XXXXXXXXX"><div class="field-error" data-error-for="phoneNumberInput"></div>${pinFields('loginPassword', language === 'en' ? 'Password or legacy PIN' : 'كلمة المرور أو PIN القديم', 'phonePinInput')}<div class="field-error" data-error-for="phonePinInput"></div><button class="btn btn-primary" type="submit">${language === 'en' ? 'Sign in' : 'تسجيل الدخول'}</button></form><button type="button" class="account-forgot-link" id="forgotPasswordBtn">${language === 'en' ? 'Forgot your password?' : 'نسيت كلمة المرور؟'}</button><div class="auth-divider"><span>${language === 'en' ? 'or' : 'أو'}</span></div><button class="btn btn-google" id="googleSignInBtn" type="button"><i class="fa-brands fa-google"></i> ${t('google')}</button>`;
    $('googleSignInBtn').addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (e) { showToast(`${language === 'en' ? 'Google sign-in failed' : 'تعذر تسجيل Google'}: ${e.code || 'AUTH_ERROR'}`); } });
    $('phoneLoginForm').addEventListener('submit', (event) => submitPhoneAuth(event, 'login', false));
    bindPinInputs(box); $('phoneRegisterBtn').addEventListener('click', () => renderPhoneRegistration()); $('forgotPasswordBtn')?.addEventListener('click', () => showToast(language === 'en' ? 'Use Google recovery or contact support for phone accounts.' : 'استخدم استعادة Google أو تواصل مع الدعم لحسابات الهاتف.'));
  }
  bindPasswordToggles(box);
  const favs = state.products.filter((p) => state.favorites.includes(p.id));
  $('favoritesList').innerHTML = `<h3>${t('favorites')} (${favs.length})</h3>${favs.length ? favs.map((p) => `<article class="favorite-card"><img src="${esc(imageFor(p))}" alt="${esc(productName(p))}"><div class="favorite-card-copy"><strong>${esc(productName(p))}</strong><small>${esc(p.brand || '')}${p.model ? ` · ${esc(p.model)}` : ''}</small><span class="favorite-card-price">${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(productPrice(p))}</span><span class="stock ${stockLabel(p)[1]}">${esc(stockLabel(p)[0])}</span><div class="favorite-card-actions"><button class="btn btn-outline" type="button" data-favorite-open="${esc(p.id)}">${t('open')}</button>${isAvailable(p) && !p.builderOnly ? `<button class="btn btn-primary" type="button" data-favorite-cart="${esc(p.id)}">${t('addToCart')}</button>` : ''}</div></div></article>`).join('') : `<div class="empty-state">${t('noFavorites')}</div>`}`;
  $('favoritesList').querySelectorAll('[data-favorite-open]').forEach((btn) => btn.addEventListener('click', () => { modal('accountModal', false); openProductDetails(btn.dataset.favoriteOpen); }));
  $('favoritesList').querySelectorAll('[data-favorite-cart]').forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.favoriteCart)));
}

function accountProfileMarkup() {
  const profile = state.accountProfile || normalizeAccountProfile(authUser, {});
  const value = (field, fallback = 'غير متوفر') => esc(String(profile[field] || fallback));
  const orders = state.accountOrders || [];
  const accountName = profile.firstName || profile.name || authUser?.email || 'الحساب';
  const summary = esc(profile.email || profile.phone || '');
  return `<div class="account-summary"><span class="account-avatar"><i class="fa-solid fa-user"></i></span><div><strong>${esc(accountName)}</strong><small dir="ltr">${summary}</small></div><button class="btn btn-outline account-logout" id="logoutBtn" type="button">${t('logout')}</button></div><nav class="account-nav" aria-label="${language === 'en' ? 'Account sections' : 'أقسام الحساب'}"><button class="active" type="button" data-account-section="details">${language === 'en' ? 'Details' : 'تفاصيل الحساب'}</button><button type="button" data-account-section="orders">${language === 'en' ? 'Orders' : 'الطلبات'}</button><button type="button" data-account-section="delete">${language === 'en' ? 'Delete account' : 'حذف الحساب'}</button></nav><section class="account-panel" data-account-panel="details"><h3>${language === 'en' ? 'Account details' : 'تفاصيل الحساب'}</h3><dl class="account-profile-grid"><div><dt>${language === 'en' ? 'First name' : 'الاسم الأول'}</dt><dd>${value('firstName')}</dd></div><div><dt>${language === 'en' ? 'Last name' : 'الاسم الأخير'}</dt><dd>${value('lastName')}</dd></div><div><dt>${language === 'en' ? 'Email' : 'البريد الإلكتروني'}</dt><dd dir="ltr">${value('email')}</dd></div><div><dt>${language === 'en' ? 'Phone' : 'رقم الهاتف'}</dt><dd dir="ltr">${value('phone')}</dd></div><div><dt>${language === 'en' ? 'Governorate' : 'المحافظة'}</dt><dd>${value('governorate', profile.province || 'غير متوفر')}</dd></div><div><dt>${language === 'en' ? 'City' : 'المدينة'}</dt><dd>${value('city')}</dd></div></dl><details class="account-collapsible"><summary>${language === 'en' ? 'Phone number' : 'رقم الهاتف'}<span>إضافة أو تعديل</span></summary><form class="phone-auth-form" id="phoneLinkForm"><input id="phoneLinkInput" required type="tel" dir="ltr" inputmode="tel" placeholder="07XXXXXXXXX"><div class="password-input-wrap"><input id="phoneLinkPin" required type="password" dir="ltr" autocomplete="new-password" placeholder="كلمة المرور"><button type="button" class="password-toggle" data-password-toggle="phoneLinkPin" aria-label="إظهار كلمة المرور"><i class="fa-solid fa-eye"></i></button></div><div class="password-input-wrap"><input id="phoneLinkConfirm" required type="password" dir="ltr" autocomplete="new-password" placeholder="تأكيد كلمة المرور"><button type="button" class="password-toggle" data-password-toggle="phoneLinkConfirm" aria-label="إظهار كلمة المرور"><i class="fa-solid fa-eye"></i></button></div><button class="btn btn-outline" type="submit">${language === 'en' ? 'Add phone login' : 'إضافة تسجيل الهاتف'}</button></form></details><details class="account-collapsible"><summary>${language === 'en' ? 'Security' : 'الأمان'}<span>${language === 'en' ? 'Change password' : 'تغيير كلمة المرور'}</span></summary><form class="phone-auth-form" id="changePinForm"><div class="password-input-wrap"><input id="currentPinInput" required type="password" dir="ltr" autocomplete="current-password" placeholder="كلمة المرور الحالية"><button type="button" class="password-toggle" data-password-toggle="currentPinInput" aria-label="إظهار كلمة المرور"><i class="fa-solid fa-eye"></i></button></div><div class="password-input-wrap"><input id="newPinInput" required type="password" dir="ltr" autocomplete="new-password" placeholder="كلمة المرور الجديدة"><button type="button" class="password-toggle" data-password-toggle="newPinInput" aria-label="إظهار كلمة المرور"><i class="fa-solid fa-eye"></i></button></div><div class="password-input-wrap"><input id="newPinConfirmInput" required type="password" dir="ltr" autocomplete="new-password" placeholder="تأكيد كلمة المرور الجديدة"><button type="button" class="password-toggle" data-password-toggle="newPinConfirmInput" aria-label="إظهار كلمة المرور"><i class="fa-solid fa-eye"></i></button></div><button class="btn btn-outline" type="submit">${language === 'en' ? 'Change password' : 'تغيير كلمة المرور'}</button></form></details></section><section class="account-panel" data-account-panel="orders" hidden><h3>${language === 'en' ? 'Orders' : 'الطلبات'} (${orders.length})</h3>${orders.length ? `<ul class="account-orders">${orders.map((order) => `<li><span>${esc(order.id)}</span><strong>${esc(String(order.status || 'غير محدد'))}</strong></li>`).join('')}</ul>` : `<p class="account-muted">${language === 'en' ? 'No orders found for this account.' : 'لا توجد طلبات مرتبطة بهذا الحساب.'}</p>`}</section><section class="account-panel account-delete-panel" data-account-panel="delete" hidden><h3>${language === 'en' ? 'Delete account' : 'حذف الحساب'}</h3><p>${language === 'en' ? 'Account deletion requires verified support handling to protect orders and receipts.' : 'حذف الحساب يحتاج إلى معالجة موثقة من الدعم لحماية الطلبات والإيصالات.'}</p><button type="button" class="btn btn-outline" data-account-delete-info>${language === 'en' ? 'Request account deletion' : 'طلب حذف الحساب'}</button></section>`;
}

function renderPhoneRegistration() {
  const box = $('accountState');
  box.innerHTML = `<div class="auth-intro"><span class="auth-mark"><i class="fa-solid fa-spider"></i></span><div><strong>${language === 'en' ? 'Create your account' : 'أنشئ حسابك في SPIDER'}</strong><small>${language === 'en' ? 'Your details stay linked to your current account profile.' : 'بياناتك تبقى مرتبطة بملف الحساب الحالي.'}</small></div></div><div class="account-tabs auth-tabs" role="tablist"><button class="account-tab" id="phoneLoginTab" type="button" aria-selected="false">${language === 'en' ? 'Sign in' : 'تسجيل الدخول'}</button><button class="account-tab active" type="button" aria-selected="true">${language === 'en' ? 'Create account' : 'إنشاء حساب'}</button></div><form class="phone-auth-form" id="phoneRegisterForm" novalidate><label for="phoneFirstNameInput">${language === 'en' ? 'First name' : 'الاسم الأول'}</label><input id="phoneFirstNameInput" required type="text" autocomplete="given-name"><div class="field-error" data-error-for="phoneFirstNameInput"></div><label for="phoneLastNameInput">${language === 'en' ? 'Last name' : 'الاسم الأخير'}</label><input id="phoneLastNameInput" required type="text" autocomplete="family-name"><div class="field-error" data-error-for="phoneLastNameInput"></div><label for="phoneEmailInput">${language === 'en' ? 'Email' : 'البريد الإلكتروني'}</label><input id="phoneEmailInput" required type="email" dir="ltr" autocomplete="email" placeholder="name@example.com"><div class="field-error" data-error-for="phoneEmailInput"></div><label for="phoneRegisterInput">${language === 'en' ? 'Phone number' : 'رقم الهاتف'}</label><input id="phoneRegisterInput" required type="tel" dir="ltr" inputmode="tel" placeholder="07XXXXXXXXX"><div class="field-error" data-error-for="phoneRegisterInput"></div>${pinFields('registerPassword', language === 'en' ? 'Choose password' : 'اختر كلمة المرور', 'phoneRegisterPin')}<div class="field-error" data-error-for="phoneRegisterPin"></div>${pinFields('confirmPassword', language === 'en' ? 'Confirm password' : 'تأكيد كلمة المرور', 'phoneRegisterConfirm')}<div class="field-error" data-error-for="phoneRegisterConfirm"></div><button class="btn btn-primary" type="submit">${language === 'en' ? 'Create account' : 'إنشاء الحساب'}</button></form>`;
  $('phoneRegisterForm').addEventListener('submit', (event) => submitPhoneAuth(event, 'register', false));
  bindPinInputs(box); $('phoneLoginTab').addEventListener('click', renderAccount);
}

function pinFields(group, label, firstId) { return `<div class="pin-field-group"><label for="${firstId}">${label}</label><div class="password-input-wrap"><input id="${firstId}" type="password" dir="ltr" autocomplete="new-password" aria-label="${label}"><button type="button" class="password-toggle" data-password-toggle="${firstId}" aria-label="إظهار كلمة المرور"><i class="fa-solid fa-eye"></i></button></div></div>`; }
function bindPasswordToggles(root) { root.querySelectorAll('[data-password-toggle]').forEach((button) => button.addEventListener('click', () => { const input = $(button.dataset.passwordToggle); if (!input) return; input.type = input.type === 'password' ? 'text' : 'password'; button.setAttribute('aria-label', input.type === 'password' ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'); })); }
function bindPinInputs(root) { bindPasswordToggles(root); }
function readPin(firstId) { return $(firstId)?.value || ''; }
function setFieldError(form, id, message = '') { const target = form.querySelector(`[data-error-for="${id}"]`); if (target) target.textContent = message; form.querySelector(`#${id}`)?.classList.toggle('input-error', Boolean(message)); }

async function submitPhoneAuth(event, mode, linkExisting) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  if (submit.disabled) return;
  const isLink = Boolean(linkExisting);
  const phone = $(isLink ? 'phoneLinkInput' : mode === 'login' ? 'phoneNumberInput' : 'phoneRegisterInput')?.value.trim();
  const password = String(isLink ? $('phoneLinkPin')?.value.trim() : readPin(mode === 'login' ? 'phonePinInput' : 'phoneRegisterPin'));
  const confirmPassword = String(isLink ? $('phoneLinkConfirm')?.value.trim() : readPin('phoneRegisterConfirm'));
  const firstName = mode === 'register' && !isLink ? $('phoneFirstNameInput')?.value.trim() || '' : '';
  const lastName = mode === 'register' && !isLink ? $('phoneLastNameInput')?.value.trim() || '' : '';
  const email = mode === 'register' && !isLink ? $('phoneEmailInput')?.value.trim() || '' : '';
  const name = [firstName, lastName].filter(Boolean).join(' ');
  const legacyPin = /^\d{4}$/.test(englishDigits(password));
  const validPassword = /^\S{6,128}$/.test(password);
  const credentialValid = mode === 'login' && !isLink ? (legacyPin || validPassword) : validPassword;
  const errors = !isLink && mode === 'register' && !firstName ? ['phoneFirstNameInput', language === 'en' ? 'First name is required.' : 'الاسم الأول مطلوب.'] : !isLink && mode === 'register' && !lastName ? ['phoneLastNameInput', language === 'en' ? 'Last name is required.' : 'الاسم الأخير مطلوب.'] : !isLink && mode === 'register' && !/^\S+@\S+\.\S+$/.test(email) ? ['phoneEmailInput', language === 'en' ? 'Enter a valid email.' : 'أدخل بريداً إلكترونياً صحيحاً.'] : !/^07[3-9][0-9]{8}$/.test(englishDigits(phone).replace(/\s/g, '')) ? [isLink ? 'phoneLinkInput' : mode === 'login' ? 'phoneNumberInput' : 'phoneRegisterInput', language === 'en' ? 'Enter a valid Iraqi phone number.' : 'أدخل رقم هاتف عراقي صحيح.'] : !credentialValid ? [isLink ? 'phoneLinkPin' : mode === 'login' ? 'phonePinInput' : 'phoneRegisterPin', language === 'en' ? 'Use a password of 6–128 characters without spaces.' : 'استخدم كلمة مرور من 6 إلى 128 حرفاً بدون مسافات.'] : mode === 'register' && password !== confirmPassword ? ['phoneRegisterConfirm', language === 'en' ? 'Passwords do not match.' : 'كلمتا المرور غير متطابقتين.'] : null;
  if (errors) { setFieldError(form, errors[0], errors[1]); return; }
  submit.disabled = true; const originalLabel = submit.textContent; submit.textContent = mode === 'login' ? (language === 'en' ? 'Signing in...' : 'جاري تسجيل الدخول...') : (language === 'en' ? 'Creating account...' : 'جاري إنشاء الحساب...');
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (isLink && authUser) headers.Authorization = `Bearer ${await authUser.getIdToken()}`;
    const payload = { phone, password };
    if (mode === 'register') { payload.firstName = isLink ? '' : firstName; payload.lastName = isLink ? '' : lastName; payload.email = isLink ? '' : email; payload.name = isLink ? (authUser?.displayName || authUser?.email || 'Customer') : name; payload.confirmPassword = confirmPassword; }
    const response = await fetch(`${BACKEND_URL}/api/auth/phone/${mode}`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'AUTH_ERROR');
    if (data.customToken) await signInWithCustomToken(auth, data.customToken);
    showToast(language === 'en' ? (mode === 'login' ? 'Signed in successfully.' : 'Account created successfully.') : (mode === 'login' ? 'تم تسجيل الدخول بنجاح.' : 'تم إنشاء الحساب بنجاح.'));
  } catch (error) {
    const messages = { NAME_REQUIRED: 'الاسم مطلوب.', PIN_CONFIRMATION_MISMATCH: 'كلمتا المرور غير متطابقتين.', INVALID_PHONE_OR_PIN: 'تحقق من رقم الهاتف وكلمة المرور.', PHONE_ALREADY_REGISTERED: 'رقم الهاتف مستخدم مسبقاً', AUTH_INVALID_CREDENTIALS: 'رقم الهاتف أو كلمة المرور غير صحيحة', AUTH_RATE_LIMITED: 'محاولات كثيرة. حاول لاحقاً.', AUTH_BACKEND_NOT_CONFIGURED: 'تسجيل الهاتف غير مهيأ على الخادم.', AUTH_DATABASE_ERROR: 'تعذر حفظ الحساب حالياً.', AUTH_TOKEN_SIGNING_ERROR: 'تعذر إكمال تسجيل الدخول حالياً.' };
    const field = error.message === 'NAME_REQUIRED' ? 'phoneFirstNameInput' : error.message === 'PIN_CONFIRMATION_MISMATCH' ? 'phoneRegisterConfirm' : error.message === 'INVALID_PHONE_OR_PIN' ? (mode === 'login' ? 'phonePinInput' : 'phoneRegisterPin') : null;
    if (field) setFieldError(form, field, language === 'en' ? (error.message === 'NAME_REQUIRED' ? 'Name is required.' : error.message === 'PIN_CONFIRMATION_MISMATCH' ? 'Passwords do not match.' : 'Check the phone number and password.') : messages[error.message]); else showToast(language === 'en' ? 'Could not complete the request.' : (messages[error.message] || 'تعذر إكمال الطلب.'));
  } finally { submit.disabled = false; submit.textContent = originalLabel; }
}

async function submitChangePin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const currentPassword = $('currentPinInput').value.trim();
  const newPassword = $('newPinInput').value.trim();
  const confirmPassword = $('newPinConfirmInput').value.trim();
  const legacyCurrentPin = /^\d{4}$/.test(englishDigits(currentPassword));
  if ((!legacyCurrentPin && !/^\S{6,128}$/.test(currentPassword)) || !/^\S{6,128}$/.test(newPassword) || newPassword !== confirmPassword) { showToast(language === 'en' ? 'Use a valid current credential and a new password of at least 6 characters.' : 'استخدم كلمة المرور الحالية الصحيحة وكلمة مرور جديدة من 6 أحرف على الأقل.'); return; }
  submit.disabled = true;
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/phone/change-pin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authUser.getIdToken()}` }, body: JSON.stringify({ phone: authUser.phoneNumber || '00000000000', currentPassword, newPassword, confirmPassword }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'AUTH_ERROR');
    form.reset(); showToast(language === 'en' ? 'Password changed successfully.' : 'تم تغيير كلمة المرور بنجاح.');
  } catch (error) { showToast(language === 'en' ? 'Could not change password.' : (error.message === 'AUTH_INVALID_CREDENTIALS' ? 'كلمة المرور الحالية غير صحيحة.' : 'تعذر تغيير كلمة المرور.')); }
  finally { submit.disabled = false; }
}

// ===== Chatbot =====
function openChat() { if ($('chatbotContainer').classList.contains('hidden')) { $('chatbotContainer').classList.remove('hidden'); setScrollLock(true); } }
function closeChat() { if (!$('chatbotContainer').classList.contains('hidden')) { $('chatbotContainer').classList.add('hidden'); setScrollLock(false); } }

const CHAT_STATE_KEY = 'spider.chat.state.v1';
let chatState = (() => { try { return JSON.parse(localStorage.getItem(CHAT_STATE_KEY) || '{}'); } catch { return {}; } })();
function saveChatState() { try { localStorage.setItem(CHAT_STATE_KEY, JSON.stringify(chatState)); } catch {} }

function appendChat(text, user = false, products = []) {
  const msg = document.createElement('div');
  msg.className = `message ${user ? 'user-message' : 'bot-message'}`;
  msg.textContent = englishDigits(text);
  products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'chat-product';
    card.innerHTML = `<img src="${esc(p.image || imageFor(p))}" alt=""><div><strong>${esc(productName(p))}</strong><span>${p.builderOnly === true ? builderOnlyLabelMarkup() : formatPrice(validPrice(p.price) ?? productPrice(p))}</span><small>${p.available ? (language === 'en' ? 'Available' : 'متوفر') : (language === 'en' ? 'Unavailable' : 'غير متوفر')}</small><div class="chat-product-actions"><button type="button" data-chat-open>عرض المنتج</button>${p.builderOnly === true ? '' : '<button type="button" data-chat-cart>أضف للسلة</button>'}</div></div>`;
    card.querySelector('[data-chat-open]').addEventListener('click', (e) => { e.stopPropagation(); openProductDetails(p.id); });
    card.querySelector('[data-chat-cart]').addEventListener('click', (e) => { e.stopPropagation(); if (p.available) { addToCart(p.id); showToast(t('added')); } });
    card.addEventListener('click', () => openProductDetails(p.id));
    msg.append(card);
  });
  $('chatMessages').append(msg);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

function setChatBusy(busy) {
  $('sendChatBtn').disabled = busy;
  $('chatInput').disabled = busy;
  $('chatQuickReplies').querySelectorAll('button').forEach((button) => { button.disabled = busy; });
}

function appendTyping() {
  const msg = document.createElement('div');
  msg.className = 'message bot-message chat-typing';
  msg.id = 'chatTyping';
  msg.innerHTML = `<span>${language === 'en' ? 'Thinking' : 'جاري التفكير'}</span><i></i><i></i><i></i>`;
  $('chatMessages').append(msg);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

function chatAllowsOverBudget(text) { return /(ممكن\s*(أزيد|ازيد)|زيدلي|أقرب\s*شي\s*فوق|حتى\s*لو\s*أغلى|حتى\s*لو\s*اغلى|over\s*budget|more\s*expensive)/i.test(englishDigits(text)); }
function chatBudgetFromText(text) {
  const value = englishDigits(text).match(/(?:^|\s)(?:ميزانيتي|بحدود|حدودي|عندي|تحت|لا\s*يتجاوز|ما\s*أريد\s*أتجاوز|ما\s*اريد\s*اتجاوز)\s*(\d[\d,.]*|خمسين|مئة|مائه|عشرين|ثلاثين|أربعين|خمسين|ستين|سبعين|ثمانين|تسعين)\s*(ألف|الف|آلاف|k)?/i);
  if (!value) return null;
  const words = { خمسين: 50, مئة: 100, مائه: 100, عشرين: 20, ثلاثين: 30, أربعين: 40, اربعين: 40, ستين: 60, سبعين: 70, ثمانين: 80, تسعين: 90 };
  const raw = Number(value[1].replace(/[^0-9]/g, '')) || words[value[1]];
  let budget = Number.isFinite(raw) ? raw * (value[2] || raw < 1000 ? 1000 : 1) : null;
  const increase = englishDigits(text).match(/(?:^|\s)(?:زيدلي|أزيد|ازيد)\s*(\d[\d,.]*)\s*(ألف|الف|آلاف|k)?/i);
  if (increase && budget) { const extra = Number(increase[1].replace(/[^0-9]/g, '')); budget += extra * (increase[2] || extra < 1000 ? 1000 : 1); }
  return budget;
}

async function respondChat(text) {
  const body = { message: text.slice(0, 600), language, state: chatState, history: [...document.querySelectorAll('#chatMessages .message')].slice(-6).map((m) => ({ role: m.classList.contains('user-message') ? 'user' : 'assistant', content: m.textContent.slice(0, 500) })) };
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authUser) headers.Authorization = `Bearer ${await authUser.getIdToken()}`;
    const response = await fetch(`${BACKEND_URL}/api/store/chat`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'CHAT_UNAVAILABLE');
    chatState = data.state || chatState; saveChatState();
    const budget = chatBudgetFromText(text);
    const hasNumericIncrease = /(?:زيدلي|أزيد|ازيد)\s*\d/i.test(englishDigits(text));
    const products = Array.isArray(data.products) ? data.products.filter((product) => !budget || (!hasNumericIncrease && chatAllowsOverBudget(text)) || Number(product.price) <= budget) : [];
    appendChat(data.reply || (language === 'en' ? 'Please try again.' : 'جرّب مرة ثانية.'), false, products.slice(0, 3));
  } catch (error) {
    const chat = state.settings.chatbotSettings || state.settings;
    const unavailable = language === 'en' ? (chat.aiUnavailableEn || 'The assistant is currently unavailable. Please try again later.') : (chat.aiUnavailableAr || 'المساعد غير متاح حالياً، جرّب مرة ثانية بعد شوي.');
    appendChat(language === 'en' ? 'Something went wrong. Please try again.' : 'صار خلل بسيط، جرّب مرة ثانية.');
  } finally {
    $('chatTyping')?.remove();
    setChatBusy(false);
    $('chatInput').focus();
  }
}

function handleChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  appendChat(text, true);
  input.value = '';
  appendTyping();
  setChatBusy(true);
  respondChat(text);
}

function normalizeIraqPhone(value) {
  const digits = englishDigits(value).replace(/[^0-9+]/g, '').replace(/^00/, '+');
  if (/^07[3-9][0-9]{8}$/.test(digits)) return `+964${digits.slice(1)}`;
  if (/^\+9647[3-9][0-9]{8}$/.test(digits)) return digits;
  if (/^9647[3-9][0-9]{8}$/.test(digits)) return `+${digits}`;
  return '';
}
// ===== Checkout =====
function openCheckout() {
  const unavailable = state.cart.find((item) => !cartProduct(item));
  if (unavailable) {
    showToast(language === 'en' ? `Remove unavailable product: ${cartItemLabel(unavailable)}` : `أزل المنتج غير المتوفر: ${cartItemLabel(unavailable)}`);
    openCart();
    return;
  }
  const total = state.cart.reduce((sum, item) => { const p = cartProduct(item); return sum + (p ? (item.builderSource ? builderProductPrice(p) : productPrice(p)) * item.qty : 0); }, 0);
  $('checkoutSubtotal').textContent = formatPrice(total);
  updateCheckoutFulfilment(total);
  closeCart();
  modal('checkoutModal', true);
}

function requestId() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function checkoutPayload(form) {
  const data = new FormData(form);
  const deliveryMethod = data.get('deliveryMethod') === 'pickup' ? 'pickup' : 'delivery';
  const builderPartByProductId = Object.fromEntries(builderParts.flatMap((part) => builderSelectionIds(part.id).map((productId) => [String(productId), part.id])));
  const items = state.cart.map((i) => ({ id: String(i.id), qty: Number(i.qty), source: i.builderSource ? 'builder' : 'store', ...(i.builderSource && builderPartByProductId[String(i.id)] ? { builderPart: builderPartByProductId[String(i.id)] } : {}) })).filter((i) => i.id && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 100);
  if (!items.length || items.length !== state.cart.length) throw new Error('CART_INVALID');
  return { requestId: requestId(), items, pricingTier: normalizePricingTier(state.accountProfile), deliveryMethod, customer: { name: String(data.get('customerName') || '').trim(), phone: String(data.get('customerPhone') || '').trim(), governorate: String(data.get('governorate') || '').trim(), district: String(data.get('district') || '').trim(), subdistrict: String(data.get('subdistrict') || '').trim(), neighborhood: String(data.get('neighborhood') || '').trim(), addressDetails: String(data.get('addressDetails') || '').trim(), notes: String(data.get('notes') || '').trim() } };
}

function updateCheckoutFulfilment(subtotal = null) {
  const form = $('checkoutForm');
  if (!form) return;
  const method = form.querySelector('input[name="deliveryMethod"]:checked')?.value === 'pickup' ? 'pickup' : 'delivery';
  const delivery = method === 'delivery';
  $('deliveryFields')?.toggleAttribute('hidden', !delivery);
  ['orderGov', 'orderDistrict', 'orderAddress'].forEach((id) => $(id)?.toggleAttribute('required', delivery));
  const total = subtotal ?? (Number(String($('checkoutSubtotal')?.textContent || '').replace(/[^0-9.]/g, '')) || 0);
  const fee = delivery ? Number(deliveryFee || 0) : 0;
  $('checkoutDeliveryFee').textContent = formatPrice(fee);
  $('checkoutDeliveryRow')?.toggleAttribute('hidden', !delivery);
  $('checkoutTotal').textContent = formatPrice(total + fee);
}

function checkoutDebugSummary(payload) {
  const items = payload.items || [];
  const subtotal = items.reduce((sum, item) => {
    const cartItem = state.cart.find((entry) => String(entry.id) === String(item.id));
    const product = cartItem ? cartProduct(cartItem) : null;
    const unitPrice = cartItem?.builderSource ? builderProductPrice(product) : productPrice(product);
    return sum + (Number(unitPrice) || 0) * Number(item.qty || 0);
  }, 0);
  return { itemCount: items.length, productIds: items.map((item) => item.id), quantities: items.map((item) => item.qty), subtotal, deliveryFee: Number(deliveryFee || 0), total: subtotal + Number(deliveryFee || 0), orderType: items.some((item) => item.source === 'builder') ? 'builder' : 'normal', builderItems: items.filter((item) => item.source === 'builder').length };
}

async function submitCheckout(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  const label = submit.textContent;
  try {
    const payload = checkoutPayload(event.currentTarget);
    const debugSummary = checkoutDebugSummary(payload);
    console.log('Checkout payload summary', debugSummary);
    submit.disabled = true; submit.textContent = language === 'en' ? 'Validating and saving...' : 'جارٍ التحقق والحفظ...';
    const headers = { 'Content-Type': 'application/json', 'X-Request-Id': payload.requestId };
    if (authUser) headers.Authorization = `Bearer ${await authUser.getIdToken()}`;
    const response = await fetch(`${BACKEND_URL}/api/store/checkout`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      console.error('Checkout failed', { status: response.status, code: result.code || result.error || 'CHECKOUT_FAILED', message: result.message || null, validationStage: result.validationStage || null, details: result.details || null, requestId: payload.requestId, summary: debugSummary });
      throw new Error(result.error || result.code || 'CHECKOUT_FAILED');
    }
    const orderSnapshot = { ...result, deliveryMethod: payload.deliveryMethod, orderId: result.orderId, orderNumber: result.orderNumber, timestamp: Date.now(), customerName: payload.customer.name, customerPhone: payload.customer.phone, governorate: payload.customer.governorate, district: payload.customer.district, subdistrict: payload.customer.subdistrict, neighborhood: payload.customer.neighborhood, addressDetails: payload.customer.addressDetails, notes: payload.customer.notes, items: result.items || [] };
    pendingReceipt = { order: orderSnapshot, language, whatsappNumber: storeWhatsAppNumber() };
    state.cart = []; renderCart(); modal('checkoutModal', false);
    const successNumber = $('orderSuccessNumber'); if (successNumber) successNumber.textContent = `${language === 'en' ? 'Order number' : 'رقم الطلب'}: ${result.orderNumber}`;
    $('orderSuccessTitle').textContent = language === 'en' ? 'Order created successfully' : 'تم إنشاء الطلب بنجاح';
    $('downloadReceiptBtn').textContent = language === 'en' ? 'Download receipt PDF' : 'تحميل الوصل PDF';
    setReceiptShareMode();
    modal('orderSuccessModal', true);
  } catch (e) {
    const code = e.message;
    const unavailableMatch = String(code || '').match(/^PRODUCT_UNAVAILABLE_(.+)$/);
    if (unavailableMatch) {
      const unavailableItem = state.cart.find((item) => String(item.id) === unavailableMatch[1]);
      showToast(language === 'en' ? `Product unavailable: ${cartItemLabel(unavailableItem) || unavailableMatch[1]}. Remove it from your cart.` : `المنتج «${cartItemLabel(unavailableItem) || unavailableMatch[1]}» لم يعد متوفراً. أزله من السلة ثم أعد المحاولة.`);
    } else showToast(code === 'ORDER_BACKEND_NOT_CONFIGURED'
      ? (language === 'en' ? 'Checkout is paused: the Worker needs the Firebase secret before saving.' : 'إتمام الطلب متوقف: يحتاج Worker إلى سر Firebase قبل الحفظ.')
      : code === 'DELIVERY_FEE_NOT_CONFIGURED'
        ? (language === 'en' ? 'Set the delivery fee in Admin first.' : 'اعتمد رسم التوصيل من الأدمن أولاً.')
        : (language === 'en' ? 'Could not save the order; your cart is still intact.' : 'تعذر حفظ الطلب؛ بقيت السلة كما هي.'));
  } finally { submit.disabled = false; submit.textContent = label; }
}

// ===== Sidebar Close =====
function closeSidebar() { const wasOpen = $('sidebarMenu')?.classList.contains('open'); $('sidebarMenu').classList.remove('open'); $('sidebarOverlay').classList.remove('open'); if (wasOpen) setScrollLock(false); }

// ===== Bind All Events =====
function bindBuilderPageEvents() {
  $('openCartBtn')?.addEventListener('click', openCart);
  $('floatingCartBtn')?.addEventListener('click', openCart);
  $('closeCartBtn')?.addEventListener('click', closeCart);
  $('cartOverlay')?.addEventListener('click', closeCart);
  $('quoteBuilderBtn')?.addEventListener('click', () => openQuote());
  $('closeBuilderPickerBtn')?.addEventListener('click', () => modal('builderPickerModal', false));
  $('builderPickerModal')?.addEventListener('click', (event) => { if (event.target === $('builderPickerModal')) modal('builderPickerModal', false); });
  $('builderPickerSearch')?.addEventListener('input', renderBuilderPickerGrid);
  $('builderCatalogSearch')?.addEventListener('input', (event) => { state.builderCatalog.search = event.target.value; renderBuilderCatalog(); });
  $('builderCatalogCategory')?.addEventListener('change', (event) => { state.builderCatalog.category = event.target.value; renderBuilderCatalog(); });
  $('builderCatalogBrand')?.addEventListener('change', (event) => { state.builderCatalog.brand = event.target.value; renderBuilderCatalog(); });
  $('addBuilderToCartBtn')?.addEventListener('click', () => { addMultipleToCart(selectedBuilderProducts().map(p => p.id), language === 'en' ? 'Builder added to cart.' : 'تمت إضافة التجميعة إلى السلة', 'builder'); });
  $('calculateBuilderPriceBtn')?.addEventListener('click', () => { state.builderPriceVisible = true; updateBuilder(); });
  $('clearBuilderBtn')?.addEventListener('click', clearBuilderSelections);
  $('closeQuoteBtn')?.addEventListener('click', () => modal('quoteModal', false));
  $('copyQuoteBtn')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('quoteModal').dataset.text || ''); showToast(language === 'en' ? 'Quote copied.' : 'تم نسخ عرض السعر.'); } catch { showToast(language === 'en' ? 'Copy failed.' : 'تعذر النسخ.'); } });
  $('shareQuoteBtn')?.addEventListener('click', () => { const wa = normalizeWhatsApp(state.settings.whatsappNumber || state.settings.whatsapp || '9647805700503'); if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent($('quoteModal').dataset.text || '')}`, '_blank', 'noopener'); });
  $('builderBackLink')?.addEventListener('click', () => { window.location.href = 'index.html'; });
}

function bindReceiptEvents() {
  $('closeOrderSuccessBtn')?.addEventListener('click', () => modal('orderSuccessModal', false));
  $('downloadReceiptBtn')?.addEventListener('click', async () => {
    if (!pendingReceipt) return;
    const button = $('downloadReceiptBtn'); const label = button.textContent; button.disabled = true; button.textContent = language === 'en' ? 'Preparing PDF...' : 'جارٍ تجهيز الوصل...';
    try {
      const file = await generateOrderReceiptPdf(pendingReceipt.order, pendingReceipt.language, { download: false, asFile: true });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { console.error('PDF_GENERATION_FAILED', { name: error?.name, message: error?.message, stack: error?.stack }); showToast(language === 'en' ? 'Could not create the receipt; you can continue via WhatsApp.' : 'تعذر إنشاء الوصل، يمكنك متابعة الطلب عبر واتساب.'); }
    finally { button.disabled = false; button.textContent = label; }
  });
  $('whatsappOrderBtn')?.addEventListener('click', async () => {
    if (!pendingReceipt?.whatsappNumber) return;
    const button = $('whatsappOrderBtn');
    button.disabled = true;
    try {
      const file = await generateOrderReceiptPdf(pendingReceipt.order, pendingReceipt.language, { download: false, asFile: true });
      const blobUrl = URL.createObjectURL(file);
      const link = document.createElement('a'); link.href = blobUrl; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      const waUrl = `https://wa.me/${pendingReceipt.whatsappNumber}`;
      const opened = window.open(waUrl, '_blank');
      if (!opened) window.location.href = waUrl;
      showToast(language === 'en' ? 'The receipt was downloaded. Attach it in the open WhatsApp chat.' : 'تم تحميل الوصل. أرفقه في محادثة واتساب المفتوحة.');
    } catch (error) {
      console.error('RECEIPT_SHARE_FAILED', { name: error?.name, message: error?.message, stack: error?.stack });
      showToast(language === 'en' ? 'Could not prepare the receipt.' : 'تعذر تجهيز الوصل.');
    } finally { button.disabled = false; setReceiptShareMode(); }
  });
}

function bindUpgradePageEvents() {
  $('addUpgradeToCartBtn')?.addEventListener('click', () => {
    const pids = Object.keys(state.upgrade).filter(k => state.upgradeIsNew[k]).map(k => state.upgrade[k]);
    addMultipleToCart(pids, language === 'en' ? 'Upgrades added to cart.' : 'تمت إضافة التجميعة إلى السلة');
  });

  $('openCartBtn')?.addEventListener('click', openCart);
  $('floatingCartBtn')?.addEventListener('click', openCart);
  $('closeCartBtn')?.addEventListener('click', closeCart);
  $('cartOverlay')?.addEventListener('click', closeCart);
  $('closeProductDetailsBtn')?.addEventListener('click', () => modal('productDetailsModal', false));
  $('closeUpgradePickerBtn')?.addEventListener('click', () => modal('upgradePickerModal', false));
  $('upgradePickerModal')?.addEventListener('click', (event) => { if (event.target === $('upgradePickerModal')) modal('upgradePickerModal', false); });
  $('upgradePickerSearch')?.addEventListener('input', renderUpgradePickerGrid);
  $('builderBackLink')?.addEventListener('click', () => { window.location.href = 'index.html'; });
  $('upgradeCatalogSearch')?.addEventListener('input', (event) => { state.upgradeCatalog.search = event.target.value; renderUpgradeResults(); });
  $('upgradeCatalogCategory')?.addEventListener('change', (event) => { state.upgradeCatalog.category = event.target.value; renderUpgradeResults(); });
  $('upgradeCatalogBrand')?.addEventListener('change', (event) => { state.upgradeCatalog.brand = event.target.value; renderUpgradeResults(); });
}

const IRAQ_ADDRESS_DATA = {
  'النجف': { 'قضاء النجف': ['مركز النجف'], 'الكوفة': ['مركز الكوفة', 'العباسية'], 'المناذرة': ['مركز المناذرة'] },
  'بغداد': { 'قضاء الرصافة': [], 'قضاء الكرخ': [] }, 'كربلاء': { 'قضاء كربلاء': [], 'الهندية': [] },
  'بابل': { 'الحلة': [], 'المحاويل': [] }, 'البصرة': { 'البصرة': [], 'الزبير': [] },
  'نينوى': { 'الموصل': [], 'تلعفر': [] }, 'الأنبار': { 'الرمادي': [], 'الفلوجة': [] },
  'ديالى': { 'بعقوبة': [], 'الخالص': [] }, 'واسط': { 'الكوت': [], 'الحي': [] },
  'ذي قار': { 'الناصرية': [], 'الشطرة': [] }, 'ميسان': { 'العمارة': [], 'المجر الكبير': [] },
  'القادسية': { 'الديوانية': [], 'الشامية': [] }, 'المثنى': { 'السماوة': [], 'الرميثة': [] },
  'صلاح الدين': { 'تكريت': [], 'سامراء': [] }, 'كركوك': { 'كركوك': [] }, 'أربيل': { 'أربيل': [] },
  'السليمانية': { 'السليمانية': [] }, 'دهوك': { 'دهوك': [] }
};
function fillSelect(select, items, placeholder) {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
  select.disabled = items.length === 0;
}
function bindAddressHierarchy() {
  const gov = $('orderGov'), district = $('orderDistrict'), subdistrict = $('orderSubdistrict');
  if (!gov || !district || !subdistrict) return;
  const govNames = Object.keys(IRAQ_ADDRESS_DATA);
  fillSelect(gov, govNames, language === 'en' ? 'Choose governorate...' : 'اختر المحافظة...');
  gov.addEventListener('change', () => {
    const districts = Object.keys(IRAQ_ADDRESS_DATA[gov.value] || {});
    fillSelect(district, districts, language === 'en' ? 'Choose district...' : 'اختر القضاء / الناحية...');
    fillSelect(subdistrict, [], language === 'en' ? 'Use neighborhood field...' : 'استخدم حقل الحي / المنطقة...');
  });
  district.addEventListener('change', () => fillSelect(subdistrict, IRAQ_ADDRESS_DATA[gov.value]?.[district.value] || [], language === 'en' ? 'Choose subdistrict...' : 'اختر المنطقة / الناحية...'));
}

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

  $('compareCategorySelect').addEventListener('change', () => { populateCompareProducts(); if ($('comparePickerCategory')) $('comparePickerCategory').value = $('compareCategorySelect').value; });
  $('compareBrandSelect').addEventListener('change', () => { populateCompareProducts(); if ($('comparePickerBrand')) $('comparePickerBrand').value = $('compareBrandSelect').value; });
  document.querySelectorAll('[data-compare-open]').forEach((button) => button.addEventListener('click', () => openComparePicker(button.dataset.compareOpen)));
  $('closeComparePickerBtn').addEventListener('click', () => modal('comparePickerModal', false));
  $('comparePickerModal').addEventListener('click', (event) => { if (event.target === $('comparePickerModal')) modal('comparePickerModal', false); });
  ['comparePickerSearch', 'comparePickerCategory', 'comparePickerBrand'].forEach((id) => $(id).addEventListener('input', renderComparePickerGrid));
  ['compareProd1Select', 'compareProd2Select'].forEach((id, index) => {
    $(id).addEventListener('change', () => {
      const otherId = index === 0 ? 'compareProd2Select' : 'compareProd1Select';
      if ($(id).value && $(id).value === $(otherId).value) {
        $(id).value = '';
        showToast(language === 'en' ? 'The same product cannot be selected twice.' : 'لا يمكن اختيار المنتج نفسه في المقارنة مرتين.');
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

  $('heroBuilderBtn').addEventListener('click', () => { window.location.href = 'builder.html'; });

  $('floatingCartBtn').addEventListener('click', openCart);
  $('openCartBtn').addEventListener('click', openCart);
  $('closeCartBtn').addEventListener('click', closeCart);
  $('cartOverlay').addEventListener('click', closeCart);
  $('clearCartBtn')?.addEventListener('click', openClearCartConfirm);
  $('closeClearCartBtn')?.addEventListener('click', () => modal('clearCartModal', false));
  $('cancelClearCartBtn')?.addEventListener('click', () => modal('clearCartModal', false));
  $('confirmClearCartBtn')?.addEventListener('click', clearCart);
  $('clearCartModal')?.addEventListener('click', (event) => { if (event.target === $('clearCartModal')) modal('clearCartModal', false); });
  $('checkoutBtn').addEventListener('click', openCheckout);
  $('closeCheckoutBtn').addEventListener('click', () => modal('checkoutModal', false));
  $('checkoutForm').addEventListener('submit', submitCheckout);
  $('checkoutForm').querySelectorAll('input[name="deliveryMethod"]').forEach((input) => input.addEventListener('change', () => updateCheckoutFulfilment()));
  bindAddressHierarchy();

  $('closeProductDetailsBtn').addEventListener('click', () => modal('productDetailsModal', false));
  $('productDetailsModal').addEventListener('click', (event) => {
    if (event.target === $('productDetailsModal')) modal('productDetailsModal', false);
  });
  $('closeQuoteBtn').addEventListener('click', () => modal('quoteModal', false));
  $('closeAccountBtn').addEventListener('click', () => modal('accountModal', false));
  $('closeAvailabilityBtn').addEventListener('click', () => modal('availabilityModal', false));

  $('availabilityForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const alerts = JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
    alerts.push({ productId: state.availabilityProductId, contact: $('availabilityContact').value.trim(), createdAt: Date.now() });
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    modal('availabilityModal', false);
    showToast(language === 'en' ? 'The alert request was saved on this device. Sending needs an enabled service.' : 'تم حفظ طلب التنبيه على جهازك. الإرسال يحتاج خدمة مفعّلة.');
  });

  $('mobileMenuBtn').addEventListener('click', () => { const wasOpen = $('sidebarMenu').classList.contains('open'); $('sidebarMenu').classList.add('open'); $('sidebarOverlay').classList.add('open'); if (!wasOpen) setScrollLock(true); });
  $('closeSidebarBtn').addEventListener('click', closeSidebar);
  $('sidebarOverlay').addEventListener('click', closeSidebar);

  $('accountBtn').addEventListener('click', () => { renderAccount('account'); modal('accountModal', true); });
  $('favBtn').addEventListener('click', () => { renderAccount('favorites'); modal('accountModal', true); });

  $('chatbotFab').addEventListener('click', openChat);
  $('closeChatBtn').addEventListener('click', closeChat);
  $('sendChatBtn').addEventListener('click', handleChat);
  $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleChat(); });
  $('chatQuickReplies').querySelectorAll('[data-chat]').forEach((btn) => btn.addEventListener('click', () => { $('chatInput').value = btn.dataset.chat; handleChat(); }));

  $('addBuilderToCartBtn')?.addEventListener('click', () => { addMultipleToCart(selectedBuilderProducts().map(p => p.id), language === 'en' ? 'Builder added to cart.' : 'تمت إضافة التجميعة إلى السلة'); });
  $('quoteBuilderBtn')?.addEventListener('click', () => openQuote());
  $('copyQuoteBtn')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('quoteModal').dataset.text || ''); showToast(t('copyQuote')); } catch { showToast(language === 'en' ? 'Copy failed.' : 'تعذر النسخ.'); } });
  $('shareQuoteBtn')?.addEventListener('click', () => { const wa = normalizeWhatsApp(state.settings.whatsappNumber || state.settings.whatsapp || '9647805700503'); if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent($('quoteModal').dataset.text || '')}`, '_blank', 'noopener'); });

  $('toggleBrandsBtn').addEventListener('click', () => { state.showBrands = !state.showBrands; renderBrands(); });

  // viewFullBuildBtn — scroll to builder
  const vfbBtn = $('viewFullBuildBtn');
  if (vfbBtn) vfbBtn.addEventListener('click', () => { window.location.href = 'builder.html'; });

  renderSidebarAll();
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const openModal = document.querySelector('.modal-overlay.open');
  if (openModal?.id === 'productDetailsModal') modal('productDetailsModal', false);
});

// ===== Firebase Listeners =====
const categoriesRef = ref(db, 'categories');
console.log('CATEGORY_DEBUG', {
  firebaseProjectId: firebaseConfig.projectId,
  databaseHost: new URL(firebaseConfig.databaseURL).hostname,
  appName: app.name,
  firebaseAppCount: getApps().length,
  categoriesRefPath: categoriesRef.toString().split('/').slice(-1)[0] || 'categories',
});
onValue(categoriesRef, (snapshot) => {
  let allCategories = [];
  try {
    const rawValue = snapshot.val();
    if (snapshot.exists() && rawValue && typeof rawValue === 'object') {
      Object.entries(rawValue).forEach(([id, value]) => allCategories.push(normalizeCategoryRecord(id, value)));
    }
    const enabledCategories = allCategories.filter((cat) => cat.enabled !== false && cat.isHidden !== true);
    const hiddenIds = new Set(allCategories
      .filter((cat) => cat.isHidden === true || cat.enabled === false)
      .map((cat) => String(cat.id)));
    state.categories = allCategories.filter((cat) => {
      if (cat.isHidden === true || cat.enabled === false || /^[-_]?test/i.test(`${cat.id} ${cat.name || ''}`)) return false;
      const parentId = categoryParentId(cat);
      return !parentId || !hiddenIds.has(parentId);
    });
    const topLevelCategories = state.categories.filter((cat) => categoryIsTopLevel(cat, state.categories));
    const childCategories = state.categories.filter((cat) => !!categoryParentId(cat));
    state.categoryLoad = 'loaded';
    console.log('CATEGORY_LOAD', {
      count: allCategories.length,
      topLevel: topLevelCategories.length,
    });
    console.log('CATEGORY_DEBUG', {
      firebaseProjectId: firebaseConfig.projectId,
      databaseHost: new URL(firebaseConfig.databaseURL).hostname,
      categoriesRefPath: 'categories',
      snapshotExists: snapshot.exists(),
      rawType: snapshot.val() === null ? 'null' : Array.isArray(snapshot.val()) ? 'array' : typeof snapshot.val(),
      rawCount: allCategories.length,
      enabledCount: enabledCategories.length,
      topLevelCount: topLevelCategories.length,
      childCount: childCategories.length,
      renderedCount: topLevelCategories.length,
      errorCode: null,
      errorMessage: null,
    });
    renderCategories();
    renderBuilder();
    renderUpgrade();
    populateCompareFilters();
  } catch (error) {
    state.categories = [];
    state.categoryLoad = 'error';
    console.error('CATEGORY_LOAD_ERROR', {
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack || null,
      count: allCategories.length,
      topLevel: 0,
    });
  } finally {
    if (state.categoryLoad === 'loading') state.categoryLoad = 'error';
    renderCategories();
  }
}, (error) => {
  state.categories = [];
  state.categoryLoad = 'error';
  console.error('CATEGORY_DEBUG', {
    firebaseProjectId: firebaseConfig.projectId,
    databaseHost: new URL(firebaseConfig.databaseURL).hostname,
    categoriesRefPath: 'categories',
    snapshotExists: false,
    rawType: null,
    rawCount: 0,
    enabledCount: 0,
    topLevelCount: 0,
    childCount: 0,
    renderedCount: 0,
    errorCode: error?.code || null,
    errorMessage: error?.message || String(error),
  });
  renderCategories();
});

onValue(ref(db, 'products'), (snapshot) => {
  state.products = [];
  if (snapshot.exists()) snapshot.forEach((child) => {
    const prod = { id: child.key, ...child.val() };
    if (prod.status === 'published' && !prod.isHidden) state.products.push(prod);
  });
  state.productsLoaded = true;
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

onValue(ref(db, 'builder_discounts'), (snapshot) => {
  state.builderDiscounts = snapshot.exists() ? snapshot.val() || {} : {};
  renderBuilder();
});

onAuthStateChanged(auth, async (user) => {
  authUser = user;
  state.accountProfile = user ? normalizeAccountProfile(user, { pricing_tier: 'public', accountType: 'public' }) : null;
  state.privatePrices = {};
  updateAccountGreeting();
  if (user) {
    try { await loadAccountProfile(user); } catch (error) { console.error('Account profile load failed', { code: error?.code || 'PROFILE_LOAD_FAILED' }); }
  } else state.accountOrders = [];
  updateAccountGreeting();
  if (user) user.getIdToken().then((token) => fetch(`${BACKEND_URL}/api/store/prices`, { headers: { Authorization: `Bearer ${token}` } })).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.prices) { const tier = data.pricing_tier || data.accountType || 'public'; state.accountProfile = { ...state.accountProfile, pricing_tier: tier, accountType: tier }; state.privatePrices = data.prices; renderProducts(); renderCart(); renderAccount(); } }).catch(() => {});
  loadFavorites();
  updateFavoriteBadge();
  renderProducts();
  renderAccount();
});

// ===== Init =====
bindAppearanceEvents();
bindReceiptEvents();
readCart();
readBuilder();
readUpgrade();
loadFavorites();
if (document.body.dataset.page === 'builder') bindBuilderPageEvents();
else if (document.body.dataset.page === 'upgrade') bindUpgradePageEvents();
else bindEvents();
updateFavoriteBadge();
renderCart();
renderAccount();
// Render the independent builder/upgrade surfaces immediately as well as
// after Firebase updates, so the page never opens as an empty shell.
renderBuilder();
localizeDom();

