// Liberty FM 101.1: the playlist on the dashboard radio. Add songs freely.

export interface Song {
  artist: string;
  title: string;
}

export const PLAYLIST: readonly Song[] = [
  { artist: 'The Ancaps', title: 'End the Fed' },
  { artist: 'Fiat Funeral', title: 'Worthless Paper' },
  { artist: 'DJ Prax', title: 'Subjective Value (Zulu Remix)' },
  { artist: 'Auburn Most Wanted', title: 'Streiht Up Mises' },
  { artist: 'N.A.P', title: 'Straight Outta Covenant' },
  { artist: "Lil' Hans", title: 'So to Speak' },
  { artist: 'Yung Agora', title: 'Lemonade (Unlicenzd!)' },
  { artist: 'A$AP Rockwell', title: 'Praise the Roth' },
  { artist: 'Notorious N.A.P.', title: 'Mo Printing Mo Inflation' },
  { artist: 'Megadebt', title: 'Addicted to Emission' },
  { artist: 'Draft Punk', title: 'Around the Middle East' },
  { artist: 'Taxing Alexandria', title: 'I Was Once, Possibly, Maybe, Perhaps a Minarchist' },
  { artist: 'Devalued Sevenfold', title: 'A Little Debt and Default' },
  { artist: 'Bob Murphy & The Bailouts', title: 'So Much Fiat in the World' },
  { artist: 'Walterhead', title: 'Watching the Boats with Ayn Rand' },
  { artist: 'Bullet for my Central Bank', title: "Bonds Don't Fall" },
  { artist: 'Coaltar of the Hoppeans', title: 'Evil Commie' },
  { artist: 'Credence Blackwater Revival', title: 'Long As I Can Bomb Iraq' },
  { artist: 'Evicted Fetus', title: 'Subjected to a Bidding' },
  { artist: 'Eclectic Rand Orchestra', title: 'Four Little Randroids' },
  { artist: 'Lamb of Hoppe', title: "Now You've Got Something to Argue For" },
  { artist: 'NOFOREX', title: 'The Separation of Cash and State' },
];

/** Seconds each song stays on before the next one. */
export const SONG_SECONDS = 25;

/**
 * A shuffled play order (every song once before any repeats), from a
 * random-number function returning [0, 1).
 */
export function shuffledOrder(rng: () => number = Math.random): number[] {
  const order = PLAYLIST.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export const songLabel = (song: Song) => `${song.artist} - ${song.title}`;
