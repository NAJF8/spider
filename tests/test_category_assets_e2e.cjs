const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Simple static server for public directory
const publicDir = path.join(__dirname, '..', 'public');
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(publicDir, reqPath);
  
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + reqPath);
    return;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

async function run() {
  const port = 8089;
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`Local test server running at http://localhost:${port}`);
  
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  
  const viewports = [
    { name: 'Desktop 1024', w: 1024, h: 768, isMobile: false },
    { name: 'Desktop 1280', w: 1280, h: 800, isMobile: false },
    { name: 'Desktop 1366', w: 1366, h: 768, isMobile: false },
    { name: 'Desktop 1920', w: 1920, h: 1080, isMobile: false },
    { name: 'Mobile 390x844', w: 390, h: 844, isMobile: true },
    { name: 'Mobile 414x896', w: 414, h: 896, isMobile: true }
  ];
  
  try {
    for (const vp of viewports) {
      console.log(`\nTesting viewport: ${vp.name} (${vp.w}x${vp.h})`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.isMobile });
      
      const failedRequests = [];
      page.on('requestfailed', (req) => {
        if (req.url().includes('images/categories/')) {
          failedRequests.push(req.url());
        }
      });
      
      await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle2', timeout: 20000 });
      
      // Wait for categories to render
      await page.waitForSelector('#categoriesRow .cat-circle-item, #categoriesRow .category-card', { timeout: 10000 });
      
      // Wait for category images to complete loading
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll('#categoriesRow img'));
        await Promise.all(imgs.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            // trigger load if lazy
            if (img.loading === 'lazy') img.loading = 'eager';
          });
        }));
      });
      await new Promise(r => setTimeout(r, 300));
      
      const categoryData = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('#categoriesRow .cat-circle-item, #categoriesRow .category-card'));
        return items.map((item) => {
          const img = item.querySelector('.category-card-icon img, .cat-circle img');
          const circle = item.querySelector('.category-card-icon, .cat-circle');
          const circleRect = circle ? circle.getBoundingClientRect() : null;
          const imgRect = img ? img.getBoundingClientRect() : null;
          return {
            src: img ? img.src : null,
            alt: img ? img.alt : '',
            naturalWidth: img ? img.naturalWidth : 0,
            naturalHeight: img ? img.naturalHeight : 0,
            complete: img ? img.complete : false,
            circleWidth: circleRect ? circleRect.width : 0,
            circleHeight: circleRect ? circleRect.height : 0,
            imgWidth: imgRect ? imgRect.width : 0,
            imgHeight: imgRect ? imgRect.height : 0
          };
        });
      });
      
      console.log(`  ✓ Rendered ${categoryData.length} category cards in #categoriesRow`);
      
      // Check each rendered category
      for (const cat of categoryData) {
        if (!cat.src) throw new Error('Missing image src in category card');
        if (!cat.complete || cat.naturalWidth === 0) {
          throw new Error(`Image failed to load: ${cat.src}`);
        }
        if (cat.naturalWidth !== cat.naturalHeight) {
          throw new Error(`Non-square aspect ratio: ${cat.naturalWidth}x${cat.naturalHeight} on ${cat.src}`);
        }
      }
      
      const firstCat = categoryData[0];
      console.log(`  ✓ Sample Circle: ${firstCat.circleWidth.toFixed(1)}px x ${firstCat.circleHeight.toFixed(1)}px | Image: ${firstCat.naturalWidth}x${firstCat.naturalHeight} natural`);
      
      // Open sidebar menu and check sidebar category icons
      await page.evaluate(() => {
        const toggle = document.querySelector('#sidebarToggle, #openSidebar, .hamburger, [aria-label*="قائمة"]');
        if (toggle) toggle.click();
      });
      await new Promise(r => setTimeout(r, 400));
      
      // Wait for sidebar icons to complete loading
      await page.evaluate(async () => {
        const icons = Array.from(document.querySelectorAll('#sidebarNav .sidebar-category-icon'));
        await Promise.all(icons.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        }));
      });
      await new Promise(r => setTimeout(r, 200));
      
      if (vp.name === 'Desktop 1280') {
        const catRow = await page.$('#categoriesRow');
        if (catRow) {
          await catRow.screenshot({ path: 'C:/Users/MSI/.gemini/antigravity/brain/10d73936-3179-498a-bec8-ee4de6fcd792/homepage_categories_row_qa.png' });
        }
        await page.screenshot({ path: 'C:/Users/MSI/.gemini/antigravity/brain/10d73936-3179-498a-bec8-ee4de6fcd792/desktop_categories_qa.png' });
      }
      if (vp.name === 'Mobile 390x844') {
        await page.screenshot({ path: 'C:/Users/MSI/.gemini/antigravity/brain/10d73936-3179-498a-bec8-ee4de6fcd792/mobile_categories_menu_qa.png' });
      }
      
      const sidebarIcons = await page.evaluate(() => {
        const icons = Array.from(document.querySelectorAll('#sidebarNav .sidebar-category-icon'));
        return icons.map((img) => ({
          src: img.src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          width: img.getBoundingClientRect().width,
          height: img.getBoundingClientRect().height
        }));
      });
      
      console.log(`  ✓ Rendered ${sidebarIcons.length} sidebar menu category icons in #sidebarNav`);
      for (const icon of sidebarIcons) {
        if (!icon.complete || icon.naturalWidth === 0) {
          throw new Error(`Sidebar menu image failed to load: ${icon.src}`);
        }
      }
      
      if (failedRequests.length > 0) {
        throw new Error(`Failed requests detected: ${failedRequests.join(', ')}`);
      }
      
      await page.close();
    }
    
    console.log('\n======================================================');
    console.log('✅ ALL RESPONSIVE & ASSET INTEGRATION TESTS PASSED 100%!');
    console.log('======================================================');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
