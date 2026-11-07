// Starting, winning and abandoning challenge runs. The rules themselves live in
// logic.ts (challengeRules and friends) and the definitions in data.ts.

import { CHALLENGES, type Achievement, type Challenge, type ChallengeId } from './data.ts';
import { grantAchievement, newState, newStats, type GameState, type Stats } from './logic.ts';

export const challengeById = (id: ChallengeId): Challenge => CHALLENGES.find((c) => c.id === id)!;

/** Lifetime counters that carry back from a challenge run to your empire. */
const CARRIED_STATS: (keyof Stats)[] = [
  'clicks',
  'crits',
  'raidsEvaded',
  'raidsAutoEvaded',
  'reshuffles',
  'stickersDragged',
  'goldenClicks',
  'playSeconds',
  'failedPurchases',
  'requisitionedClicks',
  'presentsOpened',
  'birthdaysCelebrated',
  'upgradesSold',
  'raidsHandled',
  'raidsLost',
];

/**
 * Sets your empire aside and returns a fresh challenge run. Settings,
 * achievements and challenge records come along; cities, charters, upgrades,
 * stickers and cash don't. Returns null if you're already in a challenge.
 */
export function enterChallenge(state: GameState, id: ChallengeId): GameState | null {
  if (state.activeChallenge) return null;
  const challenge = challengeById(id);
  const main: GameState = structuredClone({ ...state, buffs: [], activeChallenge: null });

  const run = newState();
  run.activeChallenge = { id, main };
  run.achievements = [...state.achievements];
  run.completedChallenges = [...state.completedChallenges];
  run.bestChallengeTimes = { ...state.bestChallengeTimes };
  run.seenEvents = [...state.seenEvents];
  run.unlockedStickers = [...state.unlockedStickers];
  run.sound = state.sound;
  run.showStickers = state.showStickers;
  run.buyAmount = state.buyAmount;
  run.stats = newStats();
  run.stats.firstPlayed = state.stats.firstPlayed;
  for (const [upgradeId, n] of Object.entries(challenge.rules.startWith ?? {})) run.owned[Number(upgradeId)] = n;
  return run;
}

/**
 * Ends the challenge and returns your empire, exactly as you left it, plus
 * anything earned along the way: achievements, challenge records, lifetime
 * counters and settings. `now` re-stamps the save time so the paused empire
 * doesn't collect offline earnings for the challenge's duration.
 */
export function leaveChallenge(state: GameState, now = Date.now()): GameState {
  if (!state.activeChallenge) return state;
  const main = structuredClone(state.activeChallenge.main);
  main.achievements = [...new Set([...main.achievements, ...state.achievements])];
  main.completedChallenges = [...state.completedChallenges];
  main.bestChallengeTimes = { ...state.bestChallengeTimes };
  main.seenEvents = [...new Set([...main.seenEvents, ...state.seenEvents])];
  main.unlockedStickers = [...new Set([...main.unlockedStickers, ...state.unlockedStickers])];
  main.sound = state.sound;
  main.showStickers = state.showStickers;
  main.buyAmount = state.buyAmount;
  for (const key of CARRIED_STATS) main.stats[key] += state.stats[key];
  main.activeChallenge = null;
  main.buffs = [];
  main.lastSaved = now;
  return main;
}

export interface ChallengeWin {
  challenge: Challenge;
  seconds: number;
  firstWin: boolean;
  newBest: boolean;
  achievements: Achievement[];
}

/** Progress toward the goal, from 0 to 1. */
export function challengeProgress(state: GameState): number {
  if (!state.activeChallenge) return 0;
  return Math.min(1, state.runEarnings / challengeById(state.activeChallenge.id).goal);
}

/**
 * If the goal is reached: records the win on the run (achievements, best time,
 * completion) and returns what happened. The caller then calls leaveChallenge.
 * Returns null while the goal isn't reached yet.
 */
export function checkChallengeWin(state: GameState): ChallengeWin | null {
  if (!state.activeChallenge || challengeProgress(state) < 1) return null;
  const challenge = challengeById(state.activeChallenge.id);
  const seconds = state.stats.runSeconds;
  const firstWin = !state.completedChallenges.includes(challenge.id);
  const previous = state.bestChallengeTimes[challenge.id];
  const newBest = previous === undefined || seconds < previous;

  if (firstWin) state.completedChallenges.push(challenge.id);
  if (newBest) state.bestChallengeTimes[challenge.id] = seconds;

  const achievements: Achievement[] = [];
  const grant = (id: string) => {
    const a = grantAchievement(state, id);
    if (a) achievements.push(a);
  };
  grant(challenge.achievement);
  if (seconds <= challenge.speedrunSec) grant(challenge.speedrunAchievement);
  if (challenge.id === 'status-quo' && state.stats.failedPurchases >= 10) grant('permit-office');

  return { challenge, seconds, firstWin, newBest, achievements };
}
