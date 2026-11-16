// The regulars: classmates with names, habits and long memories. Trade with one often enough and
// you're best friends (better deals); slap one and they won't come by for a couple of days.

export type ClassmateId = 'timmy' | 'becky' | 'dave';

export interface Classmate {
  id: ClassmateId;
  icon: string;
  name: string;
  /** The day Jack meets them. */
  from: number;
  /** How often they come by, next to the other regulars. */
  weight: number;
  /** What the teacher says the day they turn up. */
  intro: string;
  /** One line for the title screen and the report card. */
  blurb: string;
  /** What being best friends gets you. */
  friendPerk: string;
}

export const CLASSMATES: readonly Classmate[] = [
  {
    id: 'timmy',
    icon: '🧢',
    name: 'Timmy',
    from: 1,
    weight: 1,
    intro: '🧢 That’s Timmy. Fair deals, every time.',
    blurb: 'Fair deals, every time.',
    friendPerk: 'His things are worth even more to you.',
  },
  {
    id: 'becky',
    icon: '🎀',
    name: 'Becky',
    from: 2,
    weight: 1.6,
    intro: '🎀 Meet Becky: comes by a lot and haggles hard. Worse deals, but still deals.',
    blurb: 'Comes by a lot, haggles hard.',
    friendPerk: 'She knocks a block off her price.',
  },
  {
    id: 'dave',
    icon: '💼',
    name: 'Dave',
    from: 3,
    weight: 1.2,
    intro: '💼 Meet Dave the reseller: never sells, only buys what’s in your stash, and pays well.',
    blurb: 'Only buys what you’ve got, and pays well.',
    friendPerk: 'He pays a block more.',
  },
];

export const classmateById = (id: ClassmateId) => CLASSMATES.find((c) => c.id === id)!;

/** Trades it takes to become best friends, and the school days a regular stays away after a slap. */
export const FRIEND_AT = 4;
export const GRUDGE_DAYS = 2;
/** The share of traders who are regulars (once you've met any). */
export const REGULAR_SHARE = 0.45;

export interface Regular {
  /** Trades since the last falling-out. */
  trades: number;
  /** School days left before they'll come by again. */
  grudge: number;
}

export type Regulars = Record<ClassmateId, Regular>;

export const noRegulars = (): Regulars => ({ timmy: { trades: 0, grudge: 0 }, becky: { trades: 0, grudge: 0 }, dave: { trades: 0, grudge: 0 } });

export const isFriend = (r: Regular) => r.trades >= FRIEND_AT;

/** The regulars met by this day. */
export const regularsMet = (day: number) => CLASSMATES.filter((c) => c.from <= day);

/** Who's new today. */
export const regularsNewToday = (day: number) => CLASSMATES.filter((c) => c.from === day);
