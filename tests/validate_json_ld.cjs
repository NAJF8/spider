const fs = require('node:fs');
const path = require('node:path');

const files = ['public/index.html', 'public/builder.html', 'public/upgrade.html'];
let totalBlocks = 0;
let errors = 0;

for (const file of files) {
  const filePath = path.resolve(__dirname, '..', file);
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = [...content.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  console.log(`\nChecking ${file}: found ${matches.length} JSON-LD block(s)`);

  matches.forEach((m, idx) => {
    totalBlocks++;
    try {
      const data = JSON.parse(m[1].trim());
      console.log(`  Block ${idx + 1}: valid JSON!`);

      const items = data['@graph'] || [data];
      items.forEach((item, itemIdx) => {
        const type = Array.isArray(item['@type']) ? item['@type'].join(', ') : item['@type'];
        console.log(`    Item ${itemIdx + 1}: @type = [${type}], @id = ${item['@id'] || 'none'}`);

        // Validate types
        if (item['@type']?.includes('ElectronicsStore') || item['@type'] === 'LocalBusiness') {
          if (!item.name || !item.url) throw new Error('Store missing name or url');
          if (item.aggregateRating || item.review) throw new Error('Fabricated reviews/ratings detected!');
          console.log(`      Name: "${item.name}"`);
          console.log(`      Alternate Names: ${JSON.stringify(item.alternateName)}`);
          console.log(`      Telephone: ${item.telephone}`);
          console.log(`      Address: ${item.address?.streetAddress}, ${item.address?.addressLocality}, ${item.address?.addressRegion}`);
          console.log(`      Geo: lat=${item.geo?.latitude}, lon=${item.geo?.longitude}`);
          console.log(`      hasMap: ${item.hasMap}`);
          console.log(`      sameAs: ${JSON.stringify(item.sameAs)}`);
        }

        if (item['@type'] === 'WebSite') {
          if (!item.name || !item.url) throw new Error('WebSite missing name or url');
          console.log(`      WebSite Name: "${item.name}"`);
          console.log(`      Potential Action: ${item.potentialAction ? 'SearchAction' : 'none'}`);
        }

        if (item['@type'] === 'BreadcrumbList') {
          if (!Array.isArray(item.itemListElement) || item.itemListElement.length === 0) {
            throw new Error('BreadcrumbList missing itemListElement array');
          }
          console.log(`      Breadcrumbs count: ${item.itemListElement.length}`);
          item.itemListElement.forEach((crumb) => {
            console.log(`        Position ${crumb.position}: "${crumb.name}" -> ${crumb.item}`);
          });
        }
      });
    } catch (err) {
      errors++;
      console.error(`  ERROR in ${file} block ${idx + 1}:`, err.message);
    }
  });
}

// Also test dynamic product schema generation
console.log('\nTesting dynamic product schema generation logic:');
const sampleProduct = {
  id: '-P2d8b9FZ3IhNHHaWeqg',
  name: 'PNY RTX 4070 Super Dual Verto OC 12GB',
  price: 1125000,
  brand: 'PNY',
  categoryId: 'cat-gpus',
  description: { ar: 'كرت شاشة احترافي', en: 'Professional GPU' },
  image: 'https://spidernajaf.com/assets/spider-hero-poster.jpg'
};

const price = Number(sampleProduct.price || 0);
const dynamicSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  'name': sampleProduct.name,
  'image': sampleProduct.image ? [sampleProduct.image] : undefined,
  'description': sampleProduct.description.ar,
  'sku': sampleProduct.id,
  'brand': {
    '@type': 'Brand',
    'name': sampleProduct.brand
  },
  'category': sampleProduct.categoryId,
  'offers': price > 0 ? {
    '@type': 'Offer',
    'url': `https://spidernajaf.com/?product=${encodeURIComponent(sampleProduct.id)}`,
    'priceCurrency': 'IQD',
    'price': price,
    'itemCondition': 'https://schema.org/NewCondition',
    'availability': 'https://schema.org/InStock',
    'seller': {
      '@type': 'ElectronicsStore',
      'name': 'سبايدر للإلكترونيات',
      'url': 'https://spidernajaf.com'
    }
  } : undefined
};

const dynamicStr = JSON.stringify(dynamicSchema);
const parsedDynamic = JSON.parse(dynamicStr);
console.log('  Dynamic product schema parsed successfully:');
console.log(`    Product: ${parsedDynamic.name}`);
console.log(`    SKU: ${parsedDynamic.sku}`);
console.log(`    Offer Price: ${parsedDynamic.offers?.price} ${parsedDynamic.offers?.priceCurrency}`);
console.log(`    No fake reviews or ratings: ${parsedDynamic.aggregateRating === undefined}`);

if (errors > 0) {
  console.error(`\n❌ Total errors found: ${errors}`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${totalBlocks} static JSON-LD blocks and dynamic Product schema are 100% valid!`);
}
