// The high-score table: ten entries with three-letter initials, arcade style.
// It starts filled with famous libertarians to beat; your runs push them down.
// Saved in localStorage with the rest of the game's save (see main.ts).

export interface ScoreEntry {
  initials: string;
  score: number;
  /** Commies flattened that run. */
  commies: number;
  /** Meters driven. */
  meters: number;
  /** The default entries are the legends; yours are `false`. */
  legend?: boolean;
}

export const SCOREBOARD_SIZE = 10;

/** The legends you start out chasing (score, initials, who). */
export const LEGENDS: readonly [number, string, string][] = [
  [500_000, 'MNR', 'Murray N. Rothbard'],
  [400_000, 'LVM', 'Ludwig von Mises'],
  [330_000, 'HHH', 'Hans-Hermann Hoppe'],
  [270_000, 'FAH', 'F. A. Hayek'],
  [220_000, 'RON', 'Ron Paul'],
  [180_000, 'SEK', 'Samuel Edward Konkin III'],
  [140_000, 'FCB', 'Frédéric C. Bastiat'],
  [110_000, 'WEB', 'Walter E. Block'],
  [80_000, 'HSH', 'Henry S. Hazlitt'],
  [50_000, 'LYS', 'Lysander Spooner'],
];

/** Who's behind a legend's initials (for tooltips), if anyone. */
export const legendName = (initials: string) => LEGENDS.find(([, i]) => i === initials)?.[2] ?? null;

export function defaultScores(): ScoreEntry[] {
  return LEGENDS.map(([score, initials]) => ({ initials, score, commies: 0, meters: 0, legend: true }));
}

/** Three capital letters A to Z (anything else is dropped); "AAA" if nothing's left. */
export function cleanInitials(raw: string): string {
  const letters = raw
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
  return letters.length ? letters.padEnd(3, 'A') : 'AAA';
}

/** Whether a score makes the table (beats the lowest entry, or the table isn't full). */
export function qualifies(scores: readonly ScoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  return scores.length < SCOREBOARD_SIZE || score > scores[scores.length - 1].score;
}

/** Adds an entry in its place (ties go below older scores) and keeps the top ten. Returns its rank (0-based), or -1 if it didn't make it. */
export function insertScore(scores: readonly ScoreEntry[], entry: ScoreEntry): { scores: ScoreEntry[]; rank: number } {
  const next = [...scores];
  let rank = next.findIndex((e) => entry.score > e.score);
  if (rank === -1) rank = next.length;
  next.splice(rank, 0, entry);
  next.length = Math.min(next.length, SCOREBOARD_SIZE);
  return { scores: next, rank: rank < SCOREBOARD_SIZE ? rank : -1 };
}

/**
 * Cleans up a saved table: valid entries only, sorted, at most ten. The legends
 * are always re-added at their current scores (so raising them reaches old
 * saves too); your own entries are kept.
 */
export function normalizeScores(raw: unknown): ScoreEntry[] {
  if (!Array.isArray(raw)) return defaultScores();
  const entries = raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      initials: cleanInitials(String(e.initials ?? '')),
      score: Math.max(0, Math.floor(Number(e.score) || 0)),
      commies: Math.max(0, Math.floor(Number(e.commies) || 0)),
      meters: Math.max(0, Math.floor(Number(e.meters) || 0)),
      ...(e.legend === true ? { legend: true } : {}),
    }))
    .filter((e) => e.score > 0 && !e.legend);
  return [...entries, ...defaultScores()].sort((a, b) => b.score - a.score).slice(0, SCOREBOARD_SIZE);
}
