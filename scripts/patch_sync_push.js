const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve('public/script.js');
let code = fs.readFileSync(scriptPath, 'utf8');

const targetLine = "function syncFiltersToUrl() { const p = new URLSearchParams(); const f = state.filters; if (f.category) p.set('category', f.category); if (f.brands?.length) p.set('brands', f.brands.join(',')); CATALOG_FACETS.forEach((facet) => { if (f[facet.key]?.length) p.set(facet.param, f[facet.key].join(',')); }); if (f.search) p.set('q', f.search); if (f.minPrice !== null) p.set('min', String(f.minPrice)); if (f.maxPrice !== null) p.set('max', String(f.maxPrice)); if (f.sort) p.set('sort', f.sort); if (f.inStockOnly) p.set('stock', '1'); history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`); }";

const replacement = `function syncFiltersToUrl({ push = false } = {}) {
  const p = new URLSearchParams();
  const f = state.filters;
  if (f.category) p.set('category', f.category);
  if (f.brands?.length) p.set('brands', f.brands.join(','));
  CATALOG_FACETS.forEach((facet) => { if (f[facet.key]?.length) p.set(facet.param, f[facet.key].join(',')); });
  if (f.search) p.set('q', f.search);
  if (f.minPrice !== null) p.set('min', String(f.minPrice));
  if (f.maxPrice !== null) p.set('max', String(f.maxPrice));
  if (f.sort && f.sort !== '') p.set('sort', f.sort);
  if (f.inStockOnly) p.set('stock', '1');
  const nextQuery = p.toString();
  const nextUrl = \`\${location.pathname}\${nextQuery ? \`?\${nextQuery}\` : ''}\`;
  const currentUrl = \`\${location.pathname}\${location.search}\`;
  if (push && nextUrl !== currentUrl) {
    history.pushState(null, '', nextUrl);
  } else {
    history.replaceState(null, '', nextUrl);
  }
}`;

if (!code.includes(targetLine)) {
  throw new Error('targetLine not found in script.js');
}
code = code.replace(targetLine, replacement);
console.log('Replaced syncFiltersToUrl');

const oldChange = "$('catalogSort')?.addEventListener('change', (event) => { state.filters.sort = event.target.value; syncFiltersToUrl(); renderProducts(); });";
const newChange = "$('catalogSort')?.addEventListener('change', (event) => { state.filters.sort = event.target.value; syncFiltersToUrl({ push: true }); renderProducts(); });";

if (!code.includes(oldChange)) {
  throw new Error('oldChange not found in script.js');
}
code = code.replace(oldChange, newChange);
console.log('Updated catalogSort listener to use push: true');

fs.writeFileSync(scriptPath, code, 'utf8');
console.log('Saved script.js successfully');
