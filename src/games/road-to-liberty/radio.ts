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

// ---------------------------------------------------------------------------
// Between songs: talk segments and ads
// ---------------------------------------------------------------------------

export const TALK: readonly string[] = [
  'The Rothbard Call-In Show: "Caller from Zug, you\'re on the air."',
  'Call-in: "Is it theft if the State does it?" Rothbard: "Especially then."',
  'Hoppe Hour: why your landlord is a better ruler than your senator.',
  'The Mises Minute: prices are information. Inflation is lying.',
  'Traffic: IRS checkpoint backing up the left lane. Take the right, and keep going.',
  'Weather: 100% chance of currency debasement, clearing up never.',
  'Sports: Austrian School 3, Keynesians 0. The Keynesians demand a stimulus.',
  'News: the Fed announces it will print its way out of printing.',
  'Dear Ayn: "My husband wants to share the car." Ayn: "Divorce him."',
  'Crypto report: up, down, up. HODL, caller. HODL.',
  'Lysander Spooner Book Club: this week, "No Treason". Bring your own Constitution to burn.',
  'Late-night call-in: "Who will build the roads?" *dial tone*',
];

export const ADS: readonly string[] = [
  'Gold. Because the Fed said so.',
  'Galt Motors: the car that drives itself away from taxes.',
  'Tired of permits? Try Nothing™. No paperwork required.',
  'Hoppe Home Security: physically removing intruders since 2001.',
  'Seasteading Realty: oceanfront property, zero zoning.',
  'Private Roads Inc.: our potholes are optional. Our tolls are voluntary.',
  "Dr. Mises' Sound Money Tonic: cures inflation, malaise and Keynesianism.",
  'Agorist Lemonade: unlicensed, untaxed and delicious.',
  'Free Market Garage: no permits required. Ask about our Bull Bar.',
  'Bastiat Glass Repair: we never break your windows to make work.',
];

export type Broadcast = { kind: 'song'; song: Song } | { kind: 'talk' | 'ad'; text: string };

/** Seconds a talk segment or ad stays on. */
export const SEGMENT_SECONDS = 14;
/** Songs between segments. */
export const SONGS_PER_BREAK = 2;

/**
 * One pass of the station's program: every song once, shuffled, with a break
 * after every two that alternates between a talk segment and an ad.
 */
export function buildProgram(rng: () => number = Math.random): Broadcast[] {
  const shuffle = (n: number) => {
    const order = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  const songs = shuffledOrder(rng);
  const talk = shuffle(TALK.length);
  const ads = shuffle(ADS.length);
  const program: Broadcast[] = [];
  let breaks = 0;
  songs.forEach((index, i) => {
    program.push({ kind: 'song', song: PLAYLIST[index] });
    if ((i + 1) % SONGS_PER_BREAK !== 0) return;
    const n = Math.floor(breaks / 2);
    program.push(breaks % 2 === 0 ? { kind: 'talk', text: TALK[talk[n % talk.length]] } : { kind: 'ad', text: ADS[ads[n % ads.length]] });
    breaks++;
  });
  return program;
}

/** What the radio display shows. */
export function broadcastLabel(b: Broadcast): string {
  if (b.kind === 'song') return `♪ ${songLabel(b.song)}`;
  return b.kind === 'talk' ? `🎙️ ON AIR · ${b.text}` : `📢 AD · ${b.text}`;
}

export const broadcastSeconds = (b: Broadcast) => (b.kind === 'song' ? SONG_SECONDS : SEGMENT_SECONDS);
