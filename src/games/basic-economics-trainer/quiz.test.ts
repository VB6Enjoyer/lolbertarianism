import { describe, expect, it } from 'vitest';
import { anyaSvg, faceMarkup, SHOTS, type Face } from './anya.ts';
import { BOOK, LEVELS, PASS_MARK, questionsFor, RUN_LENGTH, seededRng, swapFor, toQuestion, unlockedParts } from './bank.ts';
import { answer, answered, asked, current, finished, lightningVerdict, newQuiz, next, replaceCurrent, verdict } from './quiz.ts';

const run = () => questionsFor({ kind: 'part', part: 1 }, seededRng(1));

describe('basic economics trainer: the quiz', () => {
  it('answers once, scores right answers, and keeps a streak', () => {
    const quiz = newQuiz(run());
    const first = current(quiz)!;
    expect(next(quiz)).toBe(false); // not answered yet
    expect(answer(quiz, first.correct)).toBe(true);
    expect(answer(quiz, 0)).toBeNull(); // no second go
    expect(quiz.score).toBe(1);
    expect(quiz.streak).toBe(1);
    expect(next(quiz)).toBe(true);
    const second = current(quiz)!;
    expect(answer(quiz, (second.correct + 1) % second.options.length)).toBe(false);
    expect(quiz.score).toBe(1);
    expect(quiz.streak).toBe(0);
    expect(quiz.bestStreak).toBe(1);
    expect(answer(quiz, 99)).toBeNull();
  });

  it('finishes after the last question', () => {
    const questions = run();
    const quiz = newQuiz(questions);
    for (const q of questions) {
      expect(finished(quiz)).toBe(false);
      answer(quiz, q.correct);
      expect(answered(quiz)).toBe(true);
      next(quiz);
    }
    expect(finished(quiz)).toBe(true);
    expect(current(quiz)).toBeNull();
    expect(quiz.score).toBe(questions.length);
    expect(asked(quiz)).toHaveLength(questions.length);
  });

  it('swaps a question only before it’s answered', () => {
    const quiz = newQuiz(run());
    const q = current(quiz)!;
    const other = swapFor(q, quiz.questions.map((x) => x.id), seededRng(2))!;
    expect(other.id).not.toBe(q.id);
    expect(other.level).toBe(q.level);
    expect(replaceCurrent(quiz, other)).toBe(true);
    expect(current(quiz)!.id).toBe(other.id);
    answer(quiz, 0);
    expect(replaceCurrent(quiz, q)).toBe(false);
  });

  it('gives the verdict', () => {
    expect(verdict(10, 10).stamp).toBe('NOT DUMB');
    expect(verdict(PASS_MARK, 10).stamp).toBe('PASSED');
    expect(verdict(5, 10).stamp).toBe('MEDIOCRE');
    expect(verdict(2, 10).stamp).toBe('STILL DUMB');
    expect(verdict(0, 0).stamp).toBe('STILL DUMB');
    expect(lightningVerdict(16).tone).toBe('good');
    expect(lightningVerdict(3).tone).toBe('bad');
  });
});

describe('basic economics trainer: the question bank', () => {
  it('every question has a right answer, three different wrong ones, an explanation and a real chapter', () => {
    const chapters = new Set(BOOK.parts.flatMap((p) => p.chapters.map((c) => `${p.n}:${c.n}`)));
    for (const q of BOOK.questions) {
      const options = [q.answer, ...q.wrong];
      expect(new Set(options).size, q.q).toBe(4);
      expect(options.every((o) => o.trim().length > 0), q.q).toBe(true);
      expect(q.why.length, q.q).toBeGreaterThan(10);
      expect(chapters.has(`${q.part}:${q.chapter}`), `${q.q} (${q.part}:${q.chapter})`).toBe(true);
      expect(LEVELS).toContain(q.level);
    }
  });

  it('has no duplicate questions, and enough of each level and part for a run', () => {
    expect(new Set(BOOK.questions.map((q) => q.id)).size).toBe(BOOK.questions.length);
    for (const level of LEVELS) expect(BOOK.questions.filter((q) => q.level === level).length).toBeGreaterThanOrEqual(RUN_LENGTH * 2);
    for (const part of BOOK.parts) expect(BOOK.questions.filter((q) => q.part === part.n).length, `part ${part.n}`).toBeGreaterThanOrEqual(RUN_LENGTH);
  });

  it('doesn’t give the answer away by its length', () => {
    // The right answer shouldn't stand out as the longest option: rarely clearly longer, and not
    // the longest much more often than chance (one in four) would make it.
    const clearlyLongest = BOOK.questions.filter((q) => q.answer.length > 1.15 * Math.max(...q.wrong.map((w) => w.length)));
    expect(clearlyLongest.map((q) => q.q)).toHaveLength(clearlyLongest.length > 3 ? 0 : clearlyLongest.length);
    const longest = BOOK.questions.filter((q) => q.wrong.every((w) => q.answer.length > w.length)).length;
    expect(longest / BOOK.questions.length).toBeLessThan(0.45);
  });

  it('shuffles the answers but keeps track of the right one', () => {
    const bq = BOOK.questions[0];
    const positions = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const q = toQuestion(bq, seededRng(seed));
      expect(q.options[q.correct]).toBe(bq.answer);
      positions.add(q.correct);
    }
    expect(positions.size).toBe(4);
  });

  it('a part run is ten questions from that part, easiest first', () => {
    for (const part of BOOK.parts) {
      const qs = questionsFor({ kind: 'part', part: part.n }, seededRng(part.n));
      expect(qs).toHaveLength(RUN_LENGTH);
      expect(new Set(qs.map((q) => q.id)).size).toBe(RUN_LENGTH);
      expect(qs.every((q) => q.chapter.startsWith(`Part ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][part.n]} ·`))).toBe(true);
      const rank = { easy: 0, medium: 1, hard: 2 };
      for (let i = 1; i < qs.length; i++) expect(rank[qs[i].level]).toBeGreaterThanOrEqual(rank[qs[i - 1].level]);
    }
  });

  it('a drill sticks to its level, and the daily quiz is the same all day', () => {
    expect(questionsFor({ kind: 'drill', level: 'hard' }).every((q) => q.level === 'hard')).toBe(true);
    const a = questionsFor({ kind: 'daily', key: '2026-11-16' });
    const b = questionsFor({ kind: 'daily', key: '2026-11-16' });
    expect(a).toEqual(b);
    expect(questionsFor({ kind: 'daily', key: '2026-11-17' })).not.toEqual(a);
  });

  it('opens the next part once the one before it is passed', () => {
    expect(unlockedParts([])).toEqual([1]);
    expect(unlockedParts([1])).toEqual([1, 2]);
    expect(unlockedParts([1, 2, 3])).toEqual([1, 2, 3, 4]);
  });
});

describe('basic economics trainer: hints and achievements', () => {
  it('every question has a hint, and no hint gives the answer away word for word', () => {
    for (const q of BOOK.questions) {
      expect(q.hint.length, q.q).toBeGreaterThan(10);
      expect(q.hint.toLowerCase().includes(q.answer.toLowerCase()), q.q).toBe(false);
      expect(q.hint, q.q).not.toBe(q.why);
    }
  });

  it('achievements have unique ids, and there is one for passing each part', async () => {
    const { ACHIEVEMENTS, normalizeUnlocked } = await import('./achievements.ts');
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const part of BOOK.parts) expect(ACHIEVEMENTS.some((a) => a.id === `part-${part.n}`)).toBe(true);
    expect([...normalizeUnlocked(['perfect', 'nope', 3])]).toEqual(['perfect']);
  });
});

describe('basic economics trainer: Anya', () => {
  it('has a face layer, the book, and every expression', () => {
    const svg = anyaSvg();
    expect(svg).toContain('id="anya-face"');
    expect(svg).toContain('id="anya-book"');
    const faces: Face[] = ['neutral', 'talk', 'shock', 'smug', 'happy', 'deadpan', 'pout', 'blink'];
    expect(new Set(faces.map(faceMarkup)).size).toBe(faces.length);
  });

  it('can be booped, patted and poked, and recolored', () => {
    const svg = anyaSvg();
    for (const part of ['nose', 'head', 'eye']) expect(svg).toContain(`data-part="${part}"`);
    expect(svg).toContain('class="anya-hair"');
    expect(svg).toContain('id="anya-iris-green"');
    expect(faceMarkup('neutral')).toContain('class="anya-iris"');
    expect(svg).toContain('id="anya-over"');
  });

  it('keeps the first drawing as a backup with the same interface', async () => {
    const v1 = await import('./anya-v1.ts');
    expect(v1.anyaSvg()).toContain('id="anya-face"');
    expect(v1.faceMarkup('shock')).toContain('<ellipse');
    expect(v1.overMarkup('pout')).toBe('');
    expect(v1.SHOTS).toEqual(SHOTS);
  });
});
