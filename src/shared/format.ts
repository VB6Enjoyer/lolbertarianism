/** Thousands separators in the viewer's locale, e.g. 1234567 → "1,234,567" (or "1.234.567" in es-AR). */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Short form for big numbers: 1500 → "1.5k", 2500000 → "2.50M". Values under 1000 are shown as-is. */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
