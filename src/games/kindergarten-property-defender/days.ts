// Special days: now and then, a school day isn't like the others.

import { isFriday, PERIOD_LENGTH, PERIODS } from './school.ts';

export type SpecialDayId = 'substitute' | 'picture' | 'field-trip' | 'snow';

export interface SpecialDay {
  id: SpecialDayId;
  icon: string;
  name: string;
  /** What the banner says in the morning. */
  description: string;
}

export const SPECIAL_DAYS: readonly SpecialDay[] = [
  {
    id: 'substitute',
    icon: '🥸',
    name: 'Substitute teacher',
    description: 'The sub got the sleeves mixed up: grabby hands wear green today, and classmates wear red. Read the hands: fists grab, open palms trade.',
  },
  {
    id: 'picture',
    icon: '📸',
    name: 'Picture day',
    description: 'Every so often everyone freezes for the photo (more of them crowd in), then they all rush the pile after the flash.',
  },
  {
    id: 'field-trip',
    icon: '🚌',
    name: 'Field trip',
    description: 'Your pile is on the bus, and the bus won’t stop moving. Follow it.',
  },
  {
    id: 'snow',
    icon: '❄️',
    name: 'Snow day',
    description: 'School lets out early: only three periods today. Less time to lose blocks, and less to earn them.',
  },
];

export const specialById = (id: SpecialDayId) => SPECIAL_DAYS.find((d) => d.id === id)!;

/** Special days start in the second week, a bit under a third of the time. */
export const SPECIAL_FROM = 6;
export const SPECIAL_CHANCE = 0.3;

/** Whether tomorrow is a special day (never a Friday, never two in a row). */
export function rollSpecial(day: number, yesterday: SpecialDayId | null, rng: () => number): SpecialDayId | null {
  if (day < SPECIAL_FROM || isFriday(day) || yesterday) return null;
  if (rng() >= SPECIAL_CHANCE) return null;
  return SPECIAL_DAYS[Math.floor(rng() * SPECIAL_DAYS.length)].id;
}

/** How long the school day is (a snow day is three periods). */
export const dayLength = (special: SpecialDayId | null) => PERIOD_LENGTH * (special === 'snow' ? 3 : PERIODS.length);

/**
 * Picture day: a nine-second cycle. Normal for most of it; then everyone freezes for the photo while
 * more crowd in; then the flash, and they rush.
 */
export type Photo = 'normal' | 'freeze' | 'rush';
export const PHOTO_CYCLE = 9;
export function photoAt(seconds: number): Photo {
  const t = seconds % PHOTO_CYCLE;
  return t < 5.6 ? 'normal' : t < 7.4 ? 'freeze' : 'rush';
}
export const PHOTO_RUSH_SPEED = 2;

/** Field trip: how far the bus has driven from the middle (a share of the screen's width). */
export const busOffset = (seconds: number) => Math.sin(seconds * 0.45) * 0.13 + Math.sin(seconds * 1.1) * 0.03;
