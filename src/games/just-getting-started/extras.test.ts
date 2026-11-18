import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedNow } from './achievements.ts';
import { botRun, botTurn } from './bot.ts';
import { endTurn, playCard, startCombat, type FightSetup } from './combat.ts';
import { dailyFor, normalizeDailyBests, TWISTS } from './daily.ts';
import { makeRng } from './rng.ts';
import { enterNode, newRun, runScore } from './run.ts';
import { shareText } from './share.ts';
import type { Card } from './state.ts';

const deck = (ids: string[]): Card[] => ids.map((id, i) => ({ uid: i + 1, id, up: false }));
const setup = (over: Partial<FightSetup> = {}): FightSetup => ({
  act: 1, kind: 'fight', enemies: ['doomscroller'], deck: deck(['data', 'data', 'data', 'data', 'data', 'calm', 'calm', 'calm', 'calm', 'lunch']),
  hp: 70, maxHp: 70, relics: [], based: 0, rng: makeRng(7), nextUid: 100, ...over,
});

describe('the enemies’ turn, step by step', () => {
  it('marks each enemy’s move before what it does, and every hit carries the bars’ new values', () => {
    const c = startCombat(setup({ enemies: ['replyguy', 'replyguy'] }));
    c.fx = [];
    c.enemies.forEach((e) => (e.move = 'actually'));
    endTurn(c);
    const acts = c.fx.filter((e) => e.kind === 'act');
    expect(acts.map((e) => e.kind === 'act' && e.target)).toEqual(c.enemies.map((e) => e.uid));
    const firstAct = c.fx.findIndex((e) => e.kind === 'act');
    const hit = c.fx.findIndex((e) => e.kind === 'damage' && e.target === 'player');
    expect(hit).toBeGreaterThan(firstAct);
    const last = [...c.fx].reverse().find((e) => e.kind === 'damage' && e.target === 'player');
    expect(last?.kind === 'damage' && last.hp).toBe(c.player.hp);
  });
});

describe('the daily run', () => {
  it('is the same all day, changes twist day by day, and keeps two months of bests', () => {
    const a = dailyFor(new Date(2026, 10, 18, 9));
    const b = dailyFor(new Date(2026, 10, 18, 23));
    expect(a).toEqual(b);
    expect(a.key).toBe('2026-11-18');
    const week = Array.from({ length: TWISTS.length }, (_, i) => dailyFor(new Date(2026, 10, 18 + i)).twist.id);
    expect(new Set(week).size).toBe(TWISTS.length);
    const bests = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`, i]));
    expect(Object.keys(normalizeDailyBests({ ...bests, nope: 3 }))).toHaveLength(60);
  });

  it('applies its twist: no Inflation on the gold standard, Exposed enemies on stagflation, Helicopter money to start', () => {
    const gold = startCombat(setup({ twist: 'gold-standard' }));
    gold.hand = [{ uid: 900, id: 'helicopter', up: false }];
    gold.player.energy = 3;
    playCard(gold, 0, 0);
    expect([...gold.draw, ...gold.discard, ...gold.hand].some((x) => x.id === 'inflation')).toBe(false);
    const stag = startCombat(setup({ twist: 'stagflation' }));
    expect(stag.enemies[0].status.exposed).toBeGreaterThan(0);
    expect([...stag.draw, ...stag.hand].some((x) => x.id === 'inflation')).toBe(true);
    const heli = newRun(5, { key: '2026-11-18', twist: 'helicopter' });
    expect(heli.deck.filter((x) => x.id === 'helicopter')).toHaveLength(2);
    expect(heli.royalties).toBe(199);
  });

  it('plays the same for everyone: two daily runs from the same seed end the same way', () => {
    const d = dailyFor(new Date(2026, 10, 20));
    const one = newRun(d.seed, { key: d.key, twist: d.twist.id });
    const two = newRun(d.seed, { key: d.key, twist: d.twist.id });
    botRun(one);
    botRun(two);
    expect(runScore(one)).toBe(runScore(two));
    expect(one.stats).toEqual(two.stats);
  });
});

describe('achievements', () => {
  it('have unique ids and icons', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.icon)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);
  });

  it('unlock from what happens in a run', () => {
    const run = newRun(9);
    const base = { lasers: 0, eventsSeen: 0, dailies: 0 };
    expect(earnedNow({ run, combat: null, ...base })).toEqual([]);
    enterNode(run, 0, 0);
    const c = run.combat!;
    c.flags.lasers = 2;
    c.flags.bigHit = 41;
    expect(earnedNow({ run, combat: c, ...base })).toEqual(expect.arrayContaining(['laser', 'laser-2', 'big-hit']));
    run.screen = 'won';
    run.stats.bosses = 3;
    const won = earnedNow({ run, combat: null, ...base });
    expect(won).toEqual(expect.arrayContaining(['win', 'boss-1', 'boss-2', 'no-regret', 'lean']));
    expect(earnedNow({ run, combat: null, ...base, lasers: 25 })).toContain('laser-25');
  });

  it('track the biggest card and the busiest turn', () => {
    const c = startCombat(setup({ enemies: ['nimby'] }));
    c.hand = [{ uid: 901, id: 'nobel', up: true }];
    c.player.energy = 3;
    playCard(c, 0, 0);
    expect(c.flags.bigHit).toBeGreaterThanOrEqual(34);
    expect(c.flags.maxTurnCards).toBe(1);
    botTurn(c);
  });
});

describe('sharing', () => {
  it('sums up the run in a few lines', () => {
    const text = shareText({ won: false, score: 230, act: 2, floor: 4, fights: 9, damage: 600, lasers: 5, deck: 18, daily: { key: '2026-11-18', name: 'Bull Market Day', icon: '🐂' }, url: 'https://example.com/jgs' });
    expect(text.split('\n')).toEqual([
      '😈 JUST GETTING STARTED · 🐂 Daily 2026-11-18 (Bull Market Day)',
      'Ratio’d in Act 2, floor 4 😔',
      '🏆 230 points · 🎙️ 9 arguments won · 🔴 5 laser blasts',
      'https://example.com/jgs',
    ]);
  });
});
