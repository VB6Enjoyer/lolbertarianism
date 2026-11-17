// Lifetime stats: answers, accuracy, time, lifelines, and how much of the book you've mastered.
// Pure, so it can be tested; main.ts records into it and shows the summary.

import type { Book, Level } from './books/types.ts';

export interface Stats {
  answered: number;
  right: number;
  /** Total answer time (ms) and how many answers it covers, for the average. */
  timeMs: number;
  timed: number;
  bestStreak: number;
  hints: number;
  mindReads: number;
  swaps: number;
  /** Per level: [right, answered]. */
  byLevel: Record<Level, [number, number]>;
}

/** Answers that took longer than this were probably someone stepping away, so they count as this long. */
export const MAX_ANSWER_MS = 120_000;

export const emptyStats = (): Stats => ({
  answered: 0,
  right: 0,
  timeMs: 0,
  timed: 0,
  bestStreak: 0,
  hints: 0,
  mindReads: 0,
  swaps: 0,
  byLevel: { easy: [0, 0], medium: [0, 0], hard: [0, 0] },
});

const n = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));

export function normalizeStats(raw: unknown): Stats {
  const s = emptyStats();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  for (const key of ['answered', 'right', 'timeMs', 'timed', 'bestStreak', 'hints', 'mindReads', 'swaps'] as const) s[key] = n(r[key]);
  const levels = (r.byLevel && typeof r.byLevel === 'object' ? r.byLevel : {}) as Record<string, unknown>;
  for (const level of ['easy', 'medium', 'hard'] as const) {
    const pair = Array.isArray(levels[level]) ? (levels[level] as unknown[]) : [];
    s.byLevel[level] = [n(pair[0]), n(pair[1])];
    s.byLevel[level][0] = Math.min(s.byLevel[level][0], s.byLevel[level][1]);
  }
  s.right = Math.min(s.right, s.answered);
  return s;
}

/** Each book's stats, by book id. Saves from before there was a second book kept one set, all from Basic Economics. */
export function normalizeBookStats(raw: unknown, bookIds: readonly string[]): Record<string, Stats> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacy = 'answered' in r;
  return Object.fromEntries(bookIds.map((id) => [id, normalizeStats(legacy ? (id === 'be' ? r : null) : r[id])]));
}

/** Several books' stats added together (the longest streak is the longest of them). */
export function combineStats(list: readonly Stats[]): Stats {
  const t = emptyStats();
  for (const s of list) {
    for (const key of ['answered', 'right', 'timeMs', 'timed', 'hints', 'mindReads', 'swaps'] as const) t[key] += s[key];
    t.bestStreak = Math.max(t.bestStreak, s.bestStreak);
    for (const level of ['easy', 'medium', 'hard'] as const) {
      t.byLevel[level][0] += s.byLevel[level][0];
      t.byLevel[level][1] += s.byLevel[level][1];
    }
  }
  return t;
}

/** Records one answer. */
export function recordAnswer(s: Stats, level: Level, right: boolean, ms: number, streak: number) {
  s.answered++;
  s.byLevel[level][1]++;
  if (right) {
    s.right++;
    s.byLevel[level][0]++;
  }
  s.timeMs += Math.min(Math.max(0, ms), MAX_ANSWER_MS);
  s.timed++;
  s.bestStreak = Math.max(s.bestStreak, streak);
}

const percent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export interface AnswerSummary {
  answered: number;
  right: number;
  wrong: number;
  /** 0–100 */
  accuracy: number;
  /** Seconds per answer, one decimal. */
  averageSeconds: number;
  levels: { level: Level; right: number; answered: number; accuracy: number }[];
}

export interface Summary extends AnswerSummary {
  /** Questions answered right at least once, overall and per part. */
  mastered: number;
  total: number;
  parts: { n: number; title: string; mastered: number; total: number }[];
}

/** Answers, accuracy, time and levels, for one book or several combined. */
export const summarizeAnswers = (s: Stats): AnswerSummary => ({
  answered: s.answered,
  right: s.right,
  wrong: s.answered - s.right,
  accuracy: percent(s.right, s.answered),
  averageSeconds: s.timed ? Math.round(s.timeMs / s.timed / 100) / 10 : 0,
  levels: (['easy', 'medium', 'hard'] as const).map((level) => ({ level, right: s.byLevel[level][0], answered: s.byLevel[level][1], accuracy: percent(s.byLevel[level][0], s.byLevel[level][1]) })),
});

export function summarize(s: Stats, mastered: readonly string[], book: Book): Summary {
  const known = new Set(mastered);
  return {
    ...summarizeAnswers(s),
    mastered: book.questions.filter((q) => known.has(q.id)).length,
    total: book.questions.length,
    parts: book.parts.map((p) => {
      const qs = book.questions.filter((q) => q.part === p.n);
      return { n: p.n, title: p.title, mastered: qs.filter((q) => known.has(q.id)).length, total: qs.length };
    }),
  };
}
