// A question as it's shown: answers in their shuffled order. The bank (bank.ts and books/) makes these.

import type { Level } from './books/types.ts';

export interface Question {
  id: string;
  level: Level;
  /** Where it comes from in the book, for the label above the question. */
  chapter: string;
  q: string;
  options: string[];
  /** The index of the right answer. */
  correct: number;
  /** Anya's explanation, after you answer. */
  comment: string;
  /** What “Ask Sowell” says: a nudge, not the answer. */
  hint: string;
}
