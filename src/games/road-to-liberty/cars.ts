// Cars you can drive: the Liberty Sedan from the start, and four more you
// unlock with achievements. Each has its own cockpit colors, horn and a small
// handling quirk on top of your garage upgrades.

import type { CarStats } from './garage.ts';

export type CarId = 'sedan' | 'galt' | 'pickup' | 'trabant' | 'mustang';

export interface Car {
  id: CarId;
  icon: string;
  name: string;
  description: string;
  /** The achievement that unlocks it (null: you start with it). */
  unlockedBy: string | null;
  /** Changes on top of the garage's stats. */
  tweak: (stats: CarStats) => CarStats;
  /** Cockpit look: dashboard and interior colors, the steering wheel's badge. */
  theme: { dash: string; dashDark: string; interior: string; hub: string; hubColor: string };
  /** Horn notes (Hz), played together. */
  horn: readonly number[];
  /** Engine sound: oscillator wave and pitch range. */
  engine: { wave: OscillatorType; low: number; high: number };
}

export const CARS: readonly Car[] = [
  {
    id: 'sedan',
    icon: '🚘',
    name: 'Liberty Sedan',
    description: 'The trusty getaway car. Nothing fancy, nothing missing.',
    unlockedBy: null,
    tweak: (s) => s,
    theme: { dash: '#2c2c2c', dashDark: '#141414', interior: '#232323', hub: '🐍', hubColor: '#f7d02c' },
    horn: [440, 554],
    engine: { wave: 'sawtooth', low: 45, high: 140 },
  },
  {
    id: 'galt',
    icon: '⚡',
    name: 'Galt Motors Model R',
    description: 'Electric, silent and smug. 30% more range and a longer nitro.',
    unlockedBy: 'score-100k',
    tweak: (s) => ({ ...s, fuelSeconds: s.fuelSeconds * 1.3, nitroSeconds: s.nitroSeconds + 1 }),
    theme: { dash: '#dfe6ec', dashDark: '#9aa7b2', interior: '#c9d2d9', hub: '⚡', hubColor: '#4fc3f7' },
    horn: [660, 880],
    engine: { wave: 'sine', low: 200, high: 520 },
  },
  {
    id: 'pickup',
    icon: '🛻',
    name: 'Gadsden Pickup',
    description: 'Built like a homestead. Shrugs off rams and checkpoints, a bit slower.',
    unlockedBy: 'tank',
    tweak: (s) => ({ ...s, ramSlow: Math.min(0.9, s.ramSlow + 0.15), crashKeep: Math.min(0.85, s.crashKeep + 0.15), topSpeed: s.topSpeed * 0.97 }),
    theme: { dash: '#5d4037', dashDark: '#3e2723', interior: '#4e342e', hub: '🐍', hubColor: '#f7d02c' },
    horn: [220, 277],
    engine: { wave: 'sawtooth', low: 35, high: 110 },
  },
  {
    id: 'trabant',
    icon: '🚙',
    name: 'Seized Trabant',
    description: 'Liberated from East Germany. Slow and smoky, but commies are worth 50% more in it.',
    unlockedBy: 'politburo',
    tweak: (s) => ({ ...s, topSpeed: s.topSpeed * 0.92, commieBonus: s.commieBonus * 1.5 }),
    theme: { dash: '#8fa3a8', dashDark: '#5f7378', interior: '#7e8f93', hub: '☭', hubColor: '#c62828' },
    horn: [330, 349],
    engine: { wave: 'square', low: 60, high: 120 },
  },
  {
    id: 'mustang',
    icon: '🏎️',
    name: 'Mises Mustang',
    description: 'Pure muscle: 5% more top speed, but it handles like a planned economy.',
    unlockedBy: 'borders-4',
    tweak: (s) => ({ ...s, topSpeed: s.topSpeed * 1.05, steering: s.steering * 0.85 }),
    theme: { dash: '#1a1a1a', dashDark: '#000000', interior: '#7f0000', hub: '🐎', hubColor: '#c62828' },
    horn: [392, 494, 587],
    engine: { wave: 'sawtooth', low: 40, high: 160 },
  },
];

export const carById = (id: string): Car => CARS.find((c) => c.id === id) ?? CARS[0];

/** Whether you can drive a car, given your unlocked achievements. */
export const carUnlocked = (car: Car, achievements: ReadonlySet<string>) => car.unlockedBy === null || achievements.has(car.unlockedBy);
