/**
 * Pure ISBN helpers — normalization, checksum validation, and ISBN-10→13
 * conversion. No I/O. Book barcodes are EAN-13, which *are* ISBN-13s, so the
 * scanner validates with `isValidIsbn` before doing any lookup.
 */

/** Strip separators/whitespace and upper-case the check char (`x` → `X`). */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

/** Valid ISBN-10 (mod-11 checksum, last digit may be `X` = 10). */
export function isValidIsbn10(raw: string): boolean {
  const s = normalizeIsbn(raw);
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const value = s[i] === 'X' ? 10 : Number(s[i]);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

/** Valid ISBN-13 (mod-10 checksum with alternating 1/3 weights). */
export function isValidIsbn13(raw: string): boolean {
  const s = normalizeIsbn(raw);
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/** Valid ISBN of either length. */
export function isValidIsbn(raw: string): boolean {
  const s = normalizeIsbn(raw);
  if (s.length === 13) return isValidIsbn13(s);
  if (s.length === 10) return isValidIsbn10(s);
  return false;
}

/** Convert a valid ISBN-10 to its ISBN-13 (978 prefix), or null if invalid. */
export function isbn10To13(raw: string): string | null {
  const s = normalizeIsbn(raw);
  if (!isValidIsbn10(s)) return null;
  const core = `978${s.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}
