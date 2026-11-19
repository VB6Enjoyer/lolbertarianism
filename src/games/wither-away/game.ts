// The simulation: one libertarian on an endless plane, statists coming from every side. Call
// step() sixty times a second with where the player is pushing; it moves everyone, fires the
// weapons at whoever's nearest (auto-aim), collects XP and stops for a level-up offer. No DOM, and
// seeded, so tests and the balance bot can replay runs exactly.

import {
  BOSS_AT, CHARACTERS, type CharacterId, ENEMIES, type EnemyId, EVOLUTIONS, LOCKED_CARDS, MAX_LEVEL, PASSIVE_SLOTS, type PassiveId, PASSIVES, POOL_WEAPONS,
  RUN_LENGTH, WEAPON_SLOTS, WEAPON_STATS, type WeaponId,
} from './data.ts';
import { makeRng, next, pickOne, type Rng, weighted } from './rng.ts';

export const DT = 1 / 60;
export const PLAYER_RADIUS = 16;
/** Where new statists appear: a ring this far from you (just off screen). */
export const SPAWN_DISTANCE = 720;
export const MAX_ENEMIES = 380;
/** How fast a fascist charges. */
export const FASCIST_DASH = 240;
const CELL = 64;

export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  magnet: number;
  xpMult: number;
  regen: number;
  /** Seconds of safety left after a hit. */
  iframes: number;
  /** Which way he faces (for the sprite), and where he's aiming (for the gun). */
  facing: 1 | -1;
  aim: number;
}

export interface Enemy {
  id: number;
  type: EnemyId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  /** Knockback, decaying. */
  kx: number;
  ky: number;
  /** Seconds left of the hit flash, and a timer for whatever it does (red tape, balloons…). */
  flash: number;
  timer: number;
  /** XP the taxman has grabbed (he drops it when he dies). */
  stolen: number;
  dead: boolean;
  /** The fascist's charge: winding up (seconds left), then dashing (seconds left) in a fixed direction. */
  windup?: number;
  dash?: number;
  dx?: number;
  dy?: number;
}

export interface Shot {
  id: number;
  kind: 'coin' | 'bar' | 'pellet' | 'bullet' | 'signal' | 'laffer';
  /** Which weapon fired it (for the damage tally). */
  from: WeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: number;
  radius: number;
  life: number;
  knockback: number;
  /** Enemies already hit (each shot hits each enemy once; a Laffer curve once per pass). */
  hit: number[];
  /** The Laffer curve: where it started, its age, and its angle; a signal's target. */
  ox?: number;
  oy?: number;
  age?: number;
  angle?: number;
  target?: number;
}

/** Inflation balloons from the Central Bank. */
export interface FoeShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
}

export interface Pickup {
  id: number;
  kind: 'xp' | 'gold' | 'heal' | 'magnet' | 'chest';
  x: number;
  y: number;
  value: number;
  /** Pulled towards you once in range. */
  pulled: boolean;
}

export interface OwnedWeapon {
  id: WeaponId;
  level: number;
  cooldown: number;
  /** The Invisible Hand's spin, and when each enemy was last slapped. */
  angle: number;
  lastHit: Record<number, number>;
  /** NEIN NEIN NEIN: the waves still to come in this volley, and the time to the next. */
  waves?: number;
  waveT?: number;
}

export interface OwnedPassive {
  id: PassiveId;
  level: number;
}

export type Offer =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number }
  | { kind: 'evolve'; id: WeaponId; from: WeaponId }
  | { kind: 'heal' }
  | { kind: 'gold' };

/** Things that happened this step, for the screen and the speakers. */
export type Fx =
  | { kind: 'hit'; x: number; y: number; amount: number; from: WeaponId }
  | { kind: 'kill'; x: number; y: number; type: EnemyId }
  | { kind: 'hurt'; amount: number }
  | { kind: 'nein'; x: number; y: number; radius: number }
  | { kind: 'boom'; x: number; y: number; radius: number }
  | { kind: 'zap'; points: [number, number][] }
  | { kind: 'evolve'; weapon: WeaponId }
  | { kind: 'shoot'; weapon: WeaponId }
  | { kind: 'pickup'; pickup: Pickup['kind'] }
  | { kind: 'level' }
  | { kind: 'boss' }
  | { kind: 'revolution' }
  | { kind: 'wither' };

export interface Game {
  seed: number;
  rng: Rng;
  character: CharacterId;
  time: number;
  player: Player;
  level: number;
  xp: number;
  next: number;
  kills: number;
  gold: number;
  weapons: OwnedWeapon[];
  passives: OwnedPassive[];
  enemies: Enemy[];
  shots: Shot[];
  foeShots: FoeShot[];
  pickups: Pickup[];
  /** Level-ups waiting, and the cards on offer for the first one (null: playing). */
  pending: number;
  offer: Offer[] | null;
  over: null | 'won' | 'lost';
  fx: Fx[];
  nextId: number;
  spawnAcc: number;
  events: { boss: boolean; revolution1: boolean; revolution2: boolean };
  /** Damage dealt by each weapon, for the end screen. */
  damageBy: Partial<Record<WeaponId, number>>;
  /** What the shop bought before the run (and the difficulty chosen). */
  mods: Mods;
  /** Shop cards that may turn up on a level-up. */
  unlocked: (WeaponId | PassiveId)[];
  /** Whether the shop's weapon upgrade for this character has been bought. */
  canEvolve: boolean;
  /** Level-up rerolls left. */
  rerolls: number;
}

/**
 * Everything the shop (and the difficulty) changes about a run, as multipliers and bonuses. The
 * defaults change nothing.
 */
export interface Mods {
  maxHp: number;
  damage: number;
  speed: number;
  magnet: number;
  xp: number;
  armor: number;
  rerolls: number;
  /** Bitcoin multiplier (the shop's Gold Rush and the difficulty bonus together). */
  gold: number;
  enemyHp: number;
  enemySpeed: number;
  spawns: number;
  /** How much harder statists hit you. */
  hurt: number;
}

export const NO_MODS: Mods = { maxHp: 0, damage: 1, speed: 1, magnet: 1, xp: 1, armor: 0, rerolls: 0, gold: 1, enemyHp: 1, enemySpeed: 1, spawns: 1, hurt: 1 };

export interface Setup {
  mods?: Partial<Mods>;
  unlocked?: (WeaponId | PassiveId)[];
  canEvolve?: boolean;
}

/** XP for the next level. */
export const xpFor = (level: number) => Math.round(4 + level * 3 + level * level * 0.3);

export function newGame(seed: number, character: CharacterId, setup: Setup = {}): Game {
  const c = CHARACTERS[character];
  const mods: Mods = { ...NO_MODS, ...setup.mods };
  const hp = c.hp + mods.maxHp;
  const g: Game = {
    seed,
    rng: makeRng(seed),
    character,
    time: 0,
    player: {
      x: 0, y: 0, hp, maxHp: hp, speed: c.speed * mods.speed, armor: c.armor + mods.armor, magnet: c.magnet * mods.magnet, xpMult: c.xpMult * mods.xp, regen: 0, iframes: 0, facing: 1, aim: 0,
    },
    level: 1,
    xp: 0,
    next: xpFor(1),
    kills: 0,
    gold: 0,
    weapons: [],
    passives: [],
    enemies: [],
    shots: [],
    foeShots: [],
    pickups: [],
    pending: 0,
    offer: null,
    over: null,
    fx: [],
    nextId: 1,
    spawnAcc: 0,
    events: { boss: false, revolution1: false, revolution2: false },
    damageBy: {},
    mods,
    unlocked: [...(setup.unlocked ?? [])],
    canEvolve: setup.canEvolve === true,
    rerolls: mods.rerolls,
  };
  addWeapon(g, c.weapon);
  return g;
}

// ---------------------------------------------------------------------------
// Owning things
// ---------------------------------------------------------------------------

export const weaponLevel = (g: Game, id: WeaponId) => g.weapons.find((w) => w.id === id)?.level ?? 0;
export const passiveLevel = (g: Game, id: PassiveId) => g.passives.find((p) => p.id === id)?.level ?? 0;

function addWeapon(g: Game, id: WeaponId) {
  const owned = g.weapons.find((w) => w.id === id);
  if (owned) owned.level = Math.min(MAX_LEVEL, owned.level + 1);
  else g.weapons.push({ id, level: 1, cooldown: 0.3, angle: 0, lastHit: {} });
}

function addPassive(g: Game, id: PassiveId) {
  const owned = g.passives.find((p) => p.id === id);
  if (owned) owned.level = Math.min(MAX_LEVEL, owned.level + 1);
  else g.passives.push({ id, level: 1 });
  const p = g.player;
  const c = CHARACTERS[g.character];
  const m = g.mods;
  const lv = passiveLevel(g, id);
  if (id === 'property') p.armor = c.armor + m.armor + lv;
  if (id === 'freetrade') p.magnet = c.magnet * m.magnet * (1 + 0.25 * lv);
  if (id === 'compound') p.xpMult = c.xpMult * m.xp * (1 + 0.1 * lv);
  if (id === 'exit') p.speed = c.speed * m.speed * (1 + 0.06 * lv);
  if (id === 'healthcare') {
    p.maxHp += 15;
    p.hp = Math.min(p.maxHp, p.hp + 15);
    p.regen = 0.3 * lv;
  }
}

/** Extra projectiles from Division of Labour: 1 at level 1, 2 at 3, 3 at 5. */
const extra = (g: Game) => Math.floor((passiveLevel(g, 'division') + 1) / 2);
/** How many Invisible Hands are circling (for the screen). */
export const handCount = (g: Game) => WEAPON_STATS.hand.count[weaponLevel(g, 'hand') - 1] + extra(g);
const cooldownMult = (g: Game) => 1 - 0.08 * passiveLevel(g, 'timepref');
/** Everything you hit, multiplied: the shop's Capital Accumulation and the Sound Money card. */
const damageMult = (g: Game) => g.mods.damage * (1 + 0.08 * passiveLevel(g, 'sound'));
const available = (g: Game, id: WeaponId | PassiveId) => !LOCKED_CARDS.includes(id) || g.unlocked.includes(id);

/** The weapon upgrade, if it's been bought and the starting weapon is at its last level. */
export function evolution(g: Game): Offer | null {
  if (!g.canEvolve) return null;
  const { from, to } = EVOLUTIONS[g.character];
  return weaponLevel(g, from) >= MAX_LEVEL ? { kind: 'evolve', id: to, from } : null;
}

/** Three cards for a level-up: new things while there's room, and upgrades. */
export function makeOffer(g: Game): Offer[] {
  const options: [Offer, number][] = [];
  for (const w of g.weapons) if (w.level < MAX_LEVEL) options.push([{ kind: 'weapon', id: w.id, level: w.level + 1 }, 3]);
  // New weapons come from the common pool: each character's starting weapon (and its upgrade) is theirs alone.
  if (g.weapons.length < WEAPON_SLOTS) for (const id of POOL_WEAPONS) if (!weaponLevel(g, id) && available(g, id)) options.push([{ kind: 'weapon', id, level: 1 }, 2]);
  for (const p of g.passives) if (p.level < MAX_LEVEL) options.push([{ kind: 'passive', id: p.id, level: p.level + 1 }, 2]);
  if (g.passives.length < PASSIVE_SLOTS) for (const id of Object.keys(PASSIVES) as PassiveId[]) if (!passiveLevel(g, id) && available(g, id)) options.push([{ kind: 'passive', id, level: 1 }, 2]);
  // The weapon upgrade, once it's ready, is always one of the three.
  const evolve = evolution(g);
  const picked: Offer[] = evolve ? [evolve] : [];
  while (picked.length < 3 && options.length) {
    const o = weighted(g.rng, options);
    picked.push(o);
    options.splice(options.findIndex(([x]) => x === o), 1);
  }
  if (!picked.length) return [{ kind: 'heal' }, { kind: 'gold' }];
  return picked;
}

/** Take a card. */
export function choose(g: Game, i: number): boolean {
  const o = g.offer?.[i];
  if (!o) return false;
  if (o.kind === 'weapon') addWeapon(g, o.id);
  else if (o.kind === 'passive') addPassive(g, o.id);
  else if (o.kind === 'evolve') {
    const w = g.weapons.find((x) => x.id === o.from);
    if (w) {
      w.id = o.id;
      w.cooldown = 0;
    }
    g.fx.push({ kind: 'evolve', weapon: o.id });
  }
  else if (o.kind === 'heal') g.player.hp = Math.min(g.player.maxHp, g.player.hp + g.player.maxHp * 0.3);
  else g.gold += 25;
  g.pending--;
  g.offer = g.pending > 0 ? makeOffer(g) : null;
  return true;
}

/** Swap the three cards for three others (the shop's Second Opinion). */
export function reroll(g: Game): boolean {
  if (!g.offer || g.rerolls <= 0) return false;
  g.rerolls--;
  g.offer = makeOffer(g);
  return true;
}

/** Bitcoin for a run: what you picked up, plus 1 for every six seconds you lasted and a bonus for winning, all multiplied by the shop and the difficulty. */
export function goldEarned(g: Game): { picked: number; survived: number; total: number } {
  const picked = g.gold;
  const survived = Math.floor(Math.min(RUN_LENGTH, g.time) / 6) + (g.over === 'won' ? 100 : 0);
  return { picked, survived, total: Math.round((picked + survived) * g.mods.gold) };
}

// ---------------------------------------------------------------------------
// The grid: who's near whom
// ---------------------------------------------------------------------------

type Grid = Map<number, Enemy[]>;
const key = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);

function buildGrid(g: Game): Grid {
  const grid: Grid = new Map();
  for (const e of g.enemies) {
    if (e.dead) continue;
    const k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    const cell = grid.get(k);
    if (cell) cell.push(e);
    else grid.set(k, [e]);
  }
  return grid;
}

function near(grid: Grid, x: number, y: number, r: number, out: Enemy[] = []): Enemy[] {
  out.length = 0;
  const x0 = Math.floor((x - r) / CELL);
  const x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL);
  const y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const cell = grid.get(key(cx, cy));
      if (cell) for (const e of cell) if (!e.dead) out.push(e);
    }
  }
  return out;
}

function nearest(g: Game, x: number, y: number, maxDist = 900): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxDist * maxDist;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

export interface Input {
  /** Where the player is pushing, each from -1 to 1 (normalized here). */
  x: number;
  y: number;
}

export function step(g: Game, input: Input, dt = DT) {
  g.fx = [];
  if (g.over || g.offer) return;
  g.time += dt;
  const grid = buildGrid(g);
  movePlayer(g, input, dt);
  spawn(g, dt);
  fireWeapons(g, grid, dt);
  moveShots(g, grid, dt);
  moveEnemies(g, grid, dt);
  moveFoeShots(g, dt);
  collect(g, dt);
  g.enemies = g.enemies.filter((e) => !e.dead);
  if (g.player.hp <= 0) {
    g.player.hp = 0;
    g.over = 'lost';
    return;
  }
  if (g.time >= RUN_LENGTH) {
    // The state withers away, at last.
    for (const e of g.enemies) {
      e.dead = true;
      g.fx.push({ kind: 'kill', x: e.x, y: e.y, type: e.type });
    }
    g.enemies = [];
    g.fx.push({ kind: 'wither' });
    g.over = 'won';
    return;
  }
  if (g.pending > 0 && !g.offer) g.offer = makeOffer(g);
}

function movePlayer(g: Game, input: Input, dt: number) {
  const p = g.player;
  let { x, y } = input;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  p.x += x * p.speed * dt;
  p.y += y * p.speed * dt;
  if (x > 0.1) p.facing = 1;
  else if (x < -0.1) p.facing = -1;
  p.iframes = Math.max(0, p.iframes - dt);
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
}

// --- Spawning ---

/** How many statists a second, and how tough. */
export const spawnRate = (t: number) => 0.6 + t / 30;
export const hpScale = (t: number) => 1 + t / 150;

function spawnWeights(t: number): [EnemyId, number][] {
  const w: [EnemyId, number][] = [['communist', 10]];
  if (t > 50) w.push(['socialist', 3]);
  if (t > 110) w.push(['keynesian', 3]);
  if (t > 170) w.push(['fascist', 2.2]);
  if (t > 230) w.push(['taxman', 2]);
  if (t > BOSS_AT) for (const pair of w) if (pair[0] !== 'communist') pair[1] *= 1.6;
  return w;
}

export function spawnEnemy(g: Game, type: EnemyId, x: number, y: number): Enemy {
  const d = ENEMIES[type];
  const hp = Math.round(d.hp * (type === 'bank' ? 1 : hpScale(g.time)) * g.mods.enemyHp);
  const e: Enemy = { id: g.nextId++, type, x, y, hp, maxHp: hp, speed: d.speed * (0.92 + next(g.rng) * 0.16) * g.mods.enemySpeed, damage: d.damage, radius: d.radius, kx: 0, ky: 0, flash: 0, timer: next(g.rng) * 2, stolen: 0, dead: false };
  g.enemies.push(e);
  return e;
}

function ringPoint(g: Game, dist: number): [number, number] {
  const a = next(g.rng) * Math.PI * 2;
  return [g.player.x + Math.cos(a) * dist, g.player.y + Math.sin(a) * dist];
}

function spawn(g: Game, dt: number) {
  const t = g.time;
  if (!g.events.boss && t >= BOSS_AT) {
    g.events.boss = true;
    const [x, y] = ringPoint(g, SPAWN_DISTANCE * 0.8);
    spawnEnemy(g, 'bank', x, y);
    g.fx.push({ kind: 'boss' });
  }
  // The revolution: a ring of communists closing in from every side.
  for (const [flag, at] of [['revolution1', 150], ['revolution2', 450]] as const) {
    if (!g.events[flag] && t >= at) {
      g.events[flag] = true;
      const n = flag === 'revolution1' ? 32 : 48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        spawnEnemy(g, 'communist', g.player.x + Math.cos(a) * 560, g.player.y + Math.sin(a) * 560);
      }
      g.fx.push({ kind: 'revolution' });
    }
  }
  if (g.enemies.length >= MAX_ENEMIES) return;
  g.spawnAcc += spawnRate(t) * g.mods.spawns * dt;
  const weights = spawnWeights(t);
  while (g.spawnAcc >= 1) {
    g.spawnAcc -= 1;
    const [x, y] = ringPoint(g, SPAWN_DISTANCE + next(g.rng) * 120);
    const type = weighted(g.rng, weights);
    if (type === 'fascist') {
      // They march in squads: four abreast, side by side across your line.
      const a = Math.atan2(g.player.y - y, g.player.x - x) + Math.PI / 2;
      for (let i = 0; i < 4; i++) spawnEnemy(g, 'fascist', x + Math.cos(a) * (i - 1.5) * 38, y + Math.sin(a) * (i - 1.5) * 38);
      g.spawnAcc -= 3;
    } else spawnEnemy(g, type, x, y);
  }
}

// --- Damage ---

function damage(g: Game, e: Enemy, amount: number, from: WeaponId, kx = 0, ky = 0) {
  if (e.dead) return;
  const dealt = Math.round(amount * damageMult(g));
  e.hp -= dealt;
  e.flash = 0.12;
  if (e.type !== 'bank') {
    e.kx += kx;
    e.ky += ky;
  }
  g.damageBy[from] = (g.damageBy[from] ?? 0) + dealt;
  g.fx.push({ kind: 'hit', x: e.x, y: e.y - e.radius, amount: dealt, from });
  if (e.hp <= 0) kill(g, e);
}

function drop(g: Game, kind: Pickup['kind'], x: number, y: number, value: number) {
  g.pickups.push({ id: g.nextId++, kind, x: x + (next(g.rng) - 0.5) * 10, y: y + (next(g.rng) - 0.5) * 10, value, pulled: false });
}

function kill(g: Game, e: Enemy) {
  e.dead = true;
  g.kills++;
  g.fx.push({ kind: 'kill', x: e.x, y: e.y, type: e.type });
  const d = ENEMIES[e.type];
  drop(g, 'xp', e.x, e.y, d.xp + e.stolen);
  const roll = next(g.rng);
  if (roll < 0.025) drop(g, 'gold', e.x, e.y, 5);
  else if (roll < 0.031) drop(g, 'heal', e.x, e.y, 25);
  else if (roll < 0.0335) drop(g, 'magnet', e.x, e.y, 0);
  if (e.type === 'keynesian') for (let i = 0; i < 2; i++) spawnEnemy(g, 'stimulus', e.x + (i ? 12 : -12), e.y);
  if (e.type === 'bank') {
    drop(g, 'chest', e.x, e.y, 0);
    for (let i = 0; i < 6; i++) drop(g, 'gold', e.x + (i - 3) * 14, e.y + 20, 10);
  }
}

// --- Weapons (auto-aim: everything goes for whoever's nearest) ---

function shoot(g: Game, s: Omit<Shot, 'id' | 'hit'>) {
  g.shots.push({ ...s, id: g.nextId++, hit: [] });
}

function fireWeapons(g: Game, grid: Grid, dt: number) {
  const p = g.player;
  const target = nearest(g, p.x, p.y, 640);
  if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
  const cdm = cooldownMult(g);
  for (const w of g.weapons) {
    const L = w.level - 1;
    if (w.id === 'hand') {
      handTick(g, grid, w, dt);
      continue;
    }
    if (w.id === 'nap') {
      napTick(g, grid, w, dt);
      continue;
    }
    if (w.waves) {
      w.waveT = (w.waveT ?? 0) - dt;
      if (w.waveT <= 0) {
        const s = WEAPON_STATS.nein3;
        w.waves--;
        w.waveT = s.gap;
        shockwave(g, grid, s.radius[s.radius.length - 1 - w.waves], s.damage, s.knockback, 'nein3');
      }
    }
    w.cooldown -= dt;
    if (w.cooldown > 0) continue;
    switch (w.id) {
      case 'coins': {
        if (!target) continue;
        const s = WEAPON_STATS.coins;
        const n = s.count[L] + extra(g);
        for (let i = 0; i < n; i++) {
          const a = p.aim + (i - (n - 1) / 2) * 0.16;
          shoot(g, { kind: 'coin', from: 'coins', x: p.x, y: p.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, damage: s.damage[L], pierce: s.pierce[L], radius: 7, life: 1.4, knockback: 40 });
        }
        w.cooldown = s.cooldown[L] * cdm;
        break;
      }
      case 'goldbars': {
        if (!target) continue;
        const s = WEAPON_STATS.goldbars;
        const n = s.count + extra(g);
        for (let i = 0; i < n; i++) {
          const a = p.aim + (i - (n - 1) / 2) * 0.14;
          shoot(g, { kind: 'bar', from: 'goldbars', x: p.x, y: p.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, damage: s.damage, pierce: s.pierce, radius: 10, life: 1.4, knockback: 90 });
        }
        w.cooldown = s.cooldown * cdm;
        break;
      }
      case 'shotgun':
      case 'autoshotgun': {
        if (!target) continue;
        const auto = w.id === 'autoshotgun';
        const base = WEAPON_STATS.shotgun;
        const up = WEAPON_STATS.autoshotgun;
        const n = (auto ? up.count : base.count[L]) + extra(g) * 2;
        const spread = auto ? up.spread : base.spread;
        const speed = auto ? up.speed : base.speed;
        for (let i = 0; i < n; i++) {
          const a = p.aim + (i / (n - 1) - 0.5) * spread + (next(g.rng) - 0.5) * 0.05;
          const v = speed * (0.9 + next(g.rng) * 0.2);
          shoot(g, {
            kind: 'pellet', from: w.id, x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, damage: auto ? up.damage : base.damage[L], pierce: 0, radius: 5,
            life: auto ? up.life : base.life, knockback: auto ? up.knockback : base.knockback,
          });
        }
        w.cooldown = (auto ? up.cooldown : base.cooldown[L]) * cdm;
        break;
      }
      case 'ak':
      case 'm249': {
        if (!target) continue;
        const big = w.id === 'm249';
        const base = WEAPON_STATS.ak;
        const up = WEAPON_STATS.m249;
        const speed = big ? up.speed : base.speed;
        const a = p.aim + (next(g.rng) - 0.5) * (big ? up.jitter : base.jitter) * 2;
        shoot(g, {
          kind: 'bullet', from: w.id, x: p.x, y: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, damage: big ? up.damage : base.damage[L], pierce: big ? up.pierce : base.pierce[L],
          radius: big ? 5 : 4, life: 1.1, knockback: big ? 24 : 18,
        });
        w.cooldown = (big ? up.cooldown : base.cooldown[L]) * cdm;
        break;
      }
      case 'nein': {
        const s = WEAPON_STATS.nein;
        shockwave(g, grid, s.radius[L], s.damage[L], s.knockback, 'nein');
        w.cooldown = s.cooldown[L] * cdm;
        break;
      }
      case 'nein3': {
        // The first wave now; the other two follow (see neinTick).
        const s = WEAPON_STATS.nein3;
        shockwave(g, grid, s.radius[0], s.damage, s.knockback, 'nein3');
        w.waves = s.radius.length - 1;
        w.waveT = s.gap;
        w.cooldown = s.cooldown * cdm;
        break;
      }
      case 'destruction': {
        // Statists near you blow up, and take their neighbours with them.
        const s = WEAPON_STATS.destruction;
        const close = g.enemies.filter((e) => !e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < s.range * s.range);
        if (!close.length) continue;
        const n = s.count[L] + extra(g);
        for (let i = 0; i < n && close.length; i++) {
          const at = close.splice(Math.floor(next(g.rng) * close.length), 1)[0];
          const r = s.radius[L];
          const bx = at.x;
          const by = at.y;
          for (const e of near(grid, bx, by, r + 50)) {
            const d = Math.hypot(e.x - bx, e.y - by);
            if (d > r + e.radius) continue;
            const k = 120 / Math.max(1, d);
            damage(g, e, s.damage[L], 'destruction', (e.x - bx) * k, (e.y - by) * k);
          }
          g.fx.push({ kind: 'boom', x: bx, y: by, radius: r });
        }
        w.cooldown = s.cooldown[L] * cdm;
        break;
      }
      case 'happening': {
        // Lightning: the nearest statist, then whoever's nearest to him, and so on.
        const s = WEAPON_STATS.happening;
        const first = nearest(g, p.x, p.y, s.range);
        if (!first) continue;
        const points: [number, number][] = [[p.x, p.y]];
        const hit = new Set<number>();
        let at: Enemy | null = first;
        for (let j = 0; at && j <= s.jumps[L]; j++) {
          hit.add(at.id);
          points.push([at.x, at.y]);
          const from: Enemy = at;
          damage(g, from, s.damage[L], 'happening');
          at = null;
          let bd = s.reach * s.reach;
          for (const e of near(grid, from.x, from.y, s.reach)) {
            if (e.dead || hit.has(e.id)) continue;
            const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
            if (d < bd) {
              bd = d;
              at = e;
            }
          }
        }
        g.fx.push({ kind: 'zap', points });
        w.cooldown = s.cooldown[L] * cdm;
        break;
      }
      case 'signal': {
        if (!target) continue;
        const s = WEAPON_STATS.signal;
        const n = s.count[L] + extra(g);
        for (let i = 0; i < n; i++) {
          const a = next(g.rng) * Math.PI * 2;
          const pickT = g.enemies.length ? pickOne(g.rng, g.enemies) : target;
          shoot(g, { kind: 'signal', from: 'signal', x: p.x, y: p.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, damage: s.damage[L], pierce: 0, radius: 7, life: 3, knockback: 30, target: pickT.id });
        }
        w.cooldown = s.cooldown[L] * cdm;
        break;
      }
      case 'laffer': {
        const s = WEAPON_STATS.laffer;
        const n = s.count[L] + extra(g);
        for (let i = 0; i < n; i++) {
          const a = p.aim + (i / Math.max(1, n)) * Math.PI * 2;
          shoot(g, { kind: 'laffer', from: 'laffer', x: p.x, y: p.y, vx: 0, vy: 0, damage: s.damage[L], pierce: 999, radius: 14, life: s.time, knockback: 60, ox: p.x, oy: p.y, age: 0, angle: a });
        }
        w.cooldown = s.cooldown[L] * cdm;
        break;
      }
    }
    g.fx.push({ kind: 'shoot', weapon: w.id });
  }
}

/** A ring of refusal around you: everyone inside is hurt and pushed back. */
function shockwave(g: Game, grid: Grid, r: number, amount: number, knockback: number, from: WeaponId) {
  const p = g.player;
  for (const e of near(grid, p.x, p.y, r + 50)) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > r + e.radius) continue;
    const k = knockback / Math.max(1, d);
    damage(g, e, amount, from, (e.x - p.x) * k, (e.y - p.y) * k);
  }
  g.fx.push({ kind: 'nein', x: p.x, y: p.y, radius: r });
}

function handTick(g: Game, grid: Grid, w: OwnedWeapon, dt: number) {
  const s = WEAPON_STATS.hand;
  const L = w.level - 1;
  const p = g.player;
  w.angle += s.spin[L] * dt;
  const n = s.count[L] + extra(g);
  for (let i = 0; i < n; i++) {
    const a = w.angle + (i / n) * Math.PI * 2;
    const hx = p.x + Math.cos(a) * s.orbit[L];
    const hy = p.y + Math.sin(a) * s.orbit[L];
    for (const e of near(grid, hx, hy, 40)) {
      if ((e.x - hx) ** 2 + (e.y - hy) ** 2 > (e.radius + 14) ** 2) continue;
      if ((w.lastHit[e.id] ?? -9) > g.time - s.hitEvery) continue;
      w.lastHit[e.id] = g.time;
      damage(g, e, s.damage[L], 'hand', Math.cos(a) * 90, Math.sin(a) * 90);
    }
  }
  // Forget the slapped who are long gone.
  if (Math.floor(g.time) !== Math.floor(g.time - dt)) for (const id of Object.keys(w.lastHit)) if (w.lastHit[Number(id)] < g.time - 2) delete w.lastHit[Number(id)];
}

function napTick(g: Game, grid: Grid, w: OwnedWeapon, dt: number) {
  const s = WEAPON_STATS.nap;
  const L = w.level - 1;
  w.cooldown -= dt;
  if (w.cooldown > 0) return;
  w.cooldown = 0.25;
  const p = g.player;
  for (const e of near(grid, p.x, p.y, s.radius[L] + 40)) {
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (s.radius[L] + e.radius) ** 2) continue;
    damage(g, e, s.dps[L] * 0.25, 'nap');
  }
}

function moveShots(g: Game, grid: Grid, dt: number) {
  const p = g.player;
  const scratch: Enemy[] = [];
  for (const s of g.shots) {
    s.life -= dt;
    if (s.kind === 'signal') {
      // Steer towards the target (or a new one if it's gone).
      let t = g.enemies.find((e) => e.id === s.target && !e.dead);
      if (!t) {
        t = nearest(g, s.x, s.y, 500) ?? undefined;
        s.target = t?.id;
      }
      if (t) {
        const want = Math.atan2(t.y - s.y, t.x - s.x);
        const have = Math.atan2(s.vy, s.vx);
        let d = want - have;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turn = Math.max(-WEAPON_STATS.signal.turn * dt, Math.min(WEAPON_STATS.signal.turn * dt, d));
        const sp = Math.hypot(s.vx, s.vy);
        s.vx = Math.cos(have + turn) * sp;
        s.vy = Math.sin(have + turn) * sp;
      }
    }
    if (s.kind === 'laffer') {
      // Out and back, along a curve, following you home.
      const T = WEAPON_STATS.laffer.time;
      const age = (s.age = (s.age ?? 0) + dt);
      const phase = age / T;
      const reach = WEAPON_STATS.laffer.reach * Math.sin(Math.PI * Math.min(1, phase));
      // The sweep crosses the aim line at its farthest point.
      const a = (s.angle ?? 0) + (phase - 0.5) * 1.2;
      const prevPhase = (age - dt) / T;
      if (prevPhase < 0.5 && phase >= 0.5) s.hit = [];
      s.x = p.x + Math.cos(a) * reach;
      s.y = p.y + Math.sin(a) * reach;
    } else {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (const e of near(grid, s.x, s.y, s.radius + 50, scratch)) {
      if (s.pierce < 0) break;
      if (s.hit.includes(e.id)) continue;
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 > (e.radius + s.radius) ** 2) continue;
      s.hit.push(e.id);
      const sp = Math.hypot(s.vx, s.vy) || 1;
      const kx = s.kind === 'laffer' ? (e.x - p.x) : (s.vx / sp) * s.knockback;
      const ky = s.kind === 'laffer' ? (e.y - p.y) : (s.vy / sp) * s.knockback;
      const norm = s.kind === 'laffer' ? s.knockback / Math.max(1, Math.hypot(kx, ky)) : 1;
      damage(g, e, s.damage, s.from, kx * norm, ky * norm);
      s.pierce--;
    }
  }
  g.shots = g.shots.filter((s) => s.life > 0 && s.pierce >= 0);
}

// --- Enemies ---

function moveEnemies(g: Game, grid: Grid, dt: number) {
  const p = g.player;
  const scratch: Enemy[] = [];
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.timer += dt;
    let tx = p.x;
    let ty = p.y;
    if (e.type === 'taxman') {
      // He'd rather take your XP than fight you.
      let best: Pickup | null = null;
      let bd = 260 * 260;
      for (const pk of g.pickups) {
        if (pk.kind !== 'xp' || pk.pulled) continue;
        const d = (pk.x - e.x) ** 2 + (pk.y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = pk;
        }
      }
      if (best) {
        tx = best.x;
        ty = best.y;
        if (bd < (e.radius + 8) ** 2) {
          e.stolen += best.value;
          best.value = 0;
        }
      }
    }
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let vx = (dx / d) * e.speed;
    let vy = (dy / d) * e.speed;
    if (e.type === 'fascist') {
      if (e.dash && e.dash > 0) {
        // Charging, straight, wherever you were when he started.
        e.dash -= dt;
        vx = (e.dx ?? 0) * FASCIST_DASH;
        vy = (e.dy ?? 0) * FASCIST_DASH;
      } else if (e.windup && e.windup > 0) {
        e.windup -= dt;
        vx = 0;
        vy = 0;
        if (e.windup <= 0) {
          e.dash = 0.6;
          e.dx = dx / d;
          e.dy = dy / d;
        }
      } else if (e.timer > 3.5 && d < 420) {
        e.timer = 0;
        e.windup = 0.75;
      }
    }
    e.x += vx * dt + e.kx * dt;
    e.y += vy * dt + e.ky * dt;
    const decay = Math.exp(-8 * dt);
    e.kx *= decay;
    e.ky *= decay;
    // Don't all stand in the same spot.
    for (const o of near(grid, e.x, e.y, e.radius, scratch)) {
      if (o === e || o.dead) continue;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const od = Math.hypot(ox, oy);
      const min = (e.radius + o.radius) * 0.85;
      if (od > 0 && od < min) {
        const push = ((min - od) / od) * 0.25;
        e.x += ox * push;
        e.y += oy * push;
      }
    }
    // Their tricks.
    if (e.type === 'socialist') {
      for (const o of near(grid, e.x, e.y, 90, scratch)) if (o !== e && !o.dead && o.type !== 'bank') o.hp = Math.min(o.maxHp, o.hp + 4 * dt);
    }
    if (e.type === 'bank') {
      if (e.timer > 3) {
        e.timer = 0;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + next(g.rng) * 0.3;
          g.foeShots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 115, vy: Math.sin(a) * 115, radius: 11, damage: 12, life: 4.5 });
        }
        if (next(g.rng) < 0.5) for (let i = 0; i < 3; i++) spawnEnemy(g, 'keynesian', e.x + (i - 1) * 30, e.y + 40);
      }
    }
    // Contact.
    const pd = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (pd < (e.radius + PLAYER_RADIUS) ** 2 && p.iframes <= 0) {
      const hurt = Math.max(1, Math.round(e.damage * g.mods.hurt) - p.armor);
      p.hp -= hurt;
      p.iframes = 0.4;
      g.fx.push({ kind: 'hurt', amount: hurt });
    }
    // Far behind you? Bring it back round in front (so the pressure stays on).
    if (pd > (SPAWN_DISTANCE * 1.6) ** 2 && e.type !== 'bank') {
      const [x, y] = ringPoint(g, SPAWN_DISTANCE);
      e.x = x;
      e.y = y;
    }
  }
}

function moveFoeShots(g: Game, dt: number) {
  const p = g.player;
  for (const b of g.foeShots) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Inflation: they grow.
    b.radius = Math.min(26, b.radius + 3.5 * dt);
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.radius + PLAYER_RADIUS) ** 2 && p.iframes <= 0) {
      const hurt = Math.max(1, Math.round(b.damage * g.mods.hurt) - p.armor);
      p.hp -= hurt;
      p.iframes = 0.4;
      b.life = 0;
      g.fx.push({ kind: 'hurt', amount: hurt });
    }
  }
  g.foeShots = g.foeShots.filter((b) => b.life > 0);
}

// --- Pickups ---

function collect(g: Game, dt: number) {
  const p = g.player;
  for (const pk of g.pickups) {
    if (pk.value <= 0 && pk.kind === 'xp') continue;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < p.magnet || pk.pulled) pk.pulled = true;
    if (pk.pulled) {
      const sp = 480 * dt;
      pk.x += ((p.x - pk.x) / (d || 1)) * Math.min(sp, d);
      pk.y += ((p.y - pk.y) / (d || 1)) * Math.min(sp, d);
    }
    if (d < PLAYER_RADIUS + 6) {
      switch (pk.kind) {
        case 'xp':
          gainXp(g, pk.value);
          break;
        case 'gold':
          g.gold += pk.value;
          break;
        case 'heal':
          p.hp = Math.min(p.maxHp, p.hp + pk.value);
          break;
        case 'magnet':
          for (const o of g.pickups) if (o.kind === 'xp') o.pulled = true;
          break;
        case 'chest':
          // The Central Bank's vault: three level-ups' worth.
          gainXp(g, g.next - g.xp + xpFor(g.level + 1) + xpFor(g.level + 2));
          g.gold += 50;
          break;
      }
      pk.value = -1;
      g.fx.push({ kind: 'pickup', pickup: pk.kind });
    }
  }
  // Collected ones are at -1; XP the taxman emptied is at 0.
  g.pickups = g.pickups.filter((pk) => pk.value >= 0 && !(pk.kind === 'xp' && pk.value === 0));
  // Too much XP lying about: merge the far-off ones.
  if (g.pickups.length > 350) {
    const far = g.pickups.filter((pk) => pk.kind === 'xp' && !pk.pulled);
    if (far.length > 1) {
      const total = far.reduce((t, pk) => t + pk.value, 0);
      g.pickups = g.pickups.filter((pk) => !far.includes(pk));
      drop(g, 'xp', far[0].x, far[0].y, total);
    }
  }
}

function gainXp(g: Game, amount: number) {
  g.xp += amount * g.player.xpMult;
  while (g.xp >= g.next) {
    g.xp -= g.next;
    g.level++;
    g.next = xpFor(g.level);
    g.pending++;
    g.fx.push({ kind: 'level' });
  }
}
