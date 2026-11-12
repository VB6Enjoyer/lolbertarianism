// The betting pool. Everyone's money goes in the pot, the house takes its cut,
// and the winners split the rest in proportion to what they put in. The odds
// are whatever the crowd makes them, and the crowd has opinions.

import type { Lobster } from './lobsters.ts';
import type { Side } from './fight.ts';

/** The house's cut of every pot (and of cash-outs and live bets). */
export const TAKEOUT = 0.1;

export type BettorId = 'susan' | 'sheila' | 'larry' | 'public';

export interface Bettor {
  id: BettorId;
  name: string;
  face: string;
  /** How they pick a side, for the help text. */
  style: string;
  /** What they yell when they bet. */
  lines: readonly string[];
}

export const BETTORS: readonly Bettor[] = [
  { id: 'susan', name: 'Screaming Susan', face: '😱', style: 'Bets big on whoever’s popular: the better record, hot form, crowd favorites.', lines: ['THAT ONE! THE WINNER!', 'EVERYONE KNOWS HE’S THE BEST!', 'I SAW HIM ON TWITTER!'] },
  { id: 'sheila', name: 'Squatting Sheila', face: '😏', style: 'Backs the underdog on principle. The market is wrong, she says.', lines: ['The underdog. Obviously.', 'Contrarian position, sweetie.', 'Nobody believes in him. I do.'] },
  { id: 'larry', name: 'LMAO Larry', face: '🤪', style: 'Bets on whatever’s funniest. Loves a meme.', lines: ['other libertarians lmao', 'this one has a funny name lmao', 'YOLO lmao'] },
  { id: 'public', name: 'The rest of the crowd', face: '👥', style: 'Follows the stats, more or less.', lines: [''] },
];

export const bettorById = (id: BettorId) => BETTORS.find((b) => b.id === id)!;

export interface PoolBet {
  who: BettorId | 'you';
  side: Side;
  amount: number;
  /** Placed after you (it moves the final odds). */
  late?: boolean;
}

/** How popular a lobster is: its record, its last few fights, and its fans. */
export function popularity(l: Lobster): number {
  const record = (l.wins + 1) / (l.wins + l.losses + 2);
  const form = l.form.reduce((s, r) => s + (r === 'W' ? 1 : -1), 0);
  return record * 2 + form * 0.25 + (l.trait === 'crowd-favorite' ? 1.2 : 0);
}

const roundTo = (n: number, step = 10) => Math.max(step, Math.round(n / step) * step);

/**
 * The crowd's money for a bout, before you bet: the public split by its
 * estimate (`publicP`, A's chance), then Susan, Sheila and Larry.
 */
export function crowdBets(a: Lobster, b: Lobster, publicP: number, rng: () => number, scale = 1): PoolBet[] {
  const bets: PoolBet[] = [];
  const publicMoney = (600 + rng() * 600) * scale;
  // The public leans toward its estimate, a little noisily.
  const lean = Math.min(0.95, Math.max(0.05, publicP + (rng() - 0.5) * 0.1));
  bets.push({ who: 'public', side: 0, amount: roundTo(publicMoney * lean) });
  bets.push({ who: 'public', side: 1, amount: roundTo(publicMoney * (1 - lean)) });
  const popular: Side = popularity(a) >= popularity(b) ? 0 : 1;
  bets.push({ who: 'susan', side: popular, amount: roundTo((150 + rng() * 250) * scale) });
  bets.push({ who: 'sheila', side: popular === 0 ? 1 : 0, amount: roundTo((60 + rng() * 140) * scale) });
  const memeLover = (l: Lobster) => (l.faction === 'mises-caucus' || l.faction === 'objectivist' || l.faction === 'chicago' ? 0.25 : 0);
  const larrySide: Side = rng() < 0.5 + memeLover(a) - memeLover(b) ? 0 : 1;
  bets.push({ who: 'larry', side: larrySide, amount: roundTo((20 + rng() * 130) * scale) });
  return bets;
}

/** Sometimes somebody throws in a last-second bet after you. */
export function lateBet(rng: () => number, scale = 1): PoolBet | null {
  if (rng() > 0.5) return null;
  const who = (['susan', 'sheila', 'larry'] as const)[Math.floor(rng() * 3)];
  return { who, side: rng() < 0.5 ? 0 : 1, amount: roundTo((30 + rng() * 120) * scale), late: true };
}

/** Each side's total. */
export function totals(bets: readonly PoolBet[]): [number, number] {
  const t: [number, number] = [0, 0];
  for (const b of bets) t[b.side] += b.amount;
  return t;
}

/** The pool's odds on each side: the pot after the cut, over that side's money. */
export function poolOdds(t: readonly [number, number]): [number, number] {
  const pot = (t[0] + t[1]) * (1 - TAKEOUT);
  const odds = (side: number) => (t[side] > 0 ? Math.floor((pot / t[side]) * 100) / 100 : 99);
  return [odds(0), odds(1)];
}

/** What a stake on a side would pay if it wins, counting that the stake itself moves the odds. */
export function projectedPayout(t: readonly [number, number], side: Side, stake: number): number {
  if (stake <= 0) return 0;
  const after: [number, number] = [t[0], t[1]];
  after[side] += stake;
  return stake * poolOdds(after)[side];
}

/** Fixed odds for a live bet, from the market's chance and the house's cut. */
export function liveOdds(p: number): number {
  return Math.min(25, Math.max(1.01, Math.floor((1 / Math.min(0.99, p * (1 + TAKEOUT))) * 100) / 100));
}

/** What the house will pay you now for a bet that would pay `payout` if it wins. */
export function cashOutValue(payout: number, p: number): number {
  return Math.floor(payout * p * (1 - TAKEOUT));
}
