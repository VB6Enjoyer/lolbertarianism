// What's in the game: the four libertarians you can play, their weapons and the passives, and the
// statists who keep coming. Numbers live here; what they do lives in game.ts.

export type CharacterId = 'ancap' | 'minarchist' | 'agorist' | 'austrian';
/** The four starting weapons, their four upgraded forms, and the rest anyone can pick up. */
export type WeaponId =
  | 'coins' | 'shotgun' | 'ak' | 'nein'
  | 'goldbars' | 'autoshotgun' | 'm249' | 'nein3'
  | 'hand' | 'signal' | 'laffer' | 'nap' | 'destruction' | 'happening';
export type PassiveId = 'property' | 'timepref' | 'division' | 'compound' | 'freetrade' | 'healthcare' | 'sound' | 'exit';
export type EnemyId = 'communist' | 'socialist' | 'keynesian' | 'stimulus' | 'fascist' | 'taxman' | 'bank';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  weapon: WeaponId;
  /** What makes them different, in a line. */
  perk: string;
  blurb: string;
  hp: number;
  speed: number;
  magnet: number;
  armor: number;
  xpMult: number;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  ancap: {
    id: 'ancap',
    name: 'Ancapball',
    weapon: 'coins',
    perk: 'A big pickup magnet: profits come to him.',
    blurb: 'Gold and black. Pays in gold, literally, at high velocity.',
    hp: 110,
    speed: 165,
    magnet: 125,
    armor: 0,
    xpMult: 1,
  },
  minarchist: {
    id: 'minarchist',
    name: 'Minarchistball',
    weapon: 'shotgun',
    perk: 'The night-watchman: tougher, with 1 armour.',
    blurb: 'Gold and blue, a cigarette and a pump-action shotgun. The state can guard the door. Nothing else.',
    hp: 120,
    speed: 150,
    magnet: 95,
    armor: 1,
    xpMult: 1,
  },
  agorist: {
    id: 'agorist',
    name: 'Agoristball',
    weapon: 'ak',
    perk: 'Counter-economics: the fastest on his feet.',
    blurb: 'Grey and black. Engage in the counter-economy today! (The rifle still has its price tag on.)',
    hp: 100,
    speed: 190,
    magnet: 85,
    armor: 0,
    xpMult: 1,
  },
  austrian: {
    id: 'austrian',
    name: 'Austrian School ball',
    weapon: 'nein',
    perk: 'Sound theory: 15% more XP.',
    blurb: 'Red, white and red, with a snake and one word for every statist: nein.',
    hp: 100,
    speed: 160,
    magnet: 85,
    armor: 0,
    xpMult: 1.15,
  },
};

export const CHARACTER_ORDER: CharacterId[] = ['ancap', 'minarchist', 'agorist', 'austrian'];

export const MAX_LEVEL = 5;
export const WEAPON_SLOTS = 5;
export const PASSIVE_SLOTS = 5;

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  /** What it does, and what each level adds (index 0 = level 1). */
  text: string;
  levels: string[];
  /** A drawing to use instead of the emoji, where there's no fitting emoji. */
  svg?: string;
  /** A picture (in public/vidya/img) to use instead, for the guns. */
  img?: string;
}

/** A real Laffer Curve: revenue against the tax rate, rising to a peak and falling back to zero at 100%. */
export const LAFFER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="3" y="3" width="58" height="58" rx="9" fill="#fffdf3" stroke="#111" stroke-width="3"/>
  <path d="M12 10 V52 H54" fill="none" stroke="#37474f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 18 V52" stroke="#90a4ae" stroke-width="1.6" stroke-dasharray="3 3"/>
  <path d="M12 52 C18 8 46 8 52 52" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
  <path d="M12 52 C18 8 46 8 52 52" fill="none" stroke="#ff6d00" stroke-width="4" stroke-linecap="round"/>
  <circle cx="32" cy="19" r="4" fill="#ffd54f" stroke="#111" stroke-width="2"/>
</svg>`;

/** A stack of gold bars, for the Gold Standard. */
export const GOLDBARS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <g stroke="#111" stroke-width="2.5" stroke-linejoin="round">
    <path d="M6 50 L12 38 H30 L34 50 Z" fill="#ffb300"/><path d="M34 50 L40 38 H58 L62 50 Z" fill="#ffb300"/>
    <path d="M20 37 L26 25 H44 L48 37 Z" fill="#ffd54f"/>
    <path d="M12 38 L14 41 H28 L30 38 M40 38 L42 41 H56 L58 38 M26 25 L28 28 H42 L44 25" fill="none" stroke-width="1.5"/>
  </g>
  <path d="M30 31 h8" stroke="#fff8e1" stroke-width="2" stroke-linecap="round"/>
  <path d="M17 44 h8 M45 44 h8" stroke="#fff3c4" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/** Three speech bubbles, for NEIN NEIN NEIN. */
export const NEIN3_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <g stroke="#111" stroke-width="2.5" stroke-linejoin="round" font-family="Anton, Impact, sans-serif" font-size="11" text-anchor="middle">
    <path d="M4 6 H40 V22 H18 L12 28 V22 H4 Z" fill="#fff"/>
    <path d="M14 22 H54 V40 H30 L24 46 V40 H14 Z" fill="#ef2b2d"/>
    <path d="M22 38 H62 V58 H22 Z" fill="#fff"/>
  </g>
  <g font-family="Anton, Impact, sans-serif" text-anchor="middle" font-weight="900">
    <text x="22" y="19" font-size="11" fill="#111">NEIN</text>
    <text x="34" y="36" font-size="12" fill="#fff">NEIN</text>
    <text x="42" y="54" font-size="14" fill="#111">NEIN!</text>
  </g>
</svg>`;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  coins: { id: 'coins', name: 'Gold Coins', icon: '🪙', text: 'Fires gold coins at the nearest statist.', levels: ['Fires a gold coin at the nearest statist.', '+Damage, coins pierce 1.', '+1 coin.', 'Faster, pierce 2.', '+1 coin, +damage.'] },
  shotgun: { id: 'shotgun', name: 'Pump Shotgun', icon: '🔫', img: 'shotgun.webp', text: 'A short-range spread that knocks them back.', levels: ['5 pellets, short range, big knockback.', '+1 pellet, faster.', '+1 pellet, +damage.', '+1 pellet, faster.', '+1 pellet, +damage.'] },
  ak: { id: 'ak', name: 'AK (Price Negotiable)', icon: '🏷️', img: 'ak47.webp', text: 'Rapid fire. Bought on the counter-economy.', levels: ['Rapid fire at the nearest statist.', '+Damage.', 'Bullets pierce 1.', 'Faster, +damage.', 'Pierce 2, faster.'] },
  nein: { id: 'nein', name: 'NEIN!', icon: '🗯️', text: 'A shockwave of refusal all around you.', levels: ['A shockwave that damages and pushes back.', '+Radius, +damage.', 'More often.', '+Radius, +damage.', 'More often, +radius.'] },
  hand: { id: 'hand', name: 'Invisible Hand', icon: '🤚', text: 'Hands that circle you, slapping statists.', levels: ['2 hands circle you.', '+Damage, wider.', '+1 hand.', '+Damage, wider.', '+1 hand, faster.'] },
  signal: { id: 'signal', name: 'Price Signal', icon: '🚦', text: 'Homing signals that find a target on their own.', levels: ['A homing signal.', '+1 signal.', '+Damage, faster.', '+1 signal.', '+1 signal, +damage.'] },
  laffer: { id: 'laffer', name: 'Laffer Curve', icon: '📈', svg: LAFFER_SVG, text: 'Flies out in a curve and comes back, through everything. Past the peak, every bit more hurts.', levels: ['A curve that goes out and comes back.', '+Damage.', '+1 curve.', '+Damage, faster.', '+1 curve.'] },
  nap: { id: 'nap', name: 'Non-Aggression Pact', icon: '🛡️', text: 'Anyone who comes too close gets hurt. They started it.', levels: ['Hurts statists close to you.', '+Radius, +damage.', '+Damage.', '+Radius, +damage.', '+Radius, +damage.'] },
  destruction: { id: 'destruction', name: 'Creative Destruction', icon: '💥', text: 'Statists near you blow up, taking their neighbours with them. Schumpeter would approve.', levels: ['A statist near you explodes.', '+Damage, bigger blasts.', '+1 explosion.', '+Damage, more often.', '+1 explosion, bigger, +damage.'] },
  happening: { id: 'happening', name: 'It’s Happening', icon: '⚡', text: 'Lightning that jumps from statist to statist.', levels: ['A bolt that jumps 3 times.', '+1 jump, +damage.', '+1 jump, more often.', '+1 jump, +damage.', '+2 jumps, +damage, more often.'] },
  // The upgraded forms (from the shop's weapon upgrades): offered once the starting weapon is level 5.
  goldbars: { id: 'goldbars', name: 'Gold Standard', icon: '🧈', svg: GOLDBARS_SVG, text: 'Heavy gold bars that plough through whole rows of statists.', levels: ['4 gold bars at a time, more damage, and each goes through 5 statists.'] },
  autoshotgun: { id: 'autoshotgun', name: 'Auto Shotgun', icon: '🔫', img: 'autoshotgun.webp', text: 'No more pumping: a drum magazine and twice the rate of fire.', levels: ['10 pellets, a wider spread, more damage, twice as fast.'] },
  m249: { id: 'm249', name: 'M249 (Bulk Discount)', icon: '🔫', img: 'm249.webp', text: 'A belt-fed machine gun. Bought wholesale.', levels: ['Fires twice as fast, hits harder, and goes through 3 statists.'] },
  nein3: { id: 'nein3', name: 'NEIN NEIN NEIN', icon: '🗯️', svg: NEIN3_SVG, text: 'Three shockwaves, each bigger than the last. The answer has not changed.', levels: ['Three waves in a row, each wider, each hitting harder than NEIN! did.'] },
};

/** What each character's weapon becomes with its shop upgrade. */
export const EVOLUTIONS: Record<CharacterId, { from: WeaponId; to: WeaponId }> = {
  ancap: { from: 'coins', to: 'goldbars' },
  minarchist: { from: 'shotgun', to: 'autoshotgun' },
  agorist: { from: 'ak', to: 'm249' },
  austrian: { from: 'nein', to: 'nein3' },
};

/** Weapons anyone can find on a level-up (the ones the shop sells are locked until bought). */
export const POOL_WEAPONS: WeaponId[] = ['hand', 'signal', 'laffer', 'nap', 'destruction', 'happening'];
/** Cards that have to be bought in the shop before they turn up. */
export const LOCKED_CARDS: (WeaponId | PassiveId)[] = ['destruction', 'happening', 'sound', 'exit'];

export const STARTING_WEAPONS: WeaponId[] = ['coins', 'shotgun', 'ak', 'nein'];

/** Per-level numbers (index 0 = level 1). */
export const WEAPON_STATS = {
  coins: { damage: [12, 14, 15, 17, 20], cooldown: [0.82, 0.78, 0.74, 0.66, 0.6], count: [1, 1, 2, 2, 3], pierce: [0, 1, 1, 2, 2], speed: 480 },
  shotgun: { damage: [8, 8, 10, 10, 12], cooldown: [1.15, 1.05, 1.0, 0.9, 0.82], count: [5, 6, 7, 8, 9], spread: 0.5, speed: 580, life: 0.5, knockback: 170 },
  ak: { damage: [6, 7, 7, 8, 9], cooldown: [0.17, 0.16, 0.15, 0.13, 0.11], pierce: [0, 0, 1, 1, 2], speed: 640, jitter: 0.09 },
  nein: { damage: [12, 15, 15, 18, 21], radius: [155, 168, 168, 188, 205], cooldown: [1.8, 1.75, 1.6, 1.5, 1.35], knockback: 130 },
  hand: { damage: [8, 10, 10, 13, 13], count: [2, 2, 3, 3, 4], orbit: [70, 78, 78, 88, 92], spin: [2.6, 2.6, 2.6, 2.6, 3.4], hitEvery: 0.45 },
  signal: { damage: [16, 16, 20, 20, 24], count: [1, 2, 2, 3, 4], cooldown: [1.8, 1.8, 1.55, 1.55, 1.4], speed: 330, turn: 5 },
  laffer: { damage: [14, 17, 17, 21, 21], count: [1, 1, 2, 2, 3], cooldown: [2.0, 2.0, 1.9, 1.6, 1.6], reach: 250, time: 1.3 },
  nap: { radius: [62, 72, 72, 84, 96], dps: [12, 16, 20, 25, 32] },
  destruction: { damage: [20, 24, 26, 30, 38], radius: [60, 66, 66, 72, 84], count: [1, 1, 2, 2, 3], cooldown: [2.2, 2.1, 2.1, 1.8, 1.7], range: 380 },
  happening: { damage: [14, 16, 16, 20, 24], jumps: [3, 4, 5, 6, 8], cooldown: [1.6, 1.55, 1.4, 1.4, 1.2], reach: 170, range: 420 },
  // Upgraded forms: one level, no arrays.
  goldbars: { damage: 32, cooldown: 0.56, count: 4, pierce: 5, speed: 520 },
  autoshotgun: { damage: 14, cooldown: 0.42, count: 10, spread: 0.8, speed: 620, life: 0.55, knockback: 190 },
  m249: { damage: 12, cooldown: 0.065, pierce: 3, speed: 700, jitter: 0.13 },
  nein3: { damage: 24, radius: [205, 245, 285], gap: 0.18, cooldown: 1.35, knockback: 150 },
} as const;

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  text: string;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  property: { id: 'property', name: 'Property Rights', icon: '🏠', text: '+1 armour (every hit does 1 less).' },
  timepref: { id: 'timepref', name: 'Low Time Preference', icon: '⏳', text: 'Every weapon fires 8% more often.' },
  division: { id: 'division', name: 'Division of Labour', icon: '🏭', text: 'More coins, pellets, signals, curves and hands (at levels 1, 3 and 5).' },
  compound: { id: 'compound', name: 'Compound Interest', icon: '💹', text: '+10% XP.' },
  freetrade: { id: 'freetrade', name: 'Free Trade', icon: '🧲', text: '+25% pickup range.' },
  healthcare: { id: 'healthcare', name: 'Private Healthcare', icon: '❤️‍🩹', text: '+15 max HP, heal 15, and regenerate a little.' },
  sound: { id: 'sound', name: 'Sound Money', icon: '💵', text: 'Every weapon does 8% more damage.' },
  exit: { id: 'exit', name: 'Right of Exit', icon: '🚪', text: 'Move 6% faster. Voting with your feet.' },
};

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  /** What it does, for the how-to. */
  note: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  communist: { id: 'communist', name: 'Communistball', hp: 8, speed: 58, damage: 6, radius: 14, xp: 1, note: 'Slow, and there are always more of them: the masses.' },
  socialist: { id: 'socialist', name: 'Social Democratball', hp: 16, speed: 52, damage: 6, radius: 16, xp: 2, note: 'Heals the statists around him: redistribution, with a first-aid kit.' },
  keynesian: { id: 'keynesian', name: 'Keynesianball', hp: 24, speed: 62, damage: 8, radius: 18, xp: 2, note: 'Splits into two when you hit him hard enough: stimulus.' },
  stimulus: { id: 'stimulus', name: 'Stimulus', hp: 6, speed: 92, damage: 4, radius: 11, xp: 1, note: 'Small, fast, and borrowed.' },
  fascist: { id: 'fascist', name: 'Fascistball', hp: 28, speed: 50, damage: 7, radius: 17, xp: 3, note: 'Marches in squads, stops to wind up (watch for the “!”), then charges.' },
  taxman: { id: 'taxman', name: 'Taxmanball', hp: 20, speed: 100, damage: 5, radius: 15, xp: 3, note: 'Fast. Grabs your XP before you can. Kill him to get it back.' },
  bank: { id: 'bank', name: 'The Central Bank', hp: 2400, speed: 46, damage: 20, radius: 50, xp: 80, note: 'Prints inflation balloons and stimulus. Arrives at 5:00.' },
};

/** How long a run lasts, and when the boss arrives (seconds). */
export const RUN_LENGTH = 600;
export const BOSS_AT = 300;
