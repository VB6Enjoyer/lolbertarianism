/** Your betting record: what you staked and got back, by kind of bet, plus the highlights. */

export type BetType = 'winner' | 'live' | 'props' | 'parlay';
export const BET_TYPES: readonly { id: BetType; icon: string; name: string }[] = [
  { id: 'winner', icon: '💵', name: 'Winner bets' },
  { id: 'live', icon: '⚡', name: 'Live bets' },
  { id: 'props', icon: '🎲', name: 'Props' },
  { id: 'parlay', icon: '🧾', name: 'Parlays' },
];

export interface LedgerLine {
  bets: number;
  /** Bets that paid back more than they cost (cash-outs included). */
  wins: number;
  staked: number;
  returned: number;
}

export interface Highlight {
  amount: number;
  text: string;
}

export interface Ledger {
  lines: Record<BetType, LedgerLine>;
  /** The biggest profit on one bet, and the biggest loss on one. */
  best: Highlight | null;
  worst: Highlight | null;
  cashouts: number;
}

const emptyLine = (): LedgerLine => ({ bets: 0, wins: 0, staked: 0, returned: 0 });

export function emptyLedger(): Ledger {
  return { lines: { winner: emptyLine(), live: emptyLine(), props: emptyLine(), parlay: emptyLine() }, best: null, worst: null, cashouts: 0 };
}

/** Puts one settled bet on the record. `returned` is what came back (0 for a loss). */
export function recordBet(ledger: Ledger, type: BetType, stake: number, returned: number, text: string) {
  const line = ledger.lines[type];
  line.bets++;
  line.staked += stake;
  line.returned += returned;
  if (returned > stake) line.wins++;
  const profit = returned - stake;
  if (profit > 0 && profit > (ledger.best?.amount ?? 0)) ledger.best = { amount: profit, text };
  if (profit < 0 && -profit > (ledger.worst?.amount ?? 0)) ledger.worst = { amount: -profit, text };
}

/** All the lines added up. */
export function ledgerTotal(ledger: Ledger): LedgerLine {
  const total = emptyLine();
  for (const t of BET_TYPES) {
    const l = ledger.lines[t.id];
    total.bets += l.bets;
    total.wins += l.wins;
    total.staked += l.staked;
    total.returned += l.returned;
  }
  return total;
}

/** Return on investment, as a fraction (0.1 = 10% profit), or null with nothing staked. */
export const roi = (l: LedgerLine) => (l.staked > 0 ? (l.returned - l.staked) / l.staked : null);

const count = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));

function highlight(raw: unknown): Highlight | null {
  const h = raw as Partial<Highlight> | null;
  if (!h || typeof h.text !== 'string' || !(Number(h.amount) > 0)) return null;
  return { amount: count(h.amount), text: h.text.slice(0, 200) };
}

export function normalizeLedger(raw: unknown): Ledger {
  const r = (raw ?? {}) as Partial<Ledger>;
  const ledger = emptyLedger();
  for (const t of BET_TYPES) {
    const l = (r.lines?.[t.id] ?? {}) as Partial<LedgerLine>;
    ledger.lines[t.id] = { bets: count(l.bets), wins: Math.min(count(l.wins), count(l.bets)), staked: count(l.staked), returned: count(l.returned) };
  }
  ledger.best = highlight(r.best);
  ledger.worst = highlight(r.worst);
  ledger.cashouts = count(r.cashouts);
  return ledger;
}
