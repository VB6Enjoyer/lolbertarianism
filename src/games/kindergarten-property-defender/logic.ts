// Kindergarten Property Defender: the rules, with no DOM.
//
// Jack has a pile of blocks. Hands reach for it from every side. Some are
// grabby fists (the teacher redistributing): slap those. Some are open hands
// holding something to trade (classmates): let those through, and the deal
// happens. Slapping a trader is aggression, and it costs you a gold star.

import { attraction, buildingById, FLAG_SCARE, GLUE_SECONDS, GUARD_EVERY, GUARD_WAGES, INTEREST, LEMONADE_EVERY, nextCost, noneBuilt, SIGN_SLOW, TOLL, type BuildId, type Built } from './capital.ts';
import { allowance, bossFor, bossInfo, DAY_LENGTH, emptyDay, isBoss, isFriday, NEEDS, PERIOD_LENGTH, PERIODS, periodAt, pickRole, reportCard, weekOf, type DayStats, type Period, type ReportCard, type Role } from './school.ts';

export type HandKind = 'thief' | 'trader';
export type ItemId = 'juice' | 'dino' | 'crayons' | 'cookie' | 'car' | 'yoyo' | 'slime' | 'card' | 'money';

export const ITEMS: Record<ItemId, { icon: string; name: string }> = {
  juice: { icon: '🧃', name: 'juice box' },
  dino: { icon: '🦖', name: 'plastic dinosaur' },
  crayons: { icon: '🖍️', name: 'crayons' },
  cookie: { icon: '🍪', name: 'cookie' },
  car: { icon: '🏎️', name: 'toy car' },
  yoyo: { icon: '🪀', name: 'yo-yo' },
  slime: { icon: '🧪', name: 'slime' },
  card: { icon: '🃏', name: 'shiny trading card' },
  money: { icon: '💵', name: 'Monopoly money' },
};
/** What each item does when Jack uses it (instead of selling it on). */
export const ITEM_USES: Record<Exclude<ItemId, 'money'>, string> = {
  cookie: 'Bribe: every thief on screen freezes for 2 seconds.',
  juice: 'Sugar rush: your slaps reach much farther for 8 seconds.',
  slime: 'Slime: every thief near the pile is stuck for 3 seconds.',
  dino: 'Roar: the thieves still far off run away.',
  car: 'Distraction: every thief chases the toy car back a stretch.',
  yoyo: 'Yo-yo: knocks away the two thieves closest to your pile.',
  crayons: 'Crayon fence: the next 3 grabs bounce off.',
  card: 'Trading card: trade it to the class for a gold star back.',
};
export const RUSH_SECONDS = 8;

/** What real classmates trade (Monopoly money is the fraud kid's). */
const ITEM_IDS = (Object.keys(ITEMS) as ItemId[]).filter((id) => id !== 'money');

/**
 * A classmate's offer. Either they're selling (their item for some of your blocks: you value it more
 * than the blocks, or it wouldn't be a trade), or they're buying something you traded for earlier,
 * and paying more than you paid. Buy low, sell high: Jack, the kindergarten middleman.
 */
export interface Offer {
  wants: 'blocks' | 'item';
  item: ItemId;
  price: number;
  /** What it's worth to Jack (for the points), when he's buying. */
  value: number;
}

/** Something in Jack's stash, and what he paid for it. */
export interface Owned {
  item: ItemId;
  cost: number;
}

export interface Hand {
  id: number;
  kind: HandKind;
  /** Where the arm comes from (off the edge of the screen). */
  rootX: number;
  rootY: number;
  /** Where it's reaching: a spot on the pile. */
  targetX: number;
  targetY: number;
  /** 0 at the edge, 1 at the pile. */
  progress: number;
  /** Seconds to reach the pile. */
  travel: number;
  /** A sneaky side-to-side weave (thieves), and where in it the hand is. */
  wobble: number;
  phase: number;
  state: 'reaching' | 'leaving';
  /** Slapped away (it can't be slapped again on its way out). */
  slapped: boolean;
  /** Blocks it's making off with. */
  carrying: number;
  /** How many blocks a thief grabs. */
  grab: number;
  offer: Offer | null;
  /** The trade went through. */
  traded: boolean;
  /** Seconds left stuck in the glue moat, and whether it's been through it. */
  glued: number;
  glueDone: boolean;
  /** Whether the Gadsden flag has had its chance to scare it off. */
  flagChecked: boolean;
  /** Which troublemaker it is (thieves only). */
  role: Role | null;
  /** Slaps it takes to send away, and seconds dazed after a slap that didn't. */
  hp: number;
  stun: number;
  /** How much its speed surges and slows on the way in (more, later in the game). */
  surge: number;
  /** Sticky Fingers: seconds you've held on to it, and whether you're holding it right now. */
  held: number;
  beingHeld: boolean;
  /** Seconds since it appeared. */
  age: number;
}

export type GameEvent =
  | { type: 'slap'; hand: Hand; points: number; combo: number }
  | { type: 'recover'; hand: Hand; blocks: number; points: number }
  | { type: 'violation'; hand: Hand }
  | { type: 'steal'; hand: Hand; blocks: number }
  | { type: 'trade'; hand: Hand; offer: Offer; points: number; toll: number; profit: number }
  | { type: 'broke'; hand: Hand }
  | { type: 'star'; stars: number }
  | { type: 'homestead' }
  | { type: 'miss'; x: number; y: number }
  | { type: 'spawn'; hand: Hand }
  | { type: 'wave-end'; bonus: number }
  | { type: 'over'; reason: Ending }
  | { type: 'produce' }
  | { type: 'scared'; hand: Hand }
  | { type: 'glued'; hand: Hand }
  | { type: 'guard'; hand: Hand; points: number }
  | { type: 'interest'; blocks: number }
  | { type: 'wages'; blocks: number; quit: boolean }
  | { type: 'built'; id: BuildId; level: number }
  | { type: 'period'; period: Period }
  | { type: 'bonk'; hand: Hand; hp: number; points: number; by: 'jack' | 'guard' | 'shout' }
  | { type: 'blown'; hand: Hand; points: number }
  | { type: 'shout'; hit: number }
  | { type: 'use'; item: ItemId; hit: number }
  | { type: 'fenced'; hand: Hand }
  | { type: 'meter' }
  | { type: 'report'; card: ReportCard }
  | { type: 'allowance'; blocks: number }
  | { type: 'bounce'; hand: Hand; needs: 'slap' | 'pinch' | 'hold' };

export type Ending = 'seized' | 'expelled';

export interface Stats {
  slapped: number;
  recovered: number;
  trades: number;
  stolen: number;
  violations: number;
  bestCombo: number;
}

export interface GameState {
  w: number;
  h: number;
  blocks: number;
  stars: number;
  score: number;
  wave: number;
  /** Seconds into the wave. */
  waveTime: number;
  phase: 'playing' | 'break' | 'over';
  over: Ending | null;
  hands: Hand[];
  nextId: number;
  spawnIn: number;
  homesteadIn: number;
  combo: number;
  /** Trades since the last gold star came back. */
  goodwill: number;
  /** Toll collected but not yet a whole block. */
  tollCredit: number;
  stats: Stats;
  /** What you've traded for (and can sell on). */
  stash: Owned[];
  /** What Jack has built, and when it next does something. */
  built: Built;
  produceIn: number;
  guardIn: number;
  /** Which period of the day it is (-1 before the bell). */
  period: number;
  /** How today's going, today's report card, and whether the Principal has been by. */
  day: DayStats;
  report: ReportCard | null;
  bossDone: boolean;
  /** The PROPERTY RIGHTS! meter: fills with every thief Jack stops. */
  meter: number;
  /** Seconds of sugar rush left, grabs the crayon fence will still stop, and Hall Monitors the Superintendent has called. */
  rush: number;
  fence: number;
  summons: number;
  /** What happened since the UI last looked. */
  events: GameEvent[];
}

export const CONFIG = {
  startBlocks: 10,
  maxBlocks: 60,
  maxStars: 5,
  /** A school day: five periods. */
  waveLength: DAY_LENGTH,
  /** Jack homesteads a block from the toy bin this often (seconds). */
  homesteadEvery: 9,
  /** Trades that earn a lost gold star back. */
  tradesPerStar: 3,
  slapPoints: 10,
  recoverPoints: 15,
  /** Each trade's points: what it's worth to Jack, times this. */
  tradePoints: 10,
  waveBonusPerBlock: 5,
  /** Thieves stopped to fill the meter. */
  meterMax: 12,
};

/** Seconds between hands: quicker every wave. */
export const spawnEvery = (wave: number) => Math.max(0.42, 2.3 * 0.9 ** (wave - 1));
/** How long a thief takes to reach the pile: quicker every wave. Traders take their time. */
export const thiefTravel = (wave: number) => Math.max(1.25, 3.6 - 0.16 * (wave - 1));
/** How widely thieves' speeds vary: a little on day one, a lot later (so the fastest get faster). */
export const speedSpread = (wave: number) => Math.min(0.95, 0.35 + 0.08 * (wave - 1));
/** How hard hands surge and slow on the way in. */
export const surgeOn = (wave: number) => Math.min(0.45, 0.07 * (wave - 1));
/** Seconds to hold on to Sticky Fingers. */
export const HOLD_TIME = 0.7;
/** Thieves grab a handful from a big pile. */
export const grabFrom = (blocks: number) => 1 + Math.floor(blocks / 12);

/**
 * Where hands can come from, as angles around the pile (180° is the left, 90° the top, 0° the right).
 * Thieves start in a narrow cone on the teacher's side and it widens every day, reaching the right in
 * the second week. Traders start up and to the right, and spread out too.
 */
export const thiefArc = (wave: number) => ({ center: 180, half: Math.min(180, 25 + 24 * (wave - 1)) });
export const traderArc = (wave: number) => ({ center: 60, half: Math.min(180, 35 + 18 * (wave - 1)) });
export const TRADER_TRAVEL = 3.6;
/** The share of hands that are traders: fewer if you've been slapping them (classmates talk). */
export const traderShare = (stars: number) => 0.08 + 0.25 * (stars / CONFIG.maxStars);
/** The combo multiplier: ×2 at 5 in a row, ×3 at 10, ×4 from 15 on. */
export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 5));
/** How close a tap has to be to a hand. */
export const slapRadius = (s: GameState) => Math.max(34, Math.min(s.w, s.h) * 0.075) * (s.rush > 0 ? 1.7 : 1);

/** What it takes to beat a hand right now (the Department of Education switches every couple of seconds). */
export function needsFor(hand: Hand): 'slap' | 'pinch' | 'hold' {
  if (hand.role === 'doe') return Math.floor(hand.age / 2.2) % 2 ? 'pinch' : 'slap';
  return (hand.role && NEEDS[hand.role]) ?? 'slap';
}

/** Where the pile sits (bottom middle), and how big it is. */
export function pileAt(s: GameState) {
  // On a tall (phone) screen the pile sits higher up, out of the crowd at the bottom.
  const tall = s.h > s.w * 1.25;
  return { x: s.w * 0.5, y: tall ? s.h * 0.56 : s.h - Math.max(70, s.h * 0.14) };
}

export function newGame(w: number, h: number): GameState {
  return {
    w,
    h,
    blocks: CONFIG.startBlocks,
    stars: CONFIG.maxStars,
    score: 0,
    wave: 1,
    waveTime: 0,
    phase: 'playing',
    over: null,
    hands: [],
    nextId: 1,
    spawnIn: 1,
    homesteadIn: CONFIG.homesteadEvery,
    combo: 0,
    goodwill: 0,
    tollCredit: 0,
    stats: { slapped: 0, recovered: 0, trades: 0, stolen: 0, violations: 0, bestCombo: 0 },
    stash: [],
    built: noneBuilt(),
    produceIn: 0,
    guardIn: 0,
    period: -1,
    day: emptyDay(),
    report: null,
    bossDone: false,
    meter: 0,
    rush: 0,
    fence: 0,
    summons: 0,
    events: [],
  };
}

/** The screen changed size: keep every hand in the same place relative to it. */
export function resize(s: GameState, w: number, h: number) {
  const sx = w / s.w;
  const sy = h / s.h;
  for (const hand of s.hands) {
    hand.rootX *= sx;
    hand.rootY *= sy;
    hand.targetX *= sx;
    hand.targetY *= sy;
  }
  s.w = w;
  s.h = h;
}

/** Where a hand is right now. */
export function handPosition(hand: Hand): { x: number; y: number } {
  const p = hand.progress;
  const e = 1 - (1 - p) * (1 - p); // ease out: lunges, then slows near the pile
  const dx = hand.targetX - hand.rootX;
  const dy = hand.targetY - hand.rootY;
  const len = Math.hypot(dx, dy) || 1;
  // Weave across the line of travel, less as it closes in.
  const weave = Math.sin(hand.phase + p * Math.PI * 3) * hand.wobble * (1 - p);
  return { x: hand.rootX + dx * e + (-dy / len) * weave, y: hand.rootY + dy * e + (dx / len) * weave };
}

/** Where a hand comes from: thieves mostly from the teacher's side, traders from the classmates', with more mixing later. */
function rootFor(s: GameState, kind: HandKind, rng: () => number): { x: number; y: number } {
  const arc = kind === 'thief' ? thiefArc(s.wave) : traderArc(s.wave);
  return edgeAt(s, arc.center + (rng() * 2 - 1) * arc.half);
}

/** The point just off the edge of the screen, looking out from the pile at an angle. */
export function edgeAt(s: GameState, degrees: number): { x: number; y: number } {
  const p = pileAt(s);
  const a = (degrees * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  const tx = dx > 1e-6 ? (s.w - p.x) / dx : dx < -1e-6 ? -p.x / dx : Infinity;
  const ty = dy > 1e-6 ? (s.h - p.y) / dy : dy < -1e-6 ? -p.y / dy : Infinity;
  const t = Math.min(tx, ty) + 30;
  return { x: p.x + dx * t, y: p.y + dy * t };
}

/** About half the classmates want something from your stash (if there's anything in it). */
export const BUYER_SHARE = 0.5;

function makeOffer(s: GameState, rng: () => number): Offer {
  if (s.stash.length && rng() < BUYER_SHARE) {
    const owned = s.stash[Math.floor(rng() * s.stash.length)];
    return { wants: 'item', item: owned.item, price: owned.cost + 1, value: 0 };
  }
  const price = 1 + Math.floor(rng() * 3);
  return { wants: 'blocks', item: ITEM_IDS[Math.floor(rng() * ITEM_IDS.length)], price, value: Math.round(price * (1.4 + rng() * 0.9) * 10) / 10 };
}

export function spawnHand(s: GameState, rng: () => number, kind?: HandKind, forced?: Role): Hand {
  const period = periodAt(s.waveTime);
  kind ??= forced ? 'thief' : rng() < Math.max(0.05, Math.min(0.85, traderShare(s.stars) + period.traders)) ? 'trader' : 'thief';
  const role: Role | null = kind === 'thief' ? (forced ?? pickRole(s.wave, period.id, rng)) : null;
  // The fraud kid comes in like a trader, at a trader's pace.
  const looksLike: HandKind = role === 'fraud' ? 'trader' : kind;
  const root = role === 'principal' || role === 'doe' ? { x: -40, y: s.h * 0.45 } : role === 'superintendent' ? { x: s.w * 0.35, y: -40 } : rootFor(s, looksLike, rng);
  const pile = pileAt(s);
  const spread = Math.min(s.w, s.h) * 0.06;
  const hand: Hand = {
    id: s.nextId++,
    kind,
    rootX: root.x,
    rootY: root.y,
    targetX: pile.x + (rng() - 0.5) * spread * 2,
    targetY: pile.y + (rng() - 0.5) * spread,
    progress: 0,
    travel:
      looksLike === 'trader'
        ? TRADER_TRAVEL * (0.9 + rng() * 0.2)
        : ((thiefTravel(s.wave) * (1 - speedSpread(s.wave) * 0.45 + rng() * speedSpread(s.wave))) / period.speed) * (1 + (s.built.sign ? SIGN_SLOW[s.built.sign - 1] : 0)) * (role === 'principal' ? 2.4 : role === 'superintendent' ? 2.6 : role === 'board' ? 2.0 : role === 'doe' ? 2.8 : role === 'monitor' ? 1.3 : role === 'president' ? 1.15 : 1),
    wobble: looksLike === 'thief' ? Math.min(s.w, s.h) * (isBoss(role) ? 0.01 : 0.03 + rng() * 0.05) : 0,
    phase: rng() * Math.PI * 2,
    state: 'reaching',
    slapped: false,
    carrying: 0,
    grab: 1,
    offer: kind === 'trader' ? makeOffer(s, rng) : role === 'fraud' ? { wants: 'blocks', item: 'money', price: 2 + Math.floor(rng() * 2), value: 0 } : null,
    traded: false,
    glued: 0,
    glueDone: false,
    flagChecked: false,
    role,
    hp: isBoss(role) ? bossFor(weekOf(s.wave)).hp : role === 'monitor' ? 3 : 1,
    stun: 0,
    surge: looksLike === 'thief' ? surgeOn(s.wave) * (0.5 + rng() * 0.5) : 0,
    held: 0,
    beingHeld: false,
    age: 0,
  };
  if (kind === 'thief') s.day.thieves++;
  s.hands.push(hand);
  s.events.push({ type: 'spawn', hand });
  return hand;
}

function end(s: GameState, reason: Ending) {
  if (s.phase === 'over') return;
  s.phase = 'over';
  s.over = reason;
  s.events.push({ type: 'over', reason });
}

/** A hand gets to the pile: a thief grabs, a trader trades. */
function arrive(s: GameState, hand: Hand) {
  hand.state = 'leaving';
  if (hand.kind === 'thief' && s.fence > 0 && !isBoss(hand.role)) {
    s.fence--;
    s.events.push({ type: 'fenced', hand });
    return;
  }
  if (hand.kind === 'thief') {
    // The President taxes 10%, the Principal takes 30% (eminent domain), the fraud kid "buys" with funny money.
    const want = hand.role === 'president' ? Math.max(1, Math.ceil(s.blocks * 0.1)) : isBoss(hand.role) ? Math.max(1, Math.ceil(s.blocks * bossInfo(hand.role!)!.take)) : hand.role === 'fraud' ? hand.offer!.price : grabFrom(s.blocks);
    const took = Math.min(want, s.blocks);
    s.blocks -= took;
    hand.carrying = took;
    s.stats.stolen += took;
    s.day.stolen += took;
    s.combo = 0;
    s.events.push({ type: 'steal', hand, blocks: took });
    if (s.blocks <= 0) end(s, 'seized');
    return;
  }
  const offer = hand.offer!;
  let points: number;
  let profit = 0;
  if (offer.wants === 'item') {
    // They're buying: you need the thing (you might have sold it to someone else already).
    const i = s.stash.findIndex((o) => o.item === offer.item);
    if (i < 0) {
      s.events.push({ type: 'broke', hand });
      return;
    }
    const [sold] = s.stash.splice(i, 1);
    profit = offer.price - sold.cost;
    s.blocks = Math.min(CONFIG.maxBlocks, s.blocks + offer.price);
    points = (offer.price - sold.cost) * CONFIG.tradePoints * 2;
    s.day.profit += offer.price - sold.cost;
  } else {
    if (s.blocks < offer.price) {
      s.events.push({ type: 'broke', hand });
      return;
    }
    s.blocks -= offer.price;
    s.stash.push({ item: offer.item, cost: offer.price });
    points = Math.round(offer.value * CONFIG.tradePoints);
    s.day.profit += offer.value - offer.price;
  }
  hand.traded = true;
  s.stats.trades++;
  s.day.trades++;
  s.score += points;
  // The toll builds up a fraction of a block per trade.
  s.tollCredit += s.built.toll ? TOLL[s.built.toll - 1] : 0;
  const toll = Math.floor(s.tollCredit);
  s.tollCredit -= toll;
  s.blocks = Math.min(CONFIG.maxBlocks, s.blocks + toll);
  s.events.push({ type: 'trade', hand, offer, points, toll, profit });
  // Good trades win back the class's trust.
  s.goodwill++;
  if (s.goodwill >= CONFIG.tradesPerStar && s.stars < CONFIG.maxStars) {
    s.goodwill = 0;
    s.stars++;
    s.events.push({ type: 'star', stars: s.stars });
  }
}

export function step(s: GameState, dt: number, rng: () => number) {
  if (s.phase !== 'playing') return;
  s.waveTime += dt;
  const spawning = s.waveTime < CONFIG.waveLength;
  const idx = Math.min(PERIODS.length - 1, Math.floor(s.waveTime / PERIOD_LENGTH));
  if (spawning && idx !== s.period) {
    s.period = idx;
    s.events.push({ type: 'period', period: PERIODS[idx] });
    if (isFriday(s.wave) && PERIODS[idx].id === 'show' && !s.bossDone) {
      s.bossDone = true;
      spawnBoss(s, rng);
    }
  }
  s.rush = Math.max(0, s.rush - dt);
  while (s.summons > 0) {
    s.summons--;
    const boss = s.hands.find((h) => h.role === 'superintendent' && !h.slapped);
    const monitor = spawnHand(s, rng, 'thief', 'monitor');
    if (boss) {
      monitor.rootX = boss.rootX + (rng() - 0.5) * s.w * 0.3;
      monitor.rootY = boss.rootY;
    }
  }
  if (spawning) {
    s.spawnIn -= dt;
    while (s.spawnIn <= 0) {
      const hand = spawnHand(s, rng);
      // The Group Project kids come in pairs.
      if (hand.role === 'group') {
        const twin = spawnHand(s, rng, 'thief', 'group');
        twin.rootX = hand.rootX + (hand.rootX < 0 ? 0 : 60);
        twin.rootY = hand.rootY + (hand.rootY < 0 ? 0 : 60);
        twin.phase = hand.phase + Math.PI;
      }
      // A big pile draws a crowd; some periods are busier than others.
      s.spawnIn += (spawnEvery(s.wave) / attraction(s.blocks) / PERIODS[s.period].spawn) * (0.7 + rng() * 0.6);
    }
  }
  // Jack homesteads a block from the toy bin now and then.
  s.homesteadIn -= dt;
  if (s.homesteadIn <= 0) {
    s.homesteadIn += CONFIG.homesteadEvery;
    if (s.blocks < CONFIG.maxBlocks) {
      s.blocks++;
      s.events.push({ type: 'homestead' });
    }
  }
  // The lemonade stand
  if (s.built.lemonade) {
    s.produceIn -= dt;
    if (s.produceIn <= 0) {
      s.produceIn += LEMONADE_EVERY[s.built.lemonade - 1];
      if (s.blocks < CONFIG.maxBlocks) {
        s.blocks++;
        s.events.push({ type: 'produce' });
      }
    }
  }
  // Hired security slaps the closest thief now and then.
  if (s.built.guard) {
    s.guardIn -= dt;
    if (s.guardIn <= 0) {
      const target = s.hands.filter((h) => h.kind === 'thief' && !isBoss(h.role) && !(h.role && NEEDS[h.role]) && h.state === 'reaching' && !h.slapped && h.progress > 0.35).sort((a, b) => b.progress - a.progress)[0];
      if (target) {
        s.guardIn = GUARD_EVERY[s.built.guard - 1];
        hitThief(s, target, 'guard');
      } else s.guardIn = 0.25;
    }
  }
  for (const hand of s.hands) {
    hand.age += dt;
    if (hand.state === 'reaching' && hand.kind === 'thief') {
      // Halfway there, a Gadsden flag might scare it off.
      if (!hand.flagChecked && hand.progress >= 0.5) {
        hand.flagChecked = true;
        if (s.built.flag && !isBoss(hand.role) && rng() < FLAG_SCARE[s.built.flag - 1]) {
          hand.state = 'leaving';
          hand.slapped = true;
          s.day.stopped++;
          s.events.push({ type: 'scared', hand });
          continue;
        }
      }
      // Dazed after a slap it shrugged off
      if (hand.stun > 0) {
        hand.stun -= dt;
        continue;
      }
      // Close to the pile, the glue moat holds it for a moment.
      if (s.built.glue && !hand.glueDone && hand.progress >= 0.82) {
        hand.glueDone = true;
        hand.glued = GLUE_SECONDS[s.built.glue - 1];
        s.events.push({ type: 'glued', hand });
      }
      if (hand.glued > 0) {
        hand.glued -= dt;
        continue;
      }
    }
    if (hand.state === 'reaching') {
      const surge = 1 + hand.surge * Math.sin(hand.phase * 3 + hand.progress * 10);
      const held = hand.beingHeld ? 0.25 : 1;
      hand.progress += (dt / hand.travel) * surge * held;
      if (hand.progress >= 1) {
        hand.progress = 1;
        arrive(s, hand);
        if ((s.phase as GameState['phase']) === 'over') return; // the hand that arrived may have ended it
      }
    } else {
      hand.progress -= (dt / hand.travel) * (hand.slapped ? 3.5 : 1.6);
    }
  }
  for (const hand of s.hands) {
    if (!hand.beingHeld) hand.held = Math.max(0, hand.held - dt * 0.6);
    hand.beingHeld = false;
  }
  s.hands = s.hands.filter((hand) => hand.state === 'reaching' || hand.progress > 0);
  // The wave's over once the last hand has gone.
  if (!spawning && s.hands.length === 0) {
    const bonus = s.blocks * CONFIG.waveBonusPerBlock;
    s.score += bonus;
    s.phase = 'break';
    // The piggy bank pays interest; the security kid wants paying.
    if (s.built.piggy) {
      const interest = Math.min(CONFIG.maxBlocks - s.blocks, Math.floor(s.blocks * INTEREST[s.built.piggy - 1]));
      if (interest > 0) {
        s.blocks += interest;
        s.events.push({ type: 'interest', blocks: interest });
      }
    }
    if (s.built.guard) {
      const wages = GUARD_WAGES[s.built.guard - 1];
      if (s.blocks > wages) {
        s.blocks -= wages;
        s.events.push({ type: 'wages', blocks: wages, quit: false });
      } else {
        s.built.guard = 0;
        s.events.push({ type: 'wages', blocks: 0, quit: true });
      }
    }
    const card = reportCard(s.day);
    s.report = card;
    s.score += card.bonus;
    s.events.push({ type: 'report', card });
    if (isFriday(s.wave)) {
      const pay = Math.min(CONFIG.maxBlocks - s.blocks, allowance(weekOf(s.wave)));
      s.blocks += pay;
      s.events.push({ type: 'allowance', blocks: pay });
    }
    s.events.push({ type: 'wave-end', bonus });
  }
}

/**
 * Hits a thief (Jack's slap, or the security kid's). Tough ones (the Hall Monitor, the Principal) take
 * several: each knocks them back and dazes them. Caught on the way out, a thief drops what it took.
 */
function hitThief(s: GameState, hand: Hand, by: 'jack' | 'guard' | 'shout') {
  const mult = by === 'jack' ? multiplier(s.combo) : 1;
  const base = by === 'jack' ? CONFIG.slapPoints : by === 'shout' ? 15 : Math.round(CONFIG.slapPoints / 2);
  if (by === 'jack' && s.meter < CONFIG.meterMax) {
    s.meter++;
    if (s.meter === CONFIG.meterMax) s.events.push({ type: 'meter' });
  }
  if (hand.hp > 1 && hand.state === 'reaching') {
    hand.hp--;
    hand.progress = Math.max(0, hand.progress - 0.18);
    hand.stun = 0.35;
    const points = base * mult;
    s.score += points;
    s.events.push({ type: 'bonk', hand, hp: hand.hp, points, by });
    // Every third slap, the Superintendent calls in another Hall Monitor.
    if (hand.role === 'superintendent' && hand.hp % 3 === 0) s.summons++;
    return;
  }
  hand.slapped = true;
  hand.state = 'leaving';
  s.day.stopped++;
  if (hand.carrying > 0) {
    // Caught it on the way out: the blocks come back.
    const blocks = hand.carrying;
    hand.carrying = 0;
    s.blocks = Math.min(CONFIG.maxBlocks, s.blocks + blocks);
    s.stats.recovered += blocks;
    const points = CONFIG.recoverPoints * mult;
    s.score += points;
    s.events.push({ type: 'recover', hand, blocks, points });
    return;
  }
  s.stats.slapped++;
  const points = (isBoss(hand.role) ? 100 : hand.role === 'monitor' || hand.role === 'president' ? base * 2 : base) * mult;
  s.score += points;
  if (by === 'guard') s.events.push({ type: 'guard', hand, points });
  else if (by === 'shout') s.events.push({ type: 'blown', hand, points });
  else s.events.push({ type: 'slap', hand, points, combo: s.combo });
}

/** Friday's boss arrives (with company, some weeks). */
function spawnBoss(s: GameState, rng: () => number) {
  const boss = bossFor(weekOf(s.wave));
  if (boss.role === 'board') {
    // Three members, three directions
    for (const deg of [165, 95, 25]) {
      const member = spawnHand(s, rng, 'thief', 'board');
      const root = edgeAt(s, deg);
      member.rootX = root.x;
      member.rootY = root.y;
    }
    return;
  }
  const hand = spawnHand(s, rng, 'thief', boss.role);
  if (boss.role === 'superintendent') {
    for (let i = 0; i < 3; i++) {
      const monitor = spawnHand(s, rng, 'thief', 'monitor');
      monitor.rootX = hand.rootX + (i - 1) * s.w * 0.15;
      monitor.rootY = hand.rootY;
    }
  }
}

/**
 * PROPERTY RIGHTS! With a full meter, Jack shouts: every grabby hand on screen is blown away (and drops
 * what it was carrying). Bosses take three hits instead.
 */
export function shout(s: GameState): boolean {
  if (s.phase !== 'playing' || s.meter < CONFIG.meterMax) return false;
  s.meter = 0;
  let hit = 0;
  for (const hand of [...s.hands]) {
    if (hand.kind !== 'thief' || hand.slapped) continue;
    if (hand.state === 'leaving' && hand.carrying === 0) continue;
    hit++;
    if (isBoss(hand.role) && hand.state === 'reaching') {
      for (let i = 0; i < 3 && !hand.slapped; i++) hitThief(s, hand, 'shout');
      continue;
    }
    hand.hp = 1;
    hitThief(s, hand, 'shout');
  }
  s.events.push({ type: 'shout', hit });
  return true;
}

/** Uses something from the stash (instead of selling it on). */
export function useItem(s: GameState, item: ItemId): boolean {
  if (s.phase !== 'playing' || item === 'money') return false;
  const i = s.stash.findIndex((o) => o.item === item);
  if (i < 0) return false;
  if (item === 'card' && s.stars >= CONFIG.maxStars) return false; // nothing to buy back
  s.stash.splice(i, 1);
  const thieves = s.hands.filter((h) => h.kind === 'thief' && h.state === 'reaching' && !h.slapped);
  let hit = 0;
  switch (item) {
    case 'cookie':
      for (const h of thieves) h.stun = Math.max(h.stun, 2);
      hit = thieves.length;
      break;
    case 'juice':
      s.rush = RUSH_SECONDS;
      break;
    case 'slime':
      for (const h of thieves.filter((x) => x.progress > 0.45)) {
        h.glued = Math.max(h.glued, 3);
        hit++;
      }
      break;
    case 'dino':
      for (const h of thieves.filter((x) => x.progress < 0.6 && !isBoss(x.role))) {
        h.state = 'leaving';
        h.slapped = true;
        s.day.stopped++;
        hit++;
      }
      break;
    case 'car':
      for (const h of thieves) h.progress = Math.max(0, h.progress - 0.3);
      hit = thieves.length;
      break;
    case 'yoyo':
      for (const h of thieves.filter((x) => !isBoss(x.role) && needsFor(x) === 'slap').sort((a, b) => b.progress - a.progress).slice(0, 2)) {
        h.hp = 1;
        hitThief(s, h, 'guard');
        hit++;
      }
      break;
    case 'crayons':
      s.fence += 3;
      break;
    case 'card':
      s.stars++;
      break;
  }
  s.events.push({ type: 'use', item, hit });
  return true;
}

/** Jack slaps at a spot. Returns what it hit, if anything. */
export function slap(s: GameState, x: number, y: number, how: 'slap' | 'pinch' = 'slap'): Hand | null {
  if (s.phase !== 'playing') return null;
  let best: Hand | null = null;
  let bestD = slapRadius(s);
  for (const hand of s.hands) {
    if (hand.slapped) continue;
    if (hand.kind === 'thief' && hand.state === 'leaving' && hand.carrying === 0) continue;
    const at = handPosition(hand);
    const d = Math.hypot(at.x - x, at.y - y);
    if (d < bestD) {
      best = hand;
      bestD = d;
    }
  }
  if (!best) {
    s.combo = 0;
    s.events.push({ type: 'miss', x, y });
    return null;
  }
  const hand = best;
  if (hand.kind === 'trader') {
    // Aggression against someone who came to trade.
    hand.slapped = true;
    hand.state = 'leaving';
    s.stars--;
    s.combo = 0;
    s.goodwill = 0;
    s.stats.violations++;
    s.day.violations++;
    s.events.push({ type: 'violation', hand });
    if (s.stars <= 0) end(s, 'expelled');
    return hand;
  }
  // Oven Mitts need a pinch, Sticky Fingers need holding, the rest need a slap.
  const needs = needsFor(hand);
  if (needs !== how) {
    s.events.push({ type: 'bounce', hand, needs });
    return hand;
  }
  s.combo++;
  s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo);
  hitThief(s, hand, 'jack');
  return hand;
}

/**
 * Jack's holding the pointer down at a spot (call it every frame while he does). Sticky Fingers under
 * it slow down, and come off once they've been held long enough.
 */
export function press(s: GameState, x: number, y: number, dt: number): Hand | null {
  if (s.phase !== 'playing') return null;
  let best: Hand | null = null;
  let bestD = slapRadius(s) * 1.3;
  for (const hand of s.hands) {
    if (hand.slapped || hand.role !== 'sticky') continue;
    const at = handPosition(hand);
    const d = Math.hypot(at.x - x, at.y - y);
    if (d < bestD) {
      best = hand;
      bestD = d;
    }
  }
  if (!best) return null;
  best.beingHeld = true;
  best.held += dt;
  if (best.held >= HOLD_TIME) {
    best.held = 0;
    best.beingHeld = false;
    s.combo++;
    s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo);
    hitThief(s, best, 'jack');
  }
  return best;
}

/** Builds (or upgrades) something at recess. Jack keeps at least one block. */
export function build(s: GameState, id: BuildId): boolean {
  if (s.phase !== 'break') return false;
  const level = s.built[id];
  const cost = nextCost(buildingById(id), level);
  if (cost === null || s.blocks - cost < 1) return false;
  s.blocks -= cost;
  s.built[id] = level + 1;
  s.events.push({ type: 'built', id, level: level + 1 });
  return true;
}

/** On to the next wave. */
export function nextWave(s: GameState) {
  if (s.phase !== 'break') return;
  s.wave++;
  s.waveTime = 0;
  s.spawnIn = 1;
  s.produceIn = s.built.lemonade ? LEMONADE_EVERY[s.built.lemonade - 1] : 0;
  s.guardIn = s.built.guard ? GUARD_EVERY[s.built.guard - 1] : 0;
  s.period = -1;
  s.day = emptyDay();
  s.report = null;
  s.bossDone = false;
  s.rush = 0;
  s.fence = 0;
  s.summons = 0;
  s.phase = 'playing';
}
