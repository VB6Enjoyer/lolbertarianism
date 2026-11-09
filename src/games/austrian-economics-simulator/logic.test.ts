import { describe, expect, it } from 'vitest';
import { findPath, isRoad, MANHOLE_SLOTS, PLACES, placeById, STARTING_SLOTS } from './map.ts';
import { act, buyDrug, buyGear, CONFIG, context, drugPrice, newGame, phaseAt, scrapMultiplier, scrapPrice, SCHEDULE, update, walkTo, type GameEvent, type GameState, type Input } from './logic.ts';
import { ACHIEVEMENTS, normalizeUnlocked, Tracker } from './achievements.ts';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const still: Input = { dir: null };

/** Runs the game for a while; returns every event. */
function run(state: GameState, seconds: number, input: Input = still, r = rng(1), keepFixed = false): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    if (keepFixed) state.fix = 1;
    events.push(...update(state, input, 1 / 60, r));
  }
  return events;
}

/** A quiet town: no cops or passers-by, so tests aren't disturbed. */
function quiet(): GameState {
  const s = newGame(rng(1));
  s.agents = [];
  s.pedRespawns = [];
  s.nextCrewAt = Infinity;
  s.nextDeaAt = Infinity;
  return s;
}

/** Puts you on a tile. */
function teleport(s: GameState, x: number, y: number) {
  s.player.mover = { x, y, path: [] };
}

describe('austrian economics: the map', () => {
  it('every door and manhole is on a street, and every street tile can reach every other', () => {
    for (const p of PLACES) expect(isRoad(p.door.x, p.door.y), p.id).toBe(true);
    for (const h of MANHOLE_SLOTS) expect(isRoad(h.x, h.y)).toBe(true);
    expect(findPath({ x: 0, y: 1 }, { x: 17, y: 9 }).length).toBe(17 + 8);
  });
});

describe('austrian economics: the Fed', () => {
  it('a calm start, then booms and busts', () => {
    expect(phaseAt(10).phase).toBe('calm');
    expect(phaseAt(SCHEDULE.calm + 1)).toMatchObject({ phase: 'boom', cycle: 0 });
    expect(phaseAt(SCHEDULE.calm + SCHEDULE.boom + 1)).toMatchObject({ phase: 'bust', cycle: 0 });
    expect(phaseAt(SCHEDULE.calm + SCHEDULE.boom + SCHEDULE.bust + 1)).toMatchObject({ phase: 'boom', cycle: 1 });
  });

  it('scrap is a bubble in the boom and crashes in the bust', () => {
    const boomStart = SCHEDULE.calm;
    const bustStart = SCHEDULE.calm + SCHEDULE.boom;
    expect(scrapMultiplier(10)).toBe(1);
    expect(scrapMultiplier(bustStart - 0.01)).toBeGreaterThan(2);
    expect(scrapMultiplier(boomStart + 10)).toBeLessThan(scrapMultiplier(boomStart + 30));
    expect(scrapMultiplier(bustStart + 5)).toBeLessThan(0.5);
  });

  it('Cantillon: the yard by the Fed hears the news first', () => {
    const s = newGame(rng(1));
    s.time = SCHEDULE.calm + SCHEDULE.boom - 1; // the top of the boom
    expect(scrapPrice(s, 'yard-near')).toBeGreaterThan(scrapPrice(s, 'yard-far') * 1.3);
    s.time = SCHEDULE.calm + SCHEDULE.boom + 6; // the crash
    expect(scrapPrice(s, 'yard-near')).toBeLessThan(scrapPrice(s, 'yard-far'));
  });

  it('announces each change a few seconds ahead, then makes it: new covers in the boom, more cops in the bust', () => {
    const s = quiet();
    const events = run(s, SCHEDULE.calm + SCHEDULE.boom + 1, still, rng(1), true);
    const fomc = events.filter((e) => e.type === 'fomc');
    expect(fomc.map((e) => e.type === 'fomc' && e.next)).toEqual(['boom', 'bust']);
    expect(events).toContainEqual({ type: 'phase', phase: 'boom', rate: 0.25, cycle: 0 });
    expect(events).toContainEqual({ type: 'new-covers', count: 3 });
    expect(s.manholes.filter((h) => h.state === 'covered')).toHaveLength(STARTING_SLOTS + 3);
    expect(events.some((e) => e.type === 'cop-joins')).toBe(true);
    expect(s.priceLevel).toBeGreaterThan(1.2); // inflation
  });
});

describe('austrian economics: the loop', () => {
  it('steal → sell → buy → replaced is one lap', () => {
    const s = quiet();
    s.fix = 0.5;
    const hole = s.manholes.find((h) => h.state === 'covered')!;
    teleport(s, hole.x, hole.y);
    expect(context(s)).toMatchObject({ kind: 'pry' });
    expect(act(s)).toEqual([{ type: 'pry-start' }]);
    const stolen = run(s, CONFIG.pryTime + 0.1);
    expect(stolen).toContainEqual({ type: 'stole', underCrewsNose: false });
    expect(s.carried).toBe(1);
    expect(hole.state).toBe('open');
    expect(context(s)).toBeNull(); // nothing left to pry here

    const yard = placeById('yard-near').door;
    teleport(s, yard.x, yard.y);
    const sold = act(s);
    expect(sold[0]).toMatchObject({ type: 'sold', count: 1, yard: 'yard-near' });
    expect(s.cash).toBeCloseTo(CONFIG.startCash + scrapPrice(s, 'yard-near'), 0);

    const dealer = placeById('dealer').door;
    teleport(s, dealer.x, dealer.y);
    const before = s.cash;
    const crack = drugPrice(s, 'crack');
    expect(buyDrug(s, 'crack')).toContainEqual({ type: 'bought', drug: 'crack', price: crack, dea: false });
    expect(s.cash).toBeCloseTo(before - crack);
    expect(s.fix).toBeCloseTo(1, 1);
    expect(s.step).toBe(3);

    // A crew comes and fixes it.
    s.nextCrewAt = 0;
    const later = run(s, 20);
    expect(later).toContainEqual({ type: 'replaced', yours: true, x: hole.x, y: hole.y });
    expect(later).toContainEqual({ type: 'lap', laps: 1, bonus: CONFIG.lapUtils });
    expect(hole.state).toBe('covered');
  });

  it('walking away stops the prying', () => {
    const s = quiet();
    const hole = s.manholes.find((h) => h.state === 'covered' && h.y === 5)!;
    teleport(s, hole.x, hole.y);
    act(s);
    expect(run(s, 0.4, { dir: { x: 1, y: 0 } })).toContainEqual({ type: 'pry-cancel' });
    expect(hole.state).toBe('covered');
  });

  it('you carry one cover by hand (and you are slow with it); a cart carries three', () => {
    const s = quiet();
    s.carried = 1;
    const hole = s.manholes.find((h) => h.state === 'covered')!;
    teleport(s, hole.x, hole.y);
    expect(context(s)).toEqual({ kind: 'full' });
    s.gear.cart = true;
    expect(context(s)).toMatchObject({ kind: 'pry' });
  });

  it('the squat keeps covers for later', () => {
    const s = quiet();
    const squat = placeById('squat').door;
    teleport(s, squat.x, squat.y);
    s.carried = 1;
    expect(act(s)).toEqual([{ type: 'stashed', count: 1 }]);
    expect(s.stash).toBe(1);
    expect(act(s)).toEqual([{ type: 'took', count: 1 }]);
    expect(s.carried).toBe(1);
  });

  it('capital goods cost money, and only at the hardware store', () => {
    const s = quiet();
    expect(buyGear(s, 'crowbar')).toEqual([]);
    const shop = placeById('hardware').door;
    teleport(s, shop.x, shop.y);
    expect(buyGear(s, 'bike')).toEqual([{ type: 'broke', price: 120 }]);
    expect(buyGear(s, 'crowbar')).toEqual([{ type: 'gear', id: 'crowbar' }]);
    expect(s.gear.crowbar).toBe(true);
    expect(s.cash).toBe(CONFIG.startCash - 50);
  });

  it('tap to walk: follows the streets there', () => {
    const s = quiet();
    const dealer = placeById('dealer').door;
    walkTo(s, dealer);
    run(s, 10);
    expect(s.player.mover).toMatchObject({ x: dealer.x, y: dealer.y });
    expect(context(s)).toEqual({ kind: 'dealer' });
  });

  it('the keys walk you along the street and stop at the next tile', () => {
    const s = quiet();
    // Can't walk into a building (below the squat's door)
    run(s, 0.5, { dir: { x: 0, y: 1 } });
    expect(s.player.mover.y).toBe(5);
    run(s, 0.5, { dir: { x: 1, y: 0 } });
    expect(s.player.mover.x).toBeGreaterThan(5);
    run(s, 1);
    expect(Number.isInteger(s.player.mover.x)).toBe(true);
  });
});

describe('austrian economics: losing', () => {
  it('withdrawal: the fix wears off', () => {
    const s = quiet();
    const events = run(s, CONFIG.fixSeconds + 1);
    expect(events).toContainEqual({ type: 'withdrawal' });
    expect(events).toContainEqual({ type: 'over', reason: 'withdrawal' });
  });

  it('prying in front of a cop gets you arrested', () => {
    const s = quiet();
    const hole = s.manholes.find((h) => h.state === 'covered')!;
    teleport(s, hole.x, hole.y);
    s.agents.push({ id: 1, kind: 'cop', mover: { x: hole.x, y: hole.y, path: [{ x: hole.x, y: hole.y }] }, down: 0, target: null, work: 0, leaving: false, variant: 0 });
    // Keep the cop standing there
    s.agents[0].mover.path = [];
    const events: GameEvent[] = [];
    for (let i = 0; i < 4; i++) {
      events.push(...act(s));
      for (let k = 0; k < 60 && !s.over; k++) {
        s.agents[0].mover = { x: hole.x + 0.5, y: hole.y, path: [] };
        events.push(...update(s, still, 1 / 60, rng(2)));
      }
      hole.state = 'covered';
      s.carried = 0;
    }
    expect(events).toContainEqual({ type: 'seen', by: 'cop' });
    expect(s.over).toBe('arrested');
  });

  it('passers-by fall into open manholes; cops climb back out', () => {
    const s = quiet();
    const hole = s.manholes[0];
    hole.state = 'open';
    const next = { x: hole.x - 1, y: hole.y };
    for (let i = 0; i < 30; i++) {
      s.agents = [{ id: 1, kind: 'ped', mover: { x: next.x, y: next.y, path: [{ x: hole.x, y: hole.y }] }, down: 0, target: null, work: 0, leaving: false, variant: 0 }];
      const events = run(s, 1, still, rng(i));
      if (events.some((e) => e.type === 'fell')) {
        expect(s.agents).toHaveLength(0);
        expect(s.heat).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error('nobody fell in');
  });
});

describe('austrian economics: achievements', () => {
  it('unique ids, all filled in', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.icon && a.name && a.description).toBeTruthy();
  });

  it("selling the top at the Fed's yard, and both drugs", () => {
    const t = new Tracker(new Set());
    const s = newGame();
    expect(t.update(s, [{ type: 'sold', count: 1, total: 40, yard: 'yard-near', price: 40, otherPrice: 25, multiplier: 2.3 }])).toEqual(['peak', 'cantillon']);
    t.update(s, [{ type: 'bought', drug: 'heroin', price: 40, dea: false }]);
    expect(t.update(s, [{ type: 'bought', drug: 'crack', price: 30, dea: true }])).toEqual(['both', 'dea']);
  });

  it('saving up, capital goods and staying alive', () => {
    const t = new Tracker(new Set());
    const s = newGame();
    s.stash = 5;
    s.gear = { crowbar: true, cart: true, vest: true, bike: true };
    s.time = 301;
    expect(t.update(s, [])).toEqual(expect.arrayContaining(['stash-5', 'capital', 'survive-5']));
    expect([...normalizeUnlocked(['lap', 'nope'])]).toEqual(['lap']);
  });
});
