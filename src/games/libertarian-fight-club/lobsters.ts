// The league: libertarian factions, their arguments, and the lobsters who make them.

/** Kinds of argument. Every faction is weak to one and shrugs off another. */
export type ArgType = 'moral' | 'econ' | 'practical' | 'purity' | 'meme';

export const ARG_TYPES: Record<ArgType, { icon: string; name: string }> = {
  moral: { icon: '⚖️', name: 'Moral' },
  econ: { icon: '📈', name: 'Economic' },
  practical: { icon: '🛣️', name: 'Practical' },
  purity: { icon: '🧪', name: 'Purity test' },
  meme: { icon: '🤡', name: 'Meme' },
};

export interface Move {
  name: string;
  type: ArgType;
  /** How hard it hits, around 1. */
  power: number;
}

export type FactionId = 'ancap' | 'minarchist' | 'austrian' | 'chicago' | 'objectivist' | 'georgist' | 'agorist' | 'hoppean' | 'bleeding-heart' | 'mises-caucus';

export interface Faction {
  id: FactionId;
  name: string;
  icon: string;
  /** The lobster's shell color, and a second color for the markings. */
  color: string;
  accent: string;
  moves: readonly Move[];
  /** Arguments of this type hit it ×1.6, and of this one ×0.6. */
  weak: ArgType;
  resists: ArgType;
}

export const FACTIONS: readonly Faction[] = [
  {
    id: 'ancap', name: 'Ancap', icon: '🏴', color: '#2b2b2b', accent: '#f9c80e',
    moves: [{ name: 'Taxation is theft!', type: 'moral', power: 1.2 }, { name: 'Private courts will handle it', type: 'practical', power: 0.9 }, { name: 'You’re just a statist', type: 'purity', power: 1.0 }],
    weak: 'practical', resists: 'moral',
  },
  {
    id: 'minarchist', name: 'Minarchist', icon: '📜', color: '#e0a526', accent: '#7a4e00',
    moves: [{ name: 'Who will build the roads?', type: 'practical', power: 1.2 }, { name: 'Night-watchman State', type: 'practical', power: 0.9 }, { name: 'The Constitution!', type: 'moral', power: 1.0 }],
    weak: 'purity', resists: 'practical',
  },
  {
    id: 'austrian', name: 'Austrian School', icon: '🎩', color: '#c62828', accent: '#ffcdd2',
    moves: [{ name: 'Praxeology!', type: 'econ', power: 1.15 }, { name: 'Business cycle theory', type: 'econ', power: 1.0 }, { name: 'Have you even read Human Action?', type: 'purity', power: 1.0 }],
    weak: 'meme', resists: 'econ',
  },
  {
    id: 'chicago', name: 'Chicago School', icon: '📊', color: '#7b1f2b', accent: '#f8bbd0',
    moves: [{ name: 'Show me the data', type: 'econ', power: 1.1 }, { name: 'Monetarism', type: 'econ', power: 1.0 }, { name: 'Milton said so', type: 'meme', power: 0.9 }],
    weak: 'moral', resists: 'practical',
  },
  {
    id: 'objectivist', name: 'Objectivist', icon: '💲', color: '#d4af37', accent: '#5d4037',
    moves: [{ name: 'A is A', type: 'moral', power: 1.1 }, { name: 'Atlas shrugs', type: 'meme', power: 1.0 }, { name: 'Altruism is evil', type: 'moral', power: 1.0 }],
    weak: 'meme', resists: 'purity',
  },
  {
    id: 'georgist', name: 'Georgist', icon: '🌍', color: '#6d7f3a', accent: '#dce775',
    moves: [{ name: 'Land value tax!', type: 'econ', power: 1.15 }, { name: 'Unearned rent!', type: 'moral', power: 1.0 }, { name: 'Progress and Poverty', type: 'econ', power: 0.95 }],
    weak: 'purity', resists: 'econ',
  },
  {
    id: 'agorist', name: 'Agorist', icon: '🕶️', color: '#2e5d3a', accent: '#a5d6a7',
    moves: [{ name: 'Counter-economics', type: 'practical', power: 1.1 }, { name: 'Black-market deal', type: 'practical', power: 1.0 }, { name: 'Voting is consent', type: 'purity', power: 1.05 }],
    weak: 'econ', resists: 'practical',
  },
  {
    id: 'hoppean', name: 'Hoppean', icon: '🚁', color: '#1e5aa8', accent: '#bbdefb',
    moves: [{ name: 'Physical removal', type: 'purity', power: 1.25 }, { name: 'Argumentation ethics', type: 'moral', power: 1.0 }, { name: 'Democracy: the God That Failed', type: 'moral', power: 1.05 }],
    weak: 'meme', resists: 'purity',
  },
  {
    id: 'bleeding-heart', name: 'Bleeding-Heart', icon: '💗', color: '#e57399', accent: '#fce4ec',
    moves: [{ name: 'Markets for social justice', type: 'moral', power: 1.05 }, { name: 'It’s more nuanced than that', type: 'econ', power: 0.95 }, { name: 'Compassionate capitalism', type: 'moral', power: 1.0 }],
    weak: 'purity', resists: 'meme',
  },
  {
    id: 'mises-caucus', name: 'Mises Caucus', icon: '🐍', color: '#e8772e', accent: '#3e2723',
    moves: [{ name: 'Based and redpilled', type: 'meme', power: 1.15 }, { name: 'Take over the party', type: 'practical', power: 1.0 }, { name: 'Purge the moderates', type: 'purity', power: 1.1 }],
    weak: 'econ', resists: 'meme',
  },
];

export const factionById = (id: FactionId) => FACTIONS.find((f) => f.id === id)!;

/** How well an argument lands on a faction. */
export function effectiveness(type: ArgType, defender: Faction): number {
  if (type === defender.weak) return 1.5;
  if (type === defender.resists) return 0.65;
  return 1;
}

export type TraitId = 'none' | 'coward' | 'glass-shell' | 'comeback' | 'hungry' | 'molting' | 'lazy' | 'debater' | 'pre-cooked' | 'crowd-favorite';

export interface Trait {
  id: TraitId;
  name: string;
  description: string;
  /** Shown at the weigh-in (before the fight), or only when it kicks in. */
  atWeighIn: boolean;
}

export const TRAITS: readonly Trait[] = [
  { id: 'none', name: 'Nothing special', description: 'What you see is what you get.', atWeighIn: false },
  { id: 'coward', name: 'Coward', description: 'Might flee the ring when it’s losing badly.', atWeighIn: false },
  { id: 'glass-shell', name: 'Glass Shell', description: 'Critical hits hurt it half again as much.', atWeighIn: false },
  { id: 'comeback', name: 'Comeback Kid', description: 'Hits 40% harder when nearly beaten.', atWeighIn: false },
  { id: 'hungry', name: 'Hungry', description: 'Claw +2, but tires faster (stamina −15%).', atWeighIn: true },
  { id: 'molting', name: 'Molting', description: 'Soft shell: shell −3.', atWeighIn: true },
  { id: 'lazy', name: 'Lazy', description: 'Sometimes skips its turn to read Rothbard.', atWeighIn: false },
  { id: 'debater', name: 'Debate Champion', description: 'Lands critical hits far more often.', atWeighIn: false },
  { id: 'pre-cooked', name: 'Pre-Cooked', description: 'Somebody steamed it a little. Stamina −25%.', atWeighIn: true },
  { id: 'crowd-favorite', name: 'Crowd Favorite', description: 'Popular, so the odds overrate it. No better at fighting.', atWeighIn: false },
];

export const traitById = (id: TraitId) => TRAITS.find((t) => t.id === id)!;

export interface Lobster {
  id: number;
  name: string;
  faction: FactionId;
  claw: number;
  shell: number;
  stamina: number;
  wits: number;
  /** Pounds, for the tale of the tape. */
  weight: number;
  wins: number;
  losses: number;
  /** The last five results, newest last. */
  form: ('W' | 'L')[];
  trait: TraitId;
  /** Whether you've seen its trait (it shows on the card once you have). */
  traitKnown: boolean;
  /** A tipster's word on its trait (maybe wrong), and whether you've watched it in the tank. */
  rumor: { trait: TraitId; by: string } | null;
  scouted: boolean;
}

const NAMES: readonly [FactionId, string][] = [
  ['ancap', 'Murray Rothclaw'], ['ancap', 'Walter Blocklobster'],
  ['minarchist', 'Ron Pincher'], ['minarchist', 'Robert Nozclaw'],
  ['austrian', 'Ludwig von Pinches'], ['austrian', 'Friedrich von Shellek'],
  ['chicago', 'Milton Freedclaw'], ['chicago', 'Gary Beckclaw'],
  ['objectivist', 'Ayn Randclaw'], ['objectivist', 'John Galtster'],
  ['georgist', 'Henry Georgeclaw'],
  ['agorist', 'SEK III-Claw'],
  ['hoppean', 'Hans-Hermann Hopster'],
  ['bleeding-heart', 'Jason Brennaclaw'],
  ['mises-caucus', 'Big Claw Dave'], ['mises-caucus', 'Redpill Rick'],
];

/** The league's lobsters, each with stats, a trait and a short history. */
export function makeRoster(rng: () => number): Lobster[] {
  const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const traits = TRAITS.map((t) => t.id);
  return NAMES.map(([faction, name], id) => {
    const wins = between(0, 6);
    const losses = between(0, 6);
    const form = Array.from({ length: Math.min(5, wins + losses) }, () => (rng() < wins / Math.max(1, wins + losses) ? 'W' : 'L') as 'W' | 'L');
    return {
      id,
      name,
      faction,
      claw: between(3, 9),
      shell: between(3, 9),
      stamina: between(70, 130),
      wits: between(3, 9),
      weight: Math.round((1.5 + rng() * 3) * 10) / 10,
      wins,
      losses,
      form,
      // A third have nothing special.
      trait: rng() < 0.33 ? 'none' : traits[1 + Math.floor(rng() * (traits.length - 1))],
      traitKnown: false,
      rumor: null,
      scouted: false,
    };
  });
}

/** Cleans up a saved roster (or returns null so a fresh one is made). */
export function normalizeRoster(raw: unknown): Lobster[] | null {
  if (!Array.isArray(raw) || raw.length !== NAMES.length) return null;
  const num = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  return raw.map((r: Record<string, unknown>, id) => ({
    id,
    name: NAMES[id][1],
    faction: NAMES[id][0],
    claw: num(r?.claw, 1, 10, 5),
    shell: num(r?.shell, 1, 10, 5),
    stamina: num(r?.stamina, 40, 200, 100),
    wits: num(r?.wits, 1, 10, 5),
    weight: num(r?.weight, 1, 6, 2.5),
    wins: Math.floor(num(r?.wins, 0, 1e6, 0)),
    losses: Math.floor(num(r?.losses, 0, 1e6, 0)),
    form: (Array.isArray(r?.form) ? r.form : []).filter((f: unknown) => f === 'W' || f === 'L').slice(-5),
    trait: TRAITS.some((t) => t.id === r?.trait) ? (r.trait as TraitId) : 'none',
    traitKnown: r?.traitKnown === true,
    rumor:
      r?.rumor && typeof r.rumor === 'object' && TRAITS.some((t) => t.id === (r.rumor as Record<string, unknown>).trait)
        ? { trait: (r.rumor as Record<string, unknown>).trait as TraitId, by: String((r.rumor as Record<string, unknown>).by ?? '') }
        : null,
    scouted: r?.scouted === true,
  }));
}
