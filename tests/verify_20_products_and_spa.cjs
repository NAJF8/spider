const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const PORT = 8092;
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
        if (!path.extname(reqPath)) {
          return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
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

async function run() {
  console.log('=== Starting 20+ Products & SPA Indexability Verification ===\n');

  // Read sitemap and extract product URLs
  const sitemapXml = fs.readFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), 'utf8');
  const allProductUrls = [...sitemapXml.matchAll(/<loc>(https:\/\/spidernajaf\.com\/\?product=([^<]+))<\/loc>/g)]
    .map(m => ({ url: m[1], id: decodeURIComponent(m[2]) }));

  console.log(`Total product URLs found in sitemap: ${allProductUrls.length}`);
  if (allProductUrls.length < 20) throw new Error('Less than 20 product URLs in sitemap');

  // Select 22 distinct products across the spectrum (start, middle, end)
  const step = Math.floor(allProductUrls.length / 22);
  const sampleProducts = [];
  for (let i = 0; i < allProductUrls.length && sampleProducts.length < 22; i += step) {
    sampleProducts.push(allProductUrls[i]);
  }
  console.log(`Sampled ${sampleProducts.length} product URLs for deep testing.\n`);

  const server = createServer();
  await new Promise(r => server.listen(PORT, r));
  const baseUrl = `http://localhost:${PORT}`;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Verify Sample Products
    console.log('--- Testing 22 Sample Product URLs ---');
    let passedProducts = 0;

    for (let i = 0; i < sampleProducts.length; i++) {
      const { id } = sampleProducts[i];
      const testUrl = `${baseUrl}/index.html?product=${encodeURIComponent(id)}`;

      const response = await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      const status = response.status();
      if (status !== 200) throw new Error(`Product ${id} returned status ${status}`);

      // Wait for catalog and deep linking to resolve
      await page.waitForFunction(() => window.__SPIDER_PRODUCTS_LOADED__ === true, { timeout: 15000 });
      // Allow modal animation to finish
      await new Promise(r => setTimeout(r, 400));

      const info = await page.evaluate((prodId) => {
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
        const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content');
        const title = document.title;
        const modalOpen = document.getElementById('productDetailsModal')?.classList.contains('open');
        const modalTitle = document.getElementById('modalProductTitle')?.textContent?.trim();
        const mainImg = document.getElementById('productMainImage')?.getAttribute('src');
        const schemaEl = document.getElementById('productSchema');
        let productSchema = null;
        if (schemaEl) {
          try { productSchema = JSON.parse(schemaEl.textContent); } catch (e) {}
        }
        const hasNoindex = robots?.includes('noindex') || false;

        return {
          canonical,
          robots,
          title,
          modalOpen,
          modalTitle,
          mainImg,
          hasProductSchema: Boolean(productSchema),
          productSchemaName: productSchema?.name,
          productSchemaSku: productSchema?.sku,
          hasNoindex
        };
      }, id);

      if (info.hasNoindex) throw new Error(`Product ${id} has accidental noindex!`);
      if (!info.canonical || !info.canonical.includes(`?product=${encodeURIComponent(id)}`)) {
        throw new Error(`Product ${id} canonical mismatch: ${info.canonical}`);
      }
      if (!info.modalOpen) {
        throw new Error(`Product ${id} modal was not automatically opened on deep link!`);
      }
      if (!info.title || !info.title.includes('سبايدر للإلكترونيات')) {
        throw new Error(`Product ${id} title does not include brand: ${info.title}`);
      }
      if (!info.hasProductSchema || info.productSchemaSku !== id) {
        throw new Error(`Product ${id} dynamic Schema.org Product mismatch: sku=${info.productSchemaSku}`);
      }

      console.log(`  [${i + 1}/22] Product ${id.padEnd(22)} | Modal: OPEN | Title: "${info.modalTitle?.slice(0, 30)}..." | Schema: OK`);
      passedProducts++;
    }

    console.log(`\n  ✅ All ${passedProducts}/22 Sample Products passed all indexability checks!\n`);

    // 2. Test 5 Categories
    console.log('--- Testing 5 Category URLs ---');
    const categories = [
      'cat-computers',
      'cat-pc-parts',
      'cat-cpus',
      'cat-gpus',
      'cat-ram'
    ];

    for (const catId of categories) {
      const catUrl = `${baseUrl}/index.html?category=${catId}`;
      const res = await page.goto(catUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      if (res.status() !== 200) throw new Error(`Category ${catId} returned status ${res.status()}`);
      await new Promise(r => setTimeout(r, 600));

      const catInfo = await page.evaluate((id) => {
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
        const title = document.title;
        const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content');
        return { canonical, title, robots };
      }, catId);

      if (catInfo.robots?.includes('noindex')) throw new Error(`Category ${catId} has noindex!`);
      if (catInfo.canonical !== `https://spidernajaf.com/?category=${catId}`) {
        throw new Error(`Category ${catId} canonical mismatch: ${catInfo.canonical}`);
      }
      console.log(`  Category: ${catId.padEnd(16)} | Title: "${catInfo.title}" | Canonical: ${catInfo.canonical}`);
    }
    console.log('  ✅ All 5 Categories verified!\n');

    // 3. Test Static Public Pages
    console.log('--- Testing Static Public Pages ---');
    const staticPages = [
      { path: '/index.html', canonical: 'https://spidernajaf.com/' },
      { path: '/builder.html', canonical: 'https://spidernajaf.com/builder.html' },
      { path: '/upgrade.html', canonical: 'https://spidernajaf.com/upgrade.html' }
    ];

    for (const p of staticPages) {
      const res = await page.goto(`${baseUrl}${p.path}`, { waitUntil: 'networkidle2', timeout: 30000 });
      if (res.status() !== 200) throw new Error(`${p.path} returned status ${res.status()}`);
      const info = await page.evaluate(() => ({
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        title: document.title,
        hasNoindex: document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex') || false
      }));

      if (info.hasNoindex) throw new Error(`${p.path} has noindex!`);
      if (info.canonical !== p.canonical) throw new Error(`${p.path} canonical expected ${p.canonical}, got ${info.canonical}`);
      console.log(`  Page: ${p.path.padEnd(16)} | Title: "${info.title}" | Canonical: ${info.canonical}`);
    }
    console.log('  ✅ All Static Public Pages verified!\n');

    console.log('======================================================');
    console.log('✅ ALL PRODUCT AND ROUTE INDEXABILITY TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ PRODUCT VERIFICATION FAILED:', err);
  process.exit(1);
});
