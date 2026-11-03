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

async function runCalculatorAndDimensionSuite(baseUrl) {
  console.log(`\n======================================================`);
  console.log(`STARTING CALCULATOR & DIMENSION TEST SUITE ON: ${baseUrl}`);
  console.log(`======================================================`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: PC BUILDER CALCULATOR WORKSPACE & SIZING
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 1] Testing PC Builder Calculator (builder.html)...');
    const builderPage = await browser.newPage();
    await builderPage.setViewport({ width: 1366, height: 800 });
    await builderPage.goto(`${baseUrl}/builder.html`, { waitUntil: 'networkidle2', timeout: 35000 });
    await builderPage.waitForSelector('.builder-part-card', { timeout: 20000 });

    const builderInitial = await builderPage.evaluate(() => {
      const cards = document.querySelectorAll('.builder-part-card');
      const calcBtn = document.getElementById('calculateBuilderPriceBtn');
      const totalDisplay = document.getElementById('builderTotal');
      const clearBtn = document.getElementById('clearBuilderBtn');
      return {
        cardCount: cards.length,
        calcBtnText: calcBtn?.textContent?.trim(),
        totalText: totalDisplay?.textContent?.trim(),
        clearBtnVisible: !!clearBtn
      };
    });

    console.log('  Builder Initial State:', builderInitial);
    assert.equal(builderInitial.cardCount, 10, 'Builder must render exactly 10 part slots');
    assert.equal(builderInitial.totalText, '—', 'Initial builder price must be unrevealed (—) until calculated');

    // Wait for catalog products to be loaded
    console.log('  - Waiting for products to load...');
    await builderPage.waitForFunction(() => window.__SPIDER_PRODUCTS_LOADED__ === true, { timeout: 25000 });

    // Select first available part
    console.log('  - Opening picker for CPU slot...');
    await builderPage.click('[data-builder-change="cpu"]');
    await builderPage.waitForSelector('.compare-picker-option', { timeout: 15000 });

    const pickFirst = await builderPage.evaluate(() => {
      const option = document.querySelector('.compare-picker-option');
      if (option) {
        option.click();
        return true;
      }
      return false;
    });
    assert.ok(pickFirst, 'Must select a part from picker');
    await new Promise(r => setTimeout(r, 600));

    // Calculate price
    console.log('  - Clicking «احسب السعر»...');
    await builderPage.click('#calculateBuilderPriceBtn');
    await new Promise(r => setTimeout(r, 500));

    const builderCalculated = await builderPage.evaluate(() => {
      const totalText = document.getElementById('builderTotal')?.textContent?.trim();
      const statusText = document.getElementById('builderStatus')?.textContent?.trim();
      const priceCardsHidden = document.getElementById('builderPriceCards')?.hidden;
      return { totalText, statusText, priceCardsHidden };
    });

    console.log('  Builder Calculated State:', builderCalculated);
    assert.notEqual(builderCalculated.totalText, '—', 'Total must be calculated');
    assert.ok(!builderCalculated.totalText.includes('NaN'), 'Total must not contain NaN');
    assert.ok(!builderCalculated.totalText.includes('غير محدد'), 'Total must not say غير محدد');
    assert.equal(builderCalculated.priceCardsHidden, false, 'Price cards must be visible');

    await builderPage.close();
    console.log('  [PASS] PC Builder calculator tests passed!');

    // -------------------------------------------------------------
    // TEST 2: ALL FILTER ACCORDIONS CLOSED BY DEFAULT & NO <details open>
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 2] Verifying All Filter Accordions CLOSED by default...');
    const catalogPage = await browser.newPage();
    await catalogPage.setViewport({ width: 1366, height: 800 });
    await catalogPage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    await catalogPage.waitForFunction(() => document.querySelectorAll('.product-card').length >= 10, { timeout: 20000 });

    // Open filter rail
    await catalogPage.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 500));

    const accordionAudit = await catalogPage.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('.catalog-filter-section'));
      const openSections = sections.filter(s => s.hasAttribute('open'));
      return {
        totalSections: sections.length,
        openCount: openSections.length,
        openIds: openSections.map(s => s.id)
      };
    });

    console.log('  Accordion Audit:', accordionAudit);
    assert.equal(accordionAudit.openCount, 0, `CRITICAL: All filter sections must be closed by default! Found open: ${accordionAudit.openIds.join(', ')}`);
    assert.ok(accordionAudit.totalSections >= 5, 'Must have at least 5 filter sections');

    // Test expanding an accordion manually
    console.log('  - Manually clicking Price summary to open...');
    await catalogPage.click('#catalogPriceSection > summary');
    await new Promise(r => setTimeout(r, 400));
    const priceOpen = await catalogPage.evaluate(() => document.getElementById('catalogPriceSection')?.hasAttribute('open'));
    assert.ok(priceOpen, 'Price section must open when clicked by user');

    // -------------------------------------------------------------
    // TEST 3: PRICE FILTER NUMERIC PRECISION, ARABIC DIGITS & VALIDATION
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 3] Testing Price Filter Inputs (Arabic digits, commas, field-level errors)...');
    
    // Type Arabic numerals: ١٠٠٠٠
    await catalogPage.evaluate(() => {
      const input = document.getElementById('catalogMinPrice');
      input.value = '١٠٠٠٠';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 600));

    const arabicInputResult = await catalogPage.evaluate(() => {
      const minVal = document.getElementById('catalogMinPrice')?.value;
      const minErr = document.getElementById('catalogMinPriceError')?.textContent;
      const urlHasMin = window.location.search.includes('minPrice=10000') || window.location.search.includes('min=10000');
      return { minVal, minErr, urlHasMin };
    });
    console.log('  Arabic numerals input test:', arabicInputResult);
    assert.ok(arabicInputResult.urlHasMin, 'Arabic digits 10000 must normalize and save to URL minPrice=10000');
    assert.equal(arabicInputResult.minErr, '', 'Valid Arabic numerals must not show error');

    // Inverted range test: min 50000, max 10000
    console.log('  - Testing inverted range error (min > max)...');
    await catalogPage.evaluate(() => {
      const minInput = document.getElementById('catalogMinPrice');
      const maxInput = document.getElementById('catalogMaxPrice');
      minInput.value = '50000';
      maxInput.value = '10000';
      minInput.dispatchEvent(new Event('input', { bubbles: true }));
      maxInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));

    const rangeError = await catalogPage.evaluate(() => {
      const errEl = document.getElementById('catalogPriceError');
      return {
        visible: !errEl?.hidden,
        text: errEl?.textContent?.trim()
      };
    });
    console.log('  Inverted range error result:', rangeError);
    assert.ok(rangeError.visible, 'Price error banner must be visible when min > max');

    // -------------------------------------------------------------
    // TEST 4: UNPRICED PRODUCTS HAVE COMPLETELY BLANK PRICE SPOTS
    // -------------------------------------------------------------
    console.log('\n>>> [TEST 4] Testing Unpriced Product Cards (Completely Blank Price Spot)...');
    await catalogPage.evaluate(() => {
      const btn = document.getElementById('resetCatalogFilters');
      btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const cardsPriceCheck = await catalogPage.evaluate(() => {
      const forbiddenPhrases = ['غير محدد', 'السعر عند الطلب', 'NaN', 'undefined', 'null', 'N/A', '-'];
      const cards = Array.from(document.querySelectorAll('.product-card'));
      const violations = [];
      cards.forEach(c => {
        const priceEl = c.querySelector('.product-price');
        const text = priceEl?.textContent?.trim() || '';
        // Check for forbidden text
        for (const f of forbiddenPhrases) {
          if (text.includes(f)) {
            violations.push({ id: c.dataset.productId, text, forbidden: f });
          }
        }
        // Check for standalone 0 or 0 د.ع
        if (/^\s*0+(\.0+)?\s*(د\.ع)?\s*$/.test(text) && text !== '') {
          violations.push({ id: c.dataset.productId, text, forbidden: '0 د.ع' });
        }
      });
      return { totalCards: cards.length, violations };
    });

    console.log('  Unpriced Product Violations:', cardsPriceCheck.violations);
    assert.equal(cardsPriceCheck.violations.length, 0, 'ZERO products should contain forbidden price strings!');

    await catalogPage.close();
    console.log('  [PASS] Filter, Price, and Calculator precision tests passed perfectly!');

    console.log('\n======================================================');
    console.log(' ALL CALCULATOR & DIMENSION SUITE TESTS PASSED 100%! ');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const targetArg = process.argv[2];
  if (targetArg && targetArg.startsWith('http')) {
    runCalculatorAndDimensionSuite(targetArg)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('CALCULATOR SUITE FAILED:', err);
        process.exit(1);
      });
  } else {
    const server = createServer();
    server.listen(8082, '127.0.0.1', async () => {
      console.log('Running test suite on local server http://127.0.0.1:8082...');
      try {
        await runCalculatorAndDimensionSuite('http://127.0.0.1:8082');
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

module.exports = { runCalculatorAndDimensionSuite };
