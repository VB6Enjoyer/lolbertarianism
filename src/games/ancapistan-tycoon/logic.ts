// Game rules as pure functions over a plain state object. No DOM in here,
// so everything can be unit-tested (see logic.test.ts).

import { calendarDate, eventEffects, isEventActive } from './events.ts';
import {
  ACHIEVEMENTS,
  ALL_GOLDEN_EFFECTS,
  BALANCE,
  CHALLENGES,
  CHALLENGE_REWARDS,
  CHARTERS,
  CHARTER_VALUES,
  CHRISTMAS,
  CITY_NAMES,
  GOLDEN_EFFECTS,
  PRESENT_EFFECTS,
  RAID_PENALTY_EFFECTS,
  REGULAR_STICKERS,
  PERKS,
  STICKERS,
  STICKER_SETS,
  STICKER_UNLOCKS,
  STICKER_COMBOS,
  UPGRADES,
  type Achievement,
  type AchievementContext,
  type Challenge,
  type ChallengeId,
  type ChallengeRules,
  type Charter,
  type CharterId,
  type GoldenEffect,
  type Perk,
  type SecretAchievementId,
  type StickerCategory,
  type StickerData,
  type StickerSet,
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
  /** Seconds of play (game ticks while the page is open). */
  playSeconds: number;
  /** Seconds since the last secession. */
  runSeconds: number;
  /** Most earned in a single run (between secessions). */
  bestRunEarnings: number;
  /** Largest single click, crits included. */
  biggestClick: number;
  /** Epoch ms when stats started being tracked. */
  firstPlayed: number;
  /** Challenge runs: purchases that failed, and clicks requisitioned. */
  failedPurchases: number;
  /** Upgrades sold back. */
  upgradesSold: number;
  /** Raids that ran out the clock: handled by a retainer, or lost. */
  raidsHandled: number;
  raidsLost: number;
  requisitionedClicks: number;
  /** Christmas presents opened. */
  presentsOpened: number;
  /** Different birthday events played on. */
  birthdaysCelebrated: number;
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
  /** Owned sticker ids. */
  stickers: string[];
  /** Stickers whose unlock condition has been met (permanent, see STICKER_UNLOCKS). */
  unlockedStickers: string[];
  /** Whether owned stickers are drawn on screen (the bonus applies either way). */
  showStickers: boolean;
  /** Shop setting: buy 1, 10 or as many as you can afford. */
  buyAmount: BuyAmount;
  /** Running golden-sticker boosts. */
  buffs: ActiveBuff[];
  /** Signed charters (prestige shop). Permanent across secessions. */
  charters: CharterId[];
  /** Sound effects on or off. */
  sound: boolean;
  /** Challenges won, and the fastest win of each (seconds). */
  completedChallenges: ChallengeId[];
  bestChallengeTimes: Partial<Record<ChallengeId, number>>;
  /**
   * The challenge being played, with your real empire set aside in `main`.
   * While this is set, `state` itself is the challenge run.
   */
  activeChallenge: { id: ChallengeId; main: GameState } | null;
  /** Event seasons whose popup was already shown, e.g. "christmas-2026". */
  seenEvents: string[];
  /** One entry per secession: the city you named and how many cities it brought. */
  foundedCities: FoundedCity[];
  /** DRO retainers: each one absorbs a raid that runs out the clock. Kept through secession. */
  retainers: number;
  /** News headlines unlocked so far (they stay in the ticker for good). */
  unlockedHeadlines: string[];
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
    playSeconds: 0,
    runSeconds: 0,
    bestRunEarnings: 0,
    biggestClick: 0,
    firstPlayed: 0,
    failedPurchases: 0,
    upgradesSold: 0,
    raidsHandled: 0,
    raidsLost: 0,
    requisitionedClicks: 0,
    presentsOpened: 0,
    birthdaysCelebrated: 0,
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
    stickers: [],
    unlockedStickers: [],
    showStickers: true,
    buyAmount: 1,
    buffs: [],
    charters: [],
    sound: true,
    completedChallenges: [],
    bestChallengeTimes: {},
    activeChallenge: null,
    seenEvents: [],
    foundedCities: [],
    retainers: 0,
    unlockedHeadlines: [],
    stats: newStats(),
    lastSaved: 0,
  };
}

// ---------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------

export const ownedCount = (state: GameState, id: number) => state.owned[id] ?? 0;
export const hasPerk = (state: GameState, id: string) => state.perks.includes(id);
export const hasCharter = (state: GameState, id: CharterId) => state.charters.includes(id);

/** Price of the next copy of an upgrade. `multiplier` applies discounts (1 = full price). */
export function upgradeCost(upgrade: Upgrade, owned: number, multiplier = 1): number {
  return Math.ceil(upgrade.baseCost * Math.pow(BALANCE.costGrowth, owned) * multiplier);
}

// ---------------------------------------------------------------------------
// Challenge rules (the runs themselves are started and ended in challenges.ts)
// ---------------------------------------------------------------------------

export const challengeOf = (state: GameState): Challenge | null =>
  state.activeChallenge ? (CHALLENGES.find((c) => c.id === state.activeChallenge!.id) ?? null) : null;

const NO_RULES: ChallengeRules = {};
export const challengeRules = (state: GameState): ChallengeRules => challengeOf(state)?.rules ?? NO_RULES;

/** A challenge's permanent reward, which only applies in normal play. */
const hasReward = (state: GameState, id: ChallengeId) => !state.activeChallenge && state.completedChallenges.includes(id);

/** Challenge price factor for everything: the flat multiplier times inflation so far. */
export function challengePriceFactor(state: GameState): number {
  const r = challengeRules(state);
  const minutes = state.stats.runSeconds / 60;
  return (r.priceMultiplier ?? 1) * Math.pow(1 + (r.inflationPerMinute ?? 0), minutes);
}

/** Why an upgrade can't be bought right now, or null if it can. */
export function bannedReason(state: GameState, upgrade: Upgrade): string | null {
  const r = challengeRules(state);
  if (r.banned?.[upgrade.id]) return r.banned[upgrade.id];
  if (r.clickOnly && upgrade.type === 'passive') return '☭ Collectivized';
  return null;
}

/** Tax rate on earnings, from the challenge's flat tax or bracket for this gross income per second. */
export function taxRate(state: GameState, grossIncomePerSec: number): number {
  const r = challengeRules(state);
  let rate = r.flatTax ?? 0;
  for (const [from, bracket] of r.taxBrackets ?? []) if (grossIncomePerSec >= from) rate = bracket;
  return rate;
}

/** Upgrade price multiplier from charters, challenge rewards and the current challenge. */
export const upgradePriceMultiplier = (state: GameState) =>
  (hasCharter(state, 'bulk-discount') ? CHARTER_VALUES.bulkDiscount : 1) *
  (hasReward(state, 'status-quo') ? CHALLENGE_REWARDS.statusQuoPrices : 1) *
  challengePriceFactor(state);

/** A special upgrade's price right now. */
export const perkCost = (state: GameState, perk: Perk) => Math.ceil(perk.cost * challengePriceFactor(state));

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
  /** The two parts of globalMultiplier: Free Private Cities and achievements. */
  cityMultiplier: number;
  achievementMultiplier: number;
  /** Bonus from owned stickers; applies to passive income only. */
  stickerMultiplier: number;
  /** Bonuses from completed sticker sets. */
  setClickMultiplier: number;
  setIncomeMultiplier: number;
  /** Golden-sticker boosts running right now. */
  clickBuff: number;
  incomeBuff: number;
  /** Tax taken from earnings (challenges only). clickAmount and incomePerSec are after tax. */
  taxRate: number;
  /** What a normal (non-crit) click earns. */
  clickAmount: number;
  incomePerSec: number;
}

export function derive(state: GameState, now = Date.now()): Derived {
  const fx = eventEffects(calendarDate(now));
  let clickValue = 1;
  let income = 0;
  for (const u of UPGRADES) {
    const n = ownedCount(state, u.id);
    if (u.type === 'passive') income += u.income * n * (fx.upgradeIncome[u.id] ?? 1);
    else clickValue += u.clickBonus * n;
  }

  let clickMultiplier = 1;
  let critChance = 0;
  let passiveMultiplier = 1;
  let incomeToClickPercent = 0;
  let raidEvasionChance = 0;
  for (const p of PERKS) {
    if (!hasPerk(state, p.id) || fx.suspendedPerks.includes(p.id)) continue;
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

  const perCity = hasCharter(state, 'network-effects')
    ? CHARTER_VALUES.networkEffectsBonusPerCity
    : BALANCE.secession.bonusPerCity;
  const perAchievement = hasCharter(state, 'lindy') ? CHARTER_VALUES.lindyBonusPerAchievement : BALANCE.bonusPerAchievement;
  // Spending cities on charters doesn't reduce this: it counts every city ever founded.
  const cityMultiplier = 1 + state.cities * perCity;
  // Challenges are played without the achievement bonus (cities and charters are absent anyway).
  const achievementMultiplier = state.activeChallenge ? 1 : 1 + state.achievements.length * perAchievement;
  const globalMultiplier = cityMultiplier * achievementMultiplier;

  const stickerMultiplier = 1 + state.stickers.length * BALANCE.stickers.bonusEach;

  let setClickMultiplier = 1;
  let setIncomeMultiplier = 1;
  for (const set of completedStickerSets(state)) {
    setClickMultiplier *= set.clickMultiplier ?? 1;
    setIncomeMultiplier *= set.incomeMultiplier ?? 1;
    critChance += set.critChance ?? 0;
  }

  let clickBuff = 1;
  let incomeBuff = 1;
  for (const { effect } of activeBuffs(state, now)) {
    clickBuff *= effect.clickMultiplier;
    incomeBuff *= effect.incomeMultiplier;
  }

  if (hasReward(state, 'communism')) clickMultiplier *= CHALLENGE_REWARDS.communismClicks;

  const grossIncome =
    income * passiveMultiplier * stickerMultiplier * setIncomeMultiplier * globalMultiplier * incomeBuff * fx.incomeMultiplier;
  const tax = taxRate(state, grossIncome);

  return {
    clickValue,
    income,
    clickMultiplier,
    critChance,
    passiveMultiplier,
    incomeToClickPercent,
    raidEvasionChance,
    globalMultiplier,
    cityMultiplier,
    achievementMultiplier,
    stickerMultiplier,
    setClickMultiplier,
    setIncomeMultiplier,
    clickBuff,
    incomeBuff,
    taxRate: tax,
    clickAmount:
      (clickValue + income * incomeToClickPercent) * clickMultiplier * setClickMultiplier * globalMultiplier * clickBuff * (1 - tax),
    incomePerSec: grossIncome * (1 - tax),
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

/**
 * Resolves one click. `roll` (crit check) and `failRoll` (Communism's requisitioning)
 * are random numbers in [0, 1).
 */
export function click(
  state: GameState,
  roll: number,
  now = Date.now(),
  failRoll = Math.random(),
): { amount: number; crit: boolean; requisitioned: boolean } {
  state.stats.clicks++;
  if (failRoll < (challengeRules(state).clickFailChance ?? 0)) {
    state.stats.requisitionedClicks++;
    return { amount: 0, crit: false, requisitioned: true };
  }
  const d = derive(state, now);
  const crit = roll < d.critChance;
  const amount = crit ? d.clickAmount * BALANCE.critMultiplier : d.clickAmount;
  if (crit) state.stats.crits++;
  state.stats.biggestClick = Math.max(state.stats.biggestClick, amount);
  earn(state, amount);
  return { amount, crit, requisitioned: false };
}

/** Total price of the next `count` copies, each priced like a single purchase. */
export function bulkCost(upgrade: Upgrade, owned: number, count: number, multiplier = 1): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += upgradeCost(upgrade, owned + i, multiplier);
  return total;
}

/** How many copies `cash` can buy in a row (capped so it stays fast). */
export function maxAffordable(upgrade: Upgrade, owned: number, cash: number, multiplier = 1, cap = 10_000): number {
  let count = 0;
  let total = 0;
  while (count < cap) {
    const next = upgradeCost(upgrade, owned + count, multiplier);
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
  if (bannedReason(state, upgrade)) return { count: 0, cost: Infinity };
  const owned = ownedCount(state, upgrade.id);
  const m = upgradePriceMultiplier(state);
  const count =
    state.buyAmount === 'max' ? Math.max(1, maxAffordable(upgrade, owned, state.score, m)) : state.buyAmount;
  return { count, cost: bulkCost(upgrade, owned, count, m) };
}

/**
 * Buys the quoted number of copies, or nothing if you can't afford all of them.
 * In Status Quo Mode a passive business can fail: the money is spent and nothing is gained.
 * `roll` is a random number in [0, 1) for that check.
 */
export function buyUpgrade(state: GameState, upgrade: Upgrade, roll = Math.random()): { count: number; failed: boolean } {
  const { count, cost } = purchaseQuote(state, upgrade);
  if (!count || state.score < cost) return { count: 0, failed: false };
  state.score -= cost;
  if (upgrade.type === 'passive' && roll < (challengeRules(state).businessFailChance ?? 0)) {
    state.stats.failedPurchases++;
    return { count: 0, failed: true };
  }
  state.owned[upgrade.id] = ownedCount(state, upgrade.id) + count;
  return { count, failed: false };
}

/**
 * How many copies you can sell: all of them, except the ones a challenge handed
 * you at the start (State property can't be sold).
 */
export function sellableCount(state: GameState, upgrade: Upgrade): number {
  const given = challengeRules(state).startWith?.[upgrade.id] ?? 0;
  return Math.max(0, ownedCount(state, upgrade.id) - given);
}

/**
 * What selling would do for the current amount (×1, ×10, or everything for MAX):
 * each copy refunds half of what it would cost to buy back right now.
 */
export function sellQuote(state: GameState, upgrade: Upgrade): { count: number; refund: number } {
  const owned = ownedCount(state, upgrade.id);
  const sellable = sellableCount(state, upgrade);
  const count = state.buyAmount === 'max' ? sellable : Math.min(state.buyAmount, sellable);
  const m = upgradePriceMultiplier(state);
  let refund = 0;
  for (let i = 1; i <= count; i++) refund += Math.floor(upgradeCost(upgrade, owned - i, m) * BALANCE.sellRefund);
  return { count, refund };
}

/** Sells the quoted copies. The refund is cash, not earnings (it doesn't count toward cities). Returns how many were sold. */
export function sellUpgrade(state: GameState, upgrade: Upgrade): number {
  const { count, refund } = sellQuote(state, upgrade);
  if (!count) return 0;
  state.owned[upgrade.id] = ownedCount(state, upgrade.id) - count;
  if (!state.owned[upgrade.id]) delete state.owned[upgrade.id];
  state.score += refund;
  state.stats.upgradesSold += count;
  return count;
}

/** The sticker-combo secret achievements met by the stickers on screen. */
export function stickerCombos(onScreen: Iterable<string>): SecretAchievementId[] {
  const shown = new Set(onScreen);
  return STICKER_COMBOS.filter((c) => c.ids.filter((id) => shown.has(id)).length >= (c.need ?? c.ids.length)).map((c) => c.achievement);
}

export function buyPerk(state: GameState, perk: Perk): boolean {
  const cost = perkCost(state, perk);
  if (state.score < cost || hasPerk(state, perk.id)) return false;
  state.score -= cost;
  state.perks.push(perk.id);
  return true;
}

// ---------------------------------------------------------------------------
// Sticker shop
// ---------------------------------------------------------------------------

/** Earned stickers are given, never bought (see STICKER_UNLOCKS). */
export const isEarnedSticker = (id: string) => !!STICKER_UNLOCKS[id]?.earned;

/** How many regular stickers can be bought (everything but limited editions and earned ones). */
export const BUYABLE_STICKERS = REGULAR_STICKERS.filter((s) => !isEarnedSticker(s.id)).length;

/** Price growth per purchase, so the first costs `firstCost` and the last `lastCost`. */
export const STICKER_COST_GROWTH = Math.pow(
  BALANCE.stickers.lastCost / BALANCE.stickers.firstCost,
  1 / Math.max(1, BUYABLE_STICKERS - 1),
);

const isSeasonal = (id: string) => !!STICKERS.find((s) => s.id === id)?.season;

/** Price of the next regular sticker. Depends only on how many you've bought, not which one. */
export function stickerCost(state: GameState): number {
  const bought = state.stickers.filter((id) => !isSeasonal(id) && !isEarnedSticker(id)).length;
  return Math.ceil(BALANCE.stickers.firstCost * Math.pow(STICKER_COST_GROWTH, bought) * challengePriceFactor(state));
}

export const hasSticker = (state: GameState, id: string) => state.stickers.includes(id);

/** A Christmas sticker costs a few minutes of your income, so it's affordable at any stage. */
export function christmasStickerCost(state: GameState, now = Date.now()): number {
  return Math.ceil(Math.max(CHRISTMAS.minStickerCost, derive(state, now).incomePerSec * CHRISTMAS.stickerIncomeSeconds));
}

/** Whether a sticker is free today (birthdays and anniversaries gift one). */
export const isGiftSticker = (id: string, date: Date = calendarDate()) => eventEffects(date).giftStickers.includes(id);

/** What a given sticker costs right now. */
export function priceOfSticker(state: GameState, id: string, now = Date.now()): number {
  if (isGiftSticker(id, calendarDate(now))) return 0;
  return isSeasonal(id) ? christmasStickerCost(state, now) : stickerCost(state);
}

/** Progress toward a sticker's unlock condition, or null if it has none. */
export function unlockProgress(state: GameState, id: string): { have: number; need: number } | null {
  const rule = STICKER_UNLOCKS[id];
  if (!rule) return null;
  if (rule.secessions !== undefined) return { have: state.stats.secessions, need: rule.secessions };
  if (rule.raidsEvaded !== undefined) return { have: state.stats.raidsEvaded + state.stats.raidsAutoEvaded, need: rule.raidsEvaded };
  if (rule.challenge !== undefined) return { have: state.completedChallenges.includes(rule.challenge) ? 1 : 0, need: 1 };
  return { have: ownedCount(state, rule.upgrade!), need: rule.count! };
}

/** Locked: has an unlock condition that hasn't been met yet. */
export const isStickerLocked = (state: GameState, id: string) =>
  !!STICKER_UNLOCKS[id] && !state.unlockedStickers.includes(id);

/**
 * Unlocks every sticker whose condition is now met. Earned stickers are added to
 * your collection for free (and earned again in a challenge run, which starts
 * without stickers). Returns the stickers that were just unlocked or earned.
 */
export function unlockStickers(state: GameState): StickerData[] {
  const unlocked: StickerData[] = [];
  for (const id of Object.keys(STICKER_UNLOCKS)) {
    const earned = isEarnedSticker(id);
    const known = state.unlockedStickers.includes(id);
    if (known && (!earned || hasSticker(state, id))) continue;
    const p = unlockProgress(state, id)!;
    if (p.have < p.need) continue;
    if (!known) state.unlockedStickers.push(id);
    // Already owned (bought before it became an earned sticker): nothing to announce.
    if (earned && hasSticker(state, id)) continue;
    if (earned) state.stickers.push(id);
    const data = STICKERS.find((s) => s.id === id);
    if (data) unlocked.push(data);
  }
  return unlocked;
}

/**
 * Whether a sticker can be bought today: gifts always (birthdays, Liberland Day);
 * never earned or still-locked ones; limited editions only during their event.
 */
export function stickerForSale(state: GameState, id: string, date: Date = calendarDate()): boolean {
  if (isGiftSticker(id, date)) return true;
  if (isEarnedSticker(id) || isStickerLocked(state, id)) return false;
  const season = STICKERS.find((s) => s.id === id)?.season;
  return !season || isEventActive(season, date);
}

export function buySticker(state: GameState, id: string, date: Date = calendarDate()): boolean {
  if (hasSticker(state, id) || !STICKERS.some((s) => s.id === id) || !stickerForSale(state, id, date)) return false;
  const cost = priceOfSticker(state, id, date.getTime());
  if (state.score < cost) return false;
  state.score -= cost;
  state.stickers.push(id);
  return true;
}

export function stickerCategoryComplete(state: GameState, category: StickerCategory): boolean {
  return STICKERS.filter((s) => s.category === category).every((s) => hasSticker(state, s.id));
}

export function completedStickerSets(state: GameState): StickerSet[] {
  return STICKER_SETS.filter((set) => stickerCategoryComplete(state, set.category));
}

/** Product of a numeric field over the completed sets (1 when none apply). */
const setProduct = (state: GameState, field: 'goldenDelay' | 'raidChance' | 'goldenCash') =>
  completedStickerSets(state).reduce((m, set) => m * (set[field] ?? 1), 1);

// ---------------------------------------------------------------------------
// Golden stickers
// ---------------------------------------------------------------------------

/** Boosts still running at `now`, with their effect data. Expired ones are dropped. */
export function activeBuffs(state: GameState, now = Date.now()): { effect: GoldenEffect; endsAt: number }[] {
  state.buffs = state.buffs.filter((b) => b.endsAt > now);
  return state.buffs.flatMap((b) => {
    const effect = ALL_GOLDEN_EFFECTS.find((e) => e.id === b.effectId);
    return effect ? [{ effect, endsAt: b.endsAt }] : [];
  });
}

export const raidsBlocked = (state: GameState, now = Date.now()) =>
  activeBuffs(state, now).some(({ effect }) => effect.noRaids);

/** Picks a reward by weight. `roll` is a random number in [0, 1). Pass PRESENT_EFFECTS for presents. */
export function pickGoldenEffect(roll: number, effects: readonly GoldenEffect[] = GOLDEN_EFFECTS): GoldenEffect {
  const total = effects.reduce((sum, e) => sum + e.weight, 0);
  let r = roll * total;
  for (const e of effects) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return effects[effects.length - 1];
}

/** The instant-cash reward: min(25% of cash, 15 min of income), but at least 50 clicks' worth. */
export function goldenCash(state: GameState, now = Date.now()): number {
  const d = derive(state, now);
  const g = BALANCE.golden;
  const base = Math.max(Math.min(state.score * g.cashShareOfScore, d.incomePerSec * g.cashIncomeSeconds), d.clickAmount * g.cashMinClicks);
  return base * (hasReward(state, 'hyperinflation') ? CHALLENGE_REWARDS.hyperinflationWallet : 1);
}

/** Applies a caught golden sticker. Returns the cash paid out (0 for timed boosts). */
export function catchGolden(state: GameState, effect: GoldenEffect, now = Date.now()): number {
  state.stats.goldenClicks++;
  if (PRESENT_EFFECTS.includes(effect)) state.stats.presentsOpened++;
  let cash = 0;
  if (effect.cash) {
    cash =
      goldenCash(state, now) *
      (effect.cashMultiplier ?? 1) *
      eventEffects(calendarDate(now)).goldenCashMultiplier *
      setProduct(state, 'goldenCash');
    earn(state, cash);
  }
  if (effect.durationSec > 0) {
    // Catching the same boost again restarts its timer instead of stacking.
    state.buffs = state.buffs.filter((b) => b.effectId !== effect.id);
    const duration =
      effect.durationSec *
      (hasCharter(state, 'long-bull') ? CHARTER_VALUES.longBullDuration : 1) *
      eventEffects(calendarDate(now)).goldenDurationMultiplier;
    state.buffs.push({ effectId: effect.id, endsAt: now + duration * 1000 });
  }
  return cash;
}

/** Multiplier on the wait between golden stickers (presents come sooner at Christmas). */
export const goldenDelayMultiplier = (state: GameState, date: Date = calendarDate()) =>
  (hasCharter(state, 'seed-phrases') ? CHARTER_VALUES.seedPhrasesDelay : 1) *
  setProduct(state, 'goldenDelay') *
  (isEventActive('christmas', date) ? CHRISTMAS.presentDelay : 1);

/** Odds of a raid at each raid check. */
export const raidChance = (state: GameState, date: Date = calendarDate()) =>
  Math.min(
    1,
    (isEventActive('fed-birthday', date) ? CHRISTMAS.fedBirthdayRaids : 1) *
    BALANCE.raid.chance *
      (hasCharter(state, 'private-courts') ? CHARTER_VALUES.privateCourtsRaidChance : 1) *
      setProduct(state, 'raidChance') *
      (hasReward(state, 'minarchist') ? CHALLENGE_REWARDS.minarchistRaidChance : 1) *
      (challengeRules(state).raidChanceMultiplier ?? 1),
  );

/** What dodging a raid pays: a flat bonus, or a minute of income on the Fed's birthday. */
export function raidEvadeBonus(state: GameState, date: Date = calendarDate()): number {
  if (!isEventActive('fed-birthday', date)) return BALANCE.raid.evadeBonus;
  return Math.max(BALANCE.raid.evadeBonus, derive(state, date.getTime()).incomePerSec * CHRISTMAS.fedBirthdayCakeSeconds);
}

/** Seconds you get to hide your assets in a raid. `roll` is a random number in [0, 1). */
export const raidSeconds = (roll: number) =>
  Math.round(BALANCE.raid.minSeconds + roll * (BALANCE.raid.maxSeconds - BALANCE.raid.minSeconds));

/**
 * A DRO retainer costs about 5 minutes of income (with a floor), ×1.25 for each
 * one you already hold, plus challenge inflation. Using one up makes the next cheaper.
 */
export function retainerCost(state: GameState, now = Date.now()): number {
  const base = Math.max(BALANCE.raid.retainerMinCost, derive({ ...state, buffs: [] }, now).incomePerSec * BALANCE.raid.retainerSeconds);
  return Math.ceil(base * Math.pow(BALANCE.raid.retainerGrowth, state.retainers) * challengePriceFactor(state));
}

export function buyRetainer(state: GameState, now = Date.now()): boolean {
  const cost = retainerCost(state, now);
  if (state.score < cost) return false;
  state.score -= cost;
  state.retainers++;
  return true;
}

/** What happened when a raid ran out the clock. */
export type RaidOutcome =
  | { kind: 'retainer' }
  | { kind: 'cash'; amount: number }
  | { kind: 'penalty'; effect: GoldenEffect }
  | { kind: 'building'; upgrade: Upgrade };

/**
 * A raid ran out the clock. A retainer absorbs it; otherwise the Fed takes one of:
 * a share of your cash, a timed penalty (income or clicks halved), or one random
 * building. `roll` picks the penalty and `roll2` the building, both in [0, 1).
 */
export function resolveRaidTimeout(state: GameState, roll: number, roll2: number, now = Date.now()): RaidOutcome {
  if (state.retainers > 0) {
    state.retainers--;
    state.stats.raidsHandled++;
    return { kind: 'retainer' };
  }
  state.stats.raidsLost++;
  const buildings = UPGRADES.filter((u) => ownedCount(state, u.id) > 0);
  const options: ('cash' | 'building' | GoldenEffect)[] = ['cash', ...RAID_PENALTY_EFFECTS];
  if (buildings.length) options.push('building');
  const pick = options[Math.min(options.length - 1, Math.floor(roll * options.length))];
  if (pick === 'cash') {
    const amount = Math.floor(state.score * BALANCE.raid.cashLoss);
    state.score -= amount;
    return { kind: 'cash', amount };
  }
  if (pick === 'building') {
    const upgrade = buildings[Math.min(buildings.length - 1, Math.floor(roll2 * buildings.length))];
    state.owned[upgrade.id]--;
    if (!state.owned[upgrade.id]) delete state.owned[upgrade.id];
    return { kind: 'building', upgrade };
  }
  // Same penalty twice: the clock restarts rather than stacking.
  state.buffs = state.buffs.filter((b) => b.effectId !== pick.id);
  state.buffs.push({ effectId: pick.id, endsAt: now + pick.durationSec * 1000 });
  return { kind: 'penalty', effect: pick };
}

/** Cash needed before raids start (Communism audits you from the start). */
export const raidMinScore = (state: GameState) => (challengeRules(state).raidsFromStart ? 0 : BALANCE.raid.minScore);

// ---------------------------------------------------------------------------
// Charters (prestige shop)
// ---------------------------------------------------------------------------

/** Cities already spent on charters. */
export const citiesSpent = (state: GameState) =>
  CHARTERS.filter((c) => hasCharter(state, c.id)).reduce((sum, c) => sum + c.cost, 0);

/** Cities you can still spend. Spending never lowers the income bonus from cities. */
export const citiesAvailable = (state: GameState) => Math.max(0, state.cities - citiesSpent(state));

export function buyCharter(state: GameState, charter: Charter): boolean {
  if (hasCharter(state, charter.id) || citiesAvailable(state) < charter.cost) return false;
  state.charters.push(charter.id);
  return true;
}

/** What a fresh run starts with, given your charters. */
export function applyRunStart(state: GameState): void {
  if (hasCharter(state, 'seed-capital')) state.score = CHARTER_VALUES.seedCapital;
  if (hasCharter(state, 'grandfathered')) {
    for (const [id, n] of Object.entries(CHARTER_VALUES.grandfathered)) {
      state.owned[Number(id)] = Math.max(state.owned[Number(id)] ?? 0, n);
    }
  }
}

// ---------------------------------------------------------------------------
// Secession (prestige)
// ---------------------------------------------------------------------------

/** Total Free Private Cities earned for a given all-time earnings figure. */
export function citiesFor(allTimeEarnings: number): number {
  const { divisor, root } = BALANCE.secession;
  const earned = Math.max(0, allTimeEarnings);
  let n = Math.floor(Math.pow(earned / divisor, 1 / root));
  // Floating-point roots can land just off a whole number (1000^(1/3) = 9.999…),
  // so settle the edges against the exact threshold.
  while (earningsForCities(n + 1) <= earned) n++;
  while (n > 0 && earningsForCities(n) > earned) n--;
  return n;
}

/** All-time earnings needed to have earned `cities` cities in total. */
export function earningsForCities(cities: number): number {
  return Math.pow(cities, BALANCE.secession.root) * BALANCE.secession.divisor;
}

/** Cities you'd gain by seceding right now. */
export function pendingCities(state: GameState): number {
  if (state.activeChallenge) return 0;
  return Math.max(0, citiesFor(state.allTimeEarnings) - state.cities);
}

/**
 * Leaves everything behind to found new Free Private Cities. Keeps cities,
 * charters, achievements, lifetime earnings, stats and the starter stickers
 * (plus bought stickers and perks, with the right charters). Returns how many
 * cities were gained (0 means you couldn't secede yet and nothing changed).
 */
export interface FoundedCity {
  name: string;
  /** Cities gained by that secession (the named one and any that came with it). */
  cities: number;
  /** Epoch ms. */
  founded: number;
}

export const CITY_NAME_MAX = 40;

/** Cleans up a typed city name: trimmed, single spaces, at most CITY_NAME_MAX characters. */
export const cleanCityName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, CITY_NAME_MAX).trim();

/** A random city name ("Rothbardia", "Port Hayek", "Catallaxy Bay"). `rng` returns numbers in [0, 1). */
export function randomCityName(rng: () => number = Math.random): string {
  const pickOne = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  if (rng() < 0.25) return pickOne(CITY_NAMES.whole);
  const root = pickOne(CITY_NAMES.roots);
  const pattern = pickOne(CITY_NAMES.patterns);
  const stem = pattern.includes('{}ia') && root.endsWith('e') ? root.slice(0, -1) : root;
  return pattern.replace('{}', stem);
}

/**
 * Secedes: trades this run for new cities. `name` names the city you found
 * (a random one if it's blank). Returns how many cities you gained.
 */
export function secede(state: GameState, date: Date = calendarDate(), name = ''): number {
  if (state.activeChallenge) return 0; // no seceding from a challenge: win it or abandon it
  const pending = pendingCities(state);
  if (pending < 1) return 0;
  const gained = pending + eventEffects(date).secessionBonusCities; // Liberland Day founds one more
  state.stats.bestRunEarnings = Math.max(state.stats.bestRunEarnings, state.runEarnings);
  state.stats.runSeconds = 0;
  state.cities += gained;
  state.score = 0;
  state.runEarnings = 0;
  state.owned = {};
  if (!hasCharter(state, 'tenure')) state.perks = [];
  // Limited-edition and earned stickers always stay; the rest only with Collector's Exemption.
  if (!hasCharter(state, 'sticker-license')) state.stickers = state.stickers.filter((id) => isSeasonal(id) || isEarnedSticker(id));
  state.buffs = [];
  state.stats.secessions++;
  state.foundedCities.push({ name: cleanCityName(name) || randomCityName(), cities: gained, founded: date.getTime() });
  applyRunStart(state);
  return gained;
}

/** One second of play: earns passive income (unless a raid is freezing it) and counts time. */
export function tick(state: GameState, raidActive: boolean, now = Date.now()): void {
  const decay = challengeRules(state).cashDecayPerSec ?? 0;
  if (decay) state.score *= 1 - decay;
  if (!raidActive) earn(state, derive(state, now).incomePerSec);
  state.stats.playSeconds++;
  state.stats.runSeconds++;
  state.stats.bestRunEarnings = Math.max(state.stats.bestRunEarnings, state.runEarnings);
}

// ---------------------------------------------------------------------------
// Offline earnings
// ---------------------------------------------------------------------------

/** What the enterprises made while the tab was closed. */
export function offlineEarnings(state: GameState, now: number): { seconds: number; amount: number } {
  // Challenges only count time with the game open.
  if (!state.lastSaved || state.activeChallenge) return { seconds: 0, amount: 0 };
  const away = Math.floor((now - state.lastSaved) / 1000);
  if (away < BALANCE.offline.minSeconds) return { seconds: 0, amount: 0 };
  const { rate, maxSeconds } = offlineSettings(state);
  const seconds = Math.min(away, maxSeconds);
  // Golden boosts don't count while you're away.
  return { seconds, amount: derive({ ...state, buffs: [] }).incomePerSec * seconds * rate };
}

/** Offline rate and cap, after charters. */
export function offlineSettings(state: GameState): { rate: number; maxSeconds: number } {
  return hasCharter(state, 'remote-management')
    ? CHARTER_VALUES.remoteManagement
    : { rate: BALANCE.offline.rate, maxSeconds: BALANCE.offline.maxSeconds };
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
    chartersOwned: state.charters.length,
    stickerCategoryComplete: (category) => stickerCategoryComplete(state, category),
    stickerSetsComplete: completedStickerSets(state).length,
    ownsSticker: (id) => hasSticker(state, id),
    challenge: state.activeChallenge?.id ?? null,
    challengesCompleted: state.completedChallenges.length,
    stats: state.stats,
  };
}

/** Unlocks any achievements whose conditions are now met and returns them. */
export function unlockAchievements(state: GameState): Achievement[] {
  const ctx = achievementContext(state);
  const unlocked = ACHIEVEMENTS.filter((a) => a.check && !state.achievements.includes(a.id) && a.check(ctx));
  for (const a of unlocked) state.achievements.push(a.id);
  return unlocked;
}

/** Unlocks one achievement directly (used for secret ones). Returns it if it was newly unlocked. */
export function grantAchievement(state: GameState, id: SecretAchievementId | string): Achievement | null {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || state.achievements.includes(id)) return null;
  state.achievements.push(id);
  return a;
}

/** Whether the date counts for the date-based secret achievements. */
export function secretDateAchievements(date: Date): SecretAchievementId[] {
  const ids: SecretAchievementId[] = [];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (date.getHours() === 3) ids.push('insomniac');
  if (m === 4 && d === 15) ids.push('tax-day');
  if (m === 10 && d === 31) ids.push('white-paper');
  return ids;
}
