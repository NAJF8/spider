const puppeteer = require('puppeteer');

const viewports = [
  { w: 1024, h: 768, type: 'desktop' },
  { w: 1280, h: 800, type: 'desktop' },
  { w: 1366, h: 768, type: 'desktop' },
  { w: 1440, h: 900, type: 'desktop' },
  { w: 1920, h: 1080, type: 'desktop' },
  { w: 320, h: 568, type: 'mobile' },
  { w: 360, h: 800, type: 'mobile' },
  { w: 375, h: 812, type: 'mobile' },
  { w: 390, h: 844, type: 'mobile' },
  { w: 414, h: 896, type: 'mobile' },
  { w: 430, h: 932, type: 'mobile' }
];

async function runAudit(baseUrl) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const pageName of ['index.html', 'builder.html', 'upgrade.html']) {
      console.log('\n=== Checking Page: ' + pageName + ' on ' + baseUrl + ' ===');
      for (const vp of viewports) {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.type === 'mobile' });
        await page.goto(baseUrl + '/' + pageName, { waitUntil: 'networkidle2', timeout: 35000 });
        
        // If index.html, test with filter closed AND with filter open
        const statesToTest = pageName === 'index.html' ? ['closed', 'open'] : ['default'];
        
        for (const state of statesToTest) {
          if (state === 'open') {
            await page.evaluate(() => {
              const btn = document.getElementById('openCatalogFilters');
              if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 600));
          }

          const res = await page.evaluate(() => {
            const scrollW = document.documentElement.scrollWidth;
            const clientW = document.documentElement.clientWidth;
            
            // Find all elements causing overflow if any
            const overflowers = [];
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > clientW + 1) {
                overflowers.push({
                  tag: el.tagName,
                  id: el.id,
                  className: el.className,
                  right: Math.round(rect.right),
                  width: Math.round(rect.width)
                });
              }
            }
            
            // Sizing metrics
            const filterEl = document.getElementById('catalogFilters');
            const filterRect = filterEl ? filterEl.getBoundingClientRect() : null;
            const builderEl = document.getElementById('pcBuilderSection') || document.querySelector('.builder-workspace');
            const builderRect = builderEl ? builderEl.getBoundingClientRect() : null;
            const productsGrid = document.getElementById('productsGrid');
            const gridRect = productsGrid ? productsGrid.getBoundingClientRect() : null;
            const cards = Array.from(document.querySelectorAll('.product-card')).slice(0, 3).map(c => Math.round(c.getBoundingClientRect().width));

            return {
              scrollW,
              clientW,
              hasOverflow: scrollW > clientW,
              overflowersCount: overflowers.length,
              overflowers: overflowers.slice(0, 5),
              filterW: filterRect ? Math.round(filterRect.width) : null,
              builderW: builderRect ? Math.round(builderRect.width) : null,
              gridW: gridRect ? Math.round(gridRect.width) : null,
              cardWidths: cards
            };
          });

          const label = vp.w + 'x' + vp.h + ' (' + vp.type + ') [' + state + ']';
          if (res.hasOverflow) {
            console.log('  ❌ [OVERFLOW] ' + label + ': scrollW=' + res.scrollW + ', clientW=' + res.clientW);
            console.log('     Top overflowing elements:', JSON.stringify(res.overflowers));
          } else {
            console.log('  ✅ [OK] ' + label + ' - GridW=' + res.gridW + ', FilterW=' + res.filterW + ', BuilderW=' + res.builderW + ', Cards=' + JSON.stringify(res.cardWidths));
          }
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const url = process.argv[2] || 'https://spidernajaf.com';
runAudit(url).catch(e => console.error(e));
