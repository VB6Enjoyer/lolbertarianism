import { describe, expect, it } from 'vitest';
import { CARDS } from './cards.ts';
import { CHARACTERS } from './characters.ts';
import { endTurn, playCard, startCombat, type FightSetup } from './combat.ts';
import { ENCOUNTERS, ENEMIES } from './enemies.ts';
import { EVENTS } from './events.ts';
import { makeRng } from './rng.ts';
import type { Card, Combat } from './state.ts';

const deck = (ids: string[]): Card[] => ids.map((id, i) => ({ uid: i + 1, id, up: false }));
const fight = (over: Partial<FightSetup> = {}) =>
  startCombat({ act: 2, kind: 'fight', enemies: ['planner'], deck: deck(CHARACTERS.milton.starter), hp: 70, maxHp: 70, relics: [], based: 0, rng: makeRng(11), nextUid: 100, ...over });

/** Puts a card in hand (first) and plays it at the first enemy. */
function playNew(c: Combat, id: string, up = false, target = 0) {
  c.hand.unshift({ uid: c.nextUid++, id, up });
  c.player.energy = 10;
  c.fx = [];
  expect(playCard(c, 0, target), id).toBe(true);
}

describe('Milton’s new cards', () => {
  it('MV = PQ burns an Inflation in hand for double damage', () => {
    const c = fight();
    const hp = c.enemies[0].hp;
    c.hand.push({ uid: 900, id: 'inflation', up: false });
    playNew(c, 'mvpq');
    expect(hp - c.enemies[0].hp).toBe(14);
    expect(c.hand.some((x) => x.id === 'inflation')).toBe(false);
    expect(c.exhausted.some((x) => x.id === 'inflation')).toBe(true);
    const plain = c.enemies[0].hp;
    playNew(c, 'mvpq');
    expect(plain - c.enemies[0].hp).toBe(7);
  });

  it('The Thermostat doubles up against an attack', () => {
    const c = fight();
    c.enemies[0].move = 'plan';
    playNew(c, 'thermostat');
    expect(c.player.block).toBe(10);
    const calm = fight();
    calm.enemies[0].move = 'planning';
    playNew(calm, 'thermostat');
    expect(calm.player.block).toBe(5);
  });

  it('Rose’s Edit upgrades a card in hand, for this fight only', () => {
    const c = fight();
    const before = c.hand.filter((x) => x.up).length;
    playNew(c, 'rose');
    expect(c.hand.filter((x) => x.up).length).toBe(before + 1);
  });

  it('The Social Responsibility of Business pays off on a knockout', () => {
    const c = fight();
    c.enemies[0].hp = 5;
    c.enemies[0].block = 0;
    const handSize = c.hand.length;
    playNew(c, 'socialresp');
    expect(c.enemies[0].dead).toBe(true);
    expect(c.result).toBe('won');
    expect(c.hand.length).toBeGreaterThanOrEqual(Math.min(handSize + 2, 10));
  });

  it('Lift the Controls hits and exposes everyone', () => {
    const c = fight({ enemies: ['replyguy', 'replyguy'] });
    playNew(c, 'lift');
    for (const e of c.enemies) expect(e.status.exposed).toBe(1);
  });

  it('The k-Percent Rule adds Composure every turn; End the Draft adds it per Argument', () => {
    const c = fight({ enemies: ['planner'] });
    playNew(c, 'krule');
    c.enemies[0].move = 'planning';
    endTurn(c);
    expect(c.player.block).toBeGreaterThanOrEqual(3);
    const d = fight();
    playNew(d, 'draft');
    const block = d.player.block;
    playNew(d, 'data');
    expect(d.player.block).toBe(block + 3);
  });

  it('The Cure for Inflation clears every Inflation, everywhere', () => {
    const c = fight();
    c.hand.push({ uid: 901, id: 'inflation', up: false });
    c.draw.push({ uid: 902, id: 'inflation', up: false });
    c.discard.push({ uid: 903, id: 'inflation', up: false });
    playNew(c, 'cure');
    expect([...c.hand, ...c.draw, ...c.discard].some((x) => x.id === 'inflation')).toBe(false);
    expect(c.player.block).toBe(6 + 3 * 3);
  });
});

describe('David’s new cards', () => {
  const david = (over: Partial<FightSetup> = {}) => fight({ deck: deck(CHARACTERS.david.starter), character: 'david', ...over });

  it('Wergild turns damage into Composure', () => {
    const c = david();
    c.enemies[0].block = 0;
    playNew(c, 'wergild');
    expect(c.player.block).toBe(6);
  });

  it('Turf Wars hits three times with 3 Agencies', () => {
    const c = david({ enemies: ['planner'] });
    c.enemies[0].block = 0;
    const hp = c.enemies[0].hp;
    playNew(c, 'turfwar');
    expect(hp - c.enemies[0].hp).toBe(6);
    c.player.status.agency = 3;
    const hp2 = c.enemies[0].hp;
    playNew(c, 'turfwar');
    expect(hp2 - c.enemies[0].hp).toBe(9);
  });

  it('Privatize the Roads grows with the cards played this turn', () => {
    const c = david();
    c.enemies[0].block = 0;
    playNew(c, 'insure');
    playNew(c, 'insure');
    const hp = c.enemies[0].hp;
    playNew(c, 'roads');
    expect(hp - c.enemies[0].hp).toBe(12);
  });

  it('Cash Out a Contract trades an Agency for Airtime, and does nothing without one', () => {
    const c = david();
    c.hand.unshift({ uid: 950, id: 'cashout', up: false });
    c.player.energy = 1;
    playCard(c, 0);
    expect(c.player.energy).toBe(1);
    c.player.status.agency = 1;
    c.hand.unshift({ uid: 951, id: 'cashout', up: false });
    playCard(c, 0);
    expect(c.player.energy).toBe(3);
    expect(c.player.status.agency).toBeUndefined();
  });

  it('Seasteading gives Airtime with 3 or more Agencies', () => {
    const c = david();
    playNew(c, 'seastead');
    c.player.status.agency = 3;
    c.enemies[0].move = 'planning';
    endTurn(c);
    expect(c.player.energy).toBe(c.player.maxEnergy + 1);
  });
});

describe('the new enemies and TV appearances', () => {
  it('every encounter names real enemies, and every enemy turns up somewhere', () => {
    const met = new Set<string>();
    for (const act of Object.values(ENCOUNTERS)) for (const group of [...act.easy, ...act.normal, ...act.elite, [act.boss[0]]]) for (const id of group) {
      expect(ENEMIES[id], id).toBeDefined();
      met.add(id);
    }
    for (const id of ['mmt', 'antiwork', 'cbdc']) expect(met.has(id), id).toBe(true);
  });

  it('the new enemies play through their moves without trouble', () => {
    for (const id of ['mmt', 'antiwork', 'cbdc']) {
      const c = fight({ enemies: [id, 'replyguy'], hp: 999, maxHp: 999 });
      for (let t = 0; t < 8 && !c.result; t++) endTurn(c);
      expect(c.result).not.toBe('lost');
    }
  });

  it('every event gives cards that exist, to the right Friedman', () => {
    for (const ev of EVENTS) {
      for (const ch of ev.choices) {
        for (const e of ch.effects) {
          if (e.kind !== 'card') continue;
          expect(CARDS[e.id], `${ev.id}: ${e.id}`).toBeDefined();
          const who = CARDS[e.id].who ?? 'milton';
          if (CARDS[e.id].type !== 'curse') expect([ev.who ?? 'milton', 'both']).toContain(who);
        }
      }
    }
    expect(EVENTS.filter((e) => (e.who ?? 'milton') === 'milton').length).toBeGreaterThanOrEqual(9);
  });
});
