// How to play: the difficulty, the daily challenge, and the run history.

import type { ItemId } from './logic.ts';
import type { BuildId } from './capital.ts';
import { SPECIAL_DAYS, type SpecialDayId } from './days.ts';
import type { PerkId } from './perks.ts';
import { isFriday } from './school.ts';

// --- Difficulty ---

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface Difficulty {
  id: DifficultyId;
  icon: string;
  name: string;
  description: string;
  /** Times the gap between hands (more is calmer), times how long thieves take to arrive. */
  spawn: number;
  travel: number;
  startBlocks: number;
  /** Seconds between homesteaded blocks. */
  homestead: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', icon: '🧸', name: 'Easy', description: 'Fewer, slower hands, and more blocks to start with.', spawn: 1.3, travel: 1.2, startBlocks: 15, homestead: 7 },
  { id: 'normal', icon: '🎒', name: 'Normal', description: 'Kindergarten as it was meant to be.', spawn: 1, travel: 1, startBlocks: 10, homestead: 9 },
  { id: 'hard', icon: '🔥', name: 'Hard', description: 'More hands, faster, and fewer blocks to start with.', spawn: 0.8, travel: 0.85, startBlocks: 8, homestead: 11 },
];

export const difficultyById = (id: DifficultyId) => DIFFICULTIES.find((d) => d.id === id)!;
export const isDifficulty = (x: unknown): x is DifficultyId => DIFFICULTIES.some((d) => d.id === x);

// --- The daily challenge ---

/** One school day, the same for everyone on a date: a set day of the term, a starter kit, and a special day. */
export interface Daily {
  /** "2026-11-16": the key for the daily best. */
  key: string;
  seed: number;
  day: number;
  special: SpecialDayId;
  blocks: number;
  stash: ItemId[];
  built: BuildId;
  perk: PerkId;
}

const DAILY_ITEMS: readonly ItemId[] = ['juice', 'dino', 'crayons', 'cookie', 'car', 'yoyo', 'slime', 'card'];
const DAILY_BUILDS: readonly BuildId[] = ['lemonade', 'toll', 'piggy', 'sign', 'glue', 'flag', 'guard'];
const DAILY_PERKS: readonly PerkId[] = ['hands', 'loud', 'pry', 'double', 'sales', 'homestead', 'reputation', 'fence', 'combo', 'night'];

export function dailyFor(date: Date): Daily {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const seed = y * 10_000 + m * 100 + d;
  const rng = seededRng(seed ^ 0x5eed);
  // A day in the second or third week (not a Friday, so the special day gets the whole day).
  const days = [6, 7, 8, 9, 11, 12, 13, 14];
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  const day = pick(days);
  // The special day cycles by date, so the same one doesn't come twice in a row.
  const epochDay = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return {
    key: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    seed,
    day: isFriday(day) ? day - 1 : day,
    special: SPECIAL_DAYS[((epochDay % SPECIAL_DAYS.length) + SPECIAL_DAYS.length) % SPECIAL_DAYS.length].id,
    blocks: 18 + Math.floor(rng() * 10),
    stash: [pick(DAILY_ITEMS), pick(DAILY_ITEMS)],
    built: pick(DAILY_BUILDS),
    perk: pick(DAILY_PERKS),
  };
}

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

/** Cleans up saved daily bests: { "YYYY-MM-DD": score }, the 60 most recent days. */
export function normalizeDailyBests(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number(v) > 0)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 60);
  for (const [k, v] of entries) out[k] = Math.floor(Number(v));
  return out;
}

// --- Run history ---

export type RunEnding = 'seized' | 'expelled' | 'retired';

export interface RunRecord {
  score: number;
  /** The school day it ended on (1 is the first Monday). */
  day: number;
  ending: RunEnding;
  difficulty: DifficultyId;
  graduated: boolean;
  /** "YYYY-MM-DD" */
  date: string;
}

export const HISTORY_SIZE = 10;

/** Adds a run to the table (best first, ten at most). Returns where it landed (0-based), or -1 if it didn't make it. */
export function recordRun(history: RunRecord[], run: RunRecord): number {
  history.push(run);
  history.sort((a, b) => b.score - a.score);
  const rank = history.indexOf(run);
  history.splice(HISTORY_SIZE);
  return rank < HISTORY_SIZE ? rank : -1;
}

export function normalizeHistory(raw: unknown): RunRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      score: Math.max(0, Math.floor(Number(r.score) || 0)),
      day: Math.max(1, Math.floor(Number(r.day) || 1)),
      ending: (['seized', 'expelled', 'retired'] as const).find((e) => e === r.ending) ?? 'seized',
      difficulty: isDifficulty(r.difficulty) ? r.difficulty : 'normal',
      graduated: r.graduated === true,
      date: typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, HISTORY_SIZE);
}

export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
