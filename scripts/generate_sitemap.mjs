import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SITEMAP_PATH = path.resolve(ROOT_DIR, 'public', 'sitemap.xml');

const BASE_URL = 'https://spidernajaf.com';

const STATIC_PAGES = [
  { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily' },
  { loc: `${BASE_URL}/builder.html`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${BASE_URL}/upgrade.html`, priority: '0.8', changefreq: 'weekly' }
];

async function loadCatalog() {
  try {
    const res = await fetch('https://spider-backend.coffee101.workers.dev/api/store/catalog');
    if (res.ok) {
      const data = await res.json();
      if (data && (data.products || data.categories)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Worker catalog fetch failed, falling back to local snapshot:', err.message);
  }

  const snapshotPath = path.resolve(ROOT_DIR, 'production-products-before-filter.json');
  const raw = await fs.readFile(snapshotPath, 'utf8');
  const products = JSON.parse(raw);
  return { products, categories: {} };
}

function escapeXml(unsafe) {
  return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function formatDate(timestamp) {
  if (!timestamp) return new Date().toISOString().split('T')[0];
  const num = Number(timestamp);
  if (Number.isFinite(num) && num > 1000000000000) {
    return new Date(num).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

async function main() {
  console.log('Fetching catalog for sitemap generation...');
  const catalog = await loadCatalog();
  const products = Object.entries(catalog.products || {})
    .filter(([_, p]) => !p.isHidden && p.status !== 'archived' && p.status !== 'draft');

  const knownCategories = [
    'cat-computers',
    'cat-pc-parts',
    'cat-cpus',
    'cat-gpus',
    'cat-motherboards',
    'cat-ram',
    'cat-storage',
    'cat-psu',
    'cat-cooling',
    'cat-cases',
    'cat-monitors',
    'cat-printers',
    'cat-network',
    'cat-security',
    'cat-power',
    'cat-accessories'
  ];

  const now = new Date().toISOString().split('T')[0];

  const urls = [];

  // Static pages
  for (const page of STATIC_PAGES) {
    urls.push(`  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // Categories
  for (const catId of knownCategories) {
    urls.push(`  <url>
    <loc>${escapeXml(`${BASE_URL}/?category=${catId}`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  // Products
  for (const [id, prod] of products) {
    const lastmod = formatDate(prod.updatedAt || prod.createdAt);
    urls.push(`  <url>
    <loc>${escapeXml(`${BASE_URL}/?product=${encodeURIComponent(id)}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  await fs.writeFile(SITEMAP_PATH, sitemapXml, 'utf8');
  console.log(`Successfully generated sitemap.xml with ${urls.length} entries at ${SITEMAP_PATH}`);
}

main().catch((err) => {
  console.error('Error generating sitemap:', err);
  process.exit(1);
});
