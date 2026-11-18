// A fight, turn by turn: Friedman draws, plays cards with his Airtime, maybe fires the laser eyes,
// then the other side does what its intents said. Everything here works on plain data (see
// state.ts), so the screen just calls these and redraws.

import { cardCost, cardDef, cardExhausts, POOL } from './cards.ts';
import { enemyDef, type Move } from './enemies.ts';
import type { TwistId } from './daily.ts';
import { int, type Rng, shuffleInPlace } from './rng.ts';
import {
  addCard, addStatus, alive, attackDamage, BASED_MAX, type Card, type Combat, drawCards, type Enemy, type FightCard, type FightKind,
  gainBlock, hit, TIMED, zap,
} from './state.ts';

export const HAND_SIZE = 5;
export const ENERGY = 3;
export const LASER_DAMAGE = 20;

export interface FightSetup {
  act: number;
  kind: FightKind;
  enemies: string[];
  deck: Card[];
  hp: number;
  maxHp: number;
  relics: string[];
  based: number;
  rng: Rng;
  nextUid: number;
  twist?: TwistId | null;
}

export function startCombat(s: FightSetup): Combat {
  const c: Combat = {
    kind: s.kind,
    act: s.act,
    player: { hp: s.hp, maxHp: s.maxHp, block: 0, status: {}, energy: 0, maxEnergy: ENERGY },
    enemies: [],
    draw: shuffleInPlace(s.rng, s.deck.map((card) => ({ ...card }))),
    hand: [],
    discard: [],
    exhausted: [],
    powers: [],
    turn: 0,
    based: s.based,
    relics: [...s.relics],
    rng: s.rng,
    pending: null,
    fx: [],
    result: null,
    gained: [],
    nextUid: s.nextUid,
    flags: {},
    twist: s.twist ?? null,
  };
  c.enemies = s.enemies.map((id, i): Enemy => {
    const def = enemyDef(id);
    const hp = Math.round(int(s.rng, def.hp[0], def.hp[1]) * (s.twist === 'prime-time' ? 1.2 : 1));
    return { uid: 1000 + i, id, hp, maxHp: hp, block: 0, status: {}, move: '', turn: 0, memo: {}, dead: false };
  });
  if (c.relics.includes('pipe')) gainBlock(c, c.player, 6, 'player');
  if (c.relics.includes('chalk')) addStatus(c, c.player, 'momentum', 1, 'player');
  if (c.relics.includes('press')) {
    addCard(c, 'inflation', 'draw');
    addCard(c, 'inflation', 'draw');
  }
  if (c.relics.includes('surgery')) c.based = Math.max(c.based, BASED_MAX / 2);
  // The daily run's twist.
  if (c.twist === 'stagflation' || c.twist === 'helicopter') addCard(c, 'inflation', 'draw');
  if (c.twist === 'stagflation') for (const e of c.enemies) addStatus(c, e, 'exposed', 2, e.uid);
  if (c.twist === 'prime-time') c.player.status.primeTime = 1;
  for (const e of c.enemies) {
    const def = enemyDef(e.id);
    def.start?.(c, e);
    e.move = def.first ?? def.next(e, c.rng, c);
  }
  c.fx.push({ kind: 'say', target: c.enemies[0].uid, text: enemyDef(c.enemies[0].id).intro });
  startTurn(c);
  return c;
}

function startTurn(c: Combat) {
  c.turn++;
  const p = c.player;
  p.block = 0;
  if (p.status.savings) {
    gainBlock(c, p, p.status.savings, 'player');
    delete p.status.savings;
  }
  p.energy = p.maxEnergy + (c.relics.includes('press') ? 1 : 0);
  c.flags.turnCards = 0;
  if (p.status.monetarism) addStatus(c, p, 'momentum', p.status.monetarism, 'player');
  const extra = (c.turn === 1 && c.relics.includes('glasses') ? 2 : 0) + (p.status.primeTime ?? 0) + (c.relics.includes('vhs') ? 1 : 0);
  drawCards(c, HAND_SIZE + extra);
}

/** What a card in hand costs right now (null: can't be played). */
export function costOf(card: FightCard): number | null {
  const cost = cardCost(card.id, card.up);
  return cost === null ? null : card.free ? 0 : cost;
}

export const canAct = (c: Combat) => !c.result && !c.pending;

export function canPlay(c: Combat, i: number): boolean {
  const card = c.hand[i];
  if (!card || !canAct(c)) return false;
  const cost = costOf(card);
  return cost !== null && cost <= c.player.energy;
}

/** Plays the card at hand index `i` at an enemy (by index; the first one standing if not given). */
export function playCard(c: Combat, i: number, target?: number): boolean {
  if (!canPlay(c, i)) return false;
  const card = c.hand[i];
  const def = cardDef(card.id);
  let t = target ?? -1;
  if (!c.enemies[t] || c.enemies[t].dead) t = c.enemies.findIndex((e) => !e.dead);
  c.player.energy -= costOf(card)!;
  c.hand.splice(i, 1);
  c.flags.cards = (c.flags.cards ?? 0) + 1;
  c.flags.turnCards = (c.flags.turnCards ?? 0) + 1;
  c.flags.maxTurnCards = Math.max(c.flags.maxTurnCards ?? 0, c.flags.turnCards);
  const dealtBefore = c.flags.damage ?? 0;
  if (def.type === 'argument' && c.relics.includes('helicopter') && !c.flags.firstArgument) {
    c.flags.firstArgument = 1;
    c.flags.mult = 2;
  }
  def.play?.(c, t, card.up);
  c.flags.mult = 1;
  // The biggest single card of the fight (for the achievements).
  c.flags.bigHit = Math.max(c.flags.bigHit ?? 0, (c.flags.damage ?? 0) - dealtBefore);
  if (card.id === 'withholding') c.flags.withheld = 1;
  if (card.id === 'choose') c.flags.chose = 1;
  if (def.type === 'rebuttal' && c.player.status.vouchers) {
    const standing = c.enemies.map((e, k) => (e.dead ? -1 : k)).filter((k) => k >= 0);
    if (standing.length) zap(c, standing[int(c.rng, 0, standing.length - 1)], c.player.status.vouchers);
  }
  delete card.free;
  if (def.type === 'principle') c.powers.push(card);
  else if (cardExhausts(card.id, card.up)) c.exhausted.push(card);
  else c.discard.push(card);
  // Free to Choose: three different cards to pick from.
  if (c.pending?.kind === 'choose' && !c.pending.options.length) {
    const ids = shuffleInPlace(c.rng, POOL.map((d) => d.id).filter((id) => id !== 'choose')).slice(0, 3);
    c.pending.options = ids.map((id) => ({ uid: c.nextUid++, id, up: false }));
  }
  settle(c);
  if (c.result === 'won' && card.id === 'donahue') c.flags.donahueKill = 1;
  c.flags.principles = c.powers.length;
  return true;
}

/** Takes one of Free to Choose's cards into hand, free this turn. */
export function resolveChoice(c: Combat, i: number) {
  const option = c.pending?.options[i];
  if (!option) return;
  c.pending = null;
  if (c.hand.length < 10) c.hand.push({ ...option, free: true });
  else c.discard.push(option);
}

export const laserReady = (c: Combat) => canAct(c) && c.based >= BASED_MAX;

/** LASER EYES: damage to every enemy, burns the Inflation out of your hand, empties the meter. */
export function fireLaser(c: Combat): boolean {
  if (!laserReady(c)) return false;
  c.fx.push({ kind: 'laser' });
  const damage = LASER_DAMAGE * (c.relics.includes('surgery') ? 2 : 1);
  c.enemies.forEach((e, i) => {
    if (!e.dead) zap(c, i, damage);
  });
  const burnt = c.hand.filter((x) => x.id === 'inflation');
  c.hand = c.hand.filter((x) => x.id !== 'inflation');
  c.exhausted.push(...burnt);
  c.based = 0;
  c.flags.lasers = (c.flags.lasers ?? 0) + 1;
  settle(c);
  return true;
}

/** Ends Friedman's turn: hand effects, Flat Tax, then each enemy's move, then a new turn. */
export function endTurn(c: Combat) {
  if (!canAct(c)) return;
  const p = c.player;
  for (const card of c.hand) cardDef(card.id).endOfTurn?.(c);
  if (p.status.flatTax) c.enemies.forEach((e, i) => !e.dead && zap(c, i, p.status.flatTax!));
  settle(c);
  if (c.result) return;
  for (const card of c.hand) delete card.free;
  c.discard.push(...c.hand);
  c.hand = [];
  tick(p);

  for (const e of c.enemies) {
    if (e.dead) continue;
    e.block = 0;
    const def = enemyDef(e.id);
    c.fx.push({ kind: 'act', target: e.uid, text: def.moves[e.move].name });
    def.moves[e.move].act(c, e);
    e.turn++;
    if (p.hp <= 0) break;
    if (e.status.decay) hit(c, e, e.status.decay, e.uid);
    if (e.hp <= 0) {
      e.dead = true;
      c.fx.push({ kind: 'death', target: e.uid });
    }
    if (e.status.spiral) addStatus(c, e, 'momentum', e.status.spiral, e.uid);
    tick(e);
  }
  settle(c);
  if (c.result) return;
  for (const e of c.enemies) if (!e.dead) e.move = enemyDef(e.id).next(e, c.rng, c);
  startTurn(c);
}

/** Counts down the timed statuses (Exposed, Rattled). */
function tick(f: { status: Partial<Record<string, number>> }) {
  for (const s of TIMED) {
    if (!f.status[s]) continue;
    f.status[s]!--;
    if (!f.status[s]) delete f.status[s];
  }
}

/** Deaths (and comebacks), then whether the fight is over. */
function settle(c: Combat) {
  for (const e of c.enemies) {
    if (!e.dead || e.memo.gone) continue;
    const def = enemyDef(e.id);
    if (def.onDeath?.(c, e)) {
      c.flags.revived = 1;
      e.move = def.next(e, c.rng, c);
      continue;
    }
    e.memo.gone = 1;
  }
  if (c.player.hp <= 0) c.result = 'lost';
  else if (!alive(c).length) c.result = 'won';
}

/** An enemy's intent, as the screen shows it: the move, and the damage it would do now. */
export function intentOf(c: Combat, e: Enemy): { move: Move; damage?: string } {
  const move = enemyDef(e.id).moves[e.move];
  if (move.range) {
    const [lo, hi] = move.range.map((d) => attackDamage(d, e, c.player));
    return { move, damage: `${lo}–${hi}` };
  }
  if (move.damage === undefined) return { move };
  const per = attackDamage(move.damageFor?.(e) ?? move.damage, e, c.player);
  return { move, damage: move.hits && move.hits > 1 ? `${per}×${move.hits}` : String(per) };
}
