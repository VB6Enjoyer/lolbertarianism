import { describe, expect, it } from 'vitest';
import { botRun, botTurn } from './bot.ts';
import { CARDS, POOL, STARTER_DECK } from './cards.ts';
import { canPlay, endTurn, fireLaser, laserReady, playCard, resolveChoice, startCombat, type FightSetup } from './combat.ts';
import { ENCOUNTERS, ENEMIES } from './enemies.ts';
import { EVENTS } from './events.ts';
import { RELICS } from './relics.ts';
import { makeRng } from './rng.ts';
import { enterNode, finishCombat, generateMap, newRun, reachable, ROWS, type Run } from './run.ts';
import { attackDamage, BASED_MAX, type Card, type Combat } from './state.ts';

const deck = (ids: string[]): Card[] => ids.map((id, i) => ({ uid: i + 1, id, up: false }));
const setup = (over: Partial<FightSetup> = {}): FightSetup => ({
  act: 1,
  kind: 'fight',
  enemies: ['doomscroller'],
  deck: deck(STARTER_DECK),
  hp: 70,
  maxHp: 70,
  relics: [],
  based: 0,
  rng: makeRng(7),
  nextUid: 100,
  ...over,
});
/** A fight with exactly these cards in hand and plenty of Airtime. */
function withHand(ids: string[], over: Partial<FightSetup> = {}): Combat {
  const c = startCombat(setup(over));
  c.discard.push(...c.hand);
  c.hand = ids.map((id, i) => ({ uid: 500 + i, id, up: false }));
  c.player.energy = 10;
  c.fx = [];
  return c;
}

describe('cards', () => {
  it('all have text, upgraded text, and a way to be played (or a reason not to be)', () => {
    for (const card of Object.values(CARDS)) {
      expect(card.text(false).length, card.id).toBeGreaterThan(5);
      expect(card.text(true).length, card.id).toBeGreaterThan(5);
      if (card.cost !== null) expect(card.play, card.id).toBeTypeOf('function');
      else expect(card.endOfTurn, card.id).toBeTypeOf('function');
    }
    for (const id of STARTER_DECK) expect(CARDS[id]).toBeDefined();
    expect(POOL.length).toBeGreaterThanOrEqual(25);
  });

  it('every card in the pool plays, upgraded or not, against one enemy or three', () => {
    for (const card of POOL)
      for (const up of [false, true])
        for (const enemies of [['doomscroller'], ['replyguy', 'replyguy', 'influencer']]) {
          const c = withHand([card.id], { enemies });
          c.hand[0].up = up;
          expect(playCard(c, 0, 0), `${card.id}${up ? '+' : ''}`).toBe(true);
          if (c.pending) resolveChoice(c, 0);
          expect(c.pending).toBeNull();
        }
  });

  it('do their damage, with Momentum, Exposed and Rattled', () => {
    const c = withHand(['data', 'lunch', 'data']);
    const e = c.enemies[0];
    const hp = e.hp;
    playCard(c, 0, 0);
    expect(e.hp).toBe(hp - 6);
    playCard(c, 0, 0); // No Free Lunch: 8, then Exposed
    expect(e.hp).toBe(hp - 14);
    expect(e.status.exposed).toBe(2);
    playCard(c, 0, 0); // 6 × 1.5
    expect(e.hp).toBe(hp - 23);
    expect(attackDamage(10, { hp: 1, maxHp: 1, block: 0, status: { momentum: 2, rattled: 1 } }, { hp: 1, maxHp: 1, block: 0, status: {} })).toBe(9);
  });

  it('Composure blocks damage until the next turn', () => {
    const c = withHand(['calm']);
    playCard(c, 0);
    expect(c.player.block).toBe(5);
    c.enemies[0].move = 'doompost'; // 8 damage
    endTurn(c);
    expect(c.player.hp).toBe(70 - 3);
    expect(c.player.block).toBe(0);
  });

  it('Payroll Withholding leaves a Regret in the deck for good', () => {
    const run = newRun(3);
    enterNode(run, 0, 0);
    const c = run.combat!;
    c.hand.push({ uid: 999, id: 'withholding', up: false });
    c.player.energy = 1;
    expect(playCard(c, c.hand.length - 1)).toBe(true);
    for (const e of c.enemies) {
      e.hp = 0;
      e.dead = true;
    }
    c.result = 'won';
    finishCombat(run);
    expect(run.deck.filter((x) => x.id === 'regret')).toHaveLength(1);
  });

  it('Inflation in hand costs Credibility at the end of the turn', () => {
    const c = withHand(['inflation', 'inflation']);
    c.enemies[0].move = 'spiral';
    endTurn(c);
    expect(c.player.hp).toBe(66);
    expect(canPlay(c, c.hand.findIndex((x) => x.id === 'inflation'))).toBe(false);
  });
});

describe('laser eyes', () => {
  it('fire only on a full meter, hit everyone, burn Inflation and empty the meter', () => {
    const c = withHand(['inflation', 'data'], { enemies: ['replyguy', 'replyguy'] });
    expect(fireLaser(c)).toBe(false);
    c.based = BASED_MAX;
    expect(laserReady(c)).toBe(true);
    const before = c.enemies.map((e) => e.hp);
    expect(fireLaser(c)).toBe(true);
    c.enemies.forEach((e, i) => expect(e.hp === 0 || e.hp === before[i] - 20).toBe(true));
    expect(c.hand.map((x) => x.id)).toEqual(['data']);
    expect(c.based).toBe(0);
  });

  it('fill the meter with damage dealt', () => {
    const c = withHand(['data']);
    playCard(c, 0, 0);
    expect(c.based).toBe(6);
  });
});

describe('enemies', () => {
  it('only make moves they have, for 40 turns', () => {
    for (const def of Object.values(ENEMIES)) {
      const c = startCombat(setup({ enemies: [def.id] }));
      const e = c.enemies[0];
      expect(def.moves[e.move], `${def.id} first`).toBeDefined();
      for (let t = 0; t < 40; t++) {
        e.turn = t;
        e.move = def.next(e, c.rng, c);
        expect(def.moves[e.move], `${def.id} turn ${t}`).toBeDefined();
      }
      expect(def.intro.length).toBeGreaterThan(5);
    }
  });

  it('turn up in encounters that only name real enemies', () => {
    for (const act of [1, 2, 3]) {
      const e = ENCOUNTERS[act];
      for (const group of [...e.easy, ...e.normal, ...e.elite, e.boss]) for (const id of group) expect(ENEMIES[id], id).toBeDefined();
      expect(ENEMIES[e.boss[0]].boss).toBe(true);
    }
  });

  it('Late Stage Capitalism gets back up once, then stays down', () => {
    const c = withHand(['nobel', 'nobel', 'nobel', 'nobel', 'nobel', 'nobel', 'nobel', 'nobel', 'nobel', 'nobel'], { enemies: ['latestage'], kind: 'boss' });
    c.player.energy = 99;
    let plays = 0;
    while (!c.result && plays++ < 30) {
      if (!c.hand.length) c.hand.push({ uid: 900 + plays, id: 'nobel', up: false });
      playCard(c, 0, 0);
    }
    expect(c.enemies[0].memo.revived).toBe(1);
    expect(c.result).toBe('won');
  });
});

describe('the map', () => {
  it('has fights first, the green room last, a boss on top, and paths that never cross', () => {
    for (let seed = 1; seed < 60; seed++) {
      const map = generateMap(makeRng(seed));
      expect(map).toHaveLength(ROWS + 1);
      expect(map[0].every((n) => n.type === 'fight')).toBe(true);
      expect(map[ROWS - 1].every((n) => n.type === 'rest')).toBe(true);
      expect(map[ROWS][0].type).toBe('boss');
      for (let r = 0; r < ROWS - 1; r++) {
        for (const n of map[r]) {
          expect(n.next.length).toBeGreaterThan(0);
          expect(n.next.every((c) => Math.abs(c - n.col) <= 1)).toBe(true);
        }
        // No crossing: a node going right and its right neighbour going left.
        for (const n of map[r]) {
          const right = map[r].find((x) => x.col === n.col + 1);
          if (right && n.next.includes(n.col + 1)) expect(right.next.includes(n.col)).toBe(false);
        }
      }
    }
  });

  it('lets you go only where the paths lead', () => {
    const run = newRun(11);
    expect(reachable(run)).toHaveLength(3);
    expect(enterNode(run, 2, 0)).toBe(false);
    expect(enterNode(run, 0, 1)).toBe(true);
    expect(run.screen).toBe('combat');
  });
});

describe('runs', () => {
  it('have events, relics and cards that all exist', () => {
    for (const ev of EVENTS)
      for (const ch of ev.choices)
        for (const ef of ch.effects) {
          if (ef.kind === 'card') expect(CARDS[ef.id], ef.id).toBeDefined();
          if (ef.kind === 'relic' && ef.id) expect(RELICS[ef.id], ef.id).toBeDefined();
        }
  });

  it('save and load mid-fight, and carry on exactly the same', () => {
    const a = newRun(42);
    enterNode(a, 0, 0);
    botTurn(a.combat!);
    const b: Run = JSON.parse(JSON.stringify(a));
    botRun(a);
    botRun(b);
    expect(b.screen).toBe(a.screen);
    expect(b.stats).toEqual(a.stats);
    expect(b.deck).toEqual(a.deck);
  });

  it('always end, won or lost, and the bot gets past the first boss most of the time', () => {
    let pastAct1 = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const run = newRun(seed);
      botRun(run);
      expect(['won', 'lost'], `seed ${seed}`).toContain(run.screen);
      if (run.act > 1) pastAct1++;
    }
    expect(pastAct1 / 80).toBeGreaterThan(0.6);
  });
});
