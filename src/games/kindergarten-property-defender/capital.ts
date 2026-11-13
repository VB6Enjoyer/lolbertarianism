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
  /** What it does at a level (1 and up). */
  effect: (level: number) => string;
}

export const LEMONADE_EVERY = [8, 6, 4.5];
export const TOLL = [1, 2];
export const INTEREST = [0.1, 0.2];
export const SIGN_SLOW = [0.2, 0.4];
export const GLUE_SECONDS = [1.0, 2.0];
export const FLAG_SCARE = [0.15, 0.3, 0.45];
export const GUARD_EVERY = [5, 3.5];
export const GUARD_WAGES = [2, 4];

export const BUILDINGS: readonly Building[] = [
  { id: 'lemonade', icon: '🍋', name: 'Lemonade stand', kind: 'income', costs: [6, 10, 16], effect: (l) => `+1🧱 every ${LEMONADE_EVERY[l - 1]}s` },
  { id: 'toll', icon: '🌉', name: 'Toll bridge', kind: 'income', costs: [8, 14], effect: (l) => `every trade pays +${TOLL[l - 1]}🧱 toll` },
  { id: 'piggy', icon: '🐷', name: 'Piggy bank', kind: 'income', costs: [10, 18], effect: (l) => `+${INTEREST[l - 1] * 100}% interest on your blocks every recess (low time preference pays)` },
  { id: 'sign', icon: '🪧', name: 'No Trespassing sign', kind: 'defence', costs: [4, 9], effect: (l) => `thieves move ${SIGN_SLOW[l - 1] * 100}% slower` },
  { id: 'glue', icon: '🫙', name: 'Glue moat', kind: 'defence', costs: [6, 12], effect: (l) => `thieves get stuck near the pile for ${GLUE_SECONDS[l - 1]}s` },
  { id: 'flag', icon: '🐍', name: 'Gadsden flag', kind: 'defence', costs: [6, 12, 18], effect: (l) => `${FLAG_SCARE[l - 1] * 100}% of thieves turn back halfway` },
  { id: 'guard', icon: '🕶️', name: 'Hired security', kind: 'defence', costs: [10, 16], effect: (l) => `a kid in shades slaps a thief every ${GUARD_EVERY[l - 1]}s; paid ${GUARD_WAGES[l - 1]}🧱 a wave` },
];

export const buildingById = (id: BuildId) => BUILDINGS.find((b) => b.id === id)!;

export type Built = Record<BuildId, number>;
export const noneBuilt = (): Built => ({ lemonade: 0, toll: 0, piggy: 0, sign: 0, glue: 0, flag: 0, guard: 0 });

/** The next level's price (null at the top level). */
export const nextCost = (b: Building, level: number): number | null => (level < b.costs.length ? b.costs[level] : null);

/** A big pile draws a crowd: more hands reach for it. */
export const attraction = (blocks: number) => 1 + Math.max(0, blocks - 15) * 0.015;
