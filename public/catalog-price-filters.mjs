/**
 * Parse a price only when the customer actually supplied one.
 *
 * `Number('')` is zero, which is not what an empty price filter means. Keep
 * this deliberately small and dependency-free so the catalog can use exactly
 * the same rules for UI input and URL parameters.
 */
export function parseOptionalPrice(value) {
  const text = String(value ?? '').trim();
  if (text === '') return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function priceInputIsInvalid(value) {
  const text = String(value ?? '').trim();
  return text !== '' && parseOptionalPrice(text) === null;
}

export function validateOptionalPriceRange(minValue, maxValue) {
  if (priceInputIsInvalid(minValue) || priceInputIsInvalid(maxValue)) {
    return { valid: false, min: null, max: null, error: 'invalid' };
  }

  const min = parseOptionalPrice(minValue);
  const max = parseOptionalPrice(maxValue);
  if (min !== null && max !== null && min > max) {
    return { valid: false, min, max, error: 'range' };
  }

  return { valid: true, min, max, error: '' };
}
