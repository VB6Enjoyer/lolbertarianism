// Party mode: 4 to 8 people round one phone. The app deals secret roles, hands of policies and
// votes; the arguing happens out loud. Each quarter a crisis hits, everyone but the Chair secretly
// proposes one of the two policies they were dealt (and knows what it really is), the rotating Chair
// enacts one of theirs (never having proposed one, they have to judge the others), and
// the table may vote to fire someone. Bills land later with the proposer's name on them. Plain data,
// seeded, so a party saves mid-round.

import { BILL_SCALE, crisisFor, findPolicy, HIT_SCALE, type Mode, type News, QUARTERS } from './council.ts';
import { type Crisis, CRISES, type Effect } from './crises.ts';
import { int, makeRng, type Rng, shuffleInPlace } from './rng.ts';
import { SNEAK_NEWS } from './talk.ts';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const HAND = 2;
/** What each impostor still at the table costs a quarter: gentler than solo, since firing takes a majority. */
export const PARTY_SNEAK: Effect = { p: -1, l: -2 };

/**
 * Each table size's impostors and starting meters, tuned with simulated tables so the loyal side
 * wins a bit over half the time (people talk, so it's a guide): a lone impostor at four needs the
 * meters lower; two at five need them higher. (Raised when the Chair stopped proposing: a loyal Chair
 * can no longer just enact their own sound card.)
 */
export const TABLES: Record<number, { impostors: number; start: number }> = {
  4: { impostors: 1, start: 46 },
  5: { impostors: 2, start: 69 },
  6: { impostors: 2, start: 65 },
  7: { impostors: 2, start: 61 },
  8: { impostors: 2, start: 59 },
};
export const impostorsFor = (players: number) => TABLES[players]?.impostors ?? 2;

export interface PartyPlayer {
  name: string;
  impostor: boolean;
  fired: boolean;
}

export type PartyPhase = 'roles' | 'briefing' | 'propose' | 'table' | 'result' | 'vote' | 'voted' | 'over';
export type PartyEnding = 'term' | 'purged' | 'broke' | 'chained' | 'takeover';

export interface PartyGame {
  seed: number;
  rng: Rng;
  mode: Mode;
  players: PartyPlayer[];
  quarter: number;
  crises: string[];
  prosperity: number;
  liberty: number;
  phase: PartyPhase;
  /** Whose turn with the phone (roles, proposals, votes): a player index. */
  turn: number;
  /** The rotating Chair, who enacts a proposal each quarter. */
  chair: number;
  /** This quarter's hands (player index → policy ids) and proposals. */
  hands: Record<number, string[]>;
  proposals: { player: number; policy: string }[];
  enacted: { quarter: number; policy: string; proposer: number }[];
  pending: { policy: string; due: number; proposer: number }[];
  news: (News & { proposer?: number })[];
  /** Secret votes this round (voter → target, or -1 for nobody), and the last result. */
  votes: Record<number, number>;
  lastVote: { fired: number | null; tally: Record<number, number> } | null;
  ending: PartyEnding | null;
}

export const activePlayers = (g: PartyGame) => g.players.map((p, i) => ({ p, i })).filter(({ p }) => !p.fired);
export const partyCrisis = (g: PartyGame): Crisis => crisisFor(g.crises[g.quarter - 1], g.mode);
export const loyalWins = (g: PartyGame) => g.ending === 'term' || g.ending === 'purged';

const clamp = (x: number) => Math.max(0, Math.min(100, x));
const scaled = (e: Effect, k: number): Effect => ({ p: Math.round((e.p ?? 0) * k), l: Math.round((e.l ?? 0) * k) });
function apply(g: PartyGame, e: Effect) {
  g.prosperity = clamp(g.prosperity + (e.p ?? 0));
  g.liberty = clamp(g.liberty + (e.l ?? 0));
}

export function newParty(seed: number, names: string[], mode: Mode = 'ancap'): PartyGame {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) throw new Error(`A party needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  const rng = makeRng(seed);
  const impostors = shuffleInPlace(rng, [...names.keys()]).slice(0, impostorsFor(names.length));
  const g: PartyGame = {
    seed,
    rng,
    mode,
    players: names.map((name, i) => ({ name, impostor: impostors.includes(i), fired: false })),
    quarter: 1,
    crises: shuffleInPlace(rng, CRISES.map((c) => c.id)).slice(0, QUARTERS),
    prosperity: TABLES[names.length].start,
    liberty: TABLES[names.length].start,
    phase: 'roles',
    turn: 0,
    chair: int(rng, 0, names.length - 1),
    hands: {},
    proposals: [],
    enacted: [],
    pending: [],
    news: [],
    votes: {},
    lastVote: null,
    ending: null,
  };
  return g;
}

/** The next player still in the game after `from` (wrapping round), or -1 past the end when `wrap` is off. */
function nextActive(g: PartyGame, from: number, wrap: boolean): number {
  for (let k = 1; k <= g.players.length; k++) {
    const i = from + k;
    if (!wrap && i >= g.players.length) return -1;
    const j = i % g.players.length;
    if (!g.players[j].fired) return j;
  }
  return -1;
}
const firstActive = (g: PartyGame) => g.players.findIndex((p) => !p.fired);
/** Who proposes this quarter: everyone still in, except the Chair (who judges the proposals). */
export const proposers = (g: PartyGame) => activePlayers(g).filter(({ i }) => i !== g.chair);
/** The next proposer after `from` (in seat order), or -1. */
function nextProposer(g: PartyGame, from: number): number {
  return proposers(g).find(({ i }) => i > from)?.i ?? -1;
}

/** A player has seen their role; on to the next, then the first quarter. */
export function roleSeen(g: PartyGame) {
  if (g.phase !== 'roles') return;
  if (g.turn < g.players.length - 1) g.turn++;
  else startQuarter(g);
}

/** Your fellow impostors (if you are one). */
export const fellowImpostors = (g: PartyGame, i: number) => (g.players[i]?.impostor ? g.players.map((p, k) => ({ p, k })).filter(({ p, k }) => p.impostor && k !== i).map(({ k }) => k) : []);

function startQuarter(g: PartyGame) {
  g.news = [];
  for (const due of g.pending.filter((p) => p.due === g.quarter)) {
    const pol = findPolicy(due.policy)!;
    const e = scaled(pol.later, pol.kind !== 'sound' ? BILL_SCALE : 1);
    const effect = { p: e.p ? e.p + int(g.rng, -2, 2) : 0, l: e.l ? e.l + int(g.rng, -1, 1) : 0 };
    apply(g, effect);
    g.news.push({ text: pol.outcome, effect, policy: pol.id, proposer: due.proposer, good: pol.kind === 'sound' });
  }
  g.pending = g.pending.filter((p) => p.due !== g.quarter);
  const sneaky = activePlayers(g).filter(({ p }) => p.impostor).length;
  if (g.quarter > 1 && sneaky) {
    const effect = scaled(PARTY_SNEAK, sneaky);
    apply(g, effect);
    const lines = SNEAK_NEWS[g.mode];
    g.news.push({ text: lines[int(g.rng, 0, lines.length - 1)].replace('{n}', String(sneaky * 40 + int(g.rng, 1, 39))), effect, good: false });
  }
  const crisis = partyCrisis(g);
  const hit = scaled(crisis.hit, HIT_SCALE);
  apply(g, hit);
  g.news.push({ text: `${crisis.emoji} ${crisis.title}: ${crisis.text}`, effect: hit });
  g.proposals = [];
  g.votes = {};
  g.lastVote = null;
  // Deal everyone but the Chair two different policies from the crisis's six (a fresh deck when it runs out).
  g.hands = {};
  let deck: string[] = [];
  for (const { i } of proposers(g)) {
    const hand: string[] = [];
    while (hand.length < HAND) {
      if (!deck.length) deck = shuffleInPlace(g.rng, crisis.policies.map((p) => p.id));
      const card = deck.pop()!;
      if (!hand.includes(card)) hand.push(card);
    }
    g.hands[i] = hand;
  }
  g.phase = 'briefing';
  checkEnd(g);
}

export function beginProposals(g: PartyGame) {
  if (g.phase !== 'briefing') return;
  g.phase = 'propose';
  g.turn = nextProposer(g, -1);
}

/** The player whose turn it is proposes one of their two policies. */
export function propose(g: PartyGame, policy: string): boolean {
  if (g.phase !== 'propose' || g.turn === g.chair || !g.hands[g.turn]?.includes(policy)) return false;
  g.proposals.push({ player: g.turn, policy });
  const n = nextProposer(g, g.turn);
  if (n === -1) g.phase = 'table';
  else g.turn = n;
  return true;
}

/** The Chair enacts one of the proposals (never their own: they don't propose). */
export function chairEnacts(g: PartyGame, proposalIndex: number): boolean {
  const prop = g.proposals[proposalIndex];
  if (g.phase !== 'table' || !prop || prop.player === g.chair) return false;
  const pol = findPolicy(prop.policy)!;
  apply(g, pol.now);
  g.pending.push({ policy: prop.policy, due: g.quarter + pol.later.in, proposer: prop.player });
  g.enacted.push({ quarter: g.quarter, policy: prop.policy, proposer: prop.player });
  g.phase = 'result';
  checkEnd(g);
  return true;
}

/** Call a firing vote: everyone still in votes in secret. */
export function callVote(g: PartyGame) {
  if (g.phase !== 'result') return;
  g.phase = 'vote';
  g.votes = {};
  g.turn = firstActive(g);
}

/** The player whose turn it is votes to fire someone (or nobody: -1). You can't vote for yourself. */
export function castVote(g: PartyGame, target: number): boolean {
  if (g.phase !== 'vote' || target === g.turn) return false;
  if (target !== -1 && (!g.players[target] || g.players[target].fired)) return false;
  g.votes[g.turn] = target;
  const n = nextActive(g, g.turn, false);
  if (n !== -1) {
    g.turn = n;
    return true;
  }
  // Everyone's voted: a strict majority of the table fires someone.
  const tally: Record<number, number> = {};
  for (const t of Object.values(g.votes)) tally[t] = (tally[t] ?? 0) + 1;
  const voters = Object.keys(g.votes).length;
  const top = Object.entries(tally)
    .map(([t, n]) => [Number(t), n] as const)
    .sort((a, b) => b[1] - a[1])[0];
  const fired = top && top[0] !== -1 && top[1] * 2 > voters ? top[0] : null;
  if (fired !== null) g.players[fired].fired = true;
  g.lastVote = { fired, tally };
  g.phase = 'voted';
  checkEnd(g);
  return true;
}

/** On to the next quarter, with the next Chair (or the end of the term). */
export function nextPartyQuarter(g: PartyGame) {
  if (g.phase !== 'result' && g.phase !== 'voted') return;
  if (g.quarter >= QUARTERS) return end(g, 'term');
  g.quarter++;
  g.chair = nextActive(g, g.chair, true);
  startQuarter(g);
}

function end(g: PartyGame, ending: PartyEnding) {
  g.ending = ending;
  g.phase = 'over';
}

function checkEnd(g: PartyGame) {
  if (g.ending) return;
  const here = activePlayers(g);
  const impostors = here.filter(({ p }) => p.impostor).length;
  if (g.prosperity <= 0) end(g, 'broke');
  else if (g.liberty <= 0) end(g, 'chained');
  else if (impostors === 0) end(g, 'purged');
  else if (impostors >= here.length - impostors) end(g, 'takeover');
  // A fired Chair hands over to the next player.
  else if (g.players[g.chair]?.fired) g.chair = nextActive(g, g.chair, true);
}
