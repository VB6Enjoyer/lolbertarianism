import { describe, expect, it } from 'vitest';
import { anyaSvg, faceMarkup, type Face } from './anya.ts';
import { QUESTIONS } from './questions.ts';
import { answer, answered, current, finished, newQuiz, next, verdict } from './quiz.ts';

describe('basic economics trainer: the quiz', () => {
  it('answers once, scores right answers, and keeps a streak', () => {
    const quiz = newQuiz(QUESTIONS);
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
    expect(answer(quiz, 99)).toBeNull();
  });

  it('finishes after the last question', () => {
    const quiz = newQuiz(QUESTIONS);
    for (const q of QUESTIONS) {
      expect(finished(quiz)).toBe(false);
      answer(quiz, q.correct);
      expect(answered(quiz)).toBe(true);
      next(quiz);
    }
    expect(finished(quiz)).toBe(true);
    expect(current(quiz)).toBeNull();
    expect(quiz.score).toBe(QUESTIONS.length);
  });

  it('gives the verdict', () => {
    expect(verdict(5, 5).stamp).toBe('NOT DUMB');
    expect(verdict(3, 5).stamp).toBe('MEDIOCRE');
    expect(verdict(2, 5).stamp).toBe('STILL DUMB');
    expect(verdict(0, 0).stamp).toBe('STILL DUMB');
  });

  it('every question has four options and a valid answer', () => {
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
    }
  });
});

describe('basic economics trainer: Anya', () => {
  it('has a face layer, the book, and every expression', () => {
    const svg = anyaSvg();
    expect(svg).toContain('id="anya-face"');
    expect(svg).toContain('id="anya-book"');
    const faces: Face[] = ['neutral', 'talk', 'shock', 'smug', 'happy', 'deadpan', 'pout', 'blink'];
    const drawn = new Set(faces.map(faceMarkup));
    expect(drawn.size).toBe(faces.length);
  });
});
