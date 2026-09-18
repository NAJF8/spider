// Local standalone design preview. This file deliberately DOES NOT initialize Firebase or create orders.
const assets = 'assets/';
const categories = [
  ['أجهزة الكمبيوتر','gaming-pc.jpg','pc'],['اللابتوبات','laptop.jpg','laptop'],
  ['المعالجات','cpu.jpg','cpu'],['كروت الشاشة','gpu.jpg','gpu'],
  ['الشاشات','monitor.jpg','monitor'],['الملحقات','headset.jpg','headset'],
  ['الألعاب والكونسول','gamepad.jpg','game']
];
const products = [
 ['AMD Ryzen 7 7800X3D','8 أنوية • معالج للألعاب','٨٩٩٬٠٠٠ د.ع','product-cpu.jpg','cpu'],
 ['LG UltraGear 27”','2K • 180Hz • IPS','٤٢٠٬٠٠٠ د.ع','product-monitor.jpg','monitor'],
 ['HyperX Cloud III','Wireless Gaming Headset','٢٤٩٬٠٠٠ د.ع','product-headset.jpg','headset'],
 ['MSI GeForce RTX 4070','12GB GDDR6X','١٬٠٩٩٬٠٠٠ د.ع','product-gpu.jpg','gpu'],
 ['ASUS TUF Gaming F15','i7 • RTX 4060 • 16GB','١٬٢٤٩٬٠٠٠ د.ع','product-laptop.jpg','laptop']
];
let selected = '';
const make = (arr, type) => arr.map((item,i)=> type==='category'
 ? `<button class="category-card" data-category="${item[2]}"><div class="category-card-media"><img src="${assets+item[1]}" alt=""></div><span class="category-name">${item[0]}</span><span class="category-arrow">→</span></button>`
 : `<article class="product-card"><div class="product-photo"><img src="${assets+item[3]}" alt="${item[0]}"></div><div class="product-info"><h3 class="product-title">${item[0]}</h3><p class="product-subtitle">${item[1]}</p><div class="product-price-row"><span class="product-price">${item[2]}</span></div><button class="btn btn-primary" data-add="1">أضف إلى السلة <i class="fa-solid fa-cart-shopping"></i></button></div></article>`).join('');
const categoriesGrid=document.getElementById('categoriesGrid');
const productsGrid=document.getElementById('productsGrid');
function renderProducts() { productsGrid.innerHTML=make(products.filter(p=>!selected||p[4]===selected),'product') || '<div class="empty-state-card">لا توجد منتجات بهذا القسم في المعاينة</div>'; }
categoriesGrid.innerHTML=make(categories,'category');renderProducts();
document.getElementById('productsSectionTitle').textContent='المنتجات المميزة';
document.getElementById('showAllProducts').addEventListener('click',e=>{e.preventDefault();selected='';renderProducts();document.getElementById('productsSectionTitle').textContent='المنتجات المميزة';});
categoriesGrid.addEventListener('click',e=>{let btn=e.target.closest('[data-category]');if(!btn)return;selected=btn.dataset.category;renderProducts();document.getElementById('productsSectionTitle').textContent=categories.find(c=>c[2]===selected)[0];document.getElementById('products-section').scrollIntoView({behavior:'smooth'});});
productsGrid.addEventListener('click',e=>{if(e.target.closest('[data-add]'))alert('هذه معاينة شكلية فقط؛ ملف index.html هو المتجر المرتبط بـ Firebase.');});
document.getElementById('offersProductsGrid').innerHTML=make(products.slice(0,2),'product');
document.getElementById('bundlesGrid').innerHTML='<div class="empty-state-card" style="grid-column:1/-1">التجميعات في هذه المعاينة الشكلية. عرضها الحقيقي من بيانات المتجر عند تشغيل index.html.</div>';
document.getElementById('mobileMenuBtn').addEventListener('click',()=>document.getElementById('mobileNavLinks').classList.toggle('open'));
document.getElementById('chatFab').addEventListener('click',()=>document.getElementById('chatWindow').classList.toggle('hidden'));
document.getElementById('closeChatBtn').addEventListener('click',()=>document.getElementById('chatWindow').classList.add('hidden'));
document.getElementById('toggleDemoBtn').disabled=true;
document.getElementById('openCartBtn').addEventListener('click',e=>{e.preventDefault();alert('السلة الحقيقية تعمل في index.html. هذه معاينة تصميم فقط.');});
