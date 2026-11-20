// Online party mode, the game side: a room the host's browser runs. Players join a lobby, the host
// starts, and the party engine (party.ts) runs unchanged; moves that arrive in parallel over the
// network (everyone but the Chair proposing, everyone voting) are buffered and fed to it in seat order. Each
// device only ever gets the public table plus its own private view: roles, hands and votes never
// leave the host except to their owner. Plain data and pure functions, so it's testable without a
// network; the transport lives in net.ts.

import { findPolicy, type Mode } from './council.ts';
import {
  activePlayers, beginProposals, callVote, castVote, chairEnacts, fellowImpostors, MAX_PLAYERS, MIN_PLAYERS, newParty, nextPartyQuarter, type PartyEnding,
  type PartyGame, type PartyPhase, propose, roleSeen,
} from './party.ts';
import type { News } from './council.ts';

export interface Member {
  /** A random id the device keeps (so a refresh gets its seat back). */
  id: string;
  name: string;
  bot: boolean;
}

export interface Room {
  code: string;
  mode: Mode;
  /** Who's sitting at the table, in seat order (the game's player indices once it starts). */
  members: Member[];
  /** The host's own id (they may or may not have a seat). */
  hostId: string;
  game: PartyGame | null;
  /** Moves waiting for their turn: role cards seen, proposals and votes, by seat. */
  seen: number[];
  proposed: Record<number, string>;
  voted: Record<number, number>;
}

/** What a device can ask for. */
export type Intent =
  | { type: 'seen' }
  | { type: 'propose'; policy: string }
  | { type: 'vote'; target: number }
  | { type: 'deal' }
  | { type: 'enact'; index: number }
  | { type: 'callVote' }
  | { type: 'next' };

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const roomCode = (rand: () => number = Math.random) => Array.from({ length: 5 }, () => CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)]).join('');
export const validCode = (code: string) => new RegExp(`^[${CODE_LETTERS}]{5}$`).test(code);
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 16) || 'Someone';

const BOT_NAMES = ['Bot Böhm', 'Bot Menger', 'Bot Wieser', 'Bot Mises', 'Bot Hayek', 'Bot Kirzner', 'Bot Lachmann', 'Bot Huerta'];

export function newRoom(code: string, hostId: string, hostName: string | null, mode: Mode = 'ancap'): Room {
  return { code, mode, members: hostName === null ? [] : [{ id: hostId, name: cleanName(hostName), bot: false }], hostId, game: null, seen: [], proposed: {}, voted: {} };
}

export const seatOf = (r: Room, id: string) => r.members.findIndex((m) => m.id === id);

/** Join the lobby (or rename yourself). Once the game's started, only existing seats count. */
export function join(r: Room, id: string, name: string): boolean {
  const at = seatOf(r, id);
  if (at >= 0) {
    if (!r.game) r.members[at].name = cleanName(name);
    return true;
  }
  if (r.game || r.members.length >= MAX_PLAYERS) return false;
  r.members.push({ id, name: cleanName(name), bot: false });
  return true;
}

export function addBot(r: Room): boolean {
  if (r.game || r.members.length >= MAX_PLAYERS) return false;
  const used = new Set(r.members.map((m) => m.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${r.members.length + 1}`;
  r.members.push({ id: `bot-${name}`, name, bot: true });
  return true;
}

/** Take someone (or a bot) off the lobby. The host can't remove themselves this way. */
export function removeMember(r: Room, id: string): boolean {
  if (r.game || id === r.hostId) return false;
  const at = seatOf(r, id);
  if (at < 0) return false;
  r.members.splice(at, 1);
  return true;
}

export const canStart = (r: Room) => !r.game && r.members.length >= MIN_PLAYERS && r.members.length <= MAX_PLAYERS;

export function start(r: Room, seed: number): boolean {
  if (!canStart(r)) return false;
  r.game = newParty(seed, r.members.map((m) => m.name), r.mode);
  r.seen = [];
  r.proposed = {};
  r.voted = {};
  return true;
}

/** Back to the lobby with the same people (after a game, or to abandon one). */
export function backToLobby(r: Room) {
  r.game = null;
  r.seen = [];
  r.proposed = {};
  r.voted = {};
}

/** The Chair runs the shared steps; the host can always step in (say, if the Chair wanders off). */
const canChair = (r: Room, id: string) => !!r.game && (id === r.hostId || seatOf(r, id) === r.game.chair);

/** Someone's move. Returns whether it was accepted. */
export function act(r: Room, id: string, intent: Intent): boolean {
  const g = r.game;
  if (!g) return false;
  const seat = seatOf(r, id);
  const playing = seat >= 0 && !g.players[seat].fired;
  let ok = false;
  switch (intent.type) {
    case 'seen':
      if (g.phase === 'roles' && seat >= 0 && !r.seen.includes(seat)) {
        r.seen.push(seat);
        ok = true;
      }
      break;
    case 'propose':
      if (g.phase === 'propose' && playing && seat !== g.chair && r.proposed[seat] === undefined && g.hands[seat]?.includes(intent.policy)) {
        r.proposed[seat] = intent.policy;
        ok = true;
      }
      break;
    case 'vote':
      if (g.phase === 'vote' && playing && r.voted[seat] === undefined && intent.target !== seat && (intent.target === -1 || (g.players[intent.target] && !g.players[intent.target].fired))) {
        r.voted[seat] = intent.target;
        ok = true;
      }
      break;
    case 'deal':
      if (g.phase === 'briefing' && canChair(r, id)) {
        beginProposals(g);
        r.proposed = {};
        ok = true;
      }
      break;
    case 'enact':
      ok = g.phase === 'table' && canChair(r, id) && chairEnacts(g, intent.index);
      break;
    case 'callVote':
      if (g.phase === 'result' && canChair(r, id)) {
        callVote(g);
        r.voted = {};
        ok = true;
      }
      break;
    case 'next':
      if ((g.phase === 'result' || g.phase === 'voted') && canChair(r, id)) {
        nextPartyQuarter(g);
        ok = true;
      }
      break;
  }
  if (ok) flush(r);
  return ok;
}

/** Feeds the buffered moves to the engine, in the seat order it expects. */
function flush(r: Room) {
  const g = r.game!;
  for (let guard = 0; guard < 64; guard++) {
    if (g.phase === 'roles' && r.seen.includes(g.turn)) roleSeen(g);
    else if (g.phase === 'propose' && r.proposed[g.turn] !== undefined) propose(g, r.proposed[g.turn]);
    else if (g.phase === 'vote' && r.voted[g.turn] !== undefined) castVote(g, r.voted[g.turn]);
    else break;
  }
}

/** Whose move the table is waiting on (seat numbers). */
export function waitingOn(r: Room): number[] {
  const g = r.game;
  if (!g) return [];
  const here = activePlayers(g).map(({ i }) => i);
  switch (g.phase) {
    case 'roles':
      return g.players.map((_, i) => i).filter((i) => !r.seen.includes(i));
    case 'propose':
      return here.filter((i) => i !== g.chair && r.proposed[i] === undefined);
    case 'vote':
      return here.filter((i) => r.voted[i] === undefined);
    case 'briefing':
    case 'table':
    case 'result':
    case 'voted':
      return [g.chair];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// What each device sees
// ---------------------------------------------------------------------------

export interface PublicPlayer {
  name: string;
  bot: boolean;
  fired: boolean;
  /** Only once they're fired, or the game's over. */
  impostor: boolean | null;
  /** Their record: bills and payoffs that have landed from what they proposed. */
  good: number;
  bad: number;
}

export interface PublicView {
  code: string;
  mode: Mode;
  hostName: string | null;
  lobby: { name: string; bot: boolean; host: boolean }[];
  started: boolean;
  phase: PartyPhase | null;
  quarter: number;
  prosperity: number;
  liberty: number;
  chair: number;
  players: PublicPlayer[];
  impostors: number;
  news: (News & { proposer?: number })[];
  crisis: string | null;
  /** On the table (with names), once everyone's proposed. */
  proposals: { player: number; policy: string }[];
  lastEnacted: { policy: string; proposer: number } | null;
  lastVote: { fired: number | null; tally: Record<number, number> } | null;
  waiting: number[];
  ending: PartyEnding | null;
}

export function publicView(r: Room): PublicView {
  const g = r.game;
  const over = g?.phase === 'over';
  const host = r.members.find((m) => m.id === r.hostId);
  const base = {
    code: r.code,
    mode: r.mode,
    hostName: host?.name ?? null,
    lobby: r.members.map((m) => ({ name: m.name, bot: m.bot, host: m.id === r.hostId })),
    started: !!g,
  };
  if (!g) {
    return { ...base, phase: null, quarter: 0, prosperity: 0, liberty: 0, chair: 0, players: [], impostors: 0, news: [], crisis: null, proposals: [], lastEnacted: null, lastVote: null, waiting: [], ending: null };
  }
  const landed = (e: PartyGame['enacted'][number]) => e.quarter + findPolicy(e.policy)!.later.in <= g.quarter || over;
  const players: PublicPlayer[] = g.players.map((p, i) => {
    const mine = g.enacted.filter((e) => e.proposer === i && landed(e));
    return {
      name: p.name,
      bot: r.members[i]?.bot ?? false,
      fired: p.fired,
      impostor: p.fired || over ? p.impostor : null,
      good: mine.filter((e) => findPolicy(e.policy)!.kind === 'sound').length,
      bad: mine.filter((e) => findPolicy(e.policy)!.kind !== 'sound').length,
    };
  });
  const last = g.enacted[g.enacted.length - 1];
  const showTable = g.phase === 'table' || g.phase === 'result' || g.phase === 'vote' || g.phase === 'voted';
  return {
    ...base,
    phase: g.phase,
    quarter: g.quarter,
    prosperity: g.prosperity,
    liberty: g.liberty,
    chair: g.chair,
    players,
    impostors: g.players.filter((p) => p.impostor).length,
    news: g.news,
    crisis: g.crises[g.quarter - 1] ?? null,
    proposals: showTable ? g.proposals.map((p) => ({ ...p })) : [],
    lastEnacted: last && last.quarter === g.quarter ? { policy: last.policy, proposer: last.proposer } : null,
    lastVote: g.lastVote,
    waiting: waitingOn(r),
    ending: g.ending,
  };
}

export interface PrivateView {
  seat: number | null;
  impostor: boolean;
  /** Your fellow impostors' names (impostors only). */
  fellows: string[];
  seenRole: boolean;
  /** Your two policies, while you still have to propose. */
  hand: string[] | null;
  proposed: string | null;
  canVote: boolean;
  voted: number | null;
  /** You're the Chair (or the host standing in). */
  chairing: boolean;
}

export function privateView(r: Room, id: string): PrivateView {
  const g = r.game;
  const seat = seatOf(r, id);
  const none: PrivateView = { seat: seat >= 0 ? seat : null, impostor: false, fellows: [], seenRole: false, hand: null, proposed: null, canVote: false, voted: null, chairing: !!g && id === r.hostId };
  if (!g || seat < 0) return none;
  const me = g.players[seat];
  const proposedNow = r.proposed[seat] ?? g.proposals.find((p) => p.player === seat)?.policy ?? null;
  return {
    seat,
    impostor: me.impostor,
    fellows: fellowImpostors(g, seat).map((k) => g.players[k].name),
    seenRole: r.seen.includes(seat) || g.phase !== 'roles',
    hand: g.phase === 'propose' && !me.fired && proposedNow === null ? (g.hands[seat] ?? null) : null,
    proposed: g.phase === 'propose' || g.phase === 'table' ? proposedNow : null,
    canVote: g.phase === 'vote' && !me.fired && r.voted[seat] === undefined,
    voted: g.phase === 'vote' ? (r.voted[seat] ?? null) : null,
    chairing: g.chair === seat || id === r.hostId,
  };
}

// ---------------------------------------------------------------------------
// Bots, for empty seats (and for testing alone)
// ---------------------------------------------------------------------------

/**
 * What the bots want to do right now: see their roles, propose (the loyal ones go for sound
 * policy; impostors slip in something else most of the time), vote (the loyal ones against
 * whoever's bills went bad; impostors against a loyal player now and then), and, in the Chair,
 * deal, enact and move on.
 */
export function botMoves(r: Room, rand: () => number = Math.random): { id: string; intent: Intent }[] {
  const g = r.game;
  if (!g || g.phase === 'over') return [];
  const out: { id: string; intent: Intent }[] = [];
  const view = publicView(r);
  r.members.forEach((m, seat) => {
    if (!m.bot) return;
    const me = g.players[seat];
    if (g.phase === 'roles' && !r.seen.includes(seat)) out.push({ id: m.id, intent: { type: 'seen' } });
    if (me.fired) return;
    if (g.phase === 'propose' && seat !== g.chair && r.proposed[seat] === undefined && g.hands[seat]) {
      const hand = g.hands[seat];
      const sound = hand.filter((p) => findPolicy(p)!.kind === 'sound');
      const bad = hand.filter((p) => findPolicy(p)!.kind !== 'sound');
      const pick = me.impostor ? (bad.length && rand() < 0.7 ? bad[0] : hand[0]) : (sound[0] ?? hand[Math.floor(rand() * hand.length)]);
      out.push({ id: m.id, intent: { type: 'propose', policy: pick } });
    }
    if (g.phase === 'vote' && r.voted[seat] === undefined) {
      const others = activePlayers(g).filter(({ i }) => i !== seat);
      let target = -1;
      if (me.impostor) {
        const loyal = others.filter(({ p }) => !p.impostor);
        if (loyal.length && rand() < 0.4) target = loyal[Math.floor(rand() * loyal.length)].i;
      } else {
        const worst = others.map(({ i }) => ({ i, bad: view.players[i].bad - view.players[i].good })).sort((a, b) => b.bad - a.bad)[0];
        if (worst && worst.bad > 0) target = worst.i;
      }
      out.push({ id: m.id, intent: { type: 'vote', target } });
    }
    if (seat === g.chair) {
      if (g.phase === 'briefing') out.push({ id: m.id, intent: { type: 'deal' } });
      if (g.phase === 'table') {
        const scored = g.proposals.map((p, index) => ({ index, kind: findPolicy(p.policy)!.kind, record: view.players[p.player].bad - view.players[p.player].good }));
        const pick = me.impostor ? (scored.find((s) => s.kind !== 'sound') ?? scored[0]) : (scored.sort((a, b) => a.record - b.record)[0] ?? scored[0]);
        out.push({ id: m.id, intent: { type: 'enact', index: pick.index } });
      }
      if (g.phase === 'result') {
        const suspicious = view.players.some((p, i) => !p.fired && i !== seat && p.bad > p.good);
        out.push({ id: m.id, intent: { type: suspicious ? 'callVote' : 'next' } });
      }
      if (g.phase === 'voted') out.push({ id: m.id, intent: { type: 'next' } });
    }
  });
  return out;
}
