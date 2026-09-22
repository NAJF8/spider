import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { CATALOG_TRANSLATIONS } from './catalog-translations.js';

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
  comparePickerSlot: 0,
  builder: {},
  builderCatalog: { part: '', category: '', brand: '', search: '' },
  availabilityProductId: ''
};

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
    cart: 'سلة المشتريات', emptyCart: 'السلة فارغة', total: 'المجموع الكلي', checkout: 'إتمام الطلب', close: 'إغلاق',
    checkoutTitle: 'إتمام الطلب', fullName: 'الاسم الكامل', phone: 'رقم الهاتف (07XXXXXXXXX)', chooseGovernorate: 'اختر المحافظة...', city: 'المدينة / المنطقة', address: 'العنوان التفصيلي', notes: 'ملاحظات إضافية (اختياري)', confirmOrder: 'تأكيد وحفظ الطلب ثم فتح واتساب', orderNote: 'لن تُفرغ السلة إذا فشل التحقق أو حفظ الطلب.',
    details: 'التفاصيل', addToCart: 'أضف للسلة', notify: 'نبّهني عند التوفر', available: 'متوفر', limited: 'كمية محدودة', unavailable: 'غير متوفر',
    account: 'حسابي والمفضلة', loginHint: 'سجّل دخولك لحفظ المفضلة على هذا الجهاز باسم حسابك.', google: 'متابعة عبر Google', phoneOtp: 'متابعة برقم الهاتف OTP',
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
    cart: 'Shopping cart', emptyCart: 'Your cart is empty', total: 'Total', checkout: 'Checkout', close: 'Close', checkoutTitle: 'Checkout', fullName: 'Full name', phone: 'Phone number (07XXXXXXXXX)', chooseGovernorate: 'Choose governorate...', city: 'City / area', address: 'Detailed address', notes: 'Additional notes (optional)', confirmOrder: 'Confirm order, save, then open WhatsApp', orderNote: 'Your cart will stay intact if validation or saving fails.',
    details: 'Details', addToCart: 'Add to cart', notify: 'Notify me when available', available: 'Available', limited: 'Limited quantity', unavailable: 'Unavailable', account: 'Account & favorites', loginHint: 'Sign in to save favorites on this device.', google: 'Continue with Google', phoneOtp: 'Continue with phone OTP', favorites: 'Favorites', open: 'Open', noFavorites: 'You have not added any favorites yet.', logout: 'Sign out',
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
  'التردد': 'Refresh rate', 'الحجم': 'Size', 'الدقة': 'Resolution', 'الرام': 'RAM',
  'السرعة': 'Speed', 'السعة': 'Capacity', 'الشاشة': 'Display', 'الصوت المحيطي': 'Surround sound',
  'المعالج': 'Processor', 'المعمارية': 'Architecture', 'النوع': 'Type', 'ذاكرة الرسوميات': 'Graphics memory',
  'كرت الشاشة': 'Graphics card', 'منحنية': 'Curved', 'بوصة': 'inch'
};
const localizedAttribute = (value) => {
  if (typeof value === 'object') return value?.[language] || value?.ar || value?.en || '';
  return language === 'en' ? (ATTRIBUTE_TRANSLATIONS[String(value)] || value) : value;
};

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
  'تبديل اللغة': ['Switch language', 'تبديل اللغة'], 'النجف': ['Najaf', 'النجف'], 'بغداد': ['Baghdad', 'بغداد'], 'كربلاء': ['Karbala', 'كربلاء'], 'بابل': ['Babylon', 'بابل'], 'البصرة': ['Basra', 'البصرة'], 'أربيل': ['Erbil', 'أربيل'], 'أخرى': ['Other', 'أخرى']
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
  document.body?.setAttribute('data-theme', theme);
  document.title = language === 'en'
    ? (document.body?.dataset.page === 'builder' ? 'Upgrade your PC | Spider Electronics' : 'Spider Electronics | Computer & Electronics Store')
    : (document.body?.dataset.page === 'builder' ? 'طوّر حاسبتك | سبايدر للإلكترونيات' : 'سبايدر للإلكترونيات | متجر الأجهزة والكمبيوتر');
  const themeButton = $('themeToggle');
  const languageButton = $('languageToggle');
  if (themeButton) { themeButton.innerHTML = `<i class="fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`; themeButton.title = theme === 'dark' ? t('themeLight') : t('themeDark'); themeButton.setAttribute('aria-label', themeButton.title); }
  if (languageButton) { languageButton.textContent = t('languageButton'); languageButton.title = language === 'ar' ? 'English' : 'العربية'; }
  localizeBuilderPage();
}

function localizeBuilderPage() {
  if (document.body?.dataset.page !== 'builder') return;
  const text = { builderPageTitle: t('upgrade'), builderPageIntro: language === 'en' ? 'Choose products from their cards to build your PC.' : 'اختر المنتجات من بطاقاتها لبناء تجميعتك.', builderTitle: t('upgrade'), builderIntro: language === 'en' ? 'Choose products from their cards and build your PC step by step.' : 'اختر القطع من بطاقاتها وصمّم تجميعتك خطوة بخطوة.', builderCategoryLabel: t('builderCategory'), builderBrandLabel: t('builderBrand'), builderCatalogTitle: t('builderCatalogTitle'), builderSummaryTitle: t('builderSummary'), builderSummaryHint: t('builderHint') };
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
}

function bindAppearanceEvents() {
  $('themeToggle')?.addEventListener('click', () => setTheme());
  $('languageToggle')?.addEventListener('click', () => setLanguage());
  applyAppearance();
}

let deliveryFee = 0;
let lowStockThreshold = 3;
let authUser = null;

// ===== Utilities =====
const $ = (id) => document.getElementById(id);
const englishDigits = (v) => String(v ?? '').replace(/[٠-٩۰-۹]/g, (digit) => {
  const code = digit.charCodeAt(0);
  return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
});
const esc = (v) => englishDigits(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const formatPrice = (value) => `${Number(value || 0).toLocaleString('en-IQ')} د.ع`;
const normalizeWhatsApp = (v) => String(v || '').replace(/[^0-9]/g, '').replace(/^00/, '');
const safeUrl = (v) => { try { const u = new URL(String(v || '').trim()); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const productStock = (p) => p?.stockQuantity ?? p?.stock;
const isAvailable = (p) => p && p.inStock !== false && (productStock(p) === undefined || Number(productStock(p)) > 0);
const stockLabel = (p) => { if (!isAvailable(p)) return [t('unavailable'), 'out']; const s = productStock(p); if (s !== undefined && Number(s) <= lowStockThreshold) return [t('limited'), 'limited']; return [t('available'), 'in']; };
const imageFor = (p) => p?.image || 'images/default-product.svg';
const categoryName = (id) => categoryLabel(state.categories.find((c) => c.id === id)) || id || (language === 'en' ? 'Unknown' : 'غير محدد');
const categoryIdFor = (p) => p?.categoryId || p?.category || '';
const productText = (p) => [productName(p), p?.name, p?.nameAr, p?.nameEn, p?.brand, p?.model, categoryName(categoryIdFor(p)), p?.description, ...Object.values(p?.specifications || {})].filter(Boolean).join(' ').toLowerCase();
const showToast = (msg) => { const t = $('toast'); if (!t) return; t.textContent = englishDigits(msg); t.classList.add('show'); clearTimeout(showToast._t); showToast._t = setTimeout(() => t.classList.remove('show'), 2800); };
const modal = (id, open) => $(id)?.classList.toggle('open', open);

// ===== Category fallbacks =====
// Firebase keeps any valid custom image URL. These local GitHub-hosted assets
// are used only when that URL is absent or fails to load.
const FALLBACK_IMAGES = {
  'cat-computers': 'assets/category-fallbacks/computer.svg',
  'cat-storage': 'assets/category-fallbacks/storage.svg?v=1',
  'cat-ram': 'assets/category-fallbacks/ram.svg',
  'cat-monitors': 'assets/category-fallbacks/monitor.svg',
  'cat-printers': 'assets/category-fallbacks/printer.svg',
  'cat-network': 'assets/category-fallbacks/network.svg',
  'cat-pc-parts': 'assets/category-fallbacks/pc-parts.svg',
  'cat-cpus': 'assets/category-fallbacks/cpu.svg',
  'cat-gpus': 'assets/category-fallbacks/gpu.svg',
  'cat-motherboards': 'assets/category-fallbacks/motherboard.svg',
  'cat-psu': 'assets/category-fallbacks/power.svg',
  'cat-cooling': 'assets/category-fallbacks/cooling.svg',
  'cat-cases': 'assets/category-fallbacks/computer.svg',
  'cat-accessories': 'assets/category-fallbacks/accessories.svg',
  'cat-power': 'assets/category-fallbacks/power.svg',
  'cat-security': 'assets/category-fallbacks/security.svg'
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
    if (key.includes(keyword)) return `assets/category-fallbacks/${asset}.svg`;
  }
  return 'assets/category-fallbacks/pc-parts.svg';
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

  const storeName = String(language === 'en' ? (settings.storeNameEn || 'Spider Electronics') : (settings.storeNameAr || settings.storeName || 'سبايدر للإلكترونيات'));
  const [name, ...tagline] = storeName.split(' ');
  if ($('brandName')) $('brandName').textContent = englishDigits(name || (language === 'en' ? 'Spider' : 'سبايدر'));
  if ($('brandTagline')) $('brandTagline').textContent = englishDigits(tagline.join(' ') || t('electronics'));

  if (settings.logoUrl && safeUrl(settings.logoUrl) && $('brandLogo')) $('brandLogo').src = settings.logoUrl;
  // The approved storefront hero copy is intentionally not overwritten by
  // optional admin settings. Product, category, image, and store data remain live.
  if (settings.heroImage && safeUrl(settings.heroImage) && $('heroImage')) $('heroImage').src = settings.heroImage;
  const welcome = language === 'en' ? (settings.welcomeMessageEn || settings.welcomeMessage) : (settings.welcomeMessageAr || settings.welcomeMessage);
  if (welcome && $('chatWelcome')) $('chatWelcome').textContent = englishDigits(welcome);

  // Hero CTA button
  if ($('heroBuilderBtn')) {
    $('heroBuilderBtn').replaceChildren(document.createTextNode(`${t('buildNow')} `));
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-arrow-left';
    $('heroBuilderBtn').append(icon);
  }

  const instagram = safeUrl(settings.instagramUrl || 'https://www.instagram.com/spider_najaf?stkn=MTM2ZXZpZXlxb2kzcg==') || 'https://www.instagram.com/spider_najaf?stkn=MTM2ZXZpZXlxb2kzcg==';
  const whatsapp = normalizeWhatsApp(settings.whatsappNumber || settings.whatsapp || settings.storePhone || '9647827337942');
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
  const categories = [...state.categories].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const row = $('categoriesRow');

  // Always show categories (no toggle)
  row.classList.remove('is-collapsed');
  state.showCategories = true;

  if (!categories.length) {
    row.innerHTML = `<div class="loading-state">${t('noSections')}</div>`;
    return;
  }


  row.innerHTML = categories.map((cat) => {
    const imgSrc = cat.image || categoryFallback(cat);
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

  // Sidebar nav
  $('sidebarNav').innerHTML = categories.map((cat) => {
    const hasSubs = cat.subcategoryIds && cat.subcategoryIds.length > 0;
    const imgHtml = cat.image
      ? `<img class="cat-icon" src="${esc(cat.image)}" alt="">`
      : `<i class="fa-solid ${esc(cat.icon || 'fa-folder')}"></i>`;
    return `<li>
      <button type="button" data-category-id="${esc(cat.id)}" ${hasSubs ? `aria-expanded="false"` : ''}>
        <span>${imgHtml} ${esc(categoryLabel(cat))}</span>
        ${hasSubs ? '<i class="fa-solid fa-chevron-down chevron"></i>' : ''}
      </button>
      ${hasSubs ? `<ul class="sidebar-sub" id="sub-${esc(cat.id)}">${cat.subcategoryIds.map(sid => {
        const sub = state.categories.find(c => c.id === sid);
        if (!sub) return '';
        return `<li><button type="button" data-category-id="${esc(sid)}">${esc(categoryLabel(sub))}</button></li>`;
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
      <div class="product-model">${esc(p.model || p.subcategory || '')}</div>
      <div>${availabilityMarkup(p)}</div>
      <div class="price-row">
        <strong class="product-price">${formatPrice(p.price)}</strong>
        ${p.originalPrice ? `<span class="old-price">${formatPrice(p.originalPrice)}</span>` : ''}
      </div>
      <div class="product-actions">
        ${isAvailable(p)
          ? `<button class="btn btn-primary" type="button" data-add="${esc(p.id)}"><i class="fa-solid fa-cart-plus"></i> ${t('addToCart')}</button>`
          : `<button class="btn stock-btn" type="button" data-alert="${esc(p.id)}"><i class="fa-regular fa-bell"></i> ${t('notify')}</button>`
        }
        <button class="btn btn-outline" type="button" data-details="${esc(p.id)}">${t('details')}</button>
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
  if (!$('brandsGrid')) return;
  const brands = [...new Set(state.products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $('brandsGrid').classList.toggle('is-collapsed', !state.showBrands);
  $('toggleBrandsBtn').setAttribute('aria-expanded', String(state.showBrands));
  $('toggleBrandsBtn').innerHTML = `${state.showBrands ? t('hideBrands') : t('showBrands')} <i class="fa-solid ${state.showBrands ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>`;
  $('brandsGrid').innerHTML = brands.length
    ? brands.map((brand) => {
        const prod = state.products.find((p) => p.brand === brand);
        const logo = prod?.brandLogo || prod?.logo;
        return `<button type="button" class="brand-item ${state.filters.brand === brand ? 'active' : ''}" data-brand="${esc(brand)}">${logo ? `<img class="brand-logo" src="${esc(logo)}" alt="${esc(brand)}">` : `<span class="brand-mark">${esc(brand.slice(0, 3).toUpperCase())}</span>`}<span>${esc(brand)}</span></button>`;
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
    ? matches.map((p) => `<button class="suggestion" type="button" data-suggestion="${esc(p.id)}"><img src="${esc(imageFor(p))}" alt=""><div><strong>${esc(productName(p))}</strong><small>${esc(p.brand || '')} · ${stockLabel(p)[0]}</small></div><b>${formatPrice(p.price)}</b></button>`).join('')
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
    state.categories.map((c) => `<option value="${esc(c.id)}">${esc(categoryLabel(c))}</option>`).join('');
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
      <img src="${esc(imageFor(p))}" alt="${esc(productName(p))}" onerror="this.src='images/default-product.svg'">
      <strong>${esc(productName(p))}</strong>
      <span>${esc(p.brand || t('unknown'))}${p.model ? ` · ${esc(p.model)}` : ''}</span>
      <b>${formatPrice(p.price)}</b>
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
      <div class="cpc-price">${formatPrice(p.price)}</div>
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

  const keys = [...new Set([...Object.keys(first.specifications || {}), ...Object.keys(second.specifications || {})])];
  const rows = keys.length
    ? keys.map((key) => `<div class="spec-row">
        <span>${esc(localizedAttribute(first.specifications?.[key]) || t('notAvailable'))}</span>
        <span class="spec-key">${esc(localizedAttribute(key))}</span>
        <span>${esc(localizedAttribute(second.specifications?.[key]) || t('notAvailable'))}</span>
      </div>`).join('')
    : `<div class="empty-state">${t('noSpecs')}</div>`;

  $('compareResults').innerHTML = `
    <div class="compare-result-cards">
      <div class="compare-card">
        <img src="${esc(imageFor(first))}" alt="${esc(productName(first))}">
        <h3>${esc(productName(first))}</h3>
        <strong>${formatPrice(first.price)}</strong>
        <div class="compare-result-actions">
          <button class="btn btn-primary" type="button" data-add="${esc(first.id)}">${t('addToCart')}</button>
          <button class="btn btn-outline" type="button" data-details="${esc(first.id)}">${t('details')}</button>
        </div>
      </div>
      <div class="compare-card">
        <img src="${esc(imageFor(second))}" alt="${esc(productName(second))}">
        <h3>${esc(productName(second))}</h3>
        <strong>${formatPrice(second.price)}</strong>
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
  { id: 'cpu',         label: 'المعالج CPU',       icon: 'fa-microchip',       match: /cpu|cpus|معالج|معالجات/i },
  { id: 'motherboard', label: 'اللوحة الأم',        icon: 'fa-border-all',      match: /motherboard|motherboards|لوحة|مذربورد/i },
  { id: 'ram',         label: 'الذاكرة RAM',        icon: 'fa-memory',          match: /ram|ذاكرة|رام/i },
  { id: 'gpu',         label: 'كرت الشاشة GPU',     icon: 'fa-display',         match: /gpu|كرت|كروت|vga/i },
  { id: 'storage',     label: 'التخزين',            icon: 'fa-hard-drive',      match: /ssd|nvme|m\.2|hdd|hard|هارد|تخزين/i },
  { id: 'psu',         label: 'مزود الطاقة PSU',    icon: 'fa-plug',            match: /psu|power|طاقة|مجهز/i },
  { id: 'case',        label: 'الصندوق Case',       icon: 'fa-box',             match: /case|صندوق/i },
  { id: 'cooling',     label: 'التبريد',            icon: 'fa-fan',             match: /cooling|تبريد/i }
];
const builderPartLabel = (part) => {
  const labels = language === 'en'
    ? { cpu: 'CPU', motherboard: 'Motherboard', ram: 'RAM', gpu: 'GPU', storage: 'Storage', psu: 'Power supply', case: 'Case', cooling: 'Cooling' }
    : { cpu: 'المعالج CPU', motherboard: 'اللوحة الأم', ram: 'الذاكرة RAM', gpu: 'كرت الشاشة GPU', storage: 'التخزين', psu: 'مزود الطاقة PSU', case: 'الصندوق Case', cooling: 'التبريد' };
  return labels[part?.id] || part?.label || (language === 'en' ? 'Part' : 'قطعة');
};

function productsForPart(part) {
  return state.products.filter((p) => {
    const text = `${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name || ''}`;
    if (part.id === 'gpu') return /gpu|gpus|كرت|كروت/i.test(text);
    if (part.id === 'storage') return /ssd|nvme|m\.2|hdd|hard|هارد|تخزين/i.test(text);
    return part.match.test(text);
  });
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
  category.innerHTML = `<option value="">${esc(t('allCategories'))}</option>` + state.categories.map((c) => `<option value="${esc(c.id)}">${esc(categoryLabel(c))}</option>`).join('');
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
    const selected = part && state.builder[part.id] === product.id;
    const available = isAvailable(product);
    const specs = topSpecs(product);
    return `<article class="builder-product-card ${selected ? 'is-selected' : ''}">
      <div class="builder-product-image"><img src="${esc(imageFor(product))}" alt="${esc(productName(product))}" loading="lazy" onerror="this.onerror=null;this.src='images/default-product.svg'"></div>
      <div class="builder-product-body"><span class="product-brand">${esc(product.brand || t('unknown'))}</span><h3>${esc(productName(product))}</h3><span class="builder-product-model">${esc(product.model || product.subcategory || '')}</span>${specs.length ? `<div class="builder-card-specs">${specs.map((spec) => `<span>${esc(spec)}</span>`).join('')}</div>` : ''}<div class="builder-product-meta"><strong>${formatPrice(product.price)}</strong>${availabilityMarkup(product)}</div><button class="btn ${selected ? 'btn-outline' : 'btn-primary'} builder-select-product" type="button" data-builder-product="${esc(product.id)}" ${!available ? 'disabled' : ''}><i class="fa-solid ${selected ? 'fa-check' : 'fa-plus'}"></i> ${selected ? t('selectedForBuild') : t('chooseForBuild')}</button></div>
    </article>`;
  }).join('') : `<div class="empty-state builder-empty-state">${t('noPublished')}</div>`;
  grid.querySelectorAll('[data-builder-product]').forEach((button) => button.addEventListener('click', () => {
    const product = state.products.find((item) => item.id === button.dataset.builderProduct);
    const part = product && builderPartForProduct(product);
    if (!product || !part) return;
    state.builder[part.id] = product.id;
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
  grid.innerHTML = products.length ? products.map((p) => `<button class="compare-picker-option" type="button" data-builder-pick="${esc(p.id)}"><img src="${esc(imageFor(p))}" alt="${esc(productName(p))}" onerror="this.src='images/default-product.svg'"><strong>${esc(productName(p))}</strong><span>${esc(p.brand || t('unknown'))}${p.model ? ` · ${esc(p.model)}` : ''}</span><b>${formatPrice(p.price)}</b><small class="stock ${stockLabel(p)[1]}">${esc(stockLabel(p)[0])}</small></button>`).join('') : `<div class="empty-state">${t('noPublished')}</div>`;
  grid.querySelectorAll('[data-builder-pick]').forEach((button) => button.addEventListener('click', () => {
    state.builder[state.builderPickerPart] = button.dataset.builderPick;
    saveBuilder(); renderBuilder(); modal('builderPickerModal', false);
  }));
}

// Get top 3 specs of a product for builder card display
function topSpecs(product) {
  const specs = Object.entries(product?.specifications || {});
  return specs.slice(0, 3).map(([k, v]) => `${localizedAttribute(k)}: ${localizedAttribute(v)}`);
}

function renderBuilder() {
  if (!$('builderPartsList')) return;
  const list = $('builderPartsList');
  const selected = builderParts.map((part) => ({ part, product: state.products.find((p) => p.id === state.builder[part.id]) })).filter((item) => item.product);
  list.innerHTML = selected.length ? selected.map(({ part, product }) => `<article class="builder-selected-card">
    <img src="${esc(imageFor(product))}" alt="${esc(productName(product))}" onerror="this.onerror=null;this.src='images/default-product.svg'">
    <div class="builder-selected-copy"><small>${esc(builderPartLabel(part))}</small><strong>${esc(productName(product))}</strong><span>${esc(product.model || product.brand || '')}</span></div>
    <b>${formatPrice(product.price)}</b>
    <div class="builder-selected-actions"><button class="btn btn-outline" type="button" data-builder-change="${esc(part.id)}"><i class="fa-solid fa-rotate"></i> ${t('change')}</button><button class="btn btn-outline" type="button" data-builder-remove="${esc(part.id)}"><i class="fa-solid fa-xmark"></i> ${t('clear')}</button></div>
  </article>`).join('') : `<div class="builder-selected-empty">${language === 'en' ? 'Choose a product card to start your build.' : 'اختر بطاقة منتج للبدء ببناء تجميعتك.'}</div>`;

  // Delegate interactions from the stable list container so freshly rendered
  // cards always retain working تغيير/مسح and selection controls.
  list.onclick = (event) => {
    const remove = event.target.closest('[data-builder-remove]');
    const change = event.target.closest('[data-builder-change]');
    const partId = remove?.dataset.builderRemove || change?.dataset.builderChange;
    if (!partId) return;
    if (change) { openBuilderPicker(partId); return; }
    delete state.builder[partId];
    saveBuilder();
    renderBuilder();
  };
  renderBuilderCatalog();
  updateBuilder();
}

const BUILDER_STORAGE_KEY = 'spider.builder.v1';
function readBuilder() {
  try { const saved = JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY) || '{}'); state.builder = saved && typeof saved === 'object' ? saved : {}; }
  catch { state.builder = {}; }
}
function saveBuilder() { localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(state.builder)); }

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
  if (!selected.length) return [language === 'en' ? 'Choose parts to check compatibility.' : 'اختر القطع لفحص التوافق.', ''];
  const cpu = selected.find((p) => /cpu|cpus|معالج|معالجات/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))}`));
  const mb  = selected.find((p) => /motherboard|لوحة|مذربورد/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))}`));
  const ram = selected.find((p) => /ram|ذاكرة|رام/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))}`));

  const reasons = [];
  const cpuSocket = specValue(cpu, ['socket', 'مقبس']);
  const mbSocket  = specValue(mb,  ['socket', 'مقبس']);
  if (cpuSocket && mbSocket && cpuSocket.toLowerCase() !== mbSocket.toLowerCase())
    reasons.push(language === 'en' ? `CPU socket ${cpuSocket} does not match motherboard socket ${mbSocket}.` : `مقبس المعالج ${cpuSocket} لا يطابق اللوحة ${mbSocket}.`);

  const ramType = specValue(ram, ['نوع الذاكرة', 'memory type', 'type']);
  const mbRam   = specValue(mb,  ['نوع الذاكرة', 'memory type', 'ram']);
  if (ramType && mbRam && /ddr[45]/i.test(ramType) && /ddr[45]/i.test(mbRam) &&
      ramType.match(/ddr[45]/i)?.[0].toLowerCase() !== mbRam.match(/ddr[45]/i)?.[0].toLowerCase())
    reasons.push(language === 'en' ? `Memory type ${ramType} does not match ${mbRam}.` : `نوع الذاكرة ${ramType} لا يطابق ${mbRam}.`);

  if (reasons.length) return [reasons.join(' '), 'bad'];

  // If some pairing parts exist but missing counterpart — inconclusive
  if ((cpu && !mb) || (mb && !cpu) || (ram && !mb))
    return [language === 'en' ? 'Compatibility needs technical review: some counterpart specifications are insufficient.' : 'التوافق يحتاج مراجعة فنية: بعض مواصفات القطع المقابلة غير كافية للحكم.', ''];

  if (selected.length >= 2)
    return [language === 'en' ? 'Published specifications show no known conflict; check dimensions and power before purchase.' : 'المواصفات المنشورة لا تظهر تعارضاً معروفاً؛ راجع الأبعاد والطاقة قبل الشراء.', 'ok'];

  return [language === 'en' ? 'Choose parts to check compatibility.' : 'اختر القطع لفحص التوافق.', ''];
}

function updateBuilder() {
  if (!$('builderTotal')) return;
  const selected = selectedBuilderProducts();
  const total = selected.reduce((sum, p) => sum + Number(p.price || 0), 0);
  $('builderTotal').textContent = formatPrice(total);
  if ($('builderStatus')) $('builderStatus').textContent = `${englishDigits(selected.length)} ${t('selectedParts')}`;
  const [msg, tone] = compatibilityStatus(selected);
  if ($('compatibilityBox')) { $('compatibilityBox').className = `compatibility-box ${tone}`; $('compatibilityBox').innerHTML = `<i class="fa-solid ${tone === 'bad' ? 'fa-circle-xmark' : tone === 'ok' ? 'fa-circle-check' : 'fa-circle-info'}"></i><span>${esc(msg)}</span>`; }
  if ($('addBuilderToCartBtn')) $('addBuilderToCartBtn').disabled = !selected.length;
  if ($('quoteBuilderBtn')) $('quoteBuilderBtn').disabled = !selected.length;
}

function quoteLines(products) {
  return products.map((p) => `<div class="quote-line"><img src="${esc(imageFor(p))}" alt=""><div>${esc(productName(p))}<strong>${formatPrice(p.price)}</strong></div></div>`).join('');
}

function openQuote(products = selectedBuilderProducts()) {
  if (!products.length) return;
  const total = products.reduce((sum, p) => sum + Number(p.price || 0), 0);
  $('quoteSummary').innerHTML = `${quoteLines(products)}<div class="quote-total"><span>${t('total')}</span><span>${formatPrice(total)}</span></div>`;
  $('quoteModal').dataset.text = products.map((p) => `${productName(p)}: ${formatPrice(p.price)}`).join('\n') + `\n${t('total')}: ${formatPrice(total)}`;
  modal('quoteModal', true);
}

// ===== UPGRADE =====
const UPGRADE_FALLBACK_IMAGES = {
  cpu: 'assets/category-fallbacks/cpu.svg',
  motherboard: 'assets/category-fallbacks/motherboard.svg',
  ram: 'assets/category-fallbacks/ram.svg',
  gpu: 'assets/category-fallbacks/gpu.svg',
  storage: 'assets/category-fallbacks/storage.svg',
  case: 'assets/category-fallbacks/computer.svg',
  cooling: 'assets/category-fallbacks/cooling.svg',
  psu: 'assets/category-fallbacks/power.svg'
};

function upgradeFallbackMarkup(field) {
  return `<div class="upgrade-preview-empty"><img src="${UPGRADE_FALLBACK_IMAGES[field.id]}" alt="${esc(field.label)}"><strong>${esc(field.label)}</strong><span>${language === 'en' ? 'Choose a published part to see its details' : 'اختر قطعة منشورة لعرض تفاصيلها'}</span></div>`;
}

function renderUpgrade() {
  if (!$('upgradeForm')) return;
  const fields = [
    { id: 'cpu',       label: language === 'en' ? 'Current CPU' : 'المعالج الحالي',      match: /cpu|cpus|معالج/i },
    { id: 'motherboard',label: language === 'en' ? 'Current motherboard' : 'اللوحة الأم الحالية', match: /motherboard|لوحة|مذربورد/i },
    { id: 'ram',       label: language === 'en' ? 'Current RAM' : 'الرام الحالية',        match: /ram|ذاكرة|رام/i },
    { id: 'gpu',       label: language === 'en' ? 'Current GPU' : 'كرت الشاشة الحالي',   match: /gpu|كرت|كروت/i },
    { id: 'storage',   label: language === 'en' ? 'Current storage' : 'التخزين الحالي',       match: /storage|هارد|ssd|hdd/i },
    { id: 'case',      label: language === 'en' ? 'Current case' : 'الكيس الحالي',             match: /case|صندوق/i },
    { id: 'cooling',   label: language === 'en' ? 'Current cooling' : 'التبريد الحالي',        match: /cooling|تبريد/i },
    { id: 'psu',       label: language === 'en' ? 'Current power supply' : 'مزود الطاقة الحالي', match: /psu|power|طاقة|مجهز/i }
  ];
  $('upgradeForm').innerHTML = fields.map((field) => {
    const options = state.products.filter((p) => field.match.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name}`));
    return `<div class="upgrade-field"><label for="upgrade-${field.id}">${field.label}</label><select id="upgrade-${field.id}" data-upgrade="${field.id}"><option value="">${t('unknown')}</option>${options.map((p) => `<option value="${esc(p.id)}">${esc(productName(p))}</option>`).join('')}</select><div class="upgrade-selection-preview" data-upgrade-preview="${field.id}">${upgradeFallbackMarkup(field)}</div></div>`;
  }).join('');
  $('upgradeForm').querySelectorAll('[data-upgrade]').forEach((sel) => sel.addEventListener('change', renderUpgradeResults));
  renderUpgradeSelectionPreviews();
}

function renderUpgradeSelectionPreviews() {
  if (!$('upgradeForm')) return;
  $('upgradeForm').querySelectorAll('[data-upgrade-preview]').forEach((preview) => {
    const select = $('upgradeForm').querySelector(`[data-upgrade="${preview.dataset.upgradePreview}"]`);
    const field = { id: preview.dataset.upgradePreview, label: select?.previousElementSibling?.textContent || preview.dataset.upgradePreview };
    const product = state.products.find((p) => p.id === select?.value);
    if (!product) {
      preview.innerHTML = upgradeFallbackMarkup(field);
      return;
    }
    const specs = topSpecs(product);
    preview.innerHTML = `<div class="upgrade-preview-card"><img src="${esc(imageFor(product))}" alt="${esc(productName(product))}" onerror="this.src='images/default-product.svg'"><div class="upgrade-preview-copy"><strong>${esc(productName(product))}</strong><span>${esc(product.brand || product.model || '')}</span>${specs.length ? `<small>${specs.map((spec) => esc(spec)).join(' · ')}</small>` : ''}</div><b>${formatPrice(product.price)}</b></div>`;
  });
}

function renderUpgradeResults() {
  if (!$('upgradeForm') || !$('upgradeResults')) return;
  const selected = [...$('upgradeForm').querySelectorAll('select')].map((sel) => state.products.find((p) => p.id === sel.value)).filter(Boolean);
  renderUpgradeSelectionPreviews();
  if (!selected.length) { $('upgradeResults').innerHTML = `<div class="empty-state">${t('chooseSpec')}</div>`; return; }
  const usedIds = new Set(selected.map((p) => p.id));
  const recs = state.products.filter((p) => !usedIds.has(p.id) && isAvailable(p)).filter((p) => /gpu|gpus|كرت|ram|ذاكرة|storage|تخزين|ssd|hdd|cpu|cpus|معالج/i.test(`${categoryIdFor(p)} ${categoryName(categoryIdFor(p))} ${p.name}`)).slice(0, 4);
  $('upgradeResults').innerHTML = `<p class="upgrade-note">${language === 'en' ? 'Suggestions use only published categories and specifications; compatibility is not guaranteed when device data is incomplete.' : 'الاقتراحات مبنية على القسم والمواصفات المتاحة فقط؛ لا ندّعي التوافق الكامل عند نقص بيانات جهازك.'}</p>${recs.length ? recs.map(productCard).join('') : `<div class="empty-state">${language === 'en' ? 'No matching published upgrade is available.' : 'لا توجد ترقية منشورة مطابقة حالياً.'}</div>`}`;
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
  showToast(t('added'));
}
window.addToCart = addToCart;

function renderCart() {
  if (!$('cartItemsList')) return;
  saveCart();
  const count = state.cart.reduce((sum, i) => sum + i.qty, 0);
  $('cartBadge').textContent = count;
  $('floatingCartBadge').textContent = count;
  let total = 0;
  const rows = state.cart.map((item, idx) => {
    const p = cartProduct(item);
    if (!p) return '';
    total += Number(p.price || 0) * item.qty;
    return `<div class="cart-item"><img src="${esc(imageFor(p))}" alt="${esc(productName(p))}"><div>
      <div class="cart-item-title">${esc(productName(p))}</div>
      <div class="cart-item-price">${formatPrice(Number(p.price || 0) * item.qty)}</div>
      <div class="cart-item-actions">
        <button class="qty-btn" type="button" data-qty="${idx}:1">+</button>
        <span>${item.qty}</span>
        <button class="qty-btn" type="button" data-qty="${idx}:-1">−</button>
        <button class="remove-btn" type="button" data-remove="${idx}"><i class="fa-solid fa-trash"></i></button>
      </div></div></div>`;
  }).filter(Boolean);
  $('cartItemsList').innerHTML = rows.length ? rows.join('') : `<div class="empty-state">${t('emptyCart')}</div>`;
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
  $('modalProductTitle').textContent = englishDigits(productName(p));
  $('productDetailsBody').innerHTML = `<div class="product-detail">
    <img src="${esc(imageFor(p))}" alt="${esc(productName(p))}">
    <div>
      <h3>${esc(productName(p))}</h3>
      <div class="detail-meta">${esc(p.brand || '')} ${p.model ? `· ${esc(p.model)}` : ''}</div>
      <div class="detail-price">${formatPrice(p.price)}</div>
      ${availabilityMarkup(p)}
      <p class="detail-meta">${esc(localizedAttribute(p.description) || t('noDescription'))}</p>
      <div class="spec-list">${specs.length ? specs.map(([k, v]) => `<div><strong>${esc(localizedAttribute(k))}</strong><span>${esc(localizedAttribute(v))}</span></div>`).join('') : `<div>${language === 'en' ? 'No additional published specifications' : 'لا توجد مواصفات إضافية منشورة'}</div>`}</div>
      <div class="detail-actions">
        ${isAvailable(p)
          ? `<button class="btn btn-primary" type="button" data-detail-add="${esc(p.id)}">${t('addToCart')}</button>`
          : `<button class="btn stock-btn" type="button" data-alert="${esc(p.id)}">${t('notify')}</button>`}
        <button class="btn btn-outline" type="button" data-favorite="${esc(p.id)}">${state.favorites.includes(p.id) ? (language === 'en' ? 'Remove from favorites' : 'إزالة من المفضلة') : (language === 'en' ? 'Add to favorites' : 'أضف للمفضلة')}</button>
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

function renderAccount() {
  if (!$('accountState') || !$('favoritesList')) return;
  const box = $('accountState');
  if (authUser) {
    box.innerHTML = `<div class="favorite-row"><img src="${esc(authUser.photoURL || 'assets/spider-bot.png')}" alt=""><div>${esc(authUser.displayName || authUser.email || (language === 'en' ? 'Google account' : 'حساب Google'))}<small>${esc(authUser.email || '')}</small></div><button class="btn btn-outline" id="logoutBtn" type="button">${t('logout')}</button></div>`;
    $('logoutBtn').addEventListener('click', () => signOut(auth));
  } else {
    box.innerHTML = `<p>${t('loginHint')}</p><button class="btn btn-google" id="googleSignInBtn" type="button"><i class="fa-brands fa-google"></i> ${t('google')}</button><button class="btn btn-outline" id="phoneSignInBtn" type="button">${t('phoneOtp')}</button><small>${language === 'en' ? 'Phone sign-in requires Phone Auth and reCAPTCHA in Firebase; no fake code will be used.' : 'تسجيل الهاتف يحتاج تفعيل Phone Auth وreCAPTCHA في Firebase؛ لن نستخدم رمزاً وهمياً.'}</small>`;
    $('googleSignInBtn').addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (e) { showToast(`${language === 'en' ? 'Google sign-in failed' : 'تعذر تسجيل Google'}: ${e.code || 'AUTH_ERROR'}`); } });
    $('phoneSignInBtn').addEventListener('click', () => showToast(language === 'en' ? 'Phone sign-in requires Phone Auth and reCAPTCHA in Firebase.' : 'تسجيل الهاتف يحتاج تفعيل Phone Auth وreCAPTCHA في Firebase.'));
  }
  const favs = state.products.filter((p) => state.favorites.includes(p.id));
  $('favoritesList').innerHTML = `<h3>${t('favorites')} (${favs.length})</h3>${favs.length ? favs.map((p) => `<div class="favorite-row"><img src="${esc(imageFor(p))}" alt=""><div>${esc(productName(p))}<strong>${formatPrice(p.price)}</strong></div><button class="btn btn-outline" type="button" data-favorite-open="${esc(p.id)}">${t('open')}</button></div>`).join('') : `<div class="empty-state">${t('noFavorites')}</div>`}`;
  $('favoritesList').querySelectorAll('[data-favorite-open]').forEach((btn) => btn.addEventListener('click', () => { modal('accountModal', false); openProductDetails(btn.dataset.favoriteOpen); }));
}

// ===== Chatbot =====
function openChat() { $('chatbotContainer').classList.remove('hidden'); }
function closeChat() { $('chatbotContainer').classList.add('hidden'); }

function appendChat(text, user = false, products = []) {
  const msg = document.createElement('div');
  msg.className = `message ${user ? 'user-message' : 'bot-message'}`;
  msg.textContent = englishDigits(text);
  products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'chat-product';
    card.innerHTML = `<img src="${esc(imageFor(p))}" alt=""><div><strong>${esc(productName(p))}</strong><span>${formatPrice(p.price)}</span></div>`;
    card.addEventListener('click', () => openProductDetails(p.id));
    msg.append(card);
  });
  $('chatMessages').append(msg);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

function respondChat(text) {
  const query = text.toLowerCase();
  const published = state.products.filter(product => product.status === 'published');
  let matches = [];
  let reply = language === 'en' ? 'I can help with published products only. Try a product name or choose a suggested question.' : 'أكدر أساعدك من المنتجات المنشورة فقط. جرّب اسم منتج أو اختر سؤالاً جاهزاً.';
  if (/لابتوب|laptop/.test(query)) { matches = published.filter((p) => /لابتوب|laptop/i.test(productText(p))).slice(0, 3); reply = matches.length ? (language === 'en' ? 'Here are currently published laptops:' : 'هذه لابتوبات منشورة حالياً:') : (language === 'en' ? 'No matching published laptops are available.' : 'لا توجد لابتوبات منشورة مطابقة حالياً.'); }
  else if (/ميزان|budget|سعر|بشكد|price/.test(query)) { matches = published.filter(isAvailable).sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 3); reply = language === 'en' ? 'These available options are sorted from the lowest price:' : 'هذه خيارات متوفرة مرتبة من الأقل سعراً:'; }
  else if (/حاسبة|تجميع|ألعاب|gaming|build/.test(query)) { window.location.href = 'builder.html'; reply = language === 'en' ? 'I opened the dedicated PC builder.' : 'فتحت لك صفحة ابنِ تجميعتك المستقلة.'; }
  else if (/طوّر|ترقية|upgrade/.test(query)) { document.querySelector('#upgradeSection').scrollIntoView({ behavior: 'smooth' }); reply = language === 'en' ? 'I opened Upgrade your PC so you can enter your current specifications.' : 'فتحت لك طوّر حاسبتك حتى تدخل مواصفات جهازك الحالي.'; }
  else if (/قارن|مقارنة|compare/.test(query)) { document.querySelector('#compareSection').scrollIntoView({ behavior: 'smooth' }); reply = language === 'en' ? 'I opened comparison. Choose two products from the same category.' : 'فتحت قسم المقارنة. اختر منتجين من نفس القسم.'; }
  else { matches = published.filter((p) => productText(p).includes(query)).slice(0, 3); if (matches.length) reply = language === 'en' ? 'I found these published products:' : 'وجدت هذه المنتجات المنشورة:'; }
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
    submit.disabled = true; submit.textContent = language === 'en' ? 'Validating and saving...' : 'جارٍ التحقق والحفظ...';
    const response = await fetch(`${BACKEND_URL}/api/store/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': payload.requestId }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'CHECKOUT_FAILED');
    const lines = (result.items || []).map((i) => `- ${i.name} × ${i.quantity}: ${formatPrice(i.price * i.quantity)}`).join('\n');
    const message = [`طلب سبايدر رقم ${result.orderNumber}`, lines, `المجموع: ${formatPrice(result.subtotal)}`, `التوصيل: ${formatPrice(result.deliveryFee)}`, `الإجمالي: ${formatPrice(result.grandTotal)}`, `الاسم: ${payload.customer.name}`, `الهاتف: ${payload.customer.phone}`, `العنوان: ${payload.customer.gov} - ${payload.customer.city} - ${payload.customer.address}`].join('\n');
    state.cart = []; renderCart(); modal('checkoutModal', false);
    const wa = normalizeWhatsApp(state.settings.whatsappNumber || state.settings.whatsapp || '9647827337942');
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    showToast(language === 'en' ? `Order saved: ${result.orderNumber}. Send the message from WhatsApp.` : `تم حفظ الطلب رقم ${result.orderNumber}. أرسل الرسالة من واتساب.`);
  } catch (e) {
    const code = e.message;
    showToast(code === 'ORDER_BACKEND_NOT_CONFIGURED'
      ? (language === 'en' ? 'Checkout is paused: the Worker needs the Firebase secret before saving.' : 'إتمام الطلب متوقف: يحتاج Worker إلى سر Firebase قبل الحفظ.')
      : code === 'DELIVERY_FEE_NOT_CONFIGURED'
        ? (language === 'en' ? 'Set the delivery fee in Admin first.' : 'اعتمد رسم التوصيل من الأدمن أولاً.')
        : (language === 'en' ? 'Could not save the order; your cart is still intact.' : 'تعذر حفظ الطلب؛ بقيت السلة كما هي.'));
  } finally { submit.disabled = false; submit.textContent = label; }
}

// ===== Sidebar Close =====
function closeSidebar() { $('sidebarMenu').classList.remove('open'); $('sidebarOverlay').classList.remove('open'); }

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
  $('addBuilderToCartBtn')?.addEventListener('click', () => { selectedBuilderProducts().forEach((p) => addToCart(p.id)); showToast(language === 'en' ? 'Published parts were added to the cart.' : 'تمت إضافة القطع المنشورة إلى السلة.'); });
  $('closeQuoteBtn')?.addEventListener('click', () => modal('quoteModal', false));
  $('copyQuoteBtn')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('quoteModal').dataset.text || ''); showToast(language === 'en' ? 'Quote copied.' : 'تم نسخ عرض السعر.'); } catch { showToast(language === 'en' ? 'Copy failed.' : 'تعذر النسخ.'); } });
  $('shareQuoteBtn')?.addEventListener('click', () => { const wa = normalizeWhatsApp(state.settings.whatsappNumber || state.settings.whatsapp || '9647827337942'); if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent($('quoteModal').dataset.text || '')}`, '_blank', 'noopener'); });
  $('builderBackLink')?.addEventListener('click', () => { window.location.href = 'index.html'; });
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
    showToast(language === 'en' ? 'The alert request was saved on this device. Sending needs an enabled service.' : 'تم حفظ طلب التنبيه على جهازك. الإرسال يحتاج خدمة مفعّلة.');
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

  $('addBuilderToCartBtn')?.addEventListener('click', () => { selectedBuilderProducts().forEach((p) => addToCart(p.id)); showToast(t('buildAdded')); });
  $('quoteBuilderBtn')?.addEventListener('click', () => openQuote());
  $('copyQuoteBtn')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('quoteModal').dataset.text || ''); showToast(t('copyQuote')); } catch { showToast(language === 'en' ? 'Copy failed.' : 'تعذر النسخ.'); } });
  $('shareQuoteBtn')?.addEventListener('click', () => { const wa = normalizeWhatsApp(state.settings.whatsappNumber || state.settings.whatsapp || '9647827337942'); if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent($('quoteModal').dataset.text || '')}`, '_blank', 'noopener'); });

  $('toggleBrandsBtn').addEventListener('click', () => { state.showBrands = !state.showBrands; renderBrands(); });

  // viewFullBuildBtn — scroll to builder
  const vfbBtn = $('viewFullBuildBtn');
  if (vfbBtn) vfbBtn.addEventListener('click', () => { window.location.href = 'builder.html'; });

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
    const prod = { id: child.key, ...child.val() };
    if (prod.status === 'published' && !prod.isHidden) state.products.push(prod);
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
bindAppearanceEvents();
readCart();
readBuilder();
loadFavorites();
if (document.body.dataset.page === 'builder') bindBuilderPageEvents();
else bindEvents();
updateFavoriteBadge();
renderCart();
renderAccount();
// Render the independent builder/upgrade surfaces immediately as well as
// after Firebase updates, so the page never opens as an empty shell.
renderBuilder();
renderUpgrade();
localizeDom();
