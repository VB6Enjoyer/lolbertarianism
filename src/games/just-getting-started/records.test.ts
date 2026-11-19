import { describe, expect, it } from 'vitest';
import { botRun } from './bot.ts';
import { CARDS } from './cards.ts';
import { cowbellLine } from './music.ts';
import { addHistory, DEFAULT_OPTIONS, emptySeen, HISTORY_MAX, historyEntry, killerOf, normalizeHistory, normalizeOptions, normalizeSeen, noteSeen } from './records.ts';
import { enterNode, newRun, reachable, runScore } from './run.ts';

/** A run the bot has played to the end (most of them are lost). */
function finishedRun(seed: number) {
  const run = newRun(seed);
  botRun(run);
  return run;
}

describe('run history', () => {
  it('records a lost run with what got you', () => {
    let run = finishedRun(1);
    for (let s = 2; run.screen !== 'lost'; s++) run = finishedRun(s);
    const e = historyEntry(run, { now: 1234 });
    expect(e).toMatchObject({ at: 1234, won: false, abandoned: false, character: 'milton', stage: 1, act: run.act, score: runScore(run) });
    expect(e.killer).toBe(killerOf(run));
    expect(run.combat!.enemies.map((x) => x.id)).toContain(e.killer);
  });

  it('blames a boss over its minions', () => {
    const run = newRun(5);
    run.combat = { enemies: [{ id: 'replyguy', maxHp: 99, dead: false }, { id: 'doomposter', maxHp: 50, dead: false }] } as never;
    run.screen = 'lost';
    expect(killerOf(run)).toBe('doomposter');
  });

  it('marks a run given up mid-act as abandoned, with no killer outside a fight', () => {
    const run = newRun(9);
    const e = historyEntry(run, { abandoned: true });
    expect(e.abandoned).toBe(true);
    expect(e.killer).toBeNull();
    expect(e.daily).toBeNull();
  });

  it('keeps the newest runs, up to the limit', () => {
    let list = normalizeHistory([]);
    for (let i = 0; i < HISTORY_MAX + 5; i++) list = addHistory(list, historyEntry(newRun(i), { now: i }));
    expect(list).toHaveLength(HISTORY_MAX);
    expect(list[0].at).toBe(HISTORY_MAX + 4);
  });

  it('cleans up a saved history', () => {
    const list = normalizeHistory([
      { at: 5, character: 'nobody', stage: 99, score: -3, act: 7, floor: 2, won: 'yes', killer: 'not-an-enemy', daily: 'today', secret: 'maybe' },
      null,
      'junk',
      { at: 6, character: 'david', stage: 3, score: 450, act: 3, floor: 8, won: true, killer: null, daily: '2026-11-18', secret: 'won' },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ character: 'milton', stage: 10, score: 0, act: 3, won: false, killer: null, daily: null, secret: null });
    expect(list[1]).toMatchObject({ character: 'david', stage: 3, won: true, daily: '2026-11-18', secret: 'won' });
    expect(normalizeHistory('nope')).toEqual([]);
  });
});

describe('the compendium', () => {
  it('notes the deck, the relics, the cards on offer and the enemies fought', () => {
    const run = newRun(3);
    const seen = emptySeen();
    expect(noteSeen(seen, run)).toBe(true);
    expect(seen.cards.sort()).toEqual(['calm', 'data', 'lunch']);
    expect(seen.relics).toEqual(['glasses']);
    expect(noteSeen(seen, run)).toBe(false);
    const first = reachable(run).find((n) => n.type === 'fight') ?? reachable(run)[0];
    enterNode(run, first.row, first.col);
    noteSeen(seen, run);
    if (run.combat) expect(seen.enemies.length).toBeGreaterThan(0);
  });

  it('fills up over a few runs, without duplicates', () => {
    const seen = emptySeen();
    for (let s = 1; s <= 6; s++) {
      const run = newRun(s);
      noteSeen(seen, run);
      botRun(run);
      noteSeen(seen, run);
    }
    expect(seen.enemies.length).toBeGreaterThan(1);
    expect(new Set(seen.cards).size).toBe(seen.cards.length);
    expect(seen.cards.every((id) => CARDS[id])).toBe(true);
  });

  it('drops ids this version doesn’t have', () => {
    expect(normalizeSeen({ cards: ['data', 'gone', 'data', 4], relics: ['glasses', 'nope'], enemies: 'x' })).toEqual({ cards: ['data'], relics: ['glasses'], enemies: [] });
    expect(normalizeSeen(undefined)).toEqual(emptySeen());
  });
});

describe('options', () => {
  it('fills in the defaults and keeps volumes between 0 and 1', () => {
    expect(normalizeOptions(undefined)).toEqual(DEFAULT_OPTIONS);
    expect(normalizeOptions({ music: 3, sound: -1, reduceFlashing: true, shake: false })).toEqual({ music: 1, sound: 0, reduceFlashing: true, shake: false });
    expect(normalizeOptions({ music: 'loud', sound: 0.42 })).toMatchObject({ music: DEFAULT_OPTIONS.music, sound: 0.4, shake: true });
  });
});

describe('the soundtrack', () => {
  it('has a four-bar cowbell line per mood, the same every time, busier in a fight', () => {
    const calm = cowbellLine('calm');
    expect(calm).toHaveLength(64);
    expect(cowbellLine('calm')).toEqual(calm);
    const notes = (line: (number | null)[]) => line.filter((n) => n !== null).length;
    expect(notes(cowbellLine('boss'))).toBeGreaterThan(notes(calm));
    expect(notes(calm)).toBeGreaterThan(0);
  });
});
