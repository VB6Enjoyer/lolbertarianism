import { createSaveSlot } from '../../shared/storage.ts';
import { ACHIEVEMENTS, CHALLENGES, CHARTERS, PERKS, RAID_PENALTY_EFFECTS, STICKERS, STICKER_UNLOCKS, UPGRADES } from './data.ts';
import { cleanCityName, newState, newStats, upgradeCost, type GameState, type Stats } from './logic.ts';

/**
 * Save history:
 * - v0: `ancapTycoonSave` key, before the arcade existed.
 * - v1: same shape under `lolbertarianism:ancapistan-tycoon`.
 *       { score, upgrades: [{ id, owned }], specialUpgrades: [{ id, purchased }] }
 * - v2: the full GameState (lifetime earnings, cities, achievements, stats, lastSaved).
 *       Fields added later (stickers, showStickers, buyAmount, charters, sound, challenges, seenEvents) get defaults in normalize().
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
  // Renamed achievements keep counting under their new id.
  const renamed: Record<string, string> = { 'fechas-patrias': 'white-paper' };
  const unlocked = new Set((raw.achievements ?? []).map((id) => renamed[id] ?? id));
  state.achievements = ACHIEVEMENTS.map((a) => a.id).filter((id) => unlocked.has(id));
  const owned = new Set(raw.stickers ?? []);
  state.stickers = STICKERS.map((s) => s.id).filter((id) => owned.has(id));
  state.unlockedStickers = Object.keys(STICKER_UNLOCKS).filter((id) => raw.unlockedStickers?.includes(id));
  state.showStickers = raw.showStickers !== false;
  state.buyAmount = raw.buyAmount === 10 || raw.buyAmount === 'max' ? raw.buyAmount : 1;
  state.charters = CHARTERS.map((c) => c.id).filter((id) => raw.charters?.includes(id));
  state.sound = raw.sound !== false;
  const challengeIds = CHALLENGES.map((c) => c.id);
  state.completedChallenges = challengeIds.filter((id) => raw.completedChallenges?.includes(id));
  for (const id of challengeIds) {
    const t = raw.bestChallengeTimes?.[id];
    if (typeof t === 'number' && Number.isFinite(t) && t >= 0) state.bestChallengeTimes[id] = Math.floor(t);
  }
  state.foundedCities = (Array.isArray(raw.foundedCities) ? raw.foundedCities : [])
    .filter((c) => c && typeof c.name === 'string' && cleanCityName(c.name))
    .map((c) => ({ name: cleanCityName(c.name), cities: Math.max(1, int(c.cities)), founded: num(c.founded) }));
  state.retainers = int(raw.retainers);
  state.unlockedHeadlines = [...new Set((Array.isArray(raw.unlockedHeadlines) ? raw.unlockedHeadlines : []).filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 300))];
  // Raid penalties are kept (a reload shouldn't lift them); golden boosts are not.
  state.buffs = (Array.isArray(raw.buffs) ? raw.buffs : [])
    .filter((b) => b && RAID_PENALTY_EFFECTS.some((e) => e.id === b.effectId) && num(b.endsAt) > 0)
    .map((b) => ({ effectId: b.effectId, endsAt: num(b.endsAt) }));
  state.seenEvents = (raw.seenEvents ?? []).filter((k): k is string => typeof k === 'string' && /^[a-z-]+-\d{4}$/.test(k));
  // A challenge in progress keeps the empire it set aside (cleaned up the same way).
  const active = raw.activeChallenge;
  if (active && challengeIds.includes(active.id) && active.main && typeof active.main === 'object') {
    state.activeChallenge = { id: active.id, main: normalize({ ...active.main, activeChallenge: null }) };
  }
  const stats = newStats();
  const moneyStats: (keyof Stats)[] = ['bestRunEarnings', 'biggestClick'];
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    stats[key] = moneyStats.includes(key) ? num(raw.stats?.[key]) : int(raw.stats?.[key]);
  }
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

/** What gets saved: everything but golden boosts (raid penalties stay). */
function savable(state: GameState): Partial<GameState> {
  return { ...state, buffs: state.buffs.filter((b) => RAID_PENALTY_EFFECTS.some((e) => e.id === b.effectId)) };
}

export function saveState(state: GameState, now = Date.now()): void {
  state.lastSaved = now;
  slot.save(savable(state));
}

export function clearSave(): void {
  slot.clear();
}

// ---------------------------------------------------------------------------
// Save codes: copy your progress to another browser or device
// ---------------------------------------------------------------------------

/** Every save code starts with this, so random text is rejected. */
const CODE_PREFIX = 'ANCAP1:';

/** Base64 of UTF-8 text (sticker ids include emoji, which plain btoa can't handle). */
function toBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(code: string): string {
  const binary = atob(code);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** A text code holding the whole save (golden boosts excluded). */
export function exportSave(state: GameState): string {
  const saved = savable(state);
  return CODE_PREFIX + toBase64(JSON.stringify({ v: SAVE_VERSION, data: saved }));
}

/**
 * Reads a save code. Returns the cleaned-up state, or null if the code isn't a
 * valid Ancapistan Tycoon save. Whitespace and line breaks from copy-paste are ignored.
 */
export function importSave(code: string): GameState | null {
  const trimmed = code.replace(/\s+/g, '');
  if (!trimmed.startsWith(CODE_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64(trimmed.slice(CODE_PREFIX.length)));
    if (!parsed || typeof parsed !== 'object') return null;
    const { v, data } = parsed as { v?: unknown; data?: unknown };
    if (typeof v !== 'number' || !data || typeof data !== 'object') return null;
    const migrated = v <= 1 ? migrateV1(data as SaveV1) : (data as Partial<GameState>);
    return normalize(migrated);
  } catch {
    return null;
  }
}
