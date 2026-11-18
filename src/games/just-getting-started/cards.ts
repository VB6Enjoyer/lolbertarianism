// Friedman's cards. Arguments hit, Rebuttals defend and set things up, Principles stay in play for
// the rest of the fight. Status cards (Inflation, Shortage) clog the deck for one fight; Regret is
// a curse that stays for the whole run. Every card has an upgraded (+) version.

import { addCard, addStatus, alive, type Combat, drawCards, gainBlock, heal, loseHp, strike, strikeAll } from './state.ts';

export type CardType = 'argument' | 'rebuttal' | 'principle' | 'status' | 'curse';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'special';

/** Whose card it is: Milton's (the default), David's, or both of theirs. */
export type CardOwner = 'milton' | 'david' | 'both';

export interface CardDef {
  id: string;
  who?: CardOwner;
  name: string;
  emoji: string;
  type: CardType;
  rarity: Rarity;
  /** Airtime to play it; null for cards that can't be played. */
  cost: number | null;
  upCost?: number;
  /** Needs an enemy picked. */
  target?: boolean;
  exhaust?: boolean;
  upExhaust?: boolean;
  text: (up: boolean) => string;
  play?: (c: Combat, target: number, up: boolean) => void;
  /** Hurts if it's still in your hand at the end of the turn. */
  endOfTurn?: (c: Combat) => void;
  /** A line under the text. */
  flavor?: string;
}

const v = (up: boolean, base: number, better: number) => (up ? better : base);
const p = (up: boolean, base: number, better: number) => (up ? `<b class="up">${better}</b>` : String(base));

const CARD_LIST: CardDef[] = [
  // --- Starters ---
  {
    id: 'data', name: 'Show the Data', emoji: '📊', type: 'argument', rarity: 'starter', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 6, 9)} damage.`,
    play: (c, t, up) => void strike(c, t, v(up, 6, 9)),
  },
  {
    id: 'calm', name: 'Stay Calm', emoji: '🧘', type: 'rebuttal', rarity: 'starter', cost: 1,
    text: (up) => `Gain ${p(up, 5, 8)} Composure.`,
    play: (c, _t, up) => gainBlock(c, c.player, v(up, 5, 8), 'player'),
  },
  {
    id: 'lunch', name: 'No Free Lunch', emoji: '🥪', type: 'argument', rarity: 'starter', cost: 2, target: true,
    text: (up) => `Deal ${p(up, 8, 10)} damage. Apply ${p(up, 2, 3)} Exposed.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 8, 10));
      if (c.enemies[t] && !c.enemies[t].dead) addStatus(c, c.enemies[t], 'exposed', v(up, 2, 3), c.enemies[t].uid);
    },
    flavor: 'There’s no such thing.',
  },

  // --- Common Arguments ---
  {
    id: 'pencil', who: 'both', name: 'I, Pencil', emoji: '✏️', type: 'argument', rarity: 'common', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 4, 6)} damage. Draw 2 cards.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 4, 6));
      drawCards(c, 2);
    },
    flavor: 'Nobody knows how to make one.',
  },
  {
    id: 'helicopter', name: 'Helicopter Money', emoji: '🚁', type: 'argument', rarity: 'common', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 14, 18)} damage. Shuffle an Inflation into your draw pile.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 14, 18));
      addCard(c, 'inflation', 'draw');
    },
    flavor: 'Drop it from the sky. What could go wrong?',
  },
  {
    id: 'monetarist', name: 'Monetarist Rule', emoji: '📏', type: 'argument', rarity: 'common', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 3, 4)} damage 3 times.`,
    play: (c, t, up) => void strike(c, t, v(up, 3, 4), 3),
    flavor: 'Steady growth. Every time.',
  },
  {
    id: 'chalkboard', who: 'both', name: 'Chalkboard Lecture', emoji: '🧑‍🏫', type: 'argument', rarity: 'common', cost: 1,
    text: (up) => `Deal ${p(up, 5, 8)} damage to ALL enemies.`,
    play: (c, _t, up) => strikeAll(c, v(up, 5, 8)),
  },
  {
    id: 'signal', who: 'both', name: 'Price Signal', emoji: '🚦', type: 'argument', rarity: 'common', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 7, 9)} damage. Apply ${p(up, 1, 2)} Rattled.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 7, 9));
      if (c.enemies[t] && !c.enemies[t].dead) addStatus(c, c.enemies[t], 'rattled', v(up, 1, 2), c.enemies[t].uid);
    },
  },
  {
    id: 'stagflation', name: 'Stagflation Callout', emoji: '📉', type: 'argument', rarity: 'common', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 7, 10)} damage. If the target is Exposed, gain 1 Airtime.`,
    play: (c, t, up) => {
      const wasExposed = !!c.enemies[t]?.status.exposed;
      strike(c, t, v(up, 7, 10));
      if (wasExposed) c.player.energy++;
    },
    flavor: 'The Phillips curve called. It’s lost.',
  },

  // --- Common Rebuttals ---
  {
    id: 'pipe', name: 'Pipe Puff', emoji: '🚬', type: 'rebuttal', rarity: 'common', cost: 0,
    text: (up) => `Gain ${p(up, 3, 5)} Composure. Draw 1 card.`,
    play: (c, _t, up) => {
      gainBlock(c, c.player, v(up, 3, 5), 'player');
      drawCards(c, 1);
    },
  },
  {
    id: 'finish', who: 'both', name: 'Let Me Finish', emoji: '✋', type: 'rebuttal', rarity: 'common', cost: 1, target: true,
    text: (up) => `Gain ${p(up, 7, 10)} Composure. Apply 1 Rattled.`,
    play: (c, t, up) => {
      gainBlock(c, c.player, v(up, 7, 10), 'player');
      if (c.enemies[t] && !c.enemies[t].dead) addStatus(c, c.enemies[t], 'rattled', 1, c.enemies[t].uid);
    },
    flavor: '“Let me finish. Let me finish.”',
  },
  {
    id: 'sources', who: 'both', name: 'Cite Your Sources', emoji: '📚', type: 'rebuttal', rarity: 'common', cost: 1,
    text: (up) => `Draw ${p(up, 3, 4)} cards.`,
    play: (c, _t, up) => drawCards(c, v(up, 3, 4)),
  },
  {
    id: 'floating', name: 'Floating Rates', emoji: '🎈', type: 'rebuttal', rarity: 'common', cost: 1,
    text: (up) => `Gain ${p(up, 7, 10)} Composure. Exhaust every Inflation and Shortage in your hand.`,
    play: (c, _t, up) => {
      gainBlock(c, c.player, v(up, 7, 10), 'player');
      const junk = c.hand.filter((x) => x.id === 'inflation' || x.id === 'shortage');
      c.hand = c.hand.filter((x) => !junk.includes(x));
      c.exhausted.push(...junk);
    },
    flavor: 'Let the market set it. Bretton Woods out.',
  },
  {
    id: 'permanent', name: 'Permanent Income', emoji: '🏦', type: 'rebuttal', rarity: 'common', cost: 1,
    text: (up) => `Gain ${p(up, 5, 7)} Composure now and ${p(up, 5, 7)} next turn.`,
    play: (c, _t, up) => {
      gainBlock(c, c.player, v(up, 5, 7), 'player');
      addStatus(c, c.player, 'savings', v(up, 5, 7), 'player');
    },
    flavor: 'People spend on what they expect to earn.',
  },

  // --- Uncommon ---
  {
    id: 'donahue', name: 'The Donahue Comeback', emoji: '🎤', type: 'argument', rarity: 'uncommon', cost: 2, target: true,
    text: (up) => `Deal ${p(up, 10, 14)} damage. Double if your Credibility is below half.`,
    play: (c, t, up) => {
      const low = c.player.hp * 2 < c.player.maxHp;
      const before = c.flags.mult ?? 1;
      if (low) c.flags.mult = before * 2;
      strike(c, t, v(up, 10, 14));
      c.flags.mult = before;
    },
    flavor: '“Is it really true that political self-interest is nobler?”',
  },
  {
    id: 'statusquo', name: 'Tyranny of the Status Quo', emoji: '🗿', type: 'argument', rarity: 'uncommon', cost: 1, upCost: 0, target: true,
    text: () => 'Deal damage equal to your Composure.',
    play: (c, t) => void strike(c, t, c.player.block),
  },
  {
    id: 'shoeleather', who: 'both', name: 'Shoe-Leather Costs', emoji: '👞', type: 'rebuttal', rarity: 'uncommon', cost: 1, target: true,
    text: (up) => `Apply ${p(up, 2, 3)} Rattled and ${p(up, 2, 3)} Exposed.`,
    play: (c, t, up) => {
      const e = c.enemies[t];
      if (!e || e.dead) return;
      addStatus(c, e, 'rattled', v(up, 2, 3), e.uid);
      addStatus(c, e, 'exposed', v(up, 2, 3), e.uid);
    },
    flavor: 'Inflation wears out your shoes. Literally.',
  },
  {
    id: 'choose', name: 'Free to Choose', emoji: '🗳️', type: 'rebuttal', rarity: 'uncommon', cost: 1, exhaust: true, upExhaust: false,
    text: (up) => `Choose 1 of 3 cards to add to your hand. It costs 0 this turn.${up ? '' : ' Exhaust.'}`,
    play: (c) => {
      c.pending = { kind: 'choose', options: [] };
    },
  },
  {
    id: 'withholding', name: 'Payroll Withholding', emoji: '🧾', type: 'rebuttal', rarity: 'uncommon', cost: 0, exhaust: true,
    text: (up) => `Gain ${p(up, 2, 3)} Airtime. Draw 2 cards. Add a Regret to your deck <b>for good</b>. Exhaust.`,
    play: (c, _t, up) => {
      c.player.energy += v(up, 2, 3);
      drawCards(c, 2);
      c.gained.push({ uid: c.nextUid++, id: 'regret', up: false });
      addCard(c, 'regret', 'discard');
    },
    flavor: 'He helped invent it in 1942. He regretted it.',
  },
  {
    id: 'nit', name: 'Negative Income Tax', emoji: '💸', type: 'rebuttal', rarity: 'uncommon', cost: 1, exhaust: true,
    text: (up) => `Heal ${p(up, 7, 10)} Credibility. Add an Inflation to your discard pile. Exhaust.`,
    play: (c, _t, up) => {
      heal(c, c.player, v(up, 7, 10), 'player');
      addCard(c, 'inflation', 'discard');
    },
    flavor: 'Better than the welfare state. Still a tax.',
  },
  {
    id: 'natural', name: 'Natural Rate', emoji: '🌡️', type: 'rebuttal', rarity: 'uncommon', cost: 1, upCost: 0, exhaust: true,
    text: () => 'Gain 2 Airtime. Exhaust.',
    play: (c) => {
      c.player.energy += 2;
    },
  },
  {
    id: 'chicago', name: 'Chicago School', emoji: '🏫', type: 'principle', rarity: 'uncommon', cost: 1,
    text: (up) => `Gain ${p(up, 2, 3)} Momentum.`,
    play: (c, _t, up) => addStatus(c, c.player, 'momentum', v(up, 2, 3), 'player'),
  },
  {
    id: 'vouchers', name: 'School Vouchers', emoji: '🎒', type: 'principle', rarity: 'uncommon', cost: 1,
    text: (up) => `Whenever you play a Rebuttal, deal ${p(up, 3, 5)} damage to a random enemy.`,
    play: (c, _t, up) => addStatus(c, c.player, 'vouchers', v(up, 3, 5), 'player'),
  },

  // --- Rare ---
  {
    id: 'nobel', name: 'Nobel Lecture', emoji: '🏅', type: 'argument', rarity: 'rare', cost: 3, target: true,
    text: (up) => `Deal ${p(up, 26, 34)} damage.`,
    play: (c, t, up) => void strike(c, t, v(up, 26, 34)),
    flavor: 'Stockholm, 1976. Protesters outside. Facts inside.',
  },
  {
    id: 'capfree', name: 'Capitalism and Freedom', emoji: '🗽', type: 'argument', rarity: 'rare', cost: 2, target: true,
    text: (up) => `Deal ${p(up, 12, 16)} damage. Gain ${p(up, 12, 16)} Composure.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 12, 16));
      gainBlock(c, c.player, v(up, 12, 16), 'player');
    },
  },
  {
    id: 'monetarism', name: 'Monetarism', emoji: '💹', type: 'principle', rarity: 'rare', cost: 3, upCost: 2,
    text: () => 'At the start of each turn, gain 2 Momentum.',
    play: (c) => addStatus(c, c.player, 'monetarism', 2, 'player'),
    flavor: 'Inflation is always and everywhere a monetary phenomenon.',
  },
  {
    id: 'flattax', name: 'Flat Tax', emoji: '📐', type: 'principle', rarity: 'rare', cost: 2,
    text: (up) => `At the end of your turn, deal ${p(up, 5, 7)} damage to ALL enemies.`,
    play: (c, _t, up) => addStatus(c, c.player, 'flatTax', v(up, 5, 7), 'player'),
  },
  {
    id: 'primetime', name: 'Prime Time', emoji: '📺', type: 'principle', rarity: 'rare', cost: 2, upCost: 1,
    text: () => 'Draw 1 more card each turn.',
    play: (c) => addStatus(c, c.player, 'primeTime', 1, 'player'),
    flavor: 'Free to Choose, ten episodes on PBS.',
  },

  // --- David's cards: Protection Agencies, private law, and a little medieval cooking ---
  {
    id: 'theory', who: 'david', name: 'Price Theory', emoji: '📈', type: 'argument', rarity: 'starter', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 6, 9)} damage.`,
    play: (c, t, up) => void strike(c, t, v(up, 6, 9)),
    flavor: 'His textbook. Chapter one: you can’t repeal supply and demand.',
  },
  {
    id: 'insure', who: 'david', name: 'Insurance Policy', emoji: '📑', type: 'rebuttal', rarity: 'starter', cost: 1,
    text: (up) => `Gain ${p(up, 5, 8)} Composure.`,
    play: (c, _t, up) => gainBlock(c, c.player, v(up, 5, 8), 'player'),
  },
  {
    id: 'agency', who: 'david', name: 'Hire a Protection Agency', emoji: '🏢', type: 'rebuttal', rarity: 'starter', cost: 1,
    text: (up) => `Gain ${p(up, 1, 2)} Agency.`,
    play: (c, _t, up) => addStatus(c, c.player, 'agency', v(up, 1, 2), 'player'),
    flavor: 'Your rights, defended on a subscription basis.',
  },
  {
    id: 'iceland', who: 'david', name: 'Medieval Iceland', emoji: '🧊', type: 'argument', rarity: 'starter', cost: 2, target: true,
    text: (up) => `Deal ${p(up, 9, 12)} damage. Gain 1 Agency.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 9, 12));
      addStatus(c, c.player, 'agency', 1, 'player');
    },
    flavor: 'Three centuries of law with no king and no police. He wrote the paper.',
  },
  {
    id: 'competing', who: 'david', name: 'Competing Agencies', emoji: '🚓', type: 'argument', rarity: 'common', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 4, 6)} damage. Gain 1 Agency.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 4, 6));
      addStatus(c, c.player, 'agency', 1, 'player');
    },
  },
  {
    id: 'arbitration', who: 'david', name: 'Private Arbitration', emoji: '⚖️', type: 'rebuttal', rarity: 'common', cost: 1,
    text: (up) => `Apply ${p(up, 1, 2)} Rattled to ALL enemies. Gain 3 Composure.`,
    play: (c, _t, up) => {
      for (const e of alive(c)) addStatus(c, e, 'rattled', v(up, 1, 2), e.uid);
      gainBlock(c, c.player, 3, 'player');
    },
  },
  {
    id: 'tort', who: 'david', name: 'Tort Law', emoji: '📜', type: 'argument', rarity: 'common', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 4, 6)} damage, plus ${p(up, 2, 3)} for each Agency.`,
    play: (c, t, up) => void strike(c, t, v(up, 4, 6) + v(up, 2, 3) * (c.player.status.agency ?? 0)),
  },
  {
    id: 'bounty', who: 'david', name: 'Bounty Hunter', emoji: '🤠', type: 'argument', rarity: 'common', cost: 1,
    text: (up) => `Deal ${p(up, 8, 11)} damage to the enemy with the least Credibility.`,
    play: (c, _t, up) => {
      const weakest = c.enemies.map((e, i) => ({ e, i })).filter(({ e }) => !e.dead).sort((a, b) => a.e.hp - b.e.hp)[0];
      if (weakest) strike(c, weakest.i, v(up, 8, 11));
    },
  },
  {
    id: 'contract', who: 'david', name: 'Signed Contract', emoji: '✍️', type: 'rebuttal', rarity: 'common', cost: 1,
    text: (up) => `Gain ${p(up, 6, 9)} Composure and 1 Momentum.`,
    play: (c, _t, up) => {
      gainBlock(c, c.player, v(up, 6, 9), 'player');
      addStatus(c, c.player, 'momentum', 1, 'player');
    },
  },
  {
    id: 'hidden', who: 'david', name: 'Hidden Order', emoji: '🔍', type: 'rebuttal', rarity: 'common', cost: 0,
    text: (up) => `Draw ${p(up, 1, 2)} card${up ? 's' : ''}. Gain 1 Composure for each Agency.`,
    play: (c, _t, up) => {
      drawCards(c, v(up, 1, 2));
      gainBlock(c, c.player, c.player.status.agency ?? 0, 'player');
    },
    flavor: 'The economics of everyday life. His other book.',
  },
  {
    id: 'lawsorder', who: 'david', name: 'Law’s Order', emoji: '🏛️', type: 'argument', rarity: 'uncommon', cost: 2, target: true,
    text: (up) => `Deal ${p(up, 4, 5)} damage for each Agency (at least ${p(up, 4, 5)}).`,
    play: (c, t, up) => void strike(c, t, v(up, 4, 5) * Math.max(1, c.player.status.agency ?? 0)),
  },
  {
    id: 'takeover', who: 'david', name: 'Hostile Takeover', emoji: '🦈', type: 'argument', rarity: 'uncommon', cost: 1, target: true,
    text: (up) => `Deal ${p(up, 7, 10)} damage. If it knocks them out, gain 2 Agencies.`,
    play: (c, t, up) => {
      const e = c.enemies[t];
      strike(c, t, v(up, 7, 10));
      if (e?.dead) addStatus(c, c.player, 'agency', 2, 'player');
    },
  },
  {
    id: 'defense', who: 'david', name: 'Defense Agency', emoji: '🛡️', type: 'rebuttal', rarity: 'uncommon', cost: 2,
    text: (up) => `Gain ${p(up, 12, 16)} Composure. Gain 1 Agency.`,
    play: (c, _t, up) => {
      gainBlock(c, c.player, v(up, 12, 16), 'player');
      addStatus(c, c.player, 'agency', 1, 'player');
    },
  },
  {
    id: 'cookbook', who: 'david', name: 'Medieval Cookbook', emoji: '🍗', type: 'rebuttal', rarity: 'uncommon', cost: 1, exhaust: true,
    text: (up) => `Heal ${p(up, 6, 9)} Credibility. Gain 1 Momentum. Exhaust.`,
    play: (c, _t, up) => {
      heal(c, c.player, v(up, 6, 9), 'player');
      addStatus(c, c.player, 'momentum', 1, 'player');
    },
    flavor: 'Cariadoc’s recipes, cooked at medieval re-enactments for decades.',
  },
  {
    id: 'thought', who: 'david', name: 'Thought Experiment', emoji: '🧪', type: 'rebuttal', rarity: 'uncommon', cost: 1, exhaust: true, upExhaust: false,
    text: (up) => `Choose 1 of 3 cards to add to your hand. It costs 0 this turn.${up ? '' : ' Exhaust.'}`,
    play: (c) => {
      c.pending = { kind: 'choose', options: [] };
    },
    flavor: 'He has a physics PhD. The universe is a frictionless market.',
  },
  {
    id: 'polycentric', who: 'david', name: 'Polycentric Law', emoji: '🕸️', type: 'principle', rarity: 'uncommon', cost: 1, upCost: 0,
    text: () => 'Whenever you play a Rebuttal, gain 1 Agency.',
    play: (c) => addStatus(c, c.player, 'polycentric', 1, 'player'),
  },
  {
    id: 'machinery', who: 'david', name: 'The Machinery of Freedom', emoji: '⚙️', type: 'principle', rarity: 'rare', cost: 2, upCost: 1,
    text: () => 'At the end of your turn, gain 1 Composure for each Agency.',
    play: (c) => addStatus(c, c.player, 'machinery', 1, 'player'),
    flavor: 'Guide to a radical capitalism. 1973.',
  },
  {
    id: 'marketlaw', who: 'david', name: 'A Market for Law', emoji: '🏪', type: 'principle', rarity: 'rare', cost: 2, upCost: 1,
    text: () => 'At the start of each turn, gain 1 Agency.',
    play: (c) => addStatus(c, c.player, 'marketLaw', 1, 'player'),
  },
  {
    id: 'future', who: 'david', name: 'Future Imperfect', emoji: '🔮', type: 'argument', rarity: 'rare', cost: 3, target: true,
    text: (up) => `Deal ${p(up, 24, 32)} damage. Gain 2 Agencies.`,
    play: (c, t, up) => {
      strike(c, t, v(up, 24, 32));
      addStatus(c, c.player, 'agency', 2, 'player');
    },
    flavor: 'Technology will change the law. He wrote that one in 2008.',
  },

  // --- Status and curse ---
  {
    id: 'inflation', name: 'Inflation', emoji: '🎈', type: 'status', rarity: 'special', cost: null,
    text: () => 'Can’t be played. If it’s in your hand at the end of your turn, lose 2 Credibility.',
    endOfTurn: (c) => {
      loseHp(c, 2);
    },
    flavor: 'Always and everywhere.',
  },
  {
    id: 'shortage', name: 'Shortage', emoji: '🪫', type: 'status', rarity: 'special', cost: 1, exhaust: true,
    text: () => 'Does nothing. Exhaust. (That’s the point.)',
    play: () => {},
    flavor: 'Price controls, as advertised.',
  },
  {
    id: 'regret', name: 'Regret', emoji: '😔', type: 'curse', rarity: 'special', cost: null,
    text: () => 'Can’t be played. If it’s in your hand at the end of your turn, lose 1 Credibility.',
    endOfTurn: (c) => {
      loseHp(c, 1);
    },
    flavor: 'Withholding was supposed to be temporary.',
  },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));
export const cardDef = (id: string) => CARDS[id];

/** Cards that turn up in rewards and shops (everyone's). */
export const POOL = CARD_LIST.filter((c) => c.rarity === 'common' || c.rarity === 'uncommon' || c.rarity === 'rare');

/** The reward pool for one character: his own cards, and the ones they share. */
export const poolFor = (who: 'milton' | 'david') => POOL.filter((c) => (c.who ?? 'milton') === who || c.who === 'both');

export const cardCost = (id: string, up: boolean) => {
  const d = CARDS[id];
  return d.cost === null ? null : up && d.upCost !== undefined ? d.upCost : d.cost;
};
export const cardExhausts = (id: string, up: boolean) => {
  const d = CARDS[id];
  return up && d.upExhaust !== undefined ? d.upExhaust : !!d.exhaust;
};
export const cardName = (id: string, up: boolean) => `${CARDS[id].name}${up ? '+' : ''}`;
export const canUpgrade = (id: string, up: boolean) => !up && CARDS[id].type !== 'status' && CARDS[id].type !== 'curse';

/** Milton's starting deck (CHARACTERS has both). */
export const STARTER_DECK = ['data', 'data', 'data', 'data', 'data', 'calm', 'calm', 'calm', 'calm', 'lunch'];

/** Whether a card needs a target picked now (only if more than one enemy is up). */
export const needsTarget = (c: Combat, id: string) => !!CARDS[id].target && alive(c).length > 1;
