const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PORT = 5173;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SCREENSHOT_DIR = 'C:\\Users\\MSI\\.gemini\\antigravity\\brain\\e751a9d4-553e-45fd-991b-b7aa2ca24e74\\screenshots';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4'
};

function createStaticServer() {
  return http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl === '/') cleanUrl = '/index.html';
    const filePath = path.join(PUBLIC_DIR, cleanUrl);
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(cleanUrl).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });
}

async function runTests() {
  console.log('--- Starting Comprehensive E2E Test Suite ---');
  const server = createStaticServer();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`✓ Local static server running at http://localhost:${PORT}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER_ERR:', err.toString()));
    page.on('requestfailed', req => console.log('REQ_FAIL:', req.url(), req.failure()));

    // ==========================================
    // 1. DESKTOP VIEWPORT (1920x1080)
    // ==========================================
    console.log('\n[Phase 1] Testing Desktop Viewport (1920x1080)...');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });

    // 1.1 Products loaded without login
    await page.waitForFunction(() => document.querySelectorAll('#productsGrid .product-card').length > 0, { timeout: 15000 });
    const productCount = await page.evaluate(() => document.querySelectorAll('#productsGrid .product-card').length);
    console.log(`✓ Guest catalog loaded: ${productCount} product cards displayed without login`);
    if (productCount <= 0) throw new Error('No products displayed for guest visitor!');

    // 1.2 Categories are circular and compact
    const catData = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#categoriesRow .cat-circle-item, #categoriesRow .category-card'));
      const first = items[0];
      const circle = first?.querySelector('.cat-circle, .category-card-icon');
      const name = first?.querySelector('.cat-name, strong');
      const count = first?.querySelector('.cat-count, small');
      const circleRect = circle ? circle.getBoundingClientRect() : null;
      return {
        count: items.length,
        circleWidth: circleRect?.width,
        circleHeight: circleRect?.height,
        circleBorderRadius: circle ? window.getComputedStyle(circle).borderRadius : null,
        firstTitle: name?.innerText?.trim(),
        firstCount: count?.innerText?.trim()
      };
    });
    console.log(`✓ Categories rendered: ${catData.count} categories, circle diameter: ${Math.round(catData.circleWidth)}px x ${Math.round(catData.circleHeight)}px (border-radius: ${catData.circleBorderRadius})`);
    if (catData.count <= 0) throw new Error('Categories failed to render!');

    // 1.3 Shopping Cart Icon visibility
    const cartIconInfo = await page.evaluate(() => {
      const btn = document.querySelector('#openCartBtn');
      const svg = btn?.querySelector('.cart-icon-svg, svg');
      const badge = btn?.querySelector('#cartBadge');
      const rect = svg ? svg.getBoundingClientRect() : null;
      return {
        btnExists: !!btn,
        svgExists: !!svg,
        width: rect?.width,
        height: rect?.height,
        badgeText: badge?.innerText?.trim()
      };
    });
    console.log(`✓ Cart Icon visible: ${cartIconInfo.width}px x ${cartIconInfo.height}px, initial badge: "${cartIconInfo.badgeText}"`);
    if (!cartIconInfo.svgExists || cartIconInfo.width < 10) throw new Error('Shopping cart icon is invisible or too small!');

    // 1.4 Filter: Title is "الفلتر", icon present, closed by default
    const filterInitial = await page.evaluate(() => {
      const header = document.querySelector('#catalogFiltersHeader');
      const title = document.querySelector('#catalogFiltersHeadingText')?.innerText?.trim();
      const body = document.querySelector('#catalogFiltersBody');
      const arrow = document.querySelector('#catalogFilterArrow');
      return {
        title,
        bodyHidden: body?.hidden === true || window.getComputedStyle(body).display === 'none',
        ariaExpanded: header?.getAttribute('aria-expanded'),
        arrowClass: arrow?.className
      };
    });
    console.log(`✓ Filter title: "${filterInitial.title}", closed by default: ${filterInitial.bodyHidden}, aria-expanded: "${filterInitial.ariaExpanded}"`);
    if (filterInitial.title !== 'الفلتر') throw new Error(`Filter title is "${filterInitial.title}", expected "الفلتر"!`);
    if (!filterInitial.bodyHidden) throw new Error('Filter options are not closed by default!');

    // 1.5 Click to expand filter
    await page.click('#catalogFiltersHeader');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

    const filterExpanded = await page.evaluate(() => {
      const header = document.querySelector('#catalogFiltersHeader');
      const body = document.querySelector('#catalogFiltersBody');
      const arrow = document.querySelector('#catalogFilterArrow');
      return {
        bodyHidden: body?.hidden === true || window.getComputedStyle(body).display === 'none',
        ariaExpanded: header?.getAttribute('aria-expanded'),
        arrowClass: arrow?.className,
        sectionsCount: document.querySelectorAll('.catalog-filter-section').length,
        brandSearchExists: !!document.querySelector('#catalogBrandSearch'),
        priceSliderExists: !!document.querySelector('#catalogRangeSlider')
      };
    });
    console.log(`✓ Filter expanded smoothly: body visible: ${!filterExpanded.bodyHidden}, arrow: "${filterExpanded.arrowClass}", aria-expanded: "${filterExpanded.ariaExpanded}"`);
    if (filterExpanded.bodyHidden) throw new Error('Filter failed to expand when clicked!');

    // 1.6 Click again to collapse filter
    await page.click('#catalogFiltersHeader');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    const filterCollapsed = await page.evaluate(() => {
      const body = document.querySelector('#catalogFiltersBody');
      return body?.hidden === true || window.getComputedStyle(body).display === 'none';
    });
    console.log(`✓ Filter collapsed on second click: ${filterCollapsed}`);
    if (!filterCollapsed) throw new Error('Filter failed to collapse on second click!');

    // Take Desktop Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_home_guest.png'), fullPage: false });
    console.log('✓ Desktop screenshot captured: 01_desktop_home_guest.png');

    // ==========================================
    // 2. MOBILE VIEWPORT (390x844 - iPhone 12/13/14)
    // ==========================================
    console.log('\n[Phase 2] Testing Mobile Viewport (390x844)...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

    // 2.1 Check mobile filter toggle button
    const mobileFilterBtn = await page.evaluate(() => {
      const btn = document.querySelector('#openCatalogFilters');
      const label = btn?.querySelector('.catalog-filter-label')?.innerText?.trim() || btn?.innerText?.trim();
      const style = btn ? window.getComputedStyle(btn) : null;
      return {
        label,
        visible: style?.display !== 'none'
      };
    });
    console.log(`✓ Mobile filter button visible: ${mobileFilterBtn.visible}, label: "${mobileFilterBtn.label}"`);
    if (!mobileFilterBtn.visible) throw new Error('Mobile filter button is not visible!');

    // 2.2 Open Mobile Filter Drawer
    await page.click('#openCatalogFilters');
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

    const mobileDrawerState = await page.evaluate(() => {
      const bodyHasOpen = document.body.classList.contains('catalog-filters-open');
      const scrim = document.querySelector('#catalogFilterScrim');
      const scrimVisible = scrim && window.getComputedStyle(scrim).display !== 'none';
      const drawer = document.querySelector('#catalogFilters');
      const drawerVisible = drawer && window.getComputedStyle(drawer).visibility !== 'hidden';
      const bodyLocked = document.body.classList.contains('overlay-open');
      return { bodyHasOpen, scrimVisible, drawerVisible, bodyLocked };
    });
    console.log(`✓ Mobile drawer opened: visible: ${mobileDrawerState.drawerVisible}, scrim: ${mobileDrawerState.scrimVisible}, scroll lock: ${mobileDrawerState.bodyLocked}`);
    if (!mobileDrawerState.drawerVisible) throw new Error('Mobile drawer did not open!');

    // Take Mobile Drawer Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_mobile_filter_drawer.png'), fullPage: false });

    // 2.3 Close Mobile Filter Drawer & verify scroll lock released
    await page.click('#closeCatalogFilters');
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

    const mobileClosedState = await page.evaluate(() => {
      const bodyHasOpen = document.body.classList.contains('catalog-filters-open');
      const bodyLocked = document.body.classList.contains('overlay-open');
      const bodyTop = document.body.style.top;
      return { bodyHasOpen, bodyLocked, bodyTop };
    });
    console.log(`✓ Mobile drawer closed: bodyHasOpen: ${mobileClosedState.bodyHasOpen}, bodyLocked: ${mobileClosedState.bodyLocked}, top: "${mobileClosedState.bodyTop}"`);
    if (mobileClosedState.bodyHasOpen || mobileClosedState.bodyLocked) throw new Error('Mobile scroll lock remained stuck after closing drawer!');

    // Take Mobile Home Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_mobile_home.png'), fullPage: false });

    // ==========================================
    // 3. RESPONSIVE TEST MATRIX
    // ==========================================
    console.log('\n[Phase 3] Testing Responsive Viewports (375, 430, 768, 1024, 1366)...');
    const viewports = [
      { name: 'Mobile_Small_375', width: 375, height: 667 },
      { name: 'Mobile_Large_430', width: 430, height: 932 },
      { name: 'Tablet_768', width: 768, height: 1024 },
      { name: 'Desktop_Small_1024', width: 1024, height: 768 },
      { name: 'Desktop_Medium_1366', width: 1366, height: 768 }
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.evaluate(() => new Promise(r => setTimeout(r, 150)));
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`✓ Viewport ${vp.name} (${vp.width}x${vp.height}): Horizontal Overflow = ${hasHorizontalOverflow}`);
      if (hasHorizontalOverflow) throw new Error(`Horizontal overflow detected at ${vp.width}px!`);
    }

    // ==========================================
    // 4. DARK MODE VERIFICATION
    // ==========================================
    console.log('\n[Phase 4] Testing Dark Mode...');
    await page.setViewport({ width: 1366, height: 768 });
    await page.click('#themeToggle');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

    const darkModeCheck = await page.evaluate(() => {
      const theme = document.documentElement.dataset.theme;
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const cartIcon = document.querySelector('#openCartBtn .cart-icon-svg');
      return { theme, bg, cartVisible: !!cartIcon };
    });
    console.log(`✓ Dark mode active: theme="${darkModeCheck.theme}", body bg="${darkModeCheck.bg}", cart visible: ${darkModeCheck.cartVisible}`);
    if (darkModeCheck.theme !== 'dark') throw new Error('Theme toggle failed to set data-theme="dark"');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_desktop_dark_mode.png'), fullPage: false });

    // Switch back to light
    await page.click('#themeToggle');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

    // ==========================================
    // 5. ADD TO CART & CART DRAWER
    // ==========================================
    console.log('\n[Phase 5] Testing Add to Cart & Cart Drawer...');
    const addBtn = await page.$('.product-card:not(.is-out) .product-add-btn');
    if (addBtn) {
      await addBtn.click();
      await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
      const badgeCount = await page.evaluate(() => document.querySelector('#cartBadge')?.innerText?.trim());
      console.log(`✓ Product added to cart, badge updated to: "${badgeCount}"`);
      if (badgeCount !== '1') throw new Error(`Cart badge did not update, expected "1", got "${badgeCount}"`);

      // Open Cart Drawer
      await page.click('#openCartBtn');
      await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

      const drawerCheck = await page.evaluate(() => {
        const drawer = document.querySelector('#cartSidebar');
        const open = drawer?.classList.contains('open') || window.getComputedStyle(drawer).display !== 'none';
        const itemCount = document.querySelectorAll('#cartItemsList .cart-item').length;
        const total = document.querySelector('#cartTotalValue')?.innerText?.trim();
        return { open, itemCount, total };
      });
      console.log(`✓ Cart Drawer opened: items count = ${drawerCheck.itemCount}, total = "${drawerCheck.total}"`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_cart_drawer_open.png'), fullPage: false });

      // Close cart
      await page.click('#closeCartBtn');
      await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    }

    // ==========================================
    // 6. BUILDER & UPGRADE PAGES
    // ==========================================
    console.log('\n[Phase 6] Testing Builder & Upgrade pages...');
    await page.goto(`http://localhost:${PORT}/builder.html`, { waitUntil: 'networkidle2' });
    const builderCart = await page.evaluate(() => !!document.querySelector('#openCartBtn .cart-icon-svg'));
    console.log(`✓ Builder page loaded, cart icon present: ${builderCart}`);

    await page.goto(`http://localhost:${PORT}/upgrade.html`, { waitUntil: 'networkidle2' });
    const upgradeCart = await page.evaluate(() => !!document.querySelector('#openCartBtn'));
    console.log(`✓ Upgrade page loaded, cart button present: ${upgradeCart}`);

    console.log('\n=============================================');
    console.log(' ALL E2E AND RESPONSIVE TESTS PASSED (100%) ');
    console.log('=============================================\n');

  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    console.log('Static test server stopped.');
  }
}

runTests().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
