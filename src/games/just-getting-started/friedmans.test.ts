import { describe, expect, it } from 'vitest';
import { botRun } from './bot.ts';
import { CARDS, poolFor } from './cards.ts';
import { CHARACTERS } from './characters.ts';
import { AGENCY_DAMAGE, endTurn, playCard, startCombat, type FightSetup } from './combat.ts';
import { ENEMIES } from './enemies.ts';
import { EVENTS } from './events.ts';
import { RELICS } from './relics.ts';
import { makeRng } from './rng.ts';
import { enterNode, fightSecret, finishCombat, newCard, newRun, ROWS, runScore, skipSecret, type Run } from './run.ts';
import type { Card } from './state.ts';

const deck = (ids: string[]): Card[] => ids.map((id, i) => ({ uid: i + 1, id, up: false }));
const davidFight = (over: Partial<FightSetup> = {}) =>
  startCombat({ act: 1, kind: 'fight', enemies: ['nimby'], deck: deck(CHARACTERS.david.starter), hp: 70, maxHp: 70, relics: ['machinery-book'], based: 0, rng: makeRng(4), nextUid: 100, character: 'david', ...over });

describe('the two Friedmans', () => {
  it('each have a full card pool of their own, sharing a few', () => {
    for (const who of ['milton', 'david'] as const) {
      const pool = poolFor(who);
      for (const rarity of ['common', 'uncommon', 'rare'] as const) expect(pool.filter((c) => c.rarity === rarity).length, `${who} ${rarity}`).toBeGreaterThanOrEqual(3);
      const other = who === 'milton' ? 'david' : 'milton';
      expect(pool.some((c) => c.who === other)).toBe(false);
      expect(pool.some((c) => c.who === 'both')).toBe(true);
    }
    for (const ch of Object.values(CHARACTERS)) {
      for (const id of ch.starter) expect(CARDS[id], id).toBeDefined();
      expect(RELICS[ch.relic].tier).toBe('starter');
      expect(ENEMIES[ch.secretBoss].boss).toBe(true);
    }
  });

  it('start David’s runs with his deck and his book, and keep the daily run Milton’s', () => {
    const run = newRun(1, null, 1, 'david');
    expect(run.character).toBe('david');
    expect(run.deck.map((c) => c.id)).toEqual(CHARACTERS.david.starter);
    expect(run.relics).toEqual(['machinery-book']);
    expect(newRun(1, { key: '2026-11-18', twist: 'helicopter' }, 1, 'david').character).toBe('milton');
  });

  it('David’s Agencies hit at the end of his turn; the Machinery turns them into Composure', () => {
    const c = davidFight();
    expect(c.player.status.agency).toBe(1);
    c.player.status.agency = 3;
    c.hand = [];
    c.fx = [];
    const before = c.enemies[0].hp + c.enemies[0].block;
    c.enemies[0].move = 'zoning';
    endTurn(c);
    const agencyHits = c.fx.filter((e) => e.kind === 'damage' && e.target === c.enemies[0].uid);
    expect(agencyHits).toHaveLength(3);
    expect(before - (c.enemies[0].hp + c.enemies[0].block)).toBeGreaterThanOrEqual(3 * AGENCY_DAMAGE - 9);
    const m = davidFight();
    m.player.status.agency = 4;
    m.player.status.machinery = 1;
    m.hand = [];
    m.enemies[0].move = 'zoning';
    const hp = m.player.hp;
    endTurn(m);
    // 4 Composure soaked part of the 11-damage Zoning Hearing.
    expect(hp - m.player.hp).toBe(7);
  });

  it('A Market for Law adds an Agency every turn, and Polycentric Law one per Rebuttal', () => {
    const c = davidFight();
    c.hand = [{ uid: 900, id: 'marketlaw', up: false }, { uid: 901, id: 'polycentric', up: false }, { uid: 902, id: 'insure', up: false }];
    c.player.energy = 9;
    playCard(c, 0);
    playCard(c, 0);
    playCard(c, 0); // a Rebuttal: +1
    expect(c.player.status.agency).toBe(2);
    c.hand = [];
    c.enemies[0].move = 'backyard';
    endTurn(c);
    expect(c.player.status.agency).toBe(3);
  });
});

/** A run at the last boss, beaten. */
function beatLastBoss(character: 'milton' | 'david', regret = false): Run {
  const run = newRun(5, null, 1, character);
  if (regret) run.deck.push(newCard(run, 'regret'));
  run.act = 3;
  run.pos = { row: ROWS - 1, col: 1 };
  expect(enterNode(run, ROWS, 1)).toBe(true);
  const c = run.combat!;
  for (const e of c.enemies) {
    e.hp = 0;
    e.dead = true;
  }
  c.result = 'won';
  finishCombat(run);
  return run;
}

describe('the secret boss', () => {
  it('drops by only if there’s no Regret in your deck', () => {
    expect(beatLastBoss('milton', true).screen).toBe('won');
    const run = beatLastBoss('milton');
    expect(run.screen).toBe('secret');
    expect(run.secret).toBe('offered');
  });

  it('is David for Milton and Milton for David, and beating him is worth 400 more (a boss, plus the secret bonus)', () => {
    for (const [who, boss] of [['milton', 'david'], ['david', 'milton']] as const) {
      const run = beatLastBoss(who);
      fightSecret(run);
      expect(run.combat?.enemies[0].id).toBe(boss);
      expect(run.combat?.kind).toBe('boss');
      const before = runScore({ ...run, screen: 'won' });
      run.combat!.enemies[0].dead = true;
      run.combat!.result = 'won';
      finishCombat(run);
      expect(run.screen).toBe('won');
      expect(run.secret).toBe('won');
      // A boss beaten (100) and the secret bonus (300).
      expect(runScore(run)).toBe(before + 400);
    }
  });

  it('losing to him still wins the run; skipping him does too', () => {
    const run = beatLastBoss('milton');
    fightSecret(run);
    run.combat!.player.hp = 0;
    run.combat!.result = 'lost';
    finishCombat(run);
    expect(run.screen).toBe('won');
    expect(run.secret).toBe('lost');
    const skip = beatLastBoss('milton');
    skipSecret(skip);
    expect(skip.screen).toBe('won');
    expect(skip.secret).toBe('skipped');
  });
});

describe('David’s runs', () => {
  it('have their own TV appearances, with real cards and relics in them', () => {
    const his = EVENTS.filter((e) => e.who === 'david');
    expect(his.length).toBeGreaterThanOrEqual(4);
    for (const ev of his) for (const ch of ev.choices) for (const ef of ch.effects) if (ef.kind === 'card') expect(CARDS[ef.id]?.who, ef.id).toBe('david');
  });

  it('always end, and only ever hand David his own cards', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const run = newRun(seed, null, 1, 'david');
      botRun(run);
      expect(['won', 'lost']).toContain(run.screen);
      for (const card of run.deck) expect(['david', 'both', undefined].includes(CARDS[card.id].who) && (CARDS[card.id].who !== undefined || CARDS[card.id].rarity === 'special'), `${seed}: ${card.id}`).toBe(true);
    }
  });
});
