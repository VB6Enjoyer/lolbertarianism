/** Thousands separators in the viewer's locale, e.g. 1234567 → "1,234,567" (or "1.234.567" in es-AR). */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

const BIG_UNITS = [
  [1e33, 'decillion'],
  [1e30, 'nonillion'],
  [1e27, 'octillion'],
  [1e24, 'septillion'],
  [1e21, 'sextillion'],
  [1e18, 'quintillion'],
  [1e15, 'quadrillion'],
  [1e12, 'trillion'],
  [1e9, 'billion'],
] as const;

/**
 * Money for idle games. Under a billion it's the locale format with at most two
 * decimals (and none from 100 up); bigger amounts get a name: "1.235 billion".
 */
export function formatMoney(n: number): string {
  for (const [size, name] of BIG_UNITS) {
    if (n >= size) {
      const scaled = (n / size).toLocaleString(undefined, { maximumFractionDigits: 3 });
      return `${scaled} ${name}`;
    }
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 0 : 2 });
}

/** Short form for big numbers: 1500 → "1.5k", 2500000 → "2.50M". Values under 1000 are shown as-is. */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
