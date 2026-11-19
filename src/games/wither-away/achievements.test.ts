import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, newlyEarned, type Progress } from './achievements.ts';
import { MAP_ORDER, RUN_LENGTH } from './data.ts';
import { newGame } from './game.ts';

const life = (over: Partial<Progress> = {}): Progress => ({ runs: 0, wins: 0, kills: 0, banks: 0, marx: 0, gold: 0, bank: 0, bought: 0, played: [], maps: [], endless: 0, ...over });

describe('achievements', () => {
  it('have unique ids, and each is either about a run or about a lifetime', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(!!a.run !== !!a.life, a.id).toBe(true);
  });

  it('a fresh run has earned nothing; doing things earns them, once', () => {
    const g = newGame(1, 'ancap');
    expect(newlyEarned([], g, life())).toEqual([]);
    g.kills = 1;
    g.time = 130;
    const first = newlyEarned([], g, null).map((a) => a.id);
    expect(first).toEqual(['first', 'untouched']);
    expect(newlyEarned(first, g, null)).toEqual([]);
    g.firstHurt = 30;
    expect(newlyEarned([], g, null).map((a) => a.id)).toEqual(['first']); // hurt too early
  });

  it('bosses, kill counts, bombs and endless milestones', () => {
    const g = newGame(1, 'agorist', { endless: true });
    Object.assign(g, { bankKills: 1, marxKills: 1, kills: 3000, bombsUsed: 1, time: RUN_LENGTH * 2 });
    g.killsBy = { taxman: 25, nimby: 30, printer: 3 };
    const ids = newlyEarned([], g, null).map((a) => a.id);
    for (const id of ['fed', 'marx', 'both', 'k1000', 'k3000', 'bomb', 'taxman', 'yimby', 'printers', 'long', 'longer']) expect(ids, id).toContain(id);
    expect(ids).not.toContain('nobomb');
    const standard = newGame(1, 'agorist');
    standard.time = RUN_LENGTH * 2;
    expect(newlyEarned([], standard, null).map((a) => a.id)).not.toContain('long');
  });

  it('lifetime ones: every character, every map, a full bank, shopping, veterans', () => {
    const ids = newlyEarned([], null, life({ played: ['ancap', 'minarchist', 'agorist', 'austrian'], maps: [...MAP_ORDER], bank: 1000, bought: 10, runs: 50, kills: 25000 })).map((a) => a.id);
    expect(ids.sort()).toEqual(['everyone', 'hodl', 'kills', 'maps', 'shopper', 'veteran']);
  });
});
