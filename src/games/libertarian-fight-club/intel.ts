// Information is a good: tipsters sell it (some of them know things, some of
// them don't, and their track records are how you tell), and the kitchen staff
// will let you watch a lobster in the tank for a few dollars.

import { simulate, type Side } from './fight.ts';
import { TRAITS, type Lobster, type TraitId } from './lobsters.ts';

export type TipsterId = 'frank' | 'insider' | 'guru';

export interface Tipster {
  id: TipsterId;
  name: string;
  face: string;
  price: number;
  /** How often the tip is right (about the trait, or about who has the edge). */
  accuracy: number;
  kind: 'trait' | 'pick';
  blurb: string;
}

export const TIPSTERS: readonly Tipster[] = [
  { id: 'frank', name: 'Fishmonger Frank', face: '🐟', price: 15, accuracy: 0.65, kind: 'trait', blurb: 'Knows every lobster that came through his shop. Mostly.' },
  { id: 'insider', name: 'The Insider', face: '🕵️', price: 60, accuracy: 0.9, kind: 'pick', blurb: 'Says he drinks with the judges. Pricey, and usually right about who has the edge.' },
  { id: 'guru', name: '@AlphaGuru', face: '📱', price: 0, accuracy: 0.5, kind: 'pick', blurb: '100% LOCKS 🔒 every single night. Free, and worth every penny.' },
];

export const tipsterById = (id: TipsterId) => TIPSTERS.find((t) => t.id === id)!;

export type Tip =
  | { kind: 'trait'; by: TipsterId; side: Side; trait: TraitId; text: string }
  | { kind: 'pick'; by: TipsterId; side: Side; text: string };

/** Who really has the edge, knowing everything (traits and full matchups): A's chance. */
export function trueChance(a: Lobster, b: Lobster, rng: () => number, sims = 200): number {
  let wins = 0;
  for (let i = 0; i < sims; i++) if (simulate(a, b, rng).winner === 0) wins++;
  return wins / sims;
}

/**
 * A tip for this bout. Frank whispers a trait (of a lobster whose trait you
 * don't know yet); the Insider and the Guru name a winner. Returns null if
 * there's nothing to tell (Frank, when you already know both traits).
 */
export function buyTip(id: TipsterId, lobsters: readonly [Lobster, Lobster], rng: () => number): Tip | null {
  const t = tipsterById(id);
  const right = rng() < t.accuracy;
  if (t.kind === 'trait') {
    const unknown = ([0, 1] as Side[]).filter((s) => !lobsters[s].traitKnown);
    if (!unknown.length) return null;
    const side = unknown[Math.floor(rng() * unknown.length)];
    const real = lobsters[side].trait;
    const others = TRAITS.map((x) => x.id).filter((x) => x !== real);
    const trait = right ? real : others[Math.floor(rng() * others.length)];
    const name = TRAITS.find((x) => x.id === trait)!.name;
    const text = trait === 'none' ? `Nothing special about ${lobsters[side].name}, trust me.` : `Word is ${lobsters[side].name} is a ${name}.`;
    return { kind: 'trait', by: id, side, trait, text };
  }
  if (id === 'guru') {
    const side: Side = rng() < 0.5 ? 0 : 1;
    return { kind: 'pick', by: id, side, text: `🔒 LOCK OF THE CENTURY: ${lobsters[side].name.toUpperCase()} 🚀🚀🚀 not financial advice` };
  }
  const p = trueChance(lobsters[0], lobsters[1], rng);
  const edge: Side = p >= 0.5 ? 0 : 1;
  const side: Side = right ? edge : edge === 0 ? 1 : 0;
  return { kind: 'pick', by: id, side, text: `Take ${lobsters[side].name}. You didn’t hear it from me.` };
}

export interface TrackRecord {
  right: number;
  wrong: number;
}

export type TrackRecords = Record<TipsterId, TrackRecord>;

export const emptyRecords = (): TrackRecords => ({ frank: { right: 0, wrong: 0 }, insider: { right: 0, wrong: 0 }, guru: { right: 0, wrong: 0 } });

export function normalizeRecords(raw: unknown): TrackRecords {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const out = emptyRecords();
  for (const id of Object.keys(out) as TipsterId[]) out[id] = { right: n(r[id]?.right), wrong: n(r[id]?.wrong) };
  return out;
}

// ---------------------------------------------------------------------------
// Scouting: tells in the tank
// ---------------------------------------------------------------------------

/** What each trait looks like in the tank (two versions each). Always true, never spelled out. */
export const TELLS: Record<TraitId, readonly [string, string]> = {
  none: ['just sits there, waving its antennae.', 'minds its own business, chewing on a bit of kelp.'],
  coward: ['hides behind the treasure chest whenever someone walks by.', 'backs into a corner when another lobster comes close.'],
  'glass-shell': ['has a hairline crack along its shell.', 'flinches when a pebble taps the glass.'],
  comeback: ['does push-ups in the corner. Seriously.', 'keeps getting back up every time it slips off the rock.'],
  hungry: ['snaps at everything that floats past.', 'is gnawing on the plastic plant.'],
  molting: ['has a soft, papery shell.', 'has bits of old shell floating around it.'],
  lazy: ['is asleep. Snoring, possibly.', 'has a copy of For a New Liberty propped against the glass. It hasn’t turned a page.'],
  debater: ['is drawing diagrams in the gravel.', 'argues with its own reflection, and wins.'],
  'pre-cooked': ['is a suspicious shade of red, and a little steamy.', 'smells faintly of butter.'],
  'crowd-favorite': ['poses for everyone taking photos.', 'has a fan club’s letters taped to the glass.'],
};

export const SCOUT_PRICE = 10;

/** What you see when you watch this lobster in the tank. */
export const tellFor = (l: Lobster) => `${l.name} ${TELLS[l.trait][l.id % 2]}`;
