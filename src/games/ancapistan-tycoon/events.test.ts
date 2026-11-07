import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { BALANCE, CHRISTMAS, EVENTS, GOLDEN_EFFECTS, PIZZA_EFFECT, PRESENT_EFFECTS, STICKERS } from './data.ts';
import { eventsOn, gameDate, isEventActive, seasonKey, setDateOverride } from './events.ts';
import {
  buySticker,
  catchGolden,
  christmasStickerCost,
  derive,
  earn,
  earningsForCities,
  goldenCash,
  goldenDelayMultiplier,
  newState,
  pickGoldenEffect,
  priceOfSticker,
  raidChance,
  raidEvadeBonus,
  secede,
  stickerCost,
  stickerForSale,
  unlockAchievements,
} from './logic.ts';
import { normalize } from './save.ts';

const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d, 12);
const christmasEvent = EVENTS.find((e) => e.id === 'christmas')!;
const fedBirthday = EVENTS.find((e) => e.id === 'fed-birthday')!;
const christmasStickers = STICKERS.filter((s) => s.season === 'christmas');

describe('event dates', () => {
  it('Christmas runs December 20 to January 1, across New Year', () => {
    expect(isEventActive('christmas', day(12, 19))).toBe(false);
    expect(isEventActive('christmas', day(12, 20))).toBe(true);
    expect(isEventActive('christmas', day(12, 31))).toBe(true);
    expect(isEventActive('christmas', day(1, 1, 2027))).toBe(true);
    expect(isEventActive('christmas', day(1, 2, 2027))).toBe(false);
    expect(isEventActive('christmas', day(7, 1))).toBe(false);
  });

  it("the Fed's birthday is December 23 only, inside Christmas", () => {
    expect(eventsOn(day(12, 23)).map((e) => e.id)).toEqual(['christmas', 'fed-birthday']);
    expect(eventsOn(day(12, 24)).map((e) => e.id)).toEqual(['christmas']);
  });

  it('one popup per season: January 1 belongs to the previous December', () => {
    expect(seasonKey(christmasEvent, day(12, 20))).toBe('christmas-2026');
    expect(seasonKey(christmasEvent, day(1, 1, 2027))).toBe('christmas-2026');
    expect(seasonKey(christmasEvent, day(12, 20, 2027))).toBe('christmas-2027');
    expect(seasonKey(fedBirthday, day(12, 23))).toBe('fed-birthday-2026');
  });

  it('?date= previews a day; anything else means today', () => {
    const preview = gameDate('?date=2026-12-24');
    expect([preview.getFullYear(), preview.getMonth() + 1, preview.getDate()]).toEqual([2026, 12, 24]);
    const real = new Date();
    for (const search of ['', '?date=nope', '?date=2026-1-5']) {
      expect(gameDate(search).toDateString()).toBe(real.toDateString());
    }
  });

  it('every event popup has a title, message, dates and features', () => {
    for (const e of EVENTS) {
      expect(e.popup.title && e.popup.message && e.popup.when, e.id).toBeTruthy();
      expect(e.popup.features.length, e.id).toBeGreaterThan(0);
    }
    expect(christmasEvent.popup.message).toBe('We wish all lolbertarians a Murray Christmas and a Hoppe New Year!');
  });
});

describe('Christmas stickers', () => {
  it('are for sale only during the event', () => {
    const id = christmasStickers[0].id;
    expect(stickerForSale(id, day(11, 6))).toBe(false);
    expect(stickerForSale(id, day(12, 24))).toBe(true);
    const s = newState();
    s.score = 1e9;
    expect(buySticker(s, id, day(11, 6))).toBe(false);
    expect(buySticker(s, id, day(12, 24))).toBe(true);
  });

  it('cost 10 minutes of income (at least $10k) and leave the regular price ladder alone', () => {
    const s = newState();
    s.stickers = [];
    expect(christmasStickerCost(s)).toBe(CHRISTMAS.minStickerCost);
    s.owned = { 2: 1000 }; // $1,000/s → 10 minutes = $600,000
    expect(christmasStickerCost(s)).toBeCloseTo(derive(s).incomePerSec * 600, -1);
    const before = stickerCost(s);
    s.score = 1e12;
    for (const x of christmasStickers) buySticker(s, x.id, day(12, 24));
    expect(stickerCost(s)).toBe(before);
  });

  it('are kept through secession, and the set gives its bonus', () => {
    const s = newState();
    s.score = 1e12;
    for (const x of christmasStickers) buySticker(s, x.id, day(12, 24));
    earn(s, earningsForCities(2));
    secede(s);
    for (const x of christmasStickers) expect(s.stickers).toContain(x.id);
    expect(derive(s).setIncomeMultiplier).toBeCloseTo(1.1);
  });
});

describe('presents', () => {
  it('come sooner at Christmas and draw from the present rewards', () => {
    const s = newState();
    expect(goldenDelayMultiplier(s, day(11, 6))).toBe(1);
    expect(goldenDelayMultiplier(s, day(12, 25))).toBe(CHRISTMAS.presentDelay);
    for (const roll of [0, 0.3, 0.6, 0.99]) expect(PRESENT_EFFECTS).toContain(pickGoldenEffect(roll, PRESENT_EFFECTS));
  });

  it('count as presents opened; Krugerrands pay more and coal pays almost nothing', () => {
    const s = newState();
    s.score = 1e6;
    const coal = PRESENT_EFFECTS.find((e) => e.id === 'fiat-coal')!;
    const gold = PRESENT_EFFECTS.find((e) => e.id === 'krugerrands')!;
    const base = goldenCash(s);
    expect(catchGolden(s, gold)).toBeCloseTo(base * 1.5);
    expect(catchGolden(s, coal)).toBeLessThan(goldenCash(s) * 0.05);
    expect(s.stats.presentsOpened).toBe(2);
    expect(s.stats.goldenClicks).toBe(2);
  });

  it('timed present boosts work like golden ones', () => {
    const s = newState();
    s.stickers = [];
    catchGolden(s, PRESENT_EFFECTS.find((e) => e.id === 'sleigh-ride')!, 1000);
    expect(derive(s, 2000).clickBuff).toBe(7);
  });
});

describe("the Fed's birthday", () => {
  it('doubles raids and pays a minute of income per dodged raid', () => {
    const s = newState();
    s.stickers = [];
    s.owned = { 2: 100 };
    expect(raidChance(s, day(12, 23))).toBeCloseTo(raidChance(s, day(12, 22)) * 2);
    expect(raidEvadeBonus(s, day(12, 22))).toBe(BALANCE.raid.evadeBonus);
    expect(raidEvadeBonus(s, day(12, 23))).toBeCloseTo(Math.max(BALANCE.raid.evadeBonus, derive(s).incomePerSec * 60));
  });
});

describe('event saves', () => {
  it('remember which seasons were greeted, ignoring junk', () => {
    expect(normalize({ seenEvents: ['christmas-2026', 'nope', 42 as never, 'fed-birthday-2026'] }).seenEvents).toEqual([
      'christmas-2026',
      'fed-birthday-2026',
    ]);
  });
});

describe('birthdays and anniversaries', () => {
  const dates: [string, number, number][] = [
    ['birthday-menger', 2, 23],
    ['birthday-rothbard', 3, 2],
    ['birthday-hayek', 5, 8],
    ['birthday-bastiat', 6, 30],
    ['birthday-ronpaul', 8, 20],
    ['birthday-hoppe', 9, 2],
    ['birthday-mises', 9, 29],
    ['bitcoin-genesis', 1, 3],
    ['liberland-day', 4, 13],
    ['pizza-day', 5, 22],
    ['nixon-shock', 8, 15],
  ];

  it('each runs on its day only', () => {
    for (const [id, m, d] of dates) {
      expect(eventsOn(day(m, d)).map((e) => e.id), id).toContain(id);
      expect(eventsOn(day(m, d + 1)).map((e) => e.id), id).not.toContain(id);
    }
  });

  it('every event image exists', () => {
    for (const e of EVENTS) {
      if (e.popup.image) expect(existsSync(`public/vidya/${e.popup.image}`), e.popup.image).toBe(true);
    }
  });

  it('birthdays: +10% income and the person\'s sticker is free to claim', () => {
    const s = newState();
    s.owned = { 2: 100 };
    expect(derive(s, day(3, 2).getTime()).incomePerSec).toBeCloseTo(derive(s, day(3, 3).getTime()).incomePerSec * 1.1);
    expect(priceOfSticker(s, 'rothbard', day(3, 2).getTime())).toBe(0);
    expect(priceOfSticker(s, 'rothbard', day(3, 3).getTime())).toBeGreaterThan(0);
    s.score = 0;
    expect(buySticker(s, 'rothbard', day(3, 2))).toBe(true);
    expect(s.stickers).toContain('rothbard');
  });

  it('Party Animal unlocks at 4 birthdays', () => {
    const s = newState();
    s.stats.birthdaysCelebrated = 3;
    expect(unlockAchievements(s).map((a) => a.id)).not.toContain('party-animal');
    s.stats.birthdaysCelebrated = 4;
    expect(unlockAchievements(s).map((a) => a.id)).toContain('party-animal');
  });

  it('Genesis Block: crypto farms earn ×2', () => {
    const s = newState();
    s.owned = { 6: 10, 2: 10 }; // 250 + 10
    expect(derive(s, day(1, 3).getTime()).income).toBe(500 + 10);
    expect(derive(s, day(1, 4).getTime()).income).toBe(250 + 10);
  });

  it('Liberland Day: a bonus city when seceding, and the Liberland sticker is free', () => {
    const s = newState();
    earn(s, earningsForCities(2));
    expect(secede(s, day(4, 13))).toBe(3);
    expect(s.cities).toBe(3);
    expect(priceOfSticker(s, 'liberland', day(4, 13).getTime())).toBe(0);
  });

  it('Nixon Shock: Golden Standard suspended, golden rewards halved', () => {
    const s = newState();
    s.stickers = [];
    s.perks = ['su2'];
    expect(derive(s, day(8, 15).getTime()).clickAmount).toBe(1);
    expect(derive(s, day(8, 16).getTime()).clickAmount).toBe(2);
    const T = day(8, 15).getTime();
    const wallet = GOLDEN_EFFECTS.find((e) => e.id === 'wallet')!;
    expect(catchGolden(s, wallet, T)).toBeCloseTo(goldenCash(s, T) * 0.5);
    catchGolden(s, GOLDEN_EFFECTS.find((e) => e.id === 'chainsaw')!, T);
    expect(derive(s, T + 14_000).clickBuff).toBe(7);
    expect(derive(s, T + 16_000).clickBuff).toBe(1); // 30s halved to 15s
  });

  it('Pizza Day: two pizzas pay double cash', () => {
    const s = newState();
    s.score = 1e6;
    const T = day(5, 22).getTime();
    expect(catchGolden(s, PIZZA_EFFECT, T)).toBeCloseTo(goldenCash(s, T) * 2, -2);
  });

  it('a preview date set once reaches every rule', () => {
    const s = newState();
    s.owned = { 2: 100 };
    setDateOverride(day(3, 2));
    try {
      expect(derive(s).incomePerSec).toBeCloseTo(100 * 1.1);
      expect(priceOfSticker(s, 'rothbard')).toBe(0);
    } finally {
      setDateOverride(null);
    }
  });
});
