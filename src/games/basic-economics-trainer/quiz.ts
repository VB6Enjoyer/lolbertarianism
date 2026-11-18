// The quiz, with no DOM: which question you're on, what you answered, and the verdict.

import type { Face } from './anya.ts';
import type { Question } from './questions.ts';

export interface Quiz {
  questions: Question[];
  index: number;
  /** What you picked for each question (null until answered). */
  answers: (number | null)[];
  score: number;
  /** Right answers in a row, and the longest run. */
  streak: number;
  bestStreak: number;
}

export const newQuiz = (questions: readonly Question[]): Quiz => ({ questions: [...questions], index: 0, answers: questions.map(() => null), score: 0, streak: 0, bestStreak: 0 });

export const current = (quiz: Quiz): Question | null => quiz.questions[quiz.index] ?? null;
export const answered = (quiz: Quiz) => quiz.answers[quiz.index] !== null && quiz.answers[quiz.index] !== undefined;
export const finished = (quiz: Quiz) => quiz.index >= quiz.questions.length;
/** The questions you've answered so far (a lightning round ends before the list does). */
export const asked = (quiz: Quiz) => quiz.questions.slice(0, quiz.index + (answered(quiz) ? 1 : 0));

/** Answers the current question (once). Returns whether it was right, or null if there's nothing to answer. */
export function answer(quiz: Quiz, choice: number): boolean | null {
  const q = current(quiz);
  if (!q || answered(quiz) || choice < 0 || choice >= q.options.length) return null;
  quiz.answers[quiz.index] = choice;
  const right = choice === q.correct;
  if (right) {
    quiz.score++;
    quiz.streak++;
    quiz.bestStreak = Math.max(quiz.bestStreak, quiz.streak);
  } else quiz.streak = 0;
  return right;
}

/** On to the next question (only once this one's answered). */
export function next(quiz: Quiz): boolean {
  if (!answered(quiz)) return false;
  quiz.index++;
  return true;
}

/** Swaps the current question for another (a lifeline), before it's answered. */
export function replaceCurrent(quiz: Quiz, q: Question): boolean {
  if (finished(quiz) || answered(quiz)) return false;
  quiz.questions[quiz.index] = q;
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
  if (share >= 0.7) return { stamp: 'PASSED', tone: 'good', face: 'smug', line: 'Fine. You pass. Don’t let it go to your head.' };
  if (share >= 0.5) return { stamp: 'MEDIOCRE', tone: 'okay', face: 'smug', line: 'Not bad. Not good, either. Read that part again.' };
  return { stamp: 'STILL DUMB', tone: 'bad', face: 'deadpan', line: 'Take the book home. Read it. Twice.' };
}

/** The final exam’s verdict: stricter than a part’s, since passing it earns a certificate. */
export function examVerdict(score: number, total: number, passMark: number): Verdict {
  if (score >= total) return { stamp: 'SUMMA CUM LAUDE', tone: 'good', face: 'happy', line: 'Every single one?! Anya is… impressed. Don’t tell anyone. Waku waku!' };
  if (score >= passMark) return { stamp: 'GRADUATED', tone: 'good', face: 'smug', line: 'You passed the final exam. Anya will sign your certificate. Reluctantly.' };
  if (score >= passMark - 4) return { stamp: 'NOT YET', tone: 'okay', face: 'smug', line: `Close. You need ${passMark}. Anya doesn’t round up.` };
  return { stamp: 'STILL DUMB', tone: 'bad', face: 'deadpan', line: 'A final exam, not a guessing game. Back to the parts with you.' };
}

/** The lightning round's verdict: how many you got right in the time. */
export function lightningVerdict(score: number): Verdict {
  if (score >= 15) return { stamp: 'NOT DUMB', tone: 'good', face: 'happy', line: `${score} in a minute? Waku waku!` };
  if (score >= 8) return { stamp: 'QUICK-ISH', tone: 'okay', face: 'smug', line: 'Fast enough. Faster next time.' };
  return { stamp: 'TOO SLOW', tone: 'bad', face: 'deadpan', line: 'The book doesn’t read itself. Neither do the questions.' };
}
