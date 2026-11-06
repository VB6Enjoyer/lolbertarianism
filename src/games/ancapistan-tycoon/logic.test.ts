import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, BALANCE, CHARTERS, CHARTER_VALUES, GOLDEN_EFFECTS, PERKS, REGULAR_STICKERS, STICKERS, STICKER_LABELS, STICKER_SETS, UPGRADES } from './data.ts';
import {
  activeBuffs,
  buyCharter,
  citiesAvailable,
  goldenDelayMultiplier,
  offlineSettings,
  raidChance,
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
    expect(buyUpgrade(s, upgrade(1)).count).toBe(1);
    expect(s.score).toBe(5);
    expect(s.owned[1]).toBe(1);
    expect(buyUpgrade(s, upgrade(1)).count).toBe(0);
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
    expect(click(s, 0.5)).toMatchObject({ amount: 1, crit: false });
    expect(click(s, 0.01)).toMatchObject({ amount: 5, crit: true });
    expect(s.stats.clicks).toBe(2);
    expect(s.stats.crits).toBe(1);
    expect(s.allTimeEarnings).toBe(6);
  });
});

describe('secession', () => {
  it('cities follow the configured root of all-time earnings', () => {
    const { divisor, root } = BALANCE.secession;
    expect(citiesFor(divisor - 1)).toBe(0);
    expect(citiesFor(divisor)).toBe(1);
    expect(earningsForCities(10)).toBe(10 ** root * divisor);
    for (const n of [2, 3, 10, 55, 100]) {
      expect(citiesFor(earningsForCities(n))).toBe(n); // exact thresholds don't round down
      expect(citiesFor(earningsForCities(n) - 1)).toBe(n - 1);
    }
  });

  it("can't secede before earning a city", () => {
    const s = newState();
    const almost = earningsForCities(1) / 2;
    earn(s, almost);
    expect(secede(s)).toBe(0);
    expect(s.score).toBe(almost);
  });

  it('resets the run but keeps cities, achievements, lifetime earnings and stats', () => {
    const s = newState();
    const twoCities = earningsForCities(2);
    earn(s, twoCities);
    s.owned = { 1: 5 };
    s.perks = ['su1'];
    s.achievements = ['first-click'];
    s.stats.clicks = 42;
    expect(pendingCities(s)).toBe(2);

    expect(secede(s)).toBe(2);
    expect(s).toMatchObject({ cities: 2, score: 0, runEarnings: 0, owned: {}, perks: [], allTimeEarnings: twoCities });
    expect(s.achievements).toEqual(['first-click']);
    expect(s.stats).toMatchObject({ clicks: 42, secessions: 1 });

    // The third city needs earningsForCities(3) all-time, not another first-city amount.
    expect(pendingCities(s)).toBe(0);
    earn(s, earningsForCities(3) - twoCities);
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
  const firstBuyable = () => REGULAR_STICKERS[0].id;

  it('every sticker starts locked, and all sticker ids are unique', () => {
    expect(newState().stickers).toEqual([]);
    expect(new Set(STICKERS.map((x) => x.id)).size).toBe(STICKERS.length);
  });

  it('prices go from firstCost to lastCost as you buy', () => {
    const s = newState();
    expect(stickerCost(s)).toBe(BALANCE.stickers.firstCost);
    s.score = Infinity;
    for (const x of REGULAR_STICKERS) buySticker(s, x.id);
    expect(s.stickers.length).toBe(REGULAR_STICKERS.length);
    // After buying everything, the price "of the next one" is one step past the last.
    s.stickers.pop();
    expect(stickerCost(s) / BALANCE.stickers.lastCost).toBeCloseTo(1, 6);
    expect(BUYABLE_STICKERS).toBe(REGULAR_STICKERS.length);
  });

  it('buying deducts the price, needs cash, and each sticker can be bought once', () => {
    const s = newState();
    const id = firstBuyable();
    const first = BALANCE.stickers.firstCost; // $10,000
    s.score = first - 1;
    expect(buySticker(s, id)).toBe(false);
    s.score = first + 5_000;
    expect(buySticker(s, id)).toBe(true);
    expect(s.score).toBe(5_000);
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

  it('seceding takes away bought stickers', () => {
    const s = newState();
    earn(s, earningsForCities(2));
    buySticker(s, firstBuyable());
    secede(s);
    expect(s.stickers).toEqual([]);
  });

  it('saves keep the stickers they had (including the old free ones); unknown ids are dropped', () => {
    expect(normalize({}).stickers).toEqual([]);
    expect(normalize({ stickers: ['Taxation is theft!', 'rothbard'] }).stickers).toEqual(['Taxation is theft!', 'rothbard']);
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
    expect(buyUpgrade(s, upgrade(1)).count).toBe(0);
    s.score += 1;
    expect(buyUpgrade(s, upgrade(1)).count).toBe(10);
    expect(s.owned[1]).toBe(10);
    expect(s.score).toBe(0);
  });

  it('MAX buys everything affordable and quotes one copy when broke', () => {
    const s = newState();
    s.buyAmount = 'max';
    expect(purchaseQuote(s, upgrade(1))).toEqual({ count: 1, cost: 15 });
    s.score = bulkCost(upgrade(1), 0, 12) + 5;
    expect(buyUpgrade(s, upgrade(1)).count).toBe(12);
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

describe('charters (prestige shop)', () => {
  const charter = (id: string) => CHARTERS.find((c) => c.id === id)!;
  const T = 1_000_000;
  /** A state that has just seceded with `cities` cities and the given charters. */
  const withCharters = (cities: number, ...ids: string[]) => {
    const s = newState();
    s.cities = cities;
    for (const id of ids) expect(buyCharter(s, charter(id))).toBe(true);
    return s;
  };

  it('costs cities but never lowers the city income bonus', () => {
    const s = newState();
    s.cities = 5;
    s.stickers = [];
    const before = derive(s).globalMultiplier;
    expect(buyCharter(s, charter('private-courts'))).toBe(true); // 2
    expect(buyCharter(s, charter('seed-phrases'))).toBe(true); // 3
    expect(citiesAvailable(s)).toBe(0);
    expect(buyCharter(s, charter('seed-capital'))).toBe(false); // broke
    expect(buyCharter(s, charter('private-courts'))).toBe(false); // already signed
    expect(derive(s).globalMultiplier).toBe(before);
  });

  it('all have unique ids', () => {
    expect(new Set(CHARTERS.map((c) => c.id)).size).toBe(CHARTERS.length);
  });

  it('seed capital and grandfather clause shape every new run', () => {
    const s = withCharters(3, 'seed-capital', 'grandfathered');
    earn(s, earningsForCities(4)); // enough for more cities
    s.owned = { 1: 50, 5: 3 };
    secede(s);
    expect(s.score).toBe(CHARTER_VALUES.seedCapital);
    expect(s.owned).toEqual({ 1: 10, 2: 10 });
    expect(s.runEarnings).toBe(0); // starting cash isn't "earned"
  });

  it("collector's exemption and tenure keep stickers and perks through secession", () => {
    const s = withCharters(13, 'sticker-license', 'tenure');
    earn(s, earningsForCities(14));
    s.stickers = ['hoppe'];
    s.perks = ['su1', 'su2'];
    secede(s);
    expect(s.stickers).toContain('hoppe');
    expect(s.perks).toEqual(['su1', 'su2']);
  });

  it('private courts halve raids; seed phrases speed up golden stickers', () => {
    expect(raidChance(newState())).toBe(BALANCE.raid.chance);
    expect(raidChance(withCharters(2, 'private-courts'))).toBe(BALANCE.raid.chance * 0.5);
    expect(goldenDelayMultiplier(newState())).toBe(1);
    expect(goldenDelayMultiplier(withCharters(3, 'seed-phrases'))).toBe(0.75);
  });

  it('remote management pays 100% offline for up to 24 hours', () => {
    const s = withCharters(3, 'remote-management');
    expect(offlineSettings(s)).toEqual({ rate: 1, maxSeconds: 86400 });
    s.stickers = [];
    s.owned = { 2: 10 };
    s.lastSaved = T;
    const away = offlineEarnings(s, T + 48 * 3600_000);
    expect(away.seconds).toBe(86400);
    expect(away.amount).toBeCloseTo(10 * 1.3 * 86400); // 3 cities = +30% income, 100% rate
  });

  it('secular bull market makes golden boosts last 50% longer', () => {
    const s = withCharters(4, 'long-bull');
    catchGolden(s, GOLDEN_EFFECTS.find((e) => e.id === 'chainsaw')!, T);
    expect(derive(s, T + 44_000).clickBuff).toBe(7); // 30s × 1.5 = 45s
    expect(derive(s, T + 46_000).clickBuff).toBe(1);
  });

  it('competitive suppliers discount upgrades by 10%, single and bulk', () => {
    const s = withCharters(6, 'bulk-discount');
    expect(purchaseQuote(s, upgrade(4)).cost).toBe(Math.ceil(2000 * 0.9));
    s.buyAmount = 10;
    expect(purchaseQuote(s, upgrade(1)).cost).toBe(bulkCost(upgrade(1), 0, 10, 0.9));
    expect(bulkCost(upgrade(1), 0, 10, 0.9)).toBeLessThan(bulkCost(upgrade(1), 0, 10));
  });

  it('lindy and network effects raise the per-achievement and per-city bonuses', () => {
    const s = withCharters(25, 'lindy', 'network-effects');
    s.achievements = ['first-click', 'earn-1k', 'earn-1m'];
    expect(derive(s).globalMultiplier).toBeCloseTo((1 + 25 * 0.15) * (1 + 3 * 0.02));
  });

  it('saves keep valid charters only', () => {
    expect(normalize({ charters: ['tenure', 'fake'] as never }).charters).toEqual(['tenure']);
    expect(normalize({}).charters).toEqual([]);
  });
});

describe('upgrade list', () => {
  it('has unique ids, rising prices and alternates click/passive', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
    for (let i = 1; i < UPGRADES.length; i++) {
      expect(UPGRADES[i].baseCost).toBeGreaterThan(UPGRADES[i - 1].baseCost);
      expect(UPGRADES[i].type).not.toBe(UPGRADES[i - 1].type);
    }
  });

  it('late-game passives pay back their price at a similar rate to Privatize solar system', () => {
    const rate = (id: number) => upgrade(id).income / upgrade(id).baseCost;
    for (const id of [16, 18, 20, 22]) {
      expect(rate(id)).toBeGreaterThanOrEqual(rate(14) * 0.4);
      expect(rate(id)).toBeLessThanOrEqual(rate(14) * 1.01);
    }
  });
});

describe('sticker sets', () => {
  const allOf = (category: string) => STICKERS.filter((x) => x.category === category).map((x) => x.id);
  const base = () => {
    const s = newState();
    s.stickers = [];
    s.owned = { 2: 100 }; // $100/s, $1 clicks
    return s;
  };

  it('a partial set does nothing; a complete one applies its bonus', () => {
    const s = base();
    s.stickers = allOf('person').slice(1);
    const partial = derive(s);
    expect(partial.setIncomeMultiplier).toBe(1);
    s.stickers = allOf('person');
    expect(derive(s).setIncomeMultiplier).toBe(1.25);
    // 29 stickers: +0.5% each (×1.145), then the set's ×1.25
    expect(derive(s).incomePerSec).toBeCloseTo(100 * (1 + 29 * BALANCE.stickers.bonusEach) * 1.25);
    expect(partial.incomePerSec).toBeCloseTo(100 * (1 + 28 * BALANCE.stickers.bonusEach));
  });

  it('quotes boost clicks, items add crit chance', () => {
    const s = base();
    s.stickers = [...allOf('quote'), ...allOf('item')];
    const d = derive(s);
    expect(d.setClickMultiplier).toBe(1.25);
    expect(d.critChance).toBeCloseTo(0.05);
  });

  it('emojis speed up golden stickers and orgs cut raids, stacking with charters', () => {
    const s = base();
    s.stickers = [...allOf('emoji'), ...allOf('organization')];
    s.cities = 5;
    s.charters = ['seed-phrases', 'private-courts'];
    expect(goldenDelayMultiplier(s)).toBeCloseTo(0.75 * 0.85);
    expect(raidChance(s)).toBeCloseTo(BALANCE.raid.chance * 0.5 * 0.75);
  });

  it('every category has exactly one set', () => {
    const cats = new Set(STICKERS.map((x) => x.category));
    expect(STICKER_SETS.map((x) => x.category).sort()).toEqual([...cats].sort());
  });

  it('Completionist Tendencies unlocks at 3 sets', () => {
    const s = base();
    s.stickers = [...allOf('html'), ...allOf('organization'), ...allOf('item')];
    expect(unlockAchievements(s).map((a) => a.id)).toContain('sticker-sets-3');
  });
});

describe('sticker names', () => {
  it('every sticker that is not a quote has a name', () => {
    for (const s of STICKERS.filter((x) => x.type !== 'text')) expect(STICKER_LABELS[s.id]?.name, s.id).toBeTruthy();
  });

  it('every name belongs to a real sticker', () => {
    for (const id of Object.keys(STICKER_LABELS)) expect(STICKERS.some((s) => s.id === id), id).toBe(true);
  });
});
