// Vinny "the Fin": the loan shark. He lends when nobody else will, at 20% a
// night, and he is patient for exactly three nights.

import { VENUES } from './career.ts';

export interface Shark {
  debt: number;
  /** Nights in a row you've started owing without paying anything back. */
  nightsUnpaid: number;
  /** Whether you paid anything tonight (it resets his patience). */
  paidTonight: boolean;
}

export const newShark = (): Shark => ({ debt: 0, nightsUnpaid: 0, paidTonight: false });

/** Interest per night, and how many unpaid nights before he collects. */
export const SHARK_RATE = 0.2;
export const SHARK_PATIENCE = 3;

/** What he lends at a time, and the most he'll let you owe, at each venue. */
export const loanChunk = (venue: number) => Math.round((250 * VENUES[venue].scale) / 10) * 10;
export const creditLimit = (venue: number) => Math.round((1000 * VENUES[venue].scale) / 10) * 10;

/** Borrow a chunk (up to the limit). Returns how much you got. */
export function borrow(s: Shark, venue: number): number {
  const amount = Math.min(loanChunk(venue), creditLimit(venue) - s.debt);
  if (amount < 10) return 0;
  s.debt += amount;
  return amount;
}

/** Pay back what you can. Returns how much you paid. */
export function repay(s: Shark, cash: number): number {
  const paid = Math.floor(Math.min(cash, s.debt));
  if (paid <= 0) return 0;
  s.debt -= paid;
  s.paidTonight = true;
  if (s.debt <= 0) {
    s.debt = 0;
    s.nightsUnpaid = 0;
  }
  return paid;
}

/** A new night: interest goes on, and his patience runs down if you didn't pay. Returns the interest added. */
export function nightPasses(s: Shark): number {
  if (s.debt <= 0) {
    s.nightsUnpaid = 0;
    s.paidTonight = false;
    return 0;
  }
  const interest = Math.ceil(s.debt * SHARK_RATE);
  s.debt += interest;
  s.nightsUnpaid = s.paidTonight ? 0 : s.nightsUnpaid + 1;
  s.paidTonight = false;
  return interest;
}

export const dueForCollection = (s: Shark) => s.debt > 0 && s.nightsUnpaid >= SHARK_PATIENCE;

export interface Collection {
  /** Cash he took. */
  took: number;
  /** He broke your lobster's claw, or had the bouncers throw you down a venue. */
  claw: boolean;
  demoted: boolean;
}

/** He collects: your cash first, then something that hurts; then he halves what's left and starts counting again. */
export function collect(s: Shark, bankroll: number, hasLobster: boolean): Collection {
  const took = Math.floor(Math.min(bankroll, s.debt));
  s.debt -= took;
  const out: Collection = { took, claw: false, demoted: false };
  if (s.debt > 0) {
    if (hasLobster) out.claw = true;
    else out.demoted = true;
    s.debt = Math.ceil(s.debt / 2);
  }
  s.nightsUnpaid = 0;
  return out;
}

export function normalizeShark(raw: unknown): Shark {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  return { debt: n(r.debt), nightsUnpaid: Math.min(SHARK_PATIENCE, n(r.nightsUnpaid)), paidTonight: r.paidTonight === true };
}
