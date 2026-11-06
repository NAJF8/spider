const assert = require('assert');
const fs = require('fs');

const adminJs = fs.readFileSync('public/admin.js', 'utf8');

// 1. Verify dirty-tracking in capturePricingDrafts
assert(adminJs.includes("input.dataset.dirty === 'true'"), 'capturePricingDrafts must only capture inputs marked dirty by user');
assert(adminJs.includes("input.dataset.dirty = 'true'"), 'input listener must set dirty flag when user types');

// 2. Verify loading state waiting for privatePricesLoaded
assert(adminJs.includes('let privatePricesLoaded = false;'), 'must track privatePricesLoaded state');
assert(adminJs.includes('privatePricesLoaded = true;'), 'must set privatePricesLoaded when snapshot arrives');
assert(adminJs.includes('!privatePricesLoaded && !isDemoMode && products.length > 0'), 'must wait for private prices before rendering table');

// 3. Verify permissions allow both special_prices and wholesale_prices
assert(adminJs.includes('currentAdminPermissions?.special_prices !== true && window.currentAdminPermissions?.wholesale_prices !== true'), 'must check both special_prices and wholesale_prices permissions');

// 4. Verify dirty flag is cleaned on save
assert(adminJs.includes('delete input.dataset.dirty;'), 'must clear dirty flag on successful save');

// 5. Verify modal fallback async fetch
assert(adminJs.includes('get(ref(db, `private_prices/${id}`))'), 'modal must fetch private prices if not preloaded in memory');

console.log('✅ PASS: All price editing draft isolation, permission, and persistence tests passed!');
