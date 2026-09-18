/**
 * SPIDER NAJAF - Isolated Demo & Preview Data
 * بيانات تجريبية معزولة تماماً لمعاينة وتجربة المتجر ولوحة الإدارة
 * لا تخلط بقاعدة بيانات الإنتاج ولا تنشئ طلبات أو مبيعات حقيقية
 */

export const DEMO_NOTICE = "تنويه: المنتجات والأسعار والتجميعات المعروضة تجريبية لمعاينة تصميم المتجر وتجربة وظائفه، وليست عروض بيع حقيقية.";

export const DEMO_CATEGORIES = [
    {
        id: "cat-pc-parts",
        name: "مكونات الحاسوب الشخصي",
        icon: "fa-microchip",
        description: "معالجات، كروت شاشة، لوحات أم، رامات ووحدات تخزين",
        isHidden: false,
        subcategories: [
            { id: "sub-cpus", name: "المعالجات (CPUs)" },
            { id: "sub-gpus", name: "كروت الشاشة (GPUs)" },
            { id: "sub-motherboards", name: "اللوحات الأم (Motherboards)" },
            { id: "sub-ram", name: "الذاكرة العشوائية (RAM)" },
            { id: "sub-storage", name: "التخزين (SSD & NVMe)" }
        ]
    },
    {
        id: "cat-cpus",
        name: "المعالجات",
        icon: "fa-microchip",
        parentCategory: "cat-pc-parts",
        description: "أحدث معالجات Intel Core و AMD Ryzen للألعاب وصناع المحتوى",
        isHidden: false
    },
    {
        id: "cat-gpus",
        name: "كروت الشاشة",
        icon: "fa-memory",
        parentCategory: "cat-pc-parts",
        description: "كروت GeForce RTX و Radeon لأعلى أداء رسومي وRay Tracing",
        isHidden: false
    },
    {
        id: "cat-motherboards",
        name: "اللوحات الأم",
        icon: "fa-border-all",
        parentCategory: "cat-pc-parts",
        description: "لوحات أم تدعم أحدث مقابس AM5 و LGA1700 و DDR5",
        isHidden: false
    },
    {
        id: "cat-ram",
        name: "الذاكرة العشوائية",
        icon: "fa-bars",
        parentCategory: "cat-pc-parts",
        description: "ذواكر DDR5 و DDR4 بسرعات فائقة وإضاءة RGB",
        isHidden: false
    },
    {
        id: "cat-storage",
        name: "وحدات التخزين",
        icon: "fa-hard-drive",
        parentCategory: "cat-pc-parts",
        description: "أقراص M.2 NVMe PCIe 4.0 و PCIe 5.0 بسرعات قراءة قياسية",
        isHidden: false
    },
    {
        id: "cat-laptops",
        name: "اللابتوبات",
        icon: "fa-laptop",
        description: "لابتوبات ألعاب احترافية وأجهزة ألترا بوك للأعمال",
        isHidden: false
    },
    {
        id: "cat-monitors",
        name: "الشاشات",
        icon: "fa-tv",
        description: "شاشات ألعاب IPS و OLED بترددات تصل إلى 240Hz",
        isHidden: false
    },
    {
        id: "cat-bundles",
        name: "التجميعات والعروض",
        icon: "fa-desktop",
        description: "تجميعات PC احترافية متكاملة جاهزة للتشغيل",
        isHidden: false
    },
    {
        id: "cat-accessories",
        name: "الملحقات والألعاب",
        icon: "fa-headphones",
        description: "سماعات، كيبوردات، ماوسات، وملحقات كونسول",
        isHidden: false
    }
];

export const DEMO_PRODUCTS = [
    // 1. CPUs
    {
        id: "demo-cpu-1",
        name: "معالج AMD Ryzen 7 7800X3D",
        categoryId: "cat-cpus",
        category: "cat-cpus",
        mainCategory: "مكونات الحاسوب الشخصي",
        subCategory: "المعالجات",
        price: 685000,
        originalPrice: 750000,
        brand: "AMD",
        image: "/images/products/cpu-ryzen-7800x3d.svg",
        description: "أفضل معالج ألعاب في العالم بتقنية 3D V-Cache • 8 أنوية و 16 مسار • تردد يصل إلى 5.0GHz • كاش 104MB • مقبس AM5 • استهلاك 120W",
        inStock: true,
        stockQuantity: 15,
        isFeatured: true,
        rating: 5,
        isHidden: false
    },
    {
        id: "demo-cpu-2",
        name: "معالج Intel Core i7-14700K",
        categoryId: "cat-cpus",
        category: "cat-cpus",
        mainCategory: "مكونات الحاسوب الشخصي",
        subCategory: "المعالجات",
        price: 640000,
        brand: "Intel",
        image: "/images/products/cpu-intel-i7-14700k.svg",
        description: "معالج الجيل 14 للألعاب وصناعة المحتوى • 20 نواة (8 أداء + 12 كفاءة) و 28 مسار • تردد تيربو حتى 5.6GHz • كاش 33MB • مقبس LGA1700",
        inStock: true,
        stockQuantity: 8,
        isFeatured: true,
        rating: 4.8,
        isHidden: false
    },

    // 2. GPUs
    {
        id: "demo-gpu-1",
        name: "كرت شاشة ASUS TUF Gaming RTX 4070 Ti SUPER 16GB",
        categoryId: "cat-gpus",
        category: "cat-gpus",
        mainCategory: "مكونات الحاسوب الشخصي",
        subCategory: "كروت الشاشة",
        price: 1350000,
        originalPrice: 1450000,
        brand: "ASUS / NVIDIA",
        image: "/images/products/gpu-rtx-4070ti.svg",
        description: "ذاكرة 16GB GDDR6X بسرعة 256-bit • معمارية Ada Lovelace • دعم DLSS 3.5 وتتبع الأشعة الكامل • نظام تبريد TUF ثلاثي المراوح فائق الهدوء",
        inStock: true,
        stockQuantity: 6,
        isFeatured: true,
        rating: 5,
        isHidden: false
    },
    {
        id: "demo-gpu-2",
        name: "كرت شاشة Sapphire Nitro+ Radeon RX 7800 XT 16GB",
        categoryId: "cat-gpus",
        category: "cat-gpus",
        mainCategory: "مكونات الحاسوب الشخصي",
        subCategory: "كروت الشاشة",
        price: 920000,
        brand: "AMD",
        image: "/images/products/gpu-rx-7800xt.svg",
        description: "ذاكرة 16GB GDDR6 • معمارية RDNA 3 • دعم FSR 3 و Fluid Motion Frames • أداء استثنائي بدقة 2K 1440p بأعلى إعدادات",
        inStock: true,
        stockQuantity: 9,
        isFeatured: false,
        rating: 4.7,
        isHidden: false
    },

    // 3. Motherboards
    {
        id: "demo-mb-1",
        name: "لوحة أم ASUS TUF Gaming B650-PLUS WiFi",
        categoryId: "cat-motherboards",
        category: "cat-motherboards",
        mainCategory: "مكونات الحاسوب الشخصي",
        subCategory: "اللوحات الأم",
        price: 330000,
        brand: "ASUS",
        image: "/images/products/mb-asus-b650.svg",
        description: "مقبس AMD AM5 لمعالجات Ryzen 7000/8000/9000 • دعم DDR5 حتى 7600+ MHz • منفذ PCIe 5.0 M.2 فائق السرعة • شبكة WiFi 6 و 2.5Gb LAN",
        inStock: true,
        stockQuantity: 14,
        isFeatured: true,
        rating: 4.9,
        isHidden: false
    },

    // 4. RAM
    {
        id: "demo-ram-1",
        name: "رامات Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz",
        categoryId: "cat-ram",
        category: "cat-ram",
        mainCategory: "مكونات الحاسوب الشخصي",
        subCategory: "الذاكرة العشوائية",
        price: 195000,
        brand: "Corsair",
        image: "/images/products/ram-corsair-ddr5.svg",
        description: "سعة 32GB (قطعتين 16GB) • سرعة 6000MT/s بتوقيت CL30 فائق الاستجابة • دعم Intel XMP 3.0 و AMD EXPO • إضاءة RGB قابلة للتخصيص الكامل",
        inStock: true,
        stockQuantity: 20,
        isFeatured: true,
        rating: 5,
        isHidden: false
    },

    // 5. Storage
    {
        id: "demo-ssd-1",
        name: "قرص تخزين Samsung 990 PRO 2TB NVMe M.2 SSD",
        categoryId: "cat-storage",
        category: "cat-storage",
        mainCategory: "مكونات الحاسوب الشخصي",
        subCategory: "وحدات التخزين",
        price: 285000,
        brand: "Samsung",
        image: "/images/products/ssd-samsung-990pro.svg",
        description: "واجهة PCIe 4.0 NVMe 2.0 • سرعة قراءة قياسية تصل إلى 7450 MB/s وسرعة كتابة 6900 MB/s • عمر افتراضي 1200 TBW • مزود بمشتت حراري مدمج",
        inStock: true,
        stockQuantity: 25,
        isFeatured: true,
        rating: 4.9,
        isHidden: false
    },

    // 6. Laptops
    {
        id: "demo-laptop-1",
        name: "لابتوب الألعاب ASUS ROG Strix SCAR 16 (2024)",
        categoryId: "cat-laptops",
        category: "cat-laptops",
        mainCategory: "اللابتوبات",
        subCategory: "أجهزة الألعاب",
        price: 3650000,
        originalPrice: 3850000,
        brand: "ASUS ROG",
        image: "/images/products/laptop-rog-strix.svg",
        description: "معالج Intel Core i9-14900HX • كرت شاشة RTX 4080 12GB TGP 175W • شاشة 16 بوصة 2.5K Nebula HDR 240Hz Mini LED • رام 32GB DDR5 • تخزين 1TB Gen4 SSD",
        inStock: true,
        stockQuantity: 4,
        isFeatured: true,
        rating: 5,
        isHidden: false
    },

    // 7. Monitors
    {
        id: "demo-monitor-1",
        name: "شاشة الألعاب LG UltraGear 27\" QHD 180Hz Nano IPS",
        categoryId: "cat-monitors",
        category: "cat-monitors",
        mainCategory: "الشاشات",
        subCategory: "شاشات الألعاب",
        price: 430000,
        brand: "LG",
        image: "/images/products/monitor-lg-ultragear.svg",
        description: "دقة 2560x1440 QHD • لوحة Nano IPS بألوان DCI-P3 98% • تردد 180Hz مع سرعة استجابة 1ms GtG • توافق كامل مع NVIDIA G-SYNC و AMD FreeSync Premium",
        inStock: true,
        stockQuantity: 11,
        isFeatured: true,
        rating: 4.8,
        isHidden: false
    },

    // 8. Bundles / Builds
    {
        id: "demo-bundle-1",
        name: "تجميعة SPIDER PRO GAMING (Ryzen 7 + RTX 4070 Ti)",
        categoryId: "cat-bundles",
        category: "cat-bundles",
        mainCategory: "التجميعات والعروض",
        subCategory: "تجميعات الألعاب",
        price: 2550000,
        originalPrice: 2750000,
        brand: "SPIDER CUSTOM",
        image: "/images/products/bundle-spider-pro.svg",
        description: "معالج Ryzen 7 7800X3D + كرت RTX 4070 Ti SUPER 16GB + لوحة B650 WiFi + رام 32GB DDR5 6000MHz + تخزين 1TB NVMe + مبرد مائي 360mm + مزود طاقة 850W Gold + كيسة ألعاب فاخرة مع 4 مراوح ARGB",
        inStock: true,
        stockQuantity: 5,
        isFeatured: true,
        rating: 5,
        isHidden: false
    },
    {
        id: "demo-bundle-2",
        name: "تجميعة SPIDER CREATOR & WORKSTATION (i7 + RTX 4070)",
        categoryId: "cat-bundles",
        category: "cat-bundles",
        mainCategory: "التجميعات والعروض",
        subCategory: "تجميعات التصميم",
        price: 2280000,
        brand: "SPIDER CUSTOM",
        image: "/images/products/bundle-spider-creator.svg",
        description: "معالج Core i7-14700K + كرت RTX 4070 12GB + رام 64GB DDR5 للرندرة والتصميم + تخزين 2TB Samsung 990 PRO + مبرد مائي 360mm + مزود طاقة 750W",
        inStock: true,
        stockQuantity: 3,
        isFeatured: false,
        rating: 4.9,
        isHidden: false
    },

    // 9. Accessories
    {
        id: "demo-acc-1",
        name: "سماعة الرأس اللاسلكية HyperX Cloud III Wireless",
        categoryId: "cat-accessories",
        category: "cat-accessories",
        mainCategory: "الملحقات والألعاب",
        subCategory: "سماعات الألعاب",
        price: 215000,
        brand: "HyperX",
        image: "/images/products/headset-hyperx.svg",
        description: "بطارية أسطورية تصمد حتى 120 ساعة بشحنة واحدة • مشغلات صوت 53mm زاوية • صوت محيطي DTS Headphone:X Spatial Audio • ميكروفون نقي 10mm مع عزل الضوضاء",
        inStock: true,
        stockQuantity: 18,
        isFeatured: true,
        rating: 4.8,
        isHidden: false
    }
];

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
