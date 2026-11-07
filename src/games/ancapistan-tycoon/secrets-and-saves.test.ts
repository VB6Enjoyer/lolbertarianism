import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, GOLDEN_EFFECTS } from './data.ts';
import { catchGolden, derive, grantAchievement, newState, secretDateAchievements, unlockAchievements } from './logic.ts';
import { exportSave, importSave, normalize } from './save.ts';

const secrets = ACHIEVEMENTS.filter((a) => a.secret);

describe('secret achievements', () => {
  it('there are 18, each with a hint and no automatic condition', () => {
    expect(secrets).toHaveLength(18);
    for (const a of secrets) {
      expect(a.hint, a.id).toBeTruthy();
      expect(a.check, a.id).toBeUndefined();
    }
  });

  it('never unlock on their own, even with maxed-out stats', () => {
    const s = newState();
    s.allTimeEarnings = 1e30;
    s.stats.clicks = 1e9;
    unlockAchievements(s);
    for (const a of secrets) expect(s.achievements).not.toContain(a.id);
  });

  it('saves with the old fechas-patrias achievement keep it as white-paper', () => {
    expect(normalize({ achievements: ['fechas-patrias', 'fine-print'] }).achievements).toEqual(
      expect.arrayContaining(['white-paper', 'fine-print']),
    );
  });

  it('are granted once and count toward the income bonus', () => {
    const s = newState();
    const before = derive(s).achievementMultiplier;
    expect(grantAchievement(s, 'fine-print')?.name).toBe('Read the Fine Print');
    expect(grantAchievement(s, 'fine-print')).toBeNull();
    expect(derive(s).achievementMultiplier).toBeGreaterThan(before);
  });

  it('date and hour triggers', () => {
    expect(secretDateAchievements(new Date(2026, 3, 15, 12))).toEqual(['tax-day']);
    expect(secretDateAchievements(new Date(2026, 9, 31, 12))).toEqual(['white-paper']);
    expect(secretDateAchievements(new Date(2026, 9, 31, 3, 30))).toEqual(['insomniac', 'white-paper']);
    expect(secretDateAchievements(new Date(2026, 4, 25, 12))).toEqual([]);
    expect(secretDateAchievements(new Date(2026, 10, 6, 14))).toEqual([]);
  });
});

describe('save codes', () => {
  const rich = () => {
    const s = newState();
    s.score = 123456.78;
    s.allTimeEarnings = 9e12;
    s.cities = 7;
    s.charters = ['seed-capital', 'tenure'];
    s.owned = { 1: 10, 14: 3 };
    s.perks = ['su1'];
    s.stickers = [...s.stickers, '🇱🇮', '¡VIVA LA LIBERTAD CARAJO!', 'hoppe']; // emoji and accents
    s.achievements = ['first-click', 'fine-print'];
    s.stats.clicks = 4242;
    s.stats.biggestClick = 1234.5;
    s.buyAmount = 'max';
    s.sound = false;
    return s;
  };

  it('round-trip the whole game, emoji included', () => {
    const s = rich();
    const back = importSave(exportSave(s))!;
    expect(back).not.toBeNull();
    expect(back).toMatchObject({
      score: 123456.78,
      allTimeEarnings: 9e12,
      cities: 7,
      charters: ['seed-capital', 'tenure'],
      owned: { 1: 10, 14: 3 },
      perks: ['su1'],
      achievements: ['first-click', 'fine-print'],
      buyAmount: 'max',
      sound: false,
    });
    expect(back.stickers).toEqual(expect.arrayContaining(['🇱🇮', '¡VIVA LA LIBERTAD CARAJO!', 'hoppe']));
    expect(back.stats.clicks).toBe(4242);
    expect(back.stats.biggestClick).toBe(1234.5);
  });

  it('are plain ASCII starting with ANCAP1:', () => {
    const code = exportSave(rich());
    expect(code.startsWith('ANCAP1:')).toBe(true);
    expect(/^[\x20-\x7e]+$/.test(code)).toBe(true);
  });

  it('survive spaces and line breaks from copy-paste', () => {
    const code = exportSave(rich());
    const mangled = `  ${code.slice(0, 20)}\n${code.slice(20, 50)} \r\n${code.slice(50)}  `;
    expect(importSave(mangled)?.cities).toBe(7);
  });

  it('leave golden boosts out', () => {
    const s = rich();
    catchGolden(s, GOLDEN_EFFECTS[0]);
    expect(importSave(exportSave(s))!.buffs).toEqual([]);
  });

  it('reject garbage, truncated codes and other text', () => {
    const code = exportSave(rich());
    expect(importSave('')).toBeNull();
    expect(importSave('hello')).toBeNull();
    expect(importSave('ANCAP1:not-base64!!')).toBeNull();
    expect(importSave(code.slice(0, code.length - 10))).toBeNull();
    expect(importSave('ANCAP1:' + btoa('"just a string"'))).toBeNull();
  });

  it('clean up bad values inside an otherwise valid code', () => {
    const code = 'ANCAP1:' + btoa(JSON.stringify({ v: 2, data: { score: -50, cities: 'lots', perks: ['su1', 'hax'] } }));
    const s = importSave(code)!;
    expect(s.score).toBe(0);
    expect(s.cities).toBe(0);
    expect(s.perks).toEqual(['su1']);
  });
});
