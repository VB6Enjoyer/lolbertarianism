import { describe, expect, it } from 'vitest';
import { anyaSvg, coverMarkup, faceMarkup, SHOTS, type Face } from './anya.ts';
import { BOOK, BOOKS, bookById, LEVELS, PASS_MARK, questionsFor, RUN_LENGTH, seededRng, swapFor, toQuestion, unlockedParts } from './bank.ts';
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

for (const book of BOOKS)
describe(`basic economics trainer: the question bank of ${book.title}`, () => {
  it('every question has a right answer, three different wrong ones, an explanation and a real chapter', () => {
    const chapters = new Set(book.parts.flatMap((p) => p.chapters.map((c) => `${p.n}:${c.n}`)));
    for (const q of book.questions) {
      const options = [q.answer, ...q.wrong];
      expect(new Set(options).size, q.q).toBe(4);
      expect(options.every((o) => o.trim().length > 0), q.q).toBe(true);
      expect(q.why.length, q.q).toBeGreaterThan(10);
      expect(chapters.has(`${q.part}:${q.chapter}`), `${q.q} (${q.part}:${q.chapter})`).toBe(true);
      expect(LEVELS).toContain(q.level);
    }
  });

  it('has no duplicate questions, and enough of each level and part for a run', () => {
    expect(new Set(book.questions.map((q) => q.id)).size).toBe(book.questions.length);
    for (const level of LEVELS) expect(book.questions.filter((q) => q.level === level).length).toBeGreaterThanOrEqual(RUN_LENGTH * 2);
    for (const part of book.parts) expect(book.questions.filter((q) => q.part === part.n).length, `part ${part.n}`).toBeGreaterThanOrEqual(RUN_LENGTH);
  });

  it('doesn’t give the answer away by its length', () => {
    // The right answer shouldn't stand out as the longest option: rarely clearly longer, and not
    // the longest much more often than chance (one in four) would make it.
    const clearlyLongest = book.questions.filter((q) => q.answer.length > 1.15 * Math.max(...q.wrong.map((w) => w.length)));
    expect(clearlyLongest.map((q) => q.q)).toHaveLength(clearlyLongest.length > 3 ? 0 : clearlyLongest.length);
    const longest = book.questions.filter((q) => q.wrong.every((w) => q.answer.length > w.length)).length;
    expect(longest / book.questions.length).toBeLessThan(0.45);
  });

  it('shuffles the answers but keeps track of the right one', () => {
    const bq = book.questions[0];
    const positions = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const q = toQuestion(bq, seededRng(seed), book);
      expect(q.options[q.correct]).toBe(bq.answer);
      positions.add(q.correct);
    }
    expect(positions.size).toBe(4);
  });

  it('a part run is ten questions from that part, easiest first', () => {
    for (const part of book.parts) {
      const qs = questionsFor({ kind: 'part', part: part.n }, seededRng(part.n), book);
      expect(qs).toHaveLength(RUN_LENGTH);
      expect(new Set(qs.map((q) => q.id)).size).toBe(RUN_LENGTH);
      expect(qs.every((q) => q.chapter.startsWith(`Part ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][part.n]} ·`))).toBe(true);
      const rank = { easy: 0, medium: 1, hard: 2 };
      for (let i = 1; i < qs.length; i++) expect(rank[qs[i].level]).toBeGreaterThanOrEqual(rank[qs[i - 1].level]);
    }
  });

  it('a drill sticks to its level, and the daily quiz is the same all day', () => {
    expect(questionsFor({ kind: 'drill', level: 'hard' }, Math.random, book).every((q) => q.level === 'hard')).toBe(true);
    const a = questionsFor({ kind: 'daily', key: '2026-11-16' }, Math.random, book);
    const b = questionsFor({ kind: 'daily', key: '2026-11-16' }, Math.random, book);
    expect(a).toEqual(b);
    expect(questionsFor({ kind: 'daily', key: '2026-11-17' }, Math.random, book)).not.toEqual(a);
  });

  it('opens the next part once the one before it is passed', () => {
    expect(unlockedParts([], book)).toEqual([1]);
    expect(unlockedParts([1], book)).toEqual([1, 2]);
    expect(unlockedParts([1, 2, 3], book)).toEqual([1, 2, 3, 4]);
  });
});

describe('basic economics trainer: hints and achievements', () => {
  it('every question has a hint, and no hint gives the answer away word for word', () => {
    for (const q of BOOKS.flatMap((b) => b.questions)) {
      expect(q.hint.length, q.q).toBeGreaterThan(10);
      expect(q.hint.toLowerCase().includes(q.answer.toLowerCase()), q.q).toBe(false);
      expect(q.hint, q.q).not.toBe(q.why);
    }
  });

  it('achievements have unique ids, and there is one for passing each part', async () => {
    const { ACHIEVEMENTS, normalizeUnlocked } = await import('./achievements.ts');
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const { partAchievement, allPartsAchievement, wholeBookAchievement } = await import('./achievements.ts');
    for (const book of BOOKS) {
      for (const part of book.parts) expect(ACHIEVEMENTS.some((a) => a.id === partAchievement(book.id, part.n)), `${book.id} part ${part.n}`).toBe(true);
      for (const id of [allPartsAchievement(book.id), wholeBookAchievement(book.id)]) expect(ACHIEVEMENTS.some((a) => a.id === id), id).toBe(true);
    }
    expect(partAchievement('be', 1)).toBe('part-1');
    expect(partAchievement('ha', 1)).toBe('ha-part-1');
    expect([...normalizeUnlocked(['perfect', 'nope', 3])]).toEqual(['perfect']);
  });
});

describe('basic economics trainer: the books', () => {
  it('each book has its own id, author name, cover, and question ids', () => {
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(BOOKS.length);
    const ids = BOOKS.flatMap((b) => b.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const book of BOOKS) {
      expect(book.short.length).toBeGreaterThan(2);
      expect(book.questions.every((q) => q.book === book.id && q.id.startsWith(`${book.id}-`))).toBe(true);
    }
    expect(new Set(BOOKS.map((b) => coverMarkup(b.id))).size).toBe(BOOKS.length);
    expect(coverMarkup('ha')).toContain('Ludwig von Mises');
    expect(coverMarkup('be')).toContain('Thomas Sowell');
  });

  it('keeps Capital secret: off the shelf, with only secret achievements, until Anya gives up on you', async () => {
    const { ACHIEVEMENTS } = await import('./achievements.ts');
    const secret = BOOKS.filter((b) => b.secret);
    expect(secret.map((b) => b.id)).toEqual(['kap']);
    expect(BOOKS[0].secret).toBeFalsy();
    expect(ACHIEVEMENTS.find((a) => a.id === 'red-pill')?.secret).toBe(true);
    for (const a of ACHIEVEMENTS.filter((a) => a.id.startsWith('kap-'))) expect(a.secret, a.id).toBe(true);
  });

  it('finds books by id, falling back to the first', () => {
    expect(bookById('ha').title).toBe('Human Action');
    expect(bookById('nope')).toBe(BOOK);
    expect(bookById(undefined)).toBe(BOOK);
  });
});

describe('basic economics trainer: Anya', () => {
  it('has a face layer, the book, and every expression', () => {
    const svg = anyaSvg();
    expect(svg).toContain('id="anya-face"');
    expect(svg).toContain('id="anya-book"');
    const faces: Face[] = ['neutral', 'talk', 'shock', 'smug', 'happy', 'deadpan', 'pout', 'blink'];
    expect(new Set(faces.map((f) => faceMarkup(f))).size).toBe(faces.length);
  });

  it('only moves her mouth while she talks, keeping the eyes of her expression', () => {
    const eyesOf = (markup: string) => markup.slice(0, markup.indexOf('M 199 251'));
    for (const face of ['neutral', 'smug', 'happy', 'shock', 'pout', 'deadpan'] as Face[]) {
      const open = faceMarkup(face, 'open');
      const closed = faceMarkup(face, 'closed');
      expect(eyesOf(open), face).toBe(eyesOf(faceMarkup(face)));
      expect(eyesOf(closed), face).toBe(eyesOf(faceMarkup(face)));
      expect(open, face).not.toBe(closed);
    }
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
