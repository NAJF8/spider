import assert from 'node:assert/strict';
import {
  normalizeNumericString,
  parseOptionalPrice,
  priceInputIsInvalid,
  validateOptionalPriceRange,
  safeFloatingAdd,
  safeFloatingMultiply,
  normalizeMeasurement
} from '../public/catalog-price-filters.mjs';

// 1. Basic parsing
assert.equal(parseOptionalPrice(''), null);
assert.equal(parseOptionalPrice('   '), null);
assert.equal(parseOptionalPrice(null), null);
assert.equal(parseOptionalPrice(undefined), null);
assert.equal(parseOptionalPrice('0'), 0);
assert.equal(parseOptionalPrice(0), 0);
assert.equal(parseOptionalPrice('500000'), 500000);
assert.equal(parseOptionalPrice('-1'), null);
assert.equal(parseOptionalPrice('abc'), null);
assert.equal(parseOptionalPrice('Infinity'), null);
assert.equal(parseOptionalPrice('NaN'), null);

// 2. Arabic digits and comma formatting
assert.equal(normalizeNumericString('١٠٠٠٠'), '10000');
assert.equal(normalizeNumericString('١٠,٠٠٠'), '10000');
assert.equal(normalizeNumericString('50,000'), '50000');
assert.equal(parseOptionalPrice('١٠٠٠٠'), 10000);
assert.equal(parseOptionalPrice('١٠,٠٠٠'), 10000);
assert.equal(parseOptionalPrice('50,000'), 50000);
assert.equal(parseOptionalPrice(' 25,000 '), 25000);
assert.equal(parseOptionalPrice('٠'), 0);

// 3. Invalid inputs
assert.equal(priceInputIsInvalid(''), false);
assert.equal(priceInputIsInvalid('   '), false);
assert.equal(priceInputIsInvalid('0'), false);
assert.equal(priceInputIsInvalid('١٠٠٠٠'), false);
assert.equal(priceInputIsInvalid('50,000'), false);
assert.equal(priceInputIsInvalid('-1'), true);
assert.equal(priceInputIsInvalid('-500'), true);
assert.equal(priceInputIsInvalid('abc'), true);
assert.equal(priceInputIsInvalid('100a'), true);

// 4. Range validation
assert.deepEqual(validateOptionalPriceRange('', ''), { valid: true, min: null, max: null, error: '', minInvalid: false, maxInvalid: false });
assert.deepEqual(validateOptionalPriceRange('0', ''), { valid: true, min: 0, max: null, error: '', minInvalid: false, maxInvalid: false });
assert.deepEqual(validateOptionalPriceRange('', '500000'), { valid: true, min: null, max: 500000, error: '', minInvalid: false, maxInvalid: false });
assert.deepEqual(validateOptionalPriceRange('10000', '50000'), { valid: true, min: 10000, max: 50000, error: '', minInvalid: false, maxInvalid: false });
assert.deepEqual(validateOptionalPriceRange('١٠,٠٠٠', '٥٠,٠٠٠'), { valid: true, min: 10000, max: 50000, error: '', minInvalid: false, maxInvalid: false });

// Range errors
const inverted = validateOptionalPriceRange('500000', '100000');
assert.equal(inverted.valid, false);
assert.equal(inverted.error, 'range');
assert.equal(inverted.min, 500000);
assert.equal(inverted.max, 100000);

// Field-level invalid diagnostics
const badMin = validateOptionalPriceRange('abc', '50000');
assert.equal(badMin.valid, false);
assert.equal(badMin.error, 'invalid');
assert.equal(badMin.minInvalid, true);
assert.equal(badMin.maxInvalid, false);

const badMax = validateOptionalPriceRange('10000', 'xyz');
assert.equal(badMax.valid, false);
assert.equal(badMax.error, 'invalid');
assert.equal(badMax.minInvalid, false);
assert.equal(badMax.maxInvalid, true);

// 5. Floating point precision
assert.equal(0.1 + 0.2 === 0.3, false); // Standard IEEE floating point quirk
assert.equal(safeFloatingAdd(0.1, 0.2), 0.3);
assert.equal(safeFloatingMultiply(19.99, 3), 59.97);

// 6. Unit & Dimension conversions
const mm10 = normalizeMeasurement('10 mm');
const cm1 = normalizeMeasurement('1 cm');
assert.equal(mm10.canonicalKey, cm1.canonicalKey);
assert.equal(mm10.baseValue, 10);
assert.equal(cm1.baseValue, 10);

const w650 = normalizeMeasurement('650 W');
const w650Ar = normalizeMeasurement('650 واط');
assert.equal(w650.canonicalKey, w650Ar.canonicalKey);

const kw1 = normalizeMeasurement('1 kW');
assert.equal(kw1.baseValue, 1000);
assert.equal(kw1.baseUnit, 'W');

const gb16 = normalizeMeasurement('16 GB');
const mb16384 = normalizeMeasurement('16384 MB');
assert.equal(gb16.baseValue, mb16384.baseValue);

console.log('✅ PASS: All optional catalog price parsing, range validation, precision and unit tests passed!');
