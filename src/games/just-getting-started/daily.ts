// The daily run: one seed and one twist a day, the same for everyone, with its own best score.

export type TwistId = 'stagflation' | 'gold-standard' | 'helicopter' | 'prime-time' | 'bull-market';

export interface Twist {
  id: TwistId;
  icon: string;
  name: string;
  description: string;
}

export const TWISTS: readonly Twist[] = [
  { id: 'stagflation', icon: '📉', name: 'Stagflation Day', description: 'Every enemy starts each fight Exposed. You start each fight with an Inflation in your draw pile.' },
  { id: 'gold-standard', icon: '🪙', name: 'Gold Standard Day', description: 'No Inflation, ever. Royalties are halved.' },
  { id: 'helicopter', icon: '🚁', name: 'Helicopter Day', description: 'Start with two Helicopter Money and 100 extra Royalties. Every fight starts with an Inflation in your draw pile.' },
  { id: 'prime-time', icon: '📺', name: 'Prime Time Day', description: 'Draw a card more every turn. Enemies have 20% more Credibility.' },
  { id: 'bull-market', icon: '🐂', name: 'Bull Market Day', description: 'The Based meter fills twice as fast. Enemies hit 25% harder.' },
];

export const twistById = (id: string) => TWISTS.find((t) => t.id === id);

export interface Daily {
  /** "2026-11-18": the key for the daily best. */
  key: string;
  seed: number;
  twist: Twist;
}

export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today's run: the seed from the date, the twist cycling day by day. */
export function dailyFor(date: Date): Daily {
  const key = dateKey(date);
  const seed = (date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate()) ^ 0x9e3779b9;
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return { key, seed: seed >>> 0, twist: TWISTS[((day % TWISTS.length) + TWISTS.length) % TWISTS.length] };
}

/** Keeps the last couple of months of daily bests from a save. */
export function normalizeDailyBests(raw: unknown): Record<string, number> {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(r)
      .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(Number(v)))
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 60)
      .map(([k, v]) => [k, Math.max(0, Math.floor(Number(v)))]),
  );
}
