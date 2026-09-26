const assert = require('node:assert/strict');

function orderValue(category) {
    const value = Number(category.order);
    return Number.isInteger(value) && value >= 1 ? value : Number.POSITIVE_INFINITY;
}
function sortCategories(items) {
    return [...items].sort((a, b) => orderValue(a) - orderValue(b) || String(a.id).localeCompare(String(b.id)));
}
function clamp(value, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return max;
    return Math.min(max, Math.max(1, Math.trunc(parsed)));
}
function reorder(items, movingId, position) {
    const ordered = sortCategories(items);
    const index = ordered.findIndex((category) => category.id === movingId);
    const [moving] = ordered.splice(index, 1);
    ordered.splice(clamp(position, ordered.length + 1) - 1, 0, moving);
    return ordered.map((category, i) => ({ ...category, order: i + 1 }));
}
const base = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, order: i + 1 }));
assert.deepEqual(reorder(base, 'e', 1).map((c) => c.id), ['e', 'a', 'b', 'c', 'd']);
assert.deepEqual(reorder(base, 'b', 4).map((c) => c.id), ['a', 'c', 'd', 'b', 'e']);
assert.deepEqual(reorder([{ id: 'b', order: 1 }, { id: 'a', order: 1 }, { id: 'c' }], 'c', 0).map((c) => c.order), [1, 2, 3]);
assert.deepEqual(reorder(base, 'a', 999).map((c) => c.id), ['b', 'c', 'd', 'e', 'a']);
const deleted = sortCategories(base).filter((c) => c.id !== 'b').map((c, i) => ({ ...c, order: i + 1 }));
assert.deepEqual(deleted.map((c) => c.order), [1, 2, 3, 4]);
assert.equal(new Set(deleted.map((c) => c.order)).size, deleted.length);
console.log('PASS category ordering move/clamp/delete scenarios');
