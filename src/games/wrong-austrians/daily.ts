// The daily term: one seed and one twist a day, the same for everyone (always as Ancapball), with
// its own best score.

export type TwistId = 'loose-lips' | 'poker-face' | 'snap-election' | 'press-pass' | 'double-check' | 'lean-times';

export interface Twist {
  id: TwistId;
  icon: string;
  name: string;
  description: string;
}

export const TWISTS: readonly Twist[] = [
  { id: 'loose-lips', icon: '🗣️', name: 'Loose Lips', description: 'The impostors slip in interviews far more often.' },
  { id: 'poker-face', icon: '😐', name: 'Poker Face', description: 'The impostors never slip in interviews. They dodge instead.' },
  { id: 'snap-election', icon: '🗳️', name: 'Snap Election', description: 'The term is only 6 quarters. Less time for the bills to land, less time to find anyone.' },
  { id: 'press-pass', icon: '📰', name: 'Press Pass', description: '3 questions a quarter instead of 2.' },
  { id: 'double-check', icon: '🔍', name: 'Double Check', description: 'Two background checks this term instead of one.' },
  { id: 'lean-times', icon: '📉', name: 'Lean Times', description: 'Both meters start at 40 instead of 50.' },
];

export const twistById = (id: string | null | undefined) => TWISTS.find((t) => t.id === id);

export interface Daily {
  /** "2026-11-19": the key for the daily best. */
  key: string;
  seed: number;
  twist: Twist;
}

export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today's term: the seed from the date, the twist cycling day by day. */
export function dailyFor(date: Date): Daily {
  const key = dateKey(date);
  const seed = (date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate()) ^ 0x5bd1e995;
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
