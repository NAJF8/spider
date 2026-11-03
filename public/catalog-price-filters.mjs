/**
 * Normalizes numeric string by converting Eastern Arabic / Persian numerals
 * to standard digits, stripping formatting commas and whitespace.
 */
export function normalizeNumericString(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/[,،\s]/g, '')
    .trim();
}

/**
 * Parse an optional price only when the user provided a valid non-negative value.
 * Empty or whitespace-only inputs evaluate to null (meaning unconstrained).
 * Malformed, negative, or NaN values evaluate to null.
 */
export function parseOptionalPrice(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const clean = normalizeNumericString(value);
  if (clean === '') return null;
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;

  const parsed = Number(clean);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Returns true only if the user entered content that is not a valid non-negative price.
 */
export function priceInputIsInvalid(value) {
  if (value === null || value === undefined) return false;
  const clean = normalizeNumericString(value);
  if (clean === '') return false;
  return parseOptionalPrice(clean) === null;
}

/**
 * Validate an optional price range with individual field diagnostics.
 */
export function validateOptionalPriceRange(minValue, maxValue) {
  const minInvalid = priceInputIsInvalid(minValue);
  const maxInvalid = priceInputIsInvalid(maxValue);

  if (minInvalid || maxInvalid) {
    return {
      valid: false,
      min: null,
      max: null,
      error: 'invalid',
      minInvalid,
      maxInvalid
    };
  }

  const min = parseOptionalPrice(minValue);
  const max = parseOptionalPrice(maxValue);

  if (min !== null && max !== null && min > max) {
    return {
      valid: false,
      min,
      max,
      error: 'range',
      minInvalid: false,
      maxInvalid: false
    };
  }

  return {
    valid: true,
    min,
    max,
    error: '',
    minInvalid: false,
    maxInvalid: false
  };
}

/**
 * Safe floating point addition avoiding IEEE-754 precision artifacts.
 */
export function safeFloatingAdd(a, b) {
  const numA = Number(a) || 0;
  const numB = Number(b) || 0;
  return Math.round((numA + numB + Number.EPSILON) * 100) / 100;
}

/**
 * Safe floating point multiplication avoiding IEEE-754 precision artifacts.
 */
export function safeFloatingMultiply(a, b) {
  const numA = Number(a) || 0;
  const numB = Number(b) || 0;
  return Math.round((numA * numB + Number.EPSILON) * 100) / 100;
}

/**
 * Canonical unit scales (converting to standard base units):
 * - Length -> mm (1 cm = 10 mm, 1 m = 1000 mm, 1 inch = 25.4 mm)
 * - Power -> W (1 kW = 1000 W)
 * - Weight -> g (1 kg = 1000 g)
 * - Voltage -> V (1 kV = 1000 V)
 * - Current -> A (1 A = 1000 mA)
 * - Frequency -> MHz (1 GHz = 1000 MHz)
 * - Storage -> MB (1 GB = 1024 MB, 1 TB = 1048576 MB)
 */
export const UNIT_DEFINITIONS = Object.freeze({
  // Length
  mm:    { type: 'length', baseUnit: 'mm', factor: 1, canonicalDisplay: 'mm' },
  cm:    { type: 'length', baseUnit: 'mm', factor: 10, canonicalDisplay: 'mm' },
  m:     { type: 'length', baseUnit: 'mm', factor: 1000, canonicalDisplay: 'mm' },
  inch:  { type: 'length', baseUnit: 'mm', factor: 25.4, canonicalDisplay: 'mm' },
  in:    { type: 'length', baseUnit: 'mm', factor: 25.4, canonicalDisplay: 'mm' },
  '"':   { type: 'length', baseUnit: 'mm', factor: 25.4, canonicalDisplay: 'mm' },
  // Power
  w:     { type: 'power', baseUnit: 'W', factor: 1, canonicalDisplay: 'W' },
  watt:  { type: 'power', baseUnit: 'W', factor: 1, canonicalDisplay: 'W' },
  kw:    { type: 'power', baseUnit: 'W', factor: 1000, canonicalDisplay: 'W' },
  واط:   { type: 'power', baseUnit: 'W', factor: 1, canonicalDisplay: 'W' },
  // Weight
  g:     { type: 'weight', baseUnit: 'g', factor: 1, canonicalDisplay: 'g' },
  kg:    { type: 'weight', baseUnit: 'g', factor: 1000, canonicalDisplay: 'g' },
  كغم:   { type: 'weight', baseUnit: 'g', factor: 1000, canonicalDisplay: 'g' },
  // Voltage
  v:     { type: 'voltage', baseUnit: 'V', factor: 1, canonicalDisplay: 'V' },
  volt:  { type: 'voltage', baseUnit: 'V', factor: 1, canonicalDisplay: 'V' },
  kv:    { type: 'voltage', baseUnit: 'V', factor: 1000, canonicalDisplay: 'V' },
  فولت:  { type: 'voltage', baseUnit: 'V', factor: 1, canonicalDisplay: 'V' },
  // Current
  a:     { type: 'current', baseUnit: 'A', factor: 1, canonicalDisplay: 'A' },
  amp:   { type: 'current', baseUnit: 'A', factor: 1, canonicalDisplay: 'A' },
  ma:    { type: 'current', baseUnit: 'A', factor: 0.001, canonicalDisplay: 'A' },
  أمبير: { type: 'current', baseUnit: 'A', factor: 1, canonicalDisplay: 'A' },
  امبير: { type: 'current', baseUnit: 'A', factor: 1, canonicalDisplay: 'A' },
  // Frequency
  mhz:   { type: 'frequency', baseUnit: 'MHz', factor: 1, canonicalDisplay: 'MHz' },
  ghz:   { type: 'frequency', baseUnit: 'MHz', factor: 1000, canonicalDisplay: 'MHz' },
  // Memory
  mb:    { type: 'storage', baseUnit: 'MB', factor: 1, canonicalDisplay: 'MB' },
  gb:    { type: 'storage', baseUnit: 'MB', factor: 1024, canonicalDisplay: 'MB' },
  tb:    { type: 'storage', baseUnit: 'MB', factor: 1048576, canonicalDisplay: 'MB' }
});

/**
 * Normalizes dimension and measurement expressions into a standardized canonical value.
 * Example: '10 mm', '10mm', '10 MM', '1 cm' -> normalized representation with type, baseValue, and canonicalKey.
 */
export function normalizeMeasurement(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Match: optional numeric part followed by unit
  const match = str.match(/^([\d.,٠-٩۰-۹]+)\s*([a-zA-Z"واطفولتكغمأمبيرامبير]+)$/);
  if (!match) return { raw: str, canonicalKey: str.toLowerCase() };

  const numStr = normalizeNumericString(match[1]);
  const unitStr = match[2].toLowerCase();

  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) return { raw: str, canonicalKey: str.toLowerCase() };

  const def = UNIT_DEFINITIONS[unitStr];
  if (!def) return { raw: str, canonicalKey: str.toLowerCase() };

  const baseValue = Math.round((num * def.factor + Number.EPSILON) * 1000) / 1000;
  return {
    raw: str,
    type: def.type,
    baseValue,
    baseUnit: def.baseUnit,
    canonicalKey: `${baseValue}${def.baseUnit.toLowerCase()}`,
    display: `${baseValue} ${def.baseUnit}`
  };
}
