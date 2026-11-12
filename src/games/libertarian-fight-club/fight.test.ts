import { describe, expect, it } from 'vitest';
import { effectiveness, FACTIONS, factionById, makeRoster, normalizeRoster, TRAITS, type Lobster } from './lobsters.ts';
import { argTypesOf, houseOdds, pickBout, revealedSides, simulate, weighIn } from './fight.ts';

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

describe('fight club: the house line', () => {
  it('has a margin, and the stronger lobster is the favorite', () => {
    const strong = lobster({ claw: 9, shell: 8, stamina: 125, wits: 8 });
    const weak = lobster({ id: 1, faction: 'austrian', claw: 4, shell: 4, stamina: 80, wits: 4 });
    const [oa, ob] = houseOdds(strong, weak);
    expect(oa).toBeLessThan(ob);
    expect(1 / oa + 1 / ob).toBeGreaterThan(1.05); // the house's cut
  });

  it('is stable for the same bout, and overrates crowd favorites', () => {
    const a = lobster();
    const b = lobster({ id: 1, faction: 'georgist' });
    expect(houseOdds(a, b)).toEqual(houseOdds(a, b));
    expect(houseOdds({ ...a, trait: 'crowd-favorite' }, b)[0]).toBeLessThan(houseOdds(a, b)[0]);
  });

  it('only half-reads matchups: the minarchist is underpriced against the ancap', () => {
    const minarchist = lobster({ faction: 'minarchist' });
    const ancap = lobster({ id: 1, faction: 'ancap' });
    let wins = 0;
    for (let i = 0; i < 400; i++) if (simulate(minarchist, ancap, rng(i)).winner === 0) wins++;
    const [odds] = houseOdds(minarchist, ancap);
    expect((wins / 400) * odds).toBeGreaterThan(1); // a value bet
  });
});
