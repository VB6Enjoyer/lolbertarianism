import { describe, expect, it } from 'vitest';
import { BORDER_NAMES, CONFIG, copSpeed, curveAt, environment, kmh, metersToBorder, newGame, pickKind, PLAYER_Z, update, type Entity, type GameState, type Input } from './logic.ts';
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
function placeAhead(state: GameState, kind: Entity['kind'], x = state.x): Entity {
  const e: Entity = { id: 999, kind, z: state.position + PLAYER_Z + 50, x, speed: kind === 'traffic' ? 3000 : 0, vx: 0, variant: 0, hit: false };
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
  const threat = ahead.find((e) => (e.kind === 'roadblock' || e.kind === 'traffic') && Math.abs(e.x - s.x) < 0.6);
  const can = s.fuel < 0.6 ? ahead.find((e) => e.kind === 'fuel') : undefined;
  const prize = can ?? ahead.find((e) => e.kind === 'marx' || e.kind === 'gold' || e.kind === 'fuel');
  if (threat) target = threat.x > 0 ? threat.x - 0.75 : threat.x + 0.75;
  else if (prize) target = prize.x;
  // Lean into curves to cancel the outward push.
  const curve = curveAt(Math.floor(bumper / CONFIG.segmentLength));
  const steer = Math.max(-1, Math.min(1, (target - s.x) * 4 + curve * 0.08));
  return { steer, brake: false };
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
    placeAhead(s, 'marx');
    const events = drive(s, 0.2, () => idle);
    expect(events).toContainEqual({ type: 'marx', points: CONFIG.marxPoints, combo: 1 });
    expect(s.stats.marxFlattened).toBe(1);
    expect(s.boostLeft).toBeGreaterThan(0);
    expect(s.combo).toBe(1 + CONFIG.comboStep);
    placeAhead(s, 'marx');
    expect(drive(s, 0.2, () => idle)).toContainEqual({ type: 'marx', points: CONFIG.marxPoints * 1.5, combo: 1.5 });
  });

  it('missing Marx by a lane does nothing', () => {
    const s = newGame();
    placeAhead(s, 'marx', 0.9);
    expect(drive(s, 0.3, () => idle).filter((e) => e.type === 'marx')).toEqual([]);
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

describe('road to liberty: borders', () => {
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
    expect(t.speed).toBeLessThan(CONFIG.maxSpeed * 0.5);
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

describe('road to liberty: Rothbard', () => {
  it('has something to say for every cue, and avoids repeating himself', () => {
    for (const lines of Object.values(LINES)) expect(lines.length).toBeGreaterThan(0);
    const first = pickLine('marx', 0);
    expect(pickLine('marx', 0, first)).not.toBe(first);
  });
});

describe('road to liberty: the chase', () => {
  it('the cops get faster, but never as fast as you', () => {
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

  it('a decent driver outruns the cops for a good while and flattens plenty of Marxes', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame();
      drive(s, 120, autopilot, rng(seed));
      expect(s.over, `seed ${seed}`).toBe(false);
      expect(s.stats.marxFlattened, `seed ${seed}`).toBeGreaterThan(10);
    }
  });

  it('a driver who never steers gets caught', () => {
    const s = newGame();
    drive(s, 600, () => idle, rng(7));
    expect(s.over).toBe(true);
  });
});
