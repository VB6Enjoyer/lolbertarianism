// The Free Market Garage: upgrades bought between runs with your savings
// (every run's earnings go into them). Each has three levels; level 0 is the
// stock car, matching the game's base rules.

export type UpgradeId = 'tires' | 'tank' | 'turbo' | 'nitro' | 'armor' | 'jammer';

export interface Upgrade {
  id: UpgradeId;
  icon: string;
  name: string;
  /** What each level does, in plain words. */
  description: string;
  /** Price of level 1, 2 and 3. */
  costs: readonly [number, number, number];
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'tires', icon: '🛞', name: 'Run-Flat Tires', description: 'Spike strips slow you less and do less lasting damage.', costs: [15_000, 40_000, 100_000] },
  { id: 'tank', icon: '⛽', name: 'Long-Range Tank', description: 'A full tank lasts longer: +25% per level.', costs: [12_000, 35_000, 80_000] },
  { id: 'turbo', icon: '🌀', name: 'Austrian Turbo', description: 'Higher top speed: +3% per level.', costs: [25_000, 60_000, 150_000] },
  { id: 'nitro', icon: '🔥', name: 'Bigger NOS Bottle', description: 'Nitro lasts a second longer and fills faster, per level.', costs: [15_000, 40_000, 100_000] },
  { id: 'armor', icon: '🛡️', name: 'Bull Bar', description: 'Rams, checkpoints and tanks slow you down less.', costs: [20_000, 50_000, 120_000] },
  { id: 'jammer', icon: '📡', name: 'Radar Jammer', description: 'The cops start 30 m further back per level.', costs: [10_000, 30_000, 70_000] },
];

export const MAX_LEVEL = 3;

export type GarageLevels = Record<UpgradeId, number>;

export const stockCar = (): GarageLevels => ({ tires: 0, tank: 0, turbo: 0, nitro: 0, armor: 0, jammer: 0 });

/** Everything about the car that upgrades change. */
export interface CarStats {
  /** Lasting top-speed multiplier per spike strip, and the 5-second slowdown. */
  spikeDamage: number;
  spikeSlow: number;
  /** Seconds a full tank lasts at top speed. */
  fuelSeconds: number;
  /** Top speed multiplier (also applies to boosts and nitro). */
  topSpeed: number;
  /** Nitro: seconds per bottle, and how much a commie fills it (gold fills 40% of that). */
  nitroSeconds: number;
  nitroPerCommie: number;
  /** Cruiser ram slowdown, and the share of speed you keep through a checkpoint or a tank hit. */
  ramSlow: number;
  crashKeep: number;
  /** Extra head start on the cops, in meters. */
  headStart: number;
}

const pick = <T>(values: readonly T[], level: number) => values[Math.max(0, Math.min(MAX_LEVEL, level))];

export function carStats(levels: GarageLevels = stockCar()): CarStats {
  return {
    spikeDamage: pick([0.95, 0.965, 0.98, 0.99], levels.tires),
    spikeSlow: pick([0.9, 0.93, 0.96, 0.98], levels.tires),
    fuelSeconds: pick([80, 100, 120, 140], levels.tank),
    topSpeed: pick([1, 1.03, 1.06, 1.09], levels.turbo),
    nitroSeconds: pick([3, 4, 5, 6], levels.nitro),
    nitroPerCommie: pick([0.25, 0.3, 0.35, 0.4], levels.nitro),
    ramSlow: pick([0.5, 0.6, 0.7, 0.8], levels.armor),
    crashKeep: pick([0.25, 0.4, 0.55, 0.7], levels.armor),
    headStart: pick([0, 30, 60, 90], levels.jammer),
  };
}

/** The price of the next level, or null if it's maxed out. */
export function nextCost(levels: GarageLevels, id: UpgradeId): number | null {
  const level = levels[id];
  if (level >= MAX_LEVEL) return null;
  return UPGRADES.find((u) => u.id === id)!.costs[level];
}

/** Buys the next level if you can afford it. Returns your savings afterwards, or null if you couldn't. */
export function buyUpgrade(levels: GarageLevels, id: UpgradeId, savings: number): number | null {
  const cost = nextCost(levels, id);
  if (cost === null || savings < cost) return null;
  levels[id]++;
  return savings - cost;
}

export function normalizeLevels(raw: unknown): GarageLevels {
  const levels = stockCar();
  if (raw && typeof raw === 'object') {
    for (const u of UPGRADES) {
      const v = Math.floor(Number((raw as Record<string, unknown>)[u.id]) || 0);
      levels[u.id] = Math.max(0, Math.min(MAX_LEVEL, v));
    }
  }
  return levels;
}

export const totalLevels = (levels: GarageLevels) => Object.values(levels).reduce((a, b) => a + b, 0);
