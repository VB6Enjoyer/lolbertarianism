// Seasonal events: which ones are running on a given date. Pure date logic, no DOM.

import { EVENTS, type EventEffects, type EventId, type GameEvent } from './data.ts';

let dateOverride: Date | null = null;

/** Pretend today is another day (for `?date=` previews). null goes back to the real date. */
export function setDateOverride(date: Date | null): void {
  dateOverride = date;
}

/** The calendar day the game treats as today: the real one, or the preview date at the current time. */
export function calendarDate(now = Date.now()): Date {
  const real = new Date(now);
  if (!dateOverride) return real;
  return new Date(dateOverride.getFullYear(), dateOverride.getMonth(), dateOverride.getDate(), real.getHours(), real.getMinutes());
}

const dayOfYear = (month: number, day: number) => month * 100 + day; // 1225 = Dec 25; only used for comparisons

/** Whether the event runs on this date (local time). Handles events that wrap past New Year. */
export function isEventOn(event: GameEvent, date: Date): boolean {
  const today = dayOfYear(date.getMonth() + 1, date.getDate());
  const start = dayOfYear(...event.start);
  const end = dayOfYear(...event.end);
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}

/** The events running on this date. */
export function eventsOn(date: Date): GameEvent[] {
  return EVENTS.filter((e) => isEventOn(e, date));
}

export const isEventActive = (id: EventId, date: Date = calendarDate()) => eventsOn(date).some((e) => e.id === id);

/** The effects of every event running on this date, combined. */
export function eventEffects(date: Date = calendarDate()): Required<Pick<EventEffects, 'incomeMultiplier' | 'goldenCashMultiplier' | 'goldenDurationMultiplier' | 'secessionBonusCities'>> &
  Pick<EventEffects, 'goldenTheme'> & { upgradeIncome: Record<number, number>; giftStickers: string[]; suspendedPerks: string[] } {
  const fx = {
    incomeMultiplier: 1,
    goldenCashMultiplier: 1,
    goldenDurationMultiplier: 1,
    secessionBonusCities: 0,
    goldenTheme: undefined as EventEffects['goldenTheme'],
    upgradeIncome: {} as Record<number, number>,
    giftStickers: [] as string[],
    suspendedPerks: [] as string[],
  };
  for (const { effects: e } of eventsOn(date)) {
    if (!e) continue;
    fx.incomeMultiplier *= e.incomeMultiplier ?? 1;
    fx.goldenCashMultiplier *= e.goldenCashMultiplier ?? 1;
    fx.goldenDurationMultiplier *= e.goldenDurationMultiplier ?? 1;
    fx.secessionBonusCities += e.secessionBonusCities ?? 0;
    fx.goldenTheme ??= e.goldenTheme;
    for (const [id, m] of Object.entries(e.upgradeIncome ?? {})) fx.upgradeIncome[Number(id)] = (fx.upgradeIncome[Number(id)] ?? 1) * m;
    if (e.giftSticker) fx.giftStickers.push(e.giftSticker);
    if (e.suspendPerk) fx.suspendedPerks.push(e.suspendPerk);
  }
  return fx;
}

/**
 * A key for one season of an event, so its popup shows once per season.
 * Days in January that belong to a December event count as the previous year's
 * season (Jan 1 is still Christmas 2026).
 */
export function seasonKey(event: GameEvent, date: Date): string {
  const wraps = dayOfYear(...event.end) < dayOfYear(...event.start);
  const inJanuaryTail = wraps && date.getMonth() + 1 <= event.end[0];
  return `${event.id}-${date.getFullYear() - (inJanuaryTail ? 1 : 0)}`;
}

/**
 * The date the game treats as "today". `?date=2026-12-24` in the page URL
 * previews an event on any day; otherwise it's the real date.
 */
export function gameDate(search = typeof location === 'undefined' ? '' : location.search): Date {
  const param = new URLSearchParams(search).get('date');
  const match = param?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return calendarDate();
  const now = new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), now.getHours(), now.getMinutes());
}
