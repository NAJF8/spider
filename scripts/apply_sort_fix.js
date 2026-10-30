const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve('public/script.js');
let code = fs.readFileSync(scriptPath, 'utf8');

// 1. Add PUSH_CHARS and productCreationTime helpers before emptyCatalogFilters
const helperDefs = `const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function parseFirebasePushIdTimestamp(id) {
  if (typeof id !== 'string' || id.length < 8) return null;
  let time = 0;
  for (let i = 0; i < 8; i++) {
    const idx = PUSH_CHARS.indexOf(id.charAt(i));
    if (idx === -1) return null;
    time = time * 64 + idx;
  }
  return (time > 1577836800000 && time < 2524608000000) ? time : null;
}

function productCreationTime(product) {
  if (!product) return 0;
  if (product.createdAt != null) {
    const num = Number(product.createdAt);
    if (Number.isFinite(num) && num > 0) return num;
    const dateNum = Date.parse(product.createdAt);
    if (Number.isFinite(dateNum) && dateNum > 0) return dateNum;
  }
  if (product.created_at != null) {
    const num = Number(product.created_at);
    if (Number.isFinite(num) && num > 0) return num;
    const dateNum = Date.parse(product.created_at);
    if (Number.isFinite(dateNum) && dateNum > 0) return dateNum;
  }
  if (product.publishedAt != null) {
    const num = Number(product.publishedAt);
    if (Number.isFinite(num) && num > 0) return num;
    const dateNum = Date.parse(product.publishedAt);
    if (Number.isFinite(dateNum) && dateNum > 0) return dateNum;
  }
  const pushTime = parseFirebasePushIdTimestamp(product.id);
  if (pushTime !== null) return pushTime;
  return 0;
}

`;

if (!code.includes('function productCreationTime(')) {
  const target = 'function emptyCatalogFilters()';
  if (!code.includes(target)) {
    throw new Error('Could not find function emptyCatalogFilters()');
  }
  code = code.replace(target, helperDefs + target);
  console.log('Added productCreationTime helper definitions');
}

// 2. Update emptyCatalogFilters to default sort to 'newest'
code = code.replace(
  /maxPrice:\s*null,\s*sort:\s*'',\s*inStockOnly:\s*false/,
  "maxPrice: null, sort: 'newest', inStockOnly: false"
);
console.log('Updated emptyCatalogFilters default sort to newest');

// 3. Update filteredProducts sorting logic
const oldSortRegex = /if\s*\(sort\s*===\s*'price-asc'\s*\|\|\s*sort\s*===\s*'price-desc'\)[\s\S]*?if\s*\(sort\s*===\s*'oldest'\)[\s\S]*?return\s+result;/;
const newSortLogic = `if (sort === 'price-asc' || sort === 'price-desc') {
    result.sort((a, b) => {
      const ap = priceInfo(a), bp = priceInfo(b);
      if (!ap.purchasable && !bp.purchasable) return 0;
      if (!ap.purchasable) return 1;
      if (!bp.purchasable) return -1;
      const priceDiff = sort === 'price-asc' ? ap.price - bp.price : bp.price - ap.price;
      if (priceDiff !== 0) return priceDiff;
      return productCreationTime(b) - productCreationTime(a);
    });
  } else if (sort === 'oldest') {
    result.sort((a, b) => {
      const diff = productCreationTime(a) - productCreationTime(b);
      if (diff !== 0) return diff;
      return String(a.id).localeCompare(String(b.id));
    });
  } else {
    result.sort((a, b) => {
      const diff = productCreationTime(b) - productCreationTime(a);
      if (diff !== 0) return diff;
      return String(b.id).localeCompare(String(a.id));
    });
  }
  return result;`;

if (!oldSortRegex.test(code)) {
  throw new Error('Could not match old sort logic in filteredProducts');
}
code = code.replace(oldSortRegex, newSortLogic);
console.log('Updated filteredProducts sort logic');

// 4. Update restoreFiltersFromUrl to accept newest and oldest
const oldRestoreSort = /sort:\s*\['price-asc',\s*'price-desc',\s*'name-asc'\]\.includes\(query\.get\('sort'\)\)\s*\?\s*query\.get\('sort'\)\s*:\s*'',/;
const newRestoreSort = "sort: ['newest', 'oldest', 'price-asc', 'price-desc'].includes(query.get('sort')) ? query.get('sort') : 'newest',";

if (!oldRestoreSort.test(code)) {
  throw new Error('Could not match restoreFiltersFromUrl sort check');
}
code = code.replace(oldRestoreSort, newRestoreSort);
console.log('Updated restoreFiltersFromUrl sort check');

// 5. Ensure $('catalogSort').value is set in restoreFiltersFromUrl
if (!code.includes("if ($('catalogSort')) $('catalogSort').value = state.filters.sort;")) {
  code = code.replace(
    /if\s*\(\$('searchInput')\)\s*\$('searchInput')\.value\s*=\s*state\.filters\.search;/,
    "if ($('searchInput')) $('searchInput').value = state.filters.search;\n  if ($('catalogSort')) $('catalogSort').value = state.filters.sort || 'newest';"
  );
  console.log("Added catalogSort sync in restoreFiltersFromUrl");
}

// 6. Update $('catalogSort').value in renderCatalogFilters
code = code.replace(
  /\$\('catalogSort'\)\.value\s*=\s*state\.filters\.sort;/,
  "$('catalogSort').value = state.filters.sort || 'newest';"
);
console.log("Updated catalogSort value assignment in renderCatalogFilters");

// 7. Add data-product-id to productCard article
if (!code.includes('data-product-id="${esc(p.id)}"')) {
  code = code.replace(
    'return `<article class="product-card ${!isAvailable(p) ? \'is-out\' : \'\'}">',
    'return `<article class="product-card ${!isAvailable(p) ? \'is-out\' : \'\'}" data-product-id="${esc(p.id)}">'
  );
  console.log('Added data-product-id to productCard');
}

// Save modified script
fs.writeFileSync(scriptPath, code, 'utf8');
console.log('Successfully written updated public/script.js');

// Update version.json
const versionPath = path.resolve('public/version.json');
fs.writeFileSync(versionPath, JSON.stringify({ version: '20261030-sort-fix-v1' }, null, 2) + '\n', 'utf8');
console.log('Updated public/version.json');
