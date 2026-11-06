import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, CHARTERS, STICKERS } from './data.ts';
import { click, earn, earningsForCities, newState, secede, tick } from './logic.ts';
import { normalize } from './save.ts';
import { buildStats, formatPlaytime } from './stats.ts';

/** Finds a row's value by section title prefix and label. */
const row = (sections: ReturnType<typeof buildStats>, section: string, label: string) =>
  sections.find((s) => s.title.includes(section))!.rows.find(([l]) => l === label)![1];

describe('stats tracking', () => {
  it('a tick earns income, counts time and tracks the best run', () => {
    const s = newState();
    s.stickers = [];
    s.owned = { 2: 10 }; // $10/s
    tick(s, false);
    tick(s, false);
    expect(s.score).toBe(20);
    expect(s.stats.playSeconds).toBe(2);
    expect(s.stats.runSeconds).toBe(2);
    expect(s.stats.bestRunEarnings).toBe(20);
  });

  it('raids freeze income but time still counts', () => {
    const s = newState();
    s.owned = { 2: 10 };
    tick(s, true);
    expect(s.score).toBe(0);
    expect(s.stats.playSeconds).toBe(1);
  });

  it('remembers the biggest click, crits included', () => {
    const s = newState();
    s.perks = ['su1']; // 5% crits
    s.stickers = [];
    click(s, 0.9); // $1
    click(s, 0.01); // crit, $5
    click(s, 0.9);
    expect(s.stats.biggestClick).toBe(5);
  });

  it('seceding records the run and restarts the run timer, but not total playtime', () => {
    const s = newState();
    const run = earningsForCities(2);
    earn(s, run);
    s.stats.playSeconds = s.stats.runSeconds = 500;
    secede(s);
    expect(s.stats.bestRunEarnings).toBe(run);
    expect(s.stats.runSeconds).toBe(0);
    expect(s.stats.playSeconds).toBe(500);
    earn(s, run / 4);
    expect(Math.max(s.stats.bestRunEarnings, s.runEarnings)).toBe(run); // a smaller run doesn't replace it
  });

  it('saves keep money stats exact and fill in missing ones', () => {
    const n = normalize({ stats: { biggestClick: 12.75, clicks: 3.9 } as never });
    expect(n.stats.biggestClick).toBe(12.75);
    expect(n.stats.clicks).toBe(3);
    expect(n.stats.playSeconds).toBe(0);
  });
});

describe('stats panel', () => {
  it('formats playtime', () => {
    expect(formatPlaytime(5)).toBe('5s');
    expect(formatPlaytime(65)).toBe('1m 5s');
    expect(formatPlaytime(3 * 3600 + 120)).toBe('3h 2m');
    expect(formatPlaytime(2 * 86400 + 3600 + 60)).toBe('2d 1h 1m');
  });

  it('shows the important numbers', () => {
    const s = newState();
    s.cities = 4;
    s.charters = ['seed-capital'];
    s.achievements = ['first-click'];
    s.stats.clicks = 200;
    s.stats.crits = 10;
    s.stats.playSeconds = 3700;
    s.stats.raidsEvaded = 2;
    s.stats.raidsAutoEvaded = 1;
    const out = buildStats(s);
    expect(out.map((x) => x.title)).toEqual(['💰 Economy', '📈 Income bonuses', '🖱️ Activity', '🏙️ Empire', '⏱️ Time']);
    expect(row(out, 'Activity', 'Critical clicks')).toBe('10 (5%)');
    expect(row(out, 'Activity', 'Raids evaded')).toBe('2 by hand, 1 by shell companies');
    expect(row(out, 'Empire', 'Free Private Cities')).toBe('4 (3 unspent)');
    expect(row(out, 'Empire', 'Charters')).toBe(`1 / ${CHARTERS.length}`);
    expect(row(out, 'Empire', 'Achievements')).toBe(`1 / ${ACHIEVEMENTS.length}`);
    expect(row(out, 'Empire', 'Stickers')).toBe(`5 / ${STICKERS.length}`);
    expect(row(out, 'Income bonuses', 'Free Private Cities')).toBe('×1.4');
    expect(row(out, 'Time', 'Time played')).toBe('1h 1m');
  });

  it('every row has a value, even for a brand-new game', () => {
    for (const section of buildStats(newState())) {
      for (const [label, value] of section.rows) expect(value.length, label).toBeGreaterThan(0);
    }
  });
});
