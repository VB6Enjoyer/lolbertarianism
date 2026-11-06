// Game rules as pure functions over a plain state object. No DOM in here,
// so everything can be unit-tested (see logic.test.ts).

import {
  ACHIEVEMENTS,
  BALANCE,
  CHALLENGES,
  CHALLENGE_REWARDS,
  CHARTERS,
  CHARTER_VALUES,
  GOLDEN_EFFECTS,
  PERKS,
  STARTER_STICKERS,
  STICKERS,
  STICKER_SETS,
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
  requisitionedClicks: number;
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
    requisitionedClicks: 0,
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
    charters: [],
    sound: true,
    completedChallenges: [],
    bestChallengeTimes: {},
    activeChallenge: null,
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

  const grossIncome = income * passiveMultiplier * stickerMultiplier * setIncomeMultiplier * globalMultiplier * incomeBuff;
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
  return Math.ceil(BALANCE.stickers.firstCost * Math.pow(STICKER_COST_GROWTH, bought) * challengePriceFactor(state));
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

export function completedStickerSets(state: GameState): StickerSet[] {
  return STICKER_SETS.filter((set) => stickerCategoryComplete(state, set.category));
}

/** Product of a numeric field over the completed sets (1 when none apply). */
const setProduct = (state: GameState, field: 'goldenDelay' | 'raidChance') =>
  completedStickerSets(state).reduce((m, set) => m * (set[field] ?? 1), 1);

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
  const base = Math.max(Math.min(state.score * g.cashShareOfScore, d.incomePerSec * g.cashIncomeSeconds), d.clickAmount * g.cashMinClicks);
  return base * (hasReward(state, 'hyperinflation') ? CHALLENGE_REWARDS.hyperinflationWallet : 1);
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
    const duration = effect.durationSec * (hasCharter(state, 'long-bull') ? CHARTER_VALUES.longBullDuration : 1);
    state.buffs.push({ effectId: effect.id, endsAt: now + duration * 1000 });
  }
  return cash;
}

/** Multiplier on the wait between golden stickers. */
export const goldenDelayMultiplier = (state: GameState) =>
  (hasCharter(state, 'seed-phrases') ? CHARTER_VALUES.seedPhrasesDelay : 1) * setProduct(state, 'goldenDelay');

/** Odds of a raid at each raid check. */
export const raidChance = (state: GameState) =>
  Math.min(
    1,
    BALANCE.raid.chance *
      (hasCharter(state, 'private-courts') ? CHARTER_VALUES.privateCourtsRaidChance : 1) *
      setProduct(state, 'raidChance') *
      (hasReward(state, 'minarchist') ? CHALLENGE_REWARDS.minarchistRaidChance : 1) *
      (challengeRules(state).raidChanceMultiplier ?? 1),
  );

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
export function secede(state: GameState): number {
  if (state.activeChallenge) return 0; // no seceding from a challenge: win it or abandon it
  const gained = pendingCities(state);
  if (gained < 1) return 0;
  state.stats.bestRunEarnings = Math.max(state.stats.bestRunEarnings, state.runEarnings);
  state.stats.runSeconds = 0;
  state.cities += gained;
  state.score = 0;
  state.runEarnings = 0;
  state.owned = {};
  if (!hasCharter(state, 'tenure')) state.perks = [];
  if (!hasCharter(state, 'sticker-license')) state.stickers = [...STARTER_STICKERS];
  state.buffs = [];
  state.stats.secessions++;
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
  if ((m === 5 && d === 25) || (m === 7 && d === 9)) ids.push('fechas-patrias');
  return ids;
}
