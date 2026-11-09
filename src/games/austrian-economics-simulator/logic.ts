// The Business Cycle: the rules, with no DOM. main.ts calls update() every
// frame and the action functions on key presses / taps, and reacts to the
// events they return.
//
// The loop from the meme: steal a manhole cover → sell it to the junkyard →
// buy drugs → wait for the city to replace it. The Fed's boom/bust schedule
// moves the scrap price (the near junkyard first: the Cantillon effect),
// everything inflates, and the city's crews and covers come and go with it.

import { COLS, DEPOT, findPath, isRoad, MANHOLE_SLOTS, placeAtDoor, ROAD_TILES, sameTile, STARTING_SLOTS, type Tile } from './map.ts';

export const CONFIG = {
  startCash: 98,
  /** Seconds for a full fix to wear off. */
  fixSeconds: 55,
  /** Below this you're in withdrawal (and slower). */
  withdrawal: 0.22,
  speed: 3.4,
  bikeSpeed: 1.45,
  nodSpeed: 0.55,
  rushSpeed: 1.35,
  withdrawalSpeed: 0.75,
  /** Carrying covers without a cart: this slow. With one: this much slower per cover. */
  carrySpeed: 0.7,
  cartSpeedPerCover: 0.06,
  pryTime: 1.3,
  crowbarPryTime: 0.6,
  copSpeed: 2.2,
  pedSpeed: 1.4,
  crewSpeed: 3,
  crewWork: 2.4,
  /** How far each one sees, in tiles, and heat per second while they watch you pry. */
  copSight: 3,
  crewSight: 2.5,
  pedSight: 2,
  copHeat: 45,
  crewHeat: 30,
  pedHeat: 10,
  /** Heat per second per cover a cop sees you carrying. */
  carryHeat: 3,
  heatDecay: 4,
  /** Heat when a passer-by falls into an open manhole. */
  fallHeat: 8,
  copDownSeconds: 10,
  pedRespawn: 15,
  baseScrap: 15,
  heroin: { price: 55, fix: 1, utils: 12, seconds: 3.5 },
  crack: { price: 30, fix: 0.5, utils: 7, seconds: 8 },
  /** A flat bonus for each full lap. */
  lapUtils: 15,
  /** Tolerance: each dose makes the fix wear off this much faster (up to `maxTolerance` times as fast). */
  tolerance: 0.025,
  maxTolerance: 2.2,
  /** Drugs inflate faster than scrap: their prices follow the price level to this power. */
  drugInflation: 1.4,
  copFallUtils: 3,
  dea: { first: 70, every: 60, spread: 40, seconds: 15, markup: 1.6 },
  maxCops: 3,
};

/** The Fed's schedule: a calm start, then booms and busts, announced a few seconds ahead. */
export const SCHEDULE = { calm: 30, boom: 45, bust: 35, warn: 8, lag: 12 };

export type Phase = 'calm' | 'boom' | 'bust';

export interface PhaseInfo {
  phase: Phase;
  /** Which boom/bust cycle (0 for the first; -1 during the calm start). */
  cycle: number;
  into: number;
  length: number;
}

export function phaseAt(t: number): PhaseInfo {
  if (t < SCHEDULE.calm) return { phase: 'calm', cycle: -1, into: Math.max(0, t), length: SCHEDULE.calm };
  const period = SCHEDULE.boom + SCHEDULE.bust;
  const cycle = Math.floor((t - SCHEDULE.calm) / period);
  const r = t - SCHEDULE.calm - cycle * period;
  return r < SCHEDULE.boom
    ? { phase: 'boom', cycle, into: r, length: SCHEDULE.boom }
    : { phase: 'bust', cycle, into: r - SCHEDULE.boom, length: SCHEDULE.bust };
}

/** The federal funds rate the Fed sets for a phase (busts get harsher each cycle). */
export function rateFor(p: PhaseInfo): number {
  if (p.phase === 'calm') return 2.5;
  if (p.phase === 'boom') return 0.25;
  return Math.min(9, 5.25 + 0.75 * p.cycle);
}

const peakFor = (cycle: number) => 2.2 + 0.2 * cycle;

/** How much scrap is worth compared with normal: a bubble through the boom, a crash at the start of the bust. */
export function scrapMultiplier(t: number): number {
  const p = phaseAt(t);
  if (p.phase === 'calm') return 1;
  const u = p.into / p.length;
  if (p.phase === 'boom') return 1 + (peakFor(p.cycle) - 1) * u ** 1.6;
  const crash = 4;
  if (p.into < crash) return peakFor(p.cycle) + (0.35 - peakFor(p.cycle)) * (p.into / crash);
  return 0.35 + 0.65 * ((p.into - crash) / (p.length - crash));
}

export type Yard = 'yard-near' | 'yard-far';
export type Drug = 'heroin' | 'crack';
export type GearId = 'crowbar' | 'cart' | 'vest' | 'bike';

export interface Gear {
  id: GearId;
  icon: string;
  name: string;
  description: string;
  price: number;
}

/** Capital goods: money you don't spend on drugs now, to get more covers later. */
export const GEAR: readonly Gear[] = [
  { id: 'crowbar', icon: '🪛', name: 'Crowbar', description: 'Pry covers in half the time.', price: 50 },
  { id: 'cart', icon: '🛒', name: 'Shopping Cart', description: 'Carry 3 covers, and barely slow down.', price: 80 },
  { id: 'vest', icon: '🦺', name: 'Hi-Vis Vest', description: 'Crews and passers-by assume you work here. Cops, less so.', price: 70 },
  { id: 'bike', icon: '🚲', name: 'Bike', description: 'Get around 45% faster.', price: 120 },
];

export interface Mover {
  x: number;
  y: number;
  /** Tiles still to walk to, in order. */
  path: Tile[];
}

export type ManholeState = 'paved' | 'covered' | 'open';

export interface Manhole {
  id: number;
  x: number;
  y: number;
  state: ManholeState;
  /** When it was opened (so crews fix the oldest first), and whether you did it. */
  openedAt: number;
  yours: boolean;
}

export type AgentKind = 'cop' | 'ped' | 'crew';

export interface Agent {
  id: number;
  kind: AgentKind;
  mover: Mover;
  /** A cop climbing out of a manhole: seconds left. */
  down: number;
  /** Crews: the manhole they're heading to, seconds of work left there, and whether they're going home. */
  target: number | null;
  work: number;
  leaving: boolean;
  /** Looks (shirt color etc.). */
  variant: number;
}

export interface Player {
  mover: Mover;
  /** Walking to a tapped spot (instead of following the keys). */
  walking: boolean;
  /** Prying a cover: which manhole, seconds left. */
  pry: { id: number; left: number } | null;
  /** Seconds of heroin nod / crack rush left. */
  nod: number;
  rush: number;
}

export interface Sample {
  near: number;
  far: number;
  heroin: number;
  crack: number;
}

export type OverReason = 'withdrawal' | 'arrested';

export interface GameState {
  time: number;
  cash: number;
  /** 1 = just fixed, 0 = game over. */
  fix: number;
  /** 0..100: at 100 you're arrested. */
  heat: number;
  utils: number;
  carried: number;
  stash: number;
  gear: Record<GearId, boolean>;
  priceLevel: number;
  phase: Phase;
  cycle: number;
  rate: number;
  /** The phase change that was last announced in advance (so it's announced once). */
  warnedFor: number;
  /** A DEA raid: seconds left, and when the next one comes. */
  dea: number;
  nextDeaAt: number;
  player: Player;
  manholes: Manhole[];
  agents: Agent[];
  nextId: number;
  nextCrewAt: number;
  pedRespawns: number[];
  /** The meme's loop: the next step you need (0 steal, 1 sell, 2 buy, 3 replaced), and laps done. */
  step: number;
  laps: number;
  history: Sample[];
  nextSampleAt: number;
  lastSeenEvent: number;
  warnedWithdrawal: boolean;
  warnedHeat: boolean;
  stats: { stolen: number; sold: number; doses: number; earned: number; pedsFell: number; copsFell: number; bustsSurvived: number };
  over: OverReason | null;
}

export type GameEvent =
  | { type: 'pry-start' }
  | { type: 'pry-cancel' }
  | { type: 'stole'; underCrewsNose: boolean }
  | { type: 'sold'; count: number; total: number; yard: Yard; price: number; otherPrice: number; multiplier: number }
  | { type: 'stashed'; count: number }
  | { type: 'took'; count: number }
  | { type: 'bought'; drug: Drug; price: number; dea: boolean }
  | { type: 'gear'; id: GearId }
  | { type: 'broke'; price: number }
  | { type: 'replaced'; yours: boolean; x: number; y: number }
  | { type: 'new-covers'; count: number }
  | { type: 'phase'; phase: Phase; rate: number; cycle: number }
  | { type: 'fomc'; next: Phase; seconds: number }
  | { type: 'fell'; who: 'cop' | 'ped'; x: number; y: number }
  | { type: 'step'; step: number }
  | { type: 'lap'; laps: number; bonus: number }
  | { type: 'dea' }
  | { type: 'seen'; by: AgentKind }
  | { type: 'withdrawal' }
  | { type: 'heat' }
  | { type: 'cop-joins' }
  | { type: 'over'; reason: OverReason };

export interface Input {
  /** The direction held on the keyboard / d-pad, or null. */
  dir: Tile | null;
}

const PED_COUNT = 4;

function randomRoad(rng: () => number): Tile {
  return ROAD_TILES[Math.floor(rng() * ROAD_TILES.length)];
}

function makeAgent(state: GameState, kind: AgentKind, at: Tile, variant = 0): Agent {
  return { id: state.nextId++, kind, mover: { x: at.x, y: at.y, path: [] }, down: 0, target: null, work: 0, leaving: false, variant };
}

export function newGame(rng: () => number = Math.random): GameState {
  const state: GameState = {
    time: 0,
    cash: CONFIG.startCash,
    fix: 1,
    heat: 0,
    utils: 0,
    carried: 0,
    stash: 0,
    gear: { crowbar: false, cart: false, vest: false, bike: false },
    priceLevel: 1,
    phase: 'calm',
    cycle: -1,
    rate: 2.5,
    warnedFor: -1,
    dea: 0,
    nextDeaAt: CONFIG.dea.first,
    // You start at your squat's door.
    player: { mover: { x: 4, y: 5, path: [] }, walking: false, pry: null, nod: 0, rush: 0 },
    manholes: MANHOLE_SLOTS.map((t, i) => ({ id: i, x: t.x, y: t.y, state: i < STARTING_SLOTS ? 'covered' : 'paved', openedAt: 0, yours: false })),
    agents: [],
    nextId: 100,
    nextCrewAt: 8,
    pedRespawns: [],
    step: 0,
    laps: 0,
    history: [],
    nextSampleAt: 0,
    lastSeenEvent: -99,
    warnedWithdrawal: false,
    warnedHeat: false,
    stats: { stolen: 0, sold: 0, doses: 0, earned: 0, pedsFell: 0, copsFell: 0, bustsSurvived: 0 },
    over: null,
  };
  state.agents.push(makeAgent(state, 'cop', { x: 16, y: 1 }));
  for (let i = 0; i < PED_COUNT; i++) state.agents.push(makeAgent(state, 'ped', randomRoad(rng), i));
  sample(state);
  return state;
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

/** What a yard pays for one cover right now (the far one is a few seconds behind the news). */
export function scrapPrice(state: GameState, yard: Yard, t = state.time): number {
  const lag = yard === 'yard-far' ? SCHEDULE.lag : 0;
  const wobble = 1 + 0.05 * Math.sin(t * 0.7 + (yard === 'yard-far' ? 2 : 0));
  return CONFIG.baseScrap * state.priceLevel * scrapMultiplier(t - lag) * wobble;
}

export function drugPrice(state: GameState, drug: Drug, t = state.time): number {
  const wobble = 1 + 0.08 * Math.sin(t * (drug === 'heroin' ? 0.5 : 0.63) + (drug === 'heroin' ? 0 : 1));
  return CONFIG[drug].price * state.priceLevel ** CONFIG.drugInflation * wobble * (state.dea > 0 ? CONFIG.dea.markup : 1);
}

export const gearPrice = (state: GameState, id: GearId) => GEAR.find((g) => g.id === id)!.price * state.priceLevel;

/** Inflation per second, by phase. */
const INFLATION: Record<Phase, number> = { calm: 0.002, boom: 0.006, bust: 0.001 };

function sample(state: GameState) {
  state.history.push({
    near: scrapPrice(state, 'yard-near'),
    far: scrapPrice(state, 'yard-far'),
    heroin: drugPrice(state, 'heroin'),
    crack: drugPrice(state, 'crack'),
  });
  if (state.history.length > 80) state.history.shift();
}

// ---------------------------------------------------------------------------
// Moving
// ---------------------------------------------------------------------------

export const tileOf = (m: Mover): Tile => ({ x: Math.round(m.x), y: Math.round(m.y) });
const distTo = (m: Mover, t: Tile) => Math.hypot(m.x - t.x, m.y - t.y);
/** Standing on a tile (close enough to its center to use it). */
const standingOn = (m: Mover, t: Tile) => distTo(m, t) < 0.35;

/** Walks along the path; returns the tiles reached on the way. */
function walk(m: Mover, dist: number): Tile[] {
  const reached: Tile[] = [];
  while (dist > 0 && m.path.length) {
    const t = m.path[0];
    const d = distTo(m, t);
    if (d <= dist) {
      m.x = t.x;
      m.y = t.y;
      dist -= d;
      m.path.shift();
      reached.push(t);
    } else {
      m.x += ((t.x - m.x) / d) * dist;
      m.y += ((t.y - m.y) / d) * dist;
      dist = 0;
    }
  }
  return reached;
}

export function playerSpeed(state: GameState): number {
  const p = state.player;
  let speed = CONFIG.speed;
  if (state.gear.bike) speed *= CONFIG.bikeSpeed;
  if (p.nod > 0) speed *= CONFIG.nodSpeed;
  else if (p.rush > 0) speed *= CONFIG.rushSpeed;
  if (state.carried > 0) speed *= state.gear.cart ? 1 - CONFIG.cartSpeedPerCover * state.carried : CONFIG.carrySpeed;
  if (state.fix < CONFIG.withdrawal) speed *= CONFIG.withdrawalSpeed;
  return speed;
}

/** How much faster the fix wears off than at first. */
export const tolerance = (state: GameState) => Math.min(CONFIG.maxTolerance, 1 + CONFIG.tolerance * state.stats.doses);

export const capacity = (state: GameState) => (state.gear.cart ? 3 : 1);

/** Tap/click: walk to a street tile. */
export function walkTo(state: GameState, target: Tile): void {
  const m = state.player.mover;
  // Finish the step you're on first, then take the shortest way.
  const start = m.path.length ? m.path[0] : tileOf(m);
  const rest = findPath(start, target);
  m.path = m.path.length ? [m.path[0], ...rest] : rest;
  state.player.walking = m.path.length > 0;
}

function movePlayer(state: GameState, input: Input, dt: number) {
  const p = state.player;
  const m = p.mover;
  if (input.dir) {
    p.walking = false;
    const d = input.dir;
    if (m.path.length) {
      // Turning back mid-step: go back to the tile you came from.
      const t = m.path[0];
      const mx = Math.sign(t.x - m.x);
      const my = Math.sign(t.y - m.y);
      if ((mx !== 0 && mx === -d.x) || (my !== 0 && my === -d.y)) m.path = [{ x: t.x - mx, y: t.y - my }];
      else m.path = [t];
    }
  } else if (!p.walking) {
    // Keys let go: stop at the next tile.
    m.path = m.path.slice(0, 1);
  }
  let dist = playerSpeed(state) * dt;
  // Keep going with the keys held: at each tile, take the next one in that direction.
  for (let guard = 0; guard < 4 && dist > 0; guard++) {
    if (!m.path.length && input.dir) {
      const here = tileOf(m);
      const next = { x: here.x + input.dir.x, y: here.y + input.dir.y };
      if (!isRoad(next.x, next.y)) break;
      m.path = [next];
    }
    if (!m.path.length) break;
    const before = { x: m.x, y: m.y };
    walk(m, dist);
    dist -= Math.hypot(m.x - before.x, m.y - before.y);
    if (m.path.length) break;
  }
  if (!m.path.length) p.walking = false;
}

// ---------------------------------------------------------------------------
// What you can do where you stand
// ---------------------------------------------------------------------------

export type Context =
  | { kind: 'pry'; manhole: Manhole }
  | { kind: 'prying' }
  | { kind: 'full' }
  | { kind: 'sell'; yard: Yard }
  | { kind: 'nothing-to-sell'; yard: Yard }
  | { kind: 'stash' }
  | { kind: 'dealer' }
  | { kind: 'hardware' }
  | null;

export function context(state: GameState): Context {
  const p = state.player;
  if (p.pry) return { kind: 'prying' };
  const here = tileOf(p.mover);
  if (!standingOn(p.mover, here)) return null;
  const manhole = state.manholes.find((h) => h.state === 'covered' && sameTile(h, here));
  if (manhole) return state.carried >= capacity(state) ? { kind: 'full' } : { kind: 'pry', manhole };
  const place = placeAtDoor(here);
  if (!place) return null;
  if (place.id === 'yard-near' || place.id === 'yard-far') return state.carried > 0 ? { kind: 'sell', yard: place.id } : { kind: 'nothing-to-sell', yard: place.id };
  if (place.id === 'squat') return { kind: 'stash' };
  if (place.id === 'dealer') return { kind: 'dealer' };
  if (place.id === 'hardware') return { kind: 'hardware' };
  return null;
}

function advanceStep(state: GameState, done: number, events: GameEvent[]) {
  if (state.step !== done) return;
  if (done < 3) {
    state.step = done + 1;
    events.push({ type: 'step', step: state.step });
    return;
  }
  state.step = 0;
  state.laps++;
  const bonus = CONFIG.lapUtils;
  state.utils += bonus;
  events.push({ type: 'lap', laps: state.laps, bonus });
}

/** The action key (E / Space / the button): pry, sell, stash or take. */
export function act(state: GameState): GameEvent[] {
  if (state.over) return [];
  const events: GameEvent[] = [];
  const c = context(state);
  if (!c) return events;
  if (c.kind === 'pry') {
    state.player.pry = { id: c.manhole.id, left: state.gear.crowbar ? CONFIG.crowbarPryTime : CONFIG.pryTime };
    events.push({ type: 'pry-start' });
  } else if (c.kind === 'sell') {
    const other: Yard = c.yard === 'yard-near' ? 'yard-far' : 'yard-near';
    const price = scrapPrice(state, c.yard);
    const total = price * state.carried;
    events.push({ type: 'sold', count: state.carried, total, yard: c.yard, price, otherPrice: scrapPrice(state, other), multiplier: scrapMultiplier(state.time - (c.yard === 'yard-far' ? SCHEDULE.lag : 0)) });
    state.cash += total;
    state.stats.sold += state.carried;
    state.stats.earned += total;
    state.carried = 0;
    advanceStep(state, 1, events);
  } else if (c.kind === 'stash') {
    if (state.carried > 0) {
      events.push({ type: 'stashed', count: state.carried });
      state.stash += state.carried;
      state.carried = 0;
    } else if (state.stash > 0) {
      const count = Math.min(capacity(state), state.stash);
      state.stash -= count;
      state.carried += count;
      events.push({ type: 'took', count });
    }
  }
  return events;
}

export function buyDrug(state: GameState, drug: Drug): GameEvent[] {
  if (state.over || context(state)?.kind !== 'dealer') return [];
  const price = drugPrice(state, drug);
  if (state.cash < price) return [{ type: 'broke', price }];
  const events: GameEvent[] = [];
  const spec = CONFIG[drug];
  state.cash -= price;
  state.fix = Math.min(1, state.fix + spec.fix);
  state.utils += spec.utils;
  state.stats.doses++;
  state.warnedWithdrawal = false;
  if (drug === 'heroin') {
    state.player.nod = spec.seconds;
    state.player.rush = 0;
  } else {
    state.player.rush = spec.seconds;
    state.player.nod = 0;
  }
  events.push({ type: 'bought', drug, price, dea: state.dea > 0 });
  advanceStep(state, 2, events);
  return events;
}

export function buyGear(state: GameState, id: GearId): GameEvent[] {
  if (state.over || context(state)?.kind !== 'hardware' || state.gear[id]) return [];
  const price = gearPrice(state, id);
  if (state.cash < price) return [{ type: 'broke', price }];
  state.cash -= price;
  state.gear[id] = true;
  return [{ type: 'gear', id }];
}

// ---------------------------------------------------------------------------
// The city: cops, passers-by and City Works
// ---------------------------------------------------------------------------

const openManholeAt = (state: GameState, t: Tile) => state.manholes.find((h) => h.state === 'open' && sameTile(h, t));

function crewLimits(phase: Phase) {
  if (phase === 'boom') return { max: 3, every: 4 };
  if (phase === 'bust') return { max: 1, every: 30 };
  return { max: 1, every: 9 };
}

/** The oldest open manhole no crew is on its way to. */
function nextJob(state: GameState): Manhole | null {
  const taken = new Set(state.agents.filter((a) => a.kind === 'crew' && a.target !== null).map((a) => a.target));
  return state.manholes.filter((h) => h.state === 'open' && !taken.has(h.id)).sort((a, b) => a.openedAt - b.openedAt)[0] ?? null;
}

function updateAgents(state: GameState, dt: number, rng: () => number, events: GameEvent[]) {
  const gone = new Set<number>();
  for (const a of state.agents) {
    if (a.down > 0) {
      a.down = Math.max(0, a.down - dt);
      continue;
    }
    if (a.kind === 'crew') {
      updateCrew(state, a, dt, events, gone);
      continue;
    }
    if (!a.mover.path.length) a.mover.path = findPath(tileOf(a.mover), randomRoad(rng));
    const reached = walk(a.mover, (a.kind === 'cop' ? CONFIG.copSpeed : CONFIG.pedSpeed) * dt);
    for (const t of reached) {
      if (!openManholeAt(state, t)) continue;
      // Some look where they're going.
      if (rng() > (a.kind === 'cop' ? 0.5 : 0.6)) continue;
      events.push({ type: 'fell', who: a.kind, x: t.x, y: t.y });
      a.mover.path = [];
      if (a.kind === 'cop') {
        a.down = CONFIG.copDownSeconds;
        state.stats.copsFell++;
        state.utils += CONFIG.copFallUtils;
      } else {
        gone.add(a.id);
        state.pedRespawns.push(state.time + CONFIG.pedRespawn);
        state.stats.pedsFell++;
        state.heat = Math.min(100, state.heat + CONFIG.fallHeat);
      }
      break;
    }
  }
  if (gone.size) state.agents = state.agents.filter((a) => !gone.has(a.id));
  // Passers-by who fell in come back after a while (from the edge of town).
  const due = state.pedRespawns.filter((t) => t <= state.time);
  if (due.length) {
    state.pedRespawns = state.pedRespawns.filter((t) => t > state.time);
    for (let i = 0; i < due.length; i++) state.agents.push(makeAgent(state, 'ped', rng() < 0.5 ? { x: 0, y: 9 } : { x: COLS - 1, y: 1 }, Math.floor(rng() * PED_COUNT)));
  }
  // City Works sends trucks for open manholes.
  if (state.time >= state.nextCrewAt) {
    const limits = crewLimits(state.phase);
    state.nextCrewAt = state.time + limits.every;
    const crews = state.agents.filter((a) => a.kind === 'crew' && !a.leaving).length;
    const job = nextJob(state);
    if (job && crews < limits.max) {
      const crew = makeAgent(state, 'crew', DEPOT);
      crew.target = job.id;
      crew.mover.path = findPath(DEPOT, job);
      state.agents.push(crew);
    }
  }
}

function updateCrew(state: GameState, a: Agent, dt: number, events: GameEvent[], gone: Set<number>) {
  if (a.leaving) {
    walk(a.mover, CONFIG.crewSpeed * dt);
    if (!a.mover.path.length) gone.add(a.id);
    return;
  }
  const job = state.manholes.find((h) => h.id === a.target);
  if (!job || job.state !== 'open') {
    a.target = null;
  } else if (a.mover.path.length) {
    walk(a.mover, CONFIG.crewSpeed * dt);
    if (!a.mover.path.length) a.work = CONFIG.crewWork;
    return;
  } else if (a.work > 0) {
    a.work -= dt;
    if (a.work > 0) return;
    job.state = 'covered';
    events.push({ type: 'replaced', yours: job.yours, x: job.x, y: job.y });
    if (job.yours) advanceStep(state, 3, events);
    job.yours = false;
    a.target = null;
  }
  // Next job, or back to the depot.
  const next = a.target === null ? nextJob(state) : null;
  if (next) {
    a.target = next.id;
    a.mover.path = findPath(tileOf(a.mover), next);
    if (!a.mover.path.length) a.work = CONFIG.crewWork;
  } else if (a.target === null) {
    a.leaving = true;
    a.mover.path = findPath(tileOf(a.mover), DEPOT);
  }
}

/** Heat from whoever's watching: prying in plain sight, or carrying covers past a cop. */
function watchers(state: GameState): { gain: number; by: AgentKind | null; crewNear: boolean } {
  const p = state.player;
  const prying = p.pry !== null;
  let gain = 0;
  let by: AgentKind | null = null;
  let crewNear = false;
  const vest = state.gear.vest;
  for (const a of state.agents) {
    if (a.down > 0) continue;
    const d = Math.hypot(a.mover.x - p.mover.x, a.mover.y - p.mover.y);
    if (a.kind === 'crew' && d <= CONFIG.crewSight) crewNear = true;
    if (a.kind === 'cop' && d <= CONFIG.copSight) {
      const g = (prying ? CONFIG.copHeat : 0) + CONFIG.carryHeat * state.carried;
      const seen = vest ? g * 0.5 : g;
      if (seen > 0) {
        gain += seen;
        by = 'cop';
      }
    } else if (prying && !vest && a.kind === 'crew' && d <= CONFIG.crewSight) {
      gain += CONFIG.crewHeat;
      by ??= 'crew';
    } else if (prying && !vest && a.kind === 'ped' && d <= CONFIG.pedSight) {
      gain += CONFIG.pedHeat;
      by ??= 'ped';
    }
  }
  return { gain, by, crewNear };
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------

export function update(state: GameState, input: Input, dt: number, rng: () => number = Math.random): GameEvent[] {
  if (state.over) return [];
  const events: GameEvent[] = [];
  state.time += dt;
  const t = state.time;

  // The Fed
  const info = phaseAt(t);
  const upcoming = phaseAt(t + SCHEDULE.warn);
  const boundary = upcoming.phase === 'calm' ? -1 : upcoming.cycle * 2 + (upcoming.phase === 'bust' ? 1 : 0);
  if (upcoming.phase !== info.phase && boundary !== state.warnedFor) {
    state.warnedFor = boundary;
    events.push({ type: 'fomc', next: upcoming.phase, seconds: SCHEDULE.warn });
  }
  if (info.phase !== state.phase) {
    if (state.phase === 'bust') state.stats.bustsSurvived++;
    state.phase = info.phase;
    state.cycle = info.cycle;
    state.rate = rateFor(info);
    events.push({ type: 'phase', phase: info.phase, rate: state.rate, cycle: info.cycle });
    if (info.phase === 'boom') {
      // Infrastructure bill: new manholes all over town.
      const paved = state.manholes.filter((h) => h.state === 'paved').slice(0, 3);
      for (const h of paved) h.state = 'covered';
      if (paved.length) events.push({ type: 'new-covers', count: paved.length });
    } else if (info.phase === 'bust' && state.agents.filter((a) => a.kind === 'cop').length < CONFIG.maxCops) {
      // Tough times: more police.
      state.agents.push(makeAgent(state, 'cop', { x: 0, y: 1 }));
      events.push({ type: 'cop-joins' });
    }
  }
  state.priceLevel *= 1 + INFLATION[state.phase] * dt;

  // The DEA
  if (state.dea > 0) state.dea = Math.max(0, state.dea - dt);
  else if (t >= state.nextDeaAt) {
    state.dea = CONFIG.dea.seconds;
    state.nextDeaAt = t + CONFIG.dea.every + rng() * CONFIG.dea.spread;
    events.push({ type: 'dea' });
  }

  // Your body
  const p = state.player;
  state.fix = Math.max(0, state.fix - (dt / CONFIG.fixSeconds) * tolerance(state));
  p.nod = Math.max(0, p.nod - dt);
  p.rush = Math.max(0, p.rush - dt);
  if (state.fix < CONFIG.withdrawal && !state.warnedWithdrawal) {
    state.warnedWithdrawal = true;
    events.push({ type: 'withdrawal' });
  }

  // Walking, and prying
  movePlayer(state, input, dt);
  if (p.pry) {
    const h = state.manholes.find((m) => m.id === p.pry!.id)!;
    if (!standingOn(p.mover, h) || h.state !== 'covered') {
      p.pry = null;
      events.push({ type: 'pry-cancel' });
    } else {
      p.pry.left -= dt;
      if (p.pry.left <= 0) {
        p.pry = null;
        h.state = 'open';
        h.openedAt = t;
        h.yours = true;
        state.carried++;
        state.stats.stolen++;
        events.push({ type: 'stole', underCrewsNose: state.gear.vest && watchers(state).crewNear });
        advanceStep(state, 0, events);
      }
    }
  }

  updateAgents(state, dt, rng, events);

  // Heat
  const watch = watchers(state);
  if (watch.gain > 0) {
    state.heat = Math.min(100, state.heat + watch.gain * dt);
    if (watch.by && t - state.lastSeenEvent > 2) {
      state.lastSeenEvent = t;
      events.push({ type: 'seen', by: watch.by });
    }
  } else {
    state.heat = Math.max(0, state.heat - CONFIG.heatDecay * dt);
  }
  if (state.heat >= 70 && !state.warnedHeat) {
    state.warnedHeat = true;
    events.push({ type: 'heat' });
  } else if (state.heat < 50) {
    state.warnedHeat = false;
  }

  if (t >= state.nextSampleAt) {
    state.nextSampleAt = t + 0.5;
    sample(state);
  }

  if (state.heat >= 100) state.over = 'arrested';
  else if (state.fix <= 0) state.over = 'withdrawal';
  if (state.over) events.push({ type: 'over', reason: state.over });
  return events;
}
