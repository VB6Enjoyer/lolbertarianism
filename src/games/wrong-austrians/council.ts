// The game: you're Ancapball, two years in office, with a council of five economists. Two of them
// aren't Austrian School economists at all: they're just from Austria, and they want the state to
// grow. Each quarter brings a crisis; everyone proposes a fix; you question them, listen to them
// accuse each other, enact one proposal and maybe fire someone. Bad policy looks good now and sends
// the bill later. Plain data, so a term saves and loads as JSON.
//
// Mirror mode turns it round: you're Austria, the loyal advisors are Viennese statists, and the two
// impostors are Austrian School ancaps who keep trying to privatize Vienna. Same rules; "sound"
// always means sound for whoever's in charge.

import { LEAN_ODDS, type Lean, TOOL_ORDER, type ToolId, TOOLS } from './clues.ts';
import { type Crisis, CRISES, crisisById, type Effect, type Policy, policyById, type PolicyKind } from './crises.ts';

import type { TwistId } from './daily.ts';
import { MIRROR } from './mirror.ts';
import { int, makeRng, next, pickOne, type Rng, shuffleInPlace } from './rng.ts';
import { DODGES, type Face, FACES, FIRST_NAMES, type Hat, HATS, LINES, LINES_MIRROR, QUESTIONS, SNEAK_NEWS, SURNAMES } from './talk.ts';

export const QUARTERS = 8;
export const COUNCIL = 5;
export const IMPOSTORS = 2;
export const QUESTIONS_PER_QUARTER = 3;
/** Questions on offer each quarter (you pick from these). */
export const QUESTIONS_OFFERED = 4;
/** How often an impostor backs something sound to blend in, and how often a loyal advisor gets it wrong. */
export const IMPOSTOR_BLEND = 0.72;
export const HONEST_SLIP = 0.18;
/** Austrian labour law: nobody can be fired in their first quarters. (Ironic, we know.) */
export const FIRING_FROM = 3;
/** What firing costs: a loyal advisor writes a book about your mistake; an impostor leaves quietly. */
export const FIRE_LOYAL: Effect = { p: -8, l: -4 };
export const FIRE_IMPOSTOR: Effect = { l: 4 };

/**
 * How each side answers interview questions. "sound" is the right answer for whoever's in charge;
 * "near" sounds right but isn't (pro-market but not Austrian, in the ancap game); "slip" is the other
 * side's answer outright. The impostors get it right half the time; the loyal ones a fifth wrong.
 */
export type Tone = 'sound' | 'near' | 'slip' | 'dodge';
export const ANSWER_ODDS: Record<'normal' | 'loose-lips' | 'poker-face', Record<'loyal' | 'impostor', Record<Tone, number>>> = {
  normal: { loyal: { sound: 0.75, near: 0.2, slip: 0, dodge: 0.05 }, impostor: { sound: 0.5, near: 0.36, slip: 0.06, dodge: 0.08 } },
  'loose-lips': { loyal: { sound: 0.75, near: 0.2, slip: 0, dodge: 0.05 }, impostor: { sound: 0.4, near: 0.3, slip: 0.22, dodge: 0.08 } },
  'poker-face': { loyal: { sound: 0.75, near: 0.2, slip: 0, dodge: 0.05 }, impostor: { sound: 0.5, near: 0.25, slip: 0, dodge: 0.25 } },
};
export const answerOdds = (g: Pick<Game, 'twist'>) => ANSWER_ODDS[g.twist === 'loose-lips' || g.twist === 'poker-face' ? g.twist : 'normal'];
/** How each side's proposals go: the impostors back sound policy more often than not, to blend in. */
export const PROPOSAL_ODDS: Record<'loyal' | 'impostor', Record<PolicyKind, number>> = {
  loyal: { sound: 1 - HONEST_SLIP, disguised: HONEST_SLIP, blatant: 0 },
  impostor: { sound: IMPOSTOR_BLEND, disguised: 0.25, blatant: 0.03 },
};

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export type DifficultyId = 'normal' | 'hard' | 'expert';

export interface Difficulty {
  id: DifficultyId;
  icon: string;
  name: string;
  /** What's different, in a line, for the picker. */
  blurb: string;
  council: number;
  /** How many impostors, and how likely each count is (one count = it's known). */
  impostors: Partial<Record<1 | 2 | 3, number>>;
  questionsPer: number;
  /** A cap on questions for the whole term (null: none). */
  questionBudget: number | null;
  /** Who backs what stays secret until a policy is enacted. */
  anonymous: boolean;
  /**
   * One impostor in deep cover: how often they answer right and back sound policy. Hard and
   * Expert also make the rest go quiet for a while after one of them is fired, and copy whoever
   * you trust.
   */
  sleeper: { sound: number; policy: number } | null;
  /** The easy near-misses (misspelled names and the like) still turn up. */
  easyNearMisses: boolean;
  /** A newspaper rumour each quarter, true or not. */
  rumours: boolean;
  /** What an investigation costs, how many a quarter, and how often each tool can be used. */
  investigationCost: Effect | null;
  investigationsPer: number;
  toolUses: number;
  /** The impostors' unsigned regulations make the news (and so say how many are left). */
  sneakNews: boolean;
  /** The closing verdict must be exactly right, or you lose. */
  verdictExact: boolean;
  /** Points are worth more on harder levels. */
  scoreScale: number;
  /**
   * Where the meters start, and how hard the impostors' quiet regulations bite: with no early win
   * they run all term, and the harder levels shouldn't be lost to attrition, only to being fooled.
   */
  start: number;
  sneakScale: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  normal: {
    id: 'normal', icon: '🦅', name: 'Normal', blurb: 'Two impostors among five. You see who backs what, and 3 questions a quarter.',
    council: 5, impostors: { 2: 1 }, questionsPer: 3, questionBudget: null, anonymous: false, sleeper: null, easyNearMisses: true, rumours: false, investigationCost: null, investigationsPer: 1, toolUses: 1,
    sneakNews: true, verdictExact: false, scoreScale: 1, start: 50, sneakScale: 1,
  },
  hard: {
    id: 'hard', icon: '🕵️', name: 'Hard', blurb: 'Proposals are anonymous until enacted, 2 questions a quarter, one impostor in deep cover, rumours, and only the technical slips.',
    council: 5, impostors: { 2: 1 }, questionsPer: 2, questionBudget: null, anonymous: true, sleeper: { sound: 0.6, policy: 0.8 }, easyNearMisses: false, rumours: true,
    investigationCost: { p: -1 }, investigationsPer: 1, toolUses: 1, sneakNews: false, verdictExact: false, scoreScale: 1.3, start: 55, sneakScale: 1,
  },
  expert: {
    id: 'expert', icon: '🧠', name: 'Expert', blurb: 'One to three impostors among six (you’re not told how many), 10 questions for the whole term, and the closing verdict must be exactly right.',
    council: 6, impostors: { 1: 1, 2: 2, 3: 1.4 }, questionsPer: 2, questionBudget: 10, anonymous: true, sleeper: { sound: 0.75, policy: 0.9 }, easyNearMisses: false,
    rumours: true, investigationCost: { p: -2 }, investigationsPer: 2, toolUses: 2, sneakNews: false, verdictExact: true, scoreScale: 1.6, start: 62, sneakScale: 0.6,
  },
};
export const DIFFICULTY_ORDER: DifficultyId[] = ['normal', 'hard', 'expert'];
export const difficultyOf = (g: Pick<Game, 'difficulty'>) => DIFFICULTIES[g.difficulty ?? 'normal'];
/** "2", or "one to three" when you aren't told. */
export function impostorText(d: Difficulty): string {
  const counts = Object.keys(d.impostors).map(Number).sort();
  const words = ['none', 'one', 'two', 'three'];
  return counts.length === 1 ? String(counts[0]) : `${words[counts[0]]} to ${words[counts[counts.length - 1]]}`;
}
/** How long an impostor stays quiet after one of them is fired (Hard and Expert). */
export const QUIET_FOR = 2;
/** How often an impostor copies whoever you've marked as trusted (Hard and Expert). */
export const MIMIC = 0.35;
/** How often a rumour is true. */
export const RUMOUR_TRUE = 0.6;
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

/** One item of someone's hidden past, and which way it leans. */
export interface ProfileItem {
  lean: Lean;
  text: string;
}

export interface Advisor {
  id: number;
  name: string;
  hat: Hat;
  face: Face;
  /** Their past, item by item: what the investigations dig up. */
  profile: Record<ToolId, ProfileItem>;
  /** The secret: just from Austria, not of the Austrian School (or, in mirror mode, the other way round). */
  impostor: boolean;
  /** An impostor in deep cover (Hard and Expert). */
  sleeper?: boolean;
  fired: boolean;
  /** You know what they are (they've been fired). */
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
  tone: Tone;
  /** For a near-miss: what's wrong with it (shown in the case file at the end). */
  why?: string;
  /** Asked again in a later quarter: the same answer as before. */
  repeat?: boolean;
}

/** A newspaper rumour about someone's past: true, or not (you find out at the end). */
export interface Rumour {
  quarter: number;
  advisor: number;
  tool: ToolId;
  text: string;
  lean: Lean;
  true: boolean;
}

/** The closing verdict: who you named as statists, and how that went. */
export interface Verdict {
  named: number[];
  correct: number[];
  wrong: number[];
  missed: number[];
}

/** What an investigation turned up. */
export interface Clue {
  quarter: number;
  advisor: number;
  tool: ToolId;
  text: string;
  lean: Lean;
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

export type Phase = 'briefing' | 'council' | 'result' | 'verdict' | 'over';
/** 'purged' was the old early win (older saves may still have it); 'unclean' is a wrong Expert verdict. */
export type Ending = 'term' | 'purged' | 'broke' | 'chained' | 'takeover' | 'unclean';

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
  /** Investigations: how often each tool has been used, what turned up, and whether this quarter's are done (and how many are left). */
  toolsUsed: Partial<Record<ToolId, number>>;
  clues: Clue[];
  investigated: boolean;
  investigationsLeft: number;
  enacted: Enacted[];
  /** Everything on the record, for the dossiers: what was proposed, said, and what landed. */
  tabled: (Proposal & { quarter: number })[];
  said: (Talk & { quarter: number })[];
  landed: (News & { quarter: number })[];
  /** Bills (and payoffs) that land after the term ends. */
  afterTerm: News[];
  ending: Ending | null;
  /** The daily term's date and twist, if it is one. */
  daily: string | null;
  twist: TwistId | null;
  difficulty: DifficultyId;
  /** The impostors lie low until this quarter (after one of them is fired, on Hard and Expert). */
  quietUntil: number;
  rumours: Rumour[];
  verdict: Verdict | null;
}

// ---------------------------------------------------------------------------
// Setting up
// ---------------------------------------------------------------------------

export function newGame(seed: number, daily: string | null = null, mode: Mode = 'ancap', twist: TwistId | null = null, difficulty: DifficultyId = 'normal'): Game {
  const d = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  const rng = makeRng(seed);
  const firsts = shuffleInPlace(rng, [...FIRST_NAMES]);
  const lasts = shuffleInPlace(rng, [...SURNAMES]);
  const counts = Object.entries(d.impostors).map(([k, w]) => [Number(k), w!] as [number, number]);
  const count = counts.length === 1 ? counts[0][0] : weightedPick(rng, counts);
  const impostors = shuffleInPlace(rng, [...Array(d.council).keys()]).slice(0, count);
  // One impostor in deep cover (when there's more than one to hide behind).
  const sleeper = d.sleeper && impostors.length >= 2 ? impostors[0] : -1;
  const profiles = makeProfiles(rng, mode, impostors, d.council, sleeper);
  const advisors: Advisor[] = Array.from({ length: d.council }, (_, id) => ({
    id,
    name: `${firsts[id]} ${lasts[id]}`,
    hat: pickOne(rng, HATS),
    face: pickOne(rng, FACES),
    profile: profiles[id],
    impostor: impostors.includes(id),
    ...(id === sleeper ? { sleeper: true } : {}),
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
    prosperity: twist === 'lean-times' ? 40 : d.start,
    liberty: twist === 'lean-times' ? 40 : d.start,
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
    toolsUsed: {},
    clues: [],
    investigated: false,
    investigationsLeft: d.investigationsPer,
    enacted: [],
    tabled: [],
    said: [],
    landed: [],
    afterTerm: [],
    ending: null,
    daily,
    twist,
    difficulty: d.id,
    quietUntil: 0,
    rumours: [],
    verdict: null,
  };
  g.questionsLeft = questionsPer(g);
  startQuarter(g);
  return g;
}

/**
 * Everyone's hidden past: for each tool, a lean drawn from their side's odds, and an item with that
 * lean (no two people share one). In mirror mode the schools swap: the loyal ones are statists.
 */
export function makeProfiles(rng: Rng, mode: Mode, impostors: number[], council = COUNCIL, sleeper = -1): Record<ToolId, ProfileItem>[] {
  const [own, other]: Lean[] = mode === 'mirror' ? ['statist', 'austrian'] : ['austrian', 'statist'];
  const leanOf = { own, freemarket: 'freemarket', mainstream: 'mainstream', other } as const;
  const out: Record<ToolId, ProfileItem>[] = Array.from({ length: council }, () => ({}) as Record<ToolId, ProfileItem>);
  for (const tool of TOOL_ORDER) {
    const left: Record<Lean, string[]> = Object.fromEntries(Object.entries(TOOLS[tool].items).map(([k, v]) => [k, shuffleInPlace(rng, [...v])])) as Record<Lean, string[]>;
    for (let id = 0; id < council; id++) {
      const odds = LEAN_ODDS[id === sleeper ? 'sleeper' : impostors.includes(id) ? 'impostor' : 'loyal'];
      let roll = next(rng);
      let key: keyof typeof odds = 'own';
      for (const k of ['own', 'freemarket', 'mainstream', 'other'] as const) {
        key = k;
        if ((roll -= odds[k]) < 0) break;
      }
      const lean = leanOf[key];
      out[id][tool] = { lean, text: left[lean].pop() ?? TOOLS[tool].items[lean][0] };
    }
  }
  return out;
}

function weightedPick(rng: Rng, options: [number, number][]): number {
  let roll = next(rng) * options.reduce((t, [, w]) => t + w, 0);
  for (const [v, w] of options) if ((roll -= w) < 0) return v;
  return options[options.length - 1][0];
}

export const active = (g: Game) => g.advisors.filter((a) => !a.fired);

/** How someone behaves right now: loyal, an impostor, or an impostor lying low (the sleeper, or after a firing). */
export function behaviour(g: Game, a: Advisor): 'loyal' | 'impostor' | 'deep' {
  if (!a.impostor) return 'loyal';
  const d = difficultyOf(g);
  if (d.sleeper && (a.sleeper || g.quarter < g.quietUntil)) return 'deep';
  return 'impostor';
}

/** The interview odds for someone right now. */
export function answerOddsFor(g: Game, a: Advisor): Record<Tone, number> {
  const odds = answerOdds(g);
  const b = behaviour(g, a);
  if (b !== 'deep') return odds[b];
  const s = difficultyOf(g).sleeper!.sound;
  return { sound: s, near: Math.max(0, 0.95 - s), slip: 0, dodge: 0.05 };
}

/** The proposal odds for someone right now. */
export function proposalOddsFor(g: Game, a: Advisor): Record<PolicyKind, number> {
  const b = behaviour(g, a);
  if (b !== 'deep') return PROPOSAL_ODDS[b];
  const s = difficultyOf(g).sleeper!.policy;
  return { sound: s, disguised: 1 - s, blatant: 0 };
}

/** Whether you can see who backs a proposal (Hard and Expert: only once it's enacted). */
export const backersShown = (g: Game, quarter: number, policy: string) => !difficultyOf(g).anonymous || g.enacted.some((e) => e.quarter === quarter && e.policy === policy);

/** Questions left this term (Expert has a cap). */
export const budgetLeft = (g: Game) => {
  const cap = difficultyOf(g).questionBudget;
  return cap === null ? Infinity : Math.max(0, cap - g.answers.length);
};
/** How long the term is, how many questions a quarter, how often each investigation can be used (the daily twists change them). */
export const termLength = (g: Game) => (g.twist === 'snap-election' ? 6 : QUARTERS);
export const questionsPer = (g: Game) => {
  const per = difficultyOf(g).questionsPer + (g.twist === 'press-pass' ? 1 : 0);
  return Math.min(per, budgetLeft(g));
};
export const toolUses = (g: Game) => difficultyOf(g).toolUses + (g.twist === 'double-check' ? 1 : 0);
export const toolsLeft = (g: Game, tool: ToolId) => toolUses(g) - (g.toolsUsed[tool] ?? 0);
/** One investigation a quarter, with a tool that has uses left. */
export const canInvestigate = (g: Game, tool?: ToolId) => g.phase === 'council' && !g.investigated && (tool ? toolsLeft(g, tool) > 0 : TOOL_ORDER.some((t) => toolsLeft(g, t) > 0));
/** Any policy, either side's. */
export function findPolicy(id: string): Policy | undefined {
  return policyById(id) ?? Object.values(MIRROR).flatMap((m) => m.policies).find((p) => p.id === id);
}

/** A crisis as one side sees it (its title, text and policies). */
export function crisisFor(id: string, mode: Mode): Crisis {
  const base = crisisById(id)!;
  if (mode !== 'mirror') return base;
  const m = MIRROR[base.id];
  return { ...base, title: m?.title ?? base.title, text: m?.text ?? base.text, policies: m?.policies ?? base.policies };
}

/** The quarter's crisis, as the side in charge sees it. */
export const crisisOf = (g: Game, quarter = g.quarter): Crisis => crisisFor(g.crises[quarter - 1], g.mode);

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
  // The impostors still on the council slip something through. Nobody signs it. On Normal it makes
  // the news (which says roughly how many are left); on Hard and Expert it's folded into the
  // crisis's cost, which wobbles, so you can't count them off the meters.
  const d = difficultyOf(g);
  const sneaky = active(g).filter((a) => a.impostor).length;
  const sneak = g.quarter > 1 && sneaky ? scaled(SNEAK[g.mode], sneaky * d.sneakScale) : { p: 0, l: 0 };
  if (d.sneakNews && sneaky && g.quarter > 1) {
    apply(g, sneak);
    g.news.push({ text: pickOne(g.rng, SNEAK_NEWS[g.mode]).replace('{n}', String(sneaky * 40 + int(g.rng, 1, 39))), effect: sneak, good: false });
  }
  const crisis = crisisOf(g);
  const base = scaled(crisis.hit, HIT_SCALE);
  const hit = d.sneakNews ? base : { p: (base.p ?? 0) + (sneak.p ?? 0) + int(g.rng, -3, 3), l: (base.l ?? 0) + (sneak.l ?? 0) + int(g.rng, -3, 3) };
  apply(g, hit);
  g.news.push({ text: `${crisis.emoji} ${crisis.title}: ${crisis.text}`, effect: hit });
  if (d.rumours && g.quarter > 1) rumour(g);
  g.questionsLeft = questionsPer(g);
  g.firedThisQuarter = null;
  g.investigated = false;
  g.investigationsLeft = d.investigationsPer;
  // Fresh questions: ones not asked yet this term, while there are any.
  const asked = new Set(g.answers.map((a) => a.question));
  const fresh = QUESTIONS.filter((q) => !asked.has(q.id)).map((q) => q.id);
  const pool = fresh.length >= QUESTIONS_OFFERED ? fresh : QUESTIONS.map((q) => q.id);
  g.offered = shuffleInPlace(g.rng, pool).slice(0, QUESTIONS_OFFERED);
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

/** A rumour in the papers about someone still on the council: their real past, or not. */
function rumour(g: Game) {
  const who = active(g).filter((a) => !a.revealed);
  if (!who.length) return;
  // A fresh story: never the same person and subject twice.
  const pairs = who.flatMap((a) => TOOL_ORDER.filter((t) => !g.rumours.some((r) => r.advisor === a.id && r.tool === t)).map((t) => [a, t] as const));
  if (!pairs.length) return;
  const [a, tool] = pickOne(g.rng, pairs);
  const real = a.profile[tool];
  const truth = next(g.rng) < RUMOUR_TRUE;
  const lean: Lean = truth ? real.lean : pickOne(g.rng, ['austrian', 'freemarket', 'mainstream', 'statist'] as Lean[]);
  const text = truth ? real.text : pickOne(g.rng, TOOLS[tool].items[lean]);
  // A made-up story can land on the truth by accident.
  g.rumours.push({ quarter: g.quarter, advisor: a.id, tool, text, lean, true: truth || text === real.text });
}

/**
 * Loyal advisors nearly always propose something sound; the impostors mostly dress up something
 * else. On Hard and Expert, an impostor sometimes backs whatever someone you trust backs, to look
 * like them.
 */
function propose(g: Game) {
  const crisis = crisisOf(g);
  const of = (kind: PolicyKind) => crisis.policies.filter((p) => p.kind === kind);
  const picks = new Map<string, number[]>();
  const choice = new Map<number, string>();
  const order = [...active(g)].sort((a, b) => Number(a.impostor) - Number(b.impostor));
  for (const a of order) {
    const trusted = active(g).find((x) => x.mark === 'trust' && !x.impostor && choice.has(x.id));
    let policy: string;
    if (a.impostor && difficultyOf(g).sleeper && trusted && next(g.rng) < MIMIC) policy = choice.get(trusted.id)!;
    else {
      const odds = proposalOddsFor(g, a);
      const roll = next(g.rng);
      const kind: PolicyKind = roll < odds.sound ? 'sound' : roll < odds.sound + odds.disguised ? 'disguised' : 'blatant';
      policy = pickOne(g.rng, of(kind)).id;
    }
    choice.set(a.id, policy);
    picks.set(policy, [...(picks.get(policy) ?? []), a.id]);
  }
  g.proposals = shuffleInPlace(g.rng, [...picks].map(([policy, backers]) => ({ policy, backers })));
  g.tabled.push(...g.proposals.map((p) => ({ ...p, backers: [...p.backers], quarter: g.quarter })));
}

/** One thing that could be held against someone, as an advisor would put it in the debate. */
export interface Evidence {
  kind: 'answer' | 'clue' | 'rumour' | 'backed' | 'bill';
  weight: number;
  /** The question, the clue's item, or the policy. */
  q?: string;
  item?: string;
  tool?: ToolId;
  policy?: string;
}

/**
 * Everything on the record against someone that the council (and you) can see: their fumbled
 * answers, the clues and rumours that point the wrong way, the bills from what they backed, and
 * (on Normal) a statist policy they're backing right now. Real Austrians have some of this too: a
 * near-miss, a Chicago degree, an unlucky bill.
 */
export function evidenceOn(g: Game, id: number): Evidence[] {
  const out: Evidence[] = [];
  const bad: Lean = g.mode === 'mirror' ? 'austrian' : 'statist';
  for (const a of g.answers) {
    if (a.advisor !== id || a.repeat) continue;
    if (a.tone === 'near' || a.tone === 'slip') out.push({ kind: 'answer', weight: a.tone === 'slip' ? 3 : 1.5, q: QUESTIONS.find((x) => x.id === a.question)!.q });
  }
  for (const c of g.clues) if (c.advisor === id && (c.lean === bad || c.lean === 'freemarket')) out.push({ kind: 'clue', weight: c.lean === bad ? 2 : 1, item: c.text, tool: c.tool });
  for (const r of g.rumours) if (r.advisor === id && (r.lean === bad || r.lean === 'freemarket')) out.push({ kind: 'rumour', weight: 0.8, item: r.text, tool: r.tool });
  for (const n of g.landed) if (n.backers?.includes(id) && n.good === false && n.policy) out.push({ kind: 'bill', weight: 2, policy: n.policy });
  if (!difficultyOf(g).anonymous) {
    const now = g.proposals.find((p) => p.backers.includes(id));
    if (now && isBad(findPolicy(now.policy)!.kind)) out.push({ kind: 'backed', weight: 2.5, policy: now.policy });
  }
  return out;
}
const weightOf = (ev: Evidence[]) => ev.reduce((t, e) => t + e.weight, 0);

/** The council's words for a piece of evidence. Everyone uses the same lines, so the wording gives nobody away. */
function accusation(g: Game, about: number, ev: Evidence | null): string {
  const L = linesFor(g);
  const name = advisorName(g, about);
  const fill = (tpl: string) =>
    tpl
      .replace(/\{x\}/g, name)
      .replace(/\{q\}/g, ev?.q ?? '')
      .replace(/\{item\}/g, (ev?.item ?? '').replace(/^“|”$/g, ''))
      .replace(/\{tool\}/g, ev?.tool ? TOOLS[ev.tool].name.toLowerCase() : '')
      .replace(/\{p\}/g, ev?.policy ? findPolicy(ev.policy)!.title : '');
  if (!ev) return fill(pickOne(g.rng, L.hunch));
  const lines = ev.kind === 'answer' ? L.accuseAnswer : ev.kind === 'clue' ? L.accuseClue : ev.kind === 'rumour' ? L.accuseRumour : ev.kind === 'bill' ? L.accuseBill : L.accuseBacked;
  return fill(pickOne(g.rng, lines));
}

/** Kept for older callers and tests: how much the record holds against someone. */
export function evidence(g: Game, id: number): { score: number } {
  return { score: weightOf(evidenceOn(g, id)) };
}

/**
 * Everyone has their say, from the same record, in the same words. The loyal ones go after whoever
 * looks worst to them (sometimes another loyal one, in good faith); the impostors go after loyal
 * ones, picking on their honest fumbles, and only rarely stick up for each other.
 */
function debate(g: Game) {
  const L = linesFor(g);
  const talk: Talk[] = [];
  const here = active(g);
  for (const a of here) {
    const others = here.filter((x) => x.id !== a.id);
    if (!others.length) continue;
    // Who they'd go after: the loyal look at everyone; the impostors at the loyal ones only.
    const pool = a.impostor ? others.filter((x) => !x.impostor) : others;
    const scored = (pool.length ? pool : others).map((x) => ({ x, ev: evidenceOn(g, x.id), seen: 0 }));
    for (const o of scored) o.seen = weightOf(o.ev) * (next(g.rng) < 0.65 ? 1 : 0.3) + next(g.rng) * 2;
    scored.sort((p, q) => q.seen - p.seen);
    const top = scored[0];
    const roll = next(g.rng);
    if (roll < 0.6) {
      const ev = top.ev.length ? [...top.ev].sort((p, q) => q.weight - p.weight)[Math.floor(next(g.rng) * Math.min(2, top.ev.length))] : null;
      talk.push({ from: a.id, about: top.x.id, kind: 'accuse', text: accusation(g, top.x.id, ev) });
    } else if (roll < 0.82) {
      // Vouch: the loyal for whoever looks cleanest; an impostor for a loyal one (cover), or now and then a friend.
      const friends = others.filter((x) => x.impostor);
      const clean = a.impostor
        ? friends.length && next(g.rng) < 0.15
          ? pickOne(g.rng, friends)
          : pickOne(g.rng, pool.length ? pool : others)
        : [...others].sort((p, q) => weightOf(evidenceOn(g, p.id)) - weightOf(evidenceOn(g, q.id)))[0];
      talk.push({ from: a.id, about: clean.id, kind: 'defend', text: pickOne(g.rng, L.vouch).replace(/\{x\}/g, clean.name) });
    } else talk.push({ from: a.id, about: null, kind: 'unsure', text: pickOne(g.rng, L.unsure) });
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
  // Once a quarter per person and question.
  if (g.answers.some((x) => x.advisor === advisor && x.question === question && x.quarter === g.quarter)) return null;
  // Asked before, in an earlier quarter: they stick to their story (a bluff that worked stays a bluff).
  // Only a dodge gets a real answer the second time: they got back to you after lunch.
  const before = g.answers.find((x) => x.advisor === advisor && x.question === question && x.tone !== 'dodge');
  if (before) {
    const again: Answer = { ...before, quarter: g.quarter, repeat: true };
    g.answers.push(again);
    g.questionsLeft--;
    return again;
  }
  const dodgedBefore = g.answers.some((x) => x.advisor === advisor && x.question === question);
  const base = answerOddsFor(g, a);
  const odds = dodgedBefore ? { ...base, dodge: 0 } : base;
  let roll = next(g.rng) * (odds.sound + odds.near + odds.slip + odds.dodge);
  let tone: Tone = 'dodge';
  for (const k of ['sound', 'near', 'slip', 'dodge'] as const) {
    tone = k;
    if ((roll -= odds[k]) < 0) break;
  }
  // "Sound" means sound for whoever's in charge: in mirror mode, the statist answer. The near-misses
  // (free-market, not Austrian) give an ancap away in Vienna just as they give a statist away here.
  const [loyal, slips] = g.mode === 'mirror' ? [q.slips, q.sound] : [q.sound, q.slips];
  // On Hard and Expert, only the technical near-misses: no misspelled names to give anyone away.
  const nearPool = difficultyOf(g).easyNearMisses ? q.near : q.near.filter((x) => x.hard);
  const near = tone === 'near' ? pickOne(g.rng, nearPool.length ? nearPool : q.near) : null;
  const text = tone === 'sound' ? pickOne(g.rng, loyal) : tone === 'slip' ? pickOne(g.rng, slips) : near ? near.text : pickOne(g.rng, DODGES);
  const answer: Answer = { quarter: g.quarter, advisor, question, text, tone, ...(near ? { why: near.why } : {}) };
  g.answers.push(answer);
  g.questionsLeft--;
  return answer;
}

export const canFire = (g: Game) => g.phase === 'council' && g.firedThisQuarter === null && g.quarter >= FIRING_FROM;

/** Fire an advisor (one a quarter). Everyone finds out what they were. */
export function fire(g: Game, id: number): boolean {
  const a = g.advisors[id];
  if (!canFire(g) || !a || a.fired) return false;
  a.fired = true;
  a.revealed = true;
  g.firedThisQuarter = id;
  // A loyal advisor leaves to write a book about your mistake; an impostor leaves quietly, and on
  // Hard and Expert the others lie low for a while.
  apply(g, a.impostor ? FIRE_IMPOSTOR : FIRE_LOYAL);
  if (a.impostor) g.quietUntil = g.quarter + 1 + QUIET_FOR;
  // Their backing goes with them; a proposal nobody backs is gone, unless it's the last one.
  for (const p of g.proposals) p.backers = p.backers.filter((b) => b !== id);
  const left = g.proposals.filter((p) => p.backers.length);
  if (left.length) g.proposals = left;
  g.talk = g.talk.filter((t) => t.from !== id);
  checkEnd(g);
  return true;
}

/** This quarter's investigation: one tool, on one advisor. They don't know you looked. */
export function investigate(g: Game, tool: ToolId, id: number): Clue | null {
  const a = g.advisors[id];
  if (!canInvestigate(g, tool) || !a || a.fired) return null;
  g.toolsUsed[tool] = (g.toolsUsed[tool] ?? 0) + 1;
  g.investigationsLeft = Math.max(0, (g.investigationsLeft ?? 1) - 1);
  g.investigated = g.investigationsLeft === 0;
  // Detectives aren't free (Hard and Expert).
  const cost = difficultyOf(g).investigationCost;
  if (cost) apply(g, cost);
  const clue: Clue = { quarter: g.quarter, advisor: id, tool, text: a.profile[tool].text, lean: a.profile[tool].lean };
  g.clues.push(clue);
  checkEnd(g);
  return clue;
}

/**
 * Brings a term saved by an older version up to date: hidden pasts for everyone (dealt from a
 * separate stream, so the term's own dice are untouched), and the investigations in place of the old
 * background check.
 */
export function upgradeGame(g: Game) {
  const old = g as Game & { checksUsed?: number; checked?: number[]; checkUsed?: boolean };
  if (!g.advisors.every((a) => a.profile)) {
    const profiles = makeProfiles(makeRng((g.seed ^ 0x2545f491) >>> 0), g.mode, g.advisors.filter((a) => a.impostor).map((a) => a.id));
    g.advisors.forEach((a, i) => (a.profile ??= profiles[i]));
  }
  // A background check used to reveal someone without firing them: that's no longer a thing.
  for (const a of g.advisors) if (!a.fired) a.revealed = false;
  g.toolsUsed ??= {};
  g.clues ??= [];
  g.investigated ??= false;
  g.investigationsLeft ??= g.investigated ? 0 : 1;
  // Saves from before the difficulty levels: Normal, no rumours, no verdict yet.
  g.difficulty = DIFFICULTIES[g.difficulty] ? g.difficulty : 'normal';
  g.quietUntil ??= 0;
  g.rumours ??= [];
  g.verdict ??= null;
  delete old.checksUsed;
  delete old.checked;
  delete old.checkUsed;
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

/** On to the next quarter (or, after the last one, the closing verdict). */
export function nextQuarter(g: Game) {
  if (g.phase !== 'result') return;
  if (g.quarter >= termLength(g)) {
    g.phase = 'verdict';
    return;
  }
  g.quarter++;
  startQuarter(g);
}

/**
 * The closing verdict: name who's still a statist on the council (possibly nobody: "the council is
 * clean"). On Normal and Hard it's scored; on Expert it has to be exactly right, or you lose.
 */
export function submitVerdict(g: Game, named: number[]): boolean {
  if (g.phase !== 'verdict') return false;
  const here = active(g);
  const pick = [...new Set(named)].filter((id) => here.some((a) => a.id === id));
  const verdict: Verdict = {
    named: pick,
    correct: pick.filter((id) => g.advisors[id].impostor),
    wrong: pick.filter((id) => !g.advisors[id].impostor),
    missed: here.filter((a) => a.impostor && !pick.includes(a.id)).map((a) => a.id),
  };
  g.verdict = verdict;
  const exactWrong = difficultyOf(g).verdictExact && (verdict.wrong.length > 0 || verdict.missed.length > 0);
  endTerm(g, exactWrong ? 'unclean' : 'term');
  return true;
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
  // No early win: firing the last impostor doesn't end the term (and nothing tells you it was the last).
  if (g.prosperity <= 0) ending = 'broke';
  else if (g.liberty <= 0) ending = 'chained';
  else if (impostors > real) ending = 'takeover';
  if (!ending) return false;
  // Lose mid-quarter and nothing more lands.
  g.ending = ending;
  g.phase = 'over';
  return true;
}

export const won = (g: Game) => g.ending === 'term' || g.ending === 'purged';

/** The score: what's left of the economy and your freedom, plus whom you fired (and whom you shouldn't have). */
export function score(g: Game): number {
  const fired = g.advisors.filter((a) => a.fired);
  const caught = fired.filter((a) => a.impostor).length;
  const wrong = fired.length - caught;
  const early = g.ending === 'purged' ? 15 * (termLength(g) - g.quarter) : 0;
  const base = won(g) ? 100 : 10 * (g.quarter - 1);
  // The closing verdict: points for every statist named, less for the loyal ones named or the statists missed.
  const v = g.verdict;
  const verdict = v ? 30 * v.correct.length - 25 * v.wrong.length - 20 * v.missed.length : 0;
  const raw = base + g.prosperity + g.liberty + 40 * caught - 25 * wrong + early + verdict;
  return Math.max(0, Math.round(raw * difficultyOf(g).scoreScale));
}

export function policyOf(id: string): Policy {
  return findPolicy(id)!;
}
