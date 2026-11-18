// A run: three acts, each a branching map of talk-show bookings that ends in a boss. Between
// fights: rewards, the shop, the green room (rest or rehearse) and TV appearances (events).
// Plain data again, so the whole run saves and loads as JSON.

import { canUpgrade, POOL, type Rarity, STARTER_DECK } from './cards.ts';
import { startCombat } from './combat.ts';
import type { TwistId } from './daily.ts';
import { clampStage, stageMultiplier } from './stages.ts';
import { pickEncounter, ENCOUNTERS } from './enemies.ts';
import { type Effect, EVENTS, eventById } from './events.ts';
import { BOSS_RELICS, COMMON_RELICS } from './relics.ts';
import { int, makeRng, next, pickOne, type Rng, shuffleInPlace, weighted } from './rng.ts';
import type { Card, Combat, FightKind } from './state.ts';

export const ACTS = 3;
/** Rows of bookings in an act, before the boss. */
export const ROWS = 7;
export const LANES = 3;
export const START_HP = 70;
export const START_ROYALTIES = 99;

export type NodeType = 'fight' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';

export interface MapNode {
  row: number;
  col: number;
  type: NodeType;
  /** The columns it leads to in the next row. */
  next: number[];
}

export type Screen = 'map' | 'combat' | 'reward' | 'shop' | 'rest' | 'event' | 'act-clear' | 'lost' | 'won';

export interface Reward {
  kind: FightKind;
  royalties: number;
  cards: Card[];
  cardTaken: boolean;
  relic: string | null;
  relicTaken: boolean;
  /** After a boss: pick one of these. */
  bossRelics: string[];
}

export interface Shop {
  cards: { card: Card; price: number; sold: boolean }[];
  relics: { id: string; price: number; sold: boolean }[];
  removed: boolean;
}

export interface RunStats {
  floors: number;
  fights: number;
  elites: number;
  bosses: number;
  damage: number;
  lasers: number;
  cardsPlayed: number;
}

export interface Run {
  seed: number;
  rng: Rng;
  act: number;
  hp: number;
  maxHp: number;
  royalties: number;
  deck: Card[];
  relics: string[];
  based: number;
  map: MapNode[][];
  /** Where Friedman is on the map (null: at the start of the act), and where he's been this act ("row:col"). */
  pos: { row: number; col: number } | null;
  visited: string[];
  screen: Screen;
  combat: Combat | null;
  reward: Reward | null;
  shop: Shop | null;
  event: { id: string; result: string | null } | null;
  removeCost: number;
  nextUid: number;
  seenEvents: string[];
  fightsThisAct: number;
  stats: RunStats;
  /** A daily run: its date and twist (null for a normal run). */
  daily: { key: string; twist: TwistId } | null;
  /** The Late Stage it's played on (1 to 10). */
  stage: number;
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

export function generateMap(rng: Rng): MapNode[][] {
  const map: MapNode[][] = [];
  for (let row = 0; row < ROWS; row++) {
    map.push(
      Array.from({ length: LANES }, (_, col): MapNode => {
        let type: NodeType;
        if (row === 0) type = 'fight';
        else if (row === ROWS - 1) type = 'rest';
        else {
          const options: [NodeType, number][] = [['fight', 46], ['event', 24]];
          if (row >= 2) options.push(['elite', 12], ['shop', 9]);
          if (row >= 2 && row <= ROWS - 3) options.push(['rest', 8]);
          type = weighted(rng, options);
        }
        return { row, col, type, next: [] };
      }),
    );
  }
  // Paths: always straight up, sometimes to a neighbouring lane too, never crossing another path.
  for (let row = 0; row < ROWS - 1; row++) {
    for (const node of map[row]) {
      node.next.push(node.col);
      const left = map[row][node.col - 1];
      if (left && !left.next.includes(node.col) && next(rng) < 0.35) node.next.push(node.col - 1);
      if (node.col < LANES - 1 && next(rng) < 0.35) node.next.push(node.col + 1);
    }
  }
  for (const node of map[ROWS - 1]) node.next = [1];
  map.push([{ row: ROWS, col: 1, type: 'boss', next: [] }]);
  return map;
}

export const nodeAt = (run: Run, row: number, col: number) => run.map[row]?.find((n) => n.col === col);

/** The bookings you can take next. */
export function reachable(run: Run): MapNode[] {
  if (!run.pos) return run.map[0];
  const here = nodeAt(run, run.pos.row, run.pos.col);
  return (here?.next ?? []).map((col) => nodeAt(run, run.pos!.row + 1, col)!).filter(Boolean);
}

// ---------------------------------------------------------------------------
// A new run
// ---------------------------------------------------------------------------

export function newRun(seed: number, daily: { key: string; twist: TwistId } | null = null, stage = 1): Run {
  stage = daily ? 1 : clampStage(stage);
  const hp = stage >= 7 ? START_HP - 10 : START_HP;
  const rng = makeRng(seed);
  const run: Run = {
    seed,
    rng,
    act: 1,
    hp,
    maxHp: hp,
    royalties: START_ROYALTIES,
    deck: [],
    relics: ['glasses'],
    based: 0,
    map: [],
    pos: null,
    visited: [],
    screen: 'map',
    combat: null,
    reward: null,
    shop: null,
    event: null,
    removeCost: 75,
    nextUid: 1,
    seenEvents: [],
    fightsThisAct: 0,
    stats: { floors: 0, fights: 0, elites: 0, bosses: 0, damage: 0, lasers: 0, cardsPlayed: 0 },
    daily,
    stage,
  };
  run.deck = STARTER_DECK.map((id) => newCard(run, id));
  if (stage >= 3) run.deck.push(newCard(run, 'regret'));
  if (daily?.twist === 'helicopter') {
    run.deck.push(newCard(run, 'helicopter'), newCard(run, 'helicopter'));
    run.royalties += 100;
  }
  run.map = generateMap(rng);
  return run;
}

export const newCard = (run: Run, id: string, up = false): Card => ({ uid: run.nextUid++, id, up });

/** A run's score (for the daily best and the share card): floors climbed, elites and bosses beaten, and a bonus for winning. */
export const runScore = (run: Run) =>
  Math.round((run.stats.floors * 10 + run.stats.elites * 25 + run.stats.bosses * 100 + (run.screen === 'won' ? 500 : 0)) * stageMultiplier(run.stage ?? 1));

// ---------------------------------------------------------------------------
// Moving on the map
// ---------------------------------------------------------------------------

export function enterNode(run: Run, row: number, col: number): boolean {
  if (run.screen !== 'map' || !reachable(run).some((n) => n.row === row && n.col === col)) return false;
  const node = nodeAt(run, row, col)!;
  run.pos = { row, col };
  run.visited.push(`${row}:${col}`);
  run.stats.floors++;
  switch (node.type) {
    case 'fight':
      startFight(run, 'fight', pickEncounter(run.rng, run.act, run.fightsThisAct < 2 ? 'easy' : 'normal'));
      break;
    case 'elite':
      startFight(run, 'elite', pickEncounter(run.rng, run.act, 'elite'));
      break;
    case 'boss':
      startFight(run, 'boss', ENCOUNTERS[run.act].boss);
      break;
    case 'event': {
      const fresh = EVENTS.filter((e) => !run.seenEvents.includes(e.id));
      const event = pickOne(run.rng, fresh.length ? fresh : EVENTS);
      run.seenEvents.push(event.id);
      run.event = { id: event.id, result: null };
      run.screen = 'event';
      break;
    }
    case 'shop':
      run.shop = makeShop(run);
      run.screen = 'shop';
      break;
    case 'rest':
      run.screen = 'rest';
      break;
  }
  return true;
}

function startFight(run: Run, kind: FightKind, enemies: string[]) {
  run.combat = startCombat({
    act: run.act,
    kind,
    enemies,
    deck: run.deck,
    hp: run.hp,
    maxHp: run.maxHp,
    relics: run.relics,
    based: run.based,
    // The fight gets its own copy of the dice, handed back when it's over.
    rng: { s: run.rng.s },
    nextUid: run.nextUid,
    twist: run.daily?.twist ?? null,
    stage: run.stage,
  });
  run.screen = 'combat';
}

/** After a fight ends (won or lost): the reward, or the end of the run. */
export function finishCombat(run: Run) {
  const c = run.combat;
  if (!c?.result) return;
  run.rng.s = c.rng.s;
  run.nextUid = c.nextUid;
  run.stats.damage += c.flags.damage ?? 0;
  run.stats.lasers += c.flags.lasers ?? 0;
  run.stats.cardsPlayed += c.flags.cards ?? 0;
  if (c.result === 'lost') {
    run.hp = 0;
    run.screen = 'lost';
    return;
  }
  run.hp = c.player.hp;
  run.based = c.based;
  run.deck.push(...c.gained);
  run.combat = null;
  run.fightsThisAct++;
  run.stats.fights++;
  if (c.kind === 'elite') run.stats.elites++;
  if (c.kind === 'boss') run.stats.bosses++;
  if (run.relics.includes('freelunch')) run.hp = Math.min(run.maxHp, run.hp + 6);

  const base = c.kind === 'boss' ? int(run.rng, 70, 90) : c.kind === 'elite' ? int(run.rng, 28, 38) : int(run.rng, 12, 20);
  const royalties = Math.round((base + (run.relics.includes('newsweek') ? 15 : 0)) * (run.daily?.twist === 'gold-standard' ? 0.5 : 1) * (run.stage >= 9 ? 0.7 : 1));
  run.royalties += royalties;
  if (c.kind === 'boss' && run.act === ACTS) {
    run.screen = 'won';
    return;
  }
  const relics = shuffleInPlace(run.rng, COMMON_RELICS.filter((id) => !run.relics.includes(id)));
  run.reward = {
    kind: c.kind,
    royalties,
    cards: rollCards(run, 3, c.kind),
    cardTaken: false,
    relic: c.kind === 'elite' ? (relics[0] ?? null) : null,
    relicTaken: false,
    bossRelics: c.kind === 'boss' ? BOSS_RELICS.filter((id) => !run.relics.includes(id)) : [],
  };
  run.screen = 'reward';
}

/** Cards to choose from: rarer after elites and bosses, never the same card twice. */
export function rollCards(run: Run, n: number, kind: FightKind, exclude: readonly string[] = []): Card[] {
  const weights: [Rarity, number][] =
    kind === 'boss' ? [['rare', 1]] : kind === 'elite' ? [['common', 45], ['uncommon', 40], ['rare', 15]] : [['common', 62], ['uncommon', 30], ['rare', 8]];
  const picked: string[] = [];
  const taken = (id: string) => picked.includes(id) || exclude.includes(id);
  for (let i = 0; i < n; i++) {
    const rarity = weighted(run.rng, weights);
    const options = POOL.filter((d) => d.rarity === rarity && !taken(d.id));
    const fallback = POOL.filter((d) => !taken(d.id));
    picked.push(pickOne(run.rng, options.length ? options : fallback).id);
  }
  // Later acts sometimes hand out upgraded cards.
  return picked.map((id) => newCard(run, id, run.act >= 2 && next(run.rng) < 0.15 * (run.act - 1)));
}

export function takeRewardCard(run: Run, i: number) {
  const r = run.reward;
  if (!r || r.cardTaken || !r.cards[i]) return;
  run.deck.push(r.cards[i]);
  r.cardTaken = true;
}

export function takeRewardRelic(run: Run, id?: string) {
  const r = run.reward;
  if (!r || r.relicTaken) return;
  const relic = id && r.bossRelics.includes(id) ? id : r.relic;
  if (!relic) return;
  addRelic(run, relic);
  r.relicTaken = true;
}

export function leaveReward(run: Run) {
  const r = run.reward;
  if (!r) return;
  run.reward = null;
  run.screen = r.kind === 'boss' ? 'act-clear' : 'map';
}

/** On to the next act: a new map, and most of your Credibility back. */
export function nextAct(run: Run) {
  if (run.screen !== 'act-clear') return;
  run.act++;
  run.map = generateMap(run.rng);
  run.pos = null;
  run.visited = [];
  run.fightsThisAct = 0;
  run.hp += Math.round((run.maxHp - run.hp) * 0.75);
  run.screen = 'map';
}

export function addRelic(run: Run, id: string) {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  if (id === 'medal') {
    run.maxHp += 12;
    run.hp += 12;
  }
}

// ---------------------------------------------------------------------------
// The shop, the green room, TV appearances
// ---------------------------------------------------------------------------

const PRICES: Record<string, [number, number]> = { common: [45, 55], uncommon: [70, 82], rare: [140, 160] };
/** Late Stage 8: everything in the bookstore costs a quarter more. */
const priceRise = (run: Run) => (run.stage >= 8 ? 1.25 : 1);

function makeShop(run: Run): Shop {
  const common = rollCards(run, 3, 'fight');
  const cards = [...common, ...rollCards(run, 2, 'elite', common.map((c) => c.id))].map((card) => {
    const [lo, hi] = PRICES[POOL.find((d) => d.id === card.id)!.rarity];
    return { card, price: Math.round(int(run.rng, lo, hi) * priceRise(run)), sold: false };
  });
  const relics = shuffleInPlace(run.rng, COMMON_RELICS.filter((id) => !run.relics.includes(id)))
    .slice(0, 2)
    .map((id) => ({ id, price: Math.round(int(run.rng, 140, 180) * priceRise(run)), sold: false }));
  return { cards, relics, removed: false };
}

export function buyCard(run: Run, i: number): boolean {
  const item = run.shop?.cards[i];
  if (!item || item.sold || run.royalties < item.price) return false;
  run.royalties -= item.price;
  item.sold = true;
  run.deck.push(item.card);
  return true;
}

export function buyRelic(run: Run, i: number): boolean {
  const item = run.shop?.relics[i];
  if (!item || item.sold || run.royalties < item.price) return false;
  run.royalties -= item.price;
  item.sold = true;
  addRelic(run, item.id);
  return true;
}

/** Cut a card from your act, once per shop. */
export function removeCard(run: Run, uid: number): boolean {
  if (!run.shop || run.shop.removed || run.royalties < run.removeCost) return false;
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0) return false;
  run.royalties -= run.removeCost;
  run.removeCost += 25;
  run.deck.splice(i, 1);
  run.shop.removed = true;
  return true;
}

export function leaveShop(run: Run) {
  run.shop = null;
  run.screen = 'map';
}

export const REST_HEAL = 0.3;
/** The green room's heal: less from Late Stage 5. */
export const restHeal = (run: Run) => (run.stage >= 5 ? 0.2 : REST_HEAL);

/** The green room: rest (heal 30%) or rehearse (upgrade a card). */
export function rest(run: Run) {
  if (run.screen !== 'rest') return;
  run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * restHeal(run)));
  run.screen = 'map';
}

export function rehearse(run: Run, uid: number): boolean {
  const card = run.deck.find((c) => c.uid === uid);
  if (run.screen !== 'rest' || !card || !canUpgrade(card.id, card.up)) return false;
  card.up = true;
  run.screen = 'map';
  return true;
}

/** Can you afford this choice? */
export function choiceOpen(run: Run, needs?: { royalties?: number; hp?: number }) {
  return (!needs?.royalties || run.royalties >= needs.royalties) && (!needs?.hp || run.hp >= needs.hp);
}

export function chooseEvent(run: Run, i: number): boolean {
  const ev = run.event && eventById(run.event.id);
  const choice = ev?.choices[i];
  if (!ev || !choice || run.event!.result !== null || !choiceOpen(run, choice.needs)) return false;
  for (const effect of choice.effects) applyEffect(run, effect);
  run.event!.result = choice.result;
  return true;
}

export function leaveEvent(run: Run) {
  run.event = null;
  run.screen = 'map';
}

function applyEffect(run: Run, e: Effect) {
  switch (e.kind) {
    case 'hp':
      run.hp = Math.max(1, Math.min(run.maxHp, run.hp + e.amount));
      break;
    case 'maxHp':
      run.maxHp += e.amount;
      run.hp = Math.min(run.maxHp, run.hp + Math.max(0, e.amount));
      break;
    case 'royalties':
      run.royalties = Math.max(0, run.royalties + e.amount);
      break;
    case 'card':
      run.deck.push(newCard(run, e.id, e.up));
      break;
    case 'randomCard': {
      const options = POOL.filter((d) => d.rarity === e.rarity);
      run.deck.push(newCard(run, pickOne(run.rng, options).id));
      break;
    }
    case 'relic': {
      const id = e.id && !run.relics.includes(e.id) ? e.id : pickOne(run.rng, COMMON_RELICS.filter((r) => !run.relics.includes(r)).concat(['pipe']));
      addRelic(run, id);
      break;
    }
    case 'upgradeRandom': {
      const options = shuffleInPlace(run.rng, run.deck.filter((c) => canUpgrade(c.id, c.up)));
      for (const card of options.slice(0, e.count)) card.up = true;
      break;
    }
    case 'removeRandom': {
      const options = run.deck.filter((c) => c.id === 'data' || c.id === 'calm');
      if (options.length) run.deck.splice(run.deck.indexOf(pickOne(run.rng, options)), 1);
      break;
    }
    case 'based':
      run.based = Math.min(100, run.based + e.amount);
      break;
  }
}
