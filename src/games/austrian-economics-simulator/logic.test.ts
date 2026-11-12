import { describe, expect, it } from 'vitest';
import { COLS, DISTRICTS, FED_COVER, findPath, isRoad, MANHOLE_SLOTS, PLACES, placeAtDoor, placeById, ROAD_TILES, ROWS, setDistrict, STARTING_SLOTS } from './map.ts';
import { act, CITY_EVENTS, inflation, newContract, phaseEnd, rateFor, borrow, buyDrug, buyGear, buyGold, COVER_VALUE, CONFIG, context, deposit, drugPrice, goldPrice, newGame, repay, sellGold, withdraw, phaseAt, scrapMultiplier, scrapPrice, SCHEDULE, update, walkTo, type GameEvent, type GameState, type Input } from './logic.ts';
import { ACHIEVEMENTS, normalizeUnlocked, Tracker } from './achievements.ts';
import { dailyFor, normalizeDailyBests, seededRng, TWISTS } from './daily.ts';
import { LINES, pickLine } from './rothbard.ts';

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
  s.nextEventAt = Infinity;
  s.rivals = 99; // no rival scrappers
  s.nextContractAt = Infinity;
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
    expect(s.manholes.filter((h) => h.state === 'covered' && h.kind !== 'fed')).toHaveLength(STARTING_SLOTS + 3);
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
    expect(stolen).toContainEqual({ type: 'stole', underCrewsNose: false, kind: hole.kind });
    expect(s.cargo).toEqual([hole.kind]);
    expect(hole.state).toBe('open');
    expect(context(s)).toBeNull(); // nothing left to pry here

    const yard = placeById('yard-near').door;
    teleport(s, yard.x, yard.y);
    const sold = act(s);
    expect(sold[0]).toMatchObject({ type: 'sold', count: 1, yard: 'yard-near' });
    expect(s.cash).toBeCloseTo(CONFIG.startCash + scrapPrice(s, 'yard-near') * COVER_VALUE[hole.kind], 0);

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
    s.cargo = ['iron'];
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
    s.cargo = ['brass'];
    expect(act(s)).toEqual([{ type: 'stashed', count: 1 }]);
    expect(s.stash).toEqual(['brass']);
    expect(act(s)).toEqual([{ type: 'took', count: 1 }]);
    expect(s.cargo).toEqual(['brass']);
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
    s.agents.push({ id: 1, kind: 'cop', mover: { x: hole.x, y: hole.y, path: [{ x: hole.x, y: hole.y }] }, down: 0, target: null, work: 0, leaving: false, variant: 0, load: 0 });
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
      s.cargo = [];
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
      s.agents = [{ id: 1, kind: 'ped', mover: { x: next.x, y: next.y, path: [{ x: hole.x, y: hole.y }] }, down: 0, target: null, work: 0, leaving: false, variant: 0, load: 0 }];
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

describe('austrian economics: money', () => {
  const atBank = (s: GameState) => teleport(s, placeById('fed').door.x, placeById('fed').door.y);

  it('savings earn the Fed rate: little in a boom, a lot in a bust', () => {
    const boom = quiet();
    const bust = quiet();
    for (const [s, t] of [[boom, SCHEDULE.calm + 1], [bust, SCHEDULE.calm + SCHEDULE.boom + 1]] as const) {
      s.time = t;
      run(s, 0.1, still, rng(1), true);
      atBank(s);
      expect(deposit(s)[0]).toMatchObject({ type: 'deposited', amount: CONFIG.startCash });
      run(s, 20, still, rng(1), true);
    }
    expect(boom.savings).toBeLessThan(CONFIG.startCash * 1.01);
    expect(bust.savings).toBeGreaterThan(CONFIG.startCash * 1.07);
    expect(withdraw(bust)[0]).toMatchObject({ type: 'withdrew' });
    expect(bust.cash).toBeGreaterThan(CONFIG.startCash * 1.07);
  });

  it('loans are called in at the bust; repay in time, or lose everything', () => {
    const s = quiet();
    s.time = SCHEDULE.calm + 1;
    run(s, 0.1, still, rng(1), true);
    atBank(s);
    expect(borrow(s)[0]).toMatchObject({ type: 'borrowed', phase: 'boom' });
    borrow(s);
    borrow(s);
    expect(borrow(s)).toEqual([]); // credit limit
    expect(s.debt).toBeCloseTo(300 * s.priceLevel, 0);
    // Into the bust: the loan is called
    const called = run(s, SCHEDULE.boom, still, rng(1), true);
    expect(called.find((e) => e.type === 'loan-called')).toBeTruthy();
    expect(s.loanDue).toBeCloseTo(SCHEDULE.calm + SCHEDULE.boom + SCHEDULE.bust, 0);
    // Pay it off: no default
    const owed = s.debt;
    s.cash = owed + 10;
    expect(repay(s)).toEqual([{ type: 'repaid', amount: owed, cleared: true, called: true }]);
    expect(s.loanDue).toBeNull();

    // Again, but don't pay
    const t = quiet();
    t.time = SCHEDULE.calm + 1;
    run(t, 0.1, still, rng(1), true);
    atBank(t);
    borrow(t);
    t.stash = ['brass'];
    t.gold = 2;
    const later = run(t, SCHEDULE.boom + SCHEDULE.bust, still, rng(1), true);
    expect(later.find((e) => e.type === 'default')).toBeTruthy();
    expect([t.cash, t.savings, t.gold, t.stash.length, t.debt]).toEqual([0, 0, 0, 0, 0]);
    expect(t.heat).toBeGreaterThan(0);
  });

  it('gold keeps up with inflation and rallies in the bust; the pawn shop takes a cut', () => {
    const s = quiet();
    const pawn = placeById('pawn').door;
    teleport(s, pawn.x, pawn.y);
    expect(context(s)).toEqual({ kind: 'pawn' });
    expect(goldPrice(s, 'sell')).toBeLessThan(goldPrice(s, 'buy'));
    expect(buyGold(s)[0]).toMatchObject({ type: 'gold-bought' });
    const paid = CONFIG.startCash - s.cash;
    // A boom and into the bust: the price level is up, and gold with it
    s.time = SCHEDULE.calm + SCHEDULE.boom + 15;
    s.priceLevel = 1.3;
    const [sold] = sellGold(s);
    expect(sold).toMatchObject({ type: 'gold-sold', count: 1, phase: 'calm' }); // the phase updates on the next frame
    expect(sold.type === 'gold-sold' && sold.total).toBeGreaterThan(paid * 1.25);
  });

  it("brass covers pay three times as much and take longer; the Fed's is alarmed", () => {
    const s = quiet();
    const brass = s.manholes.find((h) => h.state === 'covered' && h.kind !== 'fed')!;
    brass.kind = 'brass';
    teleport(s, brass.x, brass.y);
    act(s);
    expect(s.player.pry!.total).toBeCloseTo(CONFIG.pryTime * CONFIG.brassPry);

    const t = quiet();
    t.agents.push({ id: 1, kind: 'cop', mover: { x: 16, y: 9, path: [] }, down: 0, target: null, work: 0, leaving: false, variant: 0, load: 0 });
    const fed = t.manholes.find((h) => h.kind === 'fed')!;
    expect(fed).toMatchObject({ x: FED_COVER.x, y: FED_COVER.y, state: 'covered' });
    teleport(t, fed.x, fed.y);
    act(t);
    const events = run(t, CONFIG.pryTime * CONFIG.fedPry + 0.1);
    expect(events).toContainEqual({ type: 'alarm' });
    expect(t.heat).toBeGreaterThanOrEqual(CONFIG.fedAlarm - 1);
    expect(t.agents[0].mover.path.length).toBeGreaterThan(0); // a cop is on the way
    const yard = placeById('yard-near').door;
    teleport(t, yard.x, yard.y);
    const [sold] = act(t);
    expect(sold.type === 'sold' && sold.total).toBeCloseTo(sold.type === 'sold' ? sold.price * 8 : 0);
    // Crews leave it alone; the Fed refits it with the next boom
    t.nextCrewAt = 0;
    t.time = SCHEDULE.calm - 1;
    const boom = run(t, 2, still, rng(1), true);
    expect(boom).toContainEqual({ type: 'fed-refit' });
    expect(fed.state).toBe('covered');
  });
});

describe('austrian economics: the city', () => {
  it('both districts: doors and manholes on the streets, nothing on a door, every street connected', () => {
    for (const d of DISTRICTS) {
      setDistrict(d.id);
      for (const p of PLACES) expect(isRoad(p.door.x, p.door.y), `${d.id} ${p.id}`).toBe(true);
      for (const h of [...MANHOLE_SLOTS, FED_COVER, d.start, d.depot, d.copStart]) expect(isRoad(h.x, h.y), `${d.id} ${h.x},${h.y}`).toBe(true);
      for (const h of [...MANHOLE_SLOTS, FED_COVER]) expect(placeAtDoor(h), `${d.id} ${h.x},${h.y}`).toBeNull();
      for (const t of ROAD_TILES) expect(findPath(d.start, t).length > 0 || (t.x === d.start.x && t.y === d.start.y)).toBe(true);
    }
    setDistrict('downtown');
  });

  it('the suburbs: a bigger map, no cops at first, more brass', () => {
    const s = newGame(rng(3), 'suburbs');
    expect([COLS, ROWS]).toEqual([21, 13]);
    expect(s.district).toBe('suburbs');
    expect(s.agents.filter((a) => a.kind === 'cop')).toHaveLength(0);
    expect(s.player.mover).toMatchObject({ x: 3, y: 6 });
    expect(context(s)).toEqual({ kind: 'stash' });
    newGame(rng(1));
    expect([COLS, ROWS]).toEqual([18, 11]);
  });

  it('events: cash for clunkers doubles scrap, a minimum wage raises the Corner, a stimulus pays then inflates', () => {
    const s = quiet();
    const scrap = scrapPrice(s, 'yard-near');
    const crack = drugPrice(s, 'crack');
    s.event = { kind: 'clunkers', left: 10 };
    expect(scrapPrice(s, 'yard-near')).toBeCloseTo(scrap * 2);
    s.event = { kind: 'min-wage', left: 10 };
    expect(drugPrice(s, 'crack')).toBeCloseTo(crack * 1.3);
    s.event = null;
    // A stimulus check (the second event in the list)
    const t = quiet();
    t.nextEventAt = 0;
    const pick = () => 0.3;
    expect(run(t, 0.05, still, pick, true)).toContainEqual({ type: 'city-event', kind: 'stimulus' });
    expect(t.cash).toBeCloseTo(CONFIG.startCash + 50, 0);
    const level = t.priceLevel;
    const later = run(t, 7, still, pick, true);
    expect(later).toContainEqual({ type: 'city-event-over', kind: 'stimulus' });
    expect(t.priceLevel).toBeGreaterThan(level * 1.09);
  });

  it('a recall swaps the iron covers for plastic, and back when it ends', () => {
    const s = quiet();
    s.nextEventAt = 0;
    const pick = () => 0.6; // the third event: the recall
    const brass = s.manholes.filter((h) => h.kind === 'brass').length;
    expect(run(s, 0.05, still, pick, true)).toContainEqual({ type: 'city-event', kind: 'recall' });
    expect(s.manholes.filter((h) => h.state === 'covered' && h.kind === 'iron')).toHaveLength(0);
    expect(s.manholes.filter((h) => h.kind === 'brass')).toHaveLength(brass);
    run(s, 26, still, pick, true);
    expect(s.manholes.some((h) => h.kind === 'plastic' && h.state === 'covered')).toBe(false);
  });

  it('the rival scrapper steals covers and sells them', () => {
    const s = quiet();
    s.rivals = 0;
    s.time = CONFIG.rival.first;
    const events = run(s, 25, still, rng(5), true);
    expect(events).toContainEqual({ type: 'rival-arrives' });
    expect(events.some((e) => e.type === 'rival-stole')).toBe(true);
    expect(s.manholes.some((h) => h.state === 'open' && !h.yours)).toBe(true);
  });

  it('shove him into an open manhole, or take his cover', () => {
    const s = quiet();
    const hole = s.manholes.find((h) => h.state === 'covered' && h.kind !== 'fed' && h.y === 5)!;
    hole.state = 'open';
    const rival = { id: 7, kind: 'rival' as const, mover: { x: hole.x + 1, y: hole.y, path: [] }, down: 0, target: null, work: 0, leaving: false, variant: 0, load: 1 };
    s.agents.push(rival);
    teleport(s, hole.x + 1, hole.y);
    expect(context(s)).toMatchObject({ kind: 'shove' });
    expect(act(s)).toContainEqual({ type: 'rival-fell', x: hole.x, y: hole.y, pushed: true });
    expect(rival.down).toBe(CONFIG.rival.inHole);
    expect(rival.load).toBe(0);

    const t = quiet();
    const other = { id: 8, kind: 'rival' as const, mover: { x: 8, y: 9, path: [] }, down: 0, target: null, work: 0, leaving: false, variant: 0, load: 1 };
    t.agents.push(other);
    teleport(t, 8, 9);
    t.manholes.forEach((h) => { if (h.state === 'open') h.state = 'covered'; });
    expect(act(t)).toContainEqual({ type: 'shoved', took: true });
    expect(t.cargo).toEqual(['iron']);
    expect(other.down).toBe(CONFIG.rival.stunned);
  });

  it('every event has a name and runs out', () => {
    for (const e of CITY_EVENTS) expect(e.name && e.description && e.seconds > 0).toBeTruthy();
  });
});

describe('austrian economics: contracts', () => {
  it('due at the next FOMC meeting (or the one after, if that is too soon)', () => {
    const s = quiet();
    s.time = 5;
    const k = newContract(s, () => 0.9);
    expect(k.deadline).toBe(SCHEDULE.calm);
    expect(k).toMatchObject({ kind: 'any', count: 4, yard: 'yard-far', delivered: 0, pay: CONFIG.contracts.pay });
    s.time = SCHEDULE.calm - 5;
    expect(newContract(s, () => 0.1).deadline).toBe(SCHEDULE.calm + SCHEDULE.boom);
    expect(newContract(s, () => 0.1).kind).toBe('brass');
  });

  it('matching covers pay double at that yard; filling the order pays utils', () => {
    const s = quiet();
    s.contract = { yard: 'yard-near', kind: 'any', count: 2, delivered: 0, deadline: 999, pay: 2 };
    s.gear.cart = true;
    s.cargo = ['iron', 'iron', 'iron'];
    const door = placeById('yard-near').door;
    teleport(s, door.x, door.y);
    const price = scrapPrice(s, 'yard-near');
    const events = act(s);
    expect(events[0]).toMatchObject({ type: 'sold', count: 3, contract: 2 });
    expect(events[0].type === 'sold' && events[0].total).toBeCloseTo(price * (2 * 2 + 1));
    expect(events).toContainEqual({ type: 'contract-done', utils: CONFIG.contracts.utils });
    expect(s.contract).toBeNull();
    expect(s.utils).toBe(CONFIG.contracts.utils);
  });

  it('brass orders only take brass, and the other yard pays normally', () => {
    const s = quiet();
    s.contract = { yard: 'yard-far', kind: 'brass', count: 1, delivered: 0, deadline: 999, pay: 2 };
    s.cargo = ['iron'];
    const near = placeById('yard-near').door;
    teleport(s, near.x, near.y);
    expect(act(s)[0]).toMatchObject({ contract: 0 });
    const far = placeById('yard-far').door;
    teleport(s, far.x, far.y);
    s.cargo = ['iron'];
    expect(act(s)[0]).toMatchObject({ contract: 0 });
    s.cargo = ['brass'];
    expect(act(s)).toContainEqual({ type: 'contract-done', utils: CONFIG.contracts.utils });
  });

  it('expire at the deadline', () => {
    const s = quiet();
    s.contract = { yard: 'yard-far', kind: 'any', count: 3, delivered: 1, deadline: 1, pay: 2 };
    expect(run(s, 1.1, still, rng(1), true)).toContainEqual({ type: 'contract-failed' });
    expect(s.contract).toBeNull();
  });
});

describe('austrian economics: the daily cycle', () => {
  it('the same day is the same seed and twist; a week shows every twist once', () => {
    const a = dailyFor(new Date(2026, 10, 12, 8));
    expect(dailyFor(new Date(2026, 10, 12, 23, 59))).toEqual(a);
    expect(a.key).toBe('2026-11-12');
    const week = Array.from({ length: 7 }, (_, i) => dailyFor(new Date(2026, 10, 12 + i)).twist.id);
    expect(new Set(week).size).toBe(TWISTS.length);
    const r1 = seededRng(a.seed);
    const r2 = seededRng(a.seed);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });

  it('the same seed plays out the same', () => {
    const play = () => {
      const r = seededRng(1234);
      const s = newGame(r, 'downtown', 'helicopter');
      run(s, 60, still, r, true);
      return [s.cash, s.priceLevel, s.agents.map((a) => `${a.kind}${a.mover.x},${a.mover.y}`).join('|')];
    };
    expect(play()).toEqual(play());
  });

  it('twists: the gold standard never moves; Weimar inflates; Zero Rates booms longer; police state; gilded age', () => {
    expect(phaseAt(500, 'gold-standard').phase).toBe('calm');
    expect(phaseEnd(500, 'gold-standard')).toBe(Infinity);
    expect(scrapMultiplier(70, 'gold-standard')).toBe(1);
    expect(inflation('boom', 'gold-standard')).toBe(0);
    expect(inflation('calm', 'weimar')).toBeGreaterThan(inflation('boom', null));
    expect(phaseAt(SCHEDULE.calm + 60, 'zirp').phase).toBe('boom');
    expect(rateFor(phaseAt(SCHEDULE.calm + 1, 'zirp'), 'zirp')).toBe(0);
    expect(scrapMultiplier(SCHEDULE.calm + SCHEDULE.boom - 0.1, 'stagflation')).toBeLessThan(1.3);
    expect(newGame(rng(1), 'downtown', 'police-state').agents.filter((a) => a.kind === 'cop')).toHaveLength(3);
    const gilded = newGame(rng(1), 'downtown', 'gilded-age').manholes.filter((h) => h.kind === 'brass').length;
    expect(gilded).toBeGreaterThan(newGame(rng(1)).manholes.filter((h) => h.kind === 'brass').length);
    // Helicopter money: every event is a stimulus check
    const s = quiet();
    s.daily = 'helicopter';
    s.nextEventAt = 0;
    expect(run(s, 0.05, still, () => 0.9, true)).toContainEqual({ type: 'city-event', kind: 'stimulus' });
  });

  it('daily bests keep valid dates only', () => {
    expect(normalizeDailyBests({ '2026-11-12': 120, nope: 3, '2026-11-13': 0 })).toEqual({ '2026-11-12': 120 });
  });
});

describe('austrian economics: Rothbard', () => {
  it('has something to say for every cue, and never repeats himself twice in a row', () => {
    for (const [cue, lines] of Object.entries(LINES)) expect(lines.length, cue).toBeGreaterThan(0);
    const first = pickLine('stole', 0);
    for (let i = 0; i < 10; i++) expect(pickLine('stole', i / 10, first)).not.toBe(first);
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
    expect(t.update(s, [{ type: 'sold', count: 1, total: 40, yard: 'yard-near', price: 40, otherPrice: 25, multiplier: 2.3, plastic: false, contract: 0 }])).toEqual(['peak', 'cantillon']);
    t.update(s, [{ type: 'bought', drug: 'heroin', price: 40, dea: false }]);
    expect(t.update(s, [{ type: 'bought', drug: 'crack', price: 30, dea: true }])).toEqual(['both', 'dea']);
  });

  it('saving up, capital goods and staying alive', () => {
    const t = new Tracker(new Set());
    const s = newGame();
    s.stash = ['iron', 'iron', 'iron', 'iron', 'brass'];
    s.gear = { crowbar: true, cart: true, vest: true, bike: true };
    s.time = 301;
    expect(t.update(s, [])).toEqual(expect.arrayContaining(['stash-5', 'capital', 'survive-5']));
    expect([...normalizeUnlocked(['lap', 'nope'])]).toEqual(['lap']);
  });
});
