// Night events: a twist that holds for a whole night. Some help you, some don't,
// and a couple just make the crowd dumber (which helps you).

export type EventId = 'tax-holiday' | 'regulators' | 'printer' | 'whale' | 'lockdown' | 'election' | 'raid';

export interface NightEvent {
  id: EventId;
  icon: string;
  name: string;
  /** What it means for you, in a line. */
  blurb: string;
  /** The house's cut of the pool tonight (negative: the pool is padded with fresh money). */
  cut?: number;
  /** How much money the public brings, and how much Susan, Sheila and Larry bet. */
  crowdScale?: number;
  memeScale?: number;
  /** The venue's maximum stake, and the price of tips, scouting, training and therapy. */
  stakeScale?: number;
  priceScale?: number;
  /** A big bettor who piles onto one side of every bout. */
  whale?: boolean;
  /** The chance any one bout gets raided (called off mid-fight). */
  raidChance?: number;
}

export const NIGHT_EVENTS: readonly NightEvent[] = [
  { id: 'tax-holiday', icon: '🎉', name: 'Tax Holiday', blurb: 'The house waives its cut tonight. The whole pot goes to the winners.', cut: 0 },
  { id: 'regulators', icon: '📋', name: 'The Regulators Are In', blurb: 'Compliance costs: the house takes 20% of every pot tonight.', cut: 0.2 },
  { id: 'printer', icon: '🖨️', name: 'Money Printer Goes Brrr', blurb: 'Fresh fiat pads every pool (+5% on top of the pot), but tips, scouting, training and therapy cost 25% more.', cut: -0.05, priceScale: 1.25 },
  { id: 'whale', icon: '🐋', name: 'A Bitcoin Whale Walks In', blurb: 'Someone with more sats than sense is piling onto one side of every bout. The other side pays.', whale: true },
  { id: 'lockdown', icon: '😷', name: 'Lockdown', blurb: 'Only essential gambling. The crowd brings half its money and the venue halves its maximum stake.', crowdScale: 0.5, stakeScale: 0.5 },
  { id: 'election', icon: '🗳️', name: 'Election Night', blurb: 'Emotions are running high. Susan, Sheila and Larry are betting three times their usual.', memeScale: 3 },
  { id: 'raid', icon: '🚔', name: 'Word of a Raid', blurb: 'The cops might raid a bout tonight. If they do, they keep 20% of every bet on it. Civil asset forfeiture.', raidChance: 0.15 },
];

export const eventById = (id: EventId | null) => NIGHT_EVENTS.find((e) => e.id === id) ?? null;

/** About half of all nights get an event (never the first one). */
export const EVENT_CHANCE = 0.55;

export function rollEvent(rng: () => number, night: number, last: EventId | null = null): EventId | null {
  if (night <= 1 || rng() >= EVENT_CHANCE) return null;
  const pool = NIGHT_EVENTS.filter((e) => e.id !== last);
  return pool[Math.floor(rng() * pool.length)].id;
}

export const normalizeEvent = (raw: unknown): EventId | null => (NIGHT_EVENTS.some((e) => e.id === raw) ? (raw as EventId) : null);

/** What the raid takes. */
export const FORFEIT = 0.2;

/** How big the whale's bet is: a multiple of the public's money. */
export const whaleBet = (publicMoney: number, rng: () => number) => Math.round((publicMoney * (0.6 + rng() * 0.6)) / 10) * 10;
