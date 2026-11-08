import { describe, expect, it } from 'vitest';
import { cleanInitials, defaultScores, insertScore, legendName, LEGENDS, normalizeScores, qualifies, SCOREBOARD_SIZE } from './scoreboard.ts';

const entry = (score: number, initials = 'YOU') => ({ initials, score, commies: 3, meters: 1200 });

describe('high scores', () => {
  it('start with ten legends of liberty, best first', () => {
    const scores = defaultScores();
    expect(scores).toHaveLength(SCOREBOARD_SIZE);
    expect(scores.map((s) => s.initials).slice(0, 4)).toEqual(['MNR', 'LVM', 'HHH', 'FAH']);
    for (let i = 1; i < scores.length; i++) expect(scores[i].score).toBeLessThan(scores[i - 1].score);
    expect(legendName('HHH')).toBe('Hans-Hermann Hoppe');
    expect(new Set(LEGENDS.map(([, i]) => i)).size).toBe(LEGENDS.length);
  });

  it('a run makes the table only by beating the lowest entry', () => {
    const scores = defaultScores();
    const lowest = scores[scores.length - 1].score;
    expect(qualifies(scores, lowest)).toBe(false);
    expect(qualifies(scores, lowest + 1)).toBe(true);
    expect(qualifies(scores, 0)).toBe(false);
  });

  it('a new score slots into place and pushes the last one off', () => {
    const { scores, rank } = insertScore(defaultScores(), entry(300_000));
    expect(rank).toBe(3); // 4th: below HHH's 330k, above FAH's 270k
    expect(scores[3].initials).toBe('YOU');
    expect(scores).toHaveLength(SCOREBOARD_SIZE);
    expect(scores.some((s) => s.initials === 'LYS')).toBe(false); // the 10th legend fell off
  });

  it('ties go below the older score', () => {
    const first = insertScore(defaultScores(), entry(200_000, 'AAA')).scores;
    const { scores, rank } = insertScore(first, entry(200_000, 'BBB'));
    expect(scores[rank].initials).toBe('BBB');
    expect(scores[rank - 1].initials).toBe('AAA');
  });

  it('initials are three capital letters', () => {
    expect(cleanInitials('mnr')).toBe('MNR');
    expect(cleanInitials('h.h.h.')).toBe('HHH');
    expect(cleanInitials('Ludwig')).toBe('LUD');
    expect(cleanInitials('jo')).toBe('JOA');
    expect(cleanInitials('ñü')).toBe('NUA');
    expect(cleanInitials('42!')).toBe('AAA');
  });

  it('a damaged save falls back to the legends, and bad entries are dropped', () => {
    expect(normalizeScores(null)).toEqual(defaultScores());
    expect(normalizeScores('nope')).toEqual(defaultScores());
    const cleaned = normalizeScores([{ initials: 'zzz', score: 5 }, { initials: 'x', score: -3 }, null, { initials: 'ABC', score: 900_000, commies: 2, meters: 40 }]);
    expect(cleaned[0]).toEqual({ initials: 'ABC', score: 900_000, commies: 2, meters: 40 });
    expect(cleaned).toHaveLength(SCOREBOARD_SIZE);
    expect(cleaned.some((e) => e.initials === 'ZZZ')).toBe(false); // $5 doesn't beat the legends
  });

  it('old saves get the raised legends, keeping your own scores', () => {
    const old = [
      { initials: 'MNR', score: 150_000, commies: 0, meters: 0, legend: true },
      { initials: 'YOU', score: 250_000, commies: 9, meters: 9000 },
      { initials: 'LYS', score: 10_000, commies: 0, meters: 0, legend: true },
    ];
    const scores = normalizeScores(old);
    expect(scores.find((e) => e.initials === 'MNR')!.score).toBe(500_000);
    expect(scores.find((e) => e.initials === 'YOU')!.score).toBe(250_000);
    expect(scores.filter((e) => e.legend)).toHaveLength(9); // YOU pushed the last legend off
  });
});
