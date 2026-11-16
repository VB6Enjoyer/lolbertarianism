import { describe, expect, it } from 'vitest';
import { BOOK } from './bank.ts';
import { questionScript } from './speech.ts';
import { emptyStats, MAX_ANSWER_MS, normalizeStats, recordAnswer, summarize } from './stats.ts';

describe('basic economics trainer: stats', () => {
  it('counts answers, accuracy, time and streaks', () => {
    const s = emptyStats();
    recordAnswer(s, 'easy', true, 4000, 1);
    recordAnswer(s, 'hard', false, 8000, 0);
    recordAnswer(s, 'hard', true, 3_600_000, 1); // walked away: counts as the cap
    const sum = summarize(s, [], BOOK);
    expect(sum.answered).toBe(3);
    expect(sum.right).toBe(2);
    expect(sum.wrong).toBe(1);
    expect(sum.accuracy).toBe(67);
    expect(sum.averageSeconds).toBe(Math.round((4000 + 8000 + MAX_ANSWER_MS) / 3 / 100) / 10);
    expect(sum.levels.find((l) => l.level === 'hard')).toMatchObject({ right: 1, answered: 2, accuracy: 50 });
    expect(s.bestStreak).toBe(1);
  });

  it('tracks how much of the book you’ve answered right, by part', () => {
    const firstTwo = BOOK.questions.filter((q) => q.part === 1).slice(0, 2).map((q) => q.id);
    const sum = summarize(emptyStats(), [...firstTwo, 'not-a-question'], BOOK);
    expect(sum.mastered).toBe(2);
    expect(sum.total).toBe(BOOK.questions.length);
    expect(sum.parts[0].mastered).toBe(2);
    expect(sum.parts.reduce((t, p) => t + p.total, 0)).toBe(BOOK.questions.length);
  });

  it('cleans up saved stats', () => {
    expect(normalizeStats(null)).toEqual(emptyStats());
    const s = normalizeStats({ answered: '5', right: 9, byLevel: { easy: [4, 2], hard: 'x' }, hints: -3 });
    expect(s.answered).toBe(5);
    expect(s.right).toBe(5);
    expect(s.byLevel.easy).toEqual([2, 2]);
    expect(s.byLevel.hard).toEqual([0, 0]);
    expect(s.hints).toBe(0);
  });

  it('reads a question with its lettered answers', () => {
    expect(questionScript('Why?', ['One', 'Two', 'Three', 'Four'], 'Think.', 'Sowell')).toBe('Why? Sowell says: Think. A: One. B: Two. C: Three. D: Four.');
  });
});
