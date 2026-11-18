// A seeded random number generator whose whole state is one number, so a run (and a fight in the
// middle of it) can be saved and picked up again exactly where it was.

export interface Rng {
  s: number;
}

export const makeRng = (seed: number): Rng => ({ s: seed >>> 0 || 1 });

/** Mulberry32: a float in [0, 1). */
export function next(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** An integer from min to max, both included. */
export const int = (r: Rng, min: number, max: number) => min + Math.floor(next(r) * (max - min + 1));

export const pickOne = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(next(r) * items.length)];

/** A weighted pick: [item, weight] pairs. */
export function weighted<T>(r: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((t, [, w]) => t + w, 0);
  let roll = next(r) * total;
  for (const [item, w] of items) if ((roll -= w) < 0) return item;
  return items[items.length - 1][0];
}

/** Shuffles in place (Fisher–Yates) and returns the array. */
export function shuffleInPlace<T>(r: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next(r) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
