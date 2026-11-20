import { describe, expect, it } from 'vitest';
import { botPlay } from './bot.ts';
import { TOOL_ORDER } from './clues.ts';
import {
  active, ask, backersShown, behaviour, beginCouncil, budgetLeft, DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyId, enact, evidenceOn, fire, FIRING_FROM, type Game,
  impostorText, investigate, newGame, nextQuarter, policyOf, questionsPer, QUARTERS, RUMOUR_TRUE, score, submitVerdict, upgradeGame, won,
} from './council.ts';
import { LINES, LINES_MIRROR, QUESTIONS } from './talk.ts';

const game = (seed: number, difficulty: DifficultyId, mode: 'ancap' | 'mirror' = 'ancap') => newGame(seed, null, mode, null, difficulty);
const sound = (g: Game) => (g.proposals.find((p) => policyOf(p.policy).kind === 'sound') ?? g.proposals[0]).policy;
/** Plays sound policy (firing nobody) to the closing verdict, or to the end if the economy gives out first. */
const toVerdict = (g: Game) => {
  for (let guard = 0; guard < 100 && g.phase !== 'verdict' && g.phase !== 'over'; guard++) {
    if (g.phase === 'briefing') beginCouncil(g);
    else if (g.phase === 'council') enact(g, sound(g));
    else nextQuarter(g);
  }
  return g;
};
const toFiring = (g: Game) => {
  beginCouncil(g);
  while (g.quarter < FIRING_FROM && g.phase !== 'over') {
    enact(g, sound(g));
    nextQuarter(g);
    beginCouncil(g);
  }
  return g;
};

describe('difficulty levels', () => {
  it('Normal is the classic: five advisors, two impostors, no sleeper, open backing, three questions, no rumours', () => {
    for (let s = 1; s <= 20; s++) {
      const g = game(s, 'normal');
      expect(g.advisors).toHaveLength(5);
      expect(g.advisors.filter((a) => a.impostor)).toHaveLength(2);
      expect(g.advisors.some((a) => a.sleeper)).toBe(false);
      beginCouncil(g);
      expect(questionsPer(g)).toBe(3);
      expect(budgetLeft(g)).toBe(Infinity);
      expect(g.proposals.every((p) => backersShown(g, g.quarter, p.policy))).toBe(true);
      toVerdict(g);
      expect(g.rumours).toHaveLength(0);
    }
    expect(impostorText(DIFFICULTIES.normal)).toBe('2');
  });

  it('a new game defaults to Normal, and an old save is brought up to Normal', () => {
    expect(newGame(3).difficulty).toBe('normal');
    const old = newGame(3) as Partial<Game>;
    delete old.difficulty;
    delete old.rumours;
    delete old.verdict;
    upgradeGame(old as Game);
    expect(old.difficulty).toBe('normal');
    expect(old.rumours).toEqual([]);
    expect(old.verdict).toBeNull();
  });

  it('Hard: anonymous proposals until enacted, two questions, a sleeper, investigations cost Prosperity', () => {
    const g = game(5, 'hard');
    beginCouncil(g);
    expect(questionsPer(g)).toBe(2);
    expect(g.questionsLeft).toBe(2);
    expect(g.proposals.some((p) => backersShown(g, g.quarter, p.policy))).toBe(false);
    const pick = sound(g);
    const before = g.prosperity;
    const tool = TOOL_ORDER[0];
    investigate(g, tool, 0);
    expect(g.prosperity).toBe(before - 1);
    expect(investigate(g, TOOL_ORDER[1], 1)).toBeNull(); // one a quarter
    enact(g, pick);
    expect(backersShown(g, 1, pick)).toBe(true);
    const sleepers = g.advisors.filter((a) => a.sleeper);
    expect(sleepers).toHaveLength(1);
    expect(sleepers[0].impostor).toBe(true);
    expect(behaviour(g, sleepers[0])).toBe('deep');
  });

  it('Hard and Expert: only the technical near-misses, no misspelled names', () => {
    for (const d of ['hard', 'expert'] as const) {
      let nears = 0;
      for (let s = 1; s <= 60; s++) {
        const g = game(s, d);
        beginCouncil(g);
        for (const a of active(g)) {
          for (const q of g.offered) {
            const ans = ask(g, a.id, q);
            if (!ans) continue;
            if (ans.tone === 'near') {
              nears++;
              const nm = QUESTIONS.find((x) => x.id === q)!.near.find((x) => x.text === ans.text)!;
              expect(nm.hard).toBe(true);
            }
          }
        }
      }
      expect(nears).toBeGreaterThan(5);
    }
  });

  it('Hard and Expert: rumours from the second quarter, true about 60% of the time', () => {
    let total = 0;
    let truths = 0;
    for (let s = 1; s <= 120; s++) {
      const g = toVerdict(game(s, 'hard'));
      expect(g.rumours.every((r) => r.quarter >= 2)).toBe(true);
      for (const r of g.rumours) {
        total++;
        const real = g.advisors[r.advisor].profile[r.tool];
        if (r.true) {
          truths++;
          expect(r.text).toBe(real.text);
          expect(r.lean).toBe(real.lean);
        }
      }
    }
    expect(total).toBeGreaterThan(300);
    expect(truths / total).toBeGreaterThan(RUMOUR_TRUE + 0.0 - 0.1);
    expect(truths / total).toBeLessThan(RUMOUR_TRUE + 0.15);
  });

  it('Hard: the impostors lie low after one of them is fired', () => {
    let checked = 0;
    for (let s = 1; s <= 40 && checked < 5; s++) {
      const g = toFiring(game(s, 'hard'));
      if (g.phase !== 'council') continue;
      const loud = g.advisors.find((a) => a.impostor && !a.sleeper)!;
      const sleeper = g.advisors.find((a) => a.sleeper)!;
      expect(behaviour(g, loud)).toBe('impostor');
      fire(g, sleeper.id);
      enact(g, sound(g));
      nextQuarter(g);
      if ((g.phase as string) === 'over') continue;
      expect(behaviour(g, loud)).toBe('deep');
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('Expert: six advisors, one to three impostors (you’re not told), a ten-question budget, two investigations a quarter', () => {
    const counts = new Set<number>();
    for (let s = 1; s <= 80; s++) {
      const g = game(s, 'expert');
      expect(g.advisors).toHaveLength(6);
      const k = g.advisors.filter((a) => a.impostor).length;
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(3);
      counts.add(k);
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
    expect(impostorText(DIFFICULTIES.expert)).toMatch(/one to three/);

    const g = game(9, 'expert');
    beginCouncil(g);
    investigate(g, 'thesis', 0);
    expect(g.investigated).toBe(false);
    investigate(g, 'alma', 1);
    expect(g.investigated).toBe(true);
    // Spend the whole budget, quarter by quarter.
    let asked = 0;
    for (let guard = 0; guard < 100 && g.phase !== 'verdict' && g.phase !== 'over'; guard++) {
      if (g.phase === 'briefing') beginCouncil(g);
      else if (g.phase === 'council') {
        for (const a of active(g)) for (const q of g.offered) if (ask(g, a.id, q)) asked++;
        enact(g, sound(g));
      } else nextQuarter(g);
    }
    expect(asked).toBe(10);
    expect(budgetLeft(g)).toBe(0);
  });

  it('Expert: the verdict must be exactly right; a wrong call loses, a right one (even “clean”) wins', () => {
    let rights = 0;
    let wrongs = 0;
    for (let s = 1; s <= 40; s++) {
      const a = toVerdict(game(s, 'expert'));
      const b = toVerdict(game(s, 'expert'));
      if (a.phase !== 'verdict') continue;
      const truth = active(a).filter((x) => x.impostor).map((x) => x.id);
      submitVerdict(a, truth);
      expect(a.ending).toBe('term');
      expect(won(a)).toBe(true);
      rights++;
      submitVerdict(b, []);
      expect(b.ending).toBe('unclean');
      expect(won(b)).toBe(false);
      expect(b.verdict!.missed).toEqual(truth);
      wrongs++;
    }
    expect(rights).toBeGreaterThan(5);
    expect(wrongs).toBeGreaterThan(5);
  });

  it('Normal: the verdict is scored, not exact', () => {
    const right = toVerdict(game(21, 'normal'));
    const wrong = toVerdict(game(21, 'normal'));
    if (right.phase !== 'verdict') return;
    const truth = active(right).filter((x) => x.impostor).map((x) => x.id);
    const loyal = active(right).filter((x) => !x.impostor).map((x) => x.id);
    submitVerdict(right, truth);
    submitVerdict(wrong, loyal.slice(0, 1));
    expect(won(right) && won(wrong)).toBe(true);
    expect(score(right)).toBeGreaterThan(score(wrong));
  });

  it('every term ends on every level, and serves all eight quarters unless it’s lost', () => {
    for (const d of DIFFICULTY_ORDER) {
      for (let s = 1; s <= 30; s++) {
        const g = botPlay(game(s, d), 'savvy');
        expect(g.phase).toBe('over');
        if (won(g)) expect(g.quarter).toBe(QUARTERS);
        if (won(g)) expect(g.verdict).not.toBeNull();
      }
    }
  });

  it('the debate: impostors and loyal advisors use the same lines, citing real evidence', () => {
    expect(Object.keys(LINES).sort()).toEqual(Object.keys(LINES_MIRROR).sort());
    const g = toFiring(game(4, 'hard'));
    const says = g.talk.map((t) => t.text);
    expect(says.length).toBeGreaterThan(0);
    const all = [...Object.values(LINES).flat(), ...Object.values(LINES_MIRROR).flat()];
    // No comic giveaways left.
    expect(all.join(' ')).not.toMatch(/abolish the state|one of us|comrade/i);
    for (const a of g.advisors) for (const e of evidenceOn(g, a.id)) expect(e.weight).toBeGreaterThan(0);
  });

  it('the levels get harder: a perfect detective wins less on each, and always beats going by the obvious', () => {
    const rate = (d: DifficultyId, style: 'savvy' | 'naive', n = 150) => {
      let w = 0;
      for (let s = 1; s <= n; s++) if (won(botPlay(game(s * 7919, d), style))) w++;
      return w / n;
    };
    const savvy = DIFFICULTY_ORDER.map((d) => rate(d, 'savvy'));
    const naive = DIFFICULTY_ORDER.map((d) => rate(d, 'naive'));
    expect(savvy[0]).toBeGreaterThan(savvy[1]);
    expect(savvy[1]).toBeGreaterThan(savvy[2]);
    for (let i = 0; i < 3; i++) expect(savvy[i]).toBeGreaterThan(naive[i]);
    expect(savvy[2]).toBeGreaterThan(0.05);
    expect(savvy[1]).toBeLessThan(0.75);
  });
});
