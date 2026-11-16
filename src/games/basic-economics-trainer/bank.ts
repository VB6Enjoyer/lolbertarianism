// The question bank: every book's questions, and how a run picks from them.
// Pure (no DOM), with seeded shuffles so the daily quiz is the same for everyone.

import { BASIC_ECONOMICS } from './books/basic-economics.ts';
import type { BankQuestion, Book, Level } from './books/types.ts';
import type { Question } from './questions.ts';

export const BOOKS: readonly Book[] = [BASIC_ECONOMICS];
export const BOOK = BASIC_ECONOMICS;
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

/** Questions in a part-by-part run, how many of them you need right to pass, and how they split by level. */
export const RUN_LENGTH = 10;
export const PASS_MARK = 7;
const MIX: Record<Level, number> = { easy: 3, medium: 4, hard: 3 };
export const LIGHTNING_SECONDS = 60;

/** A small, fast seeded random-number generator (mulberry32): numbers in [0, 1). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n: number) => romans[n] ?? String(n);

export function chapterTitle(book: Book, n: number): string {
  for (const part of book.parts) for (const c of part.chapters) if (c.n === n) return c.title;
  return '';
}

/** Turns a bank question into one to show: the answers shuffled, the right one's position noted. */
export function toQuestion(bq: BankQuestion, rng: () => number, book: Book = BOOK): Question {
  const options = shuffle([bq.answer, ...bq.wrong], rng);
  return {
    id: bq.id,
    level: bq.level,
    chapter: `Part ${roman(bq.part)} · ${chapterTitle(book, bq.chapter)}`,
    q: bq.q,
    options,
    correct: options.indexOf(bq.answer),
    comment: bq.why,
    hint: bq.hint,
  };
}

const byLevel = (qs: readonly BankQuestion[], level: Level) => qs.filter((q) => q.level === level);

/** Picks a run: a few of each level (easy first, hard last), topping up from other levels if one runs short. */
function mixed(pool: readonly BankQuestion[], rng: () => number, length = RUN_LENGTH): BankQuestion[] {
  const picked: BankQuestion[] = [];
  for (const level of LEVELS) picked.push(...shuffle(byLevel(pool, level), rng).slice(0, Math.round((MIX[level] * length) / RUN_LENGTH)));
  const rest = shuffle(pool.filter((q) => !picked.includes(q)), rng);
  while (picked.length < length && rest.length) picked.push(rest.pop()!);
  const order: Record<Level, number> = { easy: 0, medium: 1, hard: 2 };
  return picked.slice(0, length).sort((a, b) => order[a.level] - order[b.level]);
}

export type Mode = { kind: 'part'; part: number } | { kind: 'drill'; level: Level } | { kind: 'daily'; key: string } | { kind: 'lightning' };

/** The questions for a run of a mode. The daily one depends only on the date. */
export function questionsFor(mode: Mode, rng: () => number = Math.random, book: Book = BOOK): Question[] {
  if (mode.kind === 'daily') rng = seededRng(dailySeed(mode.key));
  const all = book.questions;
  const picked =
    mode.kind === 'part'
      ? mixed(all.filter((q) => q.part === mode.part), rng)
      : mode.kind === 'drill'
        ? shuffle(byLevel(all, mode.level), rng).slice(0, RUN_LENGTH)
        : mode.kind === 'daily'
          ? mixed(all, rng)
          : shuffle(all, rng);
  return picked.map((bq) => toQuestion(bq, rng, book));
}

/** Another question for the “different question” lifeline: same level, not already in the run. */
export function swapFor(current: Question, used: readonly string[], rng: () => number = Math.random, book: Book = BOOK): Question | null {
  const pool = book.questions.filter((q) => q.level === current.level && !used.includes(q.id));
  if (!pool.length) return null;
  return toQuestion(pool[Math.floor(rng() * pool.length)], rng, book);
}

export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dailySeed = (key: string) => Number(key.replace(/-/g, '')) ^ 0xb00c;

/** Which parts are open: the first, and each one after a part you've passed. */
export const unlockedParts = (passed: readonly number[], book: Book = BOOK) => book.parts.filter((p) => p.n === 1 || passed.includes(p.n - 1)).map((p) => p.n);

/** Lifeline prices, in peanuts. */
export const MIND_READ_COST = 3;
export const SWAP_COST = 2;
export const ASK_SOWELL_COST = 1;
