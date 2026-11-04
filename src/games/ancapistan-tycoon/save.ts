import { createSaveSlot } from '../../shared/storage.ts';
import { ACHIEVEMENTS, PERKS, UPGRADES } from './data.ts';
import { newState, newStats, upgradeCost, type GameState, type Stats } from './logic.ts';

/**
 * Save history:
 * - v0: `ancapTycoonSave` key, before the arcade existed.
 * - v1: same shape under `lolbertarianism:ancapistan-tycoon`.
 *       { score, upgrades: [{ id, owned }], specialUpgrades: [{ id, purchased }] }
 * - v2: the full GameState (lifetime earnings, cities, achievements, stats, lastSaved).
 */
export const SAVE_VERSION = 2;

interface SaveV1 {
  score?: number;
  upgrades?: { id: number; owned: number }[];
  specialUpgrades?: { id: string; purchased: boolean }[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const int = (v: unknown) => Math.floor(num(v));

/** What a v1 player had already spent, so their lifetime earnings start out fair. */
export function spentOn(owned: Record<number, number>, perks: string[]): number {
  let spent = 0;
  for (const u of UPGRADES) {
    for (let i = 0; i < (owned[u.id] ?? 0); i++) spent += upgradeCost(u, i);
  }
  for (const p of PERKS) if (perks.includes(p.id)) spent += p.cost;
  return spent;
}

export function migrateV1(data: SaveV1): GameState {
  const state = newState();
  state.score = num(data.score);
  for (const { id, owned } of data.upgrades ?? []) {
    if (UPGRADES.some((u) => u.id === id) && int(owned) > 0) state.owned[id] = int(owned);
  }
  state.perks = (data.specialUpgrades ?? [])
    .filter((s) => s.purchased && PERKS.some((p) => p.id === s.id))
    .map((s) => s.id);
  // v1 didn't track earnings: assume everything ever made is what's left plus what was spent.
  state.allTimeEarnings = state.runEarnings = state.score + spentOn(state.owned, state.perks);
  return state;
}

/** Fills in missing fields and drops anything invalid, so a damaged or older save can't break the game. */
export function normalize(raw: Partial<GameState>): GameState {
  const state = newState();
  state.score = num(raw.score);
  state.runEarnings = num(raw.runEarnings);
  state.allTimeEarnings = Math.max(num(raw.allTimeEarnings), state.runEarnings);
  state.cities = int(raw.cities);
  for (const u of UPGRADES) {
    const n = int(raw.owned?.[u.id]);
    if (n > 0) state.owned[u.id] = n;
  }
  state.perks = PERKS.map((p) => p.id).filter((id) => raw.perks?.includes(id));
  state.achievements = ACHIEVEMENTS.map((a) => a.id).filter((id) => raw.achievements?.includes(id));
  const stats = newStats();
  for (const key of Object.keys(stats) as (keyof Stats)[]) stats[key] = int(raw.stats?.[key]);
  state.stats = stats;
  state.lastSaved = num(raw.lastSaved);
  return state;
}

const slot = createSaveSlot<Partial<GameState>>({
  game: 'ancapistan-tycoon',
  version: SAVE_VERSION,
  legacyKeys: ['ancapTycoonSave'],
  migrate: (data, from) => (from <= 1 ? migrateV1(data as SaveV1) : (data as Partial<GameState>)),
});

export function loadState(): GameState | null {
  const data = slot.load();
  return data ? normalize(data) : null;
}

export function saveState(state: GameState, now = Date.now()): void {
  state.lastSaved = now;
  slot.save(state);
}

export function clearSave(): void {
  slot.clear();
}
