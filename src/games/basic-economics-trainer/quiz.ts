// The quiz, with no DOM: which question you're on, what you answered, and the verdict.

import type { Face } from './anya.ts';
import type { Question } from './questions.ts';

export interface Quiz {
  questions: readonly Question[];
  index: number;
  /** What you picked for each question (null until answered). */
  answers: (number | null)[];
  score: number;
  /** Right answers in a row. */
  streak: number;
}

export const newQuiz = (questions: readonly Question[]): Quiz => ({ questions, index: 0, answers: questions.map(() => null), score: 0, streak: 0 });

export const current = (quiz: Quiz): Question | null => quiz.questions[quiz.index] ?? null;
export const answered = (quiz: Quiz) => quiz.answers[quiz.index] !== null && quiz.answers[quiz.index] !== undefined;
export const finished = (quiz: Quiz) => quiz.index >= quiz.questions.length;

/** Answers the current question (once). Returns whether it was right, or null if there's nothing to answer. */
export function answer(quiz: Quiz, choice: number): boolean | null {
  const q = current(quiz);
  if (!q || answered(quiz) || choice < 0 || choice >= q.options.length) return null;
  quiz.answers[quiz.index] = choice;
  const right = choice === q.correct;
  if (right) {
    quiz.score++;
    quiz.streak++;
  } else quiz.streak = 0;
  return right;
}

/** On to the next question (only once this one's answered). */
export function next(quiz: Quiz): boolean {
  if (!answered(quiz)) return false;
  quiz.index++;
  return true;
}

export interface Verdict {
  stamp: string;
  tone: 'good' | 'okay' | 'bad';
  face: Face;
  line: string;
}

export function verdict(score: number, total: number): Verdict {
  const share = total ? score / total : 0;
  if (share >= 1) return { stamp: 'NOT DUMB', tone: 'good', face: 'happy', line: 'Huh. You actually read it. Waku waku!' };
  if (share >= 0.6) return { stamp: 'MEDIOCRE', tone: 'okay', face: 'smug', line: 'Not bad. Not good, either. Read chapter one again.' };
  return { stamp: 'STILL DUMB', tone: 'bad', face: 'deadpan', line: 'Take the book home. Read it. Twice.' };
}
