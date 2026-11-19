// The Free Market: where the Bitcoin from your runs goes. Permanent upgrades (several ranks each),
// new cards for the level-up pool, each character's weapon upgrade, and difficulty "regulations"
// that make runs harder and pay more. Pure: the save holds a ShopState, and setupFor() turns it
// into what newGame() needs.

import { type CharacterId, EVOLUTIONS, type PassiveId, PASSIVES, type WeaponId, WEAPONS } from './data.ts';
import { type Mods, NO_MODS, type Setup } from './game.ts';

export type UpgradeId = 'grit' | 'might' | 'hustle' | 'reach' | 'learning' | 'greed' | 'reroll' | 'armor';
export type HeatId = 'printer' | 'redtape' | 'fiveyear' | 'wealthtax';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  /** What one rank does. */
  text: string;
  /** The price of each rank, in order. */
  costs: number[];
  apply: (m: Mods, rank: number) => void;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  grit: { id: 'grit', name: 'Self-Ownership', icon: '💪', text: '+10 max Credibility.', costs: [40, 80, 140, 220, 320], apply: (m, r) => (m.maxHp += 10 * r) },
  might: { id: 'might', name: 'Capital Accumulation', icon: '🏗️', text: '+6% damage, every weapon.', costs: [60, 120, 200, 300, 450], apply: (m, r) => (m.damage *= 1 + 0.06 * r) },
  hustle: { id: 'hustle', name: 'Hustle', icon: '👟', text: '+4% move speed.', costs: [50, 110, 200], apply: (m, r) => (m.speed *= 1 + 0.04 * r) },
  reach: { id: 'reach', name: 'Network Effects', icon: '🧲', text: '+12% pickup range.', costs: [40, 90, 160], apply: (m, r) => (m.magnet *= 1 + 0.12 * r) },
  learning: { id: 'learning', name: 'Praxeology', icon: '📚', text: '+6% XP.', costs: [70, 150, 260], apply: (m, r) => (m.xp *= 1 + 0.06 * r) },
  greed: { id: 'greed', name: 'Gold Rush', icon: '⛏️', text: '+10% Bitcoin from every run.', costs: [50, 100, 170, 260, 380], apply: (m, r) => (m.gold *= 1 + 0.1 * r) },
  reroll: { id: 'reroll', name: 'Second Opinion', icon: '🎲', text: '+1 reroll of the level-up cards, each run.', costs: [80, 160, 280], apply: (m, r) => (m.rerolls += r) },
  armor: { id: 'armor', name: 'Castle Doctrine', icon: '🏰', text: '+1 armour: every hit does 1 less.', costs: [400], apply: (m, r) => (m.armor += r) },
};
export const UPGRADE_ORDER: UpgradeId[] = ['grit', 'might', 'hustle', 'reach', 'learning', 'greed', 'reroll', 'armor'];

/** New cards, and what they cost to let into the level-up pool. */
export const CARD_PRICES: Partial<Record<WeaponId | PassiveId, number>> = { exit: 100, sound: 120, destruction: 150, happening: 200 };
export const CARD_ORDER = ['exit', 'sound', 'destruction', 'happening'] as const;
export type CardId = (typeof CARD_ORDER)[number];
export const cardName = (id: CardId) => (id in WEAPONS ? WEAPONS[id as WeaponId].name : PASSIVES[id as PassiveId].name);

export const EVOLUTION_PRICE = 300;

export interface HeatDef {
  id: HeatId;
  name: string;
  icon: string;
  text: string;
  /** Extra Bitcoin while it's on (0.3 = +30%). */
  bonus: number;
  /** What it costs to make it available. */
  cost: number;
  apply: (m: Mods) => void;
}

export const HEAT: Record<HeatId, HeatDef> = {
  printer: { id: 'printer', name: 'Money Printer Go Brrr', icon: '🖨️', text: 'Statists have 50% more health.', bonus: 0.3, cost: 60, apply: (m) => (m.enemyHp *= 1.5) },
  redtape: { id: 'redtape', name: 'Red Tape', icon: '📋', text: '35% more statists.', bonus: 0.3, cost: 60, apply: (m) => (m.spawns *= 1.35) },
  fiveyear: { id: 'fiveyear', name: 'Five-Year Plan', icon: '🏃', text: 'Statists move 15% faster.', bonus: 0.25, cost: 80, apply: (m) => (m.enemySpeed *= 1.15) },
  wealthtax: { id: 'wealthtax', name: 'Wealth Tax', icon: '💸', text: 'Every hit takes 50% more Credibility.', bonus: 0.35, cost: 100, apply: (m) => (m.hurt *= 1.5) },
};
export const HEAT_ORDER: HeatId[] = ['printer', 'redtape', 'fiveyear', 'wealthtax'];

export interface ShopState {
  /** Bitcoin to spend. */
  bank: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  cards: CardId[];
  evolutions: CharacterId[];
  /** Regulations bought, and those switched on for the next run. */
  heatOwned: HeatId[];
  heatOn: HeatId[];
}

export const emptyShop = (): ShopState => ({ bank: 0, upgrades: {}, cards: [], evolutions: [], heatOwned: [], heatOn: [] });

/** Reads a saved shop defensively: unknown ids and nonsense numbers are dropped. */
export function loadShop(raw: unknown, bank = 0): ShopState {
  const r = (raw ?? {}) as Partial<ShopState>;
  const list = <T extends string>(x: unknown, ok: readonly T[]) => (Array.isArray(x) ? [...new Set(x.filter((v): v is T => ok.includes(v)))] : []);
  const upgrades: ShopState['upgrades'] = {};
  for (const id of UPGRADE_ORDER) {
    const n = Math.floor(Number(r.upgrades?.[id]) || 0);
    if (n > 0) upgrades[id] = Math.min(n, UPGRADES[id].costs.length);
  }
  const heatOwned = list(r.heatOwned, HEAT_ORDER);
  return {
    bank: Math.max(0, Math.floor(Number(r.bank ?? bank) || 0)),
    upgrades,
    cards: list(r.cards, CARD_ORDER),
    evolutions: list(r.evolutions, Object.keys(EVOLUTIONS) as CharacterId[]),
    heatOwned,
    heatOn: list(r.heatOn, HEAT_ORDER).filter((id) => heatOwned.includes(id)),
  };
}

export type ShopItem = { kind: 'upgrade'; id: UpgradeId } | { kind: 'card'; id: CardId } | { kind: 'evolution'; id: CharacterId } | { kind: 'heat'; id: HeatId };

export const rank = (s: ShopState, id: UpgradeId) => s.upgrades[id] ?? 0;

/** What the item costs now, or null if there's nothing left to buy. */
export function price(s: ShopState, item: ShopItem): number | null {
  switch (item.kind) {
    case 'upgrade':
      return UPGRADES[item.id].costs[rank(s, item.id)] ?? null;
    case 'card':
      return s.cards.includes(item.id) ? null : CARD_PRICES[item.id]!;
    case 'evolution':
      return s.evolutions.includes(item.id) ? null : EVOLUTION_PRICE;
    case 'heat':
      return s.heatOwned.includes(item.id) ? null : HEAT[item.id].cost;
  }
}

export function buy(s: ShopState, item: ShopItem): boolean {
  const cost = price(s, item);
  if (cost === null || cost > s.bank) return false;
  s.bank -= cost;
  if (item.kind === 'upgrade') s.upgrades[item.id] = rank(s, item.id) + 1;
  else if (item.kind === 'card') s.cards.push(item.id);
  else if (item.kind === 'evolution') s.evolutions.push(item.id);
  else {
    s.heatOwned.push(item.id);
    s.heatOn.push(item.id);
  }
  return true;
}

export function toggleHeat(s: ShopState, id: HeatId): boolean {
  if (!s.heatOwned.includes(id)) return false;
  s.heatOn = s.heatOn.includes(id) ? s.heatOn.filter((x) => x !== id) : [...s.heatOn, id];
  return true;
}

/** The Bitcoin multiplier from the regulations switched on (1 = none). */
export const heatBonus = (s: ShopState) => 1 + s.heatOn.reduce((t, id) => t + HEAT[id].bonus, 0);

/** Everything a run needs to know from the shop. */
export function setupFor(s: ShopState, character: CharacterId): Setup {
  const m: Mods = { ...NO_MODS };
  for (const id of UPGRADE_ORDER) if (rank(s, id)) UPGRADES[id].apply(m, rank(s, id));
  for (const id of s.heatOn) HEAT[id].apply(m);
  m.gold *= heatBonus(s);
  return { mods: m, unlocked: [...s.cards], canEvolve: s.evolutions.includes(character) };
}

/** Every price in the shop added up (for the "bought it all" line, and the tests). */
export function totalCost(): number {
  const ups = UPGRADE_ORDER.reduce((t, id) => t + UPGRADES[id].costs.reduce((a, b) => a + b, 0), 0);
  const cards = CARD_ORDER.reduce((t, id) => t + CARD_PRICES[id]!, 0);
  const heat = HEAT_ORDER.reduce((t, id) => t + HEAT[id].cost, 0);
  return ups + cards + heat + EVOLUTION_PRICE * Object.keys(EVOLUTIONS).length;
}
