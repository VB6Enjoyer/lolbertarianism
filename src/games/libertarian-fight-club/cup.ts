// The Invisible Claw Cup: every fourth night, eight lobsters, a knockout bracket
// and seven bouts. Besides each bout, you can bet futures on who wins it all.

export const CUP_EVERY = 4;
export const CUP_SIZE = 8;
export const CUP_BOUTS = 7;
export const isCupNight = (night: number) => night > 0 && night % CUP_EVERY === 0;

export const ROUND_NAMES = ['quarter-final', 'quarter-final', 'quarter-final', 'quarter-final', 'semi-final', 'semi-final', 'final'] as const;

/** A futures bet: on a lobster to win the cup, at the odds when you placed it. */
export interface Future {
  id: number;
  stake: number;
  odds: number;
  /** Placed before the first bout of the cup. */
  early: boolean;
}

export interface Cup {
  /** The bracket: roster ids in order (0 meets 1, 2 meets 3, and so on). */
  seeds: number[];
  /** Who won each of the seven matches (quarter-finals 0–3, semis 4–5, the final 6). */
  winners: (number | null)[];
  futures: Future[];
}

export function newCup(rosterSize: number, rng: () => number): Cup {
  const ids = Array.from({ length: rosterSize }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { seeds: ids.slice(0, CUP_SIZE), winners: Array(CUP_BOUTS).fill(null), futures: [] };
}

/** The two lobsters in a match, once both are known. */
export function matchOf(cup: Cup, i: number): [number, number] | null {
  const pair = (a: number | null, b: number | null): [number, number] | null => (a === null || b === null ? null : [a, b]);
  if (i < 4) return [cup.seeds[i * 2], cup.seeds[i * 2 + 1]];
  if (i === 4) return pair(cup.winners[0], cup.winners[1]);
  if (i === 5) return pair(cup.winners[2], cup.winners[3]);
  return pair(cup.winners[4], cup.winners[5]);
}

/** The next match to fight (null once the final is done). */
export function nextMatch(cup: Cup): number | null {
  for (let i = 0; i < CUP_BOUTS; i++) if (cup.winners[i] === null && matchOf(cup, i)) return i;
  return null;
}

export const champion = (cup: Cup) => cup.winners[CUP_BOUTS - 1];
export const started = (cup: Cup) => cup.winners.some((w) => w !== null);

/** The lobsters still in it. */
export function alive(cup: Cup): number[] {
  const out = new Set(cup.seeds);
  for (let i = 0; i < CUP_BOUTS; i++) {
    const m = matchOf(cup, i);
    const w = cup.winners[i];
    if (m && w !== null) out.delete(m[0] === w ? m[1] : m[0]);
  }
  return cup.seeds.filter((id) => out.has(id));
}

/**
 * Each lobster's chance of winning the cup, worked out exactly through the bracket
 * from `chance(a, b)`: a's chance of beating b.
 */
export function cupChances(cup: Cup, chance: (a: number, b: number) => number): Map<number, number> {
  const memo = new Map<number, Map<number, number>>();
  const dist = (i: number): Map<number, number> => {
    const cached = memo.get(i);
    if (cached) return cached;
    let out: Map<number, number>;
    const w = cup.winners[i];
    if (w !== null) out = new Map([[w, 1]]);
    else {
      const sides: Map<number, number>[] = i < 4 ? [new Map([[cup.seeds[i * 2], 1]]), new Map([[cup.seeds[i * 2 + 1], 1]])] : i === 4 ? [dist(0), dist(1)] : i === 5 ? [dist(2), dist(3)] : [dist(4), dist(5)];
      out = new Map();
      const [x, y] = sides;
      for (const [a, pa] of x) {
        for (const [b, pb] of y) {
          const p = chance(a, b);
          out.set(a, (out.get(a) ?? 0) + pa * pb * p);
          out.set(b, (out.get(b) ?? 0) + pa * pb * (1 - p));
        }
      }
    }
    memo.set(i, out);
    return out;
  };
  return dist(CUP_BOUTS - 1);
}

/** The house's futures odds: a fat margin (it's a long way off), capped. */
export const FUTURES_MARGIN = 0.15;
export const MAX_FUTURE_ODDS = 50;
export function futuresOdds(p: number): number {
  if (p <= 0) return MAX_FUTURE_ODDS;
  return Math.min(MAX_FUTURE_ODDS, Math.max(1.01, Math.floor((1 / Math.min(0.99, p * (1 + FUTURES_MARGIN))) * 100) / 100));
}

export function normalizeCup(raw: unknown, rosterSize: number): Cup | null {
  const r = raw as Partial<Cup> | null;
  if (!r || !Array.isArray(r.seeds) || !Array.isArray(r.winners)) return null;
  const seeds = r.seeds.filter((x) => Number.isInteger(x) && x >= 0 && x < rosterSize);
  if (seeds.length !== CUP_SIZE || new Set(seeds).size !== CUP_SIZE) return null;
  const cup: Cup = { seeds, winners: Array(CUP_BOUTS).fill(null), futures: [] };
  // Winners only count if they were in that match.
  for (let i = 0; i < CUP_BOUTS; i++) {
    const m = matchOf(cup, i);
    const w = r.winners[i];
    if (m && (w === m[0] || w === m[1])) cup.winners[i] = w;
  }
  cup.futures = (Array.isArray(r.futures) ? r.futures : [])
    .filter((f) => !!f && seeds.includes(f.id) && Number(f.stake) > 0 && Number(f.odds) >= 1)
    .map((f) => ({ id: f.id, stake: Math.floor(f.stake), odds: Math.min(MAX_FUTURE_ODDS, Number(f.odds)), early: f.early === true }));
  return cup;
}
