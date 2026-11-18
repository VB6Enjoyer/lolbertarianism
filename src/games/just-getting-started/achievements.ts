// Achievements: checked against the run (and the fight in progress) after every move.

import { EVENTS } from './events.ts';
import type { Run } from './run.ts';
import type { Combat } from './state.ts';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Hidden until it's unlocked. */
  secret?: boolean;
}

/** What the checks can look at: the run, the fight (if there is one), and counts kept across runs. */
export interface AchievementContext {
  run: Run;
  combat: Combat | null;
  /** Laser blasts in all, TV appearances ever seen, and daily runs finished. */
  lasers: number;
  eventsSeen: number;
  dailies: number;
}

interface Def extends Achievement {
  done: (x: AchievementContext) => boolean;
}

const over = (x: AchievementContext) => x.run.screen === 'won' || x.run.screen === 'lost';
const cards = (x: AchievementContext, id: string) => [...x.run.deck, ...(x.combat?.gained ?? [])].filter((c) => c.id === id).length;
const flag = (x: AchievementContext, key: string) => x.combat?.flags[key] ?? 0;

const LIST: Def[] = [
  // The run
  { id: 'first-win', icon: '🎙️', name: 'Opening Statement', description: 'Win your first argument.', done: (x) => x.run.stats.fights >= 1 || x.combat?.result === 'won' },
  { id: 'boss-1', icon: '🧵', name: 'Thread Unrolled', description: 'Beat the Doomposter.', done: (x) => x.run.stats.bosses >= 1 || (x.combat?.kind === 'boss' && x.combat.act === 1 && x.combat.result === 'won') },
  { id: 'boss-2', icon: '🖨️', name: 'Printer Jammed', description: 'Beat the Fed Chair.', done: (x) => x.run.stats.bosses >= 2 || (x.combat?.kind === 'boss' && x.combat.act === 2 && x.combat.result === 'won') },
  { id: 'win', icon: '😈', name: 'Just Getting Started', description: 'Beat Late Stage Capitalism and win a run.', done: (x) => x.run.screen === 'won' },
  { id: 'stage-5', icon: '🪜', name: 'Stage Five Capitalism', description: 'Win a run on Late Stage 5 or higher.', done: (x) => x.run.screen === 'won' && (x.run.stage ?? 1) >= 5 },
  { id: 'stage-10', icon: '🏁', name: 'Terminal, Allegedly', description: 'Win a run on Late Stage 10.', done: (x) => x.run.screen === 'won' && (x.run.stage ?? 1) >= 10 },
  { id: 'elite-3', icon: '😤', name: 'Hostile Audience', description: 'Beat three hostile panels in one run.', done: (x) => x.run.stats.elites >= 3 },
  { id: 'no-regret', icon: '😇', name: 'No Regrets', description: 'Win a run without a Regret in your deck.', done: (x) => x.run.screen === 'won' && cards(x, 'regret') === 0 },
  { id: 'lean', icon: '✂️', name: 'Lean Production', description: 'Win a run with 15 cards or fewer.', done: (x) => x.run.screen === 'won' && x.run.deck.length <= 15 },
  { id: 'collected', icon: '📚', name: 'Collected Works', description: 'Have 30 cards in your deck.', done: (x) => x.run.deck.length >= 30 },
  { id: 'rich', icon: '💰', name: 'Royalty Cheques', description: 'Have 400 Royalties at once.', done: (x) => x.run.royalties >= 400 },
  { id: 'media', icon: '📺', name: 'Media Darling', description: 'See every TV appearance (over any number of runs).', done: (x) => x.eventsSeen >= EVENTS.length },
  // Laser eyes
  { id: 'laser', icon: '🔴', name: 'Laser Eyes', description: 'Fire Laser Eyes.', done: (x) => flag(x, 'lasers') >= 1 || x.run.stats.lasers >= 1 },
  { id: 'laser-2', icon: '👁️', name: 'Based and Laser-Pilled', description: 'Fire Laser Eyes twice in one fight.', done: (x) => flag(x, 'lasers') >= 2 },
  { id: 'laser-25', icon: '⚡', name: 'Retina Display', description: 'Fire Laser Eyes 25 times in all.', done: (x) => x.lasers >= 25 },
  // In a fight
  { id: 'big-hit', icon: '💥', name: 'Nobel-Worthy', description: 'Deal 40 damage or more with one card.', done: (x) => flag(x, 'bigHit') >= 40 },
  { id: 'filibuster', icon: '🗣️', name: 'Filibuster', description: 'Play 10 cards in one turn.', done: (x) => flag(x, 'maxTurnCards') >= 10 },
  { id: 'unflappable', icon: '🧘', name: 'Unflappable', description: 'Have 40 Composure at once.', done: (x) => flag(x, 'maxBlock') >= 40 },
  { id: 'momentum', icon: '💹', name: 'Monetary Expansion', description: 'Reach 10 Momentum.', done: (x) => flag(x, 'maxMomentum') >= 10 },
  { id: 'principles', icon: '📐', name: 'A Man of Principle', description: 'Have three Principles in play at once.', done: (x) => flag(x, 'principles') >= 3 },
  { id: 'flawless', icon: '🛡️', name: 'Didn’t Even Flinch', description: 'Beat a hostile panel or a boss without losing any Credibility.', done: (x) => !!x.combat && x.combat.kind !== 'fight' && x.combat.result === 'won' && !flag(x, 'hurt') },
  { id: 'donahue', icon: '🎤', name: 'Is There Some Society…', description: 'Win a fight with The Donahue Comeback as the final word.', done: (x) => flag(x, 'donahueKill') >= 1 },
  { id: 'choose', icon: '🗳️', name: 'Free to Choose', description: 'Play Free to Choose.', done: (x) => flag(x, 'chose') >= 1 },
  { id: 'withholding', icon: '🧾', name: 'Temporary Measure', description: 'Play Payroll Withholding.', done: (x) => flag(x, 'withheld') >= 1 },
  // The daily run
  { id: 'daily', icon: '📅', name: 'The Daily Show', description: 'Finish a daily run.', done: (x) => x.dailies >= 1 || (!!x.run.daily && over(x)) },
  { id: 'daily-win', icon: '🗞️', name: 'Front Page', description: 'Win a daily run.', done: (x) => !!x.run.daily && x.run.screen === 'won' },
  // Awarded by the screen (sharing isn't part of the run).
  { id: 'shared', icon: '📣', name: 'Spread the Word', description: 'Share a run’s result.', done: () => false },
  // Secrets
  { id: 'ratiod', icon: '😔', name: 'Ratio’d', description: 'Lose to the Doomposter.', secret: true, done: (x) => x.run.screen === 'lost' && !!x.combat?.enemies.some((e) => e.id === 'doomposter') },
  { id: 'regret-3', icon: '😩', name: 'Deeply Regrettable', description: 'Have three Regrets in your deck at once.', secret: true, done: (x) => cards(x, 'regret') >= 3 },
  { id: 'weimar', icon: '🎈', name: 'Weimar Hand', description: 'Hold four Inflation at once.', secret: true, done: (x) => (x.combat?.hand.filter((c) => c.id === 'inflation').length ?? 0) >= 4 },
  { id: 'any-day-now', icon: '⏳', name: 'Any Day Now', description: 'Watch Late Stage Capitalism get back up.', secret: true, done: (x) => flag(x, 'revived') >= 1 },
];

export const ACHIEVEMENTS: readonly Achievement[] = LIST.map(({ done: _done, ...a }) => a);
export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** The achievements whose condition holds right now. */
export const earnedNow = (x: AchievementContext): string[] => LIST.filter((a) => a.done(x)).map((a) => a.id);

/** Keeps only achievement ids this version knows. */
export const normalizeUnlocked = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && !!achievementById(id)) : []);
