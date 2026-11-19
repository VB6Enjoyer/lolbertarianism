import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedNow, normalizeUnlocked } from './achievements.ts';
import { botPlay } from './bot.ts';
import { ask, backgroundCheck, beginCouncil, canCheck, enact, fire, type Game, newGame, nextQuarter, questionsPer, termLength } from './council.ts';
import { dailyFor, normalizeDailyBests, TWISTS } from './daily.ts';

/** nextQuarter can end the term; TypeScript can't tell. */
const isOver = (g: Game) => g.phase === 'over';
const council = (g: Game) => {
  beginCouncil(g);
  return g;
};

describe('the daily term', () => {
  it('is the same for everyone on a date, and different the next day', () => {
    const a = dailyFor(new Date(2026, 10, 19));
    expect(dailyFor(new Date(2026, 10, 19, 23, 59))).toEqual(a);
    expect(a.key).toBe('2026-11-19');
    const b = dailyFor(new Date(2026, 10, 20));
    expect(b.seed).not.toBe(a.seed);
    expect(b.twist).not.toBe(a.twist);
    const g1 = newGame(a.seed, a.key, 'ancap', a.twist.id);
    const g2 = newGame(a.seed, a.key, 'ancap', a.twist.id);
    expect(JSON.stringify(g1)).toBe(JSON.stringify(g2));
  });

  it('cycles through every twist', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= TWISTS.length; d++) seen.add(dailyFor(new Date(2026, 0, d)).twist.id);
    expect(seen.size).toBe(TWISTS.length);
  });

  it('applies each twist', () => {
    expect(termLength(newGame(1, 'x', 'ancap', 'snap-election'))).toBe(6);
    const snap = botPlay(newGame(2, 'x', 'ancap', 'snap-election'), 'naive');
    if (snap.ending === 'term') expect(snap.quarter).toBe(6);
    const press = council(newGame(3, 'x', 'ancap', 'press-pass'));
    expect(questionsPer(press)).toBe(3);
    expect(press.questionsLeft).toBe(3);
    const lean = newGame(4, 'x', 'ancap', 'lean-times');
    expect(lean.prosperity).toBeLessThanOrEqual(40);
    const dc = council(newGame(5, 'x', 'ancap', 'double-check'));
    expect(backgroundCheck(dc, 0)).toBe(true);
    expect(canCheck(dc)).toBe(true);
    expect(backgroundCheck(dc, 1)).toBe(true);
    expect(canCheck(dc)).toBe(false);
    expect(dc.checked).toEqual([0, 1]);
  });

  it('Poker Face means no slips; Loose Lips means more of them', () => {
    const slips = (twist: 'poker-face' | 'loose-lips' | null) => {
      let n = 0;
      for (let seed = 1; seed <= 150; seed++) {
        const g = council(newGame(seed, 'x', 'ancap', twist));
        for (const a of g.advisors.filter((x) => x.impostor)) if (ask(g, a.id, g.offered[0])?.tone === 'slip') n++;
      }
      return n;
    };
    expect(slips('poker-face')).toBe(0);
    expect(slips('loose-lips')).toBeGreaterThan(slips(null));
  });

  it('keeps the last 60 daily bests', () => {
    const raw = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`2026-01-${String((i % 28) + 1).padStart(2, '0')}`.replace('01-', `${String(Math.floor(i / 28) + 1).padStart(2, '0')}-`), i]));
    expect(Object.keys(normalizeDailyBests({ ...raw, junk: 3, '2026-02-02': 'x' })).length).toBeLessThanOrEqual(60);
    expect(normalizeDailyBests(null)).toEqual({});
  });
});

describe('achievements', () => {
  const none = { wins: 0, mirrorWins: 0, dailies: 0 };

  it('have unique ids, and every one can be earned', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
  });

  it('nothing at the start of a term', () => {
    expect(earnedNow(newGame(1), none)).toEqual([]);
    expect(earnedNow(null, none)).toEqual([]);
  });

  it('firing: an impostor, a loyal advisor, both impostors', () => {
    const g = council(newGame(7));
    const [i1, i2] = g.advisors.filter((a) => a.impostor);
    const loyal = g.advisors.find((a) => !a.impostor)!;
    fire(g, loyal.id);
    expect(earnedNow(g, none)).toContain('oops');
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    if (isOver(g)) return;
    beginCouncil(g);
    fire(g, i1.id);
    expect(earnedNow(g, none)).toEqual(expect.arrayContaining(['oops', 'gotcha-one']));
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    if (isOver(g)) return;
    beginCouncil(g);
    fire(g, i2.id);
    const got = earnedNow(g, none);
    expect(got).toEqual(expect.arrayContaining(['purge', 'sworn-in', 'stateless']));
    expect(got).not.toContain('clean-sweep');
  });

  it('a clean, quick purge', () => {
    const g = council(newGame(8));
    const [i1, i2] = g.advisors.filter((a) => a.impostor);
    fire(g, i1.id);
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    if (isOver(g)) return;
    beginCouncil(g);
    fire(g, i2.id);
    expect(earnedNow(g, none)).toEqual(expect.arrayContaining(['clean-sweep', 'blitz', 'purge']));
  });

  it('the records count too, and the takeover is its own (secret) achievement', () => {
    expect(earnedNow(null, { wins: 2, mirrorWins: 1, dailies: 7 })).toEqual(expect.arrayContaining(['stateless', 'vienna-abides', 'both-sides', 'daily', 'dailies']));
    const g = council(newGame(9));
    const loyal = g.advisors.filter((a) => !a.impostor);
    fire(g, loyal[0].id);
    enact(g, g.proposals[0].policy);
    nextQuarter(g);
    if (isOver(g)) return;
    beginCouncil(g);
    fire(g, loyal[1].id);
    expect(earnedNow(g, none)).toContain('hired');
    expect(ACHIEVEMENTS.find((a) => a.id === 'hired')?.secret).toBe(true);
  });

  it('drops unknown ids from a save', () => {
    expect(normalizeUnlocked(['purge', 'nope', 'purge', 3])).toEqual(['purge']);
    expect(normalizeUnlocked('x')).toEqual([]);
  });
});
