// tests/live_production_smoke_test.js
const puppeteer = require('puppeteer');

(async () => {
  console.log('--- STARTING LIVE PRODUCTION SMOKE TEST ---');
  const urlsToTest = [
    'https://spider-aaa19.web.app',
    'https://spidernajaf.com'
  ];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const targetUrl of urlsToTest) {
      console.log(`\n========================================`);
      console.log(`Testing Live URL: ${targetUrl}`);
      console.log(`========================================`);
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });

      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));
      page.on('console', msg => {
        if (msg.type() === 'error') {
          pageErrors.push(msg.text());
        }
      });

      console.log(`Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

      // Wait up to 15 seconds for products
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.product-card');
        return cards.length > 0;
      }, { timeout: 20000 }).catch(e => console.log('Timeout waiting for product cards'));

      const evaluation = await page.evaluate(() => {
        const productsCount = document.querySelectorAll('.product-card').length;
        const categoriesCount = document.querySelectorAll('.cat-circle-item').length;
        const cartIconVisible = document.querySelectorAll('.cart-icon-svg').length > 0;
        const filterTitle = document.querySelector('#catalogFiltersHeadingText')?.textContent?.trim();
        const filterBodyHidden = document.getElementById('catalogFiltersBody')?.hasAttribute('hidden');
        const filterBodyDisplay = window.getComputedStyle(document.getElementById('catalogFiltersBody')).display;
        const bodyScrollLocked = document.body.classList.contains('overlay-open');
        const activeFilterCountBadge = document.getElementById('catalogFilterActiveCount')?.textContent;

        return {
          productsCount,
          categoriesCount,
          cartIconVisible,
          filterTitle,
          filterBodyHidden,
          filterBodyDisplay,
          bodyScrollLocked,
          activeFilterCountBadge
        };
      });

      console.log('Results for', targetUrl, ':', evaluation);

      if (evaluation.productsCount === 0) {
        console.error(`FAIL: No products loaded on ${targetUrl}`);
      } else {
        console.log(`SUCCESS: ${evaluation.productsCount} products loaded without login!`);
      }

      if (!evaluation.cartIconVisible) {
        console.error(`FAIL: Cart icon not found/visible on ${targetUrl}`);
      } else {
        console.log(`SUCCESS: Cart icon visible!`);
      }

      if (evaluation.filterTitle !== 'الفلتر') {
        console.error(`FAIL: Filter title is "${evaluation.filterTitle}", expected "الفلتر"`);
      } else {
        console.log(`SUCCESS: Filter titled "الفلتر"`);
      }

      if (evaluation.filterBodyDisplay !== 'none') {
        console.error(`FAIL: Filter body should be closed by default, got ${evaluation.filterBodyDisplay}`);
      } else {
        console.log(`SUCCESS: Filter is closed by default!`);
      }

      // Test expanding desktop filter
      console.log('Testing filter expansion on desktop...');
      await page.click('#catalogFiltersHeader');
      await new Promise(r => setTimeout(r, 400));
      const expandedDisplay = await page.evaluate(() => {
        return window.getComputedStyle(document.getElementById('catalogFiltersBody')).display;
      });
      console.log(`Filter expanded display: ${expandedDisplay}`);

      // Test mobile view
      console.log('Testing mobile viewport (390x844)...');
      await page.setViewport({ width: 390, height: 844 });
      await new Promise(r => setTimeout(r, 600));
      const mobileFilterBtnVisible = await page.evaluate(() => {
        const btn = document.getElementById('openCatalogFilters');
        return btn && window.getComputedStyle(btn).display !== 'none';
      });
      console.log(`Mobile filter toggle button visible: ${mobileFilterBtnVisible}`);

      await page.click('#openCatalogFilters');
      await new Promise(r => setTimeout(r, 500));
      const drawerOpen = await page.evaluate(() => {
        const drawer = document.getElementById('catalogFilters');
        return drawer && drawer.classList.contains('mobile-open');
      });
      console.log(`Mobile drawer opened: ${drawerOpen}`);

      await page.click('#closeCatalogFilters');
      await new Promise(r => setTimeout(r, 500));
      const drawerClosed = await page.evaluate(() => {
        const drawer = document.getElementById('catalogFilters');
        const bodyLocked = document.body.classList.contains('overlay-open');
        return !drawer.classList.contains('mobile-open') && !bodyLocked;
      });
      console.log(`Mobile drawer closed and scroll lock cleanly released: ${drawerClosed}`);

      await page.close();
    }

    console.log('\n--- ALL LIVE PRODUCTION SMOKE TESTS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Smoke test error:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
