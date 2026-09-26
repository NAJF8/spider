const fs = require('fs');

// --- 1. Modify script.js ---
let script = fs.readFileSync('public/script.js', 'utf8');

// Add addMultipleToCart
script = script.replace(/function addToCart\(productId\) \{[\s\S]*?window\.addToCart = addToCart;/, `$&
  function addMultipleToCart(productIds, successMsg) {
    if (!productIds.length) return;
    let added = false;
    const addedIds = new Set();
    productIds.forEach((productId) => {
      if (addedIds.has(productId)) return; // prevent loop bug duplicate
      addedIds.add(productId);
      const product = state.products.find((p) => p.id === productId);
      if (!product || !isAvailable(product) || productPrice(product) <= 0) return;
      const item = state.cart.find((e) => e.id === productId);
      if (item) item.qty = Math.min(100, item.qty + 1);
      else state.cart.push({ id: productId, qty: 1 });
      added = true;
    });
    if (added) { renderCart(); openCart(); showToast(successMsg); }
  }
`);

// Update addBuilderToCartBtn listener
script = script.replace(/\$\('addBuilderToCartBtn'\)\?\.addEventListener\('click', \(\) => \{ selectedBuilderProducts\(\)\.forEach\(\(p\) => addToCart\(p\.id\)\); showToast\((.*?)\); \}\);/g, `$$('addBuilderToCartBtn')?.addEventListener('click', () => { addMultipleToCart(selectedBuilderProducts().map(p => p.id), $$1); });`);

// Update renderBuilder HTML
script = script.replace(/<div class="builder-part-actions"><button class="btn btn-outline" type="button" data-builder-change="\$\{esc\(part\.id\)\}">/, `<div class="builder-part-actions"><button class="btn btn-primary builder-add-cart" type="button" data-builder-cart="\${esc(part.id)}"><i class="fa-solid fa-cart-shopping"></i> \${language === 'en' ? 'Add to Cart' : 'إضافة للسلة'}</button><button class="btn btn-outline" type="button" data-builder-change="\${esc(part.id)}">`);

// Update list.onclick in renderBuilder
script = script.replace(/const remove = event\.target\.closest\('\[data-builder-remove\]'\);\s*const change = event\.target\.closest\('\[data-builder-change\]'\);\s*const partId = remove\?\.dataset\.builderRemove \|\| change\?\.dataset\.builderChange;\s*if \(\!partId\) return;\s*if \(change\) \{ openBuilderPicker\(partId\); return; \}/, `const remove = event.target.closest('[data-builder-remove]');
      const change = event.target.closest('[data-builder-change]');
      const cart = event.target.closest('[data-builder-cart]');
      const partId = remove?.dataset.builderRemove || change?.dataset.builderChange || cart?.dataset.builderCart;
      if (!partId) return;
      if (cart) { addToCart(state.builder[partId]); return; }
      if (change) { openBuilderPicker(partId); return; }`);

// Upgrade state
script = script.replace(/upgrade: \{\},/, `upgrade: {}, upgradeIsNew: {},`);
script = script.replace(/try \{ const saved = JSON\.parse\(localStorage\.getItem\(UPGRADE_STORAGE_KEY\) \|\| '\{\}'\); state\.upgrade = saved && typeof saved === 'object' \? saved : \{\}; \}\s*catch \{ state\.upgrade = \{\}; \}/, `$&
  try { const savedNew = JSON.parse(localStorage.getItem('spider.upgrade.isnew.v1') || '{}'); state.upgradeIsNew = savedNew && typeof savedNew === 'object' ? savedNew : {}; }
  catch { state.upgradeIsNew = {}; }`);
script = script.replace(/function saveUpgrade\(\) \{ localStorage\.setItem\(UPGRADE_STORAGE_KEY, JSON\.stringify\(state\.upgrade\)\); \}/, `$&
  localStorage.setItem('spider.upgrade.isnew.v1', JSON.stringify(state.upgradeIsNew));`);

// Clear flag on current selection
script = script.replace(/state\.upgrade\[state\.upgradePickerField\] = button\.dataset\.upgradePick;\s*saveUpgrade\(\);/, `state.upgrade[state.upgradePickerField] = button.dataset.upgradePick; state.upgradeIsNew[state.upgradePickerField] = false; saveUpgrade();`);

// Render Upgrade Selection HTML
script = script.replace(/<div class="upgrade-preview-actions"><button class="btn btn-outline" type="button" data-upgrade-change="\$\{field\.id\}">/, `<div class="upgrade-preview-actions">\${state.upgradeIsNew[field.id] ? \`<button class="btn btn-primary" type="button" data-upgrade-cart="\${field.id}"><i class="fa-solid fa-cart-shopping"></i> \${language === 'en' ? 'Add to Cart' : 'إضافة للسلة'}</button>\` : ''}<button class="btn btn-outline" type="button" data-upgrade-change="\${field.id}">`);

// Upgrade Preview Events
script = script.replace(/preview\.querySelector\('\[data-upgrade-change\]'\)\?\.addEventListener\('click', \(\) => openUpgradePicker\(field\.id\)\);/, `preview.querySelector('[data-upgrade-cart]')?.addEventListener('click', () => { addToCart(product.id); });\n      $&`);
script = script.replace(/delete state\.upgrade\[field\.id\];\s*saveUpgrade\(\);/g, `delete state.upgrade[field.id]; delete state.upgradeIsNew[field.id]; saveUpgrade();`);

// productCard updates
script = script.replace(/function productCard\(p\) \{/, `function productCard(p, ctx) {`);
script = script.replace(/<button class="btn btn-outline" type="button" data-details="\$\{esc\(p\.id\)\}">(\$\{t\('details'\)\})<\/button>/, `$&
          \${ctx === 'upgrade' && isAvailable(p) ? \`<button class="btn btn-outline" type="button" data-upgrade-select="\${esc(p.id)}"><i class="fa-solid fa-check"></i> \${language === 'en' ? 'Choose' : 'اختيار'}</button>\` : ''}`);
script = script.replace(/recs\.map\(productCard\)\.join\(''\)/, `recs.map(p => productCard(p, 'upgrade')).join('')`);

// upgradeResults selection event bindings
script = script.replace(/bindProductActions\(\$\('upgradeResults'\)\);/, `$&
    $$('upgradeResults').querySelectorAll('[data-upgrade-select]').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.dataset.upgradeSelect;
      const p = state.products.find(x => x.id === pid);
      if (!p) return;
      const field = upgradeFields().find(f => f.match.test(\`\${categoryIdFor(p)} \${categoryName(categoryIdFor(p))} \${p.name}\`));
      if (field) {
        state.upgrade[field.id] = pid;
        state.upgradeIsNew[field.id] = true;
        saveUpgrade();
        renderUpgrade();
        showToast(language === 'en' ? 'Part selected for upgrade.' : 'تم اختيار القطعة للترقية.');
      }
    }));`);

// Add Whole Upgrade Build button listener in bindUpgradePageEvents
script = script.replace(/bindUpgradePageEvents\(\) \{/, `$&
  $$('addUpgradeToCartBtn')?.addEventListener('click', () => {
    const pids = Object.keys(state.upgrade).filter(k => state.upgradeIsNew[k]).map(k => state.upgrade[k]);
    addMultipleToCart(pids, language === 'en' ? 'Upgrades added to cart.' : 'تمت إضافة التجميعة إلى السلة');
  });
`);

fs.writeFileSync('public/script.js', script);

// --- 2. Modify upgrade.html ---
let upgrade = fs.readFileSync('public/upgrade.html', 'utf8');
upgrade = upgrade.replace(/<div class="upgrade-form" id="upgradeForm" aria-label=".*?"><\/div>/, `$&
        <div class="upgrade-summary-actions" style="text-align: center; margin: 1.5rem 0;">
          <button class="btn btn-primary" id="addUpgradeToCartBtn" type="button" style="padding: 0.75rem 1.5rem; font-size: 1.1rem; display: inline-flex; align-items: center; gap: 0.5rem;"><i class="fa-solid fa-cart-plus"></i> أضف التجميعة للسلة</button>
        </div>`);
fs.writeFileSync('public/upgrade.html', upgrade);

console.log("Modifications complete");
