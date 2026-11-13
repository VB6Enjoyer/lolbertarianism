// The career: fight nights at better and better venues, and a lobster of your
// own to buy, train and send into the ring.

import { FACTIONS, TEACHABLE, TRAITS, type ArgType, type Lobster, type TraitId } from './lobsters.ts';

export interface Venue {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  /** How much money the crowd brings (pools, late bets). */
  scale: number;
  maxStake: number;
  /** Paid at the start of each night here. */
  fee: number;
  /** Your bankroll at the end of a night to move up (or, at the top, to win it all). */
  target: number;
  /** Purses for your lobster scale with this. */
  purse: number;
}

export const VENUES: readonly Venue[] = [
  { id: 'kitchen', name: 'The Kitchen Floor', icon: '🍳', blurb: 'Where it all started: linoleum, loose bills and screaming.', scale: 1, maxStake: 250, fee: 0, target: 1000, purse: 1 },
  { id: 'garage', name: 'The Garage', icon: '🚗', blurb: 'Concrete floor, a dartboard and serious money. The fish market will talk to you now.', scale: 2.5, maxStake: 1000, fee: 100, target: 4000, purse: 2.5 },
  { id: 'porcfest', name: 'PorcFest', icon: '🏕️', blurb: 'A field in New Hampshire. Bitcoin accepted, mosquitoes free.', scale: 6, maxStake: 4000, fee: 400, target: 15000, purse: 6 },
  { id: 'convention', name: 'The Convention', icon: '🏛️', blurb: 'The party convention. Nobody agrees on anything except the betting.', scale: 15, maxStake: 15000, fee: 1500, target: 60000, purse: 15 },
  { id: 'liberland', name: 'The Liberland Championship', icon: '🏰', blurb: 'A riverbank between two countries that both say it isn’t theirs. The big leagues.', scale: 40, maxStake: 50000, fee: 6000, target: 250000, purse: 40 },
];

/** Bouts in a night. */
export const NIGHT_BOUTS = 5;

/** The fish market opens at this venue. */
export const MARKET_VENUE = 1;

export interface Career {
  venue: number;
  night: number;
  /** Bouts fought tonight, and your bankroll when the night began. */
  bout: number;
  startBankroll: number;
  champion: boolean;
  bailouts: number;
}

export const newCareer = (bankroll: number): Career => ({ venue: 0, night: 1, bout: 0, startBankroll: bankroll, champion: false, bailouts: 0 });

export function normalizeCareer(raw: unknown, bankroll: number): Career {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.floor(Number(v)))) : d);
  return {
    venue: n(r.venue, 0, VENUES.length - 1, 0),
    night: n(r.night, 1, 1e6, 1),
    // A cup night runs longer than a normal one.
    bout: n(r.bout, 0, 7, 0),
    startBankroll: n(r.startBankroll, 0, 1e12, bankroll),
    champion: r.champion === true,
    bailouts: n(r.bailouts, 0, 1e6, 0),
  };
}

export type NightOutcome = 'promoted' | 'stayed' | 'champion';

/** At the end of a night: move up if you've hit this venue's target (at the top, that's the championship). */
export function endNight(c: Career, bankroll: number): NightOutcome {
  const venue = VENUES[c.venue];
  if (bankroll < venue.target) return 'stayed';
  if (c.venue === VENUES.length - 1) return 'champion';
  return 'promoted';
}

/**
 * Starts the next night: moves up (if promoted), then charges the venue's fee.
 * If you can't pay it, you drop down until you can. Returns the fee paid and
 * whether you were sent down.
 */
export function startNight(c: Career, bankroll: number, outcome: NightOutcome | null): { career: Career; bankroll: number; fee: number; demoted: boolean } {
  let venue = c.venue + (outcome === 'promoted' ? 1 : 0);
  let demoted = false;
  while (venue > 0 && bankroll < VENUES[venue].fee * 2) {
    venue--;
    demoted = true;
  }
  const fee = VENUES[venue].fee;
  const after = bankroll - fee;
  return { career: { ...c, venue, night: c.night + 1, bout: 0, startBankroll: after, champion: c.champion || outcome === 'champion' }, bankroll: after, fee, demoted };
}

/** Broke: your uncle bails you out, and the bouncers throw you down a venue. */
export function bailout(c: Career): Career {
  return { ...c, venue: Math.max(0, c.venue - 1), bailouts: c.bailouts + 1 };
}

// ---------------------------------------------------------------------------
// Your lobster
// ---------------------------------------------------------------------------

export const MINE_ID = 100;

export interface Stable {
  lobster: Lobster;
  /** Bouts it has to sit out (after a loss), and fights it's had. */
  rest: number;
  purses: number;
  /** How much the commission suspects it of taking dives (it fades a night at a time). */
  suspicion: number;
  /** Dives it's taken, all told. */
  dives: number;
}

const NAMES = ['Pinchy McPinchface', 'Clawdius Hayek', 'Shellon Mises', 'Lobsta Rothbard Jr.', 'Krill Pinker', 'Clawrence Reed', 'The Invisible Claw', 'Shell Block', 'Anarcho-Crustacean', 'Bisque Liberty'];

export const suggestName = (rng: () => number) => NAMES[Math.floor(rng() * NAMES.length)];

export interface Offer {
  lobster: Lobster;
  price: number;
  /** The lot number on its tank. */
  lot: number;
}

/** What the fishmonger has scrawled on the tanks. */
export const LOT_NAMES = [
  'Probably Fine', 'Slightly Used', 'Ex-Display Model', 'Fell Off a Boat', 'No Questions Asked', 'Sold As Seen',
  'One Previous Owner', 'Unregistered Crustacean', 'Tax-Free Special', 'Cash Only', 'Gray Market Import', 'Seized at Customs',
  'Fiat Clearance Sale', 'Surplus from the Fed', 'Mostly Legs', 'Read Half of Human Action', 'Voted Once (Regrets It)',
  'Still Has the Rubber Bands', 'Survived a Bisque', 'Ate a Copy of Atlas Shrugged', 'Free-Range, Free-Market', 'Smells Like Freedom',
  'Returned Under Warranty', 'Bitcoin Accepted', 'Thermidor Survivor', 'Moderately Sentient', 'Lightly Pre-Steamed', 'Owes Vinny Money',
] as const;

/** Three lobsters at the fish market: weaker than the league's, and you won't know their trait until they're yours. */
export function marketOffers(rng: () => number, night: number): Offer[] {
  const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const traits = TRAITS.map((t) => t.id);
  const names = [...LOT_NAMES];
  return Array.from({ length: 3 }, (_, i) => {
    const faction = FACTIONS[Math.floor(rng() * FACTIONS.length)].id;
    const lobster: Lobster = {
      id: MINE_ID,
      name: names.splice(Math.floor(rng() * names.length), 1)[0],
      faction,
      claw: between(3, 6),
      shell: between(3, 6),
      stamina: between(75, 100),
      wits: between(3, 6),
      weight: Math.round((1.2 + rng() * 2) * 10) / 10,
      wins: 0,
      losses: 0,
      form: [],
      trait: (rng() < 0.33 ? 'none' : traits[1 + Math.floor(rng() * (traits.length - 1))]) as TraitId,
      traitKnown: false,
      rumor: null,
      scouted: false,
    };
    const quality = lobster.claw + lobster.shell + lobster.wits + (lobster.stamina - 75) / 10;
    return { lobster, price: Math.round((500 + quality * 55) / 10) * 10, lot: night * 10 + i + 1 };
  });
}

export type TrainStat = 'claw' | 'shell' | 'wits' | 'stamina';

export const STAT_CAP = 10;
export const STAMINA_CAP = 160;

/** What the next point of training costs (null when it's maxed out). */
export function trainingCost(l: Lobster, stat: TrainStat): number | null {
  if (stat === 'stamina') return l.stamina >= STAMINA_CAP ? null : Math.round((60 * 1.25 ** ((l.stamina - 70) / 10)) / 10) * 10;
  return l[stat] >= STAT_CAP ? null : Math.round((80 * 1.5 ** (l[stat] - 3)) / 10) * 10;
}

export function train(l: Lobster, stat: TrainStat): void {
  if (stat === 'stamina') l.stamina = Math.min(STAMINA_CAP, l.stamina + 10);
  else l[stat] = Math.min(STAT_CAP, l[stat] + 1);
}

/** Traits a therapist can talk a lobster out of. */
export const BAD_TRAITS: ReadonlySet<TraitId> = new Set(['coward', 'glass-shell', 'lazy', 'pre-cooked', 'molting']);
export const THERAPY_PRICE = 400;

export type Tier = 'easy' | 'even' | 'hard';

export const TIERS: readonly { id: Tier; name: string; purse: number }[] = [
  { id: 'easy', name: 'Easy', purse: 100 },
  { id: 'even', name: 'Even', purse: 250 },
  { id: 'hard', name: 'Hard', purse: 600 },
];

export const purseFor = (tier: Tier, venue: number) => Math.round(TIERS.find((t) => t.id === tier)!.purse * VENUES[venue].purse);

/** A rough strength rating, to sort opponents into tiers. */
export const rating = (l: Lobster) => l.claw * 1.3 + l.shell + l.wits * 0.8 + l.stamina / 12;

/** An opponent from the league: the weakest third, the middle, or the strongest third. */
export function pickOpponent(roster: readonly Lobster[], tier: Tier, rng: () => number): Lobster {
  const sorted = [...roster].sort((a, b) => rating(a) - rating(b));
  const third = Math.floor(sorted.length / 3);
  const pool = tier === 'easy' ? sorted.slice(0, third) : tier === 'hard' ? sorted.slice(-third) : sorted.slice(third, sorted.length - third);
  return pool[Math.floor(rng() * pool.length)];
}

/** After a loss: sit out a bout (two after a KO), and maybe an injury that costs a point. Returns what got hurt. */
export function afterLoss(s: Stable, ko: boolean, rng: () => number): TrainStat | null {
  s.rest = ko ? 2 : 1;
  if (rng() >= 0.35) return null;
  const stat = (['claw', 'shell', 'wits', 'stamina'] as const)[Math.floor(rng() * 4)];
  if (stat === 'stamina') s.lobster.stamina = Math.max(60, s.lobster.stamina - 10);
  else s.lobster[stat] = Math.max(1, s.lobster[stat] - 1);
  return stat;
}

export function normalizeStable(raw: unknown): Stable | null {
  const r = raw as Stable | null;
  if (!r || typeof r !== 'object' || !r.lobster || typeof r.lobster !== 'object') return null;
  const l = r.lobster;
  const n = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  if (!FACTIONS.some((f) => f.id === l.faction)) return null;
  return {
    rest: Math.floor(n(r.rest, 0, 5, 0)),
    purses: Math.floor(n(r.purses, 0, 1e12, 0)),
    suspicion: Math.floor(n(r.suspicion, 0, 10, 0)),
    dives: Math.floor(n(r.dives, 0, 1e6, 0)),
    lobster: {
      id: MINE_ID,
      name: String(l.name ?? 'Your Lobster').slice(0, 30) || 'Your Lobster',
      faction: l.faction,
      claw: n(l.claw, 1, STAT_CAP, 4),
      shell: n(l.shell, 1, STAT_CAP, 4),
      stamina: n(l.stamina, 60, STAMINA_CAP, 80),
      wits: n(l.wits, 1, STAT_CAP, 4),
      weight: n(l.weight, 1, 6, 2),
      wins: Math.floor(n(l.wins, 0, 1e6, 0)),
      losses: Math.floor(n(l.losses, 0, 1e6, 0)),
      form: (Array.isArray(l.form) ? l.form : []).filter((f) => f === 'W' || f === 'L').slice(-5),
      trait: TRAITS.some((t) => t.id === l.trait) ? l.trait : 'none',
      traitKnown: true,
      rumor: null,
      scouted: false,
      learned: l.learned && TEACHABLE[l.learned.type as ArgType] ? TEACHABLE[l.learned.type as ArgType] : null,
    },
  };
}

/** Teaching your lobster an argument costs more at the bigger venues (better coaches). */
export const teachCost = (venue: number) => 600 + 300 * venue;
