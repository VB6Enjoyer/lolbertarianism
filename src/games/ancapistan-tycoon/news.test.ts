import { describe, expect, it } from 'vitest';
import { EVENTS } from './data.ts';
import { HEADLINES, eligibleHeadlines, headlineText, pickHeadline, type NewsContext } from './news.ts';

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
  events: [],
  ...over,
});

const everything = ctx(
  { allTimeEarnings: 1e15, incomePerSec: 1e9, cities: 20, charters: 5, stickers: 77, secessions: 9, raidsEvaded: 12, goldenClicks: 30, clicks: 50_000, events: EVENTS.map((e) => e.id) },
  Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i + 1, 10])),
);

describe('news ticker', () => {
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
