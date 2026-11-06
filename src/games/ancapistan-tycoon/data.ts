// Content and balance for Ancapistan Tycoon. Tweak numbers here, not in the game code.

export const BALANCE = {
  /** Each owned copy of an upgrade makes the next one this much pricier. */
  costGrowth: 1.15,
  critMultiplier: 5,
  /** Chance per click of a meme phrase floating up. */
  phraseChance: 0.1,
  raid: {
    intervalMs: 30_000,
    /** Raids only happen once you have more than this much cash. */
    minScore: 5000,
    /** Chance a raid happens at each interval. */
    chance: 0.3,
    evadeBonus: 100,
  },
  offline: {
    /** Share of passive income earned while the tab is closed. */
    rate: 0.5,
    maxSeconds: 8 * 60 * 60,
    /** Shorter absences aren't worth a popup. */
    minSeconds: 60,
  },
  secession: {
    /**
     * Total Free Private Cities ever earned = floor((all-time earnings / divisor) ^ (1 / root)).
     * Tuned with `npm run simulate`: a cube root keeps the prestige loop from running away
     * (a square root reached ~17,000 cities in 6 hours of play).
     */
    divisor: 5_000_000,
    root: 3,
    /** Income bonus per Free Private City (applies to clicks and passive income). */
    bonusPerCity: 0.1,
  },
  /** Income bonus per unlocked achievement. */
  bonusPerAchievement: 0.01,
  stickers: {
    /** Passive income (CPS) bonus per sticker owned. */
    bonusEach: 0.005,
    /** Price of the first sticker you buy… */
    firstCost: 10_000,
    /** …and of the last one. Prices in between grow by the same factor each purchase. */
    lastCost: 10_000_000_000_000,
  },
  golden: {
    /** Seconds between golden stickers (random in this range). */
    minDelaySec: 90,
    maxDelaySec: 240,
    /** How long one stays on screen before it's gone. */
    lifetimeSec: 13,
    /** Instant-cash reward: the smaller of this share of your cash… */
    cashShareOfScore: 0.25,
    /** …and this many seconds of income, but never less than this many clicks' worth. */
    cashIncomeSeconds: 900,
    cashMinClicks: 50,
  },
  saveIntervalMs: 5000,
} as const;

// ---------------------------------------------------------------------------
// Charters (the prestige shop): permanent perks bought with Free Private Cities
// ---------------------------------------------------------------------------

export type CharterId =
  | 'seed-capital'
  | 'grandfathered'
  | 'private-courts'
  | 'seed-phrases'
  | 'remote-management'
  | 'long-bull'
  | 'sticker-license'
  | 'bulk-discount'
  | 'tenure'
  | 'lindy'
  | 'network-effects';

export interface Charter {
  id: CharterId;
  icon: string;
  name: string;
  description: string;
  lore: string;
  /** Price in Free Private Cities. */
  cost: number;
}

/** The numbers behind each charter. Tweak here. */
export const CHARTER_VALUES = {
  seedCapital: 25_000,
  grandfathered: { 1: 10, 2: 10 } as Record<number, number>, // theory books, lemonade stands
  privateCourtsRaidChance: 0.5, // raid odds multiplier
  seedPhrasesDelay: 0.75, // golden sticker wait multiplier
  remoteManagement: { rate: 1, maxSeconds: 24 * 60 * 60 },
  longBullDuration: 1.5, // golden boost duration multiplier
  bulkDiscount: 0.9, // upgrade price multiplier
  lindyBonusPerAchievement: 0.02,
  networkEffectsBonusPerCity: 0.15,
} as const;

export const CHARTERS: readonly Charter[] = [
  { id: 'seed-capital', icon: '💼', name: 'Seed Capital', cost: 1, description: 'Start every new city with $25,000.', lore: 'Angel investors love a founder with a track record of fleeing jurisdictions.' },
  { id: 'grandfathered', icon: '📜', name: 'Grandfather Clause', cost: 2, description: 'Start every new city with 10 theory books and 10 lemonade stands.', lore: 'Your lemonade empire predates the regulations. Legally, it never stopped existing.' },
  { id: 'private-courts', icon: '⚖️', name: 'Private Courts', cost: 2, description: 'Fed raids happen half as often.', lore: 'Polycentric law: the Fed can sue you, but your arbitrator has never heard of them.' },
  { id: 'seed-phrases', icon: '🧠', name: 'Memorized Seed Phrases', cost: 3, description: 'Golden stickers show up 25% sooner.', lore: 'Twenty-four words, tattooed somewhere only you know.' },
  { id: 'remote-management', icon: '🏝️', name: 'Remote Management', cost: 3, description: 'Offline earnings are 100% of your income, for up to 24 hours.', lore: 'You hired managers who believe in incentives. They stopped embezzling.' },
  { id: 'long-bull', icon: '🐂', name: 'Secular Bull Market', cost: 4, description: 'Golden sticker boosts last 50% longer.', lore: "With sound money, the good times don't get printed away." },
  { id: 'sticker-license', icon: '🏷️', name: "Collector's Exemption", cost: 5, description: 'Keep your bought stickers when you secede.', lore: 'Your collection is classified as a sovereign cultural archive.' },
  { id: 'bulk-discount', icon: '🏪', name: 'Competitive Suppliers', cost: 6, description: 'All upgrades cost 10% less.', lore: 'Without licensing cartels, a dozen vendors fight for your business.' },
  { id: 'tenure', icon: '🎓', name: 'Austrian Tenure', cost: 8, description: 'Keep your special upgrades when you secede.', lore: 'Once you understand praxeology, you never un-understand it.' },
  { id: 'lindy', icon: '🏆', name: 'Lindy Effect', cost: 10, description: 'Achievements give +2% income each instead of +1%.', lore: 'The longer you have survived the State, the longer you will survive it.' },
  { id: 'network-effects', icon: '🌐', name: 'Network Effects', cost: 15, description: 'Each Free Private City gives +15% income instead of +10%.', lore: 'Every new city makes all the others more valuable. Metcalfe was a libertarian, probably.' },
];

// ---------------------------------------------------------------------------
// Challenge runs: play under a different system, then return to your empire
// ---------------------------------------------------------------------------

export type ChallengeId = 'minarchist' | 'status-quo' | 'communism' | 'hyperinflation';

/** The rule changes a challenge applies. Anything left out works as normal. */
export interface ChallengeRules {
  /** Flat tax on everything earned. */
  flatTax?: number;
  /** Progressive tax: [income per second from, rate]. The highest bracket reached applies. */
  taxBrackets?: readonly (readonly [number, number])[];
  raidChanceMultiplier?: number;
  /** Raids can happen from the start (normally only above BALANCE.raid.minScore). */
  raidsFromStart?: boolean;
  /** Multiplies every price (upgrades, special upgrades, stickers). */
  priceMultiplier?: number;
  /** Every price grows by this share each minute of the run, compounding. */
  inflationPerMinute?: number;
  /** Upgrades that can't be bought, with the label shown instead of a price. */
  banned?: Readonly<Record<number, string>>;
  /** Passive upgrades can't be bought. */
  clickOnly?: boolean;
  /** Chance each click produces nothing. */
  clickFailChance?: number;
  /** Chance that buying a passive business fails: the money is gone, nothing is gained. */
  businessFailChance?: number;
  /** Share of your cash that evaporates every second, compounding. */
  cashDecayPerSec?: number;
  /** Upgrades you start the challenge with. */
  startWith?: Readonly<Record<number, number>>;
}

export interface Challenge {
  id: ChallengeId;
  icon: string;
  name: string;
  tagline: string;
  /** The rules in plain words, for the challenge card. */
  ruleText: readonly string[];
  rules: ChallengeRules;
  /** Earn this much in the challenge run to win. */
  goal: number;
  /** Win within this many seconds for the speedrun achievement. */
  speedrunSec: number;
  /** The permanent perk for winning, in plain words (effects live in CHALLENGE_REWARDS). */
  reward: string;
  /** Achievement ids granted for winning and for the speedrun. */
  achievement: string;
  speedrunAchievement: string;
  /** Themed raid popup text (defaults to the Fed raid). */
  raid?: { title: string; text: string; button: string };
}

export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'minarchist',
    icon: '⚖️',
    name: 'Minarchist Mode',
    tagline: 'A night-watchman state. It watches mostly you.',
    ruleText: ['Fed raids twice as often', 'A flat 5% tax on everything you earn', 'You start with one State-provided PMC'],
    rules: { flatTax: 0.05, raidChanceMultiplier: 2, startWith: { 9: 1 } },
    goal: 2.5e8,
    speedrunSec: 3600,
    reward: 'Fed raids 10% less often',
    achievement: 'challenge-minarchist',
    speedrunAchievement: 'speedrun-minarchist',
  },
  {
    id: 'status-quo',
    icon: '🏛️',
    name: 'Status Quo Mode',
    tagline: 'Welcome to the real world. Please take a number.',
    ruleText: [
      'Progressive income tax: 10% → 20% → 35% → 50% as you grow',
      'AK-47s and raw milk are banned',
      'Passive businesses fail 20% of the time: the money is gone',
      'All prices rise 1% every minute (the "target rate")',
    ],
    rules: {
      taxBrackets: [[0, 0.1], [10, 0.2], [1_000, 0.35], [100_000, 0.5]],
      banned: { 3: '🚫 Banned by the ATF', 4: '🚫 Banned by the FDA' },
      businessFailChance: 0.2,
      inflationPerMinute: 0.01,
    },
    goal: 7.5e7,
    speedrunSec: 3600,
    reward: 'All upgrades 5% cheaper',
    achievement: 'challenge-status-quo',
    speedrunAchievement: 'speedrun-status-quo',
    raid: { title: '🚨 THE IRS IS HERE! 🚨', text: 'Your paperwork is missing form 27-B/6, in triplicate.', button: 'SHRED THE EVIDENCE!' },
  },
  {
    id: 'communism',
    icon: '☭',
    name: 'Communism Mode',
    tagline: 'From each according to their clicks, to the Party according to its needs.',
    ruleText: [
      'Only click upgrades: every business is collectivized',
      'Half your clicks are requisitioned for the Five-Year Plan',
      'Everything costs 10× as much',
      'The Party audits you about once a minute, from day one',
    ],
    rules: { clickOnly: true, clickFailChance: 0.5, priceMultiplier: 10, raidChanceMultiplier: 5 / 3, raidsFromStart: true },
    goal: 1e6,
    speedrunSec: 3600,
    reward: 'Clicks are worth 25% more',
    achievement: 'challenge-communism',
    speedrunAchievement: 'speedrun-communism',
    raid: { title: '🚨 PARTY AUDIT! 🚨', text: 'The commissar wants to inspect your ration book!', button: 'HIDE THE BREAD!' },
  },
  {
    id: 'hyperinflation',
    icon: '💸',
    name: 'Hyperinflation Mode',
    tagline: 'The central bank has discovered the print button.',
    ruleText: ['Your cash loses 0.1% of its value every second', 'All prices double every 10 minutes', "Spend it before it's worthless"],
    rules: { cashDecayPerSec: 0.001, inflationPerMinute: Math.pow(2, 1 / 10) - 1 },
    goal: 1.5e7,
    speedrunSec: 3600,
    reward: 'The Unclaimed Bitcoin Wallet pays 50% more',
    achievement: 'challenge-hyperinflation',
    speedrunAchievement: 'speedrun-hyperinflation',
    raid: { title: '🚨 PRICE CONTROLS! 🚨', text: 'The Ministry of Prices wants to know why yours went up.', button: 'HIDE THE RECEIPTS!' },
  },
];

/** Permanent perks for winning challenges (normal play only). */
export const CHALLENGE_REWARDS = {
  minarchistRaidChance: 0.9,
  statusQuoPrices: 0.95,
  communismClicks: 1.25,
  hyperinflationWallet: 1.5,
} as const;

// ---------------------------------------------------------------------------
// Golden sticker rewards
// ---------------------------------------------------------------------------

export interface GoldenEffect {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Relative odds of being picked. */
  weight: number;
  /** Timed boosts: multipliers and duration. Instant rewards have duration 0. */
  clickMultiplier: number;
  incomeMultiplier: number;
  durationSec: number;
  /** Fed raids can't happen while this is active. */
  noRaids?: boolean;
  /** Gives an instant cash payout (see BALANCE.golden). */
  cash?: boolean;
  /** Scales the cash payout (Fiat Coal pays almost nothing). */
  cashMultiplier?: number;
}

export const GOLDEN_EFFECTS: readonly GoldenEffect[] = [
  { id: 'chainsaw', icon: '🪚', name: "Milei's Chainsaw", description: 'Clicks are worth ×7 for 30 seconds. ¡AFUERA!', weight: 3, clickMultiplier: 7, incomeMultiplier: 1, durationSec: 30 },
  { id: 'bull-run', icon: '🐂', name: 'Bull Run', description: 'Income ×3 for 60 seconds. Number go up.', weight: 3, clickMultiplier: 1, incomeMultiplier: 3, durationSec: 60 },
  { id: 'wallet', icon: '🔑', name: 'Unclaimed Bitcoin Wallet', description: 'You remembered the seed phrase. Instant cash.', weight: 3, clickMultiplier: 1, incomeMultiplier: 1, durationSec: 0, cash: true },
  { id: 'tax-holiday', icon: '🏖️', name: 'Tax Holiday', description: 'Everything ×2 and no Fed raids for 45 seconds.', weight: 1, clickMultiplier: 2, incomeMultiplier: 2, durationSec: 45, noRaids: true },
];

/** What's inside a Christmas present (they replace golden stickers during the event). */
export const PRESENT_EFFECTS: readonly GoldenEffect[] = [
  { id: 'elf-workshop', icon: '🧝', name: 'Unlicensed Elf Workshop', description: 'Income ×3 for 60 seconds. No union, no OSHA, all cheer.', weight: 3, clickMultiplier: 1, incomeMultiplier: 3, durationSec: 60 },
  { id: 'sleigh-ride', icon: '🛷', name: 'Unregistered Sleigh Ride', description: 'Clicks are worth ×7 for 30 seconds. The FAA can try to catch it.', weight: 3, clickMultiplier: 7, incomeMultiplier: 1, durationSec: 30 },
  { id: 'krugerrands', icon: '🧦', name: 'Stocking Stuffed with Krugerrands', description: 'Sound money, straight from the chimney.', weight: 3, clickMultiplier: 1, incomeMultiplier: 1, durationSec: 0, cash: true, cashMultiplier: 1.5 },
  { id: 'fiat-coal', icon: '🪨', name: 'Fiat Coal', description: 'You were naughty: you voted. Worth almost nothing, just like the dollar.', weight: 1, clickMultiplier: 1, incomeMultiplier: 1, durationSec: 0, cash: true, cashMultiplier: 0.02 },
];

/** Every golden reward, so boosts can be looked up whatever handed them out. */
export const ALL_GOLDEN_EFFECTS: readonly GoldenEffect[] = [...GOLDEN_EFFECTS, ...PRESENT_EFFECTS];

// ---------------------------------------------------------------------------
// Seasonal events
// ---------------------------------------------------------------------------

export type EventId = 'christmas' | 'fed-birthday';

export interface GameEvent {
  id: EventId;
  icon: string;
  name: string;
  /** First and last day, as [month, day] (1-based). An end before the start wraps into January. */
  start: readonly [number, number];
  end: readonly [number, number];
  /** Shown once per season, the first time the game is opened during the event. */
  popup: {
    /** Path under vidya/, or undefined for a text-only popup. */
    image?: string;
    imageAlt?: string;
    title: string;
    message: string;
    /** When it runs, in words. */
    when: string;
    features: readonly string[];
  };
}

export const EVENTS: readonly GameEvent[] = [
  {
    id: 'christmas',
    icon: '🎄',
    name: 'Christmas in Ancapistan',
    start: [12, 20],
    end: [1, 1],
    popup: {
      image: 'img/murray-christmas-and-a-hoppe-new-year.webp',
      imageAlt: 'Murray Rothbard and Hans-Hermann Hoppe in Santa hats: Murray Christmas and a Hoppe New Year',
      title: '🎄 Christmas in Ancapistan',
      message: 'We wish all lolbertarians a Murray Christmas and a Hoppe New Year!',
      when: 'From December 20 to January 1:',
      features: [
        '🎁 Presents replace golden stickers. They show up more often and hold festive rewards (and maybe some fiat coal).',
        '🎄 A Christmas tab in the sticker shop: limited-edition stickers you keep forever, even after seceding.',
        '🎂 December 23 is the Fed\'s birthday: raids double, but every raid you dodge swipes a slice of the cake.',
        '❄️ Snow, a Santa hat, festive headlines and five seasonal achievements.',
      ],
    },
  },
  {
    id: 'fed-birthday',
    icon: '🎂',
    name: "The Fed's Birthday",
    start: [12, 23],
    end: [12, 23],
    popup: {
      image: 'img/fed-birthday.webp',
      imageAlt: 'The Federal Reserve building wearing a party hat, with the ghost of Woodrow Wilson in the sky',
      title: "🎂 Happy Birthday, Federal Reserve!",
      message: 'On December 23, 1913, Woodrow Wilson signed the Federal Reserve Act. The Fed is throwing itself a party.',
      when: 'All day today:',
      features: ['🚨 Fed raids happen twice as often.', '🍰 Every raid you dodge swipes a slice of the birthday cake: a minute of your income.'],
    },
  },
];

/** Christmas tuning. */
export const CHRISTMAS = {
  /** Presents show up this much sooner than golden stickers. */
  presentDelay: 0.6,
  /** A Christmas sticker costs this many seconds of your income (at least `minStickerCost`). */
  stickerIncomeSeconds: 600,
  minStickerCost: 10_000,
  /** On the Fed's birthday: raid odds multiplier, and seconds of income a dodged raid pays. */
  fedBirthdayRaids: 2,
  fedBirthdayCakeSeconds: 60,
} as const;

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

export interface Upgrade {
  id: number;
  name: string;
  /** Emoji or an HTML snippet (e.g. an <img>). */
  icon: string;
  baseCost: number;
  income: number;
  clickBonus: number;
  type: 'click' | 'passive';
  lore: string;
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 1, name: 'Buy theory book', icon: '📙', baseCost: 15, income: 0, clickBonus: 1, type: 'click', lore: 'It all starts with an idea. Read the sacred texts.' },
  { id: 2, name: 'Unlicensed lemonade stand', icon: '🍋', baseCost: 25, income: 1, clickBonus: 0, type: 'passive', lore: 'Where 6-year-olds learn the state is the enemy.' },
  { id: 3, name: 'Buy AK-47', icon: "<img src='img/ak47.webp'>", baseCost: 800, income: 0, clickBonus: 5, type: 'click', lore: 'An armed society is a polite society. And a profitable one.' },
  { id: 4, name: 'Raw milk smuggling ring', icon: '🥛', baseCost: 2000, income: 10, clickBonus: 0, type: 'passive', lore: "The FDA can't stop the signal. Or the delicious, unpasteurized profits." },
  { id: 5, name: 'Homestead empty land', icon: '🏡', baseCost: 5000, income: 0, clickBonus: 10, type: 'click', lore: "If you mix your labor with it, it's yours. John Locke said so." },
  { id: 6, name: 'Overseas crypto farm', icon: '🪙', baseCost: 10000, income: 25, clickBonus: 0, type: 'passive', lore: 'Somewhere off in South East Asia. Untraceable, unseizable, and unstoppable. The perfect asset for a free individual.' },
  { id: 7, name: 'Invoke the invisible hand', icon: '🖐️', baseCost: 50000, income: 0, clickBonus: 50, type: 'click', lore: "Adam Smith's ghost now guides your clicking finger towards maximum efficiency." },
  { id: 8, name: 'Privatize roads', icon: '🚧', baseCost: 200000, income: 100, clickBonus: 0, type: 'passive', lore: "Who will build the roads? You will. And you'll charge a toll." },
  { id: 9, name: 'Hire PMC', icon: '🪖', baseCost: 500000, income: 0, clickBonus: 100, type: 'click', lore: 'Make your life easier and enforce the NAP through a Private Military Contractor.' },
  { id: 10, name: 'Seasteading platform', icon: '🌊', baseCost: 1000000, income: 500, clickBonus: 0, type: 'passive', lore: 'Escape the clutches of terrestrial governments by building your own nation on the high seas.' },
  { id: 11, name: 'Recreational McNuke silo', icon: '☢️', baseCost: 10000000, income: 0, clickBonus: 500, type: 'click', lore: 'For defending your property against particularly aggressive trespassers. Or just for fun.' },
  { id: 12, name: 'Homestead the moon', icon: '🌑', baseCost: 75000000, income: 1000, clickBonus: 0, type: 'passive', lore: 'One small step for man, one giant leap for private property.' },
  { id: 13, name: 'Interplanetary drug smuggling', icon: '💊', baseCost: 250000000, income: 0, clickBonus: 1000, type: 'click', lore: "The war on drugs doesn't apply in zero gravity." },
  { id: 14, name: 'Privatize solar system', icon: '🌌', baseCost: 1000000000, income: 10000, clickBonus: 0, type: 'passive', lore: "Why stop at one planet? It's all un-homesteaded real estate." },
  // Late game
  { id: 15, name: 'NAP-enforcement orbital railgun', icon: '🛰️', baseCost: 5_000_000_000, income: 0, clickBonus: 10_000, type: 'click', lore: 'Aggression detected. Response delivered from low Earth orbit. No bureaucracy involved.' },
  { id: 16, name: 'Asteroid mining guild', icon: '☄️', baseCost: 25_000_000_000, income: 250_000, clickBonus: 0, type: 'passive', lore: 'Platinum by the megaton. Wait, if gold gets this abundant, what happens to sound money? Keep mining, think later.' },
  { id: 17, name: 'Physical removal service', icon: '🚪', baseCost: 100_000_000_000, income: 0, clickBonus: 100_000, type: 'click', lore: 'Covenant communities need bouncers. Hoppe already wrote the job description.' },
  { id: 18, name: 'Dyson sphere toll booth', icon: '☀️', baseCost: 500_000_000_000, income: 4_000_000, clickBonus: 0, type: 'passive', lore: 'You did privatize the sun after all. Photons are now pay-per-view.' },
  { id: 19, name: 'Lower your time preference', icon: '⏳', baseCost: 2_500_000_000_000, income: 0, clickBonus: 1_000_000, type: 'click', lore: "Your time preference is so low you're clicking for your great-great-grandchildren's retirement." },
  { id: 20, name: 'Interstellar free trade zone', icon: '🚀', baseCost: 10_000_000_000_000, income: 60_000_000, clickBonus: 0, type: 'passive', lore: 'No tariffs for light-years in every direction. Customs officers have to bring their own oxygen.' },
  { id: 21, name: 'Multiverse arbitrage', icon: '🔀', baseCost: 50_000_000_000_000, income: 0, clickBonus: 10_000_000, type: 'click', lore: 'Buy low in a universe with central banks, sell high in one without.' },
  { id: 22, name: 'Homestead the Andromeda galaxy', icon: '🌀', baseCost: 200_000_000_000_000, income: 1_000_000_000, clickBonus: 0, type: 'passive', lore: '2.5 million light-years from the nearest tax office. Mix your labor with a trillion stars.' },
];

// ---------------------------------------------------------------------------
// Special upgrades (perks)
// ---------------------------------------------------------------------------

export type PerkEffect = 'crit' | 'click_multiplier' | 'passive_multiplier' | 'income_to_click' | 'raid_evasion';

export interface Perk {
  id: string;
  name: string;
  icon: string;
  cost: number;
  effect: PerkEffect;
  value: number;
  description: string;
  lore: string;
}

export const PERKS: readonly Perk[] = [
  { id: 'su1', name: 'Austrian Knowledge', icon: '🧠', cost: 250000, effect: 'crit', value: 0.05, description: '5% chance for a Critical Click (x5 value)!', lore: 'You understand that value is subjective, but crits are objectively awesome.' },
  { id: 'su2', name: 'Golden Standard', icon: '🪙', cost: 1000000, effect: 'click_multiplier', value: 2, description: 'Doubles the value of each click!', lore: 'Return to sound money. Every dollar you make is now backed by pure, unadulterated value.' },
  { id: 'su3', name: 'Praxeology', icon: '📈', cost: 5000000, effect: 'crit', value: 0.1, description: 'Increases Critical Click chance by 10%!', lore: 'The study of human action leads you to one conclusion: act to get more critical clicks.' },
  { id: 'su4', name: 'Capital Accumulation', icon: '🏭', cost: 15000000, effect: 'passive_multiplier', value: 1.5, description: 'Increases all passive income by 50%!', lore: "Your capital is no longer just working, it's putting in overtime. The compounding returns of liberty." },
  { id: 'su5', name: 'Agorism', icon: '🏴', cost: 50000000, effect: 'income_to_click', value: 0.01, description: 'Adds 1% of your income-per-second to your click value.', lore: 'Engage in counter-economics. Every part of your enterprise now fuels your direct action.' },
  { id: 'su6', name: 'Shell Companies', icon: '🏢', cost: 100000000, effect: 'raid_evasion', value: 0.5, description: 'Gain a 50% chance to automatically evade Fed raids.', lore: 'A labyrinth of paperwork and legal entities makes you a ghost to the State.' },
];

export const CLICK_PHRASES = ['Freedom!', 'My Property!', 'Based', 'No Step!'] as const;

// ---------------------------------------------------------------------------
// Stickers (the draggable background collage)
// ---------------------------------------------------------------------------

export type StickerCategory = 'quote' | 'emoji' | 'html' | 'person' | 'organization' | 'item' | 'christmas';

export interface StickerData {
  /** Stable id used in saves (the content itself). */
  id: string;
  type: 'text' | 'emoji' | 'html' | 'image';
  category: StickerCategory;
  content: string;
  /** Limited edition: only for sale during this event, and kept through secession. */
  season?: EventId;
  /** On-screen width in px for image stickers (default 60). */
  width?: number;
}

/** Sticker shop tabs, in order. */
export const STICKER_CATEGORIES: readonly { id: StickerCategory; label: string }[] = [
  { id: 'quote', label: '💬 Quotes' },
  { id: 'emoji', label: '🐍 Emojis' },
  { id: 'html', label: '🏴 Flags' },
  { id: 'person', label: '🧔 People' },
  { id: 'organization', label: '🏛️ Orgs' },
  { id: 'item', label: '🔫 Items' },
  { id: 'christmas', label: '🎄 Christmas' },
];

const quote = (content: string): StickerData => ({ id: content, type: 'text', category: 'quote', content });
const emoji = (content: string): StickerData => ({ id: content, type: 'emoji', category: 'emoji', content });
const html = (id: string, content: string): StickerData => ({ id, type: 'html', category: 'html', content });
const image = (category: StickerCategory, name: string): StickerData => ({ id: name, type: 'image', category, content: `img/${name}.webp` });
const christmasImage = (name: string, width = 75): StickerData => ({ ...image('christmas', name), season: 'christmas', width });
const christmasQuote = (content: string): StickerData => ({ ...quote(content), category: 'christmas', season: 'christmas' });

export const STICKERS: readonly StickerData[] = [
  // Quotes
  quote('Taxation is theft!'),
  quote('End! The! Fed!'),
  quote('Free Market Enjoyer'),
  quote('RESPECT THE NAP!'),
  quote('Neo-Feudalist Bootlicker'),
  quote('Agorism Now!'),
  quote('Buy crypto!'),
  quote('Commies want to take my stuff!'),
  quote('Return to sound money!'),
  quote('No free lunch!!!'),
  quote('DO NOT TREAD'),
  quote('Live and let live'),
  quote('I love my M249 and my weed farm'),
  quote('End the drug war!'),
  quote('I would privatize the sun'),
  quote('Rothbard my beloved ❤️'),
  quote('FUERA!'),
  quote('¡VIVA LA LIBERTAD CARAJO!'),
  quote('🇿🇿'),
  quote('Ancapistan in my head'),
  quote('So to speak'),
  quote('Abolish IP'),
  quote('ACAB'),
  quote('1000 🇱🇮'),
  quote('Support piracy!'),
  quote('Tu ne cede malis sed contra audentior ito'),
  quote('The best government is no government at all'),
  quote('Why not try freedom?'),
  // Emotes
  emoji('🐍'), // Gadsden
  emoji('💉'),
  emoji('📉'),
  emoji('📈'),
  emoji('🚁'), // Pinochet helicopter
  emoji('💰'), // Money bag
  emoji('🦔'), // Libertarian Porcupine
  emoji('🪙'), // Sound money/gold
  emoji('🇱🇮'),
  emoji('☢️'),
  emoji('🏴‍☠️'),
  emoji('🗽'),
  emoji('💊'),
  // HTML
  html('flag-ancap', '<div class="flag-ancap"></div>'),
  html('flag-eu-cross', '<div class="flag-eu-cross">🇪🇺</div>'),
  // People
  ...[
    'rothbard', 'hoppe', 'mises', 'kinsella', 'tucker', 'hayek', 'ronpaul', 'menger', 'bohmbawerk',
    'hazlitt', 'murphy', 'kirzner', 'gordon', 'lewrockwell', 'caplan', 'salerno', 'woods', 'block',
    'bylund', 'nock', 'hansen', 'dfriedman', 'deist', 'hulsmann', 'ammous', 'dilorenzo', 'bagus',
    'jhs', 'milei',
  ].map((name) => image('person', name)),
  // Organizations
  image('organization', 'misesinstitute'),
  image('organization', 'liberland'),
  // Items
  image('item', 'pistol'),
  image('item', 'm249'),
  image('item', 'ak47'),
  // Christmas (limited edition)
  christmasImage('ancap-santa'),
  christmasImage('ancap-reindeer'),
  christmasImage('ancap-gift', 70),
  christmasImage('ancap-rpg7', 120),
  christmasImage('ancap-tree'),
  christmasImage('ancap-gingerbread'),
  christmasQuote('Santa is a central planner'),
  christmasQuote('Naughty list: tax collectors'),
  christmasQuote('Ho Ho Homestead!'),
];

/**
 * Names for every sticker that isn't a quote, so newcomers know what they're
 * looking at: `name` is shown under the sticker in the shop (and as a tooltip),
 * `note` is a short "known for" line.
 */
export const STICKER_LABELS: Readonly<Record<string, { name: string; note?: string }>> = {
  // Emojis
  '🐍': { name: 'Snek', note: "Don't Tread on Me" },
  '💉': { name: 'Probably Ketamine' },
  '📉': { name: 'Not stonks' },
  '📈': { name: 'Stonks' },
  '🚁': { name: 'Physical removal' },
  '💰': { name: 'Money bag' },
  '🦔': { name: 'Porcupine' },
  '🪙': { name: 'Gold standard' },
  '🇱🇮': { name: 'Flag of Liechtenstein' },
  '☢️': { name: 'McNuke' },
  '🏴‍☠️': { name: 'Anti-IP' },
  '🗽': { name: 'Statue of Liberty' },
  '💊': { name: 'Banned Meds' },
  // Flags
  'flag-ancap': { name: 'Anarcho-capitalist flag' },
  'flag-eu-cross': { name: 'EU flag, crossed out' },
  // People
  rothbard: { name: 'Murray Rothbard', note: '"Mr. Libertarian"' },
  hoppe: { name: 'Hans-Hermann Hoppe', note: 'Democracy: The God That Failed' },
  mises: { name: 'Ludwig von Mises', note: 'Human Action' },
  kinsella: { name: 'Stephan Kinsella', note: 'Against Intellectual Property' },
  tucker: { name: 'Jeffrey Tucker', note: 'Libertarian writer and publisher' },
  hayek: { name: 'F. A. Hayek', note: 'The Road to Serfdom' },
  ronpaul: { name: 'Ron Paul', note: 'End the Fed' },
  menger: { name: 'Carl Menger', note: 'Founder of the Austrian School' },
  bohmbawerk: { name: 'Eugen von Böhm-Bawerk', note: 'Capital and Interest' },
  hazlitt: { name: 'Henry Hazlitt', note: 'Economics in One Lesson' },
  murphy: { name: 'Robert P. Murphy', note: 'Austrian economist' },
  kirzner: { name: 'Israel Kirzner', note: 'Competition and Entrepreneurship' },
  gordon: { name: 'David Gordon', note: 'Mises Institute scholar' },
  lewrockwell: { name: 'Lew Rockwell', note: 'Founder of the Mises Institute' },
  caplan: { name: 'Bryan Caplan', note: 'The Myth of the Rational Voter' },
  salerno: { name: 'Joseph Salerno', note: 'Austrian economist' },
  woods: { name: 'Tom Woods', note: 'The Tom Woods Show' },
  block: { name: 'Walter Block', note: 'Defending the Undefendable' },
  bylund: { name: 'Per Bylund', note: 'Economist of entrepreneurship' },
  nock: { name: 'Albert Jay Nock', note: 'Our Enemy, the State' },
  hansen: { name: 'Kristoffer Mousten Hansen', note: 'Austrian economist' },
  dfriedman: { name: 'David D. Friedman', note: 'The Machinery of Freedom' },
  deist: { name: 'Jeff Deist', note: 'Former Mises Institute president' },
  hulsmann: { name: 'Jörg Guido Hülsmann', note: 'Mises: The Last Knight of Liberalism' },
  ammous: { name: 'Saifedean Ammous', note: 'The Bitcoin Standard' },
  dilorenzo: { name: 'Thomas DiLorenzo', note: 'The Real Lincoln' },
  bagus: { name: 'Philipp Bagus', note: 'The Tragedy of the Euro' },
  jhs: { name: 'Jesús Huerta de Soto', note: 'Money, Bank Credit, and Economic Cycles' },
  milei: { name: 'Javier Milei', note: 'President of Argentina' },
  // Organizations
  misesinstitute: { name: 'Mises Institute' },
  liberland: { name: 'Flag of Liberland', note: 'A micronation on the Danube' },
  // Items
  pistol: { name: 'Pistol' },
  m249: { name: 'M249 machine gun' },
  ak47: { name: 'AK-47' },
  // Christmas
  'ancap-santa': { name: 'Ancap Santa' },
  'ancap-reindeer': { name: 'Ancap Reindeer' },
  'ancap-gift': { name: 'Ancap Gift' },
  'ancap-rpg7': { name: 'RPG-7 Gift' },
  'ancap-tree': { name: 'Ancap Christmas Tree' },
  'ancap-gingerbread': { name: 'Ancap Gingerbread Man' },
};

/** Stickers on sale all year (everything but limited editions). */
export const REGULAR_STICKERS: readonly StickerData[] = STICKERS.filter((s) => !s.season);

/** Completing every sticker in a category grants its set bonus. */
export interface StickerSet {
  category: StickerCategory;
  icon: string;
  name: string;
  description: string;
  clickMultiplier?: number;
  incomeMultiplier?: number;
  /** Added to crit chance. */
  critChance?: number;
  /** Multiplies the wait between golden stickers. */
  goldenDelay?: number;
  /** Multiplies the odds of a raid. */
  raidChance?: number;
}

export const STICKER_SETS: readonly StickerSet[] = [
  { category: 'quote', icon: '💬', name: "Pamphleteer's Library", description: 'Clicks are worth ×1.25.', clickMultiplier: 1.25 },
  { category: 'emoji', icon: '🐍', name: 'Emoji Mosaic', description: 'Golden stickers show up 15% sooner.', goldenDelay: 0.85 },
  { category: 'html', icon: '🏴', name: 'Flag Collection', description: 'Income ×1.05.', incomeMultiplier: 1.05 },
  { category: 'person', icon: '🧔', name: 'Austrian Pantheon', description: 'Income ×1.25.', incomeMultiplier: 1.25 },
  { category: 'organization', icon: '🏛️', name: 'Think Tank Network', description: 'Fed raids happen 25% less often.', raidChance: 0.75 },
  { category: 'item', icon: '🔫', name: 'Private Armory', description: '+5% Critical Click chance.', critChance: 0.05 },
  { category: 'christmas', icon: '🎄', name: 'Christmas Spirit', description: 'Income ×1.1, all year round.', incomeMultiplier: 1.1 },
];


// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/** What achievements can look at. Filled in by logic.ts. */
export interface AchievementContext {
  allTimeEarnings: number;
  incomePerSec: number;
  owned: (upgradeId: number) => number;
  ownsEveryUpgrade: boolean;
  perksOwned: number;
  cities: number;
  /** Stickers owned (starter ones included). */
  stickersOwned: number;
  chartersOwned: number;
  /** True when every sticker of that category is owned. */
  stickerCategoryComplete: (category: StickerCategory) => boolean;
  stickerSetsComplete: number;
  ownsSticker: (id: string) => boolean;
  /** The challenge being played, if any. */
  challenge: ChallengeId | null;
  challengesCompleted: number;
  stats: {
    clicks: number;
    crits: number;
    raidsEvaded: number;
    raidsAutoEvaded: number;
    secessions: number;
    reshuffles: number;
    stickersDragged: number;
    offlineCollected: number;
    goldenClicks: number;
    playSeconds: number;
    presentsOpened: number;
  };
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  /**
   * Unlocks automatically once this returns true. Achievements without it are
   * granted by the game when something happens (see SECRET_ACHIEVEMENTS).
   */
  check?: (c: AchievementContext) => boolean;
  /** Optional link shown once unlocked. */
  reward?: { label: string; href: string };
  /** Hidden as "???" until unlocked; `hint` is shown instead of the description. */
  secret?: boolean;
  hint?: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-click', icon: '🐍', name: 'Homesteader', description: 'Mix your labor with the snake. Click once.', check: (c) => c.stats.clicks >= 1 },
  { id: 'clicks-1k', icon: '🖱️', name: 'Carpal Tunnel Capitalist', description: 'Click 1,000 times. Voluntarily.', check: (c) => c.stats.clicks >= 1000 },
  { id: 'clicks-10k', icon: '🦾', name: 'Invisible Hand Cramp', description: 'Click 10,000 times. Nobody forced you.', check: (c) => c.stats.clicks >= 10000 },
  { id: 'earn-1k', icon: '💵', name: 'Petite Bourgeoisie', description: 'Earn $1,000 in total.', check: (c) => c.allTimeEarnings >= 1e3 },
  { id: 'earn-1m', icon: '💰', name: 'Millionaire (Pre-Inflation)', description: 'Earn $1,000,000 in total. Before the Fed makes it worthless.', check: (c) => c.allTimeEarnings >= 1e6 },
  { id: 'earn-1b', icon: '🎩', name: 'Robber Baron (Complimentary)', description: 'Earn $1 billion in total. Every dollar voluntarily exchanged.', check: (c) => c.allTimeEarnings >= 1e9 },
  { id: 'earn-1t', icon: '🏦', name: 'Too Big to Bail Out', description: 'Earn $1 trillion in total. No bailouts were requested.', check: (c) => c.allTimeEarnings >= 1e12 },
  { id: 'income-100', icon: '📈', name: 'Passive Aggressive', description: 'Make $100/sec without lifting a finger.', check: (c) => c.incomePerSec >= 100 },
  { id: 'income-10k', icon: '🛥️', name: 'Rentier Class', description: 'Make $10,000/sec. Your money works harder than you.', check: (c) => c.incomePerSec >= 10000 },
  { id: 'lemonade-10', icon: '🍋', name: 'Lemonade Cartel', description: 'Own 10 unlicensed lemonade stands. The health inspector weeps.', check: (c) => c.owned(2) >= 10 },
  { id: 'ak-10', icon: '🔫', name: 'Very Polite Society', description: 'Own 10 AK-47s.', check: (c) => c.owned(3) >= 10 },
  { id: 'roads', icon: '🚧', name: 'Who Will Build the Roads?', description: 'Privatize the roads. You. You will.', check: (c) => c.owned(8) >= 1 },
  { id: 'moon', icon: '🌑', name: 'Lunar Lockean', description: 'Homestead the moon.', check: (c) => c.owned(12) >= 1 },
  { id: 'solar', icon: '🌌', name: 'Galactic Landlord', description: 'Privatize the solar system. Rent is due.', check: (c) => c.owned(14) >= 1 },
  { id: 'dyson', icon: '☀️', name: 'I Would Privatize the Sun', description: 'Build a Dyson sphere toll booth. You said you would.', check: (c) => c.owned(18) >= 1 },
  { id: 'andromeda', icon: '🌀', name: 'Intergalactic Landlord', description: 'Homestead the Andromeda galaxy. The rent is astronomical.', check: (c) => c.owned(22) >= 1 },
  { id: 'every-upgrade', icon: '🧺', name: 'Diversified Portfolio', description: 'Own at least one of every upgrade.', check: (c) => c.ownsEveryUpgrade },
  { id: 'all-perks', icon: '🎓', name: 'Mises Institute Alumnus', description: 'Buy every special upgrade.', check: (c) => c.perksOwned >= PERKS.length },
  { id: 'first-crit', icon: '💥', name: 'Subjective Value, Objective Damage', description: 'Land a Critical Click.', check: (c) => c.stats.crits >= 1 },
  { id: 'evade-1', icon: '🚔', name: 'Tax Evader', description: 'Hide your assets from a Fed raid.', check: (c) => c.stats.raidsEvaded >= 1 },
  { id: 'evade-10', icon: '🥷', name: 'Serial Evader', description: 'Evade 10 Fed raids.', check: (c) => c.stats.raidsEvaded >= 10 },
  { id: 'auto-evade', icon: '🏢', name: 'Ghost to the State', description: 'Have your shell companies dodge a raid for you.', check: (c) => c.stats.raidsAutoEvaded >= 1 },
  { id: 'secede-1', icon: '🏴', name: 'Exit, Pursued by a Fed', description: 'Secede and found your first Free Private City.', check: (c) => c.stats.secessions >= 1 },
  {
    id: 'just-getting-started',
    icon: '😈',
    name: "NAH, WE'RE JUST GETTING STARTED",
    description: 'Secede 3 times. Late stage capitalism? Not even close.',
    check: (c) => c.stats.secessions >= 3,
    reward: { label: 'Play JUST GETTING STARTED 😈', href: 'just-getting-started.html' },
  },
  { id: 'cities-10', icon: '🏙️', name: 'Network State', description: 'Own 10 Free Private Cities.', check: (c) => c.cities >= 10 },
  { id: 'reshuffle-10', icon: '🎨', name: 'Collage Artist', description: 'Reshuffle the stickers 10 times.', check: (c) => c.stats.reshuffles >= 10 },
  { id: 'drag-25', icon: '🪑', name: 'Spontaneous Order', description: 'Drag 25 stickers around. Nobody planned this.', check: (c) => c.stats.stickersDragged >= 25 },
  { id: 'sticker-first', icon: '🏷️', name: 'Brand Ambassador', description: 'Buy your first sticker. Laptop lids everywhere tremble.', check: (c) => c.stickersOwned > 0 },
  { id: 'sticker-people', icon: '🧔', name: 'Hall of Fame', description: 'Own every People sticker. The Mises Institute group chat, complete.', check: (c) => c.stickerCategoryComplete('person') },
  { id: 'sticker-sets-3', icon: '🗂️', name: 'Completionist Tendencies', description: 'Complete 3 sticker sets in one run.', check: (c) => c.stickerSetsComplete >= 3 },
  { id: 'sticker-all', icon: '🖼️', name: 'Laptop Lid Complete', description: 'Own every sticker. There is no free space left. Homestead elsewhere.', check: (c) => REGULAR_STICKERS.every((s) => c.ownsSticker(s.id)) },
  { id: 'charter-1', icon: '📜', name: 'We the Sovereign Individual', description: 'Sign your first charter.', check: (c) => c.chartersOwned >= 1 },
  { id: 'charter-all', icon: '🗽', name: 'Constitution? I Hardly Know Her', description: 'Sign every charter.', check: (c) => c.chartersOwned >= CHARTERS.length },
  { id: 'golden-1', icon: '🌟', name: 'Gold Bug', description: 'Catch a golden sticker. Told you gold was the real money.', check: (c) => c.stats.goldenClicks >= 1 },
  { id: 'golden-25', icon: '🥇', name: 'Hard Money Maniac', description: 'Catch 25 golden stickers.', check: (c) => c.stats.goldenClicks >= 25 },
  { id: 'playtime-10h', icon: '⏰', name: 'Wage Slave to Yourself', description: 'Play for 10 hours. At least the boss is you.', check: (c) => c.stats.playSeconds >= 36_000 },
  { id: 'offline', icon: '😴', name: 'Passive Income Guru', description: 'Come back to money your enterprises made while you were away.', check: (c) => c.stats.offlineCollected >= 1 },

  // Christmas event
  { id: 'murray-christmas', icon: '🎄', name: 'A Murray Christmas', description: 'Play during the Christmas event (December 20 to January 1).' },
  { id: 'krampus', icon: '🎁', name: 'Krampus Was a Tax Collector', description: 'Open 10 Christmas presents.', check: (c) => c.stats.presentsOpened >= 10 },
  { id: 'christmas-spirit', icon: '🦌', name: 'Ho Ho Homestead', description: 'Collect every Christmas sticker.', check: (c) => c.stickerCategoryComplete('christmas') },
  { id: 'party-pooper', icon: '🎂', name: 'Party Pooper', description: "Dodge a Fed raid on the Fed's birthday (December 23)." },
  { id: 'hoppe-new-year', icon: '🥂', name: 'A Hoppe New Year', description: 'Play on January 1.' },

  // Challenge runs: winning and speedrun achievements are granted when you win.
  { id: 'challenge-minarchist', icon: '⚖️', name: 'Night Watchman', description: 'Win Minarchist Mode.' },
  { id: 'speedrun-minarchist', icon: '⏱️', name: 'Limited Government, Unlimited Hustle', description: 'Win Minarchist Mode in under an hour.' },
  { id: 'challenge-status-quo', icon: '🏛️', name: 'Regulatory Capture', description: 'Win Status Quo Mode.' },
  { id: 'speedrun-status-quo', icon: '📎', name: 'Red Tape Speedrun', description: 'Win Status Quo Mode in under an hour.' },
  { id: 'permit-office', icon: '🗃️', name: 'Survived the Permit Office', description: 'Win Status Quo Mode after 10 or more of your businesses failed.' },
  { id: 'challenge-communism', icon: '🧱', name: 'Escape to the West', description: 'Win Communism Mode.' },
  { id: 'speedrun-communism', icon: '⚒️', name: 'Five-Year Plan, Fulfilled Early', description: 'Win Communism Mode in under an hour.' },
  { id: 'socialist-labor', icon: '🎖️', name: 'Hero of Socialist Labor', description: 'Click 10,000 times in a single Communism run.', check: (c) => c.challenge === 'communism' && c.stats.clicks >= 10_000 },
  { id: 'challenge-hyperinflation', icon: '🛒', name: 'Wheelbarrow Economics', description: 'Win Hyperinflation Mode.' },
  { id: 'speedrun-hyperinflation', icon: '🔥', name: 'Spend It Before It Melts', description: 'Win Hyperinflation Mode in under an hour.' },
  { id: 'all-challenges', icon: '🌍', name: 'Tried Every System', description: 'Win every challenge. Turns out the market was right.', check: (c) => c.challengesCompleted >= 4 },

  // Secret achievements: granted by main.ts when the player does something specific.
  ...([
    { id: 'civil-disobedience', icon: '🪧', name: 'Civil Disobedience', description: 'Left a Fed raid on screen for a whole minute. Thoreau would be proud.', hint: 'Sometimes the best response to the State is no response at all.' },
    { id: 'student-and-teacher', icon: '🎓', name: 'Student and Teacher', description: 'Dragged Rothbard onto Mises. The seminar is back in session.', hint: 'Put the student next to the teacher.' },
    { id: 'afuera', icon: '🪚', name: '¡AFUERA!', description: "Caught Milei's Chainsaw with Milei himself on screen.", hint: 'A certain Argentine, and a certain power tool.' },
    { id: 'brussels-effect', icon: '🇪🇺', name: 'Brussels Effect', description: 'Made the crossed-out EU flag your very first sticker.', hint: 'Be the first to leave the Union.' },
    { id: 'insomniac', icon: '🦉', name: 'Insomniac Agorist', description: 'Played between 3 and 4 a.m. The market never sleeps.', hint: 'The counter-economy keeps odd hours.' },
    { id: 'tax-day', icon: '🧾', name: 'Tax Day', description: 'Played on April 15. Hide your assets.', hint: 'A date every American taxpayer dreads.' },
    { id: 'white-paper', icon: '📜', name: 'Peer-to-Peer Electronic Cash', description: 'Played on October 31, the day the Bitcoin white paper came out in 2008.', hint: 'A spooky day for central bankers.' },
    { id: 'fine-print', icon: '📰', name: 'Read the Fine Print', description: 'Clicked the news ticker. Journalism is dead; long live clicking.', hint: 'Read all about it.' },
    { id: 'make-up-your-mind', icon: '🔇', name: 'Make Up Your Mind', description: 'Toggled the sound 10 times in a row.', hint: 'On, off, on, off…' },
    { id: 'say-it', icon: '⌨️', name: 'Say It With Me', description: 'Typed "taxation is theft". Correct.', hint: 'Type the first commandment.' },
    { id: 'exit-liquidity', icon: '🫗', name: 'Exit Liquidity', description: 'Seceded with less than $1 in your pocket.', hint: 'Leave with nothing but your principles.' },
    { id: 'zero-time-preference', icon: '🧘', name: 'Time Preference: Zero', description: "Didn't click the snake for 10 minutes while making $1M/sec.", hint: 'Patience. A lot of it. While rich.' },
  ] as const).map((a) => ({ ...a, secret: true })),
];

export type SecretAchievementId =
  | 'civil-disobedience'
  | 'student-and-teacher'
  | 'afuera'
  | 'brussels-effect'
  | 'insomniac'
  | 'tax-day'
  | 'white-paper'
  | 'fine-print'
  | 'make-up-your-mind'
  | 'say-it'
  | 'exit-liquidity'
  | 'zero-time-preference';

/** The phrase that unlocks "Say It With Me" when typed. */
export const SECRET_PHRASE = 'taxation is theft';
