// Bots that play whole terms, for the tests and for balancing. They play detective: every interview
// answer, investigation, rumour, proposal and bill is evidence, weighed by how likely it is from a
// loyal advisor and from an impostor (who may be in deep cover), and they work out the odds of every
// possible set of impostors (with however many the difficulty allows). A savvy bot knows its
// economics (it can tell a near-miss from the real thing, a Chicago thesis from an Austrian one, a
// disguised policy on sight); a naive one only spots the obvious (outright slips, openly statist
// pasts, the bills when they land). A random one just clicks. The debate is ignored: everyone uses
// the same lines, so it carries next to nothing.

import { LEAN_ODDS, type Lean, TOOL_ORDER } from './clues.ts';
import {
  active, answerOdds, ask, backersShown, beginCouncil, budgetLeft, canFire, canInvestigate, difficultyOf, enact, fire, FIRING_FROM, type Game, investigate, nextQuarter,
  policyOf, PROPOSAL_ODDS, RUMOUR_TRUE, submitVerdict, termLength, type Tone,
} from './council.ts';
import { next, pickOne } from './rng.ts';

export type BotStyle = 'savvy' | 'naive' | 'random';

/** Log-likelihoods of everything on the record about one advisor, if loyal, an ordinary impostor, or one in deep cover. */
function likelihoods(g: Game, id: number, style: BotStyle): { loyal: number; impostor: number; deep: number } {
  const d = difficultyOf(g);
  const odds = answerOdds(g);
  const deepAnswer: Record<Tone, number> = d.sleeper ? { sound: d.sleeper.sound, near: Math.max(0, 0.95 - d.sleeper.sound), slip: 0, dodge: 0.05 } : odds.impostor;
  const deepPolicy = d.sleeper ? { sound: d.sleeper.policy, disguised: 1 - d.sleeper.policy, blatant: 0 } : PROPOSAL_ODDS.impostor;
  const L = { loyal: 0, impostor: 0, deep: 0 };
  const add = (pl: number, pi: number, pd: number) => {
    L.loyal += Math.log(Math.max(1e-4, pl));
    L.impostor += Math.log(Math.max(1e-4, pi));
    L.deep += Math.log(Math.max(1e-4, pd));
  };
  for (const a of g.answers) {
    if (a.advisor !== id || a.repeat) continue;
    if (style === 'savvy') add(odds.loyal[a.tone], odds.impostor[a.tone], deepAnswer[a.tone]);
    else {
      // The naive can't tell a near-miss from the real thing: only an outright slip, or a dodge.
      const ok = (t: Record<Tone, number>) => t.sound + t.near;
      if (a.tone === 'slip' || a.tone === 'dodge') add(odds.loyal[a.tone], odds.impostor[a.tone], deepAnswer[a.tone]);
      else add(ok(odds.loyal), ok(odds.impostor), ok(deepAnswer));
    }
  }
  const own: Lean = g.mode === 'mirror' ? 'statist' : 'austrian';
  const other: Lean = g.mode === 'mirror' ? 'austrian' : 'statist';
  const leanP = (side: 'loyal' | 'impostor' | 'sleeper', lean: Lean) => {
    const o = LEAN_ODDS[side];
    return lean === own ? o.own : lean === other ? o.other : lean === 'freemarket' ? o.freemarket : o.mainstream;
  };
  const seen = (side: 'loyal' | 'impostor' | 'sleeper', lean: Lean) => (style === 'savvy' ? leanP(side, lean) : lean === other ? leanP(side, other) : 1 - leanP(side, other));
  for (const c of g.clues) if (c.advisor === id) add(seen('loyal', c.lean), seen('impostor', c.lean), seen('sleeper', c.lean));
  // A rumour is their real past only some of the time; otherwise any lean, at random.
  const rumourP = (side: 'loyal' | 'impostor' | 'sleeper', lean: Lean) => RUMOUR_TRUE * seen(side, lean) + (1 - RUMOUR_TRUE) * (style === 'savvy' ? 0.25 : lean === other ? 0.25 : 0.75);
  for (const r of g.rumours) if (r.advisor === id) add(rumourP('loyal', r.lean), rumourP('impostor', r.lean), rumourP('sleeper', r.lean));
  for (const p of g.tabled) {
    if (!p.backers.includes(id) || !backersShown(g, p.quarter, p.policy)) continue;
    const kind = policyOf(p.policy).kind;
    if (style === 'savvy') add(PROPOSAL_ODDS.loyal[kind], PROPOSAL_ODDS.impostor[kind], deepPolicy[kind]);
    else if (kind === 'blatant') add(0.02, PROPOSAL_ODDS.impostor.blatant, 0.02);
  }
  // Bills and payoffs, when they land, tell everyone (even the naive) what a policy really was.
  if (style !== 'savvy') {
    for (const n of g.landed) {
      if (!n.backers?.includes(id) || n.good === undefined) continue;
      if (n.good) add(PROPOSAL_ODDS.loyal.sound, PROPOSAL_ODDS.impostor.sound, deepPolicy.sound);
      else add(1 - PROPOSAL_ODDS.loyal.sound, 1 - PROPOSAL_ODDS.impostor.sound, 1 - deepPolicy.sound);
    }
  }
  return L;
}

const logSumExp = (a: number, b: number) => (a > b ? a + Math.log1p(Math.exp(b - a)) : b + Math.log1p(Math.exp(a - b)));

/**
 * The odds that each advisor is an impostor, and of the most likely set, from every set that fits
 * what's known (whoever's been fired is revealed) and the difficulty's possible counts.
 */
export function analyse(g: Game, style: BotStyle): { odds: Map<number, number>; best: number[] } {
  const d = difficultyOf(g);
  const n = g.advisors.length;
  const deepShare = d.sleeper ? 0.4 : 0;
  const ll = g.advisors.map((a) => likelihoods(g, a.id, style));
  const impLL = ll.map((l) => (deepShare ? logSumExp(Math.log(deepShare) + l.deep, Math.log(1 - deepShare) + l.impostor) : l.impostor));
  const choose = (k: number) => {
    let c = 1;
    for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
    return c;
  };
  const prior = d.impostors;
  const totalW = Object.values(prior).reduce((t, w) => t + (w ?? 0), 0);
  const weight = new Array<number>(n).fill(0);
  let total = 0;
  let best: number[] = [];
  let bestW = -1;
  const logs: { mask: number; lw: number }[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const k = popcount(mask);
    const w = prior[k as 1 | 2 | 3];
    if (!w) continue;
    if (!g.advisors.every((a) => !a.revealed || a.impostor === Boolean(mask & (1 << a.id)))) continue;
    let lw = Math.log(w / totalW / choose(k));
    for (let i = 0; i < n; i++) lw += mask & (1 << i) ? impLL[i] : ll[i].loyal;
    logs.push({ mask, lw });
  }
  const top = Math.max(...logs.map((x) => x.lw));
  for (const { mask, lw } of logs) {
    const w = Math.exp(lw - top);
    total += w;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) weight[i] += w;
    if (w > bestW) {
      bestW = w;
      best = [...Array(n).keys()].filter((i) => mask & (1 << i));
    }
  }
  const odds = new Map<number, number>();
  for (let i = 0; i < n; i++) odds.set(i, total ? weight[i] / total : 0);
  return { odds, best };
}
const popcount = (x: number) => {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
};

/** The chance each advisor is an impostor. */
export function odds(g: Game, style: BotStyle): Map<number, number> {
  return analyse(g, style).odds;
}
/** Kept for older callers: higher is more suspicious. */
export const suspicion = odds;

function councilTurn(g: Game, style: BotStyle) {
  if (style === 'random') {
    if (canFire(g) && next(g.rng) < 0.15) fire(g, pickOne(g.rng, active(g)).id);
    if (g.phase === 'council') enact(g, pickOne(g.rng, g.proposals).policy);
    return;
  }
  const uncertain = () => {
    const o = odds(g, style);
    return active(g)
      .filter((a) => !a.revealed)
      .sort((a, b) => Math.abs((o.get(a.id) ?? 0) - 0.5) - Math.abs((o.get(b.id) ?? 0) - 0.5));
  };
  // Questions for whoever's most uncertain (sparingly, when there's a cap for the whole term).
  const quartersLeft = termLength(g) - g.quarter + 1;
  const cap = budgetLeft(g) === Infinity ? 99 : Math.max(1, Math.ceil(budgetLeft(g) / quartersLeft));
  for (let k = 0; k < Math.min(6, cap) && g.questionsLeft > 0; k++) {
    let asked = false;
    for (const target of uncertain()) {
      const q = g.offered.find((id) => !g.answers.some((x) => x.advisor === target.id && x.question === id));
      if (q && ask(g, target.id, q)) {
        asked = true;
        break;
      }
    }
    if (!asked) break;
  }
  // This quarter's investigation, on the most uncertain (unless it would cost the last of the economy).
  for (let k = 0; k < 3; k++) {
    // Dig into whoever's most uncertain, with a tool not yet used on them.
    const target = uncertain().find((t) => TOOL_ORDER.some((tool) => canInvestigate(g, tool) && !g.clues.some((c) => c.advisor === t.id && c.tool === tool)));
    const tool = target && TOOL_ORDER.find((t) => canInvestigate(g, t) && !g.clues.some((c) => c.advisor === target.id && c.tool === t));
    if (!tool || !target || g.prosperity <= 12) break;
    investigate(g, tool, target.id);
  }
  if (g.phase !== 'council') return;
  // Fire the likeliest impostor once the odds are good enough.
  const o = odds(g, style);
  const ranked = active(g)
    .filter((a) => !a.revealed)
    .map((a) => [a.id, o.get(a.id) ?? 0] as const)
    .sort((a, b) => b[1] - a[1]);
  const threshold = (style === 'savvy' ? 0.8 : 0.82) - (g.quarter >= termLength(g) - 1 ? 0.12 : 0);
  if (g.quarter >= FIRING_FROM && canFire(g) && ranked[0] && ranked[0][1] >= threshold) fire(g, ranked[0][0]);
  if (g.phase !== 'council') return;
  const o2 = odds(g, style);
  const trust = (backers: number[]) => -backers.reduce((t, b) => t + (o2.get(b) ?? 0), 0);
  const anonymous = difficultyOf(g).anonymous;
  const options = [...g.proposals].sort((a, b) => {
    if (style === 'savvy') {
      const sa = policyOf(a.policy).kind === 'sound' ? 1 : 0;
      const sb = policyOf(b.policy).kind === 'sound' ? 1 : 0;
      if (sa !== sb) return sb - sa;
    }
    // On Hard and Expert you can't see backers, so the naive bot can only guess.
    if (anonymous) return 0;
    return trust(b.backers) - trust(a.backers) || b.backers.length - a.backers.length;
  });
  enact(g, (anonymous && style !== 'savvy' ? pickOne(g.rng, options) : options[0]).policy);
}

/** The closing verdict: the most likely set of statists still on the council. */
function verdict(g: Game, style: BotStyle) {
  if (style === 'random') return submitVerdict(g, active(g).filter(() => next(g.rng) < 0.3).map((a) => a.id));
  const { best } = analyse(g, style);
  return submitVerdict(g, best.filter((id) => !g.advisors[id].fired));
}

/** Plays a whole term. */
export function botPlay(g: Game, style: BotStyle): Game {
  for (let guard = 0; guard < 100 && g.phase !== 'over'; guard++) {
    if (g.phase === 'briefing') beginCouncil(g);
    else if (g.phase === 'council') councilTurn(g, style);
    else if (g.phase === 'result') nextQuarter(g);
    else if (g.phase === 'verdict') verdict(g, style);
  }
  return g;
}
