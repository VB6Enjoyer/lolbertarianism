// The daily challenge: one seeded road per day (the same for everyone that day)
// with a twist. Your best daily score is kept per date.

export type DailyModifierId = 'hyperinflation' | 'fog' | 'stalin' | 'rush-hour' | 'drought' | 'night' | 'free-market';

export interface DailyModifier {
  id: DailyModifierId;
  icon: string;
  name: string;
  description: string;
}

export const DAILY_MODIFIERS: readonly DailyModifier[] = [
  { id: 'hyperinflation', icon: '💸', name: 'Hyperinflation Day', description: 'Gold is worth next to nothing; commies pay double.' },
  { id: 'fog', icon: '🌫️', name: 'Fog of Regulation', description: "Thick fog: you can't see far ahead." },
  { id: 'stalin', icon: '🎖️', name: 'Stalin Day', description: 'Every commie on the road is Stalin. Every single one.' },
  { id: 'rush-hour', icon: '🚗', name: 'Rush Hour', description: 'Three times the traffic. Use the horn.' },
  { id: 'drought', icon: '🏜️', name: 'Fuel Drought', description: 'No jerry cans anywhere, but the tank lasts twice as long.' },
  { id: 'night', icon: '🌙', name: 'Night Drive', description: 'The sun never comes up today.' },
  { id: 'free-market', icon: '🎁', name: 'Free Market Day', description: 'Power-ups everywhere: three times as many.' },
];

export interface Daily {
  /** "2026-11-09": the key for the daily best. */
  key: string;
  /** Seeds the road, so everyone gets the same one that day. */
  seed: number;
  modifier: DailyModifier;
}

/** Today's challenge (local date). */
export function dailyFor(date: Date): Daily {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const seed = y * 10_000 + m * 100 + d;
  // Days since an epoch, so the twist cycles day by day rather than by date digits.
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return {
    key: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    seed,
    modifier: DAILY_MODIFIERS[((day % DAILY_MODIFIERS.length) + DAILY_MODIFIERS.length) % DAILY_MODIFIERS.length],
  };
}

/** A small, fast seeded random-number generator (mulberry32): numbers in [0, 1). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Cleans up saved daily bests: { "YYYY-MM-DD": score }, the 60 most recent days. */
export function normalizeDailyBests(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number(v) > 0)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 60);
  for (const [k, v] of entries) out[k] = Math.floor(Number(v));
  return out;
}
