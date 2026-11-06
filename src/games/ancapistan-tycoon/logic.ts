// Game rules as pure functions over a plain state object. No DOM in here,
// so everything can be unit-tested (see logic.test.ts).

import {
  ACHIEVEMENTS,
  BALANCE,
  PERKS,
  STARTER_STICKERS,
  STICKERS,
  UPGRADES,
  type Achievement,
  type AchievementContext,
  type Perk,
  type StickerCategory,
  type Upgrade,
} from './data.ts';

export interface Stats {
  clicks: number;
  crits: number;
  raidsEvaded: number;
  raidsAutoEvaded: number;
  secessions: number;
  reshuffles: number;
  stickersDragged: number;
  offlineCollected: number;
}

export interface GameState {
  score: number;
  /** Earned since the last secession. */
  runEarnings: number;
  /** Earned across every run. Drives Free Private Cities. */
  allTimeEarnings: number;
  /** Free Private Cities (permanent prestige bonus). */
  cities: number;
  /** Upgrade id → copies owned. */
  owned: Record<number, number>;
  /** Purchased perk ids. */
  perks: string[];
  /** Unlocked achievement ids. */
  achievements: string[];
  /** Owned sticker ids (starter stickers included). */
  stickers: string[];
  /** Whether owned stickers are drawn on screen (the bonus applies either way). */
  showStickers: boolean;
  stats: Stats;
  /** Epoch ms of the last save, for offline earnings. 0 = never saved. */
  lastSaved: number;
}

export function newStats(): Stats {
  return {
    clicks: 0,
    crits: 0,
    raidsEvaded: 0,
    raidsAutoEvaded: 0,
    secessions: 0,
    reshuffles: 0,
    stickersDragged: 0,
    offlineCollected: 0,
  };
}

export function newState(): GameState {
  return {
    score: 0,
    runEarnings: 0,
    allTimeEarnings: 0,
    cities: 0,
    owned: {},
    perks: [],
    achievements: [],
    stickers: [...STARTER_STICKERS],
    showStickers: true,
    stats: newStats(),
    lastSaved: 0,
  };
}

// ---------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------

export const ownedCount = (state: GameState, id: number) => state.owned[id] ?? 0;
export const hasPerk = (state: GameState, id: string) => state.perks.includes(id);

/** Price of the next copy of an upgrade. */
export function upgradeCost(upgrade: Upgrade, owned: number): number {
  return Math.ceil(upgrade.baseCost * Math.pow(BALANCE.costGrowth, owned));
}

export interface Derived {
  /** Base click value from click upgrades (starts at 1). */
  clickValue: number;
  /** Base passive income from passive upgrades. */
  income: number;
  clickMultiplier: number;
  critChance: number;
  passiveMultiplier: number;
  incomeToClickPercent: number;
  raidEvasionChance: number;
  /** Bonus from Free Private Cities and achievements; applies to everything. */
  globalMultiplier: number;
  /** Bonus from owned stickers; applies to passive income only. */
  stickerMultiplier: number;
  /** What a normal (non-crit) click earns. */
  clickAmount: number;
  incomePerSec: number;
}

export function derive(state: GameState): Derived {
  let clickValue = 1;
  let income = 0;
  for (const u of UPGRADES) {
    const n = ownedCount(state, u.id);
    if (u.type === 'passive') income += u.income * n;
    else clickValue += u.clickBonus * n;
  }

  let clickMultiplier = 1;
  let critChance = 0;
  let passiveMultiplier = 1;
  let incomeToClickPercent = 0;
  let raidEvasionChance = 0;
  for (const p of PERKS) {
    if (!hasPerk(state, p.id)) continue;
    switch (p.effect) {
      case 'crit':
        critChance += p.value;
        break;
      case 'click_multiplier':
        clickMultiplier *= p.value;
        break;
      case 'passive_multiplier':
        passiveMultiplier *= p.value;
        break;
      case 'income_to_click':
        incomeToClickPercent += p.value;
        break;
      case 'raid_evasion':
        raidEvasionChance += p.value;
        break;
    }
  }

  const globalMultiplier =
    (1 + state.cities * BALANCE.secession.bonusPerCity) *
    (1 + state.achievements.length * BALANCE.bonusPerAchievement);

  const stickerMultiplier = 1 + state.stickers.length * BALANCE.stickers.bonusEach;

  return {
    clickValue,
    income,
    clickMultiplier,
    critChance,
    passiveMultiplier,
    incomeToClickPercent,
    raidEvasionChance,
    globalMultiplier,
    stickerMultiplier,
    clickAmount: (clickValue + income * incomeToClickPercent) * clickMultiplier * globalMultiplier,
    incomePerSec: income * passiveMultiplier * stickerMultiplier * globalMultiplier,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Adds money from any source (clicks, income, bonuses) and tracks lifetime totals. */
export function earn(state: GameState, amount: number): void {
  state.score += amount;
  state.runEarnings += amount;
  state.allTimeEarnings += amount;
}

/** Resolves one click. `roll` is a random number in [0, 1) used for the crit check. */
export function click(state: GameState, roll: number): { amount: number; crit: boolean } {
  const d = derive(state);
  const crit = roll < d.critChance;
  const amount = crit ? d.clickAmount * BALANCE.critMultiplier : d.clickAmount;
  state.stats.clicks++;
  if (crit) state.stats.crits++;
  earn(state, amount);
  return { amount, crit };
}

export function buyUpgrade(state: GameState, upgrade: Upgrade): boolean {
  const cost = upgradeCost(upgrade, ownedCount(state, upgrade.id));
  if (state.score < cost) return false;
  state.score -= cost;
  state.owned[upgrade.id] = ownedCount(state, upgrade.id) + 1;
  return true;
}

export function buyPerk(state: GameState, perk: Perk): boolean {
  if (state.score < perk.cost || hasPerk(state, perk.id)) return false;
  state.score -= perk.cost;
  state.perks.push(perk.id);
  return true;
}

// ---------------------------------------------------------------------------
// Sticker shop
// ---------------------------------------------------------------------------

/** How many stickers can be bought (everything but the free starters). */
export const BUYABLE_STICKERS = STICKERS.length - STARTER_STICKERS.length;

/** Price growth per purchase, so the first costs `firstCost` and the last `lastCost`. */
export const STICKER_COST_GROWTH = Math.pow(
  BALANCE.stickers.lastCost / BALANCE.stickers.firstCost,
  1 / Math.max(1, BUYABLE_STICKERS - 1),
);

/** Price of the next sticker. Depends only on how many you've bought, not which one. */
export function stickerCost(state: GameState): number {
  const bought = state.stickers.filter((id) => !STARTER_STICKERS.includes(id)).length;
  return Math.ceil(BALANCE.stickers.firstCost * Math.pow(STICKER_COST_GROWTH, bought));
}

export const hasSticker = (state: GameState, id: string) => state.stickers.includes(id);

export function buySticker(state: GameState, id: string): boolean {
  if (hasSticker(state, id) || !STICKERS.some((s) => s.id === id)) return false;
  const cost = stickerCost(state);
  if (state.score < cost) return false;
  state.score -= cost;
  state.stickers.push(id);
  return true;
}

export function stickerCategoryComplete(state: GameState, category: StickerCategory): boolean {
  return STICKERS.filter((s) => s.category === category).every((s) => hasSticker(state, s.id));
}

// ---------------------------------------------------------------------------
// Secession (prestige)
// ---------------------------------------------------------------------------

/** Total Free Private Cities earned for a given all-time earnings figure. */
export function citiesFor(allTimeEarnings: number): number {
  return Math.floor(Math.sqrt(Math.max(0, allTimeEarnings) / BALANCE.secession.divisor));
}

/** All-time earnings needed to have earned `cities` cities in total. */
export function earningsForCities(cities: number): number {
  return cities * cities * BALANCE.secession.divisor;
}

/** Cities you'd gain by seceding right now. */
export function pendingCities(state: GameState): number {
  return Math.max(0, citiesFor(state.allTimeEarnings) - state.cities);
}

/**
 * Leaves everything behind to found new Free Private Cities. Keeps cities,
 * achievements, lifetime earnings, stats and the starter stickers. Returns how many cities were gained
 * (0 means you couldn't secede yet and nothing changed).
 */
export function secede(state: GameState): number {
  const gained = pendingCities(state);
  if (gained < 1) return 0;
  state.cities += gained;
  state.score = 0;
  state.runEarnings = 0;
  state.owned = {};
  state.perks = [];
  state.stickers = [...STARTER_STICKERS];
  state.stats.secessions++;
  return gained;
}

// ---------------------------------------------------------------------------
// Offline earnings
// ---------------------------------------------------------------------------

/** What the enterprises made while the tab was closed. */
export function offlineEarnings(state: GameState, now: number): { seconds: number; amount: number } {
  if (!state.lastSaved) return { seconds: 0, amount: 0 };
  const away = Math.floor((now - state.lastSaved) / 1000);
  if (away < BALANCE.offline.minSeconds) return { seconds: 0, amount: 0 };
  const seconds = Math.min(away, BALANCE.offline.maxSeconds);
  return { seconds, amount: derive(state).incomePerSec * seconds * BALANCE.offline.rate };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export function achievementContext(state: GameState): AchievementContext {
  return {
    allTimeEarnings: state.allTimeEarnings,
    incomePerSec: derive(state).incomePerSec,
    owned: (id) => ownedCount(state, id),
    ownsEveryUpgrade: UPGRADES.every((u) => ownedCount(state, u.id) > 0),
    perksOwned: state.perks.length,
    cities: state.cities,
    stickersOwned: state.stickers.length,
    stickerCategoryComplete: (category) => stickerCategoryComplete(state, category),
    stats: state.stats,
  };
}

/** Unlocks any achievements whose conditions are now met and returns them. */
export function unlockAchievements(state: GameState): Achievement[] {
  const ctx = achievementContext(state);
  const unlocked = ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.check(ctx));
  for (const a of unlocked) state.achievements.push(a.id);
  return unlocked;
}
