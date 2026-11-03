const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const assert = require('assert');

const PUBLIC_DIR = path.resolve('public');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
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

async function runTestSuite(baseUrl) {
  console.log(`\n======================================================`);
  console.log(`STARTING COMPREHENSIVE E2E FILTER SUITE ON: ${baseUrl}`);
  console.log(`======================================================`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: DESKTOP VIEWPORTS (1024, 1280, 1366, 1920)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 1] Testing Desktop Viewports (1024, 1280, 1366, 1920)...');
    const viewports = [
      { width: 1024, height: 768, name: '1024x768' },
      { width: 1280, height: 800, name: '1280x800' },
      { width: 1366, height: 768, name: '1366x768' },
      { width: 1920, height: 1080, name: '1920x1080' }
    ];

    for (const vp of viewports) {
      console.log(`  - Checking Desktop viewport: ${vp.name}...`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 25000 });

      // Verify filter toggle button
      const btnData = await page.evaluate(() => {
        const btn = document.getElementById('openCatalogFilters');
        if (!btn) return { exists: false };
        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        return {
          exists: true,
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        };
      });
      assert.ok(btnData.exists && btnData.visible, `Filter button must be visible at ${vp.name}`);

      // Click filter button to open sidebar
      await page.click('#openCatalogFilters');
      await new Promise(r => setTimeout(r, 600));

      const sidebarOpenData = await page.evaluate(() => {
        const layout = document.querySelector('.catalog-layout');
        const form = document.getElementById('catalogFilters');
        const body = document.getElementById('catalogFiltersBody');
        const brandSection = document.getElementById('catalogBrandSection');
        const priceSection = document.getElementById('catalogPriceSection');
        return {
          layoutExpanded: layout?.classList.contains('filters-expanded'),
          formVisible: window.getComputedStyle(form).display !== 'none',
          bodyVisible: !body.hasAttribute('hidden') && window.getComputedStyle(body).display !== 'none',
          brandOpen: brandSection?.hasAttribute('open'),
          priceOpen: priceSection?.hasAttribute('open'),
          brandsCount: document.querySelectorAll('#catalogBrandFilters label').length
        };
      });

      assert.ok(sidebarOpenData.layoutExpanded, `Layout must expand at ${vp.name}`);
      assert.ok(sidebarOpenData.formVisible, `Sidebar form must be visible at ${vp.name}`);
      assert.ok(sidebarOpenData.bodyVisible, `Sidebar body must be visible at ${vp.name}`);
      assert.equal(sidebarOpenData.brandOpen, false, `Brand accordion must be CLOSED by default at ${vp.name}`);
      assert.equal(sidebarOpenData.priceOpen, false, `Price accordion must be CLOSED by default at ${vp.name}`);

      // Test user expansion of accordion
      await page.click('#catalogBrandSection > summary');
      await new Promise(r => setTimeout(r, 400));
      const brandExpanded = await page.evaluate(() => {
        const s = document.getElementById('catalogBrandSection');
        return s?.hasAttribute('open') && document.querySelectorAll('#catalogBrandFilters label').length > 0;
      });
      assert.ok(brandExpanded, `Brand accordion must open when clicked at ${vp.name}`);

      await page.close();
    }
    console.log('  [PASS] All 4 Desktop viewports passed perfectly!');

    // -------------------------------------------------------------
    // TEST 2: MOBILE VIEWPORTS & DRAWER INTERACTION
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 2] Testing Mobile Viewport (390x844) & Drawer...');
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mobilePage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await mobilePage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 25000 });

    // Verify filter button
    const mBtnVisible = await mobilePage.evaluate(() => {
      const btn = document.getElementById('openCatalogFilters');
      return btn && window.getComputedStyle(btn).display !== 'none';
    });
    assert.ok(mBtnVisible, 'Filter button must be visible on mobile');

    // Click filter button to open mobile drawer
    console.log('  - Opening mobile drawer...');
    await mobilePage.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 600));

    const drawerOpenStatus = await mobilePage.evaluate(() => {
      const bodyOpen = document.body.classList.contains('catalog-filters-open');
      const scrimVisible = !document.getElementById('catalogFilterScrim')?.hasAttribute('hidden');
      const scrollLocked = document.body.classList.contains('overlay-open');
      const brandSection = document.getElementById('catalogBrandSection');
      const priceSection = document.getElementById('catalogPriceSection');
      const brandsCount = document.querySelectorAll('#catalogBrandFilters label').length;
      return {
        bodyOpen,
        scrimVisible,
        scrollLocked,
        brandsCount,
        brandClosed: !brandSection?.hasAttribute('open'),
        priceClosed: !priceSection?.hasAttribute('open')
      };
    });
    assert.ok(drawerOpenStatus.bodyOpen, 'Mobile drawer must be open');
    assert.ok(drawerOpenStatus.scrimVisible, 'Mobile scrim must be visible');
    assert.ok(drawerOpenStatus.scrollLocked, 'Body scroll must be locked');
    assert.ok(drawerOpenStatus.brandClosed, 'Brand section must be closed by default');
    assert.ok(drawerOpenStatus.priceClosed, 'Price section must be closed by default');

    // Test clicking scrim closes drawer
    console.log('  - Testing click outside (scrim) closes drawer...');
    await mobilePage.mouse.click(195, 50);
    await new Promise(r => setTimeout(r, 600));

    const drawerClosedByScrim = await mobilePage.evaluate(() => {
      return !document.body.classList.contains('catalog-filters-open') &&
        !document.body.classList.contains('overlay-open');
    });
    assert.ok(drawerClosedByScrim, 'Clicking scrim must close mobile drawer and unlock scroll');

    // Reopen and test close button (X)
    console.log('  - Testing close button (X) closes drawer...');
    await mobilePage.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 600));
    await mobilePage.click('#closeCatalogFilters');
    await new Promise(r => setTimeout(r, 600));
    const drawerClosedByBtn = await mobilePage.evaluate(() => !document.body.classList.contains('catalog-filters-open'));
    assert.ok(drawerClosedByBtn, 'Close button must close mobile drawer');

    // Reopen and test Apply button
    console.log('  - Testing Apply button closes drawer...');
    await mobilePage.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 600));
    await mobilePage.waitForSelector('#applyCatalogFilters', { visible: true });
    await mobilePage.click('#applyCatalogFilters');
    await new Promise(r => setTimeout(r, 600));
    const drawerClosedByApply = await mobilePage.evaluate(() => !document.body.classList.contains('catalog-filters-open'));
    assert.ok(drawerClosedByApply, 'Apply button must close mobile drawer');

    await mobilePage.close();
    console.log('  [PASS] Mobile drawer tests passed perfectly!');

    // -------------------------------------------------------------
    // TEST 3: SORTING — NEWEST vs OLDEST (CRITICAL REQUIREMENT)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 3] Testing Sorting (Newest vs Oldest)...');
    const sortPage = await browser.newPage();
    await sortPage.setViewport({ width: 1366, height: 900 });
    await sortPage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await sortPage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 25000 });

    const newestCards = await sortPage.evaluate(extractCardsData);
    console.log('  Top 3 Newest:');
    newestCards.slice(0, 3).forEach((c, i) => console.log(`    ${i+1}. [${c.id}] ${c.name}`));

    // Switch to oldest
    console.log('  - Selecting «الأقدم» (oldest)...');
    await sortPage.select('#catalogSort', 'oldest');
    await new Promise(r => setTimeout(r, 800));

    const oldestCards = await sortPage.evaluate(extractCardsData);
    console.log('  Top 3 Oldest:');
    oldestCards.slice(0, 3).forEach((c, i) => console.log(`    ${i+1}. [${c.id}] ${c.name}`));

    const newestIds = newestCards.map(c => c.id);
    const oldestIds = oldestCards.map(c => c.id);

    assert.notDeepEqual(newestIds, oldestIds, 'CRITICAL: Newest and Oldest must NOT be identical!');
    const overlap = newestIds.filter(id => oldestIds.includes(id));
    console.log('  Overlap between top 10 newest and top 10 oldest:', overlap.length);
    assert.equal(overlap.length, 0, 'Top 10 newest and oldest must have 0 overlap');
    assert.ok(sortPage.url().includes('sort=oldest'), 'URL must reflect sort=oldest');

    // Switch back to newest
    await sortPage.select('#catalogSort', 'newest');
    await new Promise(r => setTimeout(r, 800));
    const revertedCards = (await sortPage.evaluate(extractCardsData)).map(c => c.id);
    assert.deepEqual(revertedCards, newestIds, 'Switching back to newest must restore newest cards');
    await sortPage.close();
    console.log('  [PASS] Sorting tests passed perfectly!');

    // -------------------------------------------------------------
    // TEST 4: INDEPENDENT & COMBINED FILTERING
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 4] Testing Independent & Combined Filtering...');
    const filterPage = await browser.newPage();
    await filterPage.setViewport({ width: 1366, height: 900 });
    await filterPage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await filterPage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 25000 });

    // Open sidebar
    await filterPage.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 500));

    // 4.1 Stock filter
    console.log('  - Toggling In Stock only...');
    await filterPage.click('#catalogStockOnly');
    await new Promise(r => setTimeout(r, 600));
    assert.ok(filterPage.url().includes('stock=1'), 'URL must include stock=1');
    const stockCount = await filterPage.evaluate(() => document.querySelectorAll('.product-card').length);
    console.log(`    Products in stock: ${stockCount}`);
    assert.ok(stockCount > 0, 'Must have in stock products');

    // 4.2 Brand filter (e.g. Hikvision)
    console.log('  - Opening Brand accordion...');
    await filterPage.click('#catalogBrandSection > summary');
    await new Promise(r => setTimeout(r, 400));
    console.log('  - Selecting brand filter...');
    const brandName = await filterPage.evaluate(() => {
      const firstBrand = document.querySelector('#catalogBrandFilters input[type="checkbox"]');
      if (firstBrand) {
        firstBrand.click();
        return firstBrand.getAttribute('data-catalog-brand');
      }
      return null;
    });
    await new Promise(r => setTimeout(r, 600));
    console.log(`    Selected brand: ${brandName}`);
    assert.ok(filterPage.url().includes('brand='), 'URL must include brand parameter');
    const brandProductsCount = await filterPage.evaluate(() => document.querySelectorAll('.product-card').length);
    console.log(`    Products for brand ${brandName}: ${brandProductsCount}`);
    assert.ok(brandProductsCount > 0, 'Must have products for selected brand');

    // 4.3 Search with Brand and Stock
    console.log('  - Searching while Brand and Stock active...');
    await filterPage.type('#searchInput', 'DVR');
    await new Promise(r => setTimeout(r, 600));
    assert.ok(filterPage.url().includes('q=DVR') || filterPage.url().includes('search=DVR'), 'URL must include search');
    assert.ok(filterPage.url().includes('stock=1'), 'Stock filter preserved');
    assert.ok(filterPage.url().includes('brand='), 'Brand filter preserved');

    // 4.4 Clear All Filters
    console.log('  - Testing Clear All Filters...');
    await filterPage.click('#resetCatalogFilters');
    await new Promise(r => setTimeout(r, 600));

    const afterClearData = await filterPage.evaluate(() => {
      const url = window.location.search;
      const searchVal = document.getElementById('searchInput')?.value;
      const stockChecked = document.getElementById('catalogStockOnly')?.checked;
      const chipsCount = document.querySelectorAll('.active-filter-chip').length;
      const cardsCount = document.querySelectorAll('.product-card').length;
      return { url, searchVal, stockChecked, chipsCount, cardsCount };
    });
    console.log('    After clear:', afterClearData);
    assert.equal(afterClearData.url, '', 'URL parameters must be wiped clean after Clear');
    assert.equal(afterClearData.searchVal, '', 'Search input must be cleared');
    assert.equal(afterClearData.stockChecked, false, 'Stock toggle must be unchecked');
    assert.equal(afterClearData.chipsCount, 0, 'Active chips must be 0');
    assert.ok(afterClearData.cardsCount >= 10, 'Full product list must be restored');

    await filterPage.close();
    console.log('  [PASS] Filtering & Clear All passed perfectly!');

    // -------------------------------------------------------------
    // TEST 5: URL QUERY PARAMETERS & DIRECT NAVIGATION
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 5] Testing Direct URL Query Parameters...');
    const urlPage = await browser.newPage();
    await urlPage.setViewport({ width: 1366, height: 900 });

    const directTestUrl = `${baseUrl}/?brand=Hikvision&stock=1&sort=oldest`;
    console.log(`  - Navigating directly to: ${directTestUrl}`);
    await urlPage.goto(directTestUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await urlPage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 1, { timeout: 25000 });

    const urlState = await urlPage.evaluate(() => {
      const sortVal = document.getElementById('catalogSort')?.value;
      const stockChecked = document.getElementById('catalogStockOnly')?.checked;
      const chips = Array.from(document.querySelectorAll('.active-filter-chip')).map(c => c.textContent.trim());
      const cards = document.querySelectorAll('.product-card').length;
      return { sortVal, stockChecked, chips, cards };
    });
    console.log('    Direct URL Restored State:', urlState);
    assert.equal(urlState.sortVal, 'oldest', 'Sort must be restored as oldest');
    assert.equal(urlState.stockChecked, true, 'Stock must be restored as checked');
    assert.ok(urlState.chips.length >= 2, 'Chips must reflect brand and stock');
    assert.ok(urlState.cards > 0, 'Must display filtered products');

    // Test Reload
    console.log('  - Reloading page...');
    await urlPage.reload({ waitUntil: 'networkidle2' });
    await urlPage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 1, { timeout: 25000 });
    const reloadSort = await urlPage.evaluate(() => document.getElementById('catalogSort')?.value);
    assert.equal(reloadSort, 'oldest', 'State preserved after reload');

    await urlPage.close();
    console.log('  [PASS] URL parameters direct load and reload passed perfectly!');

    // -------------------------------------------------------------
    // TEST 6: BROWSER HISTORY (BACK / FORWARD STEPPING)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 6] Testing Browser History (Back / Forward)...');
    const histPage = await browser.newPage();
    await histPage.setViewport({ width: 1366, height: 900 });
    await histPage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await histPage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 25000 });

    // Step 1: Base state
    const baseCardsCount = await histPage.evaluate(() => document.querySelectorAll('.product-card').length);

    // Step 2: Open filters & toggle stock
    await histPage.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 500));
    console.log('  - Step 1: Toggle stock...');
    await histPage.click('#catalogStockOnly');
    await new Promise(r => setTimeout(r, 600));
    assert.ok(histPage.url().includes('stock=1'), 'History step 1 URL has stock=1');

    // Step 3: Select a brand
    console.log('  - Step 2: Select brand...');
    await histPage.evaluate(() => {
      const b = document.querySelector('#catalogBrandFilters input[type="checkbox"]');
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 600));
    assert.ok(histPage.url().includes('brand='), 'History step 2 URL has brand');

    // Step 4: Change sort
    console.log('  - Step 3: Change sort to oldest...');
    await histPage.select('#catalogSort', 'oldest');
    await new Promise(r => setTimeout(r, 600));
    assert.ok(histPage.url().includes('sort=oldest'), 'History step 3 URL has sort=oldest');

    // Step 5: Click Back
    console.log('  - Testing Browser Back (should undo sort)...');
    await histPage.goBack({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));
    const afterBack1 = await histPage.evaluate(() => ({
      url: window.location.search,
      sort: document.getElementById('catalogSort')?.value
    }));
    console.log('    After Back 1:', afterBack1);
    assert.ok(!afterBack1.url.includes('sort=oldest'), 'Back 1 should remove sort=oldest');

    // Step 6: Click Back again
    console.log('  - Testing Browser Back (should undo brand)...');
    await histPage.goBack({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));
    const afterBack2 = await histPage.evaluate(() => ({
      url: window.location.search,
      hasBrand: window.location.search.includes('brand=')
    }));
    console.log('    After Back 2:', afterBack2);
    assert.equal(afterBack2.hasBrand, false, 'Back 2 should remove brand');

    // Step 7: Click Forward
    console.log('  - Testing Browser Forward (should restore brand)...');
    await histPage.goForward({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));
    const afterFwd1 = await histPage.evaluate(() => ({
      url: window.location.search,
      hasBrand: window.location.search.includes('brand=')
    }));
    console.log('    After Forward 1:', afterFwd1);
    assert.equal(afterFwd1.hasBrand, true, 'Forward 1 should restore brand');

    await histPage.close();
    console.log('  [PASS] Browser history back/forward passed perfectly!');

    // -------------------------------------------------------------
    // TEST 7: UNSPECIFIED PRICE ("غير محدد")
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 7] Testing Unspecified Prices ("غير محدد")...');
    const pricePage = await browser.newPage();
    await pricePage.setViewport({ width: 1366, height: 900 });
    await pricePage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await pricePage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 25000 });

    const priceAudit = await pricePage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.product-card'));
      let zeroPrice = 0;
      let nanPrice = 0;
      let undefinedPrice = 0;
      let demandPrice = 0;
      let unspecifiedPrice = 0;

      cards.forEach(c => {
        const text = c.querySelector('.current-price')?.textContent?.trim() || '';
        if (text === '0 د.ع' || text === '0') zeroPrice++;
        if (text.includes('NaN')) nanPrice++;
        if (text.includes('undefined')) undefinedPrice++;
        if (text.includes('السعر عند الطلب')) demandPrice++;
        if (text.includes('غير محدد')) unspecifiedPrice++;
      });

      return { zeroPrice, nanPrice, undefinedPrice, demandPrice, unspecifiedPrice, totalCards: cards.length };
    });
    console.log('  Price audit results:', priceAudit);
    assert.equal(priceAudit.zeroPrice, 0, 'No products should have "0 د.ع"');
    assert.equal(priceAudit.nanPrice, 0, 'No products should have "NaN"');
    assert.equal(priceAudit.undefinedPrice, 0, 'No products should have "undefined"');
    assert.equal(priceAudit.demandPrice, 0, 'No products should have "السعر عند الطلب"');
    assert.equal(priceAudit.unspecifiedPrice, 0, 'CRITICAL: No products should have "غير محدد"');

    await pricePage.close();
    console.log('  [PASS] Price labels verified cleanly!');

    console.log('\n======================================================');
    console.log(' ALL COMPREHENSIVE FILTER SUITE TESTS PASSED 100%! ');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const targetArg = process.argv[2];
  if (targetArg && targetArg.startsWith('http')) {
    runTestSuite(targetArg)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('SUITE FAILED:', err);
        process.exit(1);
      });
  } else {
    const server = createServer();
    server.listen(8080, '127.0.0.1', async () => {
      console.log('Running test suite on local server http://127.0.0.1:8080...');
      try {
        await runTestSuite('http://127.0.0.1:8080');
        server.close();
        process.exit(0);
      } catch (err) {
        console.error('LOCAL TEST SUITE FAILED:', err);
        server.close();
        process.exit(1);
      }
    });
  }
}

module.exports = { runTestSuite };
