// Feats: Ancapball is there from the start; the others join once you've done something worth
// noticing. Pure: works from the lifetime stats in the save.

import { CHARACTER_ORDER, type CharacterId } from './data.ts';

/** The lifetime numbers the feats look at. */
export interface Lifetime {
  runs: number;
  kills: number;
  /** Central Banks brought down, ever. */
  banks: number;
  /** Longest survived, per character (seconds). */
  best: Partial<Record<CharacterId, number>>;
}

export interface Feat {
  /** What to do, as shown on the locked character. */
  text: string;
  /** How far along you are: [have, need]. */
  progress: (r: Lifetime) => [number, number];
}

const longest = (r: Lifetime) => Math.max(0, ...Object.values(r.best).map((v) => v ?? 0));

export const FEATS: Partial<Record<CharacterId, Feat>> = {
  // The night-watchman shows up once you've proved you can hold the line.
  minarchist: { text: 'Survive 5:00 in a single run.', progress: (r) => [Math.min(300, longest(r)), 300] },
  // The counter-economy needs volume.
  agorist: { text: 'Send 2,500 statists packing (all runs together).', progress: (r) => [Math.min(2500, r.kills), 2500] },
  // Who else would you send against a central bank?
  austrian: { text: 'Bring down the Central Bank.', progress: (r) => [Math.min(1, r.banks), 1] },
};

export const featDone = (id: CharacterId, r: Lifetime) => {
  const f = FEATS[id];
  if (!f) return true;
  const [have, need] = f.progress(r);
  return have >= need;
};

/**
 * Everyone you can play: Ancapball, anyone whose feat is done, and (for saves from before the
 * feats) anyone you've already played.
 */
export function unlockedCharacters(r: Lifetime, already: CharacterId[] = []): CharacterId[] {
  return CHARACTER_ORDER.filter((id) => already.includes(id) || (r.best[id] ?? 0) > 0 || featDone(id, r));
}
