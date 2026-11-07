import { describe, expect, it } from 'vitest';
import { EVENTS } from './data.ts';
import { HEADLINES, eligibleHeadlines, headlineKey, headlineText, newlyUnlockedHeadlines, pickHeadline, type NewsContext } from './news.ts';

const ctx = (over: Partial<NewsContext> = {}, owned: Record<number, number> = {}): NewsContext => ({
  allTimeEarnings: 0,
  incomePerSec: 0,
  owned: (id) => owned[id] ?? 0,
  cities: 0,
  charters: 0,
  stickers: 5,
  secessions: 0,
  raidsEvaded: 0,
  goldenClicks: 0,
  clicks: 0,
  raidsLost: 0,
  newestCity: null,
  challengesWon: [],
  events: [],
  unlocked: [],
  ...over,
});

const everything = ctx(
  { allTimeEarnings: 1e15, incomePerSec: 1e9, cities: 20, charters: 5, stickers: 77, secessions: 9, raidsEvaded: 12, goldenClicks: 30, clicks: 50_000, raidsLost: 2, newestCity: 'Rothbardia', challengesWon: ['communism'], events: EVENTS.map((e) => e.id) },
  Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i + 1, 10])),
);

describe('news ticker', () => {
  it('progress headlines stay unlocked for good, even once the condition is gone', () => {
    const moon = HEADLINES.find((h) => typeof h.text === 'string' && h.text.startsWith('Moon homesteaded'))!;
    const withMoon = ctx({}, { 12: 1 });
    expect(newlyUnlockedHeadlines(withMoon)).toContain(headlineKey(moon));
    expect(eligibleHeadlines(ctx())).not.toContain(moon); // seceded, no moon, never unlocked
    expect(eligibleHeadlines(ctx({ unlocked: [headlineKey(moon)] }))).toContain(moon); // remembered
    expect(newlyUnlockedHeadlines(ctx({ unlocked: [headlineKey(moon)] }, { 12: 1 }))).not.toContain(headlineKey(moon));
  });

  it('event headlines only run during their event', () => {
    const xmas = HEADLINES.filter((h) => h.when);
    expect(xmas.length).toBeGreaterThan(5);
    for (const h of xmas) expect(h.unlock).toBeUndefined();
    expect(eligibleHeadlines(ctx({ unlocked: HEADLINES.map(headlineKey) })).some((h) => h.when)).toBe(false);
  });

  it('every unlockable headline has a unique key', () => {
    const keys = HEADLINES.filter((h) => h.unlock).map(headlineKey);
    for (const k of keys) expect(k.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('names your newest city', () => {
    expect(eligibleHeadlines(everything).map((h) => headlineText(h, everything))).toContain(
      '"Rothbardia" tops the list of fastest-growing cities. Its top export: people leaving other countries.',
    );
  });

  it('has plenty to say at the very start', () => {
    expect(eligibleHeadlines(ctx()).length).toBeGreaterThanOrEqual(10);
  });

  it('unlocks more headlines with progress, and every headline can appear', () => {
    expect(eligibleHeadlines(everything).length).toBe(HEADLINES.length);
  });

  it('every headline renders to non-empty text', () => {
    for (const h of HEADLINES) expect(headlineText(h, everything).trim().length).toBeGreaterThan(10);
  });

  it('fills in live numbers', () => {
    const texts = HEADLINES.map((h) => headlineText(h, everything));
    expect(texts.some((t) => t.includes('20 Free Private Cities'))).toBe(true);
    expect(texts.some((t) => t.includes('12th time'))).toBe(true);
  });

  it("doesn't repeat a headline until several others have shown", () => {
    const recent: number[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 9; i++) seen.push(pickHeadline(ctx(), recent, (i * 0.37) % 1));
    expect(new Set(seen).size).toBe(9);
  });
});
