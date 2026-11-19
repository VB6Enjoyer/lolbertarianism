// What the game remembers between runs, besides achievements: the last runs played (the run
// history), every card, relic and enemy you've come across (the compendium), and the options.

import { CARDS } from './cards.ts';
import { isCharacter, type CharacterId } from './characters.ts';
import { ENEMIES, enemyDef } from './enemies.ts';
import { RELICS } from './relics.ts';
import { runScore, type Run } from './run.ts';
import { clampStage } from './stages.ts';

// ---------------------------------------------------------------------------
// Run history
// ---------------------------------------------------------------------------

export const HISTORY_MAX = 25;

export interface HistoryEntry {
  /** When it ended (ms since 1970). */
  at: number;
  character: CharacterId;
  stage: number;
  score: number;
  act: number;
  floor: number;
  won: boolean;
  /** The enemy that ended it (null for a win, or a run abandoned outside a fight). */
  killer: string | null;
  /** Given up for a new run. */
  abandoned: boolean;
  /** The daily run's date, if it was one. */
  daily: string | null;
  /** How the secret boss went, if he turned up. */
  secret: 'won' | 'lost' | null;
}

/** Who got you: the toughest enemy still standing in the fight (or the toughest of them all). */
export function killerOf(run: Run): string | null {
  const c = run.combat;
  if (!c || run.screen === 'won') return null;
  const standing = c.enemies.filter((e) => !e.dead);
  const pool = standing.length ? standing : c.enemies;
  const top = [...pool].sort((a, b) => Number(!!enemyDef(b.id)?.boss) - Number(!!enemyDef(a.id)?.boss) || b.maxHp - a.maxHp)[0];
  return top?.id ?? null;
}

export function historyEntry(run: Run, opts: { abandoned?: boolean; now?: number } = {}): HistoryEntry {
  const won = run.screen === 'won';
  return {
    at: opts.now ?? Date.now(),
    character: run.character,
    stage: run.stage,
    score: runScore(run),
    act: run.act,
    floor: run.pos ? run.pos.row + 1 : 0,
    won,
    killer: won ? null : killerOf(run),
    abandoned: !!opts.abandoned,
    daily: run.daily?.key ?? null,
    secret: run.secret === 'won' || run.secret === 'lost' ? run.secret : null,
  };
}

/** Newest first, the last HISTORY_MAX runs. */
export function addHistory(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...list].slice(0, HISTORY_MAX);
}

const count = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));

export function normalizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e): HistoryEntry => ({
      at: count(e.at),
      character: isCharacter(e.character) ? e.character : 'milton',
      stage: clampStage(e.stage),
      score: count(e.score),
      act: Math.max(1, Math.min(3, count(e.act) || 1)),
      floor: count(e.floor),
      won: e.won === true,
      killer: typeof e.killer === 'string' && ENEMIES[e.killer] ? e.killer : null,
      abandoned: e.abandoned === true,
      daily: typeof e.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.daily) ? e.daily : null,
      secret: e.secret === 'won' || e.secret === 'lost' ? e.secret : null,
    }))
    .slice(0, HISTORY_MAX);
}

// ---------------------------------------------------------------------------
// The compendium: everything seen
// ---------------------------------------------------------------------------

export interface Seen {
  cards: string[];
  relics: string[];
  enemies: string[];
}

export const emptySeen = (): Seen => ({ cards: [], relics: [], enemies: [] });

/** Everything the run has put in front of you: the deck, the cards and relics on offer, the enemies fought. Returns whether anything was new. */
export function noteSeen(seen: Seen, run: Run): boolean {
  const before = seen.cards.length + seen.relics.length + seen.enemies.length;
  const add = (list: string[], id: string | null | undefined) => {
    if (id && !list.includes(id)) list.push(id);
  };
  const c = run.combat;
  for (const card of run.deck) add(seen.cards, card.id);
  if (c) {
    for (const card of [...c.hand, ...c.draw, ...c.discard, ...c.exhausted, ...c.powers]) add(seen.cards, card.id);
    if (c.pending) for (const card of c.pending.options) add(seen.cards, card.id);
    for (const e of c.enemies) add(seen.enemies, e.id);
  }
  for (const id of run.relics) add(seen.relics, id);
  if (run.reward) {
    for (const card of run.reward.cards) add(seen.cards, card.id);
    add(seen.relics, run.reward.relic);
    for (const id of run.reward.bossRelics) add(seen.relics, id);
  }
  if (run.shop) {
    for (const item of run.shop.cards) add(seen.cards, item.card.id);
    for (const item of run.shop.relics) add(seen.relics, item.id);
  }
  return seen.cards.length + seen.relics.length + seen.enemies.length > before;
}

export function normalizeSeen(raw: unknown): Seen {
  const r = (raw ?? {}) as Partial<Record<keyof Seen, unknown>>;
  const ids = (x: unknown, known: Record<string, unknown>) => (Array.isArray(x) ? [...new Set(x.filter((id): id is string => typeof id === 'string' && id in known))] : []);
  return { cards: ids(r.cards, CARDS), relics: ids(r.relics, RELICS), enemies: ids(r.enemies, ENEMIES) };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface Options {
  /** 0–1. */
  music: number;
  sound: number;
  /** No red flash on the laser, no jitter at full Based. */
  reduceFlashing: boolean;
  shake: boolean;
}

export const DEFAULT_OPTIONS: Options = { music: 0.6, sound: 0.8, reduceFlashing: false, shake: true };

export function normalizeOptions(raw: unknown): Options {
  const r = (raw ?? {}) as Partial<Record<keyof Options, unknown>>;
  const level = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, Math.round(x * 20) / 20)) : fallback);
  return {
    music: level(r.music, DEFAULT_OPTIONS.music),
    sound: level(r.sound, DEFAULT_OPTIONS.sound),
    reduceFlashing: r.reduceFlashing === true,
    shake: r.shake !== false,
  };
}
