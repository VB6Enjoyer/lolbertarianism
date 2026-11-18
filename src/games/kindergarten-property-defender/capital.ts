// Capital: what Jack builds with his blocks at recess. Some of it makes more
// blocks; some of it keeps the grabby hands off the ones he has.

export type BuildId = 'lemonade' | 'toll' | 'piggy' | 'sign' | 'glue' | 'flag' | 'guard';

export interface Building {
  id: BuildId;
  icon: string;
  name: string;
  kind: 'income' | 'defence';
  /** What each level costs. */
  costs: readonly number[];
  /**
   * The week each level's permit comes through (new permits every weekend). Bigger builds open up as
   * the term gets harder, so Jack can't be fully kitted out by the second week.
   */
  weeks: readonly number[];
  /** What it does at a level (1 and up). */
  effect: (level: number) => string;
}

export const LEMONADE_EVERY = [12, 9, 7];
/** Toll per trade, in blocks (it adds up: a whole block every few trades). */
export const TOLL = [0.25, 0.5, 0.75];
export const INTEREST = [0.05, 0.1];
export const SIGN_SLOW = [0.2, 0.3, 0.4];
export const GLUE_SECONDS = [1.0, 1.5, 2.0];
export const FLAG_SCARE = [0.15, 0.3, 0.4];
export const GUARD_EVERY = [5, 4, 3.5];
export const GUARD_WAGES = [2, 3, 5];

const FRACTION = ['¼', '½', '¾'];
export const tollText = (level: number) => `${FRACTION[level - 1]}🧱`;

export const BUILDINGS: readonly Building[] = [
  { id: 'lemonade', icon: '🍋', name: 'Lemonade stand', kind: 'income', costs: [6, 14, 24], weeks: [1, 2, 3], effect: (l) => `+1🧱 every ${LEMONADE_EVERY[l - 1]}s` },
  { id: 'toll', icon: '🌉', name: 'Toll bridge', kind: 'income', costs: [8, 16, 28], weeks: [1, 2, 4], effect: (l) => `every trade pays a ${tollText(l)} toll` },
  { id: 'piggy', icon: '🐷', name: 'Piggy bank', kind: 'income', costs: [12, 26], weeks: [2, 4], effect: (l) => `+${INTEREST[l - 1] * 100}% interest on your blocks every recess (low time preference pays)` },
  { id: 'sign', icon: '🪧', name: 'No Trespassing sign', kind: 'defence', costs: [5, 12, 22], weeks: [1, 2, 3], effect: (l) => `thieves move ${SIGN_SLOW[l - 1] * 100}% slower` },
  { id: 'glue', icon: '🫙', name: 'Glue moat', kind: 'defence', costs: [7, 15, 26], weeks: [1, 3, 4], effect: (l) => `thieves get stuck near the pile for ${GLUE_SECONDS[l - 1]}s` },
  { id: 'flag', icon: '🐍', name: 'Gadsden flag', kind: 'defence', costs: [9, 18, 30], weeks: [2, 3, 5], effect: (l) => `${Math.round(FLAG_SCARE[l - 1] * 100)}% of thieves turn back halfway` },
  { id: 'guard', icon: '🕶️', name: 'Hired security', kind: 'defence', costs: [14, 24, 36], weeks: [2, 3, 5], effect: (l) => `a kid in shades slaps a thief every ${GUARD_EVERY[l - 1]}s; paid ${GUARD_WAGES[l - 1]}🧱 a wave` },
];

export const buildingById = (id: BuildId) => BUILDINGS.find((b) => b.id === id)!;

export type Built = Record<BuildId, number>;
export const noneBuilt = (): Built => ({ lemonade: 0, toll: 0, piggy: 0, sign: 0, glue: 0, flag: 0, guard: 0 });

/** The next level's price (null at the top level). */
export const nextCost = (b: Building, level: number): number | null => (level < b.costs.length ? b.costs[level] : null);

/** The week the next level's permit comes through (null at the top level). */
export const nextWeek = (b: Building, level: number): number | null => (level < b.weeks.length ? b.weeks[level] : null);

/** A big pile draws a crowd: more hands reach for it. */
export const attraction = (blocks: number) => 1 + Math.max(0, blocks - 12) * 0.03;
