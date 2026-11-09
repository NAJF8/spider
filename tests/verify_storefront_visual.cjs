const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const PORT = 8092;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const ARTIFACTS_DIR = 'C:\\Users\\MSI\\.gemini\\antigravity\\brain\\cda7b528-3830-4f48-9aa3-0d8a4f2fea56';

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

async function verify() {
  const server = createServer();
  await new Promise(r => server.listen(PORT, r));
  console.log(`Server running at http://localhost:${PORT}`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();

    // 1. Desktop Visual Check
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });

    const layoutData = await page.evaluate(() => {
      const getMeta = (name, attr = 'name') => document.querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content');
      const getCanonical = () => document.querySelector('link[rel="canonical"]')?.getAttribute('href');

      // Sections in order
      const mainChildren = Array.from(document.querySelector('main').children).map(el => ({
        tag: el.tagName,
        className: el.className,
        id: el.id,
        rect: {
          top: Math.round(el.getBoundingClientRect().top),
          bottom: Math.round(el.getBoundingClientRect().bottom),
          height: Math.round(el.getBoundingClientRect().height)
        }
      }));

      // Search for any store about text
      const bodyText = document.body.innerText;
      const hasAboutTitle = bodyText.includes('سبايدر للإلكترونيات — وجهتكم المتخصصة في الحوسبة والتكنولوجيا');
      const hasBadge = bodyText.includes('المتجر الرسمي في النجف');
      const hasPillars = bodyText.includes('قطع ومكونات الحاسوب الشخصي') || bodyText.includes('تجميع وتطوير الحواسيب الاحترافية');

      const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
        try { return JSON.parse(s.textContent); } catch (e) { return null; }
      }).filter(Boolean);

      return {
        title: document.title,
        description: getMeta('description'),
        canonical: getCanonical(),
        robots: getMeta('robots'),
        googleSiteVerification: getMeta('google-site-verification'),
        ogTitle: getMeta('og:title', 'property'),
        ogImage: getMeta('og:image', 'property'),
        mainChildren,
        hasAboutTitle,
        hasBadge,
        hasPillars,
        jsonLdScriptsCount: jsonLdScripts.length,
        hasStoreSchema: jsonLdScripts.some(s => s['@graph']?.some(g => g['@id']?.includes('#store')))
      };
    });

    console.log('--- Metadata Verification ---');
    console.log('Title:', layoutData.title);
    console.log('Description:', layoutData.description);
    console.log('Canonical:', layoutData.canonical);
    console.log('Robots:', layoutData.robots);
    console.log('Google Verification:', layoutData.googleSiteVerification);
    console.log('OG Title:', layoutData.ogTitle);
    console.log('OG Image:', layoutData.ogImage);
    console.log('Schema.org Store Schema present:', layoutData.hasStoreSchema);

    console.log('\n--- Visible Text Verification ---');
    console.log('Has SEO About Title in visible body:', layoutData.hasAboutTitle);
    console.log('Has SEO Badge in visible body:', layoutData.hasBadge);
    console.log('Has Pillars in visible body:', layoutData.hasPillars);

    console.log('\n--- Section Ordering & Spacing in <main> ---');
    layoutData.mainChildren.forEach((child, i) => {
      console.log(`Section ${i + 1}: <${child.tag} class="${child.className}" id="${child.id}"> top=${child.rect.top}px, bottom=${child.rect.bottom}px, height=${child.rect.height}px`);
    });

    // Check gap between Categories and Products
    const catSection = layoutData.mainChildren.find(c => c.className.includes('categories-section'));
    const prodSection = layoutData.mainChildren.find(c => c.className.includes('products-section'));
    if (catSection && prodSection) {
      const gap = prodSection.rect.top - catSection.rect.bottom;
      console.log(`\nGap between Categories bottom and Products top: ${gap}px`);
    }

    // Capture screenshots
    const desktopScreenshotPath = path.join(ARTIFACTS_DIR, 'desktop_storefront_top.png');
    await page.screenshot({ path: desktopScreenshotPath, clip: { x: 0, y: 0, width: 1440, height: 1200 } });
    console.log(`Desktop screenshot saved to: ${desktopScreenshotPath}`);

    // Mobile screenshot
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    const mobileScreenshotPath = path.join(ARTIFACTS_DIR, 'mobile_storefront_top.png');
    await page.screenshot({ path: mobileScreenshotPath, clip: { x: 0, y: 0, width: 390, height: 1200 } });
    console.log(`Mobile screenshot saved to: ${mobileScreenshotPath}`);

  } finally {
    await browser.close();
    server.close();
  }
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
