// Bots that play whole terms, for the tests and for balancing. A savvy one knows its economics (it
// can tell a disguised statist policy on sight); a naive one only goes by what happens: the bills
// that land, the slips in the interviews, and who accuses whom. A random one just clicks.

import { active, ask, backgroundCheck, beginCouncil, canCheck, canFire, enact, fire, type Game, nextQuarter, policyOf } from './council.ts';
import { next, pickOne } from './rng.ts';

export type BotStyle = 'savvy' | 'naive' | 'random';

/** How suspicious each advisor looks from the outside (higher is worse). */
export function suspicion(g: Game, style: BotStyle): Map<number, number> {
  const s = new Map<number, number>();
  for (const a of active(g)) {
    let x = 0;
    if (style === 'savvy') {
      const now = g.proposals.find((p) => p.backers.includes(a.id));
      if (now && policyOf(now.policy).kind !== 'sound') x += 3;
      for (const e of g.enacted) if (e.backers.includes(a.id) && policyOf(e.policy).kind !== 'sound') x += 1.5;
    }
    // Bills and payoffs that landed this quarter, from what they backed.
    for (const n of g.news) {
      if (!n.backers?.includes(a.id)) continue;
      x += n.good ? -1 : 2;
    }
    x += 2 * g.answers.filter((ans) => ans.advisor === a.id && ans.tone === 'slip').length;
    x -= 0.5 * g.answers.filter((ans) => ans.advisor === a.id && ans.tone === 'sound').length;
    for (const t of g.talk) {
      if (t.about === a.id) x += t.kind === 'accuse' ? 0.7 : t.kind === 'defend' ? -0.4 : 0;
      // Accusing someone who turned out real, or defending someone who turned out Viennese, is a tell.
      const about = t.about === null ? null : g.advisors[t.about];
      if (t.from === a.id && about?.revealed) {
        if (t.kind === 'accuse' && !about.impostor) x += 2.5;
        if (t.kind === 'defend' && about.impostor) x += 3;
      }
    }
    if (a.revealed) x = a.impostor ? 99 : -99;
    s.set(a.id, x);
  }
  return s;
}

function councilTurn(g: Game, style: BotStyle) {
  if (style === 'random') {
    if (next(g.rng) < 0.15) fire(g, pickOne(g.rng, active(g)).id);
    if (g.phase === 'council') enact(g, pickOne(g.rng, g.proposals).policy);
    return;
  }
  // Two questions, to whoever's least known.
  for (let k = 0; k < 4 && g.questionsLeft > 0; k++) {
    const asked = (id: number) => g.answers.filter((x) => x.advisor === id).length;
    const target = active(g).filter((a) => !a.revealed).sort((a, b) => asked(a.id) - asked(b.id))[0];
    const q = target && g.offered.find((id) => !g.answers.some((x) => x.advisor === target.id && x.question === id));
    if (!target || !q) break;
    ask(g, target.id, q);
  }
  const s = suspicion(g, style);
  const ranked = [...s].sort((a, b) => b[1] - a[1]);
  // The background check, on the top suspect, once there's something to go on.
  if (canCheck(g) && g.quarter >= 2 && ranked[0] && ranked[0][1] < 99) backgroundCheck(g, ranked[0][0]);
  const after = [...suspicion(g, style)].sort((a, b) => b[1] - a[1]);
  const threshold = style === 'savvy' ? 3 : 3.5;
  if (canFire(g) && after[0] && after[0][1] >= threshold) fire(g, after[0][0]);
  if (g.phase !== 'council') return;
  const s2 = suspicion(g, style);
  const trust = (backers: number[]) => -backers.reduce((t, b) => t + (s2.get(b) ?? 0), 0);
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
