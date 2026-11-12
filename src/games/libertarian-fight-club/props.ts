// Side bets on how a fight goes (props), at the house's fixed odds, and
// parlays across tonight's card. The house prices props with the full matchup
// chart but knows nothing about traits, so a coward in the ring is your secret.

import { simulate, type FightResult, type Side } from './fight.ts';
import { TRAITS, type Lobster, type TraitId } from './lobsters.ts';
import { liveOdds } from './pool.ts';

export type PropId = 'ko' | 'decision' | 'ko-r1' | 'ko-r2' | 'ko-r3' | 'flee' | 'crits3' | 'strawmen4' | 'super5';

export const PROPS: readonly { id: PropId; icon: string; name: string }[] = [
  { id: 'ko', icon: '💥', name: 'Ends by KO' },
  { id: 'decision', icon: '📋', name: 'Goes to the judges' },
  { id: 'ko-r1', icon: '1️⃣', name: 'KO in round 1' },
  { id: 'ko-r2', icon: '2️⃣', name: 'KO in round 2' },
  { id: 'ko-r3', icon: '3️⃣', name: 'KO in round 3' },
  { id: 'flee', icon: '🏃', name: 'A lobster flees the ring' },
  { id: 'crits3', icon: '⚡', name: '3+ critical hits' },
  { id: 'strawmen4', icon: '🌾', name: '4+ strawmen' },
  { id: 'super5', icon: '🎯', name: '5+ super-effective arguments' },
];

export const propById = (id: PropId) => PROPS.find((p) => p.id === id)!;

/** Which props a fight landed. */
export function propOutcomes(r: FightResult): Record<PropId, boolean> {
  let round = 0;
  let crits = 0;
  let misses = 0;
  let supers = 0;
  for (const e of r.events) {
    if (e.type === 'round') round = e.round;
    else if (e.type === 'argue') {
      if (e.crit) crits++;
      if (e.effect > 1) supers++;
    } else if (e.type === 'miss') misses++;
  }
  const ko = r.ending === 'ko';
  return {
    ko,
    decision: r.ending === 'decision',
    'ko-r1': ko && round === 1,
    'ko-r2': ko && round === 2,
    'ko-r3': ko && round === 3,
    flee: r.ending === 'flee',
    crits3: crits >= 3,
    strawmen4: misses >= 4,
    super5: supers >= 5,
  };
}

/**
 * The house's idea of each prop's chance: full matchups, and the traits it
 * knows (the ones revealed in public). For the rest it assumes the league's
 * usual mix, since it can't know which lobster has which.
 */
export function propChances(a: Lobster, b: Lobster, sims = 300): Record<PropId, number> {
  let seed = (a.id * 1009 + b.id * 7919 + a.losses * 13 + b.losses * 29 + 7) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const counts = Object.fromEntries(PROPS.map((p) => [p.id, 0])) as Record<PropId, number>;
  const traits = TRAITS.map((t) => t.id);
  // A third have nothing special, like the league itself.
  const guess = (l: Lobster): Lobster => (l.traitKnown ? l : { ...l, trait: (rng() < 0.33 ? 'none' : traits[1 + Math.floor(rng() * (traits.length - 1))]) as TraitId });
  for (let i = 0; i < sims; i++) {
    const out = propOutcomes(simulate(guess(a), guess(b), rng));
    for (const p of PROPS) if (out[p.id]) counts[p.id]++;
  }
  // A little smoothing, so nothing is ever priced as impossible or certain.
  return Object.fromEntries(PROPS.map((p) => [p.id, (counts[p.id] + 1) / (sims + 2)])) as Record<PropId, number>;
}

/** The longest odds the house offers on a prop (long shots are where it gets burned). */
export const MAX_PROP_ODDS = 8;

export const propOdds = (chances: Record<PropId, number>): Record<PropId, number> =>
  Object.fromEntries(PROPS.map((p) => [p.id, Math.min(MAX_PROP_ODDS, liveOdds(chances[p.id]))])) as Record<PropId, number>;

// ---------------------------------------------------------------------------
// Parlays
// ---------------------------------------------------------------------------

export interface ParlayLeg {
  ids: [number, number];
  side: Side;
  odds: number;
  /** Null until that bout is fought. */
  won: boolean | null;
}

export interface Parlay {
  legs: ParlayLeg[];
  stake: number;
}

/** The longest odds for one leg, and for a whole parlay (so three long shots don't print money). */
export const MAX_LEG_ODDS = 10;
export const MAX_PARLAY_ODDS = 250;

/** A parlay pays the stake times every leg's odds (up to the cap), if every leg wins. */
export const parlayOdds = (legs: readonly { odds: number }[]) => Math.min(MAX_PARLAY_ODDS, Math.floor(legs.reduce((x, l) => x * Math.min(MAX_LEG_ODDS, l.odds), 1) * 100) / 100);

/** Settles the leg for this bout (if there is one). Returns 'won' when the whole parlay comes in, 'lost' when a leg loses. */
export function settleLeg(parlay: Parlay, ids: readonly [number, number], winnerId: number): 'won' | 'lost' | 'pending' | 'none' {
  const leg = parlay.legs.find((l) => l.won === null && l.ids[0] === ids[0] && l.ids[1] === ids[1]);
  if (!leg) return 'none';
  leg.won = leg.ids[leg.side] === winnerId;
  if (!leg.won) return 'lost';
  return parlay.legs.every((l) => l.won) ? 'won' : 'pending';
}

export function normalizeParlay(raw: unknown): Parlay | null {
  const r = raw as Parlay | null;
  if (!r || !Array.isArray(r.legs) || !r.legs.length || !(Number(r.stake) > 0)) return null;
  return {
    stake: Math.floor(Number(r.stake)),
    legs: r.legs.map((l) => ({ ids: [Number(l.ids?.[0]) || 0, Number(l.ids?.[1]) || 0], side: l.side === 1 ? 1 : 0, odds: Math.max(1.01, Number(l.odds) || 1.01), won: l.won === true ? true : l.won === false ? false : null })),
  };
}
