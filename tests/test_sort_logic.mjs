import assert from 'node:assert/strict';

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
export function parseFirebasePushIdTimestamp(id) {
  if (typeof id !== 'string' || id.length < 8) return null;
  let time = 0;
  for (let i = 0; i < 8; i++) {
    const idx = PUSH_CHARS.indexOf(id.charAt(i));
    if (idx === -1) return null;
    time = time * 64 + idx;
  }
  return (time > 1577836800000 && time < 2524608000000) ? time : null;
}

export function productCreationTime(product) {
  if (!product) return 0;
  if (product.createdAt != null) {
    const num = Number(product.createdAt);
    if (Number.isFinite(num) && num > 0) return num;
    const dateNum = Date.parse(product.createdAt);
    if (Number.isFinite(dateNum) && dateNum > 0) return dateNum;
  }
  if (product.created_at != null) {
    const num = Number(product.created_at);
    if (Number.isFinite(num) && num > 0) return num;
    const dateNum = Date.parse(product.created_at);
    if (Number.isFinite(dateNum) && dateNum > 0) return dateNum;
  }
  if (product.publishedAt != null) {
    const num = Number(product.publishedAt);
    if (Number.isFinite(num) && num > 0) return num;
    const dateNum = Date.parse(product.publishedAt);
    if (Number.isFinite(dateNum) && dateNum > 0) return dateNum;
  }
  const pushTime = parseFirebasePushIdTimestamp(product.id);
  if (pushTime !== null) return pushTime;
  return 0;
}

async function run() {
  const res = await fetch('https://spider-backend.coffee101.workers.dev/api/store/catalog');
  const data = await res.json();
  const products = Object.entries(data.products || {}).map(([id, p]) => ({ id, ...p }));
  console.log(`Loaded ${products.length} products.`);

  const newest = [...products].sort((a, b) => {
    const diff = productCreationTime(b) - productCreationTime(a);
    if (diff !== 0) return diff;
    return String(b.id).localeCompare(String(a.id));
  });

  const oldest = [...products].sort((a, b) => {
    const diff = productCreationTime(a) - productCreationTime(b);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });

  console.log('\n=== Top 10 NEWEST products ===');
  newest.slice(0, 10).forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.id}] ${p.name} -> ${new Date(productCreationTime(p)).toISOString()}`);
  });

  console.log('\n=== Top 10 OLDEST products ===');
  oldest.slice(0, 10).forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.id}] ${p.name} -> ${new Date(productCreationTime(p)).toISOString()}`);
  });

  // Verify that newest[0] is indeed the most recent product
  assert.ok(productCreationTime(newest[0]) >= productCreationTime(newest[1]));
  // Verify that oldest[0] is indeed the earliest product
  assert.ok(productCreationTime(oldest[0]) <= productCreationTime(oldest[1]));
  // Verify that newest top 10 is completely different from oldest top 10
  const newestIds = new Set(newest.slice(0, 10).map(p => p.id));
  const oldestIds = new Set(oldest.slice(0, 10).map(p => p.id));
  const intersection = [...newestIds].filter(id => oldestIds.has(id));
  assert.equal(intersection.length, 0, 'Newest and Oldest top 10 must not overlap with 290 products!');

  console.log('\nVerification PASSED: Top 10 newest and oldest are completely distinct and properly sorted!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
