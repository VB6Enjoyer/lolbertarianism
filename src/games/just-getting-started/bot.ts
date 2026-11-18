// A simple bot that plays whole runs, for tests and balancing: it defends when the intents say a
// hit is coming, attacks the weakest enemy otherwise, and takes the first sensible option off the map.

import { cardCost, cardDef, canUpgrade } from './cards.ts';
import { canPlay, endTurn, fireLaser, intentOf, laserReady, playCard, resolveChoice } from './combat.ts';
import { next } from './rng.ts';
import {
  buyCard, chooseEvent, choiceOpen, enterNode, finishCombat, leaveEvent, leaveReward, leaveShop, nextAct, reachable, rehearse, removeCard,
  rest, type Run, takeRewardCard, takeRewardRelic,
} from './run.ts';
import { eventById } from './events.ts';
import type { Combat } from './state.ts';

/** Damage the enemies' intents say is coming this turn. */
export function incoming(c: Combat): number {
  let total = 0;
  for (const e of c.enemies) {
    if (e.dead) continue;
    const { damage } = intentOf(c, e);
    if (!damage) continue;
    const [per, hits = '1'] = damage.split(/[×–]/);
    total += damage.includes('–') ? Number(hits) : Number(per) * Number(hits);
  }
  return total;
}

/** Plays one turn of a fight. */
export function botTurn(c: Combat) {
  for (let guard = 0; guard < 40 && !c.result; guard++) {
    if (c.pending) {
      resolveChoice(c, 0);
      continue;
    }
    if (laserReady(c)) {
      fireLaser(c);
      continue;
    }
    const playable = c.hand.map((card, i) => ({ card, i })).filter(({ i }) => canPlay(c, i));
    if (!playable.length) break;
    const threatened = incoming(c) > c.player.block;
    const score = ({ card }: { card: (typeof c.hand)[number] }) => {
      const d = cardDef(card.id);
      if (d.id === 'shortage') return -1;
      if (d.type === 'principle') return 6;
      if (d.type === 'rebuttal') return threatened ? 5 : 2;
      return threatened ? 3 : 5;
    };
    playable.sort((a, b) => score(b) - score(a) || (cardCost(b.card.id, b.card.up) ?? 0) - (cardCost(a.card.id, a.card.up) ?? 0));
    const best = playable[0];
    if (score(best) < 0) break;
    const targets = c.enemies.map((e, i) => ({ e, i })).filter(({ e }) => !e.dead).sort((a, b) => a.e.hp - b.e.hp);
    playCard(c, best.i, targets[0]?.i);
  }
  if (!c.result) endTurn(c);
}

/** Plays a whole run to the end. Returns how many steps it took. */
export function botRun(run: Run, maxSteps = 5000): number {
  let steps = 0;
  while (steps++ < maxSteps) {
    switch (run.screen) {
      case 'map': {
        const options = reachable(run);
        const pick = options[Math.floor(next(run.rng) * options.length)];
        enterNode(run, pick.row, pick.col);
        break;
      }
      case 'combat':
        botTurn(run.combat!);
        if (run.combat!.result) finishCombat(run);
        break;
      case 'reward':
        takeRewardCard(run, 0);
        takeRewardRelic(run, run.reward!.bossRelics[0]);
        leaveReward(run);
        break;
      case 'shop': {
        const regret = run.deck.find((c) => c.id === 'regret') ?? run.deck.find((c) => c.id === 'data');
        if (regret) removeCard(run, regret.uid);
        run.shop!.cards.forEach((_, i) => buyCard(run, i));
        leaveShop(run);
        break;
      }
      case 'rest': {
        const card = run.deck.find((c) => canUpgrade(c.id, c.up));
        if (run.hp < run.maxHp * 0.55 || !card) rest(run);
        else rehearse(run, card.uid);
        break;
      }
      case 'event': {
        const ev = eventById(run.event!.id)!;
        const i = ev.choices.findIndex((ch) => choiceOpen(run, ch.needs));
        chooseEvent(run, Math.max(0, i));
        leaveEvent(run);
        break;
      }
      case 'act-clear':
        nextAct(run);
        break;
      case 'lost':
      case 'won':
        return steps;
    }
  }
  return steps;
}
