// The news ticker: absurd headlines that change as you progress.

import { formatMoney } from '../../shared/format.ts';
import type { EventId } from './data.ts';

/** What headlines can react to. Built from the game state in main.ts. */
export interface NewsContext {
  allTimeEarnings: number;
  incomePerSec: number;
  owned: (upgradeId: number) => number;
  cities: number;
  charters: number;
  stickers: number;
  secessions: number;
  raidsEvaded: number;
  goldenClicks: number;
  clicks: number;
  /** Seasonal events running today. */
  events: readonly EventId[];
}

export interface Headline {
  /** Plain text, or a function for headlines with live numbers. */
  text: string | ((c: NewsContext) => string);
  /** Only shown when this returns true. Always eligible when missing. */
  when?: (c: NewsContext) => boolean;
}

const money = (n: number) => `$${formatMoney(n)}`;

export const HEADLINES: readonly Headline[] = [
  // Always on
  { text: 'Local man discovers taxation is theft, immediately tells everyone at Thanksgiving.' },
  { text: 'Study finds 9 out of 10 libertarians would privatize the other one.' },
  { text: 'Man explains Austrian business cycle theory to date; date leaves, business cycle continues.' },
  { text: 'Breaking: "What about the roads?" asked for the 40 billionth time. Roads still unbuilt by asker.' },
  { text: 'Central bank announces new 2% inflation target, then adds a zero "for safety".' },
  { text: 'Area porcupine mascot denies being a hedgehog. "I have a property in quills."' },
  { text: 'Minarchist and anarchist debate for 11 hours over whether to keep the courts. Coffee shop closes around them.' },
  { text: "Economist predicts nine of the last two recessions, gets tenure." },
  { text: 'Government task force formed to investigate excess of government task forces.' },
  { text: 'Local DMV wait time now measured in geological epochs.' },
  { text: 'Gadsden flag sales soar; snakes everywhere report feeling "seen".' },
  { text: 'New poll: 100% of people who read Human Action finished it. Sample size: 3.' },
  { text: 'Fiat currency declares itself a collectible. Collectors politely decline.' },
  { text: '¡AFUERA! Ministry of Ministries abolished; no one notices for six weeks.' },
  { text: 'Black-market exchange rate beats official rate in popularity contest, refuses to concede.' },
  { text: 'Man who said "who will build the roads" spotted building a road. Charges toll.' },

  // Christmas event
  { text: 'North Pole secedes. Santa\'s workshop declared a Free Private City; elves sign voluntary contracts.', when: (c) => c.events.includes('christmas') },
  { text: 'Naughty list leaked: 100% government employees. "Coincidence," says spokesperson.', when: (c) => c.events.includes('christmas') },
  { text: 'Reindeer refuse FAA flight plan, cite natural rights. Sleigh departs on schedule anyway.', when: (c) => c.events.includes('christmas') },
  { text: 'Local family\'s gift exchange praised as "the purest free market in the country."', when: (c) => c.events.includes('christmas') },
  { text: 'Grinch nominated for Treasury Secretary. Confirmation hearings "a formality."', when: (c) => c.events.includes('christmas') },
  { text: 'Fed celebrates its birthday by printing itself a cake. Cake now worth 3% less.', when: (c) => c.events.includes('fed-birthday') },
  { text: 'Woodrow Wilson\'s ghost spotted at Fed birthday party, asks for "just one more" war.', when: (c) => c.events.includes('fed-birthday') },

  // Early game
  { text: 'Health inspector issues 14 citations to child\'s lemonade stand. Child issues 15.', when: (c) => c.owned(2) >= 1 },
  { text: 'Unlicensed lemonade stands now outnumber licensed ones 40 to 1. "The free market is sour," says regulator.', when: (c) => c.owned(2) >= 10 },
  { text: 'Local bookstore sells out of Rothbard. Owner considers "doing that capitalism thing" again.', when: (c) => c.owned(1) >= 5 },
  { text: 'Neighborhood suddenly very polite. Coincidence, say AK-47 owners.', when: (c) => c.owned(3) >= 1 },
  { text: 'FDA raids raw milk ring, finds only cows and a strongly worded copy of the Constitution.', when: (c) => c.owned(4) >= 1 },
  { text: (c) => `Local entrepreneur crosses ${money(c.allTimeEarnings)} in voluntary transactions. IRS "very interested".`, when: (c) => c.allTimeEarnings >= 1e4 },

  // Mid game
  { text: 'John Locke\'s ghost files homesteading claim on empty lot, cites "mixed ectoplasm with soil".', when: (c) => c.owned(5) >= 1 },
  { text: 'Crypto farm in undisclosed location mines block, also mines actual gold "just in case".', when: (c) => c.owned(6) >= 1 },
  { text: 'Toll road opens. Potholes now billed separately as "premium suspension testing".', when: (c) => c.owned(8) >= 1 },
  { text: 'PMC hired to enforce the NAP clarifies it will not be enforcing your HOA rules.', when: (c) => c.owned(9) >= 1 },
  { text: 'Seastead declares independence from ocean. Ocean unavailable for comment.', when: (c) => c.owned(10) >= 1 },
  { text: 'Fed chair "deeply concerned" about local tycoon. Prints money to feel better.', when: (c) => c.raidsEvaded >= 1 },
  { text: (c) => `Tycoon dodges Fed audit for the ${c.raidsEvaded}${ordinal(c.raidsEvaded)} time. "I simply hid the assets," they explain.`, when: (c) => c.raidsEvaded >= 3 },
  { text: (c) => `Clicking now a recognized sport. Local champion at ${c.clicks.toLocaleString()} clicks and counting.`, when: (c) => c.clicks >= 1000 },
  { text: 'Golden stickers spotted falling from the sky. Gold bugs say "told you so" in unison.', when: (c) => c.goldenClicks >= 1 },
  { text: (c) => `Laptop lid covered in ${c.stickers} stickers achieves sentience, demands property rights.`, when: (c) => c.stickers >= 15 },
  { text: (c) => `Tycoon now earning ${money(c.incomePerSec)} per second while asleep. Sleep reclassified as "labor".`, when: (c) => c.incomePerSec >= 1000 },

  // Late game
  { text: 'Moon homesteaded. NASA asks if it can still visit; told to "make an offer".', when: (c) => c.owned(12) >= 1 },
  { text: 'War on Drugs suspended in zero gravity after DEA agents float away.', when: (c) => c.owned(13) >= 1 },
  { text: 'Solar system privatized. Pluto finally recognized as a planet, by its new owner.', when: (c) => c.owned(14) >= 1 },
  { text: 'Orbital railgun fires warning shot at tax collector. Tax collector reclassified as "space debris".', when: (c) => c.owned(15) >= 1 },
  { text: 'Asteroid mining crashes gold price. Gold bugs suffer collective identity crisis.', when: (c) => c.owned(16) >= 1 },
  { text: 'Covenant community reports zero communists. Physical removal service "fully booked".', when: (c) => c.owned(17) >= 1 },
  { text: 'Sun now behind a paywall. Free trial available for plants.', when: (c) => c.owned(18) >= 1 },
  { text: 'Local tycoon\'s time preference so low they started saving for the heat death of the universe.', when: (c) => c.owned(19) >= 1 },
  { text: 'Andromeda galaxy homesteaded. Milky Way residents complain about "the new neighbors".', when: (c) => c.owned(22) >= 1 },

  // Prestige
  { text: 'Breaking: tycoon secedes, founds Free Private City. Previous country "didn\'t even notice they left".', when: (c) => c.secessions >= 1 },
  { text: (c) => `Network state grows to ${c.cities} Free Private Cities. UN holds emergency meeting, nobody attends.`, when: (c) => c.cities >= 3 },
  { text: 'Free Private City adopts constitution. It\'s one page long. Page is blank.', when: (c) => c.charters >= 1 },
  { text: 'Political scientists baffled as yet another city chooses "no, thanks" as its form of government.', when: (c) => c.cities >= 10 },
  { text: 'Tycoon has seceded so many times their passport is just a list of former countries.', when: (c) => c.secessions >= 5 },
];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

export function headlineText(h: Headline, c: NewsContext): string {
  return typeof h.text === 'function' ? h.text(c) : h.text;
}

/** Headlines that can be shown right now. */
export function eligibleHeadlines(c: NewsContext): Headline[] {
  return HEADLINES.filter((h) => !h.when || h.when(c));
}

/**
 * Picks the next headline, avoiding the recently shown ones. `recent` holds
 * indexes into HEADLINES and is updated in place. `roll` is a random number in [0, 1).
 */
export function pickHeadline(c: NewsContext, recent: number[], roll: number, memory = 8): string {
  const eligible = HEADLINES.map((h, i) => [h, i] as const).filter(([h]) => !h.when || h.when(c));
  const fresh = eligible.filter(([, i]) => !recent.includes(i));
  const pool = fresh.length ? fresh : eligible;
  const [h, i] = pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
  recent.push(i);
  while (recent.length > Math.min(memory, Math.max(0, eligible.length - 1))) recent.shift();
  return headlineText(h, c);
}
