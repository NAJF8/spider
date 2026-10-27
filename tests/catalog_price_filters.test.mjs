import assert from 'node:assert/strict';
import {
  parseOptionalPrice,
  priceInputIsInvalid,
  validateOptionalPriceRange
} from '../public/catalog-price-filters.mjs';

assert.equal(parseOptionalPrice(''), null);
assert.equal(parseOptionalPrice('   '), null);
assert.equal(parseOptionalPrice(null), null);
assert.equal(parseOptionalPrice('0'), 0);
assert.equal(parseOptionalPrice(0), 0);
assert.equal(parseOptionalPrice('500000'), 500000);
assert.equal(parseOptionalPrice('-1'), null);
assert.equal(parseOptionalPrice('abc'), null);
assert.equal(parseOptionalPrice('Infinity'), null);
assert.equal(priceInputIsInvalid(''), false);
assert.equal(priceInputIsInvalid('   '), false);
assert.equal(priceInputIsInvalid('0'), false);
assert.equal(priceInputIsInvalid('-1'), true);
assert.equal(priceInputIsInvalid('abc'), true);

assert.deepEqual(validateOptionalPriceRange('', ''), { valid: true, min: null, max: null, error: '' });
assert.deepEqual(validateOptionalPriceRange('0', ''), { valid: true, min: 0, max: null, error: '' });
assert.deepEqual(validateOptionalPriceRange('', '500000'), { valid: true, min: null, max: 500000, error: '' });
assert.deepEqual(validateOptionalPriceRange('100000', '500000'), { valid: true, min: 100000, max: 500000, error: '' });
assert.equal(validateOptionalPriceRange('500000', '100000').error, 'range');
assert.equal(validateOptionalPriceRange('abc', '').error, 'invalid');

console.log('PASS optional catalog price parsing and range validation');
