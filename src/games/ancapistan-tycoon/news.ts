// The news ticker: absurd headlines that change as you progress.

import { formatMoney } from '../../shared/format.ts';
import type { ChallengeId, EventId } from './data.ts';

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
  raidsLost: number;
  /** Name of the most recently founded city, if any. */
  newestCity: string | null;
  challengesWon: readonly ChallengeId[];
  /** Seasonal events running today. */
  events: readonly EventId[];
  /** Keys of headlines unlocked before (see headlineKey). They stay in rotation for good. */
  unlocked: readonly string[];
}

export interface Headline {
  /** Needed to remember an `unlock` headline whose text is a function. */
  id?: string;
  /** Plain text, or a function for headlines with live numbers. */
  text: string | ((c: NewsContext) => string);
  /** Shown only while this is true (seasonal events). */
  when?: (c: NewsContext) => boolean;
  /** Joins the rotation the first time this is true, and stays for good (saved), even after seceding. */
  unlock?: (c: NewsContext) => boolean;
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
  { text: "Government announces deregulation initiative; creates 17 new regulatory agencies to oversee it." },
  { text: "Local bureaucrat discovers private sector; immediately requests a transfer." },
  { text: "Ministry of Transparency refuses to disclose its budget. Cites transparency concerns." },
  { text: "Politician promises smaller government; accidentally announces a new ministry to oversee the process." },
  { text: "Government launches anti-corruption campaign. First arrest: campaign's accountant." },
  { text: "Government announces it has successfully reduced unemployment by hiring 400 statisticians to redefine employment." },
  { text: "Taxpayer asks where his money went. Government responds with 800-page report, available for purchase." },
  { text: "Man discovers opportunity cost; immediately regrets breakfast." },
  { text: "Local economist refuses to answer hypothetical question about a hypothetical island with 2,000 coconuts." },
  { text: "Austrian economist predicts fiat collapse. Fiat currency announces it has never heard of Austria." },
  { text: "Gold standard enthusiast refuses to elaborate, leaves gold bar on table." },
  { text: "Market participants surprised to discover they have been participating in a market." },
  { text: "Economist explains subjective value theory; audience unanimously agrees his lecture was worthless." },
  { text: "Local entrepreneur raises prices by 300%. Customers discover they actually wanted something else." },
  { text: "Supply shock reported at local supermarket. Demand responds by going somewhere else." },
  { text: "Man discovers sunk cost fallacy, refuses to stop arguing about it." },
  { text: "Central bank introduces quantitative easing. Printer manufacturer reports record quarterly profits." },
  { text: "Local Hoppean declares democracy incompatible with freedom. Community votes to ban him." },
  { text: "Minarchist claims state can be limited. State issues statement calling this \"a charming proposal.\"" },
  { text: "Two anarchists establish private court to settle dispute over whether private courts should exist." },
  { text: "Local ancap refuses to recognize government's authority. Government refuses to recognize local ancap's existence." },
  { text: "Anarchist community establishes constitution. Nobody agrees on whether it's binding." },
  { text: "Minarchist and anarchist agree on everything except the part where they agree on everything." },
  { text: "Hoppean community introduces hereditary membership system. Founding member's son announces himself as Supreme Chairman." },
  { text: "Bitcoin reaches new all-time high. Local economist still waiting for his 2013 transaction to confirm." },
  { text: "Cryptocurrency project announces revolutionary new consensus mechanism: asking everyone nicely." },
  { text: "Local man discovers public choice theory. Immediately suspects everyone." },
  { text: "Man attempts to abolish the state. Accidentally establishes a committee." },
  { text: "Town introduces voluntary taxation. Revenue exceeds previous year's compulsory taxation by 0.03%." },
  { text: "Government announces successful war on poverty. Poverty refuses to surrender." },
  { text: "Ancapistan officially recognizes no government. Government of Ancapistan issues statement condemning the decision." },

  // Christmas event
  { text: 'North Pole secedes. Santa\'s workshop declared a Free Private City; elves sign voluntary contracts.', when: (c) => c.events.includes('christmas') },
  { text: 'Naughty list leaked: 100% government employees. "Coincidence," says spokesperson.', when: (c) => c.events.includes('christmas') },
  { text: 'Reindeer refuse FAA flight plan, cite natural rights. Sleigh departs on schedule anyway.', when: (c) => c.events.includes('christmas') },
  { text: 'Local family\'s gift exchange praised as "the purest free market in the country."', when: (c) => c.events.includes('christmas') },
  { text: 'Grinch nominated for Treasury Secretary. Confirmation hearings "a formality."', when: (c) => c.events.includes('christmas') },
  { text: 'Fed celebrates its birthday by printing itself a cake. Cake now worth 3% less.', when: (c) => c.events.includes('fed-birthday') },
  { text: 'Woodrow Wilson\'s ghost spotted at Fed birthday party, asks for "just one more" war.', when: (c) => c.events.includes('fed-birthday') },

  // Birthdays and anniversaries
  { text: 'Carl Menger turns another year older. Value of his birthday cake: subjective.', when: (c) => c.events.includes('birthday-menger') },
  { text: "Mr. Libertarian's birthday: party held without permits, cake homesteaded on arrival.", when: (c) => c.events.includes('birthday-rothbard') },
  { text: "Hayek's birthday party organized by spontaneous order. No planner, somehow still great.", when: (c) => c.events.includes('birthday-hayek') },
  { text: "Bastiat's birthday: candlemakers petition to ban the sun during the celebration.", when: (c) => c.events.includes('birthday-bastiat') },
  { text: "Ron Paul's birthday: crowd chants \"It's happening!\" Nobody is sure what, but it is.", when: (c) => c.events.includes('birthday-ronpaul') },
  { text: "Hoppe's birthday party enforces a strict covenant. Communists remain outside, eating no cake.", when: (c) => c.events.includes('birthday-hoppe') },
  { text: 'Mises Day: economists everywhere attempt economic calculation of the cake. Only the market succeeds.', when: (c) => c.events.includes('birthday-mises') },
  { text: 'Bitcoin turns another year older. Bankers still on brink of next bailout.', when: (c) => c.events.includes('bitcoin-genesis') },
  { text: "Liberland celebrates its founding. Croatia's border police celebrate by not noticing.", when: (c) => c.events.includes('liberland-day') },
  { text: 'Pizza Day: local man orders two pizzas, pays in sats, feels a strange sense of dread.', when: (c) => c.events.includes('pizza-day') },
  { text: 'Nixon Shock anniversary: the "temporary" closure of the gold window turns another year old.', when: (c) => c.events.includes('nixon-shock') },

  // Early game
  { text: 'Health inspector issues 14 citations to child\'s lemonade stand. Child issues 15.', unlock: (c) => c.owned(2) >= 1 },
  { text: 'Unlicensed lemonade stands now outnumber licensed ones 40 to 1. "The free market is sour," says regulator.', unlock: (c) => c.owned(2) >= 10 },
  { text: 'Local bookstore sells out of Rothbard. Owner considers "doing that capitalism thing" again.', unlock: (c) => c.owned(1) >= 5 },
  { text: 'Neighborhood suddenly very polite. Coincidence, say AK-47 owners.', unlock: (c) => c.owned(3) >= 1 },
  { text: 'FDA raids raw milk ring, finds only cows and a strongly worded copy of the Constitution.', unlock: (c) => c.owned(4) >= 1 },
  { id: 'earnings', text: (c) => `Local entrepreneur crosses ${money(c.allTimeEarnings)} in voluntary transactions. IRS "very interested".`, unlock: (c) => c.allTimeEarnings >= 1e4 },

  // Mid game
  { text: 'John Locke\'s ghost files homesteading claim on empty lot, cites "mixed ectoplasm with soil".', unlock: (c) => c.owned(5) >= 1 },
  { text: 'Crypto farm in undisclosed location mines block, also mines actual gold "just in case".', unlock: (c) => c.owned(6) >= 1 },
  { text: "Adam Smith's invisible hand spotted giving the Fed the invisible finger.", unlock: (c) => c.owned(7) >= 1 },
  { text: 'Toll road opens. Potholes now billed separately as "premium suspension testing".', unlock: (c) => c.owned(8) >= 1 },
  { text: 'PMC hired to enforce the NAP clarifies it will not be enforcing your HOA rules.', unlock: (c) => c.owned(9) >= 1 },
  { text: 'Seastead declares independence from ocean. Ocean unavailable for comment.', unlock: (c) => c.owned(10) >= 1 },
  { text: 'Fed seizes local tycoon\'s lemonade stand "for the public good." Public reports no good received.', unlock: (c) => c.raidsLost >= 1 },
  { text: 'Fed chair "deeply concerned" about local tycoon. Prints money to feel better.', unlock: (c) => c.raidsEvaded >= 1 },
  { id: 'audits', text: (c) => `Tycoon dodges Fed audit for the ${c.raidsEvaded}${ordinal(c.raidsEvaded)} time. "I simply hid the assets," they explain.`, unlock: (c) => c.raidsEvaded >= 3 },
  { id: 'clicking-sport', text: (c) => `Clicking now a recognized sport. Local champion at ${c.clicks.toLocaleString()} clicks and counting.`, unlock: (c) => c.clicks >= 1000 },
  { text: 'Golden stickers spotted falling from the sky. Gold bugs say "told you so" in unison.', unlock: (c) => c.goldenClicks >= 1 },
  { id: 'laptop-lid', text: (c) => `Laptop lid covered in ${c.stickers} stickers achieves sentience, demands property rights.`, unlock: (c) => c.stickers >= 15 },
  { id: 'sleep-labor', text: (c) => `Tycoon now earning ${money(c.incomePerSec)} per second while asleep. Sleep reclassified as "labor".`, unlock: (c) => c.incomePerSec >= 1000 },

  // Late game
  { text: 'Recreational McNuke owner insists it\'s "purely for homestead defense, and fireworks."', unlock: (c) => c.owned(11) >= 1 },
  { text: 'Moon homesteaded. NASA asks if it can still visit; told to "make an offer".', unlock: (c) => c.owned(12) >= 1 },
  { text: 'War on Drugs suspended in zero gravity after DEA agents float away.', unlock: (c) => c.owned(13) >= 1 },
  { text: 'Solar system privatized. Pluto finally recognized as a planet, by its new owner.', unlock: (c) => c.owned(14) >= 1 },
  { text: 'Orbital railgun fires warning shot at tax collector. Tax collector reclassified as "space debris".', unlock: (c) => c.owned(15) >= 1 },
  { text: 'Asteroid mining crashes gold price. Gold bugs suffer collective identity crisis.', unlock: (c) => c.owned(16) >= 1 },
  { text: 'Covenant community reports zero communists. Physical removal service "fully booked".', unlock: (c) => c.owned(17) >= 1 },
  { text: 'Sun now behind a paywall. Free trial available for plants.', unlock: (c) => c.owned(18) >= 1 },
  { text: 'Local tycoon\'s time preference so low they started saving for the heat death of the universe.', unlock: (c) => c.owned(19) >= 1 },
  { text: "Tycoon buys low in a universe where the Fed exists, sells high in one where it doesn't.", unlock: (c) => c.owned(21) >= 1 },
  { text: 'Andromeda galaxy homesteaded. Milky Way residents complain about "the new neighbors".', unlock: (c) => c.owned(22) >= 1 },

  // Prestige
  { text: 'Breaking: tycoon secedes, founds Free Private City. Previous country "didn\'t even notice they left".', unlock: (c) => c.secessions >= 1 },
  { id: 'network-state', text: (c) => `Network state grows to ${c.cities} Free Private Cities. UN holds emergency meeting, nobody attends.`, unlock: (c) => c.cities >= 3 },
  { text: 'Free Private City adopts constitution. It\'s one page long. Page is blank.', unlock: (c) => c.charters >= 1 },
  { text: 'Political scientists baffled as yet another city chooses "no, thanks" as its form of government.', unlock: (c) => c.cities >= 10 },
  { id: 'newest-city', text: (c) => `"${c.newestCity}" tops the list of fastest-growing cities. Its top export: people leaving other countries.`, unlock: (c) => !!c.newestCity },
  { text: 'Tycoon survives a communist planned economy, emerges with only three stories about the bread lines.', unlock: (c) => c.challengesWon.includes('communism') },
  { text: 'Tycoon has seceded so many times their passport is just a list of former countries.', unlock: (c) => c.secessions >= 5 },
];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

export function headlineText(h: Headline, c: NewsContext): string {
  return typeof h.text === 'function' ? h.text(c) : h.text;
}

/** How an unlockable headline is remembered in saves: its id, or its text. */
export const headlineKey = (h: Headline) => h.id ?? (typeof h.text === 'string' ? h.text : '');

const isEligible = (h: Headline, c: NewsContext) =>
  (!h.when || h.when(c)) && (!h.unlock || c.unlocked.includes(headlineKey(h)) || h.unlock(c));

/** Headlines that can be shown right now. */
export function eligibleHeadlines(c: NewsContext): Headline[] {
  return HEADLINES.filter((h) => isEligible(h, c));
}

/** Keys of unlockable headlines whose condition is met now but weren't unlocked before. */
export function newlyUnlockedHeadlines(c: NewsContext): string[] {
  return HEADLINES.filter((h) => h.unlock && !c.unlocked.includes(headlineKey(h)) && h.unlock(c)).map(headlineKey);
}

/**
 * Picks the next headline, avoiding the recently shown ones. `recent` holds
 * indexes into HEADLINES and is updated in place. `roll` is a random number in [0, 1).
 */
export function pickHeadline(c: NewsContext, recent: number[], roll: number, memory = 8): string {
  const eligible = HEADLINES.map((h, i) => [h, i] as const).filter(([h]) => isEligible(h, c));
  const fresh = eligible.filter(([, i]) => !recent.includes(i));
  const pool = fresh.length ? fresh : eligible;
  const [h, i] = pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
  recent.push(i);
  while (recent.length > Math.min(memory, Math.max(0, eligible.length - 1))) recent.shift();
  return headlineText(h, c);
}
