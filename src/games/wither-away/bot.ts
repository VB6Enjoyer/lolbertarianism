// A bot that plays whole runs, for the tests and for balancing: it kites away from the crowd
// (and towards XP when it's safe), and takes the first card offered.

import { choose, DT, type Game, type Input, step } from './game.ts';

/** Where the bot pushes: away from nearby statists, weighted by how close they are; towards XP if calm. */
/** How close the bot lets statists come: like a player, it closes in when its weapon is short-range. */
const COMFORT: Record<Game['character'], number> = { ancap: 260, agorist: 260, minarchist: 190, austrian: 135 };

export function botInput(g: Game): Input {
  const p = g.player;
  let x = 0;
  let y = 0;
  const comfort = COMFORT[g.character];
  for (const e of g.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > comfort * comfort) continue;
    const w = 1 / Math.max(80, d2);
    x += dx * w * (e.type === 'bank' ? 4 : 1);
    y += dy * w * (e.type === 'bank' ? 4 : 1);
  }
  for (const b of g.foeShots) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 150 * 150) {
      x += (dx / Math.max(80, d2)) * 3;
      y += (dy / Math.max(80, d2)) * 3;
    }
  }
  const danger = Math.hypot(x, y);
  if (danger < 0.004) {
    // Calm: go and get the nearest XP.
    let best: { x: number; y: number } | null = null;
    let bd = 400 * 400;
    for (const pk of g.pickups) {
      const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = pk;
      }
    }
    if (best) return { x: best.x - p.x, y: best.y - p.y };
    // Circle slowly so the crowd doesn't box it in.
    return { x: Math.cos(g.time * 0.4), y: Math.sin(g.time * 0.4) };
  }
  return { x: x / danger, y: y / danger };
}

/** Plays a whole run (or until `maxTime` seconds). */
export function botRun(g: Game, maxTime = 700, pick = (_g: Game) => 0): Game {
  while (!g.over && g.time < maxTime) {
    if (g.offer) {
      choose(g, pick(g));
      continue;
    }
    step(g, botInput(g), DT);
  }
  return g;
}
