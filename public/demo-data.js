/**
 * SPIDER NAJAF - Isolated Demo & Preview Data
 * بيانات تجريبية معزولة تماماً لمعاينة وتجربة المتجر ولوحة الإدارة
 * لا تخلط بقاعدة بيانات الإنتاج ولا تنشئ طلبات أو مبيعات حقيقية
 */
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from './catalog-seed.js';

export const DEMO_NOTICE = "تنويه: المنتجات والأسعار والتجميعات المعروضة تجريبية لمعاينة تصميم المتجر وتجربة وظائفه، وليست عروض بيع حقيقية.";

export const DEMO_CATEGORIES = INITIAL_CATEGORIES;

export const DEMO_PRODUCTS = INITIAL_PRODUCTS;

export const DEMO_BUNDLES = [
    {
        id: "bundle-spider-pro",
        title: "تجميعة SPIDER PRO GAMING",
        subtitle: "الوحش الأقوى لألعاب 2K و 4K بمعدل إطارات فائق",
        price: 2550000,
        oldPrice: 2750000,
        discount: "وفر 200,000 د.ع",
        image: "/images/products/bundle-spider-pro.svg",
        parts: [
            "المعالج: AMD Ryzen 7 7800X3D (8C/16T)",
            "كرت الشاشة: GeForce RTX 4070 Ti SUPER 16GB GDDR6X",
            "اللوحة الأم: ASUS TUF Gaming B650-PLUS WiFi",
            "الرام: Corsair Vengeance 32GB (2x16GB) DDR5 6000MHz",
            "التخزين: Kingston KC3000 1TB Gen4 NVMe (7000 MB/s)",
            "المبرد: DeepCool LT720 360mm Liquid Cooler ARGB",
            "مزود الطاقة: Corsair RM850e 850W 80+ Gold Fully Modular",
            "الكيس: Lian Li LANCOOL 216 RGB Black"
        ]
    },
    {
        id: "bundle-spider-creator",
        title: "تجميعة SPIDER CREATOR PC",
        subtitle: "محطة عمل متكاملة للمونتاج، الريندر والتصميم الهندسي 3D",
        price: 2280000,
        oldPrice: 2450000,
        discount: "وفر 170,000 د.ع",
        image: "/images/products/bundle-spider-creator.svg",
        parts: [
            "المعالج: Intel Core i7-14700K (20C/28T)",
            "كرت الشاشة: NVIDIA GeForce RTX 4070 12GB GDDR6X",
            "اللوحة الأم: MSI PRO Z790-A MAX WiFi",
            "الرام: 64GB (2x32GB) Corsair Vengeance DDR5 5600MHz",
            "التخزين: Samsung 990 PRO 2TB PCIe 4.0 NVMe",
            "المبرد: Thermalright Frozen Prism 360 Black",
            "مزود الطاقة: MSI MAG A750GL 750W 80+ Gold PCIe 5",
            "الكيس: NZXT H7 Flow Edition"
        ]
    }
];

export const DEMO_ORDERS = [
    {
        id: "demo-order-101",
        orderNumber: "10128",
        customerName: "أحمد كريم الخفاجي",
        customerPhone: "07801234567",
        governorate: "النجف الأشرف",
        city: "حي الغدير",
        address: "قرب مجسر الإسكان، دار 42",
        notes: "يرجى الاتصال قبل الوصول للتأكد من وجود المستلم",
        status: "completed",
        timestamp: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
        subtotal: 1350000,
        deliveryFee: 5000,
        grandTotal: 1355000,
        items: [
            { id: "demo-gpu-1", name: "ASUS TUF Gaming RTX 4070 Ti SUPER 16GB", price: 1350000, quantity: 1 }
        ]
    },
    {
        id: "demo-order-102",
        orderNumber: "10127",
        customerName: "سارة علي الرماحي",
        customerPhone: "07719876543",
        governorate: "بغداد",
        city: "المنصور",
        address: "شارع 14 رمضان، عمارة الأمل، طابق 2",
        notes: "",
        status: "pending",
        timestamp: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
        subtotal: 880000,
        deliveryFee: 6000,
        grandTotal: 886000,
        items: [
            { id: "demo-cpu-1", name: "معالج AMD Ryzen 7 7800X3D", price: 685000, quantity: 1 },
            { id: "demo-ram-1", name: "رامات Corsair Vengeance RGB 32GB DDR5", price: 195000, quantity: 1 }
        ]
    },
    {
        id: "demo-order-103",
        orderNumber: "10126",
        customerName: "حسين محمد الكعبي",
        customerPhone: "07812349988",
        governorate: "كربلاء المقدسة",
        city: "حي الحسين",
        address: "قرب ساحة الإمام الحسين",
        notes: "الدفع عند الاستلام نقداً",
        status: "completed",
        timestamp: Date.now() - 1000 * 60 * 60 * 26,
        subtotal: 430000,
        deliveryFee: 5000,
        grandTotal: 435000,
        items: [
            { id: "demo-monitor-1", name: "شاشة LG UltraGear 27\" QHD 180Hz", price: 430000, quantity: 1 }
        ]
    },
    {
        id: "demo-order-104",
        orderNumber: "10125",
        customerName: "نور الهدى السلامي",
        customerPhone: "07505554321",
        governorate: "البصرة",
        city: "الجزائر",
        address: "شارع سيد حامد",
        notes: "",
        status: "cancelled",
        timestamp: Date.now() - 1000 * 60 * 60 * 48,
        subtotal: 215000,
        deliveryFee: 7000,
        grandTotal: 222000,
        items: [
            { id: "demo-acc-1", name: "سماعة HyperX Cloud III Wireless", price: 215000, quantity: 1 }
        ]
    }
];

// Helper to check and toggle preview mode state
export function isPreviewMode() {
    const saved = localStorage.getItem('spider_preview_mode');
    // Default to true so store is never empty on first load!
    return saved === null ? true : saved === 'true';
}

export function setPreviewMode(enable) {
    localStorage.setItem('spider_preview_mode', enable ? 'true' : 'false');
}
