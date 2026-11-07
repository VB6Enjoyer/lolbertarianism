import { describe, expect, it } from 'vitest';
import { CONFIG, copSpeed, curveAt, kmh, newGame, pickKind, PLAYER_Z, update, type Entity, type GameState, type Input } from './logic.ts';

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
  const prize = ahead.find((e) => e.kind === 'marx' || e.kind === 'gold');
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
