const fs = require('fs');
let c = fs.readFileSync('public/script.js', 'utf8');

c = c.replace(/function addToCart\(productId\) \{[\s\S]*?function addMultipleToCart\(productIds, successMsg\) \{[\s\S]*?if \(added\) \{ renderCart\(\); openCart\(\); showToast\(successMsg\); \}\r?\n  \}/, `function _addItemToCartLogic(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return false;
  if (!isAvailable(product) || productPrice(product) <= 0) { openAvailability(productId); return false; }
  const item = state.cart.find((e) => e.id === productId);
  if (item) item.qty = Math.min(100, item.qty + 1);
  else state.cart.push({ id: productId, qty: 1 });
  return true;
}

function addToCart(productId) {
  if (_addItemToCartLogic(productId)) {
    renderCart();
    openCart();
    showToast(t('added'));
  }
}
window.addToCart = addToCart;

function addMultipleToCart(productIds, successMsg) {
  if (!productIds || !productIds.length) return;
  let added = false;
  const addedIds = new Set();
  productIds.forEach((productId) => {
    if (addedIds.has(productId)) return; // prevent loop bug duplicate
    addedIds.add(productId);
    if (_addItemToCartLogic(productId)) added = true;
  });
  if (added) {
    renderCart();
    openCart();
    showToast(successMsg);
  }
}`);

c = c.replace(/\$1/g, "language === 'en' ? 'Builder added to cart.' : 'تمت إضافة التجميعة إلى السلة'");

// Fix index cache versions
['public/index.html', 'public/builder.html', 'public/upgrade.html'].forEach(file => {
  if(fs.existsSync(file)) {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/script\.js\?v=\d+/g, 'script.js?v=999');
    fs.writeFileSync(file, html);
  }
});

fs.writeFileSync('public/script.js', c);
