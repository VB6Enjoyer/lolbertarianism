import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './data.ts';
import { newGame } from './game.ts';
import { buy, emptyShop, EVOLUTION_PRICE, HEAT, heatBonus, loadShop, price, setupFor, toggleHeat, totalCost, UPGRADES } from './shop.ts';

describe('the Free Market', () => {
  it('sells upgrades rank by rank, only for Bitcoin you have', () => {
    const s = emptyShop();
    expect(buy(s, { kind: 'upgrade', id: 'grit' })).toBe(false);
    s.bank = 1000;
    const costs = UPGRADES.grit.costs;
    for (let i = 0; i < costs.length; i++) {
      expect(price(s, { kind: 'upgrade', id: 'grit' })).toBe(costs[i]);
      expect(buy(s, { kind: 'upgrade', id: 'grit' })).toBe(true);
    }
    expect(price(s, { kind: 'upgrade', id: 'grit' })).toBeNull();
    expect(buy(s, { kind: 'upgrade', id: 'grit' })).toBe(false);
    expect(s.bank).toBe(1000 - costs.reduce((a, b) => a + b, 0));
  });

  it('cards, weapon upgrades and regulations are bought once', () => {
    const s = emptyShop();
    s.bank = 5000;
    expect(buy(s, { kind: 'card', id: 'happening' })).toBe(true);
    expect(buy(s, { kind: 'card', id: 'happening' })).toBe(false);
    expect(price(s, { kind: 'evolution', id: 'agorist' })).toBe(EVOLUTION_PRICE);
    expect(buy(s, { kind: 'evolution', id: 'agorist' })).toBe(true);
    expect(buy(s, { kind: 'heat', id: 'printer' })).toBe(true);
    expect(s.heatOn).toEqual(['printer']); // switched on when bought
    expect(toggleHeat(s, 'printer')).toBe(true);
    expect(s.heatOn).toEqual([]);
    expect(toggleHeat(s, 'redtape')).toBe(false); // not owned
  });

  it('turns into a run: upgrades, cards, the weapon upgrade, and regulations that pay more', () => {
    const s = emptyShop();
    s.bank = 99999;
    for (let i = 0; i < 2; i++) buy(s, { kind: 'upgrade', id: 'grit' });
    buy(s, { kind: 'upgrade', id: 'armor' });
    buy(s, { kind: 'upgrade', id: 'reroll' });
    buy(s, { kind: 'upgrade', id: 'greed' });
    buy(s, { kind: 'card', id: 'sound' });
    buy(s, { kind: 'evolution', id: 'minarchist' });
    buy(s, { kind: 'heat', id: 'printer' });
    buy(s, { kind: 'heat', id: 'wealthtax' });
    const setup = setupFor(s, 'minarchist');
    expect(setup.canEvolve).toBe(true);
    expect(setupFor(s, 'ancap').canEvolve).toBe(false);
    expect(setup.unlocked).toEqual(['sound']);
    const g = newGame(1, 'minarchist', setup);
    expect(g.player.maxHp).toBe(CHARACTERS.minarchist.hp + 20);
    expect(g.player.armor).toBe(CHARACTERS.minarchist.armor + 1);
    expect(g.rerolls).toBe(1);
    expect(g.mods.enemyHp).toBe(1.5);
    expect(g.mods.hurt).toBe(1.5);
    expect(heatBonus(s)).toBeCloseTo(1 + HEAT.printer.bonus + HEAT.wealthtax.bonus);
    expect(g.mods.gold).toBeCloseTo(1.1 * heatBonus(s));
  });

  it('reads old and broken saves safely', () => {
    // Before the shop, Bitcoin only piled up: it becomes spendable.
    expect(loadShop(undefined, 140).bank).toBe(140);
    const s = loadShop({ bank: '50', upgrades: { grit: 99, might: -3, nope: 2 }, cards: ['sound', 'sound', 'bogus'], heatOwned: ['printer'], heatOn: ['printer', 'redtape'] });
    expect(s.bank).toBe(50);
    expect(s.upgrades).toEqual({ grit: UPGRADES.grit.costs.length });
    expect(s.cards).toEqual(['sound']);
    expect(s.heatOn).toEqual(['printer']); // can't have one on that you don't own
  });

  it('takes a few dozen runs to buy everything', () => {
    expect(totalCost()).toBeGreaterThan(4000);
    expect(totalCost()).toBeLessThan(12000);
  });
});
