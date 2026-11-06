import { describe, expect, it } from 'vitest';
import { BALANCE, CHRISTMAS, EVENTS, PRESENT_EFFECTS, STICKERS } from './data.ts';
import { eventsOn, gameDate, isEventActive, seasonKey } from './events.ts';
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
  raidChance,
  raidEvadeBonus,
  secede,
  stickerCost,
  stickerForSale,
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
