// tests/verify_sort_e2e.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
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

const SCREENSHOT_DIR = path.resolve('C:/Users/MSI/.gemini/antigravity/brain/936bbba3-51e1-47c2-8e4e-0735255d2eb4/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function extractCardsData() {
  const cards = Array.from(document.querySelectorAll('.product-card')).slice(0, 10);
  return cards.map(c => {
    const id = c.getAttribute('data-product-id')
      || c.querySelector('[data-details]')?.getAttribute('data-details')
      || c.querySelector('[data-favorite]')?.getAttribute('data-favorite')
      || '';
    const name = c.querySelector('.product-title')?.textContent?.trim() || '';
    const price = c.querySelector('.current-price')?.textContent?.trim() || '';
    return { id, name, price };
  });
}

async function runTests(baseUrl) {
  console.log(`\n======================================================`);
  console.log(`RUNNING E2E SORT VERIFICATION ON: ${baseUrl}`);
  console.log(`======================================================`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Desktop (1366x900) - Default (Newest) vs Oldest
    // -------------------------------------------------------------
    console.log('\n--- [TEST 1] Desktop Sort Flow ---');
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    console.log(`Navigating to ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for catalog to load and render cards
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('.product-card');
      return cards.length >= 10;
    }, { timeout: 20000 });

    // Scroll to productsSection
    await page.evaluate(() => {
      document.getElementById('productsSection')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 800));

    // Check initial sort dropdown value and displayed text
    const initialSortData = await page.evaluate(() => {
      const select = document.getElementById('catalogSort');
      return {
        value: select ? select.value : null,
        selectedText: select ? select.options[select.selectedIndex].text : null
      };
    });
    console.log('Initial desktop sort data:', initialSortData);
    assert.equal(initialSortData.value, 'newest', 'Default sort value should be newest');

    // Extract top 10 products in Newest state
    const newestTop10 = await page.evaluate(extractCardsData);

    console.log('\nTop 10 Products under «الأحدث» (Newest):');
    newestTop10.forEach((p, idx) => {
      console.log(`  ${idx + 1}. [${p.id}] ${p.name} (${p.price})`);
    });

    const shotNewestDesktop = path.join(SCREENSHOT_DIR, '01_desktop_newest_products.png');
    await page.screenshot({ path: shotNewestDesktop, fullPage: false });
    console.log('Saved screenshot:', shotNewestDesktop);

    // Switch dropdown to «الأقدم» (Oldest)
    console.log('\nSelecting «الأقدم» (oldest) from #catalogSort dropdown...');
    await page.select('#catalogSort', 'oldest');
    await new Promise(r => setTimeout(r, 1000));

    const currentUrlAfterOldest = page.url();
    console.log('URL after selecting oldest:', currentUrlAfterOldest);
    assert.ok(currentUrlAfterOldest.includes('sort=oldest'), 'URL must contain sort=oldest');

    // Extract top 10 products in Oldest state
    const oldestTop10 = await page.evaluate(extractCardsData);

    console.log('\nTop 10 Products under «الأقدم» (Oldest):');
    oldestTop10.forEach((p, idx) => {
      console.log(`  ${idx + 1}. [${p.id}] ${p.name} (${p.price})`);
    });

    const shotOldestDesktop = path.join(SCREENSHOT_DIR, '02_desktop_oldest_products.png');
    await page.screenshot({ path: shotOldestDesktop, fullPage: false });
    console.log('Saved screenshot:', shotOldestDesktop);

    // Verification: Top 10 Newest and Top 10 Oldest must NOT be identical
    const newestIds = newestTop10.map(p => p.id);
    const oldestIds = oldestTop10.map(p => p.id);
    console.log('\nComparing Newest IDs vs Oldest IDs...');
    console.log('Newest IDs:', newestIds);
    console.log('Oldest IDs:', oldestIds);
    assert.notDeepEqual(newestIds, oldestIds, 'CRITICAL FAILURE: Newest and Oldest produced identical product IDs!');

    const overlap = newestIds.filter(id => oldestIds.includes(id));
    console.log('Overlap count between Top 10 newest and oldest:', overlap.length);
    assert.equal(overlap.length, 0, 'Top 10 newest and top 10 oldest must have 0 overlap in a catalog of 290 products');

    // Switch dropdown back to «الأحدث» (Newest)
    console.log('\nSelecting «الأحدث» (newest) from #catalogSort dropdown...');
    await page.select('#catalogSort', 'newest');
    await new Promise(r => setTimeout(r, 1000));

    const currentUrlAfterNewest = page.url();
    console.log('URL after selecting newest:', currentUrlAfterNewest);
    assert.ok(currentUrlAfterNewest.includes('sort=newest'), 'URL must contain sort=newest');

    const revertedNewestIds = (await page.evaluate(extractCardsData)).map(p => p.id);
    assert.deepEqual(revertedNewestIds, newestIds, 'Switching back to newest must restore the exact newest products list');

    // -------------------------------------------------------------
    // TEST 2: Direct URL navigation, Refresh, and Back/Forward
    // -------------------------------------------------------------
    console.log('\n--- [TEST 2] Direct URL, Refresh, and History Navigation ---');
    
    // Direct URL ?sort=oldest
    const oldestDirectUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'sort=oldest';
    console.log('Direct navigation to:', oldestDirectUrl);
    await page.goto(oldestDirectUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 20000 });

    const directOldestSelectVal = await page.evaluate(() => document.getElementById('catalogSort')?.value);
    console.log('#catalogSort value on direct ?sort=oldest:', directOldestSelectVal);
    assert.equal(directOldestSelectVal, 'oldest', 'Dropdown must reflect sort=oldest from URL parameter');

    const directOldestIds = (await page.evaluate(extractCardsData)).map(p => p.id);
    assert.deepEqual(directOldestIds, oldestIds, 'Direct ?sort=oldest must render the exact oldest products list');

    // Refresh page
    console.log('Reloading page with ?sort=oldest...');
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 20000 });

    const reloadOldestSelectVal = await page.evaluate(() => document.getElementById('catalogSort')?.value);
    assert.equal(reloadOldestSelectVal, 'oldest', 'Dropdown must stay oldest after reload');
    const reloadOldestIds = (await page.evaluate(extractCardsData)).map(p => p.id);
    assert.deepEqual(reloadOldestIds, oldestIds, 'Reloading on ?sort=oldest must preserve oldest products');

    // Switch to newest via select to create history entry
    console.log('Switching to newest via select...');
    await page.select('#catalogSort', 'newest');
    await new Promise(r => setTimeout(r, 800));

    // Browser Back
    console.log('Testing Browser Back button...');
    await page.goBack({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const backUrl = page.url();
    const backSelectVal = await page.evaluate(() => document.getElementById('catalogSort')?.value);
    const backIds = (await page.evaluate(extractCardsData)).map(p => p.id);
    console.log('After Browser Back:', { url: backUrl, selectVal: backSelectVal });
    assert.equal(backSelectVal, 'oldest', 'Back navigation must restore oldest in dropdown');
    assert.deepEqual(backIds, oldestIds, 'Back navigation must restore oldest products list');

    // Browser Forward
    console.log('Testing Browser Forward button...');
    await page.goForward({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const fwdUrl = page.url();
    const fwdSelectVal = await page.evaluate(() => document.getElementById('catalogSort')?.value);
    const fwdIds = (await page.evaluate(extractCardsData)).map(p => p.id);
    console.log('After Browser Forward:', { url: fwdUrl, selectVal: fwdSelectVal });
    assert.equal(fwdSelectVal, 'newest', 'Forward navigation must restore newest in dropdown');
    assert.deepEqual(fwdIds, newestIds, 'Forward navigation must restore newest products list');

    // -------------------------------------------------------------
    // TEST 3: Coexistence with Filters, Search, Views
    // -------------------------------------------------------------
    console.log('\n--- [TEST 3] Coexistence with Filters, Search, and Views ---');
    
    // Toggle stock only
    console.log('Testing stock only toggle with sort...');
    await page.evaluate(() => {
      const stock = document.getElementById('catalogStockOnly');
      if (stock) { stock.checked = true; stock.dispatchEvent(new Event('change')); }
    });
    await new Promise(r => setTimeout(r, 800));
    const stockUrl = page.url();
    assert.ok(stockUrl.includes('stock=1') && stockUrl.includes('sort=newest'), 'URL must preserve both stock=1 and sort=newest');

    // Search query
    console.log('Testing search query with sort...');
    await page.type('#searchInput', 'Ryzen');
    await new Promise(r => setTimeout(r, 800));
    
    // Switch to oldest under search
    await page.select('#catalogSort', 'oldest');
    await new Promise(r => setTimeout(r, 800));
    const searchOldestUrl = page.url();
    assert.ok(searchOldestUrl.includes('q=Ryzen') && searchOldestUrl.includes('sort=oldest'), 'URL must preserve search and sort=oldest');

    // Clear search
    await page.evaluate(() => {
      const input = document.getElementById('searchInput');
      if (input) { input.value = ''; input.dispatchEvent(new Event('input')); }
      const stock = document.getElementById('catalogStockOnly');
      if (stock) { stock.checked = false; stock.dispatchEvent(new Event('change')); }
    });
    await new Promise(r => setTimeout(r, 800));

    // Switch view to list
    console.log('Testing List view switch with sort...');
    await page.click('#catalogViewList');
    await new Promise(r => setTimeout(r, 500));
    const isListActive = await page.evaluate(() => document.getElementById('productsGrid')?.classList.contains('is-list'));
    assert.ok(isListActive, 'Products grid should have is-list class');

    // Switch view back to grid
    await page.click('#catalogViewGrid');
    await new Promise(r => setTimeout(r, 500));

    // -------------------------------------------------------------
    // TEST 4: Mobile Viewport (390x844)
    // -------------------------------------------------------------
    console.log('\n--- [TEST 4] Mobile Viewport (390x844) ---');
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    console.log(`Navigating to ${baseUrl} on mobile...`);
    await mobilePage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await mobilePage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 20000 });

    await mobilePage.evaluate(() => {
      document.getElementById('productsSection')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 800));

    const shotMobileNewest = path.join(SCREENSHOT_DIR, '03_mobile_newest_products.png');
    await mobilePage.screenshot({ path: shotMobileNewest, fullPage: false });
    console.log('Saved screenshot:', shotMobileNewest);

    // Switch to oldest on mobile
    console.log('Selecting «الأقدم» on mobile...');
    await mobilePage.select('#catalogSort', 'oldest');
    await new Promise(r => setTimeout(r, 1000));

    const mobileOldestUrl = mobilePage.url();
    assert.ok(mobileOldestUrl.includes('sort=oldest'), 'Mobile URL must contain sort=oldest');

    const shotMobileOldest = path.join(SCREENSHOT_DIR, '04_mobile_oldest_products.png');
    await mobilePage.screenshot({ path: shotMobileOldest, fullPage: false });
    console.log('Saved screenshot:', shotMobileOldest);

    const mobileOldestIds = (await mobilePage.evaluate(extractCardsData)).map(p => p.id);
    assert.deepEqual(mobileOldestIds, oldestIds, 'Mobile oldest products must match desktop oldest products');

    console.log('\n======================================================');
    console.log(' ALL E2E SORT VERIFICATION TESTS PASSED SUCCESSFULLY! ');
    console.log('======================================================');

    return {
      newestTop10,
      oldestTop10,
      screenshots: [
        shotNewestDesktop,
        shotOldestDesktop,
        shotMobileNewest,
        shotMobileOldest
      ]
    };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const target = process.argv[2] || 'https://spidernajaf.com';
  runTests(target)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\nE2E VERIFICATION FAILED:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
