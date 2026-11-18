// The fight's state and the rules every card, enemy and relic shares: damage, Composure (block),
// statuses, drawing cards. Plain data only, so a fight can be saved mid-turn.

import { int, type Rng, shuffleInPlace } from './rng.ts';

/**
 * Statuses, on Friedman or on an enemy:
 * - momentum: +1 damage per hit for each point.
 * - exposed: takes 50% more damage (turns).
 * - rattled: deals 25% less damage (turns).
 * - savings: Composure gained at the start of the next turn (then gone).
 * - Powers (Friedman's, for the rest of the fight): monetarism, flatTax, vouchers, primeTime.
 * - Enemy specials: spiral (gains that much momentum every turn), decay (loses that much HP every turn).
 */
export type Status = 'momentum' | 'exposed' | 'rattled' | 'savings' | 'monetarism' | 'flatTax' | 'vouchers' | 'primeTime' | 'spiral' | 'decay';

/** Statuses that count down at the end of their owner's turn. */
export const TIMED: readonly Status[] = ['exposed', 'rattled'];

export interface Fighter {
  hp: number;
  maxHp: number;
  block: number;
  status: Partial<Record<Status, number>>;
}

/** A card in the deck. `uid` tells copies apart. */
export interface Card {
  uid: number;
  id: string;
  up: boolean;
}

/** A card in a fight; `free` means it costs nothing this turn (Free to Choose). */
export interface FightCard extends Card {
  free?: boolean;
}

export interface Enemy extends Fighter {
  uid: number;
  id: string;
  /** The move it will make on its turn (shown as its intent). */
  move: string;
  /** Its turns taken, and anything its pattern needs to remember. */
  turn: number;
  memo: Record<string, number>;
  dead: boolean;
}

/** Something that happened, for the screen to show (a number flying off, a shake, a line). */
export type Fx =
  | { kind: 'damage'; target: 'player' | number; amount: number; blocked: number }
  | { kind: 'block'; target: 'player' | number; amount: number }
  | { kind: 'heal'; target: 'player' | number; amount: number }
  | { kind: 'status'; target: 'player' | number; status: Status; amount: number }
  | { kind: 'say'; target: 'player' | number; text: string }
  | { kind: 'laser' }
  | { kind: 'death'; target: number };

export type FightKind = 'fight' | 'elite' | 'boss';

export interface Combat {
  kind: FightKind;
  act: number;
  player: Fighter & { energy: number; maxEnergy: number };
  enemies: Enemy[];
  draw: FightCard[];
  hand: FightCard[];
  discard: FightCard[];
  exhausted: FightCard[];
  /** Principles in play (powers are used up when played, but shown here). */
  powers: FightCard[];
  turn: number;
  /** The Based meter, 0–100: fills with every point of Credibility you knock off. At 100, Laser Eyes. */
  based: number;
  relics: string[];
  rng: Rng;
  /** A choice to make before anything else (Free to Choose). */
  pending: null | { kind: 'choose'; options: Card[] };
  fx: Fx[];
  result: null | 'won' | 'lost';
  /** Cards that go into the deck for good when the fight ends (Regret, from Payroll Withholding). */
  gained: Card[];
  nextUid: number;
  /** Per-fight counters (cards played, the first Argument, damage dealt…). */
  flags: Record<string, number>;
}

export const HAND_LIMIT = 10;
export const BASED_MAX = 100;

export const alive = (c: Combat) => c.enemies.filter((e) => !e.dead);

/** Damage from an attacker's hit, with momentum, rattled and exposed. */
export function attackDamage(base: number, attacker: Fighter, defender: Fighter): number {
  let d = base + (attacker.status.momentum ?? 0);
  if (attacker.status.rattled) d *= 0.75;
  if (defender.status.exposed) d *= 1.5;
  return Math.max(0, Math.floor(d));
}

/** Damage that ignores the attacker (Flat Tax, Laser Eyes, Inflation): only Composure stops it. */
export function hit(c: Combat, target: Fighter, amount: number, who: 'player' | number): number {
  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  const lost = Math.min(target.hp, amount - blocked);
  target.hp -= lost;
  c.fx.push({ kind: 'damage', target: who, amount: lost, blocked });
  return lost;
}

export function gainBlock(c: Combat, target: Fighter, amount: number, who: 'player' | number) {
  if (amount <= 0) return;
  target.block += amount;
  c.fx.push({ kind: 'block', target: who, amount });
}

export function heal(c: Combat, target: Fighter, amount: number, who: 'player' | number) {
  const healed = Math.min(amount, target.maxHp - target.hp);
  if (healed <= 0) return;
  target.hp += healed;
  c.fx.push({ kind: 'heal', target: who, amount: healed });
}

export function addStatus(c: Combat, target: Fighter, status: Status, amount: number, who: 'player' | number) {
  if (!amount) return;
  target.status[status] = (target.status[status] ?? 0) + amount;
  if ((target.status[status] ?? 0) <= 0) delete target.status[status];
  c.fx.push({ kind: 'status', target: who, status, amount });
}

/** Draws cards, reshuffling the discard pile when the draw pile runs out. */
export function drawCards(c: Combat, n: number) {
  for (let i = 0; i < n; i++) {
    if (c.hand.length >= HAND_LIMIT) return;
    if (!c.draw.length) {
      if (!c.discard.length) return;
      c.draw = shuffleInPlace(c.rng, c.discard);
      c.discard = [];
    }
    c.hand.push(c.draw.pop()!);
  }
}

export function newCard(c: Combat, id: string, up = false): FightCard {
  return { uid: c.nextUid++, id, up };
}

/** Puts a new card somewhere: shuffled into the draw pile, on the discard pile, or in hand. */
export function addCard(c: Combat, id: string, where: 'draw' | 'discard' | 'hand', up = false) {
  const card = newCard(c, id, up);
  if (where === 'hand' && c.hand.length < HAND_LIMIT) c.hand.push(card);
  else if (where === 'draw') c.draw.splice(int(c.rng, 0, c.draw.length), 0, card);
  else c.discard.push(card);
}

/** Fills the Based meter by Credibility knocked off enemies. */
export function addBased(c: Combat, amount: number) {
  c.based = Math.min(BASED_MAX, c.based + amount * (c.relics.includes('tape') ? 1.5 : 1));
}

/**
 * Friedman hits an enemy (by index), `hits` times. Damage gets his momentum, their exposure, and the
 * fight's multiplier (the Toy Helicopter doubles the first Argument). Returns the Credibility knocked off.
 */
export function strike(c: Combat, i: number, base: number, hits = 1): number {
  let total = 0;
  for (let h = 0; h < hits; h++) {
    const e = c.enemies[i];
    if (!e || e.dead) break;
    const lost = hit(c, e, Math.floor(attackDamage(base, c.player, e) * (c.flags.mult ?? 1)), e.uid);
    total += lost;
    addBased(c, lost);
    c.flags.damage = (c.flags.damage ?? 0) + lost;
    if (e.hp <= 0) {
      e.dead = true;
      c.fx.push({ kind: 'death', target: e.uid });
    }
  }
  return total;
}

/** Friedman hits every enemy still standing. */
export function strikeAll(c: Combat, base: number) {
  c.enemies.forEach((e, i) => {
    if (!e.dead) strike(c, i, base);
  });
}

/** Damage that skips momentum and exposure (Flat Tax, Laser Eyes, School Vouchers). */
export function zap(c: Combat, i: number, amount: number) {
  const e = c.enemies[i];
  if (!e || e.dead) return;
  const lost = hit(c, e, amount, e.uid);
  addBased(c, lost);
  c.flags.damage = (c.flags.damage ?? 0) + lost;
  if (e.hp <= 0) {
    e.dead = true;
    c.fx.push({ kind: 'death', target: e.uid });
  }
}

/** An enemy hits Friedman. */
export function enemyStrike(c: Combat, e: Enemy, base: number, hits = 1) {
  for (let h = 0; h < hits && c.player.hp > 0; h++) hit(c, c.player, attackDamage(base, e, c.player), 'player');
}
