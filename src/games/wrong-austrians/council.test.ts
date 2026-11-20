import { describe, expect, it } from 'vitest';
import { botPlay } from './bot.ts';
import { TOOL_ORDER, TOOLS } from './clues.ts';
import {
  active, ANSWER_ODDS, ask, beginCouncil, canFire, canInvestigate, COUNCIL, crisisOf, enact, findPolicy, fire, FIRING_FROM, type Game, IMPOSTORS, investigate,
  newGame, nextQuarter, policyOf, QUARTERS, QUESTIONS_PER_QUARTER, score, upgradeGame, won,
} from './council.ts';
import { CRISES } from './crises.ts';
import { MIRROR } from './mirror.ts';
import { LINES_MIRROR, QUESTIONS, SNEAK_NEWS } from './talk.ts';

const council = (seed = 3): Game => {
  const g = newGame(seed);
  beginCouncil(g);
  return g;
};
/** Plays sound policy through the probation quarters, to the first council where firing is allowed. */
const atFiring = (seed: number): Game => {
  const g = council(seed);
  while (g.quarter < FIRING_FROM && g.phase !== 'over') {
    enact(g, (g.proposals.find((p) => policyOf(p.policy).kind === 'sound') ?? g.proposals[0]).policy);
    nextQuarter(g);
    beginCouncil(g);
  }
  return g;
};

describe('the content', () => {
  it('every crisis has three sound policies, two disguised and one blatant, with unique ids', () => {
    const ids = new Set<string>();
    for (const c of CRISES) {
      const kinds = c.policies.map((p) => p.kind);
      expect(kinds.filter((k) => k === 'sound'), c.id).toHaveLength(3);
      expect(kinds.filter((k) => k === 'disguised'), c.id).toHaveLength(2);
      expect(kinds.filter((k) => k === 'blatant'), c.id).toHaveLength(1);
      for (const p of c.policies) {
        expect(ids.has(p.id), p.id).toBe(false);
        ids.add(p.id);
        // Bad policy looks good now and costs later; sound policy pays off later.
        if (p.kind === 'sound') expect(p.later.p ?? 0, p.id).toBeGreaterThan(0);
        else expect(p.later.p ?? 0, p.id).toBeLessThan(0);
        if (p.kind === 'disguised') expect(p.now.p ?? 0, p.id).toBeGreaterThan(0);
      }
    }
    expect(CRISES.length).toBeGreaterThanOrEqual(QUARTERS);
  });

  it('every question has three right answers, three near-misses (each explained) and two slips; enough of them for a whole term', () => {
    for (const q of QUESTIONS) {
      expect(q.sound.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.near.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.slips.length, q.id).toBeGreaterThanOrEqual(2);
      expect([...q.sound, ...q.slips, ...q.near.map((x) => x.text), ...q.near.map((x) => x.why)].every((x) => x.length > 3), q.id).toBe(true);
      const all = [...q.sound, ...q.slips, ...q.near.map((x) => x.text)];
      expect(new Set(all).size, q.id).toBe(all.length);
    }
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it('every investigation has several items of every lean', () => {
    for (const id of TOOL_ORDER) for (const [lean, items] of Object.entries(TOOLS[id].items)) expect(items.length, `${id} ${lean}`).toBeGreaterThanOrEqual(COUNCIL);
  });
});

describe('a term', () => {
  it('starts with five advisors, two of them impostors, and eight different crises', () => {
    const g = newGame(1);
    expect(g.advisors).toHaveLength(COUNCIL);
    expect(g.advisors.filter((a) => a.impostor)).toHaveLength(IMPOSTORS);
    expect(new Set(g.advisors.map((a) => a.name)).size).toBe(COUNCIL);
    expect(new Set(g.crises).size).toBe(QUARTERS);
    expect(g.proposals.length).toBeGreaterThan(0);
    expect(g.proposals.flatMap((p) => p.backers).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(g.talk.length).toBe(COUNCIL);
  });

  it('is the same term for the same seed', () => {
    expect(JSON.stringify(newGame(42))).toBe(JSON.stringify(newGame(42)));
  });

  it('survives a save and load mid-quarter', () => {
    const g = council(8);
    ask(g, 0, g.offered[0]);
    const copy: Game = JSON.parse(JSON.stringify(g));
    enact(g, g.proposals[0].policy);
    enact(copy, copy.proposals[0].policy);
    nextQuarter(g);
    nextQuarter(copy);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(g));
  });

  it(`allows ${QUESTIONS_PER_QUARTER} questions a quarter, each pair once, and offers fresh ones`, () => {
    const g = council();
    expect(ask(g, 0, g.offered[0])).not.toBeNull();
    expect(ask(g, 0, g.offered[0])).toBeNull();
    expect(ask(g, 1, g.offered[0])).not.toBeNull();
    expect(ask(g, 2, g.offered[1])).not.toBeNull();
    expect(ask(g, 3, g.offered[2])).toBeNull();
    expect(g.questionsLeft).toBe(0);
    expect(ask(newGame(3), 0, newGame(3).offered[0])).toBeNull(); // not before the council sits
    const asked = new Set(g.answers.map((a) => a.question));
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    for (const id of g.offered) expect(asked.has(id), id).toBe(false);
  });

  it('the Viennese get it right about half the time, mostly near-missing otherwise; real Austrians miss a fifth of the time, and never slip', () => {
    const tally = { loyal: { sound: 0, near: 0, slip: 0, dodge: 0 }, impostor: { sound: 0, near: 0, slip: 0, dodge: 0 } };
    for (let seed = 1; seed <= 600; seed++) {
      const g = council(seed);
      for (const a of g.advisors.slice(0, 3)) {
        const ans = ask(g, a.id, g.offered[0])!;
        tally[a.impostor ? 'impostor' : 'loyal'][ans.tone]++;
        const q = QUESTIONS.find((x) => x.id === ans.question)!;
        if (ans.tone === 'near') expect(q.near.find((x) => x.text === ans.text)?.why).toBe(ans.why);
        if (ans.tone === 'sound') expect(q.sound).toContain(ans.text);
      }
    }
    const share = (side: 'loyal' | 'impostor', tone: 'sound' | 'near' | 'slip') => tally[side][tone] / Object.values(tally[side]).reduce((a, b) => a + b, 0);
    expect(tally.loyal.slip).toBe(0);
    expect(Math.abs(share('impostor', 'sound') - ANSWER_ODDS.normal.impostor.sound)).toBeLessThan(0.07);
    expect(Math.abs(share('loyal', 'near') - ANSWER_ODDS.normal.loyal.near)).toBeLessThan(0.05);
    expect(share('impostor', 'near')).toBeGreaterThan(share('impostor', 'slip') * 3);
  });

  it('asking the same person the same question again gets the same answer (only a dodge gets a second try)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = council(seed);
      const q = g.offered[0];
      const first = ask(g, 1, q)!;
      enact(g, g.proposals[0].policy);
      nextQuarter(g);
      if (g.phase === 'over') continue;
      beginCouncil(g);
      g.offered[0] = q;
      const again = ask(g, 1, q)!;
      if (first.tone === 'dodge') expect(again.tone).not.toBe('dodge');
      else {
        expect(again.text).toBe(first.text);
        expect(again.tone).toBe(first.tone);
        expect(again.repeat).toBe(true);
      }
      expect(ask(g, 1, q)).toBeNull(); // not twice in one quarter
    }
  });

  it('every question has hard near-misses too: at least five per question', () => {
    for (const q of QUESTIONS) expect(q.near.length, q.id).toBeGreaterThanOrEqual(5);
  });

  it('investigations: one a quarter, each tool once a term, from a hidden past that leans but doesn’t prove', () => {
    const g = council(12);
    const clue = investigate(g, 'thesis', 0)!;
    expect(clue.text).toBe(g.advisors[0].profile.thesis.text);
    expect(g.advisors[0].revealed).toBe(false); // they don't know you looked, and neither do you, for sure
    expect(canInvestigate(g)).toBe(false);
    expect(investigate(g, 'cv', 1)).toBeNull();
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    beginCouncil(g);
    expect(canInvestigate(g, 'thesis')).toBe(false);
    expect(investigate(g, 'cv', 1)).not.toBeNull();
    // Across many terms, the loyal ones look the part more often than the impostors, but not always.
    const lean = { loyal: { austrian: 0, other: 0 }, impostor: { austrian: 0, other: 0 } };
    for (let seed = 1; seed <= 300; seed++) {
      for (const a of newGame(seed).advisors) for (const t of TOOL_ORDER) lean[a.impostor ? 'impostor' : 'loyal'][a.profile[t].lean === 'austrian' ? 'austrian' : 'other']++;
    }
    const austrianShare = (side: 'loyal' | 'impostor') => lean[side].austrian / (lean[side].austrian + lean[side].other);
    expect(austrianShare('loyal')).toBeGreaterThan(0.45);
    expect(austrianShare('impostor')).toBeGreaterThan(0.2);
    expect(austrianShare('impostor')).toBeLessThan(austrianShare('loyal') - 0.15);
  });

  it('brings an old save up to date: pasts for everyone, and no more background checks', () => {
    const g = council(13) as Game & { checksUsed?: number; checked?: number[] };
    for (const a of g.advisors) delete (a as Partial<typeof a>).profile;
    delete (g as Partial<Game>).clues;
    delete (g as Partial<Game>).toolsUsed;
    g.checksUsed = 1;
    g.checked = [2];
    g.advisors[2].revealed = true;
    upgradeGame(g);
    expect(g.advisors.every((a) => a.profile?.thesis)).toBe(true);
    expect(g.clues).toEqual([]);
    expect(g.advisors[2].revealed).toBe(false);
    expect('checksUsed' in g).toBe(false);
  });

  it('enacting applies the effect now and schedules the rest', () => {
    const g = council(5);
    const p = g.proposals[0];
    const pol = policyOf(p.policy);
    const before = g.prosperity;
    enact(g, p.policy);
    expect(g.prosperity).toBe(Math.max(0, Math.min(100, before + (pol.now.p ?? 0))));
    expect(g.pending).toEqual([expect.objectContaining({ policy: p.policy, due: 1 + pol.later.in, backers: p.backers })]);
    expect(g.phase).toBe('result');
  });

  it('lands the bill with the names of whoever backed it', () => {
    const g = council(6);
    const p = g.proposals[0];
    const pol = policyOf(p.policy);
    enact(g, p.policy);
    for (let q = 0; q < pol.later.in; q++) {
      nextQuarter(g);
      if (g.phase === 'over') return;
      if (q < pol.later.in - 1) {
        beginCouncil(g);
        enact(g, g.proposals[0].policy);
      }
    }
    expect(g.news.find((n) => n.policy === p.policy)).toMatchObject({ backers: p.backers, good: pol.kind === 'sound' });
  });

  it('nobody can be fired in the first quarters (Austrian labour law)', () => {
    const g = council(9);
    expect(canFire(g)).toBe(false);
    expect(fire(g, 0)).toBe(false);
    expect(canFire(atFiring(9))).toBe(true);
  });

  it('fires one advisor a quarter and reveals them; the Viennese cost Liberty while they stay', () => {
    const g = atFiring(9);
    const real = g.advisors.find((a) => !a.impostor)!;
    expect(fire(g, real.id)).toBe(true);
    expect(real.revealed && real.fired).toBe(true);
    expect(canFire(g)).toBe(false);
    expect(fire(g, g.advisors.find((a) => !a.fired)!.id)).toBe(false);
    enact(g, g.proposals[0].policy);
    const liberty = g.liberty;
    nextQuarter(g);
    expect(g.news.some((n) => n.good === false && !n.policy && (n.effect.l ?? 0) < 0)).toBe(true);
    expect(g.liberty).toBeLessThan(liberty + 20);
  });

  it('wins early once both Viennese are fired', () => {
    const g = atFiring(10);
    const [v1, v2] = g.advisors.filter((a) => a.impostor);
    fire(g, v1.id);
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    if (g.phase === 'over') return;
    beginCouncil(g);
    fire(g, v2.id);
    expect(g.ending).toBe('purged');
    expect(won(g)).toBe(true);
    expect(score(g)).toBeGreaterThan(100);
  });

  it('loses when the Viennese outnumber the real Austrians', () => {
    const g = atFiring(11);
    const reals = g.advisors.filter((a) => !a.impostor);
    fire(g, reals[0].id);
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    if (g.phase === 'over') return;
    beginCouncil(g);
    fire(g, reals[1].id);
    expect(g.ending).toBe('takeover');
    expect(won(g)).toBe(false);
  });

});

describe('balance (bots)', () => {
  const rate = (style: 'savvy' | 'naive' | 'random', n = 400) => {
    let wins = 0;
    for (let s = 1; s <= n; s++) if (won(botPlay(newGame(s * 7919), style))) wins++;
    return wins / n;
  };

  it('a perfect detective who knows their economics usually wins, but not always; going by the obvious mostly loses; clicking at random nearly always does', () => {
    const savvy = rate('savvy');
    expect(savvy).toBeGreaterThan(0.65);
    expect(savvy).toBeLessThan(0.92);
    expect(rate('naive')).toBeLessThan(0.3);
    expect(rate('random')).toBeLessThan(0.15);
  });

  it('the detective has to dig: terms run long, and a purge at the first chance is rare', () => {
    let quarters = 0;
    let quick = 0;
    const n = 200;
    for (let s = 1; s <= n; s++) {
      const g = botPlay(newGame(s * 104729), 'savvy');
      quarters += g.quarter;
      if (g.ending === 'purged' && g.quarter <= FIRING_FROM + 1) quick++;
    }
    expect(quarters / n).toBeGreaterThan(5.5);
    expect(quick / n).toBeLessThan(0.2);
  });

  it('every term ends; a won term settles the bills still to come', () => {
    for (let s = 1; s <= 50; s++) {
      const g = botPlay(newGame(s), 'naive');
      expect(g.phase).toBe('over');
      if (won(g)) expect(g.pending).toHaveLength(0);
      expect(active(g).length).toBeGreaterThan(0);
    }
  });
});

describe('mirror mode', () => {
  const mirror = (seed = 3): Game => {
    const g = newGame(seed, null, 'mirror');
    beginCouncil(g);
    return g;
  };

  it('has its own policies for every crisis: three loyal, two disguised, one blatant', () => {
    const ids = new Set(CRISES.flatMap((c) => c.policies.map((p) => p.id)));
    for (const c of CRISES) {
      const m = MIRROR[c.id];
      expect(m, c.id).toBeDefined();
      const kinds = m.policies.map((p) => p.kind);
      expect([kinds.filter((k) => k === 'sound').length, kinds.filter((k) => k === 'disguised').length, kinds.filter((k) => k === 'blatant').length], c.id).toEqual([3, 2, 1]);
      for (const p of m.policies) {
        expect(ids.has(p.id), p.id).toBe(false);
        ids.add(p.id);
        expect(findPolicy(p.id)).toBe(p);
      }
    }
  });

  it('tables the mirror policies, with the crisis as Vienna sees it', () => {
    const g = mirror(4);
    const crisis = crisisOf(g);
    expect(crisis.policies).toBe(MIRROR[crisis.id].policies);
    for (const p of g.proposals) expect(p.policy.startsWith('m-'), p.policy).toBe(true);
    const opera = newGame(1, null, 'mirror');
    opera.crises[0] = 'opera';
    expect(crisisOf(opera).title).toBe('The Opera Wants a New Wing');
  });

  it('loyal Viennese answer like the Finance Ministry; the ancaps slip into Mises', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = mirror(seed);
      for (const a of g.advisors.slice(0, 2)) {
        const ans = ask(g, a.id, g.offered[0])!;
        const q = QUESTIONS.find((x) => x.id === ans.question)!;
        if (ans.tone === 'sound') expect(q.slips).toContain(ans.text);
        if (ans.tone === 'near') expect(q.near.some((x) => x.text === ans.text)).toBe(true);
        if (ans.tone === 'slip') {
          expect(a.impostor).toBe(true);
          expect(q.sound).toContain(ans.text);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('the debate and the quiet damage are the mirror kind', () => {
    const lines = new Set(Object.values(LINES_MIRROR).flat());
    let unsigned = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = mirror(seed);
      for (const t of g.talk) {
        const template = [...lines].some((l) => {
          const re = new RegExp('^' + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{x\\\}|\\\{p\\\}/g, '.*') + '$');
          return re.test(t.text);
        });
        expect(template, t.text).toBe(true);
      }
      enact(g, g.proposals[0].policy);
      nextQuarter(g);
      for (const n of g.news.filter((x) => !x.policy && x.good === false)) {
        expect(SNEAK_NEWS.mirror.some((l) => n.text.startsWith(l.split('{n}')[0].slice(0, 12)))).toBe(true);
        unsigned++;
      }
    }
    expect(unsigned).toBeGreaterThan(10);
  });

  it('saves and loads, and the same seed is the same term', () => {
    const g = mirror(8);
    expect(JSON.stringify(JSON.parse(JSON.stringify(g)))).toBe(JSON.stringify(g));
    expect(JSON.stringify(newGame(9, null, 'mirror'))).toBe(JSON.stringify(newGame(9, null, 'mirror')));
    expect(newGame(9, null, 'mirror').mode).toBe('mirror');
    expect(newGame(9).mode).toBe('ancap');
  });

  it('plays about as hard as the original', () => {
    const rate = (style: 'savvy' | 'naive' | 'random') => {
      let wins = 0;
      for (let s = 1; s <= 400; s++) if (won(botPlay(newGame(s * 7919, null, 'mirror'), style))) wins++;
      return wins / 400;
    };
    const savvy = rate('savvy');
    expect(savvy).toBeGreaterThan(0.65);
    expect(savvy).toBeLessThan(0.92);
    expect(rate('naive')).toBeLessThan(0.3);
    expect(rate('random')).toBeLessThan(0.15);
  });

  it('the hidden pasts swap schools: the loyal Viennese look statist', () => {
    let statist = 0;
    let austrian = 0;
    for (let seed = 1; seed <= 100; seed++) for (const a of newGame(seed, null, 'mirror').advisors.filter((x) => !x.impostor)) for (const t of TOOL_ORDER) a.profile[t].lean === 'statist' ? statist++ : a.profile[t].lean === 'austrian' && austrian++;
    expect(statist).toBeGreaterThan(austrian * 2.5);
  });
});
