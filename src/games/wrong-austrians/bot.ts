// Bots that play whole terms, for the tests and for balancing. They play detective: every interview
// answer, investigation, proposal and bill is evidence, weighed by how likely it is from a loyal
// advisor and from an impostor, and they work out the odds of each pair of advisors being the two
// impostors. A savvy bot knows its economics (it can tell a near-miss from the real thing, a Chicago
// thesis from an Austrian one, a disguised policy on sight); a naive one only spots the obvious (the
// blatant slips, openly statist pasts, the bills when they land). A random one just clicks.

import { LEAN_ODDS, type Lean, TOOL_ORDER } from './clues.ts';
import {
  active, answerOdds, ask, beginCouncil, canFire, canInvestigate, COUNCIL, enact, fire, FIRING_FROM, type Game, IMPOSTORS, investigate, nextQuarter, policyOf,
  PROPOSAL_ODDS, termLength,
} from './council.ts';
import { next, pickOne } from './rng.ts';

export type BotStyle = 'savvy' | 'naive' | 'random';

/** How likely the evidence on one advisor is, if they're loyal and if they're an impostor (as log odds: impostor over loyal). */
function evidenceFor(g: Game, id: number, style: BotStyle): number {
  let log = 0;
  const odds = answerOdds(g);
  const lr = (pImp: number, pLoyal: number) => Math.log(Math.max(1e-6, pImp) / Math.max(1e-6, pLoyal));
  for (const a of g.answers) {
    // A repeat is the same answer again: no new evidence.
    if (a.advisor !== id || a.repeat) continue;
    if (style === 'savvy') log += lr(odds.impostor[a.tone], odds.loyal[a.tone]);
    else {
      // The naive can't tell a near-miss from the real thing: only an outright slip, or a dodge.
      const ok = (t: typeof odds.loyal) => t.sound + t.near;
      if (a.tone === 'slip' || a.tone === 'dodge') log += lr(odds.impostor[a.tone], odds.loyal[a.tone]);
      else log += lr(ok(odds.impostor), ok(odds.loyal));
    }
  }
  const own: Lean = g.mode === 'mirror' ? 'statist' : 'austrian';
  const other: Lean = g.mode === 'mirror' ? 'austrian' : 'statist';
  const leanP = (side: 'loyal' | 'impostor', lean: Lean) => {
    const o = LEAN_ODDS[side];
    return lean === own ? o.own : lean === other ? o.other : lean === 'freemarket' ? o.freemarket : o.mainstream;
  };
  for (const c of g.clues) {
    if (c.advisor !== id) continue;
    if (style === 'savvy') log += lr(leanP('impostor', c.lean), leanP('loyal', c.lean));
    else if (c.lean === other) log += lr(leanP('impostor', other), leanP('loyal', other));
    else log += lr(1 - leanP('impostor', other), 1 - leanP('loyal', other));
  }
  for (const p of g.tabled) {
    if (!p.backers.includes(id)) continue;
    const kind = policyOf(p.policy).kind;
    if (style === 'savvy') log += lr(PROPOSAL_ODDS.impostor[kind], PROPOSAL_ODDS.loyal[kind]);
    else if (kind === 'blatant') log += lr(PROPOSAL_ODDS.impostor.blatant, 0.02);
  }
  // Bills and payoffs, when they land, tell everyone (and the naive) what a policy really was.
  for (const n of g.landed) {
    if (!n.backers?.includes(id) || n.good === undefined || style === 'savvy') continue;
    log += n.good ? lr(PROPOSAL_ODDS.impostor.sound, PROPOSAL_ODDS.loyal.sound) : lr(1 - PROPOSAL_ODDS.impostor.sound, 1 - PROPOSAL_ODDS.loyal.sound);
  }
  return log;
}

/** The chance each advisor is an impostor, from every pair that fits what's known. */
export function odds(g: Game, style: BotStyle): Map<number, number> {
  const ev = g.advisors.map((a) => evidenceFor(g, a.id, style));
  const weight = new Map<number, number>();
  let total = 0;
  for (let i = 0; i < COUNCIL; i++) {
    for (let j = i + 1; j < COUNCIL; j++) {
      // A pair has to agree with whoever's been fired (and so revealed).
      const fits = g.advisors.every((a) => !a.revealed || a.impostor === (a.id === i || a.id === j));
      if (!fits) continue;
      const w = Math.exp(ev[i] + ev[j]);
      total += w;
      weight.set(i, (weight.get(i) ?? 0) + w);
      weight.set(j, (weight.get(j) ?? 0) + w);
    }
  }
  const out = new Map<number, number>();
  for (const a of g.advisors) out.set(a.id, total ? (weight.get(a.id) ?? 0) / total : IMPOSTORS / COUNCIL);
  return out;
}

/** Kept for the UI and older callers: higher is more suspicious. */
export function suspicion(g: Game, style: BotStyle): Map<number, number> {
  return odds(g, style);
}

function councilTurn(g: Game, style: BotStyle) {
  if (style === 'random') {
    if (canFire(g) && next(g.rng) < 0.15) fire(g, pickOne(g.rng, active(g)).id);
    if (g.phase === 'council') enact(g, pickOne(g.rng, g.proposals).policy);
    return;
  }
  // Question whoever's most uncertain.
  const uncertain = () => {
    const o = odds(g, style);
    return active(g)
      .filter((a) => !a.revealed)
      .sort((a, b) => Math.abs((o.get(a.id) ?? 0) - 0.5) - Math.abs((o.get(b.id) ?? 0) - 0.5));
  };
  for (let k = 0; k < 6 && g.questionsLeft > 0; k++) {
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
  // This quarter's investigation, on the most uncertain.
  const tool = TOOL_ORDER.find((t) => canInvestigate(g, t));
  const target = uncertain()[0];
  if (tool && target) investigate(g, tool, target.id);
  // Fire the likeliest impostor once the odds are good enough (the last quarter, a little sooner).
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
  const options = [...g.proposals].sort((a, b) => {
    if (style === 'savvy') {
      const sa = policyOf(a.policy).kind === 'sound' ? 1 : 0;
      const sb = policyOf(b.policy).kind === 'sound' ? 1 : 0;
      if (sa !== sb) return sb - sa;
    }
    return trust(b.backers) - trust(a.backers) || b.backers.length - a.backers.length;
  });
  enact(g, options[0].policy);
}

/** Plays a whole term. */
export function botPlay(g: Game, style: BotStyle): Game {
  for (let guard = 0; guard < 100 && g.phase !== 'over'; guard++) {
    if (g.phase === 'briefing') beginCouncil(g);
    else if (g.phase === 'council') councilTurn(g, style);
    else if (g.phase === 'result') nextQuarter(g);
  }
  return g;
}
