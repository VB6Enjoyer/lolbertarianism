#!/usr/bin/env node
// Balance check for Ancapistan Tycoon: a simulated player runs the real game
// rules second by second and reports when milestones are reached.
//
//   npm run simulate                      # normal game, both player profiles, up to 300 hours
//   npm run simulate -- 100               # stop at 100 hours
//   npm run simulate -- --challenges      # each challenge run, up to 8 hours
//
// The player buys whatever pays for itself fastest, catches most golden
// stickers, hides from raids after a few seconds, secedes when that at least
// doubles their cities, and spends cities on the cheapest charter.
// Offline earnings are not simulated (this is time with the game open).
//
// Try other numbers without editing data.ts (deep-merged into BALANCE / CHARTER_VALUES):
//   BALANCE='{"secession":{"root":3}}' npm run simulate

import { enterChallenge } from '../src/games/ancapistan-tycoon/challenges.ts';
import {
  BALANCE,
  CHALLENGES,
  CHARTERS,
  CHARTER_VALUES,
  PERKS,
  REGULAR_STICKERS,
  STICKERS,
  STICKER_SETS,
  UPGRADES,
  type ChallengeId,
} from '../src/games/ancapistan-tycoon/data.ts';
import {
  buyCharter,
  buyPerk,
  buySticker,
  buyUpgrade,
  catchGolden,
  citiesAvailable,
  click,
  derive,
  earningsForCities,
  goldenDelayMultiplier,
  newState,
  ownedCount,
  pendingCities,
  perkCost,
  pickGoldenEffect,
  purchaseQuote,
  raidChance,
  raidMinScore,
  secede,
  stickerCost,
  tick,
  unlockAchievements,
  type GameState,
} from '../src/games/ancapistan-tycoon/logic.ts';

interface Profile {
  name: string;
  clicksPerSec: number;
  /** Share of golden stickers caught. */
  goldenCatchRate: number;
  /** Seconds before hiding assets when the Fed raids. */
  raidReaction: number;
}

const PROFILES: Profile[] = [
  { name: 'Active (5 clicks/s)', clicksPerSec: 5, goldenCatchRate: 0.8, raidReaction: 3 },
  { name: 'Casual (1 click/s)', clicksPerSec: 1, goldenCatchRate: 0.5, raidReaction: 10 },
];

const args = process.argv.slice(2);
const CHALLENGE_MODE = args.includes('--challenges');
const MAX_HOURS = Number(args.find((a) => /^\d+$/.test(a))) || (CHALLENGE_MODE ? 8 : 300);
const DECIDE_EVERY = 5; // seconds between shopping trips
const RAID_EVERY = BALANCE.raid.intervalMs / 1000;

/** Deep-merges JSON overrides into a (runtime-mutable) settings object. */
function override(target: Record<string, unknown>, json: string | undefined) {
  if (!json) return;
  const merge = (t: Record<string, unknown>, src: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) merge(t[k] as Record<string, unknown>, v as Record<string, unknown>);
      else t[k] = v;
    }
  };
  merge(target, JSON.parse(json));
}
override(BALANCE as unknown as Record<string, unknown>, process.env.BALANCE);
override(CHARTER_VALUES as unknown as Record<string, unknown>, process.env.CHARTER_VALUES);

/** Seeded RNG so runs are repeatable. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
let random = rng(42);

/** Money per second from income plus clicking, crits and requisitioned clicks included. */
function rate(s: GameState, p: Profile, now: number): number {
  const d = derive(s, now);
  const keep = 1 - (s.activeChallenge ? (CHALLENGES.find((c) => c.id === s.activeChallenge!.id)!.rules.clickFailChance ?? 0) : 0);
  return d.incomePerSec + p.clicksPerSec * keep * d.clickAmount * (1 + d.critChance * (BALANCE.critMultiplier - 1));
}

const clone = (s: GameState): GameState => structuredClone(s);

type Option = { cost: number; gain: number; buy: (s: GameState) => unknown };

function options(s: GameState, p: Profile, now: number): Option[] {
  const base = rate(s, p, now);
  const opts: Option[] = [];
  const gainOf = (apply: (x: GameState) => unknown) => {
    const c = clone(s);
    c.score = Infinity; // so the purchase goes through for the what-if
    apply(c);
    return rate(c, p, now) - base;
  };
  for (const u of UPGRADES) {
    const { cost } = purchaseQuote(s, u); // Infinity when banned
    if (!Number.isFinite(cost)) continue;
    // Expected gain: a Status Quo business can fail, so weight by the chance it works.
    const failChance = u.type === 'passive' ? (s.activeChallenge ? (CHALLENGES.find((c) => c.id === s.activeChallenge!.id)!.rules.businessFailChance ?? 0) : 0) : 0;
    opts.push({ cost, gain: gainOf((c) => buyUpgrade(c, u, 1)) * (1 - failChance), buy: (x) => buyUpgrade(x, u, random()) });
  }
  for (const perk of PERKS) {
    if (s.perks.includes(perk.id)) continue;
    opts.push({ cost: perkCost(s, perk), gain: gainOf((c) => buyPerk(c, perk)), buy: (x) => buyPerk(x, perk) });
  }
  // Stickers: aim at the set closest to completion.
  // Only sets on sale all year (limited editions aren't available in a simulated year-round run).
  const missing = STICKER_SETS.map((set) => STICKERS.filter((x) => x.category === set.category && !x.season && !s.stickers.includes(x.id)))
    .filter((list) => list.length)
    .sort((a, b) => a.length - b.length)[0];
  if (missing) {
    const id = missing[0].id;
    // A sticker's own +0.5% is small; count a share of the set bonus it works toward.
    const direct = gainOf((c) => buySticker(c, id));
    const setGain = gainOf((c) => missing.forEach((x) => buySticker(c, x.id))) / missing.length;
    opts.push({ cost: stickerCost(s), gain: Math.max(direct, setGain), buy: (x) => buySticker(x, id) });
  }
  return opts.filter((o) => o.gain > 0);
}

function shop(s: GameState, p: Profile, now: number) {
  for (let guard = 0; guard < 200; guard++) {
    const opts = options(s, p, now);
    if (!opts.length) return;
    // Best payback time, counting the wait to afford it.
    const income = Math.max(rate(s, p, now), 1e-9);
    const best = opts.reduce((a, b) => {
      const pa = a.cost / a.gain + Math.max(0, a.cost - s.score) / income;
      const pb = b.cost / b.gain + Math.max(0, b.cost - s.score) / income;
      return pb < pa ? b : a;
    });
    if (best.cost > s.score) return;
    best.buy(s);
  }
}

interface Milestone {
  label: string;
  test: (s: GameState) => boolean;
  at?: number;
}

function normalMilestones(): Milestone[] {
  return [
    { label: 'Earn $1,000', test: (x) => x.allTimeEarnings >= 1e3 },
    { label: 'First special upgrade', test: (x) => x.perks.length > 0 || x.stats.secessions > 0 },
    { label: 'First bought sticker', test: (x) => x.stickers.length > 0 },
    { label: `Earn $${(earningsForCities(1) / 1e6).toLocaleString()}M (first city possible)`, test: (x) => x.allTimeEarnings >= earningsForCities(1) },
    { label: 'First secession', test: (x) => x.stats.secessions >= 1 },
    { label: 'Privatize solar system', test: (x) => ownedCount(x, 14) > 0 },
    { label: '10 Free Private Cities', test: (x) => x.cities >= 10 },
    { label: 'First late-game upgrade ($5B)', test: (x) => ownedCount(x, 15) > 0 },
    { label: 'First sticker set', test: (x) => STICKER_SETS.some((set) => STICKERS.filter((y) => y.category === set.category).every((y) => x.stickers.includes(y.id))) },
    { label: '25 Free Private Cities', test: (x) => x.cities >= 25 },
    { label: 'Dyson sphere ($500B)', test: (x) => ownedCount(x, 18) > 0 },
    { label: 'All 11 charters (55 cities)', test: (x) => x.charters.length === CHARTERS.length },
    { label: 'Andromeda ($200T)', test: (x) => ownedCount(x, 22) > 0 },
    { label: `All ${REGULAR_STICKERS.length} stickers in one run`, test: (x) => REGULAR_STICKERS.every((y) => x.stickers.includes(y.id)) },
  ];
}

function challengeMilestones(id: ChallengeId): Milestone[] {
  const goal = CHALLENGES.find((c) => c.id === id)!.goal;
  return [0.1, 0.25, 0.5, 1].map((share) => ({
    label: share === 1 ? 'Win' : `${share * 100}% of goal`,
    test: (x: GameState) => x.runEarnings >= goal * share,
  }));
}

function simulate(p: Profile, challenge?: ChallengeId) {
  random = rng(42);
  const s = challenge ? enterChallenge(newState(), challenge)! : newState();
  s.buyAmount = 1;
  let now = 0;
  let nextGolden = (BALANCE.golden.minDelaySec + random() * (BALANCE.golden.maxDelaySec - BALANCE.golden.minDelaySec)) * 1000;
  let frozenUntil = 0;
  const milestones = challenge ? challengeMilestones(challenge) : normalMilestones();

  const end = MAX_HOURS * 3600;
  for (let t = 1; t <= end; t++) {
    now = t * 1000;
    const raided = now < frozenUntil;
    tick(s, raided, now);
    if (!raided) for (let c = 0; c < p.clicksPerSec; c++) click(s, random(), now, random());

    if (t % RAID_EVERY === 0 && s.score >= raidMinScore(s) && random() < raidChance(s)) {
      if (random() >= derive(s, now).raidEvasionChance) {
        frozenUntil = now + p.raidReaction * 1000;
        s.stats.raidsEvaded++;
      }
    }
    if (now >= nextGolden) {
      if (random() < p.goldenCatchRate) catchGolden(s, pickGoldenEffect(random()), now);
      const { minDelaySec, maxDelaySec } = BALANCE.golden;
      nextGolden = now + (minDelaySec + random() * (maxDelaySec - minDelaySec)) * 1000 * goldenDelayMultiplier(s);
    }

    if (t % DECIDE_EVERY === 0) {
      shop(s, p, now);
      unlockAchievements(s);
      if (!challenge && pendingCities(s) >= Math.max(1, s.cities)) {
        secede(s);
        for (const c of [...CHARTERS].sort((a, b) => a.cost - b.cost)) {
          if (citiesAvailable(s) >= c.cost) buyCharter(s, c);
        }
      }
    }

    for (const m of milestones) if (m.at === undefined && m.test(s)) m.at = t;
    if (milestones.every((m) => m.at !== undefined)) break;
  }
  return { s, milestones };
}

const fmtTime = (sec?: number) => {
  if (sec === undefined) return `> ${MAX_HOURS}h`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec % 60).padStart(2, '0')}s`;
};

function table(title: string, results: { p: Profile; milestones: Milestone[] }[]) {
  const labels = results[0].milestones.map((m) => m.label);
  const width = Math.max(...labels.map((l) => l.length), 9);
  console.log(`\n${title}\n`);
  console.log(`${'Milestone'.padEnd(width)}  ${results.map((r) => r.p.name.padStart(20)).join('  ')}`);
  for (const [i, label] of labels.entries()) {
    console.log(`${label.padEnd(width)}  ${results.map((r) => fmtTime(r.milestones[i].at).padStart(20)).join('  ')}`);
  }
}

if (CHALLENGE_MODE) {
  console.log(`\nAncapistan Tycoon challenge simulation (open-game time, max ${MAX_HOURS}h)`);
  for (const c of CHALLENGES) {
    const results = PROFILES.map((p) => ({ p, ...simulate(p, c.id) }));
    table(`${c.icon} ${c.name}: goal $${c.goal.toLocaleString()}, speedrun under ${fmtTime(c.speedrunSec)}`, results);
    const [active] = results;
    console.log(`  (active player: ${active.s.stats.failedPurchases} failed purchases, ${active.s.stats.requisitionedClicks} requisitioned clicks, ${active.s.stats.raidsEvaded} raids)`);
  }
} else {
  const results = PROFILES.map((p) => ({ p, ...simulate(p) }));
  table(`Ancapistan Tycoon balance simulation (open-game time, max ${MAX_HOURS}h)`, results);
  for (const { p, s } of results) {
    console.log(`\n${p.name} at the end: ${s.cities} cities, ${s.stats.secessions} secessions, ${s.charters.length} charters, ${s.achievements.length} achievements, ${s.stats.goldenClicks} golden stickers, ${s.stats.raidsEvaded} raids`);
  }
}
