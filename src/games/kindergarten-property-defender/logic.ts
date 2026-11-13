// Kindergarten Property Defender: the rules, with no DOM.
//
// Jack has a pile of blocks. Hands reach for it from every side. Some are
// grabby fists (the teacher redistributing): slap those. Some are open hands
// holding something to trade (classmates): let those through, and the deal
// happens. Slapping a trader is aggression, and it costs you a gold star.

export type HandKind = 'thief' | 'trader';
export type ItemId = 'juice' | 'dino' | 'crayons' | 'cookie' | 'car' | 'yoyo' | 'slime' | 'card';

export const ITEMS: Record<ItemId, { icon: string; name: string }> = {
  juice: { icon: '🧃', name: 'juice box' },
  dino: { icon: '🦖', name: 'plastic dinosaur' },
  crayons: { icon: '🖍️', name: 'crayons' },
  cookie: { icon: '🍪', name: 'cookie' },
  car: { icon: '🏎️', name: 'toy car' },
  yoyo: { icon: '🪀', name: 'yo-yo' },
  slime: { icon: '🧪', name: 'slime' },
  card: { icon: '🃏', name: 'shiny trading card' },
};
const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

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
}

export type GameEvent =
  | { type: 'slap'; hand: Hand; points: number; combo: number }
  | { type: 'recover'; hand: Hand; blocks: number; points: number }
  | { type: 'violation'; hand: Hand }
  | { type: 'steal'; hand: Hand; blocks: number }
  | { type: 'trade'; hand: Hand; offer: Offer; points: number }
  | { type: 'broke'; hand: Hand }
  | { type: 'star'; stars: number }
  | { type: 'homestead' }
  | { type: 'miss'; x: number; y: number }
  | { type: 'spawn'; hand: Hand }
  | { type: 'wave-end'; bonus: number }
  | { type: 'over'; reason: Ending };

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
  stats: Stats;
  /** What you've traded for (and can sell on). */
  stash: Owned[];
  /** What happened since the UI last looked. */
  events: GameEvent[];
}

export const CONFIG = {
  startBlocks: 10,
  maxBlocks: 40,
  maxStars: 5,
  waveLength: 35,
  /** Jack homesteads a block from the toy bin this often (seconds). */
  homesteadEvery: 5,
  /** Trades that earn a lost gold star back. */
  tradesPerStar: 3,
  slapPoints: 10,
  recoverPoints: 15,
  /** Each trade's points: what it's worth to Jack, times this. */
  tradePoints: 10,
  waveBonusPerBlock: 5,
};

/** Seconds between hands: quicker every wave. */
export const spawnEvery = (wave: number) => Math.max(0.45, 1.6 * 0.88 ** (wave - 1));
/** How long a thief takes to reach the pile: quicker every wave. Traders take their time. */
export const thiefTravel = (wave: number) => Math.max(1.4, 3.4 - 0.2 * (wave - 1));
export const TRADER_TRAVEL = 3.6;
/** The share of hands that are traders: fewer if you've been slapping them (classmates talk). */
export const traderShare = (stars: number) => 0.12 + 0.33 * (stars / CONFIG.maxStars);
/** The combo multiplier: ×2 at 5 in a row, ×3 at 10, ×4 from 15 on. */
export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 5));
/** How close a tap has to be to a hand. */
export const slapRadius = (s: GameState) => Math.max(34, Math.min(s.w, s.h) * 0.075);

/** Where the pile sits (bottom middle), and how big it is. */
export function pileAt(s: GameState) {
  return { x: s.w * 0.5, y: s.h - Math.max(70, s.h * 0.14) };
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
    stats: { slapped: 0, recovered: 0, trades: 0, stolen: 0, violations: 0, bestCombo: 0 },
    stash: [],
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
  const side = rng();
  const mixed = s.wave >= 3 ? 0.3 : 0;
  if (kind === 'thief') {
    if (side < 0.7 - mixed) return { x: -30, y: s.h * (0.25 + rng() * 0.55) };
    if (side < 1 - mixed) return { x: s.w * (0.05 + rng() * 0.4), y: -30 };
    return { x: s.w * (0.45 + rng() * 0.45), y: -30 };
  }
  if (side < 0.6) return { x: s.w * (0.2 + rng() * 0.65), y: -30 };
  if (side < 0.9 || s.wave < 4) return { x: s.w + 30, y: s.h * (0.12 + rng() * 0.4) };
  return { x: -30, y: s.h * (0.2 + rng() * 0.4) };
}

/** About half the classmates want something from your stash (if there's anything in it). */
export const BUYER_SHARE = 0.5;

function makeOffer(s: GameState, rng: () => number): Offer {
  if (s.stash.length && rng() < BUYER_SHARE) {
    const owned = s.stash[Math.floor(rng() * s.stash.length)];
    return { wants: 'item', item: owned.item, price: owned.cost + 1 + Math.floor(rng() * 2), value: 0 };
  }
  const price = 1 + Math.floor(rng() * 3);
  return { wants: 'blocks', item: ITEM_IDS[Math.floor(rng() * ITEM_IDS.length)], price, value: Math.round(price * (1.4 + rng() * 0.9) * 10) / 10 };
}

export function spawnHand(s: GameState, rng: () => number, kind: HandKind = rng() < traderShare(s.stars) ? 'trader' : 'thief'): Hand {
  const root = rootFor(s, kind, rng);
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
    travel: kind === 'thief' ? thiefTravel(s.wave) * (0.85 + rng() * 0.3) : TRADER_TRAVEL * (0.9 + rng() * 0.2),
    wobble: kind === 'thief' ? Math.min(s.w, s.h) * (0.03 + rng() * 0.05) : 0,
    phase: rng() * Math.PI * 2,
    state: 'reaching',
    slapped: false,
    carrying: 0,
    grab: kind === 'thief' && s.wave >= 5 && rng() < 0.25 ? 2 : 1,
    offer: kind === 'trader' ? makeOffer(s, rng) : null,
    traded: false,
  };
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
  if (hand.kind === 'thief') {
    const took = Math.min(hand.grab, s.blocks);
    s.blocks -= took;
    hand.carrying = took;
    s.stats.stolen += took;
    s.combo = 0;
    s.events.push({ type: 'steal', hand, blocks: took });
    if (s.blocks <= 0) end(s, 'seized');
    return;
  }
  const offer = hand.offer!;
  let points: number;
  if (offer.wants === 'item') {
    // They're buying: you need the thing (you might have sold it to someone else already).
    const i = s.stash.findIndex((o) => o.item === offer.item);
    if (i < 0) {
      s.events.push({ type: 'broke', hand });
      return;
    }
    const [sold] = s.stash.splice(i, 1);
    s.blocks = Math.min(CONFIG.maxBlocks, s.blocks + offer.price);
    points = (offer.price - sold.cost) * CONFIG.tradePoints * 2;
  } else {
    if (s.blocks < offer.price) {
      s.events.push({ type: 'broke', hand });
      return;
    }
    s.blocks -= offer.price;
    s.stash.push({ item: offer.item, cost: offer.price });
    points = Math.round(offer.value * CONFIG.tradePoints);
  }
  hand.traded = true;
  s.stats.trades++;
  s.score += points;
  s.events.push({ type: 'trade', hand, offer, points });
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
  if (spawning) {
    s.spawnIn -= dt;
    while (s.spawnIn <= 0) {
      spawnHand(s, rng);
      s.spawnIn += spawnEvery(s.wave) * (0.7 + rng() * 0.6);
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
  for (const hand of s.hands) {
    if (hand.state === 'reaching') {
      hand.progress += dt / hand.travel;
      if (hand.progress >= 1) {
        hand.progress = 1;
        arrive(s, hand);
        if ((s.phase as GameState['phase']) === 'over') return; // the hand that arrived may have ended it
      }
    } else {
      hand.progress -= (dt / hand.travel) * (hand.slapped ? 3.5 : 1.6);
    }
  }
  s.hands = s.hands.filter((hand) => hand.state === 'reaching' || hand.progress > 0);
  // The wave's over once the last hand has gone.
  if (!spawning && s.hands.length === 0) {
    const bonus = s.blocks * CONFIG.waveBonusPerBlock;
    s.score += bonus;
    s.phase = 'break';
    s.events.push({ type: 'wave-end', bonus });
  }
}

/** Jack slaps at a spot. Returns what it hit, if anything. */
export function slap(s: GameState, x: number, y: number): Hand | null {
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
  hand.slapped = true;
  hand.state = 'leaving';
  if (hand.kind === 'trader') {
    // Aggression against someone who came to trade.
    s.stars--;
    s.combo = 0;
    s.goodwill = 0;
    s.stats.violations++;
    s.events.push({ type: 'violation', hand });
    if (s.stars <= 0) end(s, 'expelled');
    return hand;
  }
  s.combo++;
  s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo);
  if (hand.carrying > 0) {
    // Caught it on the way out: the blocks come back.
    const blocks = hand.carrying;
    hand.carrying = 0;
    s.blocks = Math.min(CONFIG.maxBlocks, s.blocks + blocks);
    s.stats.recovered += blocks;
    const points = CONFIG.recoverPoints * multiplier(s.combo);
    s.score += points;
    s.events.push({ type: 'recover', hand, blocks, points });
    return hand;
  }
  s.stats.slapped++;
  const points = CONFIG.slapPoints * multiplier(s.combo);
  s.score += points;
  s.events.push({ type: 'slap', hand, points, combo: s.combo });
  return hand;
}

/** On to the next wave. */
export function nextWave(s: GameState) {
  if (s.phase !== 'break') return;
  s.wave++;
  s.waveTime = 0;
  s.spawnIn = 1;
  s.phase = 'playing';
}
