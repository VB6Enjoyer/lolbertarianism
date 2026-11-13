// The ring announcer: an introduction for every bout, and a call for every winner.

import { factionById, type FactionId, type Lobster, type TraitId } from './lobsters.ts';
import type { Ending } from './fight.ts';

const TAGLINES: Record<FactionId, readonly string[]> = {
  ancap: ['the Ancap who believes the roads will build themselves', 'the Ancap who has never met a tax it didn’t call theft', 'the Ancap with a private court for every occasion'],
  minarchist: ['the Minarchist who wants just a little bit of state. Just a tiny one', 'the Minarchist, defender of the night-watchman', 'the Minarchist with the Constitution tattooed on its tail'],
  austrian: ['the Austrian who has read Human Action. Twice. Out loud', 'the praxeologist from Vienna', 'the Austrian who predicted twelve of the last three recessions'],
  chicago: ['the Chicago School lobster who has a regression for that', 'Milton’s favourite crustacean', 'the Chicago School lobster who will show you the data'],
  objectivist: ['the Objectivist, hero of its own 1,100-page novel', 'the Objectivist. A is A, and it is here to win', 'the Objectivist, whose altruism is strictly zero'],
  georgist: ['the Georgist who would like a word about your land value', 'the Georgist, taxing the unimproved since 1879', 'the Georgist who thinks you’re sitting on its rent'],
  agorist: ['the Agorist who doesn’t have a receipt for any of this', 'the Agorist, straight from the counter-economy', 'the Agorist who paid its entry fee in Monero'],
  hoppean: ['the Hoppean, here for some physical removal', 'the Hoppean with a covenant community you’re not in', 'the Hoppean who arrived by helicopter'],
  'bleeding-heart': ['the Bleeding-Heart who cares about your feelings, and also free markets', 'the Bleeding-Heart with a market solution and a hug', 'the Bleeding-Heart who thinks it’s more nuanced than that'],
  'mises-caucus': ['the Mises Caucus lobster who took over the party and wants this ring next', 'the Mises Caucus lobster who posts in all caps', 'the Mises Caucus lobster who memes harder than it debates'],
};

const TRAIT_LINES: Partial<Record<TraitId, string>> = {
  coward: 'known to run at the first sign of a counterargument',
  'glass-shell': 'with a shell as thin as a campaign promise',
  comeback: 'never more dangerous than when it’s losing',
  hungry: 'hungry, and not just for liberty',
  molting: 'soft-shelled tonight, and a little self-conscious about it',
  lazy: 'who would honestly rather be reading',
  debater: 'champion of the high-school debate circuit',
  'pre-cooked': 'looking suspiciously steamed',
  'crowd-favorite': 'the people’s champion',
};

const VENUE_LINES: Record<string, string> = {
  kitchen: 'Ladies, gentlemen and sovereign individuals, welcome to the kitchen floor!',
  garage: 'Welcome to the Garage, where the only regulation is the fire extinguisher!',
  porcfest: 'Good evening, PorcFest! Please keep your firearms holstered during the bout!',
  convention: 'Delegates! Put down your points of order! It’s fight night at the Convention!',
  liberland: 'Live from the banks of the Danube, on the only unclaimed land in Europe: the Liberland Championship!',
};

const pick = <T>(list: readonly T[], rng: () => number) => list[Math.floor(rng() * list.length)];

function record(l: Lobster) {
  if (l.wins + l.losses === 0) return 'making its debut tonight';
  const streak = l.form.slice(-3);
  if (l.losses === 0 && l.wins >= 3) return `UNDEFEATED at ${l.wins} and 0`;
  if (streak.length === 3 && streak.every((r) => r === 'L')) return `${l.wins} and ${l.losses}, and it hasn’t won since the gold standard`;
  if (streak.length === 3 && streak.every((r) => r === 'W')) return `${l.wins} and ${l.losses}, and riding a hot streak`;
  return `with a record of ${l.wins} and ${l.losses}`;
}

export interface Intro {
  /** The venue's welcome (first bout of the night only), then each corner. */
  lines: string[];
}

/** The announcer's intro for a bout. `mine` is set when your own lobster is in the red corner. */
export function introduce(lobsters: readonly [Lobster, Lobster], venue: string, firstOfNight: boolean, mine: boolean, rng: () => number): Intro {
  const lines: string[] = [];
  if (firstOfNight && VENUE_LINES[venue]) lines.push(VENUE_LINES[venue]);
  lobsters.forEach((l, side) => {
    const corner = side === 0 ? 'In the red corner' : 'And in the blue corner';
    const trait = l.traitKnown ? TRAIT_LINES[l.trait] : undefined;
    const who = mine && side === 0 ? `your very own ${factionById(l.faction).name}` : pick(TAGLINES[l.faction], rng);
    lines.push(`${corner}, weighing in at ${l.weight} pounds, ${record(l)}${trait ? `, ${trait}` : ''}: ${who}… ${l.name.toUpperCase()}!`);
  });
  return { lines };
}

/** The call at the end. */
export function callWinner(winner: Lobster, ending: Ending, round: number): string {
  if (ending === 'ko') return `It’s all over in round ${round}! Your winner, by knockout: ${winner.name.toUpperCase()}!`;
  if (ending === 'flee') return `The other one has left the building! Your winner, by exit over voice: ${winner.name.toUpperCase()}!`;
  return `After three rounds, the judges have decided. Your winner: ${winner.name.toUpperCase()}!`;
}

