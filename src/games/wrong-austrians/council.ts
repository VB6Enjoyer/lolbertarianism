// The game: you're Ancapball, two years in office, with a council of five economists. Two of them
// aren't Austrian School economists at all: they're just from Austria, and they want the state to
// grow. Each quarter brings a crisis; everyone proposes a fix; you question them, listen to them
// accuse each other, enact one proposal and maybe fire someone. Bad policy looks good now and sends
// the bill later. Plain data, so a term saves and loads as JSON.
//
// Mirror mode turns it round: you're Austria, the loyal advisors are Viennese statists, and the two
// impostors are Austrian School ancaps who keep trying to privatize Vienna. Same rules; "sound"
// always means sound for whoever's in charge.

import { type Crisis, CRISES, crisisById, type Effect, type Policy, policyById, type PolicyKind } from './crises.ts';

import { MIRROR } from './mirror.ts';
import { int, makeRng, next, pickOne, type Rng, shuffleInPlace } from './rng.ts';
import { DODGES, type Face, FACES, FIRST_NAMES, type Hat, HATS, LINES, LINES_MIRROR, QUESTIONS, SNEAK_NEWS, SURNAMES } from './talk.ts';

export const QUARTERS = 8;
export const COUNCIL = 5;
export const IMPOSTORS = 2;
export const QUESTIONS_PER_QUARTER = 2;
/** How often an impostor backs something sound to blend in, and how often a loyal advisor gets it wrong. */
export const IMPOSTOR_BLEND = 0.45;
export const HONEST_SLIP = 0.15;
export const START_METER = 50;
export const METER_MAX = 100;
/** Crises cost more than their cards say, and bills land harder: being in charge is expensive. */
export const HIT_SCALE = 1.4;
export const BILL_SCALE = 1.2;
/**
 * What each impostor still on the council costs every quarter: a regulation slipped through (or, in
 * mirror mode, something quietly privatized, and the voters furious nobody asked them). The meters
 * are p and l: Prosperity and Liberty, or in mirror mode the State and Approval.
 */
export const SNEAK: Record<Mode, Effect> = { ancap: { p: -2, l: -5 }, mirror: { p: -2, l: -5 } };

/** Ancapball hiring the Austrian School, or Austria hiring Austrians. */
export type Mode = 'ancap' | 'mirror';

export type Mark = 'none' | 'trust' | 'suspect';

export interface Advisor {
  id: number;
  name: string;
  hat: Hat;
  face: Face;
  /** The secret: just from Austria, not of the Austrian School (or, in mirror mode, the other way round). */
  impostor: boolean;
  fired: boolean;
  /** You know what they are (fired, or background-checked). */
  revealed: boolean;
  /** Your own note on them. */
  mark: Mark;
}

/** A proposal on the table: a policy, and who backs it. */
export interface Proposal {
  policy: string;
  backers: number[];
}

/** Something said in the council: an accusation, a defence, or a shrug. */
export interface Talk {
  from: number;
  about: number | null;
  kind: 'accuse' | 'defend' | 'unsure';
  text: string;
}

export interface Answer {
  quarter: number;
  advisor: number;
  question: string;
  text: string;
  tone: 'sound' | 'slip' | 'dodge';
}

/** A policy's later effect, waiting to land. */
export interface Pending {
  policy: string;
  due: number;
  backers: number[];
  enacted: number;
}

/** What happened at the start of a quarter (bills and payoffs landing, the crisis's own cost). */
export interface News {
  text: string;
  effect: Effect;
  policy?: string;
  backers?: number[];
  /** Did it turn out well? */
  good?: boolean;
}

export interface Enacted {
  quarter: number;
  crisis: string;
  policy: string;
  backers: number[];
}

export type Phase = 'briefing' | 'council' | 'result' | 'over';
export type Ending = 'term' | 'purged' | 'broke' | 'chained' | 'takeover';

export interface Game {
  seed: number;
  mode: Mode;
  rng: Rng;
  /** 1 to QUARTERS. */
  quarter: number;
  phase: Phase;
  prosperity: number;
  liberty: number;
  advisors: Advisor[];
  /** The crises, one per quarter. */
  crises: string[];
  proposals: Proposal[];
  talk: Talk[];
  news: News[];
  pending: Pending[];
  answers: Answer[];
  /** Questions on offer this quarter, and how many you can still ask. */
  offered: string[];
  questionsLeft: number;
  firedThisQuarter: number | null;
  /** The one background check of the term. */
  checkUsed: boolean;
  enacted: Enacted[];
  /** Everything on the record, for the dossiers: what was proposed, said, and what landed. */
  tabled: (Proposal & { quarter: number })[];
  said: (Talk & { quarter: number })[];
  landed: (News & { quarter: number })[];
  /** Bills (and payoffs) that land after the term ends. */
  afterTerm: News[];
  ending: Ending | null;
  /** The daily term's date, if it is one. */
  daily: string | null;
}

// ---------------------------------------------------------------------------
// Setting up
// ---------------------------------------------------------------------------

export function newGame(seed: number, daily: string | null = null, mode: Mode = 'ancap'): Game {
  const rng = makeRng(seed);
  const firsts = shuffleInPlace(rng, [...FIRST_NAMES]);
  const lasts = shuffleInPlace(rng, [...SURNAMES]);
  const impostors = shuffleInPlace(rng, [...Array(COUNCIL).keys()]).slice(0, IMPOSTORS);
  const advisors: Advisor[] = Array.from({ length: COUNCIL }, (_, id) => ({
    id,
    name: `${firsts[id]} ${lasts[id]}`,
    hat: pickOne(rng, HATS),
    face: pickOne(rng, FACES),
    impostor: impostors.includes(id),
    fired: false,
    revealed: false,
    mark: 'none',
  }));
  const g: Game = {
    seed,
    mode,
    rng,
    quarter: 1,
    phase: 'briefing',
    prosperity: START_METER,
    liberty: START_METER,
    advisors,
    crises: shuffleInPlace(rng, CRISES.map((c) => c.id)).slice(0, QUARTERS),
    proposals: [],
    talk: [],
    news: [],
    pending: [],
    answers: [],
    offered: [],
    questionsLeft: QUESTIONS_PER_QUARTER,
    firedThisQuarter: null,
    checkUsed: false,
    enacted: [],
    tabled: [],
    said: [],
    landed: [],
    afterTerm: [],
    ending: null,
    daily,
  };
  startQuarter(g);
  return g;
}

export const active = (g: Game) => g.advisors.filter((a) => !a.fired);
/** Any policy, either side's. */
export function findPolicy(id: string): Policy | undefined {
  return policyById(id) ?? Object.values(MIRROR).flatMap((m) => m.policies).find((p) => p.id === id);
}

/** The quarter's crisis, as the side in charge sees it (its title, text and policies). */
export function crisisOf(g: Game, quarter = g.quarter): Crisis {
  const base = crisisById(g.crises[quarter - 1])!;
  if (g.mode !== 'mirror') return base;
  const m = MIRROR[base.id];
  return { ...base, title: m?.title ?? base.title, text: m?.text ?? base.text, policies: m?.policies ?? base.policies };
}

const linesFor = (g: Game) => (g.mode === 'mirror' ? LINES_MIRROR : LINES);
export const advisorName = (g: Game, id: number) => g.advisors[id]?.name ?? '?';
const clamp = (x: number) => Math.max(0, Math.min(METER_MAX, x));

function apply(g: Game, e: Effect) {
  g.prosperity = clamp(g.prosperity + (e.p ?? 0));
  g.liberty = clamp(g.liberty + (e.l ?? 0));
}

const isBad = (kind: PolicyKind) => kind !== 'sound';

// ---------------------------------------------------------------------------
// A quarter
// ---------------------------------------------------------------------------

/** The news lands, the crisis hits, everyone proposes and has their say. */
function startQuarter(g: Game) {
  g.news = [];
  for (const due of g.pending.filter((p) => p.due === g.quarter)) {
    const pol = findPolicy(due.policy)!;
    const effect = jitter(g, scaled(pol.later, pol.kind !== 'sound' ? BILL_SCALE : 1));
    apply(g, effect);
    g.news.push({ text: pol.outcome, effect, policy: pol.id, backers: due.backers, good: pol.kind === 'sound' });
    g.landed.push({ ...g.news[g.news.length - 1], quarter: g.quarter });
  }
  g.pending = g.pending.filter((p) => p.due !== g.quarter);
  // The impostors still on the council slip something through. Nobody signs it.
  const sneaky = active(g).filter((a) => a.impostor).length;
  if (g.quarter > 1 && sneaky) {
    const effect = scaled(SNEAK[g.mode], sneaky);
    apply(g, effect);
    g.news.push({ text: pickOne(g.rng, SNEAK_NEWS[g.mode]).replace('{n}', String(sneaky * 40 + int(g.rng, 1, 39))), effect, good: false });
  }
  const crisis = crisisOf(g);
  const hit = scaled(crisis.hit, HIT_SCALE);
  apply(g, hit);
  g.news.push({ text: `${crisis.emoji} ${crisis.title}: ${crisis.text}`, effect: hit });
  g.questionsLeft = QUESTIONS_PER_QUARTER;
  g.firedThisQuarter = null;
  g.offered = shuffleInPlace(g.rng, QUESTIONS.map((q) => q.id)).slice(0, 3);
  g.phase = 'briefing';
  if (checkEnd(g)) return;
  propose(g);
  debate(g);
}

const scaled = (e: Effect, k: number): Effect => ({ p: Math.round((e.p ?? 0) * k), l: Math.round((e.l ?? 0) * k) });

/** Later effects wobble a little: you can't read the future off a spreadsheet. */
function jitter(g: Game, e: Effect): Effect {
  return { p: e.p ? e.p + int(g.rng, -2, 2) : 0, l: e.l ? e.l + int(g.rng, -1, 1) : 0 };
}

/** Loyal advisors nearly always propose something sound; the impostors mostly dress up something else. */
function propose(g: Game) {
  const crisis = crisisOf(g);
  const of = (kind: PolicyKind) => crisis.policies.filter((p) => p.kind === kind);
  const picks = new Map<string, number[]>();
  for (const a of active(g)) {
    const roll = next(g.rng);
    const kind: PolicyKind = a.impostor ? (roll < IMPOSTOR_BLEND ? 'sound' : roll < 0.92 ? 'disguised' : 'blatant') : roll < 1 - HONEST_SLIP ? 'sound' : 'disguised';
    const pol = pickOne(g.rng, of(kind));
    picks.set(pol.id, [...(picks.get(pol.id) ?? []), a.id]);
  }
  g.proposals = shuffleInPlace(g.rng, [...picks].map(([policy, backers]) => ({ policy, backers })));
  g.tabled.push(...g.proposals.map((p) => ({ ...p, backers: [...p.backers], quarter: g.quarter })));
}

/** What the loyal advisors (who know their side's economics) can hold against someone. */
export function evidence(g: Game, id: number): { score: number; backed?: string; bill?: string; slip?: boolean } {
  let score = 0;
  let backed: string | undefined;
  let bill: string | undefined;
  const now = g.proposals.find((p) => p.backers.includes(id));
  if (now && isBad(findPolicy(now.policy)!.kind)) {
    score += 3;
    backed = now.policy;
  }
  for (const n of [...g.news]) {
    if (n.backers?.includes(id) && n.good === false) {
      score += 2;
      bill = n.policy;
    }
  }
  for (const e of g.enacted) {
    if (e.quarter < g.quarter && e.backers.includes(id) && isBad(findPolicy(e.policy)!.kind)) score += 1;
  }
  const slips = g.answers.filter((x) => x.advisor === id && x.tone === 'slip').length;
  score += 2 * slips;
  return { score, backed, bill, slip: slips > 0 };
}

const fill = (template: string, g: Game, about: number | null, policy?: string) =>
  template.replace(/\{x\}/g, about === null ? 'someone' : advisorName(g, about)).replace(/\{p\}/g, policy ? findPolicy(policy)!.title : 'that');

/** Everyone has their say: the loyal ones accuse on the evidence; the impostors frame them and cover for each other. */
function debate(g: Game) {
  const LINES = linesFor(g);
  const talk: Talk[] = [];
  const here = active(g);
  for (const a of here.filter((x) => !x.impostor)) {
    // Each of them notices some of the evidence, not all of it.
    const others = here.filter((x) => x.id !== a.id).map((x) => ({ x, ev: evidence(g, x.id), seen: 0 }));
    for (const o of others) o.seen = o.ev.score * (next(g.rng) < 0.7 ? 1 : 0) + next(g.rng) * 1.5;
    others.sort((p, q) => q.seen - p.seen);
    const top = others[0];
    if (top && top.ev.score >= 2 && top.seen >= 2 && next(g.rng) < 0.7) {
      const { ev } = top;
      const [lines, policy] = ev.backed ? [LINES.accuseBacked, ev.backed] : ev.bill ? [LINES.accuseBill, ev.bill] : [LINES.accuseSlip, undefined];
      talk.push({ from: a.id, about: top.x.id, kind: 'accuse', text: fill(pickOne(g.rng, lines), g, top.x.id, policy) });
    } else if (others.length && next(g.rng) < 0.5) {
      // Vouch for whoever looks cleanest (which may be an impostor keeping their head down).
      const clean = others[others.length - 1];
      talk.push({ from: a.id, about: clean.x.id, kind: 'defend', text: fill(pickOne(g.rng, LINES.vouch), g, clean.x.id) });
    } else {
      const about = others.length ? pickOne(g.rng, others).x.id : null;
      talk.push({ from: a.id, about, kind: 'unsure', text: fill(pickOne(g.rng, LINES.unsure), g, about) });
    }
  }
  // The impostors agree on whom to frame this quarter (usually).
  const reals0 = here.filter((x) => !x.impostor);
  const shared = reals0.length ? pickOne(g.rng, reals0).id : null;
  for (const a of here.filter((x) => x.impostor)) {
    const friends = here.filter((x) => x.impostor && x.id !== a.id);
    const reals = here.filter((x) => !x.impostor);
    const friendInTrouble = friends.find((f) => talk.some((t) => t.kind === 'accuse' && t.about === f.id));
    if (friendInTrouble && next(g.rng) < 0.6) {
      const policy = g.proposals.find((p) => p.backers.includes(friendInTrouble.id))?.policy;
      talk.push({ from: a.id, about: friendInTrouble.id, kind: 'defend', text: fill(pickOne(g.rng, LINES.defendFriend), g, friendInTrouble.id, policy) });
      continue;
    }
    if (!reals.length) continue;
    // Go after whoever accused them (or a friend); otherwise anyone real.
    const accusers = reals.filter((r) => talk.some((t) => t.from === r.id && t.kind === 'accuse' && (t.about === a.id || friends.some((f) => f.id === t.about))));
    const target = accusers.length && next(g.rng) < 0.5 ? pickOne(g.rng, accusers) : shared !== null && next(g.rng) < 0.7 ? g.advisors[shared] : pickOne(g.rng, reals);
    talk.push({ from: a.id, about: target.id, kind: 'accuse', text: fill(pickOne(g.rng, LINES.frame), g, target.id) });
  }
  g.talk = shuffleInPlace(g.rng, talk);
  g.said.push(...g.talk.map((t) => ({ ...t, quarter: g.quarter })));
}

export function beginCouncil(g: Game) {
  if (g.phase === 'briefing') g.phase = 'council';
}

/** Ask an advisor one of the questions on offer. Each pair only once. */
export function ask(g: Game, advisor: number, question: string): Answer | null {
  const a = g.advisors[advisor];
  const q = QUESTIONS.find((x) => x.id === question);
  if (g.phase !== 'council' || !a || a.fired || !q || g.questionsLeft <= 0 || !g.offered.includes(question)) return null;
  if (g.answers.some((x) => x.advisor === advisor && x.question === question)) return null;
  const roll = next(g.rng);
  const tone: Answer['tone'] = a.impostor ? (roll < 0.5 ? 'sound' : roll < 0.73 ? 'dodge' : 'slip') : roll < 0.87 ? 'sound' : 'dodge';
  // "Sound" means sound for whoever's in charge: in mirror mode, the statist answer.
  const [loyal, slips] = g.mode === 'mirror' ? [q.slips, q.sound] : [q.sound, q.slips];
  const text = tone === 'sound' ? pickOne(g.rng, loyal) : tone === 'slip' ? pickOne(g.rng, slips) : pickOne(g.rng, DODGES);
  const answer: Answer = { quarter: g.quarter, advisor, question, text, tone };
  g.answers.push(answer);
  g.questionsLeft--;
  return answer;
}

export const canFire = (g: Game) => g.phase === 'council' && g.firedThisQuarter === null;

/** Fire an advisor (one a quarter). Everyone finds out what they were. */
export function fire(g: Game, id: number): boolean {
  const a = g.advisors[id];
  if (!canFire(g) || !a || a.fired) return false;
  a.fired = true;
  a.revealed = true;
  g.firedThisQuarter = id;
  // A loyal advisor leaves to write a book about your mistake; an impostor leaves quietly.
  if (a.impostor) apply(g, { l: 4 });
  else apply(g, { p: -6, l: -2 });
  // Their backing goes with them; a proposal nobody backs is gone, unless it's the last one.
  for (const p of g.proposals) p.backers = p.backers.filter((b) => b !== id);
  const left = g.proposals.filter((p) => p.backers.length);
  if (left.length) g.proposals = left;
  g.talk = g.talk.filter((t) => t.from !== id);
  checkEnd(g);
  return true;
}

/** The term's one background check: you learn what someone is. They don't know you looked. */
export function backgroundCheck(g: Game, id: number): boolean {
  const a = g.advisors[id];
  if (g.checkUsed || g.phase !== 'council' || !a || a.fired || a.revealed) return false;
  g.checkUsed = true;
  a.revealed = true;
  return true;
}

export function setMark(g: Game, id: number, mark: Mark) {
  if (g.advisors[id]) g.advisors[id].mark = mark;
}

/** Enact one of the proposals: its effect now, its bill (or payoff) later. */
export function enact(g: Game, policy: string): boolean {
  const prop = g.proposals.find((p) => p.policy === policy);
  if (g.phase !== 'council' || !prop) return false;
  const pol = findPolicy(policy)!;
  apply(g, pol.now);
  g.pending.push({ policy, due: g.quarter + pol.later.in, backers: [...prop.backers], enacted: g.quarter });
  g.enacted.push({ quarter: g.quarter, crisis: g.crises[g.quarter - 1], policy, backers: [...prop.backers] });
  g.phase = 'result';
  checkEnd(g);
  return true;
}

/** On to the next quarter (or the end of the term). */
export function nextQuarter(g: Game) {
  if (g.phase !== 'result') return;
  if (g.quarter >= QUARTERS) return endTerm(g, 'term');
  g.quarter++;
  startQuarter(g);
}

/** Whatever's still pending lands after you leave office (it counts for the score). */
function endTerm(g: Game, ending: Ending) {
  g.ending = ending;
  g.phase = 'over';
  g.afterTerm = g.pending.map((due) => {
    const pol = findPolicy(due.policy)!;
    return { text: pol.outcome, effect: pol.later, policy: pol.id, backers: due.backers, good: pol.kind === 'sound' };
  });
  for (const n of g.afterTerm) apply(g, n.effect);
  g.pending = [];
}

/** Ends the term early if you're broke, in chains, outvoted, or done. */
function checkEnd(g: Game): boolean {
  if (g.ending) return true;
  const here = active(g);
  const impostors = here.filter((a) => a.impostor).length;
  const real = here.length - impostors;
  let ending: Ending | null = null;
  if (g.prosperity <= 0) ending = 'broke';
  else if (g.liberty <= 0) ending = 'chained';
  else if (impostors > real) ending = 'takeover';
  else if (impostors === 0) ending = 'purged';
  if (!ending) return false;
  // Lose mid-quarter and nothing more lands; purge the council and the bills still come in.
  if (ending === 'purged') endTerm(g, ending);
  else {
    g.ending = ending;
    g.phase = 'over';
  }
  return true;
}

export const won = (g: Game) => g.ending === 'term' || g.ending === 'purged';

/** The score: what's left of the economy and your freedom, plus whom you fired (and whom you shouldn't have). */
export function score(g: Game): number {
  const fired = g.advisors.filter((a) => a.fired);
  const caught = fired.filter((a) => a.impostor).length;
  const wrong = fired.length - caught;
  const early = g.ending === 'purged' ? 15 * (QUARTERS - g.quarter) : 0;
  const base = won(g) ? 100 : 10 * (g.quarter - 1);
  return Math.max(0, Math.round(base + g.prosperity + g.liberty + 40 * caught - 25 * wrong + early));
}

export function policyOf(id: string): Policy {
  return findPolicy(id)!;
}
