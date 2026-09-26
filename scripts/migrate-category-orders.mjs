#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const databaseUrl = process.env.FIREBASE_DATABASE_URL || 'https://spider-aaa19-default-rtdb.asia-southeast1.firebasedatabase.app';
const authToken = process.env.FIREBASE_DATABASE_AUTH || '';
const execFileAsync = promisify(execFile);
const apply = process.argv.includes('--apply');
const backupOnly = process.argv.includes('--backup-only');
const seedPcParts = process.argv.includes('--seed-pc-parts');
const backupPath = process.env.CATEGORY_BACKUP_PATH || path.resolve('firebase-backup-2026-09-27T00-00-00Z', 'categories-before-order-migration.json');

const url = `${databaseUrl.replace(/\/$/, '')}/categories.json${authToken ? `?auth=${encodeURIComponent(authToken)}` : ''}`;
const response = await fetch(url);
if (!response.ok) throw new Error(`CATEGORY_READ_FAILED_${response.status}`);
const raw = await response.json() || {};
const categories = Object.entries(raw).map(([id, value]) => ({ id, ...(value || {}) }));
const parentIdOf = (category) => Object.prototype.hasOwnProperty.call(category, 'parentId')
  ? (category.parentId || null)
  : (category.parentCategory || category.parent || null);
const byId = new Map(categories.map((category) => [category.id, category]));
const conflicts = [];
const orphanChildIds = [];
const parentLinks = new Map();
categories.forEach((parent) => {
  (parent.subcategoryIds || []).forEach((childId) => {
    if (!byId.has(childId)) { orphanChildIds.push(childId); return; }
    const existing = parentIdOf(byId.get(childId));
    if (existing && existing !== parent.id) conflicts.push({ childId, existingParentId: existing, legacyParentId: parent.id });
    if (!existing) parentLinks.set(childId, parent.id);
  });
});
if (seedPcParts && byId.has('cat-pc-parts')) {
  ['cat-ram', 'cat-storage'].forEach((childId) => {
    if (byId.has(childId)) parentLinks.set(childId, 'cat-pc-parts');
  });
}
const planned = categories.map((category) => ({ ...category, parentId: seedPcParts && parentLinks.has(category.id) ? parentLinks.get(category.id) : (parentIdOf(category) || parentLinks.get(category.id) || null) }));
const plannedById = new Map(planned.map((category) => [category.id, category]));
const cycleLinks = planned.filter((category) => {
  const seen = new Set([category.id]);
  let current = category.parentId;
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = plannedById.get(current)?.parentId || null;
  }
  return false;
}).map((category) => category.id);
const orderValue = (category) => {
  const value = Number(category.order);
  return Number.isInteger(value) && value >= 1 ? value : Number.POSITIVE_INFINITY;
};
const sorted = [...planned].sort((a, b) => orderValue(a) - orderValue(b) || String(a.id).localeCompare(String(b.id)));
const duplicateOrderGroups = new Map();
for (const category of categories) {
  const value = Number(category.order);
  if (!Number.isInteger(value) || value < 1) continue;
  if (!duplicateOrderGroups.has(value)) duplicateOrderGroups.set(value, []);
  duplicateOrderGroups.get(value).push(category.id);
}
const duplicateGroups = [...duplicateOrderGroups.entries()].filter(([, ids]) => ids.length > 1);

console.log(`Number of categories: ${categories.length}`);
console.log(`Duplicate order groups before migration: ${JSON.stringify(duplicateGroups)}`);
console.log(`Legacy parent links detected: ${JSON.stringify([...parentLinks.entries()])}`);
console.log(`Orphan child IDs: ${JSON.stringify([...new Set(orphanChildIds)])}`);
console.log(`Conflicting relationships: ${JSON.stringify(conflicts)}`);
console.log(`Circular relationships: ${JSON.stringify(cycleLinks)}`);
console.log(`PC parts seed requested: ${seedPcParts ? 'YES' : 'NO'}`);
console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
if (backupOnly) {
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log(`Backup path: ${backupPath}`);
  console.log('Backup only: no database write performed.');
  process.exit(0);
}
if (!apply) {
  console.log(`Planned parentId values: ${JSON.stringify(planned.map((category) => ({ id: category.id, parentId: category.parentId })))}`);
  console.log(`Planned orders: ${JSON.stringify(sorted.map((category, index) => ({ id: category.id, order: index + 1 })))}`);
  console.log('No database write performed. Re-run with --apply after confirming the backup.');
  process.exit(0);
}
if (conflicts.length || cycleLinks.length) {
  throw new Error('CATEGORY_MIGRATION_BLOCKED_BY_CONFLICT_OR_CYCLE');
}

await fs.mkdir(path.dirname(backupPath), { recursive: true });
await fs.writeFile(backupPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
const updates = {};
const groups = new Map();
planned.forEach((category) => {
  const key = category.parentId || '';
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(category);
});
groups.forEach((group) => {
  group.sort((a, b) => orderValue(a) - orderValue(b) || String(a.id).localeCompare(String(b.id)));
  group.forEach((category, index) => {
    updates[`categories/${category.id}/order`] = index + 1;
    updates[`categories/${category.id}/parentId`] = category.parentId;
  });
});
if (authToken) {
  const writeResponse = await fetch(`${databaseUrl.replace(/\/$/, '')}/.json?auth=${encodeURIComponent(authToken)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!writeResponse.ok) throw new Error(`CATEGORY_MIGRATION_WRITE_FAILED_${writeResponse.status}`);
} else {
  const updateFile = path.resolve('.category-order-updates.json');
  await fs.writeFile(updateFile, `${JSON.stringify(updates)}\n`, 'utf8');
  try {
    await execFileAsync(process.platform === 'win32' ? 'firebase.cmd' : 'firebase', ['database:update', '/', updateFile, '--project', 'spider-aaa19', '--force'], { maxBuffer: 1024 * 1024, shell: process.platform === 'win32' });
  } finally {
    await fs.rm(updateFile, { force: true });
  }
}
const verifyResponse = await fetch(url);
if (!verifyResponse.ok) throw new Error(`CATEGORY_VERIFY_FAILED_${verifyResponse.status}`);
const verified = await verifyResponse.json() || {};
const verifiedCategories = Object.entries(verified || {}).map(([id, value]) => ({ id, ...(value || {}) }));
const verifiedGroups = new Map();
verifiedCategories.forEach((category) => {
  const key = category.parentId || '';
  if (!verifiedGroups.has(key)) verifiedGroups.set(key, []);
  verifiedGroups.get(key).push(Number(category.order));
});
for (const orders of verifiedGroups.values()) {
  const contiguous = orders.length === new Set(orders).size && [...orders].sort((a, b) => a - b).every((value, index) => value === index + 1);
  if (!contiguous) throw new Error('CATEGORY_MIGRATION_VERIFY_FAILED');
}
console.log(`Backup path: ${backupPath}`);
console.log(`Migration result: ${categories.length} categories assigned parentId and sibling-scoped order`);
console.log(`Duplicate/conflicting relationships: ${conflicts.length}`);
console.log(`Orphan child IDs: ${[...new Set(orphanChildIds)].length}`);
