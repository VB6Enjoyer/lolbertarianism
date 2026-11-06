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
    /** Total Free Private Cities ever earned = floor(sqrt(all-time earnings / divisor)). */
    divisor: 1_000_000,
    /** Income bonus per Free Private City (applies to clicks and passive income). */
    bonusPerCity: 0.1,
  },
  /** Income bonus per unlocked achievement. */
  bonusPerAchievement: 0.01,
  stickers: {
    /** Passive income (CPS) bonus per sticker owned. */
    bonusEach: 0.005,
    /** Price of the first sticker you buy… */
    firstCost: 100_000,
    /** …and of the last one. Prices in between grow by the same factor each purchase. */
    lastCost: 10_000_000_000_000,
  },
  saveIntervalMs: 5000,
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

export type StickerCategory = 'quote' | 'emoji' | 'html' | 'person' | 'organization' | 'item';

export interface StickerData {
  /** Stable id used in saves (the content itself). */
  id: string;
  type: 'text' | 'emoji' | 'html' | 'image';
  category: StickerCategory;
  content: string;
}

/** Sticker shop tabs, in order. */
export const STICKER_CATEGORIES: readonly { id: StickerCategory; label: string }[] = [
  { id: 'quote', label: '💬 Quotes' },
  { id: 'emoji', label: '🐍 Emojis' },
  { id: 'html', label: '🏴 Flags' },
  { id: 'person', label: '🧔 People' },
  { id: 'organization', label: '🏛️ Orgs' },
  { id: 'item', label: '🔫 Items' },
];

const quote = (content: string): StickerData => ({ id: content, type: 'text', category: 'quote', content });
const emoji = (content: string): StickerData => ({ id: content, type: 'emoji', category: 'emoji', content });
const html = (id: string, content: string): StickerData => ({ id, type: 'html', category: 'html', content });
const image = (category: StickerCategory, name: string): StickerData => ({ id: name, type: 'image', category, content: `img/${name}.webp` });

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
];

/** Stickers everyone starts with (free, and kept after seceding). */
export const STARTER_STICKERS: readonly string[] = ['Taxation is theft!', '🐍', 'flag-ancap', 'rothbard', 'pistol'];

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
  /** True when every sticker of that category is owned. */
  stickerCategoryComplete: (category: StickerCategory) => boolean;
  stats: {
    clicks: number;
    crits: number;
    raidsEvaded: number;
    raidsAutoEvaded: number;
    secessions: number;
    reshuffles: number;
    stickersDragged: number;
    offlineCollected: number;
  };
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  check: (c: AchievementContext) => boolean;
  /** Optional link shown once unlocked. */
  reward?: { label: string; href: string };
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
  { id: 'sticker-first', icon: '🏷️', name: 'Brand Ambassador', description: 'Buy your first sticker. Laptop lids everywhere tremble.', check: (c) => c.stickersOwned > STARTER_STICKERS.length },
  { id: 'sticker-people', icon: '🧔', name: 'Hall of Fame', description: 'Own every People sticker. The Mises Institute group chat, complete.', check: (c) => c.stickerCategoryComplete('person') },
  { id: 'sticker-all', icon: '🖼️', name: 'Laptop Lid Complete', description: 'Own every sticker. There is no free space left. Homestead elsewhere.', check: (c) => c.stickersOwned >= STICKERS.length },
  { id: 'offline', icon: '😴', name: 'Passive Income Guru', description: 'Come back to money your enterprises made while you were away.', check: (c) => c.stats.offlineCollected >= 1 },
];
