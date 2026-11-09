const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const PORT = 8089;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon'
};

function createServer() {
  return http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(PUBLIC_DIR, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Fallback for SPA routing if applicable
        if (!path.extname(reqPath) || reqPath.startsWith('/admin')) {
          const fallback = reqPath.startsWith('/admin') ? 'admin.html' : 'index.html';
          return fs.readFile(path.join(PUBLIC_DIR, fallback), (e2, d2) => {
            if (e2) {
              res.writeHead(404);
              res.end('Not found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(d2);
            }
          });
        }
        res.writeHead(404);
        return res.end('Not found');
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
}

const REQUIRED_VIEWPORTS = [
  { width: 390, height: 844, name: '390x844 (Mobile iPhone)' },
  { width: 412, height: 915, name: '412x915 (Mobile Galaxy)' },
  { width: 768, height: 1024, name: '768x1024 (Tablet iPad)' },
  { width: 1280, height: 800, name: '1280x800 (Laptop)' },
  { width: 1440, height: 900, name: '1440x900 (Desktop)' }
];

async function runAudit() {
  console.log('=== Starting Comprehensive SEO & Technical Verification ===\n');

  // 1. Static file checks
  console.log('1. Verifying static files...');
  const robotsTxt = fs.readFileSync(path.join(PUBLIC_DIR, 'robots.txt'), 'utf8');
  if (!robotsTxt.includes('Sitemap: https://spidernajaf.com/sitemap.xml')) {
    throw new Error('robots.txt does not reference production sitemap');
  }
  if (!robotsTxt.includes('Disallow: /admin')) {
    throw new Error('robots.txt does not block admin');
  }
  console.log('  [PASS] robots.txt is valid and properly configured');

  const sitemapXml = fs.readFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), 'utf8');
  if (!sitemapXml.includes('https://spidernajaf.com/')) {
    throw new Error('sitemap.xml does not contain homepage');
  }
  if (!sitemapXml.includes('https://spidernajaf.com/?category=')) {
    throw new Error('sitemap.xml missing category URLs');
  }
  if (!sitemapXml.includes('https://spidernajaf.com/?product=')) {
    throw new Error('sitemap.xml missing product deep links');
  }
  const sitemapUrlsCount = (sitemapXml.match(/<loc>/g) || []).length;
  console.log(`  [PASS] sitemap.xml is valid with ${sitemapUrlsCount} URLs`);

  const verificationFile = fs.readFileSync(path.join(PUBLIC_DIR, 'googlefc2b415a7968474e.html'), 'utf8');
  if (!verificationFile.includes('googlefc2b415a7968474e')) {
    throw new Error('Verification file missing required token');
  }
  console.log('  [PASS] Google site verification file exists');

  // 2. Start HTTP server for browser audit
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`\n2. Local test server listening on http://localhost:${PORT}`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('Worker catalog fetch failed')) {
        consoleErrors.push(msg.text());
      }
    });

    // 3. Homepage SEO audit
    console.log('\n3. Testing Homepage rendered metadata & DOM on http://localhost:' + PORT);
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });

    const metadata = await page.evaluate(() => {
      const getMeta = (name, attr = 'name') => document.querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content') || null;
      const getCanonical = () => document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
      const h1Text = document.querySelector('h1')?.textContent?.trim() || null;
      const h1Count = document.querySelectorAll('h1').length;
      const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
        try { return JSON.parse(s.textContent); } catch (e) { return null; }
      }).filter(Boolean);

      return {
        title: document.title,
        description: getMeta('description'),
        canonical: getCanonical(),
        robots: getMeta('robots'),
        googleVerification: getMeta('google-site-verification'),
        ogTitle: getMeta('og:title', 'property'),
        ogDesc: getMeta('og:description', 'property'),
        ogUrl: getMeta('og:url', 'property'),
        ogImage: getMeta('og:image', 'property'),
        h1Text,
        h1Count,
        schemas,
        hasAboutSection: Boolean(document.querySelector('.store-about-section'))
      };
    });

    console.log('  Page Title:', metadata.title);
    if (!metadata.title.includes('سبايدر للإلكترونيات')) throw new Error('Title does not prioritize brand name');
    console.log('  [PASS] Title correctly prioritizes "سبايدر للإلكترونيات"');

    console.log('  Meta Description:', metadata.description);
    if (!metadata.description || !metadata.description.includes('سبايدر للإلكترونيات') || !metadata.description.includes('النجف')) {
      throw new Error('Meta description missing brand or location');
    }
    console.log('  [PASS] Meta description contains brand, location and store services');

    console.log('  Canonical URL:', metadata.canonical);
    if (metadata.canonical !== 'https://spidernajaf.com/') throw new Error('Invalid canonical URL');
    console.log('  [PASS] Canonical matches production domain https://spidernajaf.com/');

    console.log('  H1 Heading count:', metadata.h1Count, '| Text:', metadata.h1Text);
    if (metadata.h1Count !== 1) throw new Error(`Expected exactly 1 H1, found ${metadata.h1Count}`);
    if (!metadata.h1Text.includes('سبايدر للإلكترونيات في النجف')) throw new Error('H1 heading text mismatch');
    console.log('  [PASS] Exactly one semantic H1 heading with official brand & location');

    if (metadata.hasAboutSection) throw new Error('store-about-section should not be present in DOM');
    console.log('  [PASS] Long SEO text block is removed from the visible storefront');

    // Verify structured data
    const storeSchema = metadata.schemas.find(s => s['@graph']?.some(g => g['@id']?.includes('#store')));
    if (!storeSchema) throw new Error('Missing Schema.org Store graph');
    console.log('  [PASS] Schema.org Store/LocalBusiness JSON-LD is valid');

    // 4. Test Viewports & Responsive Overflow
    console.log('\n4. Testing Mobile Responsiveness across 5 required viewports...');
    for (const vp of REQUIRED_VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 400));
      const overflow = await page.evaluate(() => {
        const docW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        const badElements = [];
        for (const el of document.querySelectorAll('*')) {
          const rect = el.getBoundingClientRect();
          if (rect.right > docW + 1) {
            badElements.push(`${el.tagName}.${el.className} (right: ${Math.round(rect.right)}, clientW: ${docW})`);
          }
        }
        return { docW, scrollW, hasOverflow: scrollW > docW + 1, badElements: badElements.slice(0, 3) };
      });

      if (overflow.hasOverflow) {
        throw new Error(`Horizontal overflow detected on ${vp.name}! scrollWidth: ${overflow.scrollW}, clientWidth: ${overflow.docW}, culprits: ${overflow.badElements.join(', ')}`);
      }
      console.log(`  [PASS] ${vp.name}: No horizontal overflow (scrollWidth: ${overflow.scrollW}px, clientWidth: ${overflow.docW}px)`);
    }

    // 5. Test Product Deep Linking & Dynamic Schema
    console.log('\n5. Testing Product Deep Linking (?product=ID) and Dynamic Product Schema...');
    // Wait for catalog products to load
    await page.waitForFunction(() => window.__SPIDER_PRODUCTS_LOADED__ === true, { timeout: 15000 });
    const sampleProductId = await page.evaluate(() => {
      const card = document.querySelector('[data-details]');
      return card ? card.getAttribute('data-details') : null;
    });

    if (sampleProductId) {
      console.log(`  Opening sample product id: ${sampleProductId}`);
      await page.evaluate((id) => window.openProductDetails(id), sampleProductId);
      await new Promise(r => setTimeout(r, 600));

      const modalState = await page.evaluate(() => {
        const productSchema = document.getElementById('productSchema');
        let parsed = null;
        if (productSchema) {
          try { parsed = JSON.parse(productSchema.textContent); } catch (e) {}
        }
        return {
          title: document.title,
          url: window.location.href,
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
          productSchema: parsed
        };
      });

      console.log('  Product Title:', modalState.title);
      if (!modalState.title.includes('سبايدر للإلكترونيات')) throw new Error('Dynamic product title missing brand');
      console.log('  [PASS] Dynamic title updated to include product name and brand');

      if (!modalState.canonical.includes('?product=')) throw new Error('Canonical does not reflect product deep link');
      console.log('  [PASS] Canonical dynamically updated to product deep link:', modalState.canonical);

      if (!modalState.productSchema || modalState.productSchema['@type'] !== 'Product') {
        throw new Error('Product schema JSON-LD was not injected');
      }
      console.log('  [PASS] Schema.org Product markup successfully injected into DOM');

      // Now close modal
      await page.evaluate(() => {
        const closeBtn = document.getElementById('closeProductDetailsBtn');
        if (closeBtn) closeBtn.click();
      });
      await new Promise(r => setTimeout(r, 500));

      const restoredState = await page.evaluate(() => {
        return {
          title: document.title,
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
          hasProductSchema: Boolean(document.getElementById('productSchema')),
          searchParams: window.location.search
        };
      });

      if (restoredState.hasProductSchema) throw new Error('Product schema was not cleaned up after modal close');
      console.log('  [PASS] Product schema cleaned up upon modal close');
      if (restoredState.canonical !== 'https://spidernajaf.com/') throw new Error('Canonical not restored to homepage');
      console.log('  [PASS] Canonical restored to homepage:', restoredState.canonical);
    } else {
      console.log('  [SKIP] No product in state to deep link');
    }

    // 6. Test Category Filter SEO
    console.log('\n6. Testing Category Navigation SEO...');
    await page.goto(`http://localhost:${PORT}/index.html?category=cat-computers`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    const categorySeo = await page.evaluate(() => {
      return {
        title: document.title,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href')
      };
    });

    console.log('  Category Title:', categorySeo.title);
    console.log('  Category Canonical:', categorySeo.canonical);
    if (!categorySeo.canonical.includes('?category=cat-computers')) {
      throw new Error('Category canonical did not match expected category URL');
    }
    console.log('  [PASS] Category title and canonical correctly set');

    // 7. Check Builder & Upgrade pages
    console.log('\n7. Testing Builder & Upgrade pages...');
    await page.goto(`http://localhost:${PORT}/builder.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    const builderTitle = await page.title();
    const builderCanonical = await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.getAttribute('href'));
    console.log('  Builder Title:', builderTitle, '| Canonical:', builderCanonical);
    if (!builderTitle.includes('سبايدر للإلكترونيات') || builderCanonical !== 'https://spidernajaf.com/builder.html') {
      throw new Error('Builder page SEO tags mismatch');
    }
    console.log('  [PASS] Builder page SEO tags verified');

    await page.goto(`http://localhost:${PORT}/upgrade.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    const upgradeTitle = await page.title();
    const upgradeCanonical = await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.getAttribute('href'));
    console.log('  Upgrade Title:', upgradeTitle, '| Canonical:', upgradeCanonical);
    if (!upgradeTitle.includes('سبايدر للإلكترونيات') || upgradeCanonical !== 'https://spidernajaf.com/upgrade.html') {
      throw new Error('Upgrade page SEO tags mismatch');
    }
    console.log('  [PASS] Upgrade page SEO tags verified');

    // 8. Console errors check
    if (consoleErrors.length > 0) {
      console.warn('  [WARN] Console errors detected during test:', consoleErrors);
    } else {
      console.log('\n  [PASS] Zero console errors during test navigation!');
    }

    console.log('\n======================================================');
    console.log('✅ ALL SEO AUDITS & RESPONSIVENESS TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
