// Single source of truth for the arcade: the homepage cards, the build inputs
// (vite.config.ts) and the redirects from old URLs all come from this list.

export type GameStatus = 'wip' | 'prototype';

export interface Game {
  /** File name in vidya/ (without .html) and URL slug. */
  slug: string;
  title: string;
  blurb: string;
  status: GameStatus;
  /** Old file names under vidya/ that should redirect here. */
  legacyPaths?: string[];
}

export const games: Game[] = [
  {
    slug: 'ancapistan-tycoon',
    title: 'Ancapistan Tycoon',
    blurb: 'Click your way to a stateless paradise. Hide your assets when the Fed shows up.',
    status: 'wip',
    legacyPaths: ['ancapistan_tycoon.html'],
  },
  {
    slug: 'austrian-economics-simulator',
    title: 'Austrian Economics Simulator',
    blurb: 'Steal manhole covers, sell them, and play the heroin and crack markets.',
    status: 'prototype',
    legacyPaths: ['austrian_economics_simulator.html'],
  },
  {
    slug: 'libertarian-fight-club',
    title: 'Libertarian Fight Club',
    blurb: 'Austrian School vs. Chicago School lobsters. Bet your fiat on the winner.',
    status: 'prototype',
    legacyPaths: ['libertarian_fight_club.html'],
  },
  {
    slug: 'eminems-human-action',
    title: "Eminem's Human Action",
    blurb: 'The praxeology rap battle. Throw THE BOOK at money printers before inflation wins.',
    status: 'prototype',
    legacyPaths: ["Eminem's Human Action - Econ Defender.html"],
  },
  {
    slug: 'kindergarten-property-defender',
    title: 'Kindergarten Property Defender',
    blurb: 'The teacher wants to redistribute your blocks. Slap the socialist hands away.',
    status: 'prototype',
    legacyPaths: ['Kindergarten Property Defender.html'],
  },
  {
    slug: 'road-to-liberty',
    title: 'The Road to Liberty',
    blurb: 'Dodge the taxes, collect the gold, and try not to get TAXED.',
    status: 'prototype',
    legacyPaths: ['The Road to Liberty.html'],
  },
  {
    slug: 'basic-economics-trainer',
    title: 'Basic Economics Trainer',
    blurb: 'Here, take this. Maybe it’ll help you stop being dumb.',
    status: 'prototype',
    legacyPaths: ['Basic Economics Trainer.html'],
  },
  {
    slug: 'just-getting-started',
    title: 'JUST GETTING STARTED 😈',
    blurb: 'Late stage capitalism? Nah. Acquisitions & exploits, one click at a time.',
    status: 'prototype',
    legacyPaths: ['JUST GETTING STARTED 😈.html'],
  },
];
