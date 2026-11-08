// The Road to Liberty: game rules, kept free of the DOM so they can be tested.
//
// The road is an endless pseudo-3D track (the classic OutRun technique): the
// world is a strip of segments, each with a curve and a height. You drive at
// lateral position `x` (-1 and 1 are the road edges); everything else sits at a
// distance `z` along the track. The renderer (render.ts) draws it; this file
// only moves things and decides what happens.

import { biomeAt, blendNumber, sceneryBiome, type BiomeId, type NatureKind } from './biomes.ts';
import { carStats, type CarStats, type GarageLevels } from './garage.ts';

export const CONFIG = {
  /** World units per road segment. */
  segmentLength: 200,
  /** Half the road's width in world units (x = 1 is this far from the center). */
  roadWidth: 2000,
  cameraHeight: 1000,
  /** Field of view in degrees; sets cameraDepth below. */
  fieldOfView: 100,
  /** How many segments ahead get drawn. */
  drawDistance: 300,

  /** Top speed in world units per second (about 240 km/h on the speedometer). */
  maxSpeed: 12_000,
  /** Boosted top speed after flattening a commie. */
  boostSpeed: 15_000,
  /** 🔥 Nitro: top speed while it burns. Gold fills the bottle this share of what a commie does. */
  nitroSpeed: 17_000,
  nitroGoldShare: 0.4,

  /** Boss chases (one per new landscape): how long they last, and the reward for surviving. */
  bossSeconds: 30,
  bossBonus: 3000,
  /** Surviving puts the cops this much further back (40 m). */
  bossPushback: 40 * 180,
  /** The helicopter drops something in your lane this often (seconds). */
  heliDropEvery: 2.4,
  /** The tank brake-checks you: its distance ahead swings between these (world units) every few seconds. */
  tankNear: 600,
  tankFar: 8000,
  tankCycle: 5,
  tankSteer: 0.2,
  boostSeconds: 2,
  accel: 5_000,
  brake: 12_000,
  /** Speed lost per second when you lift off the gas. */
  coast: 3_000,
  /** On the grass you slow down to this, fast. */
  offRoadMaxSpeed: 6_000,
  offRoadDecel: 9_000,
  /** Lateral speed (road widths per second) at full speed. */
  steering: 2.6,
  /** How hard curves push you outward. */
  centrifugal: 0.18,
  /** You can't drive further out than this. */
  maxX: 2.2,

  /** The cops start this far behind (world units; see UNITS_PER_METER): 120 m… */
  copStartGap: 21_600,
  /** …and can't fall further back than 220 m. */
  copMaxGap: 39_600,
  /** Cop speed as a share of your top speed: starts here… */
  copSpeedStart: 0.72,
  /** …and creeps up to this over copRampSeconds. */
  copSpeedMax: 0.92,
  /** …and keeps climbing with distance: this much more per km driven, up to the cap. */
  copSpeedPerKm: 0.005,
  copSpeedCap: 1.05,
  copRampSeconds: 240,
  /** Seconds before the first roadblocks show up. */
  roadblocksAfter: 20,

  /** Points. */
  /** Points for Marx; rarer commies are worth more (see COMMIES). */
  marxPoints: 500,
  goldPoints: 150,
  /** Points per meter driven. */
  pointsPerMeter: 1,
  /** Each commie in a row (without hitting anything bad) adds this to the multiplier. */
  comboStep: 0.5,

  /** A full tank lasts this many seconds at top speed (less driving slowly drains less). */
  fuelSeconds: 80,
  /** A jerry can refills this share of the tank. */
  fuelCan: 0.4,
  /** On an empty tank you can't go faster than this share of top speed. */
  emptySpeed: 0.5,
  /** Below this, the fuel light comes on and cans show up more often. */
  lowFuel: 0.25,

  /** Aggressive cops: spike strips after this many seconds… */
  spikesAfter: 60,
  /** …and cruisers that try to box you in after this many. */
  cruisersAfter: 90,
  /** How fast a cruiser swerves toward you (road widths per second). */
  cruiserSteer: 0.3,

  /** A border every 2.5 km (in world units): cross it for a bonus and a head start. */
  borderEvery: 2500 * 180,
  borderBonus: 1000,
  /** Crossing a border puts the cops this far further back (50 m)… */
  borderPushback: 50 * 180,
  /** …and the duty-free shop tops up your tank. */
  borderFuel: 0.25,

  /** Power-ups show up after this many seconds, this often (relative weight each). */
  powerUpsAfter: 25,
  powerUpWeight: 0.13,

  /** Spike strips: top speed ×0.9 for 5 s, and 5% off for good (down to 50%). */
  spikeSlow: 0.9,
  spikeSlowSeconds: 5,
  spikeDamage: 0.95,
  minDamage: 0.5,
  /** Getting rammed by a cruiser: top speed halved for 5 s. */
  ramSlow: 0.5,
  ramSlowSeconds: 5,
  /** 🔧 Wrench: rare; a bit less rare when the car is hurt. */
  wrenchAfter: 40,
  wrenchWeight: 0.08,
  wrenchWeightHurt: 0.3,
  /** 🍩 Donuts: the cops slow to this share of their speed, for this long. */
  donutSlowdown: 0.55,
  donutSeconds: 10,
  /** 🚜 Killdozer: crash through anything for this long, for points. */
  killdozerSeconds: 5,
  smashPoints: 250,
  /** 💨 Smoke grenade: the cops lose this much ground (90 m). */
  smokePushback: 90 * 180,
  /** How long the smoke hangs in your mirror. */
  smokeSeconds: 6,

  /** Roadside scenery (billboards, houses, bars…): one every this many segments, roughly. */
  sceneryEvery: 11,

  /** One day/night cycle, in seconds of driving. */
  dayLength: 180,
  /** Rain makes steering this much weaker and curves this much stronger. */
  rainGrip: 0.25,
  rainSlide: 0.5,
} as const;

/** The places you cross into, in order (then around again). */
export const BORDER_NAMES = [
  'Liberland',
  'Free State of New Hampshire',
  'Próspera',
  'Zug',
  'Seasteadia',
  "Galt's Gulch",
  'Ancapistan',
  'Free Private City of Rothbardia',
];

export const borderName = (index: number) => BORDER_NAMES[index % BORDER_NAMES.length];

/** Where you start, before the first border. */
export const START_TERRITORY = 'Statist Territory';

/** The place you're in right now: the last border you crossed (the gate ahead names the next one). */
export const currentTerritory = (bordersCrossed: number) => (bordersCrossed > 0 ? borderName(bordersCrossed - 1) : START_TERRITORY);

// ---------------------------------------------------------------------------
// Time of day and weather (a fixed cycle, so every run sees them in the same order)
// ---------------------------------------------------------------------------

export interface Environment {
  /** 1 = full day, 0 = night. */
  daylight: number;
  /** 0 = dry, 1 = pouring. */
  rain: number;
}

/**
 * How slippery it is at track position `z`, from 0 to 1: the rain (where it
 * rains; none in the desert, snow on the snowfield) or the biome's own slip
 * (the snowfield is always a bit icy), whichever is worse.
 */
export function weatherSlip(z: number, rain: number): number {
  const wet = blendNumber(z, (b) => (b.precipitation === 'none' ? 0 : 1));
  return Math.max(rain * wet, blendNumber(z, (b) => b.slip));
}

export { biomeAt };

const ramp = (t: number, start: number, length: number) => Math.min(1, Math.max(0, (t - start) / length));

/**
 * Day for 80 s, sunset, night for 50 s, dawn, and around again. Rain comes in
 * 28-second showers: the first after 45 s, then every 110 s.
 */
export function environment(time: number): Environment {
  const t = time % CONFIG.dayLength;
  const daylight = t < 80 ? 1 : t < 100 ? 1 - ramp(t, 80, 20) : t < 150 ? 0 : ramp(t, 150, 20);
  const shower = (time - 45) % 110;
  const rain = time < 45 ? 0 : shower < 28 ? Math.min(ramp(shower, 0, 3), 1 - ramp(shower, 25, 3)) : 0;
  return { daylight, rain };
}

/** Units per meter, for the speedometer and the cop distance (top speed = 240 km/h). */
export const UNITS_PER_METER = 180;

export const cameraDepth = 1 / Math.tan(((CONFIG.fieldOfView / 2) * Math.PI) / 180);
/** Distance from the camera to where things reach your bumper (the bottom of the screen). */
export const PLAYER_Z = CONFIG.cameraHeight * cameraDepth;

// ---------------------------------------------------------------------------
// The track: endless, so curves and hills come from smooth functions
// ---------------------------------------------------------------------------

const smooth = (t: number) => t * t * (3 - 2 * t);

/** How much segment `i` bends (negative = left). Calm stretches alternate with bends; the start is straight. */
export function curveAt(i: number): number {
  const bend = Math.sin(i / 97) * 4 + Math.sin(i / 31 + 1) * 1.6;
  const calm = smooth(Math.min(1, Math.max(0, (Math.sin(i / 181) + 0.3) / 0.6)));
  const warmUp = smooth(Math.min(1, Math.max(0, (i - 60) / 120)));
  // The mountains bend harder (blended across biome changes, so there are no kinks).
  const raw = bend * calm * warmUp * Math.sqrt(blendNumber(i * CONFIG.segmentLength, (b) => b.terrain));
  return Math.abs(raw) < 0.4 ? 0 : raw;
}

/** Height of the road at the start of segment `i`. */
export function heightAt(i: number): number {
  const base = Math.sin(i / 53) * 900 + Math.sin(i / 137 + 2) * 1400;
  return base * blendNumber(i * CONFIG.segmentLength, (b) => b.terrain);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type CommieId = 'marx' | 'engels' | 'lenin' | 'stalin' | 'mao' | 'che';

export interface Commie {
  id: CommieId;
  name: string;
  points: number;
  /** Relative odds among commies. */
  weight: number;
}

/** Marx is everywhere; the rest are rarer and worth more. */
export const COMMIES: readonly Commie[] = [
  { id: 'marx', name: 'Marx', points: 500, weight: 12 },
  { id: 'engels', name: 'Engels', points: 700, weight: 3 },
  { id: 'che', name: 'Che', points: 900, weight: 2.5 },
  { id: 'lenin', name: 'Lenin', points: 1000, weight: 2 },
  { id: 'mao', name: 'Mao', points: 1200, weight: 1.5 },
  { id: 'stalin', name: 'Stalin', points: 1500, weight: 1 },
];

/** Picks which commie, by weight. `roll` in [0, 1). */
export function pickCommie(roll: number): number {
  const total = COMMIES.reduce((sum, c) => sum + c.weight, 0);
  let r = roll * total;
  for (let i = 0; i < COMMIES.length; i++) {
    r -= COMMIES[i].weight;
    if (r < 0) return i;
  }
  return 0;
}

export const emptyTally = (): Record<CommieId, number> => ({ marx: 0, engels: 0, lenin: 0, stalin: 0, mao: 0, che: 0 });
export const totalCommies = (tally: Record<CommieId, number>) => Object.values(tally).reduce((a, b) => a + b, 0);

export type EntityKind = 'commie' | 'gold' | 'fuel' | 'traffic' | 'roadblock' | 'spikes' | 'cruiser' | 'border' | 'tank' | PowerUp | Scenery;

export type BossKind = 'helicopter' | 'tank';

export interface Boss {
  kind: BossKind;
  /** Seconds left to survive. */
  left: number;
  /** Seconds to the helicopter's next drop; the tank's brake-check phase. */
  timer: number;
  /** Where it hovers / drives, -1..1 (the helicopter follows you, a little late). */
  x: number;
  /** After the tank hits you, a moment before it can again. */
  cooldown: number;
}

/** Kinds of crash (what you hit). */
export type CrashKind = 'traffic' | 'roadblock' | 'spikes' | 'cruiser' | 'tank';

export type PowerUp = 'donuts' | 'killdozer' | 'smoke' | 'wrench';
export const POWER_UPS: readonly PowerUp[] = ['donuts', 'killdozer', 'smoke', 'wrench'];

/** Things by the side of the road. Never in your way (they stand beyond where you can drive). */
export type Scenery = 'billboard' | 'house' | 'bar' | 'gas-station' | 'diner' | 'barn' | NatureKind;
export const SCENERY: readonly Scenery[] = [
  'billboard', 'house', 'bar', 'gas-station', 'diner', 'barn',
  'cactus', 'skull', 'palm', 'surf-shack', 'lifeguard', 'pine', 'snowy-pine', 'snowman', 'ski-lodge', 'rock', 'cabin',
];
export const isScenery = (kind: EntityKind): kind is Scenery => (SCENERY as readonly string[]).includes(kind);

export interface Entity {
  id: number;
  kind: EntityKind;
  /** Distance along the track. */
  z: number;
  /** Lateral position; -1..1 is the road. */
  x: number;
  /** Own speed: traffic drives forward, commies wander sideways. */
  speed: number;
  vx: number;
  /** For drawing: which car color, which roadblock sign, etc. */
  variant: number;
  hit: boolean;
}

/** Half widths, in road widths, for collisions. */
export const HALF_WIDTH: Record<EntityKind, number> = {
  commie: 0.18,
  fuel: 0.13,
  gold: 0.12,
  traffic: 0.22,
  roadblock: 0.32,
  /** A spike strip covers two lanes: the third one is the way out. */
  spikes: 0.5,
  cruiser: 0.22,
  tank: 0.34,
  /** Borders span the whole road (crossing one doesn't depend on where you are). */
  border: 99,
  donuts: 0.16,
  killdozer: 0.16,
  smoke: 0.16,
  wrench: 0.16,
  billboard: 0,
  house: 0,
  bar: 0,
  'gas-station': 0,
  diner: 0,
  barn: 0,
  cactus: 0,
  skull: 0,
  palm: 0,
  'surf-shack': 0,
  lifeguard: 0,
  pine: 0,
  'snowy-pine': 0,
  snowman: 0,
  'ski-lodge': 0,
  rock: 0,
  cabin: 0,
};
export const CAR_HALF_WIDTH = 0.2;

export interface GameStats {
  /** How many of each commie you ran over. */
  commies: Record<CommieId, number>;
  gold: number;
  crashes: number;
  meters: number;
}

export interface GameState {
  /** Distance driven (camera position along the track). */
  position: number;
  speed: number;
  x: number;
  /** World units between you and the cops. Zero means busted. */
  copGap: number;
  /** Seconds since the start. */
  time: number;
  score: number;
  /** Score multiplier from flattening commies in a row. */
  combo: number;
  boostLeft: number;
  /** Seconds of screen shake / slowdown flash left after a crash. */
  crashLeft: number;
  entities: Entity[];
  /** Where the next thing gets placed. */
  nextSpawnZ: number;
  nextId: number;
  stats: GameStats;
  /** 0 (empty) to 1 (full). */
  fuel: number;
  /** Where the next border gets placed, and how many you've crossed. */
  nextBorderZ: number;
  bordersCrossed: number;
  /** Seconds left on each power-up (smoke: how long it hangs in the mirror). */
  donutsLeft: number;
  killdozerLeft: number;
  smokeLeft: number;
  /** Lasting damage from spike strips: your top speed is multiplied by this (1 = like new). */
  damage: number;
  /** Seconds left of the spike and ram slowdowns. */
  spikeSlowLeft: number;
  ramSlowLeft: number;
  /** Where the next roadside scenery goes. */
  nextSceneryZ: number;
  /** The landscape you're in (for "entering the desert"). */
  biome: BiomeId;
  /** The car as upgraded in the garage. */
  car: CarStats;
  /** 🔥 Nitro bottle, 0..1 (full = ready), and seconds left of a burn. */
  nitro: number;
  nitroLeft: number;
  nitroUsed: number;
  /** The boss chasing you right now, if any; and how many you've met and survived. */
  boss: Boss | null;
  bossesMet: number;
  bossesSurvived: number;
  over: boolean;
}

export interface Input {
  /** -1 (full left) to 1 (full right). */
  steer: number;
  brake: boolean;
  /** Fire the nitro (if the bottle's full). */
  nitro?: boolean;
}

/** What happened during an update, so main.ts can play sounds and show text. */
export type GameEvent =
  | { type: 'commie'; who: CommieId; points: number; combo: number }
  | { type: 'repair' }
  | { type: 'biome'; id: BiomeId; name: string }
  | { type: 'gold'; points: number }
  | { type: 'crash'; kind: CrashKind }
  | { type: 'nitro' }
  | { type: 'nitro-ready' }
  | { type: 'boss'; kind: BossKind }
  | { type: 'boss-drop' }
  | { type: 'boss-survived'; kind: BossKind; bonus: number; smashed: boolean }
  | { type: 'warning'; kind: 'spikes' | 'cruiser' }
  | { type: 'border'; name: string; bonus: number; index: number }
  | { type: 'nightfall' }
  | { type: 'rain' }
  | { type: 'power-up'; kind: Exclude<PowerUp, 'wrench'> }
  | { type: 'smash'; kind: 'traffic' | 'roadblock' | 'spikes' | 'cruiser'; points: number }
  | { type: 'fuel' }
  | { type: 'low-fuel' }
  | { type: 'out-of-gas' }
  | { type: 'busted' };

/** A fresh run, with the car as upgraded in the garage. */
export function newGame(garage?: GarageLevels): GameState {
  const car = carStats(garage);
  return {
    position: 0,
    speed: CONFIG.maxSpeed * 0.5,
    x: 0,
    copGap: CONFIG.copStartGap + car.headStart * UNITS_PER_METER,
    time: 0,
    score: 0,
    combo: 1,
    boostLeft: 0,
    crashLeft: 0,
    entities: [],
    nextSpawnZ: CONFIG.segmentLength * 40,
    nextId: 1,
    stats: { commies: emptyTally(), gold: 0, crashes: 0, meters: 0 },
    fuel: 1,
    nextBorderZ: CONFIG.borderEvery,
    bordersCrossed: 0,
    donutsLeft: 0,
    killdozerLeft: 0,
    smokeLeft: 0,
    damage: 1,
    spikeSlowLeft: 0,
    ramSlowLeft: 0,
    nextSceneryZ: CONFIG.segmentLength * 10,
    biome: 'fields',
    car,
    nitro: 0,
    nitroLeft: 0,
    nitroUsed: 0,
    boss: null,
    bossesMet: 0,
    bossesSurvived: 0,
    over: false,
  };
}

export const segmentIndex = (z: number) => Math.floor(z / CONFIG.segmentLength);

/** Cop speed right now (units per second): it ramps up over the first minutes, then keeps climbing with distance. */
export function copSpeed(time: number, meters = 0): number {
  const t = Math.min(1, time / CONFIG.copRampSeconds);
  const share = CONFIG.copSpeedStart + (CONFIG.copSpeedMax - CONFIG.copSpeedStart) * t + (meters / 1000) * CONFIG.copSpeedPerKm;
  return CONFIG.maxSpeed * Math.min(CONFIG.copSpeedCap, share);
}

/** What your top speed is multiplied by right now: lasting damage and any slowdowns. */
export function speedFactor(state: GameState): number {
  return state.damage * (state.spikeSlowLeft > 0 ? state.car.spikeSlow : 1) * (state.ramSlowLeft > 0 ? state.car.ramSlow : 1);
}

/** Speedometer reading. */
export const kmh = (speed: number) => Math.round((speed / UNITS_PER_METER) * 3.6);

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

/** Picks what to place next. `roll` in [0, 1). Roadblocks only after the warm-up; more jerry cans when you're low. */
export function pickKind(roll: number, time: number, fuel = 1, hurt = false): EntityKind {
  const weights: [EntityKind, number][] = [
    ['commie', 4],
    ['gold', 3],
    ['fuel', fuel < CONFIG.lowFuel ? 3 : fuel < 0.6 ? 1 : 0.4],
    ['traffic', 3],
    ['roadblock', time >= CONFIG.roadblocksAfter ? 2 + Math.min(2, time / 120) : 0],
    ['spikes', time >= CONFIG.spikesAfter ? 0.7 + Math.min(0.8, time / 300) : 0],
    ['cruiser', time >= CONFIG.cruisersAfter ? 0.5 + Math.min(0.8, time / 300) : 0],
    ...(['donuts', 'killdozer', 'smoke'] as const).map((kind): [EntityKind, number] => [kind, time >= CONFIG.powerUpsAfter ? CONFIG.powerUpWeight : 0]),
    ['wrench', time < CONFIG.wrenchAfter ? 0 : hurt ? CONFIG.wrenchWeightHurt : CONFIG.wrenchWeight],
  ];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = roll * total;
  for (const [kind, w] of weights) {
    r -= w;
    if (r < 0) return kind;
  }
  return 'commie';
}

/** Gap to the next spawn: things get denser as time goes on. */
export function spawnSpacing(time: number, roll: number): number {
  // ~1.5 things a second at top speed to begin with, ~3 after four minutes.
  const segments = Math.max(16, 34 - time / 13) + roll * 12;
  return segments * CONFIG.segmentLength;
}

function spawn(state: GameState, rng: () => number, events: GameEvent[]): void {
  const kind = pickKind(rng(), state.time, state.fuel, state.damage < 0.9);
  const lane = [-0.6, 0, 0.6][Math.floor(rng() * 3)];
  const x =
    kind === 'roadblock' ? lane * 0.9
    : kind === 'spikes' ? (rng() < 0.5 ? -0.3 : 0.3) // covers two lanes
    : lane + (rng() - 0.5) * 0.3;
  const speed =
    kind === 'traffic' ? CONFIG.maxSpeed * (0.35 + rng() * 0.2)
    : kind === 'cruiser' ? CONFIG.maxSpeed * (0.72 + rng() * 0.08)
    : 0;
  if (kind === 'spikes' || kind === 'cruiser') events.push({ type: 'warning', kind });
  const entity: Entity = {
    id: state.nextId++,
    kind,
    z: state.nextSpawnZ,
    x,
    speed,
    // Marx sits in his armchair (some chairs have wheels and drift); the others stroll across.
    vx: kind === 'commie' && rng() < 0.6 ? (rng() < 0.5 ? -1 : 1) * (0.12 + rng() * 0.22) : 0,
    variant: kind === 'commie' ? pickCommie(rng()) : Math.floor(rng() * 4),
    hit: false,
  };
  state.entities.push(entity);
  state.nextSpawnZ += spawnSpacing(state.time, rng());
}

// ---------------------------------------------------------------------------
// The update step
// ---------------------------------------------------------------------------

/** Advances the game by `dt` seconds. Returns what happened, for sounds and text. */
export function update(state: GameState, input: Input, dt: number, rng: () => number = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.over) return events;
  dt = Math.min(dt, 0.05); // a long frame (tab switch) shouldn't teleport you
  state.time += dt;
  state.boostLeft = Math.max(0, state.boostLeft - dt);
  state.donutsLeft = Math.max(0, state.donutsLeft - dt);
  state.killdozerLeft = Math.max(0, state.killdozerLeft - dt);
  state.smokeLeft = Math.max(0, state.smokeLeft - dt);
  state.spikeSlowLeft = Math.max(0, state.spikeSlowLeft - dt);
  state.ramSlowLeft = Math.max(0, state.ramSlowLeft - dt);
  state.crashLeft = Math.max(0, state.crashLeft - dt);

  // Speed: always on the gas unless braking.
  // Fuel drains with speed (a little even when crawling).
  const fuelBefore = state.fuel;
  state.fuel = Math.max(0, state.fuel - (dt / state.car.fuelSeconds) * Math.max(0.3, state.speed / CONFIG.maxSpeed));
  if (fuelBefore >= CONFIG.lowFuel && state.fuel < CONFIG.lowFuel) events.push({ type: 'low-fuel' });
  if (fuelBefore > 0 && state.fuel === 0) events.push({ type: 'out-of-gas' });

  // Nitro: fire it when the bottle's full.
  state.nitroLeft = Math.max(0, state.nitroLeft - dt);
  if (input.nitro && state.nitro >= 1 && state.nitroLeft === 0 && state.fuel > 0) {
    state.nitro = 0;
    state.nitroLeft = state.car.nitroSeconds;
    state.nitroUsed++;
    events.push({ type: 'nitro' });
  }
  const base =
    state.fuel === 0 ? CONFIG.maxSpeed * CONFIG.emptySpeed
    : state.nitroLeft > 0 ? CONFIG.nitroSpeed
    : state.boostLeft > 0 ? CONFIG.boostSpeed
    : CONFIG.maxSpeed;
  const top = base * state.car.topSpeed * speedFactor(state);
  if (input.brake) state.speed -= CONFIG.brake * dt;
  else if (state.speed < top) state.speed = Math.min(top, state.speed + CONFIG.accel * dt);
  else state.speed = Math.max(top, state.speed - CONFIG.coast * dt);
  const offRoad = Math.abs(state.x) > 1;
  if (offRoad && state.speed > CONFIG.offRoadMaxSpeed) {
    state.speed = Math.max(CONFIG.offRoadMaxSpeed, state.speed - CONFIG.offRoadDecel * dt);
  }
  state.speed = Math.max(0, state.speed);

  // Steering, and curves pushing you outward (rain makes both worse).
  const env = environment(state.time);
  const was = environment(state.time - dt);
  if (was.daylight >= 0.5 && env.daylight < 0.5) events.push({ type: 'nightfall' });
  if (was.rain === 0 && env.rain > 0 && blendNumber(state.position + PLAYER_Z, (b) => (b.precipitation === 'rain' ? 1 : 0)) > 0.5) {
    events.push({ type: 'rain' });
  }
  const landscape = sceneryBiome(state.position + PLAYER_Z);
  if (landscape.id !== state.biome) {
    state.biome = landscape.id;
    events.push({ type: 'biome', id: landscape.id, name: landscape.name });
    startBoss(state, events);
  }
  const speedShare = state.speed / CONFIG.maxSpeed;
  const before = state.position + PLAYER_Z;
  const slick = weatherSlip(before, env.rain);
  state.x += input.steer * CONFIG.steering * (1 - CONFIG.rainGrip * slick) * Math.min(1, speedShare + 0.25) * dt;
  state.x -= curveAt(segmentIndex(before)) * CONFIG.centrifugal * (1 + CONFIG.rainSlide * slick) * speedShare * speedShare * dt;
  state.x = Math.max(-CONFIG.maxX, Math.min(CONFIG.maxX, state.x));

  state.position += state.speed * dt;
  const after = state.position + PLAYER_Z;
  const meters = (state.speed * dt) / UNITS_PER_METER;
  state.stats.meters += meters;
  state.score += meters * CONFIG.pointsPerMeter;

  // Spawn ahead of the draw distance; drop what's behind.
  const horizon = state.position + CONFIG.drawDistance * CONFIG.segmentLength;
  while (state.nextSpawnZ < horizon) spawn(state, rng, events);
  while (state.nextSceneryZ < horizon) {
    const here = sceneryBiome(state.nextSceneryZ);
    const kind = here.scenery[Math.floor(rng() * here.scenery.length)] as Scenery;
    // At the beach the sea is on the right, so everything stands on the left.
    const side = here.sea || rng() < 0.5 ? -1 : 1;
    state.entities.push({ id: state.nextId++, kind, z: state.nextSceneryZ, x: side * (3.5 + rng() * 1.1), speed: 0, vx: 0, variant: Math.floor(rng() * 1000), hit: false });
    state.nextSceneryZ += CONFIG.segmentLength * CONFIG.sceneryEvery * (0.5 + rng());
  }
  while (state.nextBorderZ < horizon) {
    const index = Math.round(state.nextBorderZ / CONFIG.borderEvery) - 1;
    state.entities.push({ id: state.nextId++, kind: 'border', z: state.nextBorderZ, x: 0, speed: 0, vx: 0, variant: index, hit: false });
    // Keep the gate clear: nothing spawns right on top of it.
    state.entities = state.entities.filter((e) => e.kind === 'border' || isScenery(e.kind) || Math.abs(e.z - state.nextBorderZ) > CONFIG.segmentLength * 4);
    state.nextBorderZ += CONFIG.borderEvery;
  }

  for (const e of state.entities) {
    const prevZ = e.z;
    e.z += e.speed * dt;
    if (e.kind === 'commie' && !e.hit) {
      e.x += e.vx * dt;
      if (Math.abs(e.x) > 0.9) {
        e.x = Math.sign(e.x) * 0.9;
        e.vx = -e.vx;
      }
    }
    // Cruisers swerve toward you to box you in while they're close ahead.
    if (e.kind === 'cruiser' && !e.hit && e.z > before && e.z - before < 6000) {
      const toward = Math.sign(state.x - e.x) * Math.min(Math.abs(state.x - e.x), CONFIG.cruiserSteer * dt);
      e.x = Math.max(-0.9, Math.min(0.9, e.x + toward));
    }
    if (e.hit || isScenery(e.kind) || e.kind === 'tank') continue; // the tank is handled by the boss code
    // Did it go from ahead of your bumper to behind it this frame? (Traffic moves too.)
    const crossed = prevZ >= before && e.z <= after;
    if (!crossed ||Math.abs(e.x - state.x) > HALF_WIDTH[e.kind] + CAR_HALF_WIDTH) continue;
    e.hit = true;
    events.push(...collide(state, e));
  }
  state.entities = state.entities.filter((e) => e.z > state.position - CONFIG.segmentLength && !(e.hit && (e.kind === 'gold' || e.kind === 'fuel' || POWER_UPS.includes(e.kind as PowerUp))));

  if (state.boss) updateBoss(state, dt, after, rng, events);

  // The chase.
  state.copGap += (state.speed - copSpeed(state.time, state.stats.meters) * (state.donutsLeft > 0 ? CONFIG.donutSlowdown : 1)) * dt;
  state.copGap = Math.min(CONFIG.copMaxGap, state.copGap);
  if (state.copGap <= 0) {
    state.copGap = 0;
    state.over = true;
    events.push({ type: 'busted' });
  }
  return events;
}

/** With the Killdozer, anything in the way gets plowed aside for points. */
function smash(state: GameState, e: Entity, kind: 'traffic' | 'roadblock' | 'spikes' | 'cruiser'): GameEvent[] {
  const points = Math.round(CONFIG.smashPoints * state.combo);
  state.score += points;
  if (kind === 'traffic' || kind === 'cruiser') e.x += e.x >= state.x ? 1.2 : -1.2;
  state.crashLeft = 0.25; // a little shake, no slowdown
  return [{ type: 'smash', kind, points }];
}

function collide(state: GameState, e: Entity): GameEvent[] {
  if (isScenery(e.kind)) return []; // never reached: scenery stands out of your way
  if (state.killdozerLeft > 0 && (e.kind === 'traffic' || e.kind === 'roadblock' || e.kind === 'spikes' || e.kind === 'cruiser')) {
    return smash(state, e, e.kind);
  }
  switch (e.kind) {
    case 'donuts':
      state.donutsLeft = CONFIG.donutSeconds;
      return [{ type: 'power-up', kind: 'donuts' }];
    case 'killdozer':
      state.killdozerLeft = CONFIG.killdozerSeconds;
      return [{ type: 'power-up', kind: 'killdozer' }];
    case 'smoke':
      state.copGap = Math.min(CONFIG.copMaxGap, state.copGap + CONFIG.smokePushback);
      state.smokeLeft = CONFIG.smokeSeconds;
      return [{ type: 'power-up', kind: 'smoke' }];
    case 'commie': {
      const who = COMMIES[e.variant] ?? COMMIES[0];
      const points = Math.round(who.points * state.combo);
      state.score += points;
      state.stats.commies[who.id]++;
      const events: GameEvent[] = [{ type: 'commie', who: who.id, points, combo: state.combo }];
      state.combo += CONFIG.comboStep;
      fillNitro(state, state.car.nitroPerCommie, events);
      state.boostLeft = CONFIG.boostSeconds;
      return events;
    }
    case 'fuel':
      state.fuel = Math.min(1, state.fuel + CONFIG.fuelCan);
      return [{ type: 'fuel' }];
    case 'gold': {
      const points = Math.round(CONFIG.goldPoints * state.combo);
      state.score += points;
      state.stats.gold++;
      const events: GameEvent[] = [{ type: 'gold', points }];
      fillNitro(state, state.car.nitroPerCommie * CONFIG.nitroGoldShare, events);
      return events;
    }
    case 'traffic':
      // Rear-ended a slowpoke: you drop to their speed (minus a bit) and they get shoved aside.
      state.speed = Math.min(state.speed, e.speed * 0.6);
      e.x += e.x >= state.x ? 0.6 : -0.6;
      return crashed(state, 'traffic');
    case 'roadblock':
      state.speed *= state.car.crashKeep;
      return crashed(state, 'roadblock');
    case 'spikes':
      // Slower for a while, and a little slower for good.
      state.spikeSlowLeft = CONFIG.spikeSlowSeconds;
      state.damage = Math.max(CONFIG.minDamage, state.damage * state.car.spikeDamage);
      return crashed(state, 'spikes');
    case 'cruiser':
      state.ramSlowLeft = CONFIG.ramSlowSeconds;
      state.speed = Math.min(state.speed, CONFIG.maxSpeed * speedFactor(state));
      e.x += e.x >= state.x ? 0.7 : -0.7;
      return crashed(state, 'cruiser');
    case 'tank':
      return []; // handled in updateBoss
    case 'wrench':
      state.damage = 1;
      state.spikeSlowLeft = 0;
      state.ramSlowLeft = 0;
      return [{ type: 'repair' }];
    case 'border': {
      const index = state.bordersCrossed++;
      const bonus = CONFIG.borderBonus * state.bordersCrossed;
      state.score += bonus;
      state.copGap = Math.min(CONFIG.copMaxGap, state.copGap + CONFIG.borderPushback);
      state.fuel = Math.min(1, state.fuel + CONFIG.borderFuel);
      return [{ type: 'border', name: borderName(index), bonus, index }];
    }
  }
}

/** Distance to the next border, in meters. */
export function metersToBorder(state: GameState): number {
  const next = (state.bordersCrossed + 1) * CONFIG.borderEvery;
  return Math.max(0, (next - (state.position + PLAYER_Z)) / UNITS_PER_METER);
}

function fillNitro(state: GameState, amount: number, events: GameEvent[]) {
  if (state.nitro >= 1) return;
  state.nitro = Math.min(1, state.nitro + amount);
  if (state.nitro >= 1) events.push({ type: 'nitro-ready' });
}

// ---------------------------------------------------------------------------
// Boss chases: one per new landscape, alternating helicopter and tank
// ---------------------------------------------------------------------------

function startBoss(state: GameState, events: GameEvent[]) {
  if (state.boss) return;
  const kind: BossKind = state.bossesMet % 2 === 0 ? 'helicopter' : 'tank';
  state.bossesMet++;
  state.boss = { kind, left: CONFIG.bossSeconds, timer: kind === 'helicopter' ? 1.5 : 0, x: state.x, cooldown: 0 };
  if (kind === 'tank') {
    state.entities.push({ id: state.nextId++, kind: 'tank', z: state.position + PLAYER_Z + CONFIG.tankFar * 2, x: 0, speed: 0, vx: 0, variant: 0, hit: false });
  }
  events.push({ type: 'boss', kind });
}

function endBoss(state: GameState, smashed: boolean, events: GameEvent[]) {
  const boss = state.boss!;
  state.boss = null;
  state.bossesSurvived++;
  const bonus = CONFIG.bossBonus * state.bossesSurvived * (smashed ? 2 : 1);
  state.score += bonus;
  state.copGap = Math.min(CONFIG.copMaxGap, state.copGap + CONFIG.bossPushback);
  state.entities = state.entities.filter((e) => e.kind !== 'tank');
  events.push({ type: 'boss-survived', kind: boss.kind, bonus, smashed });
}

function updateBoss(state: GameState, dt: number, bumper: number, rng: () => number, events: GameEvent[]) {
  const boss = state.boss!;
  boss.left -= dt;
  boss.cooldown = Math.max(0, boss.cooldown - dt);
  if (boss.left <= 0) {
    endBoss(state, false, events);
    return;
  }
  if (boss.kind === 'helicopter') {
    // Hovers ahead, following you a little late, and drops trouble in your lane.
    boss.x += Math.sign(state.x - boss.x) * Math.min(Math.abs(state.x - boss.x), 0.6 * dt);
    boss.timer -= dt;
    if (boss.timer <= 0) {
      boss.timer = CONFIG.heliDropEvery;
      const spikes = rng() < 0.4;
      const lane = Math.max(-0.6, Math.min(0.6, Math.round(state.x / 0.6) * 0.6));
      state.entities.push({
        id: state.nextId++,
        kind: spikes ? 'spikes' : 'roadblock',
        z: bumper + 14_000,
        x: spikes ? (lane <= 0 ? -0.3 : 0.3) : lane * 0.9,
        speed: 0,
        vx: 0,
        variant: Math.floor(rng() * 4),
        hit: false,
      });
      events.push({ type: 'boss-drop' });
    }
    return;
  }
  // The tank: stays ahead of you, swinging close (a brake check) and back, swerving to block you.
  const tank = state.entities.find((e) => e.kind === 'tank');
  if (!tank) return;
  boss.timer += dt;
  const swing = 0.5 + 0.5 * Math.cos((boss.timer / CONFIG.tankCycle) * Math.PI * 2);
  const ahead = CONFIG.tankNear + (CONFIG.tankFar - CONFIG.tankNear) * swing;
  // It keeps pace with you, easing into its spot (it arrives from far ahead at the start).
  tank.z += state.speed * dt;
  tank.z += (bumper + ahead - tank.z) * Math.min(1, dt * 3);
  tank.x += Math.sign(state.x - tank.x) * Math.min(Math.abs(state.x - tank.x), CONFIG.tankSteer * dt);
  tank.x = Math.max(-0.7, Math.min(0.7, tank.x));
  boss.x = tank.x;
  const close = tank.z - bumper < CONFIG.tankNear + 500;
  if (close && boss.cooldown === 0 && Math.abs(tank.x - state.x) < HALF_WIDTH.tank + CAR_HALF_WIDTH) {
    if (state.killdozerLeft > 0) {
      endBoss(state, true, events); // the Killdozer wins
      return;
    }
    boss.cooldown = 1.5;
    state.speed *= Math.max(0.5, state.car.crashKeep); // a brake check, not a wall
    state.damage = Math.max(CONFIG.minDamage, state.damage * 0.95);
    events.push(...crashed(state, 'tank'));
  }
}

function crashed(state: GameState, kind: CrashKind): GameEvent[] {
  state.combo = 1;
  state.boostLeft = 0;
  state.crashLeft = 0.6;
  state.stats.crashes++;
  return [{ type: 'crash', kind }];
}
