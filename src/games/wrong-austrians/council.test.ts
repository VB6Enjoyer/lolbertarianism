import { describe, expect, it } from 'vitest';
import { botPlay } from './bot.ts';
import {
  active, ask, backgroundCheck, beginCouncil, canFire, COUNCIL, crisisOf, enact, findPolicy, fire, type Game, IMPOSTORS, newGame, nextQuarter, policyOf, QUARTERS,
  score, won,
} from './council.ts';
import { CRISES } from './crises.ts';
import { MIRROR } from './mirror.ts';
import { LINES_MIRROR, QUESTIONS, SNEAK_NEWS } from './talk.ts';

const council = (seed = 3): Game => {
  const g = newGame(seed);
  beginCouncil(g);
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

  it('every question has two sound answers and two slips', () => {
    for (const q of QUESTIONS) {
      expect(q.sound.every(Boolean) && q.slips.every(Boolean), q.id).toBe(true);
    }
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
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

  it('allows two questions a quarter, each pair once', () => {
    const g = council();
    expect(ask(g, 0, g.offered[0])).not.toBeNull();
    expect(ask(g, 0, g.offered[0])).toBeNull();
    expect(ask(g, 1, g.offered[0])).not.toBeNull();
    expect(ask(g, 2, g.offered[1])).toBeNull();
    expect(g.questionsLeft).toBe(0);
    expect(ask(newGame(3), 0, newGame(3).offered[0])).toBeNull(); // not before the council sits
  });

  it('real Austrians never slip; the Viennese sometimes do', () => {
    let realSlips = 0;
    let vienneseSlips = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = council(seed);
      for (const a of g.advisors.slice(0, 2)) {
        const ans = ask(g, a.id, g.offered[0])!;
        if (ans.tone === 'slip') a.impostor ? vienneseSlips++ : realSlips++;
      }
    }
    expect(realSlips).toBe(0);
    expect(vienneseSlips).toBeGreaterThan(10);
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

  it('fires one advisor a quarter and reveals them; the Viennese cost Liberty while they stay', () => {
    const g = council(9);
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
    const g = council(10);
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
    const g = council(11);
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

  it('the background check works once a term, quietly', () => {
    const g = council(12);
    expect(backgroundCheck(g, 0)).toBe(true);
    expect(g.advisors[0].revealed && !g.advisors[0].fired).toBe(true);
    expect(backgroundCheck(g, 1)).toBe(false);
  });
});

describe('balance (bots)', () => {
  const rate = (style: 'savvy' | 'naive' | 'random', n = 400) => {
    let wins = 0;
    for (let s = 1; s <= n; s++) if (won(botPlay(newGame(s * 7919), style))) wins++;
    return wins / n;
  };

  it('knowing your economics wins nearly always; going by outcomes wins often; clicking at random rarely does', () => {
    expect(rate('savvy')).toBeGreaterThan(0.9);
    const naive = rate('naive');
    expect(naive).toBeGreaterThan(0.5);
    expect(naive).toBeLessThan(0.85);
    expect(rate('random')).toBeLessThan(0.25);
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
        if (ans.tone === 'slip') {
          expect(a.impostor).toBe(true);
          expect(q.sound).toContain(ans.text);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
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
    expect(rate('savvy')).toBeGreaterThan(0.9);
    const naive = rate('naive');
    expect(naive).toBeGreaterThan(0.5);
    expect(naive).toBeLessThan(0.85);
    expect(rate('random')).toBeLessThan(0.25);
  });
});
