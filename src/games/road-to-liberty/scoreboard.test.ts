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
    const { scores, rank } = insertScore(defaultScores(), entry(90_000));
    expect(rank).toBe(3); // 4th: below HHH's 100k, above FAH's 80k
    expect(scores[3].initials).toBe('YOU');
    expect(scores).toHaveLength(SCOREBOARD_SIZE);
    expect(scores.some((s) => s.initials === 'LYS')).toBe(false); // the 10th legend fell off
  });

  it('ties go below the older score', () => {
    const first = insertScore(defaultScores(), entry(65_000, 'AAA')).scores;
    const { scores, rank } = insertScore(first, entry(65_000, 'BBB'));
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
    const cleaned = normalizeScores([{ initials: 'zzz', score: 5 }, { initials: 'x', score: -3 }, null, { initials: 'ABC', score: 900, commies: 2, meters: 40 }]);
    expect(cleaned).toEqual([
      { initials: 'ABC', score: 900, commies: 2, meters: 40 },
      { initials: 'ZZZ', score: 5, commies: 0, meters: 0 },
    ]);
  });
});
