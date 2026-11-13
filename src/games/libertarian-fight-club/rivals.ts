// The regulars: Susan, Sheila and Larry keep score too. Tonight's table, and the season's.

import type { Side } from './fight.ts';
import type { PoolBet } from './pool.ts';

export type RivalId = 'susan' | 'sheila' | 'larry';
export const RIVALS: readonly RivalId[] = ['susan', 'sheila', 'larry'];
export type Player = RivalId | 'you';

export type Standings = Record<Player, number>;

export interface Rivals {
  tonight: Standings;
  season: Standings;
  /** Bouts on the season table. */
  bouts: number;
}

export const emptyStandings = (): Standings => ({ you: 0, susan: 0, sheila: 0, larry: 0 });
export const emptyRivals = (): Rivals => ({ tonight: emptyStandings(), season: emptyStandings(), bouts: 0 });

/**
 * How each regular did on a bout: their pool bets at the final odds. `winner` null means the
 * bout was called off, and they got back `refund` of their money.
 */
export function rivalResults(pool: readonly PoolBet[], odds: readonly [number, number], winner: Side | null, refund = 0): Record<RivalId, number> {
  const out: Record<RivalId, number> = { susan: 0, sheila: 0, larry: 0 };
  for (const b of pool) {
    if (!RIVALS.includes(b.who as RivalId)) continue;
    const who = b.who as RivalId;
    if (winner === null) out[who] -= Math.round(b.amount * (1 - refund));
    else out[who] += b.side === winner ? Math.floor(b.amount * odds[b.side]) - b.amount : -b.amount;
  }
  return out;
}

/** Adds a bout's results to both tables. */
export function addResults(r: Rivals, you: number, theirs: Record<RivalId, number>) {
  r.tonight.you += you;
  r.season.you += you;
  for (const id of RIVALS) {
    r.tonight[id] += theirs[id];
    r.season[id] += theirs[id];
  }
  r.bouts++;
}

/** The table, best first. */
export const ranking = (s: Standings): { id: Player; amount: number }[] =>
  (['you', ...RIVALS] as Player[]).map((id) => ({ id, amount: s[id] })).sort((a, b) => b.amount - a.amount);

/** Ahead of all three regulars (strictly). */
export const leading = (s: Standings) => RIVALS.every((id) => s.you > s[id]);

export const GLOATS: Record<RivalId, readonly string[]> = {
  susan: ['TOLD YOU! THE CHAMP!', 'EASIEST MONEY OF MY LIFE!', 'I KNEW IT! I KNEW IT!'],
  sheila: ['Contrarian position: cashed.', 'Called it, sweetie.', 'The market was wrong. I wasn’t.'],
  larry: ['lmao free money', 'lmao it worked', 'LMAO GET REKT'],
};
export const GRUMBLES: Record<RivalId, readonly string[]> = {
  susan: ['RIGGED! THIS IS RIGGED!', 'I WANT A RECOUNT!', 'THE REFEREE IS A STATIST!'],
  sheila: ['The market is irrational.', 'Still the right call.', 'Long-term, I’m right.'],
  larry: ['lmao rip', 'lmao i’m broke', 'worth it lmao'],
};

function standings(raw: unknown): Standings {
  const r = (raw ?? {}) as Partial<Standings>;
  const n = (x: unknown) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : 0);
  return { you: n(r.you), susan: n(r.susan), sheila: n(r.sheila), larry: n(r.larry) };
}

export function normalizeRivals(raw: unknown): Rivals {
  const r = (raw ?? {}) as Partial<Rivals>;
  return { tonight: standings(r.tonight), season: standings(r.season), bouts: Math.max(0, Math.floor(Number(r.bouts) || 0)) };
}
