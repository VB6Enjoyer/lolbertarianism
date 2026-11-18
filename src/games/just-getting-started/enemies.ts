// The people on the other side of the desk. Each shows what it will do next turn (its intent):
// how hard it hits, or that it's defending, buffing, or up to something. Bosses close each act:
// the Doomposter, the Fed Chair at the money printer, and Late Stage Capitalism itself.

import { int, pickOne, type Rng, weighted } from './rng.ts';
import { addCard, addStatus, alive, type Combat, type Enemy, enemyStrike, gainBlock, heal } from './state.ts';

export type Intent = 'attack' | 'defend' | 'buff' | 'debuff' | 'special';

export interface Move {
  name: string;
  intent: Intent;
  /** For attacks: damage per hit, and hits. */
  damage?: number;
  hits?: number;
  /** For attacks that grow: the damage per hit right now. */
  damageFor?: (e: Enemy) => number;
  /** For random attacks: the range to show instead of one number. */
  range?: [number, number];
  /** A second intent shown with the first (an attack that also debuffs). */
  also?: Intent;
  act: (c: Combat, e: Enemy) => void;
}

export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  hp: [number, number];
  moves: Record<string, Move>;
  /** Picks the next move (after the last one, which is `e.move`). */
  next: (e: Enemy, rng: Rng, c: Combat) => string;
  /** The first move, if it's not up to `next`. */
  first?: string;
  /** Runs when the fight starts. */
  start?: (c: Combat, e: Enemy) => void;
  /** Runs when it drops to 0; return true if it gets back up. */
  onDeath?: (c: Combat, e: Enemy) => boolean;
  boss?: boolean;
  /** A photo to show instead of the emoji (public/vidya/img, without .webp): the secret bosses. */
  image?: string;
  /** What it says when the fight starts. */
  intro: string;
}

/** A plain attack (damage × hits), with anything extra after it. */
const attack = (name: string, damage: number, hits = 1, extra?: (c: Combat, e: Enemy) => void, also?: Intent): Move => ({
  name,
  intent: 'attack',
  damage,
  hits,
  also,
  act: (c, e) => {
    enemyStrike(c, e, damage, hits);
    extra?.(c, e);
  },
});
const say = (c: Combat, e: Enemy, text: string) => c.fx.push({ kind: 'say', target: e.uid, text });

/** Picks a move by weight, never the same one three times running. */
function mix(e: Enemy, rng: Rng, options: [string, number][]): string {
  const repeats = e.memo.repeat ?? 0;
  const allowed = repeats >= 1 ? options.filter(([m]) => m !== e.move) : options;
  const move = weighted(rng, allowed.length ? allowed : options);
  e.memo.repeat = move === e.move ? repeats + 1 : 0;
  return move;
}

/** Cycles through moves in order. */
const cycle = (order: string[]) => (e: Enemy) => order[e.turn % order.length];

const LIST: EnemyDef[] = [
  // --- Act 1 ---
  {
    id: 'doomscroller', name: 'Doomscroller', emoji: '😔', hp: [38, 42],
    intro: 'It’s over. Have you seen the news?',
    moves: {
      doompost: attack('Doompost', 8),
      ratio: attack('Ratio', 5, 1, (c) => addStatus(c, c.player, 'rattled', 1, 'player'), 'debuff'),
      spiral: { name: 'Spiral', intent: 'buff', act: (c, e) => addStatus(c, e, 'momentum', 2, e.uid) },
    },
    next: (e, rng) => mix(e, rng, [['doompost', 45], ['ratio', 35], ['spiral', 20]]),
  },
  {
    id: 'replyguy', name: 'Reply Guy', emoji: '🤓', hp: [18, 22],
    intro: 'Well, actually…',
    moves: {
      actually: attack('Well, Actually', 6),
      source: { name: 'Source?', intent: 'defend', also: 'debuff', act: (c, e) => {
        gainBlock(c, e, 5, e.uid);
        addStatus(c, c.player, 'exposed', 1, 'player');
      } },
    },
    next: (e, rng) => mix(e, rng, [['actually', 60], ['source', 40]]),
  },
  {
    id: 'nimby', name: 'NIMBY', emoji: '🏡', hp: [44, 48],
    intro: 'Housing, yes. Just not here. Or there.',
    moves: {
      zoning: attack('Zoning Hearing', 11),
      backyard: { name: 'Not in My Backyard', intent: 'defend', also: 'buff', act: (c, e) => {
        gainBlock(c, e, 9, e.uid);
        addStatus(c, e, 'momentum', 1, e.uid);
      } },
      petition: { name: 'Petition', intent: 'debuff', act: (c) => addCard(c, 'shortage', 'discard') },
    },
    first: 'petition',
    next: cycle(['zoning', 'backyard', 'zoning', 'petition']),
  },
  {
    id: 'influencer', name: 'Doom Influencer', emoji: '📱', hp: [28, 32],
    intro: 'Smash that like button before capitalism collapses.',
    moves: {
      thread: attack('Thread 🧵', 3, 3),
      sponsor: { name: 'Sponsored Segment', intent: 'buff', act: (c, e) => {
        heal(c, e, 6, e.uid);
        addStatus(c, e, 'momentum', 1, e.uid);
      } },
    },
    next: (e, rng) => mix(e, rng, [['thread', 65], ['sponsor', 35]]),
  },
  // Act 1 elites
  {
    id: 'gouging', name: 'Price Gouging Panic', emoji: '😡', hp: [72, 76],
    intro: 'Water for $5 after a hurricane?! Someone ban this!',
    moves: {
      outrage: attack('Outrage', 13),
      freeze: { name: 'Freeze Prices', intent: 'debuff', also: 'defend', act: (c, e) => {
        addCard(c, 'shortage', 'draw');
        addCard(c, 'shortage', 'draw');
        gainBlock(c, e, 8, e.uid);
      } },
      ration: attack('Ration', 6, 2),
    },
    first: 'freeze',
    next: cycle(['outrage', 'ration', 'freeze']),
  },
  {
    id: 'rentcontrol', name: 'Rent Control', emoji: '🏚️', hp: [80, 84],
    intro: 'Best way to destroy a city, short of bombing it. (Lindbeck said that.)',
    moves: {
      freeze: { name: 'Freeze the Rent', intent: 'debuff', also: 'defend', act: (c, e) => {
        addStatus(c, c.player, 'rattled', 2, 'player');
        gainBlock(c, e, 10, e.uid);
      } },
      crumble: attack('Crumbling Ceiling', 16),
      waitlist: attack('Ten-Year Waitlist', 4, 3),
    },
    first: 'freeze',
    next: cycle(['crumble', 'waitlist', 'freeze']),
    // The building falls apart on its own: it loses 3 Credibility every turn.
    start: (c, e) => addStatus(c, e, 'decay', 3, e.uid),
  },
  // Act 1 boss
  {
    id: 'doomposter', name: 'The Doomposter', emoji: '🧵', hp: [105, 105], boss: true,
    intro: 'LATE STAGE CAPITALISM 😔. A thread. 1/97',
    moves: {
      thread: attack('Thread 🧵 (1/97)', 4, 3),
      latestage: { name: 'Late Stage!', intent: 'debuff', act: (c, e) => {
        addCard(c, 'inflation', 'draw');
        addCard(c, 'inflation', 'draw');
        addStatus(c, c.player, 'exposed', 1, 'player');
        say(c, e, 'This is LATE STAGE capitalism 😔');
      } },
      ratiod: attack('Ratio’d', 13),
      collapse: { name: 'Collapse Imminent', intent: 'defend', also: 'buff', act: (c, e) => {
        gainBlock(c, e, 12, e.uid);
        addStatus(c, e, 'momentum', 2, e.uid);
        say(c, e, 'Any day now. Any day.');
      } },
    },
    first: 'latestage',
    next: cycle(['thread', 'ratiod', 'collapse', 'latestage']),
  },

  // --- Act 2 ---
  {
    id: 'druid', name: 'Degrowth Druid', emoji: '🌿', hp: [50, 54],
    intro: 'Less is more. Especially for you.',
    moves: {
      compost: attack('Compost', 9),
      less: { name: 'Less Is More', intent: 'debuff', act: (c) => {
        addStatus(c, c.player, 'rattled', 2, 'player');
        addStatus(c, c.player, 'exposed', 1, 'player');
      } },
      photo: { name: 'Photosynthesize', intent: 'buff', act: (c) => {
        for (const ally of alive(c)) heal(c, ally, 8, ally.uid);
      } },
    },
    next: (e, rng) => mix(e, rng, [['compost', 50], ['less', 25], ['photo', 25]]),
  },
  {
    id: 'streamer', name: 'Twitch Socialist', emoji: '🎮', hp: [54, 58],
    intro: 'Chat, he’s defending billionaires. From his $3,000 setup.',
    moves: {
      donation: { name: 'Donation Goal', intent: 'attack', damage: 6, damageFor: (e) => 6 + 3 * (e.memo.goals ?? 0), act: (c, e) => {
        enemyStrike(c, e, 6 + 3 * (e.memo.goals ?? 0));
        e.memo.goals = (e.memo.goals ?? 0) + 1;
      } },
      ban: { name: 'Chat, Ban Him', intent: 'debuff', act: (c) => addStatus(c, c.player, 'exposed', 2, 'player') },
    },
    next: cycle(['donation', 'donation', 'ban']),
  },
  {
    id: 'planner', name: 'Five-Year Planner', emoji: '📋', hp: [58, 62],
    intro: 'The plan is perfect. Reality will be adjusted.',
    moves: {
      planning: { name: 'Planning…', intent: 'defend', act: (c, e) => gainBlock(c, e, 8, e.uid) },
      plan: attack('The Plan', 24),
    },
    next: cycle(['planning', 'planning', 'plan']),
  },
  {
    id: 'banker', name: 'Bailout Banker', emoji: '🏦', hp: [50, 54],
    intro: 'Heads I win, tails you pay.',
    moves: {
      tbtf: { name: 'Too Big to Fail', intent: 'defend', act: (c, e) => gainBlock(c, e, 14, e.uid) },
      hazard: attack('Moral Hazard', 12),
    },
    next: (e, rng) => mix(e, rng, [['hazard', 55], ['tbtf', 45]]),
  },
  // Act 2 elite
  {
    id: 'keynesian', name: 'The Keynesian', emoji: '🎩', hp: [110, 114],
    intro: 'Dig holes, fill them in. Growth!',
    moves: {
      spirits: { name: 'Animal Spirits', intent: 'attack', damage: 15, range: [8, 22], act: (c, e) => enemyStrike(c, e, int(c.rng, 8, 22)) },
      stimulus: { name: 'Stimulus', intent: 'buff', act: (c, e) => {
        heal(c, e, 15, e.uid);
        addStatus(c, e, 'momentum', 2, e.uid);
      } },
      longrun: { name: 'In the Long Run…', intent: 'attack', damage: 30, act: (c, e) => {
        enemyStrike(c, e, 30);
        say(c, e, '…we are all dead.');
      } },
    },
    next: cycle(['spirits', 'stimulus', 'spirits', 'longrun']),
  },
  // Act 2 boss
  {
    id: 'fedchair', name: 'The Fed Chair', emoji: '🖨️', hp: [170, 170], boss: true,
    intro: 'Inflation is transitory. Brrrrr.',
    moves: {
      brrr: { name: 'Brrrrr', intent: 'debuff', also: 'buff', act: (c, e) => {
        for (let i = 0; i < 2; i++) addCard(c, 'inflation', 'draw');
        addStatus(c, e, 'momentum', 2, e.uid);
        say(c, e, 'Money printer go brrrrr.');
      } },
      hike: attack('Rate Hike', 17),
      qe: { name: 'Quantitative Easing', intent: 'defend', act: (c, e) => gainBlock(c, e, 20, e.uid) },
      transitory: attack('Transitory', 7, 2, (c, e) => {
        heal(c, e, 10, e.uid);
        say(c, e, 'It’s transitory. Trust me.');
      }, 'buff'),
    },
    first: 'brrr',
    next: cycle(['hike', 'transitory', 'qe', 'brrr']),
  },

  // --- Act 3 ---
  {
    id: 'marxist', name: 'Tenured Marxist', emoji: '🧔', hp: [72, 76],
    intro: 'Your argument is a bourgeois construct.',
    moves: {
      dialectic: attack('Dialectic', 6, 2),
      surplus: { name: 'Surplus Value', intent: 'attack', damage: 9, also: 'buff', act: (c, e) => {
        const before = c.player.hp;
        enemyStrike(c, e, 9);
        heal(c, e, before - c.player.hp, e.uid);
      } },
      revision: { name: 'Revisionism', intent: 'debuff', act: (c) => {
        addStatus(c, c.player, 'exposed', 2, 'player');
        addStatus(c, c.player, 'rattled', 2, 'player');
      } },
    },
    next: (e, rng) => mix(e, rng, [['dialectic', 40], ['surplus', 35], ['revision', 25]]),
  },
  {
    id: 'agency', name: 'Regulatory Agency', emoji: '🗂️', hp: [78, 82],
    intro: 'Please fill out Form 27-B in triplicate.',
    moves: {
      form: { name: 'Form 27-B', intent: 'debuff', act: (c) => {
        addCard(c, 'shortage', 'draw');
        addCard(c, 'shortage', 'draw');
      } },
      fine: attack('Fine', 14),
      grow: { name: 'Mission Creep', intent: 'buff', also: 'defend', act: (c, e) => {
        addStatus(c, e, 'momentum', 3, e.uid);
        gainBlock(c, e, 10, e.uid);
      } },
    },
    next: cycle(['form', 'fine', 'grow', 'fine']),
  },
  {
    id: 'lobbyist', name: 'Lobbyist', emoji: '💼', hp: [60, 64],
    intro: 'I’m not against markets. I’m for my market.',
    moves: {
      capture: { name: 'Regulatory Capture', intent: 'buff', also: 'defend', act: (c, e) => {
        gainBlock(c, e, 10, e.uid);
        for (const ally of alive(c)) addStatus(c, ally, 'momentum', 2, ally.uid);
      } },
      earmark: attack('Earmark', 8, 2),
    },
    next: (e, rng) => mix(e, rng, [['earmark', 60], ['capture', 40]]),
  },
  // Act 3 elite
  {
    id: 'commissar', name: 'Commissar of Prices', emoji: '🎖️', hp: [140, 146],
    intro: 'Bread costs 10 kopecks. There is no bread.',
    moves: {
      decree: attack('Price Decree', 18),
      queue: { name: 'Bread Line', intent: 'debuff', also: 'defend', act: (c, e) => {
        for (let i = 0; i < 2; i++) addCard(c, 'shortage', 'hand');
        gainBlock(c, e, 14, e.uid);
      } },
      purge: attack('Purge', 7, 3),
    },
    first: 'queue',
    next: cycle(['decree', 'purge', 'queue']),
  },
  // Act 3 boss: gets back up once, as it always does.
  {
    id: 'latestage', name: 'Late Stage Capitalism', emoji: '😔', hp: [190, 190], boss: true,
    intro: 'I am Late Stage Capitalism. I have been dying since 1848.',
    moves: {
      over: attack('It’s Over', 12, 2),
      doomloop: { name: 'Doom Loop', intent: 'debuff', act: (c, e) => {
        addCard(c, 'inflation', 'draw');
        addCard(c, 'inflation', 'draw');
        addStatus(c, c.player, 'exposed', 2, 'player');
        say(c, e, 'Any minute now. Any minute.');
      } },
      vibecession: { name: 'Vibecession', intent: 'debuff', also: 'defend', act: (c, e) => {
        addStatus(c, c.player, 'rattled', 3, 'player');
        gainBlock(c, e, 20, e.uid);
      } },
      collapse: attack('Collapse (Any Day Now)', 28, 1, (c, e) => say(c, e, 'This time it’s REAL.')),
    },
    first: 'doomloop',
    next: cycle(['over', 'vibecession', 'collapse', 'doomloop']),
    onDeath: (c, e) => {
      if (e.memo.revived) return false;
      e.memo.revived = 1;
      e.dead = false;
      e.hp = 100;
      e.maxHp = 100;
      e.block = 0;
      e.status = { momentum: 2 };
      say(c, e, 'Okay, NOW it’s late stage. For real this time 😔');
      return true;
    },
  },
];

// --- The secret bosses: the other Friedman, after you beat Late Stage Capitalism with no Regrets ---
LIST.push(
  {
    id: 'david', name: 'David Friedman', emoji: '🧔', image: 'dfriedman', hp: [240, 240], boss: true,
    intro: 'Dad, great show. But if markets do everything better… why stop at schools? Why keep the state at all?',
    moves: {
      courts: { name: 'Private Courts', intent: 'defend', also: 'debuff', act: (c, e) => {
        gainBlock(c, e, 16, e.uid);
        addStatus(c, c.player, 'rattled', 2, 'player');
        say(c, e, 'Courts compete too, Dad. Why should law be a monopoly?');
      } },
      police: attack('Competing Police Agencies', 6, 3),
      polycentric: { name: 'Polycentric Law', intent: 'debuff', also: 'buff', act: (c, e) => {
        addStatus(c, c.player, 'exposed', 2, 'player');
        addStatus(c, e, 'momentum', 2, e.uid);
        say(c, e, 'Different rules for different customers. It worked in Iceland for three centuries.');
      } },
      iceland: attack('Medieval Iceland', 22, 1, (c, e) => say(c, e, 'No king. No police. Read the paper.')),
      farenough: { name: 'You Didn’t Go Far Enough', intent: 'buff', act: (c, e) => {
        heal(c, e, 14, e.uid);
        addStatus(c, e, 'momentum', 3, e.uid);
        say(c, e, 'Vouchers, Dad? Why not take the state out of schooling altogether?');
      } },
    },
    first: 'courts',
    next: cycle(['police', 'polycentric', 'iceland', 'farenough', 'courts']),
  },
  {
    id: 'milton', name: 'Milton Friedman', emoji: '👴', image: 'mfriedman', hp: [240, 240], boss: true,
    intro: 'Son, I love you. But the state is a necessary evil. Somebody has to print the money. Steadily.',
    moves: {
      rule: attack('Monetary Rule', 5, 3, (c, e) => say(c, e, 'A steady few percent a year. Every year. No exceptions.')),
      nit: { name: 'Negative Income Tax', intent: 'defend', also: 'buff', act: (c, e) => {
        gainBlock(c, e, 12, e.uid);
        heal(c, e, 12, e.uid);
      } },
      withholding: { name: 'Payroll Withholding', intent: 'debuff', act: (c, e) => {
        addCard(c, 'regret', 'draw');
        addCard(c, 'regret', 'draw');
        say(c, e, 'It was wartime. It was temporary. I regret it. Here, have some.');
      } },
      free: attack('Free to Choose', 20),
      pencil: { name: 'I, Pencil', intent: 'buff', act: (c, e) => {
        addStatus(c, e, 'momentum', 3, e.uid);
        say(c, e, 'Nobody knows how to make a pencil. Not even your protection agencies.');
      } },
    },
    first: 'pencil',
    next: cycle(['rule', 'withholding', 'free', 'nit', 'pencil']),
  },
);

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(LIST.map((e) => [e.id, e]));
export const enemyDef = (id: string) => ENEMIES[id];

/** Who you can meet, act by act: easy fights first, then normal ones, elites and the boss. */
export const ENCOUNTERS: Record<number, { easy: string[][]; normal: string[][]; elite: string[][]; boss: string[] }> = {
  1: {
    easy: [['doomscroller'], ['replyguy', 'replyguy']],
    normal: [['nimby'], ['influencer', 'replyguy'], ['doomscroller', 'replyguy'], ['influencer', 'influencer']],
    elite: [['gouging'], ['rentcontrol']],
    boss: ['doomposter'],
  },
  2: {
    easy: [['druid'], ['banker']],
    normal: [['streamer'], ['planner'], ['banker', 'druid'], ['streamer', 'replyguy'], ['planner', 'influencer']],
    elite: [['keynesian'], ['banker', 'planner']],
    boss: ['fedchair'],
  },
  3: {
    easy: [['marxist'], ['lobbyist']],
    normal: [['agency'], ['lobbyist', 'lobbyist'], ['marxist', 'druid'], ['agency', 'replyguy']],
    elite: [['commissar'], ['agency', 'lobbyist']],
    boss: ['latestage'],
  },
};

export const pickEncounter = (rng: Rng, act: number, tier: 'easy' | 'normal' | 'elite') => pickOne(rng, ENCOUNTERS[act][tier]);
