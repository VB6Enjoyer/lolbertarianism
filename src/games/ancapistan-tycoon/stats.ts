// The 📊 Stats panel's contents, as plain data (no DOM), so it's easy to test.

import { formatMoney } from '../../shared/format.ts';
import { ACHIEVEMENTS, BALANCE, CHALLENGES, CHARTERS, STICKERS, STICKER_SETS, UPGRADES } from './data.ts';
import { activeBuffs, citiesAvailable, completedStickerSets, derive, type GameState } from './logic.ts';

export interface StatsSection {
  title: string;
  rows: [label: string, value: string][];
}

const money = (n: number) => `$${formatMoney(n)}`;
const count = (n: number) => n.toLocaleString();
const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString()}%`;
const times = (n: number) => `×${(Math.round(n * 100) / 100).toLocaleString()}`;

/** "3d 4h 12m", "4h 12m", "12m 5s", "5s". */
export function formatPlaytime(seconds: number): string {
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function buildStats(state: GameState, now = Date.now()): StatsSection[] {
  const d = derive(state, now);
  const st = state.stats;
  const upgradesOwned = UPGRADES.reduce((n, u) => n + (state.owned[u.id] ?? 0), 0);
  const boosts = activeBuffs(state, now);

  return [
    {
      title: '💰 Economy',
      rows: [
        ['Cash', money(state.score)],
        ['Income', `${money(d.incomePerSec)} / sec`],
        ['Click value', money(d.clickAmount)],
        ['Crit chance', d.critChance ? `${pct(d.critChance)} (×${BALANCE.critMultiplier} clicks)` : 'None yet'],
        ['Earned this run', money(state.runEarnings)],
        ['Earned all-time', money(state.allTimeEarnings)],
        ['Best run', money(Math.max(st.bestRunEarnings, state.runEarnings))],
        ['Biggest click', money(st.biggestClick)],
      ],
    },
    {
      title: '📈 Income bonuses',
      rows: [
        ['Free Private Cities', times(d.cityMultiplier)],
        ['Achievements', times(d.achievementMultiplier)],
        ['Stickers', times(d.stickerMultiplier)],
        ['Sticker sets', `${times(d.setIncomeMultiplier)} income, ${times(d.setClickMultiplier)} clicks`],
        ['Special upgrades', times(d.passiveMultiplier)],
        ['Golden boosts', boosts.length ? boosts.map(({ effect }) => `${effect.icon} ${effect.name}`).join(', ') : 'None active'],
      ],
    },
    {
      title: '🖱️ Activity',
      rows: [
        ['Clicks', count(st.clicks)],
        ['Critical clicks', st.clicks ? `${count(st.crits)} (${pct(st.crits / st.clicks)})` : '0'],
        ['Golden stickers caught', count(st.goldenClicks)],
        ['Raids evaded', `${count(st.raidsEvaded)} by hand, ${count(st.raidsAutoEvaded)} by shell companies`],
        ['Stickers dragged', count(st.stickersDragged)],
        ['Sticker reshuffles', count(st.reshuffles)],
        ['Welcome-back payouts', count(st.offlineCollected)],
      ],
    },
    {
      title: '🏙️ Empire',
      rows: [
        ['Free Private Cities', `${count(state.cities)} (${count(citiesAvailable(state))} unspent)`],
        ['Secessions', count(st.secessions)],
        ['Charters', `${state.charters.length} / ${CHARTERS.length}`],
        ['Achievements', `${state.achievements.length} / ${ACHIEVEMENTS.length}`],
        ['Stickers', `${state.stickers.length} / ${STICKERS.length}`],
        ['Sticker sets', `${completedStickerSets(state).length} / ${STICKER_SETS.length}`],
        ['Challenges won', `${state.completedChallenges.length} / ${CHALLENGES.length}`],
        ['Upgrades owned', count(upgradesOwned)],
      ],
    },
    {
      title: '⏱️ Time',
      rows: [
        ['Time played', formatPlaytime(st.playSeconds)],
        ['This run', formatPlaytime(st.runSeconds)],
        ['Tracking since', st.firstPlayed ? new Date(st.firstPlayed).toLocaleDateString() : 'Today'],
        ...CHALLENGES.filter((c) => state.bestChallengeTimes[c.id] !== undefined).map(
          (c): [string, string] => [`Best: ${c.name}`, formatPlaytime(state.bestChallengeTimes[c.id]!)],
        ),
      ],
    },
  ];
}
