// What a book of questions looks like. Each book is its own file; the quiz draws from any of them.

export type Level = 'easy' | 'medium' | 'hard';

export interface BankQuestion {
  /** Stable across reordering (a hash of the question), so progress can be saved against it. */
  id: string;
  book: string;
  part: number;
  chapter: number;
  level: Level;
  q: string;
  /** The right answer, and three wrong ones (shuffled when shown). */
  answer: string;
  wrong: readonly [string, string, string];
  /** Why, in a sentence or two. */
  why: string;
  /** The “Ask the author” lifeline (Ask Sowell, Ask Mises): a nudge from the book, without giving the answer away. */
  hint: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  /** The author's surname, for the hint lifeline: “Ask Sowell”, “Mises says”. */
  short: string;
  parts: readonly { n: number; title: string; chapters: readonly { n: number; title: string }[] }[];
  questions: readonly BankQuestion[];
}

/** A short, stable id from the question text (FNV-1a). */
export function questionId(book: string, text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${book}-${h.toString(36)}`;
}

/** A helper for writing question banks compactly. */
export function questionMaker(book: string) {
  return (part: number, chapter: number, level: Level, q: string, answer: string, wrong: readonly [string, string, string], why: string, hint: string): BankQuestion => ({
    id: questionId(book, q),
    book,
    part,
    chapter,
    level,
    q,
    answer,
    wrong,
    why,
    hint,
  });
}
