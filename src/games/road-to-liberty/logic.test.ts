import { describe, expect, it } from 'vitest';
import { BORDER_NAMES, COMMIES, currentTerritory, START_TERRITORY, heightAt, weatherSlip, CONFIG, copSpeed, pickCommie, speedFactor, totalCommies, curveAt, environment, isScenery, kmh, metersToBorder, newGame, pickKind, PLAYER_Z, POWER_UPS, update, type Entity, type GameState, type Input } from './logic.ts';
import { PLAYLIST, shuffledOrder } from './radio.ts';
import { buyUpgrade, carStats, nextCost, normalizeLevels, stockCar } from './garage.ts';
import { BIOME_LENGTH, BIOMES, biomeAt, sceneryBiome } from './biomes.ts';
import { LINES, pickLine } from './rothbard.ts';

/** A seeded random number generator, so runs are repeatable. */
function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const idle: Input = { steer: 0, brake: false };

/** Puts one thing just ahead of your bumper, in your lane. */
function placeAhead(state: GameState, kind: Entity['kind'], x = state.x, variant = 0): Entity {
  const e: Entity = { id: 999, kind, z: state.position + PLAYER_Z + 50, x, speed: kind === 'traffic' ? 3000 : 0, vx: 0, variant, hit: false };
  state.entities = [e];
  state.nextSpawnZ = Infinity; // no other spawns in the way
  return e;
}

/** Runs `seconds` of game time with a driver function. */
function drive(state: GameState, seconds: number, driver: (s: GameState) => Input, random = rng()) {
  const events = [];
  for (let t = 0; t < seconds && !state.over; t += 1 / 60) events.push(...update(state, driver(state), 1 / 60, random));
  return events;
}

/** Steers back to the road, toward the nearest Marx or gold ahead, and away from traffic and roadblocks. */
function autopilot(s: GameState): Input {
  const bumper = s.position + PLAYER_Z;
  const ahead = s.entities.filter((e) => !e.hit && e.z > bumper && e.z < bumper + 4000).sort((a, b) => a.z - b.z);
  let target = 0;
  const threats = ['roadblock', 'traffic', 'spikes', 'cruiser', 'tank'];
  const near = s.entities.filter((e) => !e.hit && e.z > bumper && e.z < bumper + (e.kind === 'tank' ? 9000 : 4000));
  const threat = near.find((e) => threats.includes(e.kind) && Math.abs(e.x - s.x) < (e.kind === 'spikes' ? 0.8 : 0.6));
  const can = s.fuel < 0.6 ? ahead.find((e) => e.kind === 'fuel') : undefined;
  const prize = can ?? ahead.find((e) => e.kind === 'commie' || e.kind === 'gold' || e.kind === 'fuel' || e.kind === 'wrench');
  if (threat) target = threat.kind === 'spikes' ? (threat.x < 0 ? 0.6 : -0.6) : threat.x > 0 ? threat.x - 0.75 : threat.x + 0.75;
  else if (prize) target = prize.x;
  // Lean into curves to cancel the outward push.
  const curve = curveAt(Math.floor(bumper / CONFIG.segmentLength));
  const steer = Math.max(-1, Math.min(1, (target - s.x) * 4 + curve * 0.08));
  return { steer, brake: false, nitro: s.nitro >= 1 };
}

describe('road to liberty: driving', () => {
  it('top speed reads 240 km/h', () => {
    expect(kmh(CONFIG.maxSpeed)).toBe(240);
  });

  it('accelerates on its own and slows down on the grass', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    drive(s, 5, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false })); // keep to the middle
    expect(s.speed).toBe(CONFIG.maxSpeed);
    s.x = 1.5;
    drive(s, 2, (st) => ({ steer: Math.max(-1, Math.min(1, (1.5 - st.x) * 4)), brake: false })); // stay on the grass
    expect(s.speed).toBe(CONFIG.offRoadMaxSpeed);
  });

  it('braking slows you down', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    s.speed = CONFIG.maxSpeed;
    drive(s, 0.5, () => ({ steer: 0, brake: true }));
    expect(s.speed).toBeLessThan(CONFIG.maxSpeed * 0.6);
  });

  it('the start is a straight road', () => {
    for (let i = 0; i < 60; i++) expect(curveAt(i)).toBe(0);
    expect([...Array(2000).keys()].some((i) => curveAt(i) !== 0)).toBe(true);
  });
});

describe('road to liberty: what you hit', () => {
  it('running over Marx pays, boosts you, and builds a combo', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'commie');
    const events = drive(s, 0.2, () => idle);
    expect(events).toContainEqual({ type: 'commie', who: 'marx', points: CONFIG.marxPoints, combo: 1 });
    expect(s.stats.commies.marx).toBe(1);
    expect(s.boostLeft).toBeGreaterThan(0);
    expect(s.combo).toBe(1 + CONFIG.comboStep);
    placeAhead(s, 'commie');
    expect(drive(s, 0.2, () => idle)).toContainEqual({ type: 'commie', who: 'marx', points: CONFIG.marxPoints * 1.5, combo: 1.5 });
  });

  it('rarer commies are worth more, and each is counted separately', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    const stalin = COMMIES.findIndex((c) => c.id === 'stalin');
    placeAhead(s, 'commie', s.x, stalin);
    expect(drive(s, 0.2, () => idle)).toContainEqual({ type: 'commie', who: 'stalin', points: 1500, combo: 1 });
    expect(s.stats.commies.stalin).toBe(1);
    expect(totalCommies(s.stats.commies)).toBe(1);
    for (const c of COMMIES.slice(1)) expect(c.points).toBeGreaterThan(CONFIG.marxPoints);
  });

  it('Marx is the most common by far; Stalin the rarest', () => {
    const picks = [...Array(1000).keys()].map((r) => COMMIES[pickCommie(r / 1000)].id);
    const count = (id: string) => picks.filter((p) => p === id).length;
    expect(count('marx')).toBeGreaterThan(400);
    for (const c of COMMIES) expect(count(c.id), c.id).toBeGreaterThan(0);
    expect(count('stalin')).toBeLessThan(count('engels'));
  });

  it('missing a commie by a lane does nothing', () => {
    const s = newGame();
    placeAhead(s, 'commie', 0.9);
    expect(drive(s, 0.3, () => idle).filter((e) => e.type === 'commie')).toEqual([]);
  });

  it('roadblocks and traffic slow you down and break the combo', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    s.combo = 3;
    placeAhead(s, 'roadblock');
    expect(drive(s, 0.1, () => idle)).toContainEqual({ type: 'crash', kind: 'roadblock' });
    expect(s.speed).toBeLessThan(CONFIG.maxSpeed * 0.4);
    expect(s.combo).toBe(1);

    const t = newGame();
    t.speed = CONFIG.maxSpeed;
    placeAhead(t, 'traffic');
    expect(drive(t, 0.1, () => idle)).toContainEqual({ type: 'crash', kind: 'traffic' });
    expect(t.speed).toBeLessThan(3000);
  });

  it('gold pays and disappears', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'gold');
    expect(drive(s, 0.1, () => idle)).toContainEqual({ type: 'gold', points: CONFIG.goldPoints });
    expect(s.entities.filter((e) => e.kind === 'gold')).toEqual([]);
  });

  it('no roadblocks during the warm-up', () => {
    for (let r = 0; r < 1; r += 0.01) expect(pickKind(r, 5)).not.toBe('roadblock');
    expect([...Array(100).keys()].some((r) => pickKind(r / 100, 60) === 'roadblock')).toBe(true);
  });
});

describe('road to liberty: fuel', () => {
  it('drains as you drive; a full tank lasts about 80 seconds flat out', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    s.nextBorderZ = Infinity; // borders top up the tank
    s.speed = CONFIG.maxSpeed;
    drive(s, 40, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    expect(s.fuel).toBeCloseTo(0.5, 1);
  });

  it('warns when low, and an empty tank caps your speed', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    s.fuel = CONFIG.lowFuel + 0.001;
    const events = drive(s, 30, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    expect(events).toContainEqual({ type: 'low-fuel' });
    expect(events).toContainEqual({ type: 'out-of-gas' });
    expect(s.speed).toBeCloseTo(CONFIG.maxSpeed * CONFIG.emptySpeed, 0);
  });

  it('a jerry can tops you up', () => {
    const s = newGame();
    s.fuel = 0.1;
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'fuel');
    expect(drive(s, 0.1, () => idle)).toContainEqual({ type: 'fuel' });
    expect(s.fuel).toBeCloseTo(0.5, 1);
  });

  it('cans turn up more often when you are low', () => {
    const share = (fuel: number) => [...Array(1000).keys()].filter((r) => pickKind(r / 1000, 60, fuel) === 'fuel').length;
    expect(share(0.1)).toBeGreaterThan(share(0.9) * 3);
  });
});

describe('road to liberty: car damage', () => {
  const center = (st: GameState): Input => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false });

  it('spikes: 10% slower for 5 seconds, and 5% slower for good', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'spikes', s.x);
    drive(s, 0.1, () => idle);
    expect(speedFactor(s)).toBeCloseTo(0.9 * 0.95, 5);
    s.nextSpawnZ = Infinity;
    drive(s, 6, center);
    expect(s.spikeSlowLeft).toBe(0);
    expect(s.damage).toBeCloseTo(0.95, 5);
    expect(s.speed).toBeCloseTo(CONFIG.maxSpeed * 0.95, 0);
  });

  it('spike damage piles up, down to a floor', () => {
    const s = newGame();
    for (let i = 0; i < 30; i++) {
      s.speed = CONFIG.maxSpeed;
      placeAhead(s, 'spikes', s.x);
      drive(s, 0.1, () => idle);
    }
    expect(s.damage).toBe(CONFIG.minDamage);
  });

  it('a cruiser ram halves your top speed for 5 seconds', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'cruiser', s.x);
    expect(drive(s, 0.1, () => idle)).toContainEqual({ type: 'crash', kind: 'cruiser' });
    expect(speedFactor(s)).toBeCloseTo(0.5, 5);
    expect(s.speed).toBeLessThanOrEqual(CONFIG.maxSpeed * 0.5 + 1);
    s.nextSpawnZ = Infinity;
    drive(s, 5.5, center);
    expect(speedFactor(s)).toBe(1);
  });

  it('a wrench fixes everything', () => {
    const s = newGame();
    s.damage = 0.7;
    s.spikeSlowLeft = 3;
    s.ramSlowLeft = 3;
    s.speed = CONFIG.maxSpeed * 0.3;
    placeAhead(s, 'wrench', s.x);
    expect(drive(s, 0.3, () => idle)).toContainEqual({ type: 'repair' });
    expect(speedFactor(s)).toBe(1);
  });

  it('wrenches are rare, and turn up more when the car is hurt', () => {
    const count = (hurt: boolean) => [...Array(2000).keys()].filter((r) => pickKind(r / 2000, 120, 1, hurt) === 'wrench').length;
    expect(count(false)).toBeGreaterThan(0);
    expect(count(false)).toBeLessThan(20);
    expect(count(true)).toBeGreaterThan(count(false) * 2);
    expect([...Array(500).keys()].some((r) => pickKind(r / 500, 20) === 'wrench')).toBe(false);
  });
});

describe('road to liberty: borders', () => {
  it('the gate ahead, the crossing message and the dashboard all name the same place', () => {
    const s = newGame();
    s.copGap = Infinity;
    s.nextSpawnZ = Infinity;
    expect(currentTerritory(s.bordersCrossed)).toBe(START_TERRITORY);
    for (let k = 0; k < 3; k++) {
      // Drive up to the next gate: it's on the road, and it names where you're going.
      s.position = (k + 1) * CONFIG.borderEvery - PLAYER_Z - 50_000;
      s.nextBorderZ = (k + 1) * CONFIG.borderEvery;
      s.entities = [];
      update(s, idle, 0.01);
      const gate = s.entities.find((e) => e.kind === 'border')!;
      expect(BORDER_NAMES[gate.variant]).toBe(BORDER_NAMES[k]);
      const events = drive(s, 6, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
      const crossing = events.find((e) => e.type === 'border');
      expect(crossing && crossing.type === 'border' && crossing.name).toBe(BORDER_NAMES[k]);
      expect(currentTerritory(s.bordersCrossed)).toBe(BORDER_NAMES[k]); // you're now in the place on the sign
    }
  });

  it('every 2.5 km: a bonus, the cops pushed back, and some fuel', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    s.copGap = 10_000;
    s.fuel = 0.5;
    expect(metersToBorder(s)).toBeCloseTo(2500 - PLAYER_Z / 180, 0);
    // Jump to just before the first border and drive through it.
    s.position = CONFIG.borderEvery - PLAYER_Z - 3000;
    const events = drive(s, 1, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    expect(events).toContainEqual({ type: 'border', name: BORDER_NAMES[0], bonus: CONFIG.borderBonus, index: 0 });
    expect(s.bordersCrossed).toBe(1);
    expect(s.copGap).toBeGreaterThan(10_000 + CONFIG.borderPushback - 5_000);
    expect(s.fuel).toBeGreaterThan(0.7);
  });

  it('you cross it wherever you are on the road, even on the grass', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    s.x = 1.8;
    s.position = CONFIG.borderEvery - PLAYER_Z - 3000;
    expect(drive(s, 1, (st) => ({ steer: Math.max(-1, Math.min(1, (1.8 - st.x) * 4)), brake: false })).some((e) => e.type === 'border')).toBe(true);
  });
});

describe('road to liberty: aggressive cops', () => {
  it('spike strips and cruisers only show up later in a run', () => {
    const kinds = (time: number) => new Set([...Array(200).keys()].map((r) => pickKind(r / 200, time)));
    expect(kinds(30).has('spikes')).toBe(false);
    expect(kinds(30).has('cruiser')).toBe(false);
    expect(kinds(70).has('spikes')).toBe(true);
    expect(kinds(70).has('cruiser')).toBe(false);
    expect(kinds(120).has('cruiser')).toBe(true);
  });

  it('a spike strip covers two lanes and leaves the third open', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'spikes', -0.3);
    s.x = 0.6; // the open lane
    expect(drive(s, 0.2, () => idle).some((e) => e.type === 'crash')).toBe(false);
    const t = newGame();
    t.speed = CONFIG.maxSpeed;
    placeAhead(t, 'spikes', -0.3);
    t.x = -0.6;
    expect(drive(t, 0.2, () => idle)).toContainEqual({ type: 'crash', kind: 'spikes' });
    expect(t.spikeSlowLeft).toBeGreaterThan(0);
  });

  it('a cruiser ahead swerves toward you', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    const cruiser: Entity = { id: 1, kind: 'cruiser', z: s.position + PLAYER_Z + 4000, x: -0.6, speed: CONFIG.maxSpeed * 0.75, vx: 0, variant: 0, hit: false };
    s.entities = [cruiser];
    s.x = 0.6;
    s.speed = CONFIG.maxSpeed * 0.75; // keep pace so it stays ahead
    drive(s, 1, (st) => ({ steer: Math.max(-1, Math.min(1, (0.6 - st.x) * 4)), brake: false }));
    expect(cruiser.x).toBeGreaterThan(-0.3);
  });

  it('warns you when spikes or a cruiser are placed up ahead', () => {
    const s = newGame();
    s.time = 200;
    const events = drive(s, 30, () => idle, rng(5));
    expect(events.some((e) => e.type === 'warning')).toBe(true);
  });
});

describe('road to liberty: day, night and weather', () => {
  it('starts in daylight, gets dark, and comes back', () => {
    expect(environment(0).daylight).toBe(1);
    expect(environment(120).daylight).toBe(0);
    expect(environment(90).daylight).toBeCloseTo(0.5, 5);
    expect(environment(CONFIG.dayLength + 10).daylight).toBe(1);
  });

  it('rain comes in showers, never in the first 45 seconds', () => {
    for (let t = 0; t < 45; t++) expect(environment(t).rain).toBe(0);
    expect(environment(60).rain).toBe(1);
    expect(environment(80).rain).toBe(0);
    expect(environment(170).rain).toBe(1);
  });

  it('rain makes the car harder to steer', () => {
    const turn = (time: number) => {
      const s = newGame();
      s.nextSpawnZ = Infinity;
      s.time = time;
      s.speed = CONFIG.maxSpeed;
      update(s, { steer: 1, brake: false }, 0.05);
      return s.x;
    };
    expect(turn(60)).toBeLessThan(turn(10));
  });

  it('announces nightfall and the rain', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    s.time = 40;
    s.copGap = Infinity; // no chase, just weather
    const events = drive(s, 60, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    expect(events).toContainEqual({ type: 'rain' });
    expect(events).toContainEqual({ type: 'nightfall' });
  });
});

describe('road to liberty: power-ups', () => {
  it('only show up after the warm-up', () => {
    const kinds = (time: number) => new Set([...Array(400).keys()].map((r) => pickKind(r / 400, time)));
    for (const p of POWER_UPS) {
      expect(kinds(10).has(p)).toBe(false);
      expect(kinds(60).has(p)).toBe(true);
    }
  });

  it('donuts slow the cops down for 10 seconds', () => {
    const gapChange = (donuts: boolean) => {
      const s = newGame();
      s.nextSpawnZ = Infinity;
      s.nextBorderZ = Infinity;
      s.speed = CONFIG.maxSpeed * 0.6; // slower than the cops
      s.copGap = 20_000;
      if (donuts) {
        placeAhead(s, 'donuts');
        update(s, idle, 0.05);
      }
      const before = s.copGap;
      drive(s, 2, () => ({ steer: 0, brake: true }));
      return s.copGap - before;
    };
    expect(gapChange(true)).toBeGreaterThan(gapChange(false));
  });

  it('the Killdozer plows through checkpoints, traffic and spikes without slowing down', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'killdozer');
    expect(drive(s, 0.1, () => idle)).toContainEqual({ type: 'power-up', kind: 'killdozer' });
    for (const kind of ['roadblock', 'traffic', 'spikes', 'cruiser'] as const) {
      placeAhead(s, kind, kind === 'spikes' ? s.x : s.x);
      const events = drive(s, 0.15, () => idle);
      expect(events.some((e) => e.type === 'smash' && e.kind === kind), kind).toBe(true);
      expect(events.some((e) => e.type === 'crash'), kind).toBe(false);
    }
    expect(s.speed).toBeGreaterThan(CONFIG.maxSpeed * 0.95);
    expect(s.stats.crashes).toBe(0);
  });

  it('...but only for 5 seconds', () => {
    const s = newGame();
    s.killdozerLeft = CONFIG.killdozerSeconds;
    drive(s, 5.2, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'roadblock');
    expect(drive(s, 0.1, () => idle)).toContainEqual({ type: 'crash', kind: 'roadblock' });
  });

  it('a smoke grenade puts the cops 90 m further back', () => {
    const s = newGame();
    s.copGap = 10_000;
    s.speed = CONFIG.maxSpeed;
    placeAhead(s, 'smoke');
    drive(s, 0.1, () => idle);
    expect(s.copGap).toBeGreaterThan(10_000 + CONFIG.smokePushback - 2_000);
    expect(s.smokeLeft).toBeGreaterThan(0);
  });
});

describe('road to liberty: scenery', () => {
  it('lines the road on both sides, out of your reach', () => {
    const s = newGame();
    s.copGap = Infinity;
    drive(s, 20, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    const scenery = s.entities.filter((e) => isScenery(e.kind));
    expect(scenery.length).toBeGreaterThan(5);
    for (const e of scenery) expect(Math.abs(e.x)).toBeGreaterThan(CONFIG.maxX + 0.4);
    expect(new Set(scenery.map((e) => Math.sign(e.x))).size).toBe(2);
  });

  it('never crashes you, even at the edge of the grass', () => {
    const s = newGame();
    s.copGap = Infinity;
    s.nextSpawnZ = Infinity;
    const events = drive(s, 30, (st) => ({ steer: Math.max(-1, Math.min(1, (CONFIG.maxX - st.x) * 4)), brake: false }));
    expect(events.filter((e) => e.type === 'crash')).toEqual([]);
  });
});

describe('road to liberty: Liberty FM', () => {
  it('plays every song once before repeating', () => {
    const order = shuffledOrder(rng(3));
    expect([...order].sort((a, b) => a - b)).toEqual(PLAYLIST.map((_, i) => i));
  });

  it("has Notorious N.A.P.'s corrected title", () => {
    expect(PLAYLIST).toContainEqual({ artist: 'Notorious N.A.P.', title: 'Mo Printing Mo Inflation' });
  });
});

describe('road to liberty: biomes', () => {
  it('cycle every 5 km: fields, desert, beach, snowfield, mountains, and around again', () => {
    const at = (km: number) => biomeAt(km * 1000 * 180 + 1).biome.id;
    expect([0, 5, 10, 15, 20, 25].map(at)).toEqual(['fields', 'desert', 'beach', 'snow', 'mountains', 'fields']);
    expect(BIOME_LENGTH).toBe(2 * CONFIG.borderEvery); // a new landscape every other border
  });

  it('blend smoothly: the road never jumps at a biome change', () => {
    const seg = CONFIG.segmentLength;
    for (let n = 1; n <= 5; n++) {
      const start = Math.floor((n * BIOME_LENGTH - 40_000) / seg);
      for (let i = start; i < start + 300; i++) {
        expect(Math.abs(heightAt(i + 1) - heightAt(i)), `segment ${i}`).toBeLessThan(260);
        expect(Math.abs(curveAt(i + 1) - curveAt(i)), `segment ${i}`).toBeLessThan(1.2);
      }
    }
  });

  it('the mountains have bigger hills than the beach', () => {
    const spread = (biome: string) => {
      const index = BIOMES.findIndex((b) => b.id === biome);
      const start = Math.floor((index * BIOME_LENGTH + 100_000) / CONFIG.segmentLength);
      const heights = Array.from({ length: 1500 }, (_, k) => heightAt(start + k));
      return Math.max(...heights) - Math.min(...heights);
    };
    expect(spread('mountains')).toBeGreaterThan(spread('beach') * 3);
  });

  it("each biome's scenery lines its own stretch of road, and at the beach it stays out of the sea", () => {
    const s = newGame();
    s.copGap = Infinity;
    s.nextSpawnZ = Infinity;
    s.position = 2 * BIOME_LENGTH + 50_000; // the beach
    s.nextSceneryZ = s.position + 1000;
    drive(s, 4, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    const beach = BIOMES.find((b) => b.id === 'beach')!;
    const scenery = s.entities.filter((e) => isScenery(e.kind) && sceneryBiome(e.z).id === 'beach');
    expect(scenery.length).toBeGreaterThan(3);
    for (const e of scenery) {
      expect(beach.scenery).toContain(e.kind);
      expect(e.x).toBeLessThan(0);
    }
  });

  it("it doesn't rain in the desert, and the snowfield is always a little icy", () => {
    const middle = (id: string) => BIOMES.findIndex((b) => b.id === id) * BIOME_LENGTH + BIOME_LENGTH / 2;
    expect(weatherSlip(middle('fields'), 1)).toBe(1);
    expect(weatherSlip(middle('desert'), 1)).toBe(0);
    expect(weatherSlip(middle('snow'), 0)).toBeGreaterThan(0.2);
    expect(weatherSlip(middle('fields'), 0)).toBe(0);
  });

  it('announces each new landscape as you drive in', () => {
    const s = newGame();
    s.copGap = Infinity;
    s.nextSpawnZ = Infinity;
    s.nextBorderZ = Infinity;
    s.position = BIOME_LENGTH - PLAYER_Z - 20_000;
    const events = drive(s, 3, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    expect(events).toContainEqual({ type: 'biome', id: 'desert', name: 'the Desert' });
  });
});

describe('road to liberty: nitro', () => {
  it('fills as you flatten commies (gold fills it less), then fires on demand', () => {
    const s = newGame();
    s.speed = CONFIG.maxSpeed;
    for (let i = 0; i < 3; i++) {
      placeAhead(s, 'commie');
      drive(s, 0.15, () => idle);
    }
    expect(s.nitro).toBeCloseTo(0.75, 5);
    placeAhead(s, 'gold');
    drive(s, 0.15, () => idle);
    expect(s.nitro).toBeCloseTo(0.85, 5);
    placeAhead(s, 'commie');
    expect(drive(s, 0.15, () => idle)).toContainEqual({ type: 'nitro-ready' });
    expect(update(s, { steer: 0, brake: false, nitro: true }, 0.016)).toContainEqual({ type: 'nitro' });
    expect(s.nitro).toBe(0);
    expect(s.nitroLeft).toBeGreaterThan(2.9);
  });

  it('a burn takes you past your normal top speed, and does nothing with an empty bottle', () => {
    const s = newGame();
    s.nextSpawnZ = Infinity;
    s.nitro = 1;
    s.speed = CONFIG.maxSpeed;
    update(s, { steer: 0, brake: false, nitro: true }, 0.016);
    drive(s, 2, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    expect(s.speed).toBeGreaterThan(CONFIG.boostSpeed);
    expect(update(s, { steer: 0, brake: false, nitro: true }, 0.016)).not.toContainEqual({ type: 'nitro' });
  });
});

describe('road to liberty: boss chases', () => {
  const center = (st: GameState): Input => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false });
  /** Drives into the next landscape so a boss shows up. */
  const meetBoss = (s: GameState) => {
    s.copGap = Infinity;
    s.nextSpawnZ = Infinity;
    s.nextBorderZ = Infinity;
    s.position = BIOME_LENGTH * (s.bossesMet + 1) - PLAYER_Z - 30_000;
    return drive(s, 3, center);
  };

  it('a new landscape brings a boss: the helicopter first, then the tank', () => {
    const s = newGame();
    expect(meetBoss(s)).toContainEqual({ type: 'boss', kind: 'helicopter' });
    s.boss = null;
    expect(meetBoss(s)).toContainEqual({ type: 'boss', kind: 'tank' });
    expect(s.entities.some((e) => e.kind === 'tank')).toBe(true);
  });

  it('the helicopter drops checkpoints and spikes in your lane', () => {
    const s = newGame();
    meetBoss(s);
    s.entities = [];
    const events = drive(s, 6, center);
    expect(events.filter((e) => e.type === 'boss-drop').length).toBeGreaterThanOrEqual(2);
    expect(s.entities.some((e) => e.kind === 'roadblock' || e.kind === 'spikes')).toBe(true);
  });

  it('surviving 30 seconds pays a bonus and holds the cops back', () => {
    const s = newGame();
    meetBoss(s);
    s.copGap = 10_000;
    s.boss!.left = 0.05;
    const score = s.score;
    const events = drive(s, 0.2, center);
    expect(events).toContainEqual({ type: 'boss-survived', kind: 'helicopter', bonus: CONFIG.bossBonus, smashed: false });
    expect(s.score).toBeGreaterThan(score + CONFIG.bossBonus - 1);
    expect(s.boss).toBeNull();
    expect(s.bossesSurvived).toBe(1);
  });

  it('the tank brake-checks you if you stay in its lane', () => {
    const s = newGame();
    meetBoss(s);
    s.boss = null;
    meetBoss(s); // the tank
    s.speed = CONFIG.maxSpeed;
    const events = drive(s, 8, (st) => ({ steer: Math.max(-1, Math.min(1, ((st.boss ? st.boss.x : 0) - st.x) * 4)), brake: false }));
    expect(events).toContainEqual({ type: 'crash', kind: 'tank' });
    expect(s.entities.some((e) => e.kind === 'tank')).toBe(true); // still chasing
  });

  it('...but the Killdozer flattens it, for double the bonus', () => {
    const s = newGame();
    meetBoss(s);
    s.boss = null;
    meetBoss(s);
    s.killdozerLeft = 30;
    const events = drive(s, 8, (st) => ({ steer: Math.max(-1, Math.min(1, ((st.boss ? st.boss.x : 0) - st.x) * 4)), brake: false }));
    const won = events.find((e) => e.type === 'boss-survived');
    expect(won && won.type === 'boss-survived' && won.smashed).toBe(true);
    expect(s.entities.some((e) => e.kind === 'tank')).toBe(false);
  });
});

describe('road to liberty: the garage', () => {
  it('the stock car matches the base rules', () => {
    const car = carStats();
    expect(car.spikeDamage).toBe(CONFIG.spikeDamage);
    expect(car.spikeSlow).toBe(CONFIG.spikeSlow);
    expect(car.fuelSeconds).toBe(CONFIG.fuelSeconds);
    expect(car.ramSlow).toBe(CONFIG.ramSlow);
    expect(newGame().copGap).toBe(CONFIG.copStartGap);
  });

  it('upgrades cost more each level, need the savings, and stop at level 3', () => {
    const levels = stockCar();
    expect(buyUpgrade(levels, 'jammer', 5_000)).toBeNull();
    expect(buyUpgrade(levels, 'jammer', 50_000)).toBe(40_000);
    expect(nextCost(levels, 'jammer')).toBe(30_000);
    levels.jammer = 3;
    expect(nextCost(levels, 'jammer')).toBeNull();
    expect(buyUpgrade(levels, 'jammer', 1e9)).toBeNull();
  });

  it('upgrades change the car: a head start, a bigger tank, more top speed', () => {
    const levels = { ...stockCar(), jammer: 2, tank: 3, turbo: 3 };
    const s = newGame(levels);
    expect(s.copGap).toBe(CONFIG.copStartGap + 60 * 180);
    expect(s.car.fuelSeconds).toBe(140);
    s.nextSpawnZ = Infinity;
    s.copGap = Infinity;
    drive(s, 5, (st) => ({ steer: Math.max(-1, Math.min(1, -st.x * 4)), brake: false }));
    expect(s.speed).toBeCloseTo(CONFIG.maxSpeed * 1.09, 0);
  });

  it('saves are cleaned up', () => {
    expect(normalizeLevels({ tires: 9, tank: -1, turbo: '2', bogus: 3 })).toEqual({ ...stockCar(), tires: 3, turbo: 2 });
    expect(normalizeLevels(null)).toEqual(stockCar());
  });
});

describe('road to liberty: Rothbard', () => {
  it('has something to say for every cue, and avoids repeating himself', () => {
    for (const lines of Object.values(LINES)) expect(lines.length).toBeGreaterThan(0);
    const first = pickLine('marx', 0);
    expect(pickLine('marx', 0, first)).not.toBe(first);
  });
});

describe('road to liberty: the chase', () => {
  it('the cops get faster over time and with every km, eventually outpacing you', () => {
    expect(copSpeed(240, 0)).toBeLessThan(copSpeed(240, 10_000));
    expect(copSpeed(600, 30_000)).toBeGreaterThan(CONFIG.maxSpeed);
    expect(copSpeed(10_000, 1e9)).toBe(CONFIG.maxSpeed * CONFIG.copSpeedCap);
  });

  it('early on the cops are slower than you', () => {
    expect(copSpeed(0)).toBeLessThan(copSpeed(120));
    expect(copSpeed(10_000)).toBeLessThan(CONFIG.maxSpeed);
  });

  it('parking on the grass gets you busted', () => {
    const s = newGame();
    s.x = 2;
    const events = drive(s, 60, () => idle);
    expect(events).toContainEqual({ type: 'busted' });
    expect(s.over).toBe(true);
  });

  it('a decent driver outruns the cops for a good while and flattens plenty of commies', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame();
      drive(s, 120, autopilot, rng(seed));
      expect(s.over, `seed ${seed}`).toBe(false);
      expect(totalCommies(s.stats.commies), `seed ${seed}`).toBeGreaterThan(10);
    }
  });

  it('a driver who never steers gets caught', () => {
    const s = newGame();
    drive(s, 600, () => idle, rng(7));
    expect(s.over).toBe(true);
  });
});
