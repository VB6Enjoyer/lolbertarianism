// What's in the game: the four libertarians you can play, their weapons and the passives, and the
// statists who keep coming. Numbers live here; what they do lives in game.ts.

export type CharacterId = 'ancap' | 'minarchist' | 'agorist' | 'austrian';
export type WeaponId = 'coins' | 'shotgun' | 'ak' | 'nein' | 'hand' | 'signal' | 'laffer' | 'nap';
export type PassiveId = 'property' | 'timepref' | 'division' | 'compound' | 'freetrade' | 'healthcare';
export type EnemyId = 'communist' | 'socialist' | 'keynesian' | 'stimulus' | 'bureaucrat' | 'taxman' | 'bank';

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
    hp: 100,
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
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  coins: { id: 'coins', name: 'Gold Coins', icon: '🪙', text: 'Fires gold coins at the nearest statist.', levels: ['Fires a gold coin at the nearest statist.', '+Damage, coins pierce 1.', '+1 coin.', 'Faster, pierce 2.', '+1 coin, +damage.'] },
  shotgun: { id: 'shotgun', name: 'Pump Shotgun', icon: '🔫', text: 'A short-range spread that knocks them back.', levels: ['5 pellets, short range, big knockback.', '+1 pellet, faster.', '+1 pellet, +damage.', '+1 pellet, faster.', '+1 pellet, +damage.'] },
  ak: { id: 'ak', name: 'AK (Price Negotiable)', icon: '🏷️', text: 'Rapid fire. Bought on the counter-economy.', levels: ['Rapid fire at the nearest statist.', '+Damage.', 'Bullets pierce 1.', 'Faster, +damage.', 'Pierce 2, faster.'] },
  nein: { id: 'nein', name: 'NEIN!', icon: '🗯️', text: 'A shockwave of refusal all around you.', levels: ['A shockwave that damages and pushes back.', '+Radius, +damage.', 'More often.', '+Radius, +damage.', 'More often, +radius.'] },
  hand: { id: 'hand', name: 'Invisible Hand', icon: '🤚', text: 'Hands that circle you, slapping statists.', levels: ['2 hands circle you.', '+Damage, wider.', '+1 hand.', '+Damage, wider.', '+1 hand, faster.'] },
  signal: { id: 'signal', name: 'Price Signal', icon: '🚦', text: 'Homing signals that find a target on their own.', levels: ['A homing signal.', '+1 signal.', '+Damage, faster.', '+1 signal.', '+1 signal, +damage.'] },
  laffer: { id: 'laffer', name: 'Laffer Curve', icon: '📈', text: 'Flies out in a curve and comes back, through everything.', levels: ['A curve that goes out and comes back.', '+Damage.', '+1 curve.', '+Damage, faster.', '+1 curve.'] },
  nap: { id: 'nap', name: 'Non-Aggression Pact', icon: '🛡️', text: 'Anyone who comes too close gets hurt. They started it.', levels: ['Hurts statists close to you.', '+Radius, +damage.', '+Damage.', '+Radius, +damage.', '+Radius, +damage.'] },
};

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
  socialist: { id: 'socialist', name: 'Socialistball', hp: 16, speed: 52, damage: 6, radius: 16, xp: 2, note: 'Heals the statists around him: redistribution.' },
  keynesian: { id: 'keynesian', name: 'Keynesianball', hp: 24, speed: 62, damage: 8, radius: 18, xp: 2, note: 'Splits into two when you hit him hard enough: stimulus.' },
  stimulus: { id: 'stimulus', name: 'Stimulus', hp: 6, speed: 92, damage: 4, radius: 11, xp: 1, note: 'Small, fast, and borrowed.' },
  bureaucrat: { id: 'bureaucrat', name: 'Bureaucratball', hp: 30, speed: 44, damage: 8, radius: 18, xp: 3, note: 'Leaves red tape behind that slows you down.' },
  taxman: { id: 'taxman', name: 'Taxmanball', hp: 20, speed: 100, damage: 5, radius: 15, xp: 3, note: 'Fast. Grabs your XP before you can. Kill him to get it back.' },
  bank: { id: 'bank', name: 'The Central Bank', hp: 2400, speed: 46, damage: 20, radius: 50, xp: 80, note: 'Prints inflation balloons and stimulus. Arrives at 5:00.' },
};

/** How long a run lasts, and when the boss arrives (seconds). */
export const RUN_LENGTH = 600;
export const BOSS_AT = 300;
