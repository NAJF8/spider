// tests/verify_filter_button_production.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/MSI/.gemini/antigravity/brain/e751a9d4-553e-45fd-991b-b7aa2ca24e74/screenshots');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

(async () => {
  console.log('=== STARTING MANDATORY PRODUCTION VERIFICATION ===');
  const targetUrl = 'https://spidernajaf.com/?v=' + Date.now();
  console.log('Target URL:', targetUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // ---------------------------------------------------------
    // TEST 1: Desktop 1366x900 (Light Mode)
    // ---------------------------------------------------------
    console.log('\n[TEST 1] Desktop 1366x900 - Light Mode');
    const pageDesktop = await browser.newPage();
    await pageDesktop.setViewport({ width: 1366, height: 900 });

    console.log('Navigating to', targetUrl);
    await pageDesktop.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for products
    await pageDesktop.waitForSelector('.product-card', { timeout: 20000 });
    console.log('Products rendered successfully');

    // Scroll to productsSection
    await pageDesktop.evaluate(() => {
      document.getElementById('productsSection')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 800));

    // Verify filter button exists and is physically visible
    const buttonDataClosed = await pageDesktop.evaluate(() => {
      const btn = document.getElementById('openCatalogFilters');
      if (!btn) return { exists: false };
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      const isInsideViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
      const text = btn.innerText.trim();
      const ariaExpanded = btn.getAttribute('aria-expanded');
      const arrowIcon = btn.querySelector('.filter-btn-arrow')?.className;
      const slidersIcon = btn.querySelector('.fa-sliders')?.className;
      const layoutExpanded = document.querySelector('.catalog-layout')?.classList.contains('filters-expanded');
      const filtersDisplay = window.getComputedStyle(document.getElementById('catalogFilters')).display;

      return {
        exists: true,
        isVisible,
        isInsideViewport,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        text,
        ariaExpanded,
        arrowIcon,
        slidersIcon,
        layoutExpanded,
        filtersDisplay
      };
    });

    console.log('Desktop Closed State Button Data:', buttonDataClosed);
    if (!buttonDataClosed.isVisible) {
      throw new Error('FAIL: Filter button #openCatalogFilters is not visible on desktop!');
    }

    // Save screenshot of Desktop Closed
    const shotDesktopClosed = path.join(ARTIFACT_DIR, '05_desktop_filter_button_closed.png');
    await pageDesktop.screenshot({ path: shotDesktopClosed });
    console.log('Saved screenshot:', shotDesktopClosed);

    // Click filter button to open
    console.log('Clicking #openCatalogFilters to OPEN filters...');
    await pageDesktop.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 600));

    const buttonDataOpen = await pageDesktop.evaluate(() => {
      const btn = document.getElementById('openCatalogFilters');
      const rect = btn.getBoundingClientRect();
      const ariaExpanded = btn.getAttribute('aria-expanded');
      const arrowIcon = btn.querySelector('.filter-btn-arrow')?.className;
      const layoutExpanded = document.querySelector('.catalog-layout')?.classList.contains('filters-expanded');
      const filtersDisplay = window.getComputedStyle(document.getElementById('catalogFilters')).display;
      const filtersBodyDisplay = window.getComputedStyle(document.getElementById('catalogFiltersBody')).display;
      const bodyScrollLocked = document.body.classList.contains('overlay-open');
      const brandsCount = document.querySelectorAll('#catalogBrandFilters label').length;

      return {
        ariaExpanded,
        arrowIcon,
        layoutExpanded,
        filtersDisplay,
        filtersBodyDisplay,
        bodyScrollLocked,
        brandsCount
      };
    });

    console.log('Desktop Open State Data:', buttonDataOpen);
    if (buttonDataOpen.filtersDisplay === 'none' || !buttonDataOpen.layoutExpanded) {
      throw new Error('FAIL: Filters failed to expand on desktop click!');
    }

    // Save screenshot of Desktop Open
    const shotDesktopOpen = path.join(ARTIFACT_DIR, '06_desktop_filter_expanded.png');
    await pageDesktop.screenshot({ path: shotDesktopOpen });
    console.log('Saved screenshot:', shotDesktopOpen);

    // Test selecting a brand filter
    console.log('Testing brand filter selection on desktop...');
    const brandSelected = await pageDesktop.evaluate(() => {
      const firstBrand = document.querySelector('#catalogBrandFilters input[type="checkbox"]');
      if (firstBrand) {
        firstBrand.click();
        return firstBrand.value;
      }
      return null;
    });
    console.log('Selected brand:', brandSelected);
    await new Promise(r => setTimeout(r, 800));

    const filterResult = await pageDesktop.evaluate(() => {
      const chips = document.querySelectorAll('.active-filter-chip');
      const products = document.querySelectorAll('.product-card');
      const badgeCount = document.getElementById('catalogFilterCount')?.textContent;
      return {
        chipsCount: chips.length,
        productsCount: products.length,
        badgeCount
      };
    });
    console.log('After applying brand filter:', filterResult);

    // Click filter button again to CLOSE
    console.log('Clicking #openCatalogFilters to CLOSE filters...');
    await pageDesktop.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 600));

    const verifyClosed = await pageDesktop.evaluate(() => {
      const filtersDisplay = window.getComputedStyle(document.getElementById('catalogFilters')).display;
      const bodyScrollLocked = document.body.classList.contains('overlay-open');
      const chipsCount = document.querySelectorAll('.active-filter-chip').length;
      return { filtersDisplay, bodyScrollLocked, chipsCount };
    });
    console.log('Desktop Closed State verification:', verifyClosed);
    if (verifyClosed.bodyScrollLocked) {
      throw new Error('FAIL: Body scroll locked on desktop!');
    }
    await pageDesktop.close();

    // ---------------------------------------------------------
    // TEST 2: Mobile 390x844 (Light Mode)
    // ---------------------------------------------------------
    console.log('\n[TEST 2] Mobile 390x844');
    const pageMobile = await browser.newPage();
    await pageMobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pageMobile.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await pageMobile.waitForSelector('.product-card', { timeout: 20000 });

    await pageMobile.evaluate(() => {
      document.getElementById('productsSection')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 800));

    const mobileBtnData = await pageMobile.evaluate(() => {
      const btn = document.getElementById('openCatalogFilters');
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      return {
        isVisible: style.display !== 'none' && rect.width > 0,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      };
    });
    console.log('Mobile Filter Button Visible:', mobileBtnData);
    if (!mobileBtnData.isVisible) {
      throw new Error('FAIL: Filter button not visible on mobile!');
    }

    const shotMobileClosed = path.join(ARTIFACT_DIR, '07_mobile_filter_button_closed.png');
    await pageMobile.screenshot({ path: shotMobileClosed });
    console.log('Saved screenshot:', shotMobileClosed);

    // Click mobile filter button to open drawer
    console.log('Clicking #openCatalogFilters on mobile...');
    await pageMobile.click('#openCatalogFilters');
    await new Promise(r => setTimeout(r, 600));

    const mobileDrawerOpen = await pageMobile.evaluate(() => {
      const isOpen = document.body.classList.contains('catalog-filters-open');
      const scrimVisible = !document.getElementById('catalogFilterScrim')?.hasAttribute('hidden');
      return { isOpen, scrimVisible };
    });
    console.log('Mobile Drawer Open Status:', mobileDrawerOpen);
    if (!mobileDrawerOpen.isOpen) {
      throw new Error('FAIL: Mobile drawer did not open!');
    }

    const shotMobileOpen = path.join(ARTIFACT_DIR, '08_mobile_filter_drawer_open.png');
    await pageMobile.screenshot({ path: shotMobileOpen });
    console.log('Saved screenshot:', shotMobileOpen);

    // Close mobile drawer
    console.log('Closing mobile drawer via #closeCatalogFilters...');
    await pageMobile.click('#closeCatalogFilters');
    await new Promise(r => setTimeout(r, 600));

    const mobileDrawerClosed = await pageMobile.evaluate(() => {
      const isOpen = document.body.classList.contains('catalog-filters-open');
      const bodyScrollLocked = document.body.classList.contains('overlay-open');
      return { isOpen, bodyScrollLocked };
    });
    console.log('Mobile Drawer Closed Status:', mobileDrawerClosed);
    if (mobileDrawerClosed.isOpen || mobileDrawerClosed.bodyScrollLocked) {
      throw new Error('FAIL: Mobile scroll lock lingered or drawer did not close!');
    }
    await pageMobile.close();

    // ---------------------------------------------------------
    // TEST 3: Dark Mode Verification (Desktop 1366x900)
    // ---------------------------------------------------------
    console.log('\n[TEST 3] Dark Mode Verification');
    const pageDark = await browser.newPage();
    await pageDark.setViewport({ width: 1366, height: 900 });
    await pageDark.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await pageDark.waitForSelector('.product-card', { timeout: 20000 });

    // Switch to dark theme
    await pageDark.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('productsSection')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 800));

    const darkBtnData = await pageDark.evaluate(() => {
      const btn = document.getElementById('openCatalogFilters');
      const style = window.getComputedStyle(btn);
      return {
        isVisible: style.display !== 'none',
        bgColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor
      };
    });
    console.log('Dark Mode Button Data:', darkBtnData);

    const shotDarkMode = path.join(ARTIFACT_DIR, '09_dark_mode_filter_button.png');
    await pageDark.screenshot({ path: shotDarkMode });
    console.log('Saved screenshot:', shotDarkMode);
    await pageDark.close();

    console.log('\n======================================================');
    console.log(' ALL MANDATORY PRODUCTION VERIFICATION TESTS PASSED! ');
    console.log('======================================================');

  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
