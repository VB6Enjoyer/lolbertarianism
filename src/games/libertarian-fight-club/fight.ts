// A fight is a debate: three rounds of arguments, each landing well or badly
// depending on its type and the other faction. It's simulated in one go and
// main.ts plays the result back.

import { effectiveness, factionById, type ArgType, type Lobster, type Move } from './lobsters.ts';

export const ROUNDS = 3;
export const EXCHANGES_PER_ROUND = 6;

/** A lobster as it enters the ring, after weigh-in traits. */
export interface Fighter {
  lobster: Lobster;
  claw: number;
  shell: number;
  stamina: number;
  wits: number;
}

export type Side = 0 | 1;

/** Traits that only show once they kick in during a fight. */
export type FightTrait = 'coward' | 'glass-shell' | 'comeback' | 'lazy' | 'debater';

export type FightEvent =
  | { type: 'weigh-in'; side: Side; trait: 'hungry' | 'molting' | 'pre-cooked' }
  | { type: 'round'; round: number }
  | { type: 'argue'; side: Side; move: Move; effect: number; crit: boolean; damage: number; hp: [number, number] }
  | { type: 'miss'; side: Side; move: Move }
  | { type: 'trait'; side: Side; trait: FightTrait }
  | { type: 'flee'; side: Side }
  | { type: 'ko'; side: Side }
  | { type: 'decision'; scores: [number, number] };

export type Ending = 'ko' | 'flee' | 'decision';

export interface FightResult {
  winner: Side;
  ending: Ending;
  events: FightEvent[];
  /** Damage each dealt (the judges' scorecard). */
  dealt: [number, number];
}

export function weighIn(l: Lobster): Fighter {
  const f = { lobster: l, claw: l.claw, shell: l.shell, stamina: l.stamina, wits: l.wits };
  if (l.trait === 'hungry') {
    f.claw += 2;
    f.stamina = Math.round(f.stamina * 0.85);
  } else if (l.trait === 'molting') f.shell = Math.max(0, f.shell - 3);
  else if (l.trait === 'pre-cooked') f.stamina = Math.round(f.stamina * 0.75);
  return f;
}

const MISS = 0.12;

/** How much of each matchup the bookmaker accounts for (0 = none, 1 = all). */
export const HOUSE_MATCHUP_SENSE = 0.5;

export function critChance(f: Fighter): number {
  return 0.04 + f.wits * 0.015 + (f.lobster.trait === 'debater' ? 0.08 : 0);
}

/**
 * Simulates a whole fight between two lobsters. `naive` is how the house sees
 * it: matchups count half, and nobody has a trait.
 */
export function simulate(a: Lobster, b: Lobster, rng: () => number = Math.random, naive = false): FightResult {
  if (naive) {
    a = { ...a, trait: 'none' };
    b = { ...b, trait: 'none' };
  }
  const fighters: [Fighter, Fighter] = [weighIn(a), weighIn(b)];
  const hp: [number, number] = [fighters[0].stamina, fighters[1].stamina];
  const dealt: [number, number] = [0, 0];
  const events: FightEvent[] = [];
  const revealed = new Set<string>();
  const reveal = (side: Side, trait: FightTrait) => {
    const key = `${side}${trait}`;
    if (revealed.has(key)) return;
    revealed.add(key);
    events.push({ type: 'trait', side, trait });
  };

  fighters.forEach((f, i) => {
    const t = f.lobster.trait;
    if (t === 'hungry' || t === 'molting' || t === 'pre-cooked') events.push({ type: 'weigh-in', side: i as Side, trait: t });
  });

  for (let round = 1; round <= ROUNDS; round++) {
    events.push({ type: 'round', round });
    for (let x = 0; x < EXCHANGES_PER_ROUND; x++) {
      // The sharper debater gets the floor more often.
      const lean = 0.5 + (fighters[0].wits - fighters[1].wits) * 0.03;
      const side: Side = rng() < lean ? 0 : 1;
      const other: Side = side === 0 ? 1 : 0;
      const me = fighters[side];
      const them = fighters[other];
      // A coward losing badly may run for it.
      if (me.lobster.trait === 'coward' && hp[side] < me.stamina * 0.25 && rng() < 0.35) {
        reveal(side, 'coward');
        events.push({ type: 'flee', side });
        return { winner: other, ending: 'flee', events, dealt };
      }
      if (me.lobster.trait === 'lazy' && rng() < 0.15) {
        reveal(side, 'lazy');
        continue;
      }
      const moves = factionById(me.lobster.faction).moves;
      const move = moves[Math.floor(rng() * moves.length)];
      if (rng() < MISS) {
        events.push({ type: 'miss', side, move });
        continue;
      }
      // The house only half-reads the matchup chart.
      const full = effectiveness(move.type, factionById(them.lobster.faction));
      const effect = naive ? 1 + (full - 1) * HOUSE_MATCHUP_SENSE : full;
      const crit = rng() < critChance(me);
      if (crit && me.lobster.trait === 'debater') reveal(side, 'debater');
      let damage = (4 + me.claw * 1.6) * move.power * effect * (1 - them.shell * 0.045) * (0.85 + rng() * 0.3);
      if (crit) {
        damage *= 1.75;
        if (them.lobster.trait === 'glass-shell') {
          damage *= 1.5;
          reveal(other, 'glass-shell');
        }
      }
      if (me.lobster.trait === 'comeback' && hp[side] < me.stamina * 0.3) {
        damage *= 1.4;
        reveal(side, 'comeback');
      }
      damage = Math.max(1, Math.round(damage));
      hp[other] = Math.max(0, hp[other] - damage);
      dealt[side] += damage;
      events.push({ type: 'argue', side, move, effect, crit, damage, hp: [hp[0], hp[1]] });
      if (hp[other] === 0) {
        events.push({ type: 'ko', side: other });
        return { winner: side, ending: 'ko', events, dealt };
      }
    }
  }
  // Still standing: the judges score who argued better (damage dealt).
  const winner: Side = dealt[0] === dealt[1] ? (hp[0] >= hp[1] ? 0 : 1) : dealt[0] > dealt[1] ? 0 : 1;
  events.push({ type: 'decision', scores: [dealt[0], dealt[1]] });
  return { winner, ending: 'decision', events, dealt };
}

/** Which sides' traits the fight showed (to mark them known on the lobsters' cards). */
export function revealedSides(result: FightResult): Side[] {
  const sides = new Set<Side>();
  for (const e of result.events) if (e.type === 'trait' || e.type === 'weigh-in' || e.type === 'flee') sides.add(e.side);
  return [...sides];
}

/**
 * The house's line. The bookmaker is a stats nerd who only skimmed the matchup
 * chart: it simulates the fight a few hundred times counting half of each
 * matchup and no traits (and it overrates the crowd's
 * favorites). Reading matchups better than it does, and spotting traits, is
 * your edge.
 */
export function houseOdds(a: Lobster, b: Lobster, margin = 0.08, sims = 300): [number, number] {
  // Its own fixed random numbers, so the same bout always gets the same line.
  let seed = (a.id * 7919 + b.id * 104729 + a.wins * 31 + b.wins * 17 + 1) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let wins = 0;
  for (let i = 0; i < sims; i++) if (simulate(a, b, rng, true).winner === 0) wins++;
  let pa = (wins + 1) / (sims + 2);
  if (a.trait === 'crowd-favorite') pa = Math.min(0.97, pa + 0.08);
  if (b.trait === 'crowd-favorite') pa = Math.max(0.03, pa - 0.08);
  // The margin goes on the implied chance (capped below certainty); odds round down, so they never favor you.
  const odds = (p: number) => Math.min(15, Math.max(1.01, Math.floor((1 / Math.min(0.99, p * (1 + margin))) * 100) / 100));
  return [odds(pa), odds(1 - pa)];
}

/** The argument types a lobster uses, for its card. */
export const argTypesOf = (l: Lobster): ArgType[] => [...new Set(factionById(l.faction).moves.map((m) => m.type))];

/** Picks tonight's next bout: two different lobsters, not the same pair as last time. */
export function pickBout(count: number, rng: () => number, last: [number, number] | null = null): [number, number] {
  for (let tries = 0; tries < 20; tries++) {
    const a = Math.floor(rng() * count);
    let b = Math.floor(rng() * (count - 1));
    if (b >= a) b++;
    if (!last || !((last[0] === a && last[1] === b) || (last[0] === b && last[1] === a))) return [a, b];
  }
  return [0, 1];
}
