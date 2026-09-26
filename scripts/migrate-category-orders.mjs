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
const backupPath = process.env.CATEGORY_BACKUP_PATH || path.resolve('firebase-backup-2026-09-27T00-00-00Z', 'categories-before-order-migration.json');

const url = `${databaseUrl.replace(/\/$/, '')}/categories.json${authToken ? `?auth=${encodeURIComponent(authToken)}` : ''}`;
const response = await fetch(url);
if (!response.ok) throw new Error(`CATEGORY_READ_FAILED_${response.status}`);
const raw = await response.json() || {};
const categories = Object.entries(raw).map(([id, value]) => ({ id, ...(value || {}) }));
const orderValue = (category) => {
  const value = Number(category.order);
  return Number.isInteger(value) && value >= 1 ? value : Number.POSITIVE_INFINITY;
};
const sorted = [...categories].sort((a, b) => orderValue(a) - orderValue(b) || String(a.id).localeCompare(String(b.id)));
const groups = new Map();
for (const category of categories) {
  const value = Number(category.order);
  if (!Number.isInteger(value) || value < 1) continue;
  if (!groups.has(value)) groups.set(value, []);
  groups.get(value).push(category.id);
}
const duplicateGroups = [...groups.entries()].filter(([, ids]) => ids.length > 1);

console.log(`Number of categories: ${categories.length}`);
console.log(`Duplicate order groups before migration: ${JSON.stringify(duplicateGroups)}`);
console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
if (backupOnly) {
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log(`Backup path: ${backupPath}`);
  console.log('Backup only: no database write performed.');
  process.exit(0);
}
if (!apply) {
  console.log(`Planned orders: ${JSON.stringify(sorted.map((category, index) => ({ id: category.id, order: index + 1 })))}`);
  console.log('No database write performed. Re-run with --apply after confirming the backup.');
  process.exit(0);
}

await fs.mkdir(path.dirname(backupPath), { recursive: true });
await fs.writeFile(backupPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
const updates = {};
sorted.forEach((category, index) => { updates[`categories/${category.id}/order`] = index + 1; });
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
const orders = Object.values(verified).map((category) => Number(category?.order));
const contiguous = orders.length === new Set(orders).size && [...orders].sort((a, b) => a - b).every((value, index) => value === index + 1);
if (!contiguous) throw new Error('CATEGORY_MIGRATION_VERIFY_FAILED');
console.log(`Backup path: ${backupPath}`);
console.log(`Migration result: ${categories.length} categories renumbered to 1..${categories.length}`);
console.log('Duplicate orders after migration: 0');
