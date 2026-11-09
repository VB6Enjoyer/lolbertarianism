import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, normalizeLifetime, normalizeUnlocked, Tracker } from './achievements.ts';
import { newGame, UNITS_PER_METER, type GameEvent, type GameState } from './logic.ts';

function setup() {
  const unlocked = new Set<string>();
  const lifetime = { busts: 0, commies: 0 };
  const tracker = new Tracker(unlocked, lifetime);
  const state = newGame();
  tracker.startRun(state);
  return { unlocked, lifetime, tracker, state };
}

/** Moves time forward and runs the tracker, like main.ts does each frame. */
function tick(tracker: Tracker, state: GameState, events: GameEvent[] = [], seconds = 0.1) {
  state.time += seconds;
  return tracker.update(state, events);
}

describe('achievements', () => {
  it('all have unique ids, an icon, a name and a description', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.icon && a.name && a.description, a.id).toBeTruthy();
  });

  it('unlock once, and report it only the first time', () => {
    const { tracker, state } = setup();
    expect(tick(tracker, state, [{ type: 'commie', who: 'marx', points: 500, combo: 1 }])).toEqual(['first-commie']);
    expect(tick(tracker, state, [{ type: 'commie', who: 'marx', points: 500, combo: 1 }])).toEqual([]);
  });

  it('Stalin, and the whole politburo in one run', () => {
    const { tracker, state } = setup();
    expect(tick(tracker, state, [{ type: 'commie', who: 'stalin', points: 1500, combo: 1 }])).toContain('stalin');
    state.stats.commies = { marx: 1, engels: 1, lenin: 1, stalin: 1, mao: 1, che: 0 };
    expect(tick(tracker, state)).not.toContain('politburo');
    state.stats.commies.che = 1;
    expect(tick(tracker, state)).toContain('politburo');
  });

  it('combos, distance, time and score milestones', () => {
    const { tracker, state } = setup();
    state.combo = 5;
    state.stats.meters = 10_000;
    state.score = 100_000;
    state.time = 299;
    const found = tick(tracker, state, [], 2);
    expect(found).toEqual(expect.arrayContaining(['combo-5', 'km-10', 'score-50k', 'score-100k', 'survive-3', 'survive-5']));
    expect(found).not.toContain('combo-10');
  });

  it('a Killdozer that smashes 5 things', () => {
    const { tracker, state } = setup();
    state.killdozerLeft = 3;
    const smash: GameEvent = { type: 'smash', kind: 'traffic', points: 250 };
    for (let i = 0; i < 4; i++) expect(tick(tracker, state, [smash])).toEqual([]);
    expect(tick(tracker, state, [smash])).toContain('killdozer');
  });

  it("smashes don't add up across different Killdozers", () => {
    const { tracker, state } = setup();
    const smash: GameEvent = { type: 'smash', kind: 'traffic', points: 250 };
    state.killdozerLeft = 3;
    for (let i = 0; i < 3; i++) tick(tracker, state, [smash]);
    state.killdozerLeft = 0;
    tick(tracker, state);
    state.killdozerLeft = 3;
    for (let i = 0; i < 3; i++) expect(tick(tracker, state, [smash])).toEqual([]);
  });

  it('a close shave: within 10 m of the cops, then 100 m ahead', () => {
    const { tracker, state } = setup();
    state.copGap = 5 * UNITS_PER_METER;
    expect(tick(tracker, state)).toEqual([]);
    state.copGap = 101 * UNITS_PER_METER;
    expect(tick(tracker, state)).toContain('close-call');
  });

  it('smoke with the cops right behind you', () => {
    const { tracker, state } = setup();
    state.copGap = 15 * UNITS_PER_METER;
    tick(tracker, state);
    state.copGap += 90 * UNITS_PER_METER; // the smoke pushes them back this frame
    expect(tick(tracker, state, [{ type: 'power-up', kind: 'smoke' }])).toContain('smoke');
  });

  it('a minute without a crash; a crash restarts the clock', () => {
    const { tracker, state } = setup();
    tick(tracker, state, [], 50);
    tick(tracker, state, [{ type: 'crash', kind: 'traffic' }], 1);
    expect(tick(tracker, state, [], 50)).not.toContain('nap');
    expect(tick(tracker, state, [], 11)).toContain('nap');
  });

  it('running dry and then finding a can', () => {
    const { tracker, state } = setup();
    tick(tracker, state, [{ type: 'out-of-gas' }]);
    expect(tick(tracker, state, [{ type: 'fuel' }])).toContain('fumes');
  });

  it('repairing a badly damaged car', () => {
    const { tracker, state } = setup();
    state.damage = 0.65;
    tick(tracker, state);
    state.damage = 1;
    expect(tick(tracker, state, [{ type: 'repair' }])).toContain('mechanic');
  });

  it('seeing every landscape in one run, starting with the countryside', () => {
    const { tracker, state } = setup();
    for (const id of ['desert', 'beach', 'snow'] as const) tick(tracker, state, [{ type: 'biome', id, name: id }]);
    expect(tick(tracker, state, [{ type: 'biome', id: 'mountains', name: 'the Mountains' }])).toContain('all-biomes');
  });

  it('end of run: the high-score table and lifetime counters', () => {
    const { tracker, state, lifetime } = setup();
    state.stats.commies.marx = 250;
    expect(tracker.endRun(state, 0)).toEqual(expect.arrayContaining(['hall-of-fame', 'top']));
    expect(lifetime).toEqual({ busts: 1, commies: 250 });
    for (let i = 0; i < 8; i++) tracker.endRun(newGame(), -1);
    expect(tracker.endRun(state, -1)).toEqual(expect.arrayContaining(['busts-10', 'lifetime-500']));
  });

  it('nitro: the first burn, and five in one run', () => {
    const { tracker, state } = setup();
    state.nitroUsed = 1;
    expect(tick(tracker, state, [{ type: 'nitro' }])).toEqual(['nitro']);
    state.nitroUsed = 5;
    expect(tick(tracker, state, [{ type: 'nitro' }])).toEqual(['nitro-5']);
  });

  it('bosses: surviving each one, and flattening the tank', () => {
    const { tracker, state } = setup();
    expect(tick(tracker, state, [{ type: 'boss-survived', kind: 'helicopter', bonus: 3000, smashed: false }])).toEqual(['heli']);
    expect(tick(tracker, state, [{ type: 'boss-survived', kind: 'tank', bonus: 12000, smashed: true }])).toEqual(['tank', 'heemeyer']);
  });

  it('the garage: first upgrade, one maxed, all maxed, a million saved', () => {
    const { tracker } = setup();
    const levels = { tires: 0, tank: 0, turbo: 0, nitro: 0, armor: 0, jammer: 0 };
    expect(tracker.checkGarage(levels, 0)).toEqual([]);
    levels.tires = 1;
    expect(tracker.checkGarage(levels, 0)).toEqual(['garage-first']);
    levels.tires = 3;
    expect(tracker.checkGarage(levels, 0)).toEqual(['garage-max']);
    for (const k of Object.keys(levels) as (keyof typeof levels)[]) levels[k] = 3;
    expect(tracker.checkGarage(levels, 1_000_000)).toEqual(['garage-all', 'savings-1m']);
  });

  it('parades, tolls and the horn', () => {
    const { tracker, state } = setup();
    const marcher: GameEvent = { type: 'commie', who: 'marx', points: 500, combo: 1, parade: true };
    tick(tracker, state, [marcher, marcher, marcher, marcher]);
    expect(tick(tracker, state, [marcher])).toContain('parade');
    expect(tick(tracker, state, [{ type: 'toll-evaded', bonus: 1500 }])).toEqual(['toll']);
    state.honks = 10;
    expect(tick(tracker, state, [{ type: 'horn', cleared: 0 }])).toEqual(['honk']);
  });

  it('daily runs, a week of them, and every car', () => {
    const { tracker, state } = setup();
    expect(tracker.endRun(state, -1, { days: 1 })).toContain('daily');
    expect(tracker.endRun(state, -1, { days: 7 })).toContain('daily-7');
    expect(tracker.checkCars(false)).toEqual([]);
    expect(tracker.checkCars(true)).toEqual(['cars-all']);
  });

  it('250 and 500 commies in one run; 3,000 in total, counting the run in progress', () => {
    const { tracker, state, lifetime } = setup();
    state.stats.commies.marx = 249;
    expect(tick(tracker, state)).not.toContain('commies-250');
    state.stats.commies.marx = 250;
    expect(tick(tracker, state)).toContain('commies-250');
    state.stats.commies.marx = 500;
    expect(tick(tracker, state)).toEqual(expect.arrayContaining(['commies-500', 'lifetime-500']));
    lifetime.commies = 2499;
    expect(tick(tracker, state)).not.toContain('lifetime-3000');
    state.stats.commies.mao = 1;
    expect(tick(tracker, state)).toContain('lifetime-3000');
  });

  it('×25 and ×50 combos', () => {
    const { tracker, state } = setup();
    state.combo = 25;
    expect(tick(tracker, state)).toContain('combo-25');
    state.combo = 50;
    expect(tick(tracker, state)).toContain('combo-50');
  });

  it('nitro ten times in one run', () => {
    const { tracker, state } = setup();
    state.nitroUsed = 10;
    expect(tick(tracker, state, [{ type: 'nitro' }])).toContain('nitro-10');
  });

  it('30 seconds hands off the wheel; touching it restarts the clock', () => {
    const { tracker, state } = setup();
    tracker.update(state, [], 0);
    tick(tracker, state, [], 20);
    state.time += 1;
    tracker.update(state, [], 0.6);
    expect(tick(tracker, state, [], 25)).not.toContain('hands-off');
    expect(tick(tracker, state, [], 6)).toContain('hands-off');
  });

  it('ten spike strips in one run, and Killdozer smashes do not count', () => {
    const { tracker, state } = setup();
    for (let i = 0; i < 5; i++) tick(tracker, state, [{ type: 'smash', kind: 'spikes', points: 250 }]);
    for (let i = 0; i < 9; i++) expect(tick(tracker, state, [{ type: 'crash', kind: 'spikes' }])).not.toContain('spikes-10');
    expect(tick(tracker, state, [{ type: 'crash', kind: 'spikes' }])).toContain('spikes-10');
  });

  it('saves are cleaned up', () => {
    expect([...normalizeUnlocked(['stalin', 'nope', 3])]).toEqual(['stalin']);
    expect(normalizeLifetime({ busts: '4', commies: -2 })).toEqual({ busts: 4, commies: 0 });
    expect(normalizeLifetime(null)).toEqual({ busts: 0, commies: 0 });
  });
});
