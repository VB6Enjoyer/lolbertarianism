import { describe, expect, it } from 'vitest';
import { checkChallengeWin, challengeById, challengeProgress, enterChallenge, leaveChallenge } from './challenges.ts';
import { ACHIEVEMENTS, BALANCE, CHALLENGES, PERKS, UPGRADES, type ChallengeId } from './data.ts';
import {
  bannedReason,
  buyPerk,
  buyUpgrade,
  click,
  derive,
  earn,
  goldenCash,
  newState,
  offlineEarnings,
  pendingCities,
  purchaseQuote,
  raidChance,
  raidMinScore,
  secede,
  stickerCost,
  tick,
  upgradePriceMultiplier,
  type GameState,
} from './logic.ts';
import { exportSave, importSave, normalize } from './save.ts';

const upgrade = (id: number) => UPGRADES.find((u) => u.id === id)!;

/** A late-game empire to set aside. */
function empire(): GameState {
  const s = newState();
  s.score = 5e12;
  s.allTimeEarnings = 9e14;
  s.runEarnings = 2e13;
  s.cities = 40;
  s.charters = ['seed-capital', 'network-effects'];
  s.owned = { 2: 50, 14: 10 };
  s.perks = ['su1', 'su2'];
  s.stickers = [...s.stickers, 'hoppe'];
  s.achievements = ['first-click', 'earn-1k'];
  s.stats.clicks = 1000;
  s.stats.playSeconds = 50_000;
  s.stats.firstPlayed = 123;
  s.sound = false;
  return s;
}

const enter = (s: GameState, id: ChallengeId) => enterChallenge(s, id)!;

describe('entering and leaving a challenge', () => {
  it('starts a fresh run with no cities, charters or achievement bonus', () => {
    const run = enter(empire(), 'minarchist');
    expect(run.activeChallenge?.id).toBe('minarchist');
    expect(run).toMatchObject({ score: 0, cities: 0, charters: [], perks: [], runEarnings: 0 });
    expect(run.owned).toEqual({ 9: 1 }); // the State-provided PMC
    expect(run.achievements).toEqual(['first-click', 'earn-1k']); // kept, but…
    expect(derive(run).achievementMultiplier).toBe(1); // …no bonus during the challenge
    expect(run.sound).toBe(false);
    expect(run.stats.firstPlayed).toBe(123);
    expect(enterChallenge(run, 'communism')).toBeNull(); // no challenge inside a challenge
  });

  it('abandoning gives your empire back exactly, with lifetime counters merged', () => {
    const s = empire();
    const run = enter(s, 'communism');
    run.stats.clicks += 500;
    run.stats.playSeconds += 600;
    run.achievements.push('first-crit');
    run.buyAmount = 'max';
    const back = leaveChallenge(run, 999);
    expect(back.activeChallenge).toBeNull();
    expect(back).toMatchObject({ score: 5e12, cities: 40, charters: ['seed-capital', 'network-effects'], owned: { 2: 50, 14: 10 } });
    expect(back.stats.clicks).toBe(1500);
    expect(back.stats.playSeconds).toBe(50_600);
    expect(back.achievements).toContain('first-crit');
    expect(back.buyAmount).toBe('max');
    expect(back.lastSaved).toBe(999); // the paused empire earns nothing offline for the challenge's duration
    expect(back.completedChallenges).toEqual([]);
  });

  it('winning records the challenge, the best time and its achievements', () => {
    const run = enter(empire(), 'minarchist');
    expect(checkChallengeWin(run)).toBeNull();
    earn(run, challengeById('minarchist').goal / 2);
    expect(challengeProgress(run)).toBe(0.5);
    run.stats.runSeconds = 1800;
    earn(run, challengeById('minarchist').goal / 2);
    const win = checkChallengeWin(run)!;
    expect(win).toMatchObject({ seconds: 1800, firstWin: true, newBest: true });
    expect(win.achievements.map((a) => a.id)).toEqual(['challenge-minarchist', 'speedrun-minarchist']);
    const back = leaveChallenge(run);
    expect(back.completedChallenges).toEqual(['minarchist']);
    expect(back.bestChallengeTimes.minarchist).toBe(1800);
    expect(back.achievements).toContain('challenge-minarchist');

    // A slower second win keeps the best time and doesn't repeat achievements.
    const again = enter(back, 'minarchist');
    again.stats.runSeconds = 5000;
    earn(again, challengeById('minarchist').goal);
    expect(checkChallengeWin(again)).toMatchObject({ firstWin: false, newBest: false, achievements: [] });
    expect(leaveChallenge(again).bestChallengeTimes.minarchist).toBe(1800);
  });

  it('no seceding, no new cities and no offline earnings during a challenge', () => {
    const run = enter(empire(), 'minarchist');
    earn(run, 1e15);
    expect(pendingCities(run)).toBe(0);
    expect(secede(run)).toBe(0);
    run.lastSaved = 1000;
    run.owned = { 2: 100 };
    expect(offlineEarnings(run, 1000 + 3600_000).amount).toBe(0);
  });

  it('a challenge in progress survives saving, loading and save codes', () => {
    const run = enter(empire(), 'status-quo');
    earn(run, 1234);
    const loaded = normalize(JSON.parse(JSON.stringify(run)));
    expect(loaded.activeChallenge?.id).toBe('status-quo');
    expect(loaded.activeChallenge?.main.cities).toBe(40);
    expect(loaded.score).toBe(1234);
    expect(importSave(exportSave(run))?.activeChallenge?.main.charters).toEqual(['seed-capital', 'network-effects']);
    expect(normalize({ activeChallenge: { id: 'nope' as ChallengeId, main: newState() } }).activeChallenge).toBeNull();
  });
});

describe('challenge rules', () => {
  it('Minarchist: 5% flat tax and twice the raids', () => {
    const run = enter(newState(), 'minarchist');
    run.owned = { 2: 100 };
    run.stickers = [];
    expect(derive(run).incomePerSec).toBeCloseTo(100 * 0.95);
    expect(derive(run).clickAmount).toBeCloseTo(0.95);
    expect(raidChance(run)).toBeCloseTo(BALANCE.raid.chance * 2);
  });

  it('Status Quo: tax brackets, bans, failing businesses and inflation', () => {
    const run = enter(newState(), 'status-quo');
    run.stickers = [];
    run.owned = { 2: 5 }; // $5/s gross → 10% bracket
    expect(derive(run).taxRate).toBe(0.1);
    run.owned = { 2: 2000 }; // $2,000/s → 35%
    expect(derive(run).taxRate).toBe(0.35);
    expect(bannedReason(run, upgrade(3))).toContain('ATF');
    expect(purchaseQuote(run, upgrade(3)).cost).toBe(Infinity);
    run.score = 1e6;
    run.owned = {};
    expect(buyUpgrade(run, upgrade(3)).count).toBe(0);

    const before = run.score;
    expect(buyUpgrade(run, upgrade(2), 0.1)).toEqual({ count: 0, failed: true }); // roll under 20%: failed
    expect(run.score).toBeLessThan(before);
    expect(run.stats.failedPurchases).toBe(1);
    expect(buyUpgrade(run, upgrade(1), 0.1).count).toBe(1); // click upgrades never fail

    run.stats.runSeconds = 600; // 10 minutes of the "target rate"
    const perMinute = challengeById('status-quo').rules.inflationPerMinute!;
    expect(upgradePriceMultiplier(run)).toBeCloseTo((1 + perMinute) ** 10);
  });

  it('Communism: click upgrades only, half the clicks requisitioned, 10× prices, audits from the start', () => {
    const run = enter(newState(), 'communism');
    expect(bannedReason(run, upgrade(2))).toContain('Collectivized');
    expect(bannedReason(run, upgrade(1))).toBeNull();
    expect(purchaseQuote(run, upgrade(1)).cost).toBe(Math.ceil(15 * 10));
    expect(stickerCost(run)).toBe(BALANCE.stickers.firstCost * 10);
    const perk = PERKS[0];
    run.score = perk.cost * 10 - 1;
    expect(buyPerk(run, perk)).toBe(false);
    expect(click(run, 0.9, Date.now(), 0.3)).toMatchObject({ amount: 0, requisitioned: true });
    expect(click(run, 0.9, Date.now(), 0.7)).toMatchObject({ requisitioned: false });
    expect(run.stats.clicks).toBe(2);
    expect(run.stats.requisitionedClicks).toBe(1);
    expect(raidMinScore(run)).toBe(0);
    expect(raidChance(run)).toBeCloseTo(0.5); // about one audit a minute at a check every 30s
  });

  it('Hyperinflation: cash melts and prices double on schedule', () => {
    const run = enter(newState(), 'hyperinflation');
    run.score = 1000;
    tick(run, true); // raid freezes income, but cash still melts
    expect(run.score).toBeCloseTo(999);
    const perMinute = challengeById('hyperinflation').rules.inflationPerMinute!;
    const doublingMinutes = Math.log(2) / Math.log(1 + perMinute);
    expect(doublingMinutes).toBeCloseTo(10); // matches the card: "double every 10 minutes"
    run.stats.runSeconds = doublingMinutes * 60;
    expect(upgradePriceMultiplier(run)).toBeCloseTo(2);
  });

  it('rewards apply in normal play only', () => {
    const s = newState();
    s.completedChallenges = ['minarchist', 'status-quo', 'communism', 'hyperinflation'];
    s.stickers = [];
    expect(raidChance(s)).toBeCloseTo(BALANCE.raid.chance * 0.9);
    expect(upgradePriceMultiplier(s)).toBeCloseTo(0.95);
    expect(derive(s).clickAmount).toBeCloseTo(1.25);
    expect(goldenCash(s)).toBeCloseTo(50 * 1.25 * 1.5); // 50 clicks' worth, ×1.5
    const run = enter(s, 'minarchist');
    run.stickers = [];
    run.owned = {}; // drop the starting PMC to compare base clicks
    expect(upgradePriceMultiplier(run)).toBe(1);
    expect(derive(run).clickAmount).toBeCloseTo(0.95); // tax, no reward
  });

  it('every challenge has its achievements defined, and winning all four unlocks Tried Every System', () => {
    for (const c of CHALLENGES) {
      expect(ACHIEVEMENTS.some((a) => a.id === c.achievement), c.id).toBe(true);
      expect(ACHIEVEMENTS.some((a) => a.id === c.speedrunAchievement), c.id).toBe(true);
    }
    const all = ACHIEVEMENTS.find((a) => a.id === 'all-challenges')!;
    expect(all.check?.({ challengesCompleted: 4 } as never)).toBe(true);
  });
});
