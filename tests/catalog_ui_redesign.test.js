const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const script = fs.readFileSync('public/script.js', 'utf8');
const css = fs.readFileSync('public/style.css', 'utf8');

assert.match(html, /id="catalogBreadcrumb"/);
assert.match(html, /id="subcategoryPanel"/);
assert.match(html, /id="catalogBrandSearch"/);
assert.match(html, /id="showMoreBrands"/);
assert.match(html, /id="openCatalogFilters"/);
assert.match(html, /id="catalogFilterScrim"/);
assert.match(html, /value="oldest"/);
assert.doesNotMatch(html, /catalogBrandFilters" class="catalog-brand-filters"><input/);
assert.match(script, /function selectCatalogCategory/);
assert.match(script, /function renderSubcategoryPanel/);
assert.match(script, /function renderActiveCatalogFilters/);
assert.match(script, /window\.addEventListener\('popstate'/);
assert.match(script, /data-catalog-brand/);
assert.match(script, /price-on-request item remains in results/);
assert.match(script, /Products without a real price remain discoverable/);
assert.match(script, /catalogVersionRef/);
assert.match(css, /\.category-card-grid/);
assert.match(css, /\.catalog-brand-option\.is-selected/);
assert.match(css, /\.catalog-filters-open \.catalog-filters/);
assert.match(css, /@media \(max-width:760px\)/);

console.log('PASS catalog cards, progressive navigation, premium filters, and mobile sheet wiring');
