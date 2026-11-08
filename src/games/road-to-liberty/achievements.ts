// Achievements: earned during runs (or across them), saved with the high scores.
// The Tracker watches each frame's game state and events and reports what's
// newly unlocked; main.ts shows the pop-ups and saves.

import { environment, speedFactor, totalCommies, UNITS_PER_METER, type GameEvent, type GameState } from './logic.ts';
import type { BiomeId } from './biomes.ts';
import { MAX_LEVEL, totalLevels, UPGRADES, type GarageLevels } from './garage.ts';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-commie', icon: '🧔', name: 'Dialectical Materialism', description: 'Run over your first commie.' },
  { id: 'stalin', icon: '🎖️', name: 'Purge the Purger', description: 'Run over Stalin.' },
  { id: 'politburo', icon: '☭', name: 'The Whole Politburo', description: 'Run over Marx, Engels, Lenin, Stalin, Mao and Che in a single run.' },
  { id: 'commies-50', icon: '🏭', name: 'Means of Destruction', description: 'Flatten 50 commies in one run.' },
  { id: 'combo-5', icon: '🔗', name: 'Spontaneous Order', description: 'Reach a ×5 combo.' },
  { id: 'combo-10', icon: '💥', name: 'Creative Destruction', description: 'Reach a ×10 combo.' },
  { id: 'border', icon: '🏁', name: 'Exit Over Voice', description: 'Cross your first border.' },
  { id: 'borders-4', icon: '🗺️', name: 'Panarchist', description: 'Cross 4 borders in one run.' },
  { id: 'snow', icon: '❄️', name: 'Ice Road Ancap', description: 'Make it to the snowfield.' },
  { id: 'all-biomes', icon: '🌍', name: 'Voting With Your Wheels', description: 'See all five landscapes in one run.' },
  { id: 'km-10', icon: '🛣️', name: 'Long Haul', description: 'Drive 10 km in one run.' },
  { id: 'survive-3', icon: '⏳', name: 'Low Time Preference', description: 'Stay free for 3 minutes.' },
  { id: 'survive-5', icon: '🕰️', name: 'Very Low Time Preference', description: 'Stay free for 5 minutes.' },
  { id: 'score-50k', icon: '💵', name: 'Self-Made', description: 'Earn $50,000 in one run.' },
  { id: 'score-100k', icon: '💰', name: 'Robber Baron', description: 'Earn $100,000 in one run.' },
  { id: 'killdozer', icon: '🚜', name: 'Marvin Would Be Proud', description: 'Smash 5 things with a single Killdozer.' },
  { id: 'smoke', icon: '💨', name: 'Now You See Me', description: 'Throw a smoke grenade with the cops less than 20 m behind.' },
  { id: 'close-call', icon: '🚨', name: 'Close Shave', description: 'Let the cops get within 10 m, then pull 100 m ahead.' },
  { id: 'nap', icon: '🕊️', name: 'Non-Aggression Principle', description: 'Drive 2 minutes without crashing into anything.' },
  { id: 'mechanic', icon: '🔧', name: 'Austrian Mechanic', description: 'Repair the car when it can only do 70% or less.' },
  { id: 'fumes', icon: '⛽', name: 'Running on Principle', description: 'Run out of gas and live to find a jerry can.' },
  { id: 'storm', icon: '🌧️', name: 'Dark and Stormy', description: 'Drive through a storm at night.' },
  { id: 'nitro', icon: '🔥', name: 'Hold My NOS', description: 'Fire your first nitro.' },
  { id: 'nitro-5', icon: '🚀', name: 'Supply-Side Boost', description: 'Fire the nitro 5 times in one run.' },
  { id: 'heli', icon: '🚁', name: 'Air Superiority', description: 'Survive IRS Air Support.' },
  { id: 'tank', icon: '🪖', name: 'Tank You Very Much', description: 'Survive the tank.' },
  { id: 'heemeyer', icon: '🚜', name: "Heemeyer's Revenge", description: 'Flatten the tank with the Killdozer.' },
  { id: 'garage-first', icon: '🔧', name: 'First Capital Good', description: 'Buy your first upgrade in the garage.' },
  { id: 'garage-max', icon: '🏎️', name: 'Fully Loaded', description: 'Max out an upgrade.' },
  { id: 'garage-all', icon: '⚙️', name: 'Roundabout Production', description: 'Max out every upgrade in the garage.' },
  { id: 'savings-1m', icon: '💼', name: 'Capital Accumulation', description: 'Save $1,000,000 in total.' },
  { id: 'parade', icon: '🎺', name: 'Parade Crasher', description: 'Flatten 5 commies from parades in one run.' },
  { id: 'toll', icon: '💸', name: 'Toll Evader', description: "Slip through a toll plaza's free lane." },
  { id: 'honk', icon: '📯', name: 'Honk If You Agree', description: 'Honk the horn 10 times in one run.' },
  { id: 'daily', icon: '📅', name: 'Daily Grind', description: 'Finish a daily challenge run.' },
  { id: 'daily-7', icon: '🗓️', name: 'A Week of Liberty', description: 'Play the daily challenge on 7 different days.' },
  { id: 'cars-all', icon: '🚗', name: 'Car Collector', description: 'Unlock every car.' },
  { id: 'hall-of-fame', icon: '🏆', name: 'Hall of Fame', description: 'Make the high-score table.' },
  { id: 'top', icon: '👑', name: 'Out-Rothbarding Rothbard', description: 'Take first place on the high-score table.' },
  { id: 'busts-10', icon: '🚔', name: 'Repeat Offender', description: 'Get busted 10 times.' },
  { id: 'lifetime-500', icon: '📈', name: 'Five-Year Plan, Exceeded', description: 'Flatten 500 commies in total.' },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Counters kept across runs. */
export interface Lifetime {
  busts: number;
  commies: number;
}

const m = (meters: number) => meters * UNITS_PER_METER;

/**
 * Watches a run and unlocks achievements. `unlocked` and `lifetime` are the
 * saved ones and get updated in place.
 */
export class Tracker {
  private biomes = new Set<BiomeId>();
  private lastCrash = 0;
  private smashes = 0;
  private closeCall = false;
  private ranDry = false;
  private lastGap = Infinity;
  private lastFactor = 1;
  private paradeHits = 0;

  constructor(
    readonly unlocked: Set<string>,
    readonly lifetime: Lifetime,
  ) {}

  /** Call at the start of each run. */
  startRun(state: GameState): void {
    this.biomes = new Set([state.biome]);
    this.lastCrash = state.time;
    this.smashes = 0;
    this.closeCall = false;
    this.ranDry = false;
    this.lastGap = state.copGap;
    this.lastFactor = speedFactor(state);
    this.paradeHits = 0;
  }

  private unlock(id: string, found: string[]) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    found.push(id);
  }

  /** Call after each update with its events. Returns the ids unlocked just now. */
  update(state: GameState, events: readonly GameEvent[]): string[] {
    const found: string[] = [];
    const add = (id: string) => this.unlock(id, found);
    if (state.killdozerLeft === 0) this.smashes = 0;

    for (const e of events) {
      switch (e.type) {
        case 'commie':
          add('first-commie');
          if (e.who === 'stalin') add('stalin');
          if (e.parade && ++this.paradeHits >= 5) add('parade');
          break;
        case 'toll-evaded':
          add('toll');
          break;
        case 'horn':
          if (state.honks >= 10) add('honk');
          break;
        case 'crash':
          this.lastCrash = state.time;
          break;
        case 'smash':
          if (++this.smashes >= 5) add('killdozer');
          break;
        case 'power-up':
          if (e.kind === 'smoke' && this.lastGap < m(20)) add('smoke');
          break;
        case 'repair':
          if (this.lastFactor <= 0.7) add('mechanic');
          break;
        case 'out-of-gas':
          this.ranDry = true;
          break;
        case 'fuel':
          if (this.ranDry) add('fumes');
          break;
        case 'border':
          add('border');
          break;
        case 'nitro':
          add('nitro');
          if (state.nitroUsed >= 5) add('nitro-5');
          break;
        case 'boss-survived':
          add(e.kind === 'helicopter' ? 'heli' : 'tank');
          if (e.smashed) add('heemeyer');
          break;
        case 'biome':
          this.biomes.add(e.id);
          if (e.id === 'snow') add('snow');
          break;
      }
    }

    const tally = state.stats.commies;
    if (Object.values(tally).every((n) => n > 0)) add('politburo');
    if (totalCommies(tally) >= 50) add('commies-50');
    if (state.combo >= 5) add('combo-5');
    if (state.combo >= 10) add('combo-10');
    if (state.bordersCrossed >= 4) add('borders-4');
    if (this.biomes.size >= 5) add('all-biomes');
    if (state.stats.meters >= 10_000) add('km-10');
    if (state.time >= 180) add('survive-3');
    if (state.time >= 300) add('survive-5');
    if (state.score >= 50_000) add('score-50k');
    if (state.score >= 100_000) add('score-100k');
    if (state.time - this.lastCrash >= 120) add('nap');
    if (state.copGap < m(10) && !state.over) this.closeCall = true;
    if (this.closeCall && state.copGap > m(100)) add('close-call');
    const env = environment(state.time);
    if (env.daylight < 0.2 && env.rain > 0.5 && state.biome !== 'desert') add('storm');

    this.lastGap = state.copGap;
    this.lastFactor = speedFactor(state);
    return found;
  }

  /** Garage achievements: call after buying something, and at the end of each run. */
  checkGarage(levels: GarageLevels, savingsEarned: number): string[] {
    const found: string[] = [];
    if (totalLevels(levels) > 0) this.unlock('garage-first', found);
    if (UPGRADES.some((u) => levels[u.id] >= MAX_LEVEL)) this.unlock('garage-max', found);
    if (UPGRADES.every((u) => levels[u.id] >= MAX_LEVEL)) this.unlock('garage-all', found);
    if (savingsEarned >= 1_000_000) this.unlock('savings-1m', found);
    return found;
  }

  /** Call when you have every car (after an unlock). */
  checkCars(allUnlocked: boolean): string[] {
    const found: string[] = [];
    if (allUnlocked) this.unlock('cars-all', found);
    return found;
  }

  /**
   * Call when the run ends. `rank` is its place on the high-score table (-1 if
   * it didn't make it); for a daily run, `dailyDays` is how many days you've played one.
   */
  endRun(state: GameState, rank: number, daily: { days: number } | null = null): string[] {
    const found: string[] = [];
    if (daily) {
      this.unlock('daily', found);
      if (daily.days >= 7) this.unlock('daily-7', found);
    }
    this.lifetime.busts++;
    this.lifetime.commies += totalCommies(state.stats.commies);
    if (this.lifetime.busts >= 10) this.unlock('busts-10', found);
    if (this.lifetime.commies >= 500) this.unlock('lifetime-500', found);
    if (rank >= 0) this.unlock('hall-of-fame', found);
    if (rank === 0) this.unlock('top', found);
    return found;
  }
}

/** Cleans up saved achievement ids (unknown ones dropped). */
export function normalizeUnlocked(raw: unknown): Set<string> {
  return new Set((Array.isArray(raw) ? raw : []).filter((id): id is string => typeof id === 'string' && !!achievementById(id)));
}

export function normalizeLifetime(raw: unknown): Lifetime {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  return { busts: n(r.busts), commies: n(r.commies) };
}
