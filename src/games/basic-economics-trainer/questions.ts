// The questions. Step one of the rebuild keeps the original five; the full bank comes next.

import type { Face } from './anya.ts';

export interface Question {
  /** The part of the book it comes from. */
  chapter: string;
  q: string;
  options: string[];
  /** The index of the right answer. */
  correct: number;
  /** Anya's explanation, after you answer. */
  comment: string;
  /** Her face when you get it right, and when you don't. */
  right: Face;
  wrong: Face;
}

export const QUESTIONS: readonly Question[] = [
  {
    chapter: 'The National Economy',
    q: 'If the government prints a trillion dollars and gives it to everyone, what happens?',
    options: ['Everyone gets rich!', 'Inflation: money loses value', 'The economy doubles', 'Nothing changes'],
    correct: 1,
    comment: 'More money chasing the same goods means higher prices.',
    right: 'smug',
    wrong: 'shock',
  },
  {
    chapter: 'Prices',
    q: 'Why does a diamond cost more than water, even though water is essential for life?',
    options: ['Diamonds are shiny', 'Corporate greed', 'Scarcity', 'Water is heavy'],
    correct: 2,
    comment: 'Water is abundant; diamonds are rare. Prices follow scarcity, not usefulness.',
    right: 'happy',
    wrong: 'deadpan',
  },
  {
    chapter: 'Prices',
    q: 'Rent control (a legal maximum on rents) usually leads to…',
    options: ['Cheaper housing for everyone', 'Housing shortages', 'Better apartments', 'Generous landlords'],
    correct: 1,
    comment: 'Price ceilings create shortages. Basic supply and demand.',
    right: 'smug',
    wrong: 'shock',
  },
  {
    chapter: 'Industry and Commerce',
    q: 'What is “opportunity cost”?',
    options: ['The price tag on an item', 'The value of the best alternative you give up', 'The cost of starting a business', 'A discount coupon'],
    correct: 1,
    comment: 'There are no solutions, only trade-offs.',
    right: 'happy',
    wrong: 'pout',
  },
  {
    chapter: 'The International Economy',
    q: 'Free trade between two countries generally…',
    options: ['Makes both poorer', 'Only helps the rich one', 'Benefits both sides', 'Causes war'],
    correct: 2,
    comment: 'Comparative advantage: both sides win.',
    right: 'happy',
    wrong: 'shock',
  },
];
