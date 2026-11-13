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
  id: 0, name: 'Test', faction: 'ancap', claw: 6, shell: 6, stamina: 100, wits: 6, weight: 2, wins: 0, losses: 0, form: [], trait: 'none', traitKnown: false, rumor: null, scouted: false, ...over,
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

describe('fight club: intel', () => {
  it('Frank whispers a trait (right about two in three); nothing to say when both are known', async () => {
    const { buyTip } = await import('./intel.ts');
    const a = lobster({ trait: 'coward' });
    const b = lobster({ id: 1, trait: 'lazy', traitKnown: true });
    let right = 0;
    const r = rng(5);
    for (let i = 0; i < 300; i++) {
      const tip = buyTip('frank', [a, b], r)!;
      expect(tip.kind).toBe('trait');
      expect(tip.side).toBe(0); // only the unknown one
      if (tip.kind === 'trait' && tip.trait === 'coward') right++;
    }
    expect(right / 300).toBeGreaterThan(0.55);
    expect(right / 300).toBeLessThan(0.75);
    expect(buyTip('frank', [{ ...a, traitKnown: true }, b], r)).toBeNull();
  });

  it('the Insider names the lobster with the real edge nine times in ten; the Guru is a coin flip', async () => {
    const { buyTip } = await import('./intel.ts');
    const strong = lobster({ faction: 'minarchist', claw: 9, shell: 8, stamina: 125 });
    const weak = lobster({ id: 1, faction: 'ancap', claw: 4, shell: 4, stamina: 80 });
    const r = rng(6);
    let insider = 0;
    let guru = 0;
    for (let i = 0; i < 120; i++) {
      if (buyTip('insider', [strong, weak], r)!.side === 0) insider++;
      if (buyTip('guru', [strong, weak], r)!.side === 0) guru++;
    }
    expect(insider / 120).toBeGreaterThan(0.8);
    expect(guru / 120).toBeGreaterThan(0.35);
    expect(guru / 120).toBeLessThan(0.65);
  });

  it('every trait has two tells, and a lobster always shows the same one', async () => {
    const { TELLS, tellFor } = await import('./intel.ts');
    for (const t of TRAITS) expect(TELLS[t.id]).toHaveLength(2);
    const l = lobster({ trait: 'coward', id: 3 });
    expect(tellFor(l)).toBe(tellFor(l));
    expect(tellFor(l)).toContain(TELLS.coward[1]);
  });
});

describe('fight club: props and parlays', () => {
  it('props read the fight correctly', async () => {
    const { propOutcomes } = await import('./props.ts');
    const roster = makeRoster(rng(8));
    for (let i = 0; i < 100; i++) {
      const res = simulate(roster[i % 16], roster[(i + 5) % 16], rng(i));
      const out = propOutcomes(res);
      expect(out.ko).toBe(res.ending === 'ko');
      expect(out.decision).toBe(res.ending === 'decision');
      expect(out.flee).toBe(res.ending === 'flee');
      expect([out['ko-r1'], out['ko-r2'], out['ko-r3']].filter(Boolean).length).toBe(out.ko ? 1 : 0);
      const crits = res.events.filter((e) => e.type === 'argue' && e.crit).length;
      expect(out.crits3).toBe(crits >= 3);
    }
  });

  it('the house prices props with a cut and a cap, and is stable', async () => {
    const { propChances, propOdds, MAX_PROP_ODDS, PROPS } = await import('./props.ts');
    const [a, b] = makeRoster(rng(9));
    const ch = propChances(a, b);
    expect(ch.ko + ch.decision + ch.flee).toBeCloseTo(1, 1);
    expect(propChances(a, b)).toEqual(ch);
    const odds = propOdds(ch);
    for (const p of PROPS) {
      expect(odds[p.id]).toBeLessThanOrEqual(MAX_PROP_ODDS);
      expect(odds[p.id] * ch[p.id]).toBeLessThan(1); // the house's edge, on its own numbers
    }
  });

  it('parlays multiply, and settle leg by leg', async () => {
    const { parlayOdds, settleLeg, normalizeParlay } = await import('./props.ts');
    expect(parlayOdds([{ odds: 2 }, { odds: 1.5 }, { odds: 3 }])).toBe(9);
    const parlay = { stake: 50, legs: [{ ids: [1, 2] as [number, number], side: 0 as const, odds: 2, won: null }, { ids: [3, 4] as [number, number], side: 1 as const, odds: 2, won: null }] };
    expect(settleLeg(parlay, [9, 9], 9)).toBe('none');
    expect(settleLeg(parlay, [1, 2], 1)).toBe('pending');
    expect(settleLeg(parlay, [3, 4], 4)).toBe('won');
    const lost = { stake: 50, legs: [{ ids: [1, 2] as [number, number], side: 0 as const, odds: 2, won: null }] };
    expect(settleLeg(lost, [1, 2], 2)).toBe('lost');
    expect(normalizeParlay(JSON.parse(JSON.stringify(parlay)))).toEqual(parlay);
    expect(normalizeParlay({ legs: [], stake: 5 })).toBeNull();
  });
});

describe('fight club: the career', () => {
  it('five venues, each bigger than the last', async () => {
    const { VENUES } = await import('./career.ts');
    expect(VENUES).toHaveLength(5);
    for (let i = 1; i < VENUES.length; i++) {
      expect(VENUES[i].scale).toBeGreaterThan(VENUES[i - 1].scale);
      expect(VENUES[i].maxStake).toBeGreaterThan(VENUES[i - 1].maxStake);
      expect(VENUES[i].target).toBeGreaterThan(VENUES[i - 1].target);
    }
  });

  it('end a night at the target to move up; the top target wins it all', async () => {
    const { endNight, newCareer, startNight, VENUES } = await import('./career.ts');
    const c = newCareer(500);
    expect(endNight(c, 900)).toBe('stayed');
    expect(endNight(c, 1000)).toBe('promoted');
    const next = startNight(c, 1000, 'promoted');
    expect(next.career).toMatchObject({ venue: 1, night: 2, bout: 0 });
    expect(next.fee).toBe(VENUES[1].fee);
    expect(next.bankroll).toBe(1000 - VENUES[1].fee);
    expect(endNight({ ...c, venue: 4 }, VENUES[4].target)).toBe('champion');
    expect(startNight({ ...c, venue: 4 }, VENUES[4].target, 'champion').career.champion).toBe(true);
  });

  it("can't afford the door? Back down a venue. Broke? The uncle bails you out and you drop one", async () => {
    const { bailout, newCareer, startNight } = await import('./career.ts');
    const c = { ...newCareer(500), venue: 3 };
    const r = startNight(c, 1000, null);
    expect(r.demoted).toBe(true);
    expect(r.career.venue).toBeLessThan(3);
    expect(bailout(c)).toMatchObject({ venue: 2, bailouts: 1 });
    expect(bailout(newCareer(500)).venue).toBe(0);
  });

  it('the fish market: three cheaper, weaker lots, traits hidden', async () => {
    const { marketOffers, MINE_ID } = await import('./career.ts');
    const offers = marketOffers(rng(3), 2);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((o) => o.lobster.name)).size).toBe(3);
    expect(offers.map((o) => o.lot)).toEqual([21, 22, 23]);
    for (const o of offers) {
      expect(o.lobster.id).toBe(MINE_ID);
      expect(o.lobster.claw).toBeLessThanOrEqual(6);
      expect(o.lobster.traitKnown).toBe(false);
      expect(o.price).toBeGreaterThanOrEqual(600);
      expect(o.price).toBeLessThanOrEqual(1600);
    }
  });

  it('training costs more each time and stops at the cap', async () => {
    const { train, trainingCost, STAT_CAP } = await import('./career.ts');
    const l = lobster({ claw: 3 });
    const first = trainingCost(l, 'claw')!;
    train(l, 'claw');
    expect(l.claw).toBe(4);
    expect(trainingCost(l, 'claw')!).toBeGreaterThan(first);
    l.claw = STAT_CAP;
    expect(trainingCost(l, 'claw')).toBeNull();
    const s = lobster({ stamina: 100 });
    train(s, 'stamina');
    expect(s.stamina).toBe(110);
  });

  it('opponents by tier, purses by tier and venue, and losses cost rest (and sometimes a point)', async () => {
    const { afterLoss, pickOpponent, purseFor, rating } = await import('./career.ts');
    const roster = makeRoster(rng(12));
    const avg = (tier: 'easy' | 'even' | 'hard') => {
      let sum = 0;
      for (let i = 0; i < 50; i++) sum += rating(pickOpponent(roster, tier, rng(i)));
      return sum / 50;
    };
    expect(avg('easy')).toBeLessThan(avg('even'));
    expect(avg('even')).toBeLessThan(avg('hard'));
    expect(purseFor('hard', 2)).toBeGreaterThan(purseFor('easy', 2));
    expect(purseFor('even', 3)).toBeGreaterThan(purseFor('even', 1));
    let hurt = 0;
    const r = rng(77);
    for (let i = 0; i < 200; i++) {
      const stable = { lobster: lobster({ claw: 5, shell: 5, wits: 5, stamina: 100 }), rest: 0, purses: 0, suspicion: 0, dives: 0, paid: 0 };
      if (afterLoss(stable, i % 2 === 0, r)) hurt++;
      expect(stable.rest).toBe(i % 2 === 0 ? 2 : 1);
    }
    expect(hurt / 200).toBeGreaterThan(0.2);
    expect(hurt / 200).toBeLessThan(0.5);
  });

  it('saves are cleaned up', async () => {
    const { normalizeCareer, normalizeStable } = await import('./career.ts');
    expect(normalizeCareer({ venue: 99, night: -3 }, 700)).toMatchObject({ venue: 4, night: 1, startBankroll: 700 });
    expect(normalizeStable(null)).toBeNull();
    expect(normalizeStable({ lobster: { faction: 'nope' } })).toBeNull();
    expect(normalizeStable({ rest: 9, purses: 50, lobster: { faction: 'ancap', name: 'Pinchy', claw: 99, trait: 'coward' } })).toMatchObject({ rest: 5, lobster: { claw: 10, traitKnown: true, trait: 'coward', id: 100 } });
  });
});

describe('fight club: Vinny the Fin', () => {
  it('lends in chunks up to a limit that grows with the venue', async () => {
    const { borrow, creditLimit, loanChunk, newShark } = await import('./shark.ts');
    expect(creditLimit(2)).toBeGreaterThan(creditLimit(0));
    const s = newShark();
    let total = 0;
    for (let i = 0; i < 10; i++) total += borrow(s, 0);
    expect(total).toBe(creditLimit(0));
    expect(borrow(s, 0)).toBe(0);
    expect(loanChunk(0)).toBe(250);
  });

  it('charges 20% a night; paying anything keeps him patient, three unpaid nights and he collects', async () => {
    const { borrow, dueForCollection, newShark, nightPasses, repay } = await import('./shark.ts');
    const s = newShark();
    borrow(s, 0);
    expect(nightPasses(s)).toBe(50);
    expect(s.debt).toBe(300);
    expect(s.nightsUnpaid).toBe(1);
    repay(s, 10);
    nightPasses(s);
    expect(s.nightsUnpaid).toBe(0); // paid something: patience resets
    nightPasses(s);
    nightPasses(s);
    expect(dueForCollection(s)).toBe(false);
    nightPasses(s);
    expect(dueForCollection(s)).toBe(true);
    expect(repay(s, 1e9)).toBeGreaterThan(0);
    expect(s.debt).toBe(0);
    expect(nightPasses(s)).toBe(0);
  });

  it('collects your cash first, then a claw (or your venue), then halves the rest', async () => {
    const { collect } = await import('./shark.ts');
    const s = { debt: 1000, nightsUnpaid: 3, paidTonight: false };
    expect(collect(s, 1500, true)).toEqual({ took: 1000, claw: false, demoted: false });
    expect(s.debt).toBe(0);
    const t = { debt: 1000, nightsUnpaid: 3, paidTonight: false };
    expect(collect(t, 200, true)).toEqual({ took: 200, claw: true, demoted: false });
    expect(t.debt).toBe(400);
    expect(t.nightsUnpaid).toBe(0);
    expect(collect({ debt: 500, nightsUnpaid: 3, paidTonight: false }, 0, false)).toMatchObject({ demoted: true });
  });

  it('saves are cleaned up', async () => {
    const { normalizeShark } = await import('./shark.ts');
    expect(normalizeShark({ debt: '420', nightsUnpaid: 99 })).toEqual({ debt: 420, nightsUnpaid: 3, paidTonight: false });
    expect(normalizeShark(null)).toEqual({ debt: 0, nightsUnpaid: 0, paidTonight: false });
  });
});

describe('fight club: achievements', () => {
  it('unique ids, all filled in, and saves keep only known ones', async () => {
    const { ACHIEVEMENTS, normalizeUnlocked } = await import('./achievements.ts');
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.icon && a.name && a.description, a.id).toBeTruthy();
    expect([...normalizeUnlocked(['parlay', 'nope', 4])]).toEqual(['parlay']);
  });
});

describe('fight club: replaying a fight', () => {
  it('the same seed gives the same fight, so a reload settles the bout you left', async () => {
    const { seededRng } = await import('./fight.ts');
    const roster = makeRoster(rng(5));
    const first = simulate(roster[0], roster[1], seededRng(123456));
    const again = simulate(roster[0], roster[1], seededRng(123456));
    expect(again).toEqual(first);
  });
});

describe('fight club: your betting record', () => {
  it('adds up stakes and returns, and keeps the best and worst single bets', async () => {
    const { emptyLedger, recordBet, ledgerTotal, roi } = await import('./ledger.ts');
    const l = emptyLedger();
    recordBet(l, 'winner', 100, 250, 'big one');
    recordBet(l, 'winner', 100, 0, 'ouch');
    recordBet(l, 'props', 50, 0, 'small loss');
    recordBet(l, 'live', 40, 30, 'cashed out at a loss');
    expect(l.lines.winner).toEqual({ bets: 2, wins: 1, staked: 200, returned: 250 });
    expect(l.best).toEqual({ amount: 150, text: 'big one' });
    expect(l.worst).toEqual({ amount: 100, text: 'ouch' });
    const total = ledgerTotal(l);
    expect(total).toEqual({ bets: 4, wins: 1, staked: 290, returned: 280 });
    expect(roi(total)).toBeCloseTo(-10 / 290);
    expect(roi(l.lines.parlay)).toBeNull();
  });

  it('saves are cleaned up', async () => {
    const { normalizeLedger } = await import('./ledger.ts');
    const l = normalizeLedger({ lines: { winner: { bets: '3', wins: 9, staked: -5, returned: 12.7 } }, best: { amount: 0, text: 'x' }, worst: { amount: 40, text: 'bad' } });
    expect(l.lines.winner).toEqual({ bets: 3, wins: 3, staked: 0, returned: 12 });
    expect(l.lines.parlay).toEqual({ bets: 0, wins: 0, staked: 0, returned: 0 });
    expect(l.best).toBeNull();
    expect(l.worst).toEqual({ amount: 40, text: 'bad' });
    expect(normalizeLedger(undefined).cashouts).toBe(0);
  });
});

describe('fight club: night events', () => {
  it('about half the nights get one, never the first, and never the same twice in a row', async () => {
    const { rollEvent, NIGHT_EVENTS, normalizeEvent, eventById } = await import('./events.ts');
    const r = rng(17);
    expect(rollEvent(r, 1)).toBeNull();
    let some = 0;
    for (let i = 0; i < 2000; i++) {
      const e = rollEvent(r, 5, 'whale');
      if (e) some++;
      expect(e).not.toBe('whale');
    }
    expect(some / 2000).toBeGreaterThan(0.45);
    expect(some / 2000).toBeLessThan(0.65);
    expect(new Set(NIGHT_EVENTS.map((e) => e.id)).size).toBe(NIGHT_EVENTS.length);
    expect(normalizeEvent('raid')).toBe('raid');
    expect(normalizeEvent('nope')).toBeNull();
    expect(eventById(null)).toBeNull();
  });

  it('the house cut changes the pool odds, and Election Night triples the meme money', async () => {
    const { crowdBets } = await import('./pool.ts');
    const t: [number, number] = [600, 400];
    expect(poolOdds(t, 0)).toEqual([1.66, 2.5]);
    expect(poolOdds(t, 0.2)[1]).toBeLessThan(poolOdds(t)[1]);
    expect(projectedPayout(t, 1, 100, -0.05)).toBeGreaterThan(projectedPayout(t, 1, 100));
    const [a, b] = makeRoster(rng(3));
    const normal = crowdBets(a, b, 0.5, rng(9), 1, 1);
    const hyped = crowdBets(a, b, 0.5, rng(9), 1, 3);
    const susan = (bets: typeof normal) => bets.find((x) => x.who === 'susan')!.amount;
    expect(susan(hyped)).toBeGreaterThan(susan(normal) * 2.5);
  });
});

describe('fight club: throwing a fight', () => {
  it('a lobster taking a dive loses nearly every time, and getting caught gets likelier', async () => {
    const { diveFighter, catchChance, bribeFor } = await import('./dive.ts');
    const r = rng(41);
    const me = lobster({ claw: 8, shell: 7, wits: 7, stamina: 120 });
    const them = lobster({ id: 1, faction: 'minarchist', claw: 4, shell: 4, wits: 4, stamina: 90 });
    let honest = 0;
    let thrown = 0;
    for (let i = 0; i < 400; i++) {
      if (simulate(me, them, r).winner === 0) honest++;
      if (simulate(diveFighter(me), them, r).winner === 0) thrown++;
    }
    expect(honest / 400).toBeGreaterThan(0.7);
    expect(thrown / 400).toBeLessThan(0.12);
    expect(catchChance(0)).toBeCloseTo(0.2);
    expect(catchChance(2)).toBeGreaterThan(catchChance(1));
    expect(catchChance(99)).toBe(0.6);
    expect(bribeFor(625)).toBe(250);
  });
});

describe('fight club: the ring announcer', () => {
  it('introduces both corners by name (and the venue on the first bout)', async () => {
    const { introduce, callWinner } = await import('./announcer.ts');
    const roster = makeRoster(rng(8));
    for (let i = 0; i < roster.length - 1; i++) {
      const intro = introduce([roster[i], roster[i + 1]], 'garage', i === 0, false, rng(i + 1));
      expect(intro.lines).toHaveLength(i === 0 ? 3 : 2);
      expect(intro.lines.at(-2)).toContain(roster[i].name.toUpperCase());
      expect(intro.lines.at(-1)).toContain(roster[i + 1].name.toUpperCase());
      for (const line of intro.lines) expect(line).not.toMatch(/undefined|NaN/);
    }
    expect(introduce([roster[0], roster[1]], 'kitchen', false, true, rng(1)).lines[0]).toContain('your very own');
    expect(callWinner(roster[0], 'ko', 2)).toContain('round 2');
  });
});

describe('fight club: the cup', () => {
  it('runs an eight-lobster bracket to a champion', async () => {
    const { newCup, nextMatch, matchOf, alive, champion, CUP_BOUTS, isCupNight } = await import('./cup.ts');
    const cup = newCup(16, rng(4));
    expect(new Set(cup.seeds).size).toBe(8);
    for (let k = 0; k < CUP_BOUTS; k++) {
      const i = nextMatch(cup)!;
      const [a] = matchOf(cup, i)!;
      cup.winners[i] = a;
      expect(alive(cup)).toHaveLength(8 - (k + 1));
    }
    expect(nextMatch(cup)).toBeNull();
    expect(champion(cup)).toBe(alive(cup)[0]);
    expect([1, 2, 3, 4, 5, 8].map(isCupNight)).toEqual([false, false, false, true, false, true]);
  });

  it('works out each lobster’s chance of winning it, which adds up to one', async () => {
    const { newCup, cupChances, futuresOdds, MAX_FUTURE_ODDS } = await import('./cup.ts');
    const cup = newCup(16, rng(4));
    // Lower ids always win: the lowest id in the bracket is a lock.
    const p = cupChances(cup, (a, b) => (a < b ? 1 : 0));
    const best = Math.min(...cup.seeds);
    expect(p.get(best)).toBeCloseTo(1);
    const even = cupChances(cup, () => 0.5);
    let sum = 0;
    for (const v of even.values()) sum += v;
    expect(sum).toBeCloseTo(1);
    for (const v of even.values()) expect(v).toBeCloseTo(1 / 8);
    expect(futuresOdds(1 / 8)).toBeLessThan(8);
    expect(futuresOdds(0)).toBe(MAX_FUTURE_ODDS);
  });

  it('saves are cleaned up', async () => {
    const { normalizeCup } = await import('./cup.ts');
    const cup = normalizeCup({ seeds: [0, 1, 2, 3, 4, 5, 6, 7], winners: [1, 9, null, 7, 1], futures: [{ id: 3, stake: 50, odds: 999, early: true }, { id: 12, stake: 5, odds: 2 }] }, 16)!;
    expect(cup.winners).toEqual([1, null, null, 7, null, null, null]);
    expect(cup.futures).toEqual([{ id: 3, stake: 50, odds: 50, early: true }]);
    expect(normalizeCup({ seeds: [0, 0, 1, 2, 3, 4, 5, 6], winners: [] }, 16)).toBeNull();
  });
});

describe('fight club: the regulars', () => {
  it('scores their pool bets at the final odds, and ranks the table', async () => {
    const { rivalResults, addResults, emptyRivals, ranking, leading } = await import('./rivals.ts');
    const pool = [
      { who: 'susan' as const, side: 0 as const, amount: 100 },
      { who: 'sheila' as const, side: 1 as const, amount: 50 },
      { who: 'larry' as const, side: 1 as const, amount: 20 },
      { who: 'public' as const, side: 0 as const, amount: 500 },
    ];
    expect(rivalResults(pool, [1.5, 3], 1)).toEqual({ susan: -100, sheila: 100, larry: 40 });
    expect(rivalResults(pool, [1.5, 3], null, 0.8)).toEqual({ susan: -20, sheila: -10, larry: -4 });
    const r = emptyRivals();
    addResults(r, 70, rivalResults(pool, [1.5, 3], 1));
    expect(ranking(r.tonight).map((x) => x.id)).toEqual(['sheila', 'you', 'larry', 'susan']);
    expect(leading(r.tonight)).toBe(false);
    expect(r.season.sheila).toBe(100);
  });
});

describe('fight club: teaching an argument', () => {
  it('a taught argument joins the lobster’s moves and gets used in fights', async () => {
    const { TEACHABLE, movesOf } = await import('./lobsters.ts');
    const me = lobster({ faction: 'ancap', learned: TEACHABLE.econ });
    expect(movesOf(me)).toHaveLength(4);
    expect(argTypesOf(me)).toContain('econ');
    const r = rng(77);
    let used = 0;
    for (let i = 0; i < 50; i++) for (const e of simulate(me, lobster({ id: 1, faction: 'austrian' }), r).events) if ((e.type === 'argue' || e.type === 'miss') && e.side === 0 && e.move.name === TEACHABLE.econ.name) used++;
    expect(used).toBeGreaterThan(50);
    const { normalizeStable } = await import('./career.ts');
    const st = normalizeStable({ rest: 0, purses: 0, lobster: { faction: 'ancap', name: 'X', learned: { type: 'meme', name: 'hacked', power: 9 } } })!;
    expect(st.lobster.learned).toEqual(TEACHABLE.meme);
  });
});

describe('fight club: the stable', () => {
  it('more slots at bigger venues, ids that never clash, and old saves become slot one', async () => {
    const { slotsAt, freeId, isMine, normalizeStables, MINE_ID } = await import('./career.ts');
    expect([0, 1, 2, 3, 4].map(slotsAt)).toEqual([0, 1, 2, 3, 3]);
    expect(isMine(MINE_ID + 2)).toBe(true);
    expect(isMine(15)).toBe(false);
    const lob = (id: number) => ({ rest: 0, purses: 0, lobster: { id, faction: 'ancap', name: `L${id}` } });
    const st = normalizeStables([lob(101), lob(101), lob(7), lob(102)]);
    expect(st.map((s) => s.lobster.id)).toEqual([101, 100, 102]);
    expect(freeId(st.slice(0, 2))).toBe(102);
    expect(normalizeStables(null)).toEqual([]);
  });

  it('upkeep grows with the venue; a trained, winning lobster sells for more', async () => {
    const { upkeepFor, saleValue, normalizeStable, normalizeHall } = await import('./career.ts');
    expect(upkeepFor(1)).toBe(100);
    expect(upkeepFor(3)).toBeGreaterThan(upkeepFor(2));
    const raw = { rest: 0, purses: 0, lobster: { faction: 'ancap', name: 'X', claw: 4, shell: 4, wits: 4, stamina: 80 } };
    const rookie = normalizeStable(raw)!;
    const vet = normalizeStable({ ...raw, lobster: { ...raw.lobster, claw: 8, shell: 7, wits: 7, stamina: 120, wins: 12 } })!;
    expect(saleValue(vet)).toBeGreaterThan(saleValue(rookie) + 500);
    expect(normalizeHall([{ name: 'Old Pinchy', faction: 'ancap', wins: '11', losses: 2, purses: 900 }, { name: 'x', faction: 'nope' }])).toEqual([{ name: 'Old Pinchy', faction: 'ancap', wins: 11, losses: 2, purses: 900 }]);
  });
});
