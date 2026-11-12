import { describe, expect, it } from 'vitest';
import { effectiveness, FACTIONS, factionById, makeRoster, normalizeRoster, TRAITS, type Lobster } from './lobsters.ts';
import { argTypesOf, pickBout, publicChance, revealedSides, simulate, stateAfterRound, weighIn } from './fight.ts';
import { cashOutValue, crowdBets, lateBet, liveOdds, poolOdds, popularity, projectedPayout, TAKEOUT, totals } from './pool.ts';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const lobster = (over: Partial<Lobster> = {}): Lobster => ({
  id: 0, name: 'Test', faction: 'ancap', claw: 6, shell: 6, stamina: 100, wits: 6, weight: 2, wins: 0, losses: 0, form: [], trait: 'none', traitKnown: false, ...over,
});

describe('fight club: the league', () => {
  it('every faction has three arguments, a weakness and something it shrugs off (not the same)', () => {
    expect(FACTIONS).toHaveLength(10);
    for (const f of FACTIONS) {
      expect(f.moves, f.id).toHaveLength(3);
      expect(f.weak).not.toBe(f.resists);
    }
  });

  it('matchups: weak ×1.5, resisted ×0.65, otherwise ×1', () => {
    const ancap = factionById('ancap');
    expect(effectiveness('practical', ancap)).toBe(1.5); // who will build the roads?
    expect(effectiveness('moral', ancap)).toBe(0.65);
    expect(effectiveness('econ', ancap)).toBe(1);
  });

  it('a roster of 16 lobsters with sane stats, and saves are cleaned up', () => {
    const roster = makeRoster(rng(1));
    expect(roster).toHaveLength(16);
    for (const l of roster) {
      expect(l.claw).toBeGreaterThanOrEqual(3);
      expect(l.claw).toBeLessThanOrEqual(9);
      expect(l.form.length).toBeLessThanOrEqual(5);
      expect(TRAITS.some((t) => t.id === l.trait)).toBe(true);
    }
    expect(normalizeRoster(JSON.parse(JSON.stringify(roster)))).toEqual(roster);
    expect(normalizeRoster([1, 2, 3])).toBeNull();
    expect(normalizeRoster(roster.map((l) => ({ ...l, claw: 99, trait: 'nope' })))![0]).toMatchObject({ claw: 10, trait: 'none' });
  });

  it('weigh-in traits change the numbers', () => {
    expect(weighIn(lobster({ trait: 'hungry' }))).toMatchObject({ claw: 8, stamina: 85 });
    expect(weighIn(lobster({ trait: 'molting' })).shell).toBe(3);
    expect(weighIn(lobster({ trait: 'pre-cooked' })).stamina).toBe(75);
  });
});

describe('fight club: the fight', () => {
  it('ends in a KO, a flight or a decision, with a consistent story', () => {
    const roster = makeRoster(rng(2));
    for (let i = 0; i < 300; i++) {
      const r = rng(i);
      const [a, b] = pickBout(roster.length, r);
      expect(a).not.toBe(b);
      const res = simulate(roster[a], roster[b], r);
      const last = res.events[res.events.length - 1];
      expect(last.type).toBe(res.ending === 'ko' ? 'ko' : res.ending === 'flee' ? 'flee' : 'decision');
      if (res.ending === 'ko' && last.type === 'ko') expect(last.side).not.toBe(res.winner);
      if (res.ending === 'decision') expect(res.dealt[res.winner]).toBeGreaterThanOrEqual(res.dealt[res.winner === 0 ? 1 : 0]);
      for (const e of res.events) if (e.type === 'argue') expect(e.damage).toBeGreaterThan(0);
    }
  });

  it('the same random numbers give the same fight', () => {
    const [a, b] = makeRoster(rng(3));
    expect(simulate(a, b, rng(9))).toEqual(simulate(a, b, rng(9)));
  });

  it('matchups matter: a minarchist beats an equal ancap far more often than not', () => {
    const minarchist = lobster({ faction: 'minarchist' });
    const ancap = lobster({ id: 1, faction: 'ancap' });
    let wins = 0;
    for (let i = 0; i < 400; i++) if (simulate(minarchist, ancap, rng(i)).winner === 0) wins++;
    expect(wins / 400).toBeGreaterThan(0.6);
  });

  it('a coward may run, a glass shell cracks, and traits get revealed', () => {
    let fled = false;
    let cracked = false;
    for (let i = 0; i < 300 && !(fled && cracked); i++) {
      const res = simulate(lobster({ trait: 'coward', claw: 3, shell: 3 }), lobster({ id: 1, faction: 'minarchist', claw: 9, trait: 'glass-shell', wits: 9 }), rng(i));
      if (res.ending === 'flee') {
        fled = true;
        expect(res.winner).toBe(1);
        expect(revealedSides(res)).toContain(0);
      }
      if (res.events.some((e) => e.type === 'trait' && e.trait === 'glass-shell')) cracked = true;
    }
    expect(fled).toBe(true);
  });

  it('the cards show which kinds of argument a lobster uses', () => {
    expect(argTypesOf(lobster({ faction: 'chicago' })).sort()).toEqual(['econ', 'meme']);
  });
});

describe('fight club: the public and the pool', () => {
  it('the public favors the stronger lobster, overrates crowd favorites, and half-reads matchups', () => {
    const strong = lobster({ claw: 9, shell: 8, stamina: 125, wits: 8 });
    const weak = lobster({ id: 1, faction: 'austrian', claw: 4, shell: 4, stamina: 80, wits: 4 });
    expect(publicChance(strong, weak)).toBeGreaterThan(0.7);
    const a = lobster();
    const b = lobster({ id: 1, faction: 'georgist' });
    expect(publicChance(a, b)).toBe(publicChance(a, b));
    expect(publicChance({ ...a, trait: 'crowd-favorite' }, b)).toBeGreaterThan(publicChance(a, b));
    // The minarchist really beats an equal ancap more often than the public thinks
    const minarchist = lobster({ faction: 'minarchist' });
    const ancap = lobster({ id: 1, faction: 'ancap' });
    let wins = 0;
    for (let i = 0; i < 400; i++) if (simulate(minarchist, ancap, rng(i)).winner === 0) wins++;
    expect(wins / 400).toBeGreaterThan(publicChance(minarchist, ancap));
  });

  it('pool odds: the pot after the cut over each side, and your stake moves them', () => {
    const odds = poolOdds([600, 400]);
    expect(odds[0]).toBeCloseTo((1000 * (1 - TAKEOUT)) / 600, 2);
    expect(odds[1]).toBeCloseTo((1000 * (1 - TAKEOUT)) / 400, 2);
    expect(1 / odds[0] + 1 / odds[1]).toBeGreaterThan(1.1); // the house's cut
    // A $400 bet on the underdog pays less than 400 × today's odds: it shortens them.
    expect(projectedPayout([600, 400], 1, 400)).toBeLessThan(400 * odds[1]);
    expect(Math.abs(projectedPayout([600, 400], 1, 400) - 400 * ((1400 * (1 - TAKEOUT)) / 800))).toBeLessThan(4); // odds round down to the cent
    expect(projectedPayout([600, 400], 0, 0)).toBe(0);
  });

  it('Susan backs the popular one, Sheila the other; the public follows its estimate', () => {
    const hot = lobster({ wins: 9, losses: 1, form: ['W', 'W', 'W', 'W', 'W'] });
    const cold = lobster({ id: 1, wins: 1, losses: 8, form: ['L', 'L', 'L'] });
    expect(popularity(hot)).toBeGreaterThan(popularity(cold));
    for (let i = 0; i < 20; i++) {
      const bets = crowdBets(hot, cold, 0.7, rng(i));
      expect(bets.find((b) => b.who === 'susan')!.side).toBe(0);
      expect(bets.find((b) => b.who === 'sheila')!.side).toBe(1);
      const t = totals(bets.filter((b) => b.who === 'public'));
      expect(t[0]).toBeGreaterThan(t[1]);
      for (const b of bets) expect(b.amount % 10).toBe(0);
    }
    const r = rng(1);
    const late = Array.from({ length: 50 }, () => lateBet(r));
    expect(late.some((b) => b === null)).toBe(true);
    expect(late.some((b) => b?.late)).toBe(true);
  });
});

describe('fight club: live betting and cash-out', () => {
  it('live odds and cash-outs keep the house cut', () => {
    expect(liveOdds(0.5)).toBeCloseTo(1 / (0.5 * (1 + TAKEOUT)), 1);
    expect(liveOdds(0.999)).toBe(1.01);
    expect(liveOdds(0.001)).toBe(25);
    expect(cashOutValue(200, 0.5)).toBe(Math.floor(200 * 0.5 * (1 - TAKEOUT)));
    expect(cashOutValue(200, 1)).toBeLessThan(200);
  });

  it('resumes a fight from the end of a round, with the same health and damage', () => {
    const [a, b] = makeRoster(rng(4));
    for (let i = 0; i < 30; i++) {
      const res = simulate(a, b, rng(i));
      if (!res.events.some((e) => e.type === 'round' && e.round === 2)) continue;
      const st = stateAfterRound(a, b, res, 1);
      expect(st.round).toBe(2);
      const lastArgue = [...res.events.slice(0, res.events.findIndex((e) => e.type === 'round' && e.round === 2))].reverse().find((e) => e.type === 'argue');
      if (lastArgue?.type === 'argue') expect(st.hp).toEqual(lastArgue.hp);
      const rest = simulate(a, b, rng(99), false, st);
      expect(rest.events[0]).toEqual({ type: 'round', round: 2 });
      expect(rest.events.some((e) => e.type === 'weigh-in')).toBe(false);
      // A lobster far behind has a smaller live chance than at the start
      const behind = st.hp[0] < st.hp[1] ? 0 : 1;
      const live = publicChance(a, b, st, 200);
      const pre = publicChance(a, b);
      if (Math.abs(st.hp[0] - st.hp[1]) > 30) expect(behind === 0 ? live < pre : live > pre).toBe(true);
      return;
    }
    throw new Error('no fight went past round 1');
  });
});
