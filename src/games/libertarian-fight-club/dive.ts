// Throwing a fight: pay your own lobster to take a dive, bet on the other one.
// The crowd's odds don't know. The commission might.

import type { Lobster } from './lobsters.ts';

/** The bribe, as a share of the purse it's giving up. */
export const BRIBE_SHARE = 0.4;
/** How long the commission suspends a lobster it catches, and the fine (times the bribe). */
export const SUSPENSION = 3;
export const FINE_MULTIPLE = 2;

export const bribeFor = (purse: number) => Math.max(10, Math.round((purse * BRIBE_SHARE) / 10) * 10);

/** The lobster that actually shows up: arguing badly on purpose. */
export function diveFighter(l: Lobster): Lobster {
  return { ...l, claw: Math.max(1, Math.round(l.claw * 0.25)), shell: Math.max(1, Math.round(l.shell * 0.4)), wits: 1 };
}

/** The chance the commission catches it: higher each time you've done it lately. */
export const catchChance = (suspicion: number) => Math.min(0.6, 0.2 + 0.12 * Math.max(0, suspicion));
