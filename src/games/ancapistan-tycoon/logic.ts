// Game rules as pure functions over a plain state object. No DOM in here,
// so everything can be unit-tested (see logic.test.ts).

import {
  ACHIEVEMENTS,
  BALANCE,
  GOLDEN_EFFECTS,
  PERKS,
  STARTER_STICKERS,
  STICKERS,
  UPGRADES,
  type Achievement,
  type AchievementContext,
  type GoldenEffect,
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
  goldenClicks: number;
}

/** A timed golden-sticker boost. Not saved: boosts end when the tab closes. */
export interface ActiveBuff {
  effectId: string;
  /** Epoch ms when it runs out. */
  endsAt: number;
}

/** How many copies the shop buys per click. */
export type BuyAmount = 1 | 10 | 'max';

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
  /** Shop setting: buy 1, 10 or as many as you can afford. */
  buyAmount: BuyAmount;
  /** Running golden-sticker boosts. */
  buffs: ActiveBuff[];
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
    goldenClicks: 0,
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
    buyAmount: 1,
    buffs: [],
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
  /** Golden-sticker boosts running right now. */
  clickBuff: number;
  incomeBuff: number;
  /** What a normal (non-crit) click earns. */
  clickAmount: number;
  incomePerSec: number;
}

export function derive(state: GameState, now = Date.now()): Derived {
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

  let clickBuff = 1;
  let incomeBuff = 1;
  for (const { effect } of activeBuffs(state, now)) {
    clickBuff *= effect.clickMultiplier;
    incomeBuff *= effect.incomeMultiplier;
  }

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
    clickBuff,
    incomeBuff,
    clickAmount: (clickValue + income * incomeToClickPercent) * clickMultiplier * globalMultiplier * clickBuff,
    incomePerSec: income * passiveMultiplier * stickerMultiplier * globalMultiplier * incomeBuff,
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
export function click(state: GameState, roll: number, now = Date.now()): { amount: number; crit: boolean } {
  const d = derive(state, now);
  const crit = roll < d.critChance;
  const amount = crit ? d.clickAmount * BALANCE.critMultiplier : d.clickAmount;
  state.stats.clicks++;
  if (crit) state.stats.crits++;
  earn(state, amount);
  return { amount, crit };
}

/** Total price of the next `count` copies, each priced like a single purchase. */
export function bulkCost(upgrade: Upgrade, owned: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += upgradeCost(upgrade, owned + i);
  return total;
}

/** How many copies `cash` can buy in a row (capped so it stays fast). */
export function maxAffordable(upgrade: Upgrade, owned: number, cash: number, cap = 10_000): number {
  let count = 0;
  let total = 0;
  while (count < cap) {
    const next = upgradeCost(upgrade, owned + count);
    if (total + next > cash) break;
    total += next;
    count++;
  }
  return count;
}

/**
 * What the shop would buy right now for the current buy amount: how many copies
 * and the total price. In MAX mode with nothing affordable, it quotes one copy.
 */
export function purchaseQuote(state: GameState, upgrade: Upgrade): { count: number; cost: number } {
  const owned = ownedCount(state, upgrade.id);
  const count =
    state.buyAmount === 'max' ? Math.max(1, maxAffordable(upgrade, owned, state.score)) : state.buyAmount;
  return { count, cost: bulkCost(upgrade, owned, count) };
}

/** Buys the quoted number of copies, or nothing if you can't afford all of them. Returns how many were bought. */
export function buyUpgrade(state: GameState, upgrade: Upgrade): number {
  const { count, cost } = purchaseQuote(state, upgrade);
  if (state.score < cost) return 0;
  state.score -= cost;
  state.owned[upgrade.id] = ownedCount(state, upgrade.id) + count;
  return count;
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
// Golden stickers
// ---------------------------------------------------------------------------

/** Boosts still running at `now`, with their effect data. Expired ones are dropped. */
export function activeBuffs(state: GameState, now = Date.now()): { effect: GoldenEffect; endsAt: number }[] {
  state.buffs = state.buffs.filter((b) => b.endsAt > now);
  return state.buffs.flatMap((b) => {
    const effect = GOLDEN_EFFECTS.find((e) => e.id === b.effectId);
    return effect ? [{ effect, endsAt: b.endsAt }] : [];
  });
}

export const raidsBlocked = (state: GameState, now = Date.now()) =>
  activeBuffs(state, now).some(({ effect }) => effect.noRaids);

/** Picks a reward by weight. `roll` is a random number in [0, 1). */
export function pickGoldenEffect(roll: number): GoldenEffect {
  const total = GOLDEN_EFFECTS.reduce((sum, e) => sum + e.weight, 0);
  let r = roll * total;
  for (const e of GOLDEN_EFFECTS) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return GOLDEN_EFFECTS[GOLDEN_EFFECTS.length - 1];
}

/** The instant-cash reward: min(25% of cash, 15 min of income), but at least 50 clicks' worth. */
export function goldenCash(state: GameState, now = Date.now()): number {
  const d = derive(state, now);
  const g = BALANCE.golden;
  return Math.max(Math.min(state.score * g.cashShareOfScore, d.incomePerSec * g.cashIncomeSeconds), d.clickAmount * g.cashMinClicks);
}

/** Applies a caught golden sticker. Returns the cash paid out (0 for timed boosts). */
export function catchGolden(state: GameState, effect: GoldenEffect, now = Date.now()): number {
  state.stats.goldenClicks++;
  let cash = 0;
  if (effect.cash) {
    cash = goldenCash(state, now);
    earn(state, cash);
  }
  if (effect.durationSec > 0) {
    // Catching the same boost again restarts its timer instead of stacking.
    state.buffs = state.buffs.filter((b) => b.effectId !== effect.id);
    state.buffs.push({ effectId: effect.id, endsAt: now + effect.durationSec * 1000 });
  }
  return cash;
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
  state.buffs = [];
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
  // Golden boosts don't count while you're away.
  return { seconds, amount: derive({ ...state, buffs: [] }).incomePerSec * seconds * BALANCE.offline.rate };
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
