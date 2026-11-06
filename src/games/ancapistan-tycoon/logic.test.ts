import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, BALANCE, GOLDEN_EFFECTS, PERKS, STARTER_STICKERS, STICKERS, UPGRADES } from './data.ts';
import {
  activeBuffs,
  bulkCost,
  catchGolden,
  maxAffordable,
  pickGoldenEffect,
  purchaseQuote,
  raidsBlocked,
  BUYABLE_STICKERS,
  buyPerk,
  buySticker,
  buyUpgrade,
  citiesFor,
  click,
  derive,
  earn,
  earningsForCities,
  newState,
  offlineEarnings,
  pendingCities,
  secede,
  stickerCost,
  unlockAchievements,
  upgradeCost,
} from './logic.ts';
import { migrateV1, normalize, spentOn } from './save.ts';

const upgrade = (id: number) => UPGRADES.find((u) => u.id === id)!;
const perk = (id: string) => PERKS.find((p) => p.id === id)!;

describe('upgrade costs', () => {
  it('grow 15% per copy, rounded up, like the original game', () => {
    expect(upgradeCost(upgrade(1), 0)).toBe(15);
    expect(upgradeCost(upgrade(1), 1)).toBe(Math.ceil(15 * 1.15));
    expect(upgradeCost(upgrade(1), 10)).toBe(Math.ceil(15 * 1.15 ** 10));
  });

  it('buying deducts the price and needs enough cash', () => {
    const s = newState();
    s.score = 20;
    expect(buyUpgrade(s, upgrade(1))).toBe(1);
    expect(s.score).toBe(5);
    expect(s.owned[1]).toBe(1);
    expect(buyUpgrade(s, upgrade(1))).toBe(0);
    expect(s.owned[1]).toBe(1);
  });

  it('perks can only be bought once', () => {
    const s = newState();
    s.score = 1e9;
    expect(buyPerk(s, perk('su2'))).toBe(true);
    expect(buyPerk(s, perk('su2'))).toBe(false);
    expect(s.score).toBe(1e9 - perk('su2').cost);
  });
});

describe('derived stats match the original formulas', () => {
  it('starts at $1 per click and no income', () => {
    const d = derive(newState());
    expect(d.clickAmount).toBe(1);
    expect(d.incomePerSec).toBe(0);
  });

  it('adds click bonuses and passive income per copy owned', () => {
    const s = newState();
    s.owned = { 1: 3, 2: 4, 4: 1 }; // books, lemonade, raw milk
    const d = derive(s);
    expect(d.clickValue).toBe(1 + 3);
    expect(d.income).toBe(4 + 10);
  });

  it('applies perks: click multiplier, passive multiplier, income-to-click, crit, evasion', () => {
    const s = newState();
    s.owned = { 1: 9, 2: 100 }; // click value 10, income 100
    s.stickers = []; // isolate perk math from the sticker bonus
    s.perks = ['su1', 'su2', 'su3', 'su4', 'su5', 'su6'];
    const d = derive(s);
    expect(d.critChance).toBeCloseTo(0.15);
    expect(d.raidEvasionChance).toBe(0.5);
    expect(d.incomePerSec).toBe(100 * 1.5);
    // (clickValue + income × 1%) × 2, as in the original clickMain
    expect(d.clickAmount).toBeCloseTo((10 + 100 * 0.01) * 2);
  });

  it('cities and achievements multiply everything', () => {
    const s = newState();
    s.owned = { 2: 10 };
    s.stickers = [];
    s.cities = 3;
    s.achievements = ['first-click', 'earn-1k'];
    const expected = (1 + 3 * BALANCE.secession.bonusPerCity) * (1 + 2 * BALANCE.bonusPerAchievement);
    expect(derive(s).globalMultiplier).toBeCloseTo(expected);
    expect(derive(s).incomePerSec).toBeCloseTo(10 * expected);
  });
});

describe('clicking', () => {
  it('crits pay 5x when the roll is under the crit chance', () => {
    const s = newState();
    s.perks = ['su1']; // 5% crit
    expect(click(s, 0.5)).toEqual({ amount: 1, crit: false });
    expect(click(s, 0.01)).toEqual({ amount: 5, crit: true });
    expect(s.stats.clicks).toBe(2);
    expect(s.stats.crits).toBe(1);
    expect(s.allTimeEarnings).toBe(6);
  });
});

describe('secession', () => {
  it('cities grow with the square root of all-time earnings', () => {
    expect(citiesFor(999_999)).toBe(0);
    expect(citiesFor(1e6)).toBe(1);
    expect(citiesFor(100e6)).toBe(10);
    expect(earningsForCities(10)).toBe(100e6);
  });

  it("can't secede before earning a city", () => {
    const s = newState();
    earn(s, 500_000);
    expect(secede(s)).toBe(0);
    expect(s.score).toBe(500_000);
  });

  it('resets the run but keeps cities, achievements, lifetime earnings and stats', () => {
    const s = newState();
    earn(s, 4e6);
    s.owned = { 1: 5 };
    s.perks = ['su1'];
    s.achievements = ['first-click'];
    s.stats.clicks = 42;
    expect(pendingCities(s)).toBe(2);

    expect(secede(s)).toBe(2);
    expect(s).toMatchObject({ cities: 2, score: 0, runEarnings: 0, owned: {}, perks: [], allTimeEarnings: 4e6 });
    expect(s.achievements).toEqual(['first-click']);
    expect(s.stats).toMatchObject({ clicks: 42, secessions: 1 });

    // The next city needs 9M all-time, not another 1M.
    expect(pendingCities(s)).toBe(0);
    earn(s, 5e6);
    expect(pendingCities(s)).toBe(1);
  });
});

describe('offline earnings', () => {
  const withIncome = () => {
    const s = newState();
    s.owned = { 2: 10 }; // $10/s
    s.stickers = [];
    s.lastSaved = 1_000_000;
    return s;
  };

  it('pays the offline rate for time away', () => {
    const s = withIncome();
    const { seconds, amount } = offlineEarnings(s, s.lastSaved + 3600 * 1000);
    expect(seconds).toBe(3600);
    expect(amount).toBe(10 * 3600 * BALANCE.offline.rate);
  });

  it('caps the time away', () => {
    const s = withIncome();
    expect(offlineEarnings(s, s.lastSaved + 48 * 3600 * 1000).seconds).toBe(BALANCE.offline.maxSeconds);
  });

  it('ignores short absences and brand-new games', () => {
    const s = withIncome();
    expect(offlineEarnings(s, s.lastSaved + 30 * 1000).amount).toBe(0);
    expect(offlineEarnings(newState(), Date.now()).amount).toBe(0);
  });
});

describe('achievements', () => {
  it('unlock once and are reported only when new', () => {
    const s = newState();
    click(s, 0.9);
    expect(unlockAchievements(s).map((a) => a.id)).toEqual(['first-click']);
    expect(unlockAchievements(s)).toEqual([]);
  });

  it('all have unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('saves', () => {
  it('migrates v1 saves and credits what was already spent', () => {
    const state = migrateV1({
      score: 1000,
      upgrades: [{ id: 1, owned: 2 }, { id: 2, owned: 0 }, { id: 999, owned: 5 }],
      specialUpgrades: [{ id: 'su1', purchased: true }, { id: 'su2', purchased: false }],
    });
    expect(state.score).toBe(1000);
    expect(state.owned).toEqual({ 1: 2 });
    expect(state.perks).toEqual(['su1']);
    const spent = 15 + Math.ceil(15 * 1.15) + perk('su1').cost;
    expect(spentOn(state.owned, state.perks)).toBe(spent);
    expect(state.allTimeEarnings).toBe(1000 + spent);
  });

  it('normalizes damaged saves instead of crashing', () => {
    const state = normalize({
      score: -5,
      cities: Number.NaN,
      owned: { 1: 3, 999: 4 } as Record<number, number>,
      perks: ['su1', 'nope'],
      achievements: ['first-click', 'made-up'],
      stats: { clicks: 7 } as never,
    });
    expect(state.score).toBe(0);
    expect(state.cities).toBe(0);
    expect(state.owned).toEqual({ 1: 3 });
    expect(state.perks).toEqual(['su1']);
    expect(state.achievements).toEqual(['first-click']);
    expect(state.stats.clicks).toBe(7);
    expect(state.stats.crits).toBe(0);
  });
});

describe('sticker shop', () => {
  const firstBuyable = () => STICKERS.find((x) => !STARTER_STICKERS.includes(x.id))!.id;

  it('starts with the starter pack and all sticker ids are unique', () => {
    expect(newState().stickers).toEqual([...STARTER_STICKERS]);
    expect(new Set(STICKERS.map((x) => x.id)).size).toBe(STICKERS.length);
    for (const id of STARTER_STICKERS) expect(STICKERS.some((x) => x.id === id)).toBe(true);
  });

  it('prices go from firstCost to lastCost as you buy', () => {
    const s = newState();
    expect(stickerCost(s)).toBe(BALANCE.stickers.firstCost);
    s.score = Infinity;
    for (const x of STICKERS) buySticker(s, x.id);
    expect(s.stickers.length).toBe(STICKERS.length);
    // After buying everything, the price "of the next one" is one step past the last.
    s.stickers.pop();
    expect(stickerCost(s) / BALANCE.stickers.lastCost).toBeCloseTo(1, 6);
    expect(BUYABLE_STICKERS).toBe(STICKERS.length - STARTER_STICKERS.length);
  });

  it('buying deducts the price, needs cash, and each sticker can be bought once', () => {
    const s = newState();
    const id = firstBuyable();
    s.score = 99_999;
    expect(buySticker(s, id)).toBe(false);
    s.score = 250_000;
    expect(buySticker(s, id)).toBe(true);
    expect(s.score).toBe(150_000);
    expect(buySticker(s, id)).toBe(false);
    expect(buySticker(s, 'not-a-sticker')).toBe(false);
  });

  it('each sticker adds 0.5% to passive income only', () => {
    const s = newState();
    s.owned = { 2: 100 }; // $100/s
    s.stickers = STICKERS.slice(0, 20).map((x) => x.id);
    const d = derive(s);
    expect(d.incomePerSec).toBeCloseTo(100 * (1 + 20 * BALANCE.stickers.bonusEach));
    expect(d.clickAmount).toBe(1);
  });

  it('seceding resets bought stickers back to the starter pack', () => {
    const s = newState();
    earn(s, 4e6);
    buySticker(s, firstBuyable());
    secede(s);
    expect(s.stickers).toEqual([...STARTER_STICKERS]);
  });

  it('older saves get the starter pack; unknown ids are dropped', () => {
    expect(normalize({}).stickers).toEqual(STICKERS.filter((x) => STARTER_STICKERS.includes(x.id)).map((x) => x.id));
    const n = normalize({ stickers: ['hoppe', 'bogus'], showStickers: false });
    expect(n.stickers).toContain('hoppe');
    expect(n.stickers).not.toContain('bogus');
    expect(n.showStickers).toBe(false);
  });
});

describe('buy ×10 / MAX', () => {
  it('bulk cost is the sum of single purchases', () => {
    const u = upgrade(2);
    let sum = 0;
    for (let i = 3; i < 13; i++) sum += upgradeCost(u, i);
    expect(bulkCost(u, 3, 10)).toBe(sum);
  });

  it('max affordable buys as many as the cash covers', () => {
    const u = upgrade(1);
    const cash = bulkCost(u, 0, 7);
    expect(maxAffordable(u, 0, cash)).toBe(7);
    expect(maxAffordable(u, 0, cash - 1)).toBe(6);
    expect(maxAffordable(u, 0, 0)).toBe(0);
  });

  it('×10 buys ten at once, or nothing if you cannot afford all ten', () => {
    const s = newState();
    s.buyAmount = 10;
    s.score = bulkCost(upgrade(1), 0, 10) - 1;
    expect(buyUpgrade(s, upgrade(1))).toBe(0);
    s.score += 1;
    expect(buyUpgrade(s, upgrade(1))).toBe(10);
    expect(s.owned[1]).toBe(10);
    expect(s.score).toBe(0);
  });

  it('MAX buys everything affordable and quotes one copy when broke', () => {
    const s = newState();
    s.buyAmount = 'max';
    expect(purchaseQuote(s, upgrade(1))).toEqual({ count: 1, cost: 15 });
    s.score = bulkCost(upgrade(1), 0, 12) + 5;
    expect(buyUpgrade(s, upgrade(1))).toBe(12);
    expect(s.score).toBe(5);
  });
});

describe('golden stickers', () => {
  const effect = (id: string) => GOLDEN_EFFECTS.find((e) => e.id === id)!;
  const T = 1_000_000;

  it('picks rewards by weight across the whole roll range', () => {
    const total = GOLDEN_EFFECTS.reduce((n, e) => n + e.weight, 0);
    expect(pickGoldenEffect(0).id).toBe(GOLDEN_EFFECTS[0].id);
    expect(pickGoldenEffect(0.999999).id).toBe(GOLDEN_EFFECTS[GOLDEN_EFFECTS.length - 1].id);
    expect(pickGoldenEffect((GOLDEN_EFFECTS[0].weight + 0.01) / total).id).toBe(GOLDEN_EFFECTS[1].id);
  });

  it('timed boosts multiply clicks or income until they expire', () => {
    const s = newState();
    s.stickers = [];
    s.owned = { 2: 10 };
    catchGolden(s, effect('chainsaw'), T);
    catchGolden(s, effect('bull-run'), T);
    expect(derive(s, T + 1000).clickAmount).toBe(7);
    expect(derive(s, T + 1000).incomePerSec).toBe(30);
    expect(derive(s, T + 31_000).clickAmount).toBe(1); // chainsaw over
    expect(derive(s, T + 31_000).incomePerSec).toBe(30); // bull run still on
    expect(derive(s, T + 61_000).incomePerSec).toBe(10);
    expect(s.stats.goldenClicks).toBe(2);
  });

  it('catching the same boost again restarts it instead of stacking', () => {
    const s = newState();
    catchGolden(s, effect('chainsaw'), T);
    catchGolden(s, effect('chainsaw'), T + 20_000);
    expect(activeBuffs(s, T + 40_000)).toHaveLength(1);
    expect(derive(s, T + 40_000).clickBuff).toBe(7);
  });

  it('tax holiday blocks raids while it lasts', () => {
    const s = newState();
    catchGolden(s, effect('tax-holiday'), T);
    expect(raidsBlocked(s, T + 1000)).toBe(true);
    expect(raidsBlocked(s, T + 46_000)).toBe(false);
  });

  it('the wallet pays min(25% of cash, 15 min of income), at least 50 clicks', () => {
    const s = newState();
    s.stickers = [];
    s.owned = { 2: 10 }; // $10/s → 15 min = 9000
    s.score = 1e6;
    expect(catchGolden(s, effect('wallet'), T)).toBe(9000);
    const broke = newState();
    expect(catchGolden(broke, effect('wallet'), T)).toBe(50); // 50 × $1 clicks
    expect(broke.allTimeEarnings).toBe(50);
  });

  it('boosts are not saved and do not count toward offline earnings', () => {
    const s = newState();
    s.stickers = [];
    s.owned = { 2: 10 };
    s.lastSaved = T;
    catchGolden(s, effect('bull-run'), T);
    expect(offlineEarnings(s, T + 3600_000).amount).toBe(10 * 3600 * BALANCE.offline.rate);
    expect(normalize({ ...s }).buffs).toEqual([]);
  });
});
