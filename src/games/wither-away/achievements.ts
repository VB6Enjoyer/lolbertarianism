// Achievements: things worth a trophy. Some are about one run (checked as you play, so they pop up
// the moment you earn them), some about everything you've done. Pure: give it the run and the
// lifetime numbers, it says what's newly earned.

import { CHARACTER_ORDER, type CharacterId, EVOLUTIONS, MAP_ORDER, type MapId, RUN_LENGTH } from './data.ts';
import type { Game } from './game.ts';

/** Everything you've done, across runs. */
export interface Progress {
  runs: number;
  wins: number;
  kills: number;
  banks: number;
  marx: number;
  /** Bitcoin earned, ever, and in the bank now. */
  gold: number;
  bank: number;
  /** Things bought in the Free Market. */
  bought: number;
  played: CharacterId[];
  maps: MapId[];
  /** Longest endless run (seconds). */
  endless: number;
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  text: string;
  /** Earned during (or at the end of) a run. */
  run?: (g: Game) => boolean;
  /** Earned over time. */
  life?: (p: Progress) => boolean;
}

const evolved = (g: Game) => g.weapons.some((w) => w.id === EVOLUTIONS[g.character].to);
const killed = (g: Game, type: keyof Game['killsBy']) => g.killsBy[type] ?? 0;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '🤝', name: 'Voluntary Exchange', text: 'Send your first statist packing.', run: (g) => g.kills >= 1 },
  { id: 'five', icon: '⏱️', name: 'The Five-Minute Plan', text: 'Survive 5:00.', run: (g) => g.time >= 300 },
  { id: 'ten', icon: '⏳', name: 'Ten Years After', text: 'Survive 10:00.', run: (g) => g.time >= 600 },
  { id: 'win', icon: '🏆', name: 'The State Withers Away', text: 'Survive 15:00 and win a run.', run: (g) => g.over === 'won' },
  { id: 'fed', icon: '💸', name: 'End the Fed', text: 'Bring down the Central Bank.', run: (g) => g.bankKills >= 1 },
  { id: 'marx', icon: '🧔', name: 'The Close of His System', text: 'Bring down Marx (Böhm-Bawerk would be proud).', run: (g) => g.marxKills >= 1 },
  { id: 'both', icon: '👑', name: 'Double Coincidence of Wants', text: 'Bring down the Central Bank and Marx in the same run.', run: (g) => g.bankKills >= 1 && g.marxKills >= 1 },
  { id: 'k1000', icon: '💀', name: 'Counter-Revolutionary', text: 'Send 1,000 statists packing in one run.', run: (g) => g.kills >= 1000 },
  { id: 'k3000', icon: '☠️', name: 'Laissez-Faire, Laissez-Passer', text: 'Send 3,000 statists packing in one run.', run: (g) => g.kills >= 3000 },
  { id: 'untouched', icon: '🕊️', name: 'Non-Aggression', text: 'Last 2:00 without getting hurt once.', run: (g) => g.time >= 120 && (g.firstHurt < 0 || g.firstHurt >= 120) },
  { id: 'evolve', icon: '⬆️', name: 'Capital Goods', text: 'Upgrade your starting weapon in a run.', run: evolved },
  { id: 'arsenal', icon: '🧰', name: 'Diversified Portfolio', text: 'Carry five weapons at once.', run: (g) => g.weapons.length >= 5 },
  { id: 'level30', icon: '💹', name: 'Compound Interest', text: 'Reach level 30 in a run.', run: (g) => g.level >= 30 },
  { id: 'bomb', icon: '💣', name: 'Exit Strategy', text: 'Set off a bomb.', run: (g) => g.bombsUsed >= 1 },
  { id: 'nobomb', icon: '🧘', name: 'Low Time Preference', text: 'Survive 10:00 without setting off a bomb.', run: (g) => g.time >= 600 && g.bombsUsed === 0 },
  { id: 'taxman', icon: '🧾', name: 'Taxation Is Theft', text: 'Send 25 Taxmen packing in one run.', run: (g) => killed(g, 'taxman') >= 25 },
  { id: 'yimby', icon: '🏘️', name: 'YIMBY', text: 'Send 30 NIMBYs packing in one run.', run: (g) => killed(g, 'nimby') >= 30 },
  { id: 'printers', icon: '🖨️', name: 'Stop the Presses', text: 'Smash 3 money printers in one run.', run: (g) => killed(g, 'printer') >= 3 },
  { id: 'regulated', icon: '📋', name: 'Regulatory Capture', text: 'Survive 5:00 with every regulation switched on.', run: (g) => g.time >= 300 && g.mods.enemyHp > 1 && g.mods.spawns > 1 && g.mods.enemySpeed > 1 && g.mods.hurt > 1 },
  { id: 'long', icon: '♾️', name: 'In the Long Run', text: 'Survive 20:00 in endless mode. (We are not all dead.)', run: (g) => g.endless && g.time >= RUN_LENGTH + 300 },
  { id: 'longer', icon: '🌌', name: 'Perpetual Growth', text: 'Survive 30:00 in endless mode.', run: (g) => g.endless && g.time >= RUN_LENGTH * 2 },
  { id: 'everyone', icon: '🎭', name: 'Big Tent', text: 'Play a run as each of the four libertarians.', life: (p) => CHARACTER_ORDER.every((id) => p.played.includes(id)) },
  { id: 'maps', icon: '🗺️', name: 'Voting with Your Feet', text: 'Play a run on every map.', life: (p) => MAP_ORDER.every((id) => p.maps.includes(id)) },
  { id: 'kills', icon: '📈', name: 'Mass Production', text: 'Send 25,000 statists packing, all runs together.', life: (p) => p.kills >= 25000 },
  { id: 'hodl', icon: '₿', name: 'HODL', text: 'Have 1,000 Bitcoin in the bank at once.', life: (p) => p.bank >= 1000 },
  { id: 'shopper', icon: '🛒', name: 'Consumer Sovereignty', text: 'Buy 10 things in the Free Market.', life: (p) => p.bought >= 10 },
  { id: 'veteran', icon: '🎖️', name: 'Praxeologist', text: 'Play 50 runs.', life: (p) => p.runs >= 50 },
];

/** The ones newly earned, given those you already have, the run (if any) and the lifetime numbers. */
export function newlyEarned(have: readonly string[], g: Game | null, p: Progress | null): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !have.includes(a.id) && ((g && a.run?.(g)) || (p && a.life?.(p))));
}
