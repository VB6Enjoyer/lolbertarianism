// TV appearances (the map's ❓ stops): a scene, a few choices, and what each one does to the run.

export interface EventChoice {
  label: string;
  /** Shown under the label: what it costs and gives. */
  detail: string;
  /** Effects, applied by run.ts. */
  effects: Effect[];
  /** What happens, shown after you pick. */
  result: string;
  /** Only offered if you can afford it. */
  needs?: { royalties?: number; hp?: number };
}

export type Effect =
  | { kind: 'hp'; amount: number }
  | { kind: 'maxHp'; amount: number }
  | { kind: 'royalties'; amount: number }
  | { kind: 'card'; id: string; up?: boolean }
  | { kind: 'randomCard'; rarity: 'common' | 'uncommon' | 'rare' }
  | { kind: 'relic'; id?: string }
  | { kind: 'upgradeRandom'; count: number }
  | { kind: 'removeRandom'; id?: string }
  | { kind: 'based'; amount: number };

export interface TvEvent {
  id: string;
  title: string;
  emoji: string;
  /** A picture from public/vidya/img (without .webp), if there is one. */
  image?: string;
  text: string;
  choices: EventChoice[];
}

export const EVENTS: TvEvent[] = [
  {
    id: 'donahue',
    title: 'The Phil Donahue Show, 1979',
    emoji: '🎙️',
    text: 'Phil leans in. “When you see around the globe the maldistribution of wealth… did you ever have a moment of doubt about capitalism, and whether greed’s a good idea to run on?”',
    choices: [
      {
        label: '“Is there some society you know that doesn’t run on greed?”',
        detail: 'Gain The Donahue Comeback',
        effects: [{ kind: 'card', id: 'donahue' }],
        result: 'The audience goes quiet. Then it claps. Phil changes the subject.',
      },
      {
        label: 'Smile, puff the pipe, let him talk',
        detail: 'Heal 12 Credibility',
        effects: [{ kind: 'hp', amount: 12 }],
        result: 'You rest your voice while Phil does a monologue about yachts.',
      },
    ],
  },
  {
    id: 'withholding',
    title: 'U.S. Treasury, 1942',
    emoji: '🏛️',
    text: 'It’s wartime. A Treasury official slides a memo across the desk: “We need the tax money now, not next spring. Could you help us take it straight out of people’s paychecks? Just for the war, of course.”',
    choices: [
      {
        label: 'Help design withholding',
        detail: 'Gain 120 Royalties and Payroll Withholding. Gain a Regret.',
        effects: [{ kind: 'royalties', amount: 120 }, { kind: 'card', id: 'withholding' }, { kind: 'card', id: 'regret' }],
        result: '“Temporary,” they said. It’s still there. You will spend decades apologizing for this one.',
      },
      {
        label: 'Politely decline',
        detail: 'Nothing happens',
        effects: [],
        result: 'History takes a different turn. Somewhere, a paycheck stays whole. (Not in this timeline, sadly.)',
      },
    ],
  },
  {
    id: 'david',
    title: 'Your Son Drops By',
    emoji: '👨‍👦',
    image: 'dfriedman',
    text: 'David pokes his head into the green room. “Dad, great show. Quick question: if markets do everything better, why stop at schools? Why not courts? Police? Why keep the state at all?”',
    choices: [
      {
        label: 'Argue it out over dinner',
        detail: 'Lose 8 Credibility. Upgrade 2 random cards.',
        effects: [{ kind: 'hp', amount: -8 }, { kind: 'upgradeRandom', count: 2 }],
        result: 'Three hours, two pies, no agreement. You both come out sharper. He goes home to write The Machinery of Freedom.',
        needs: { hp: 9 },
      },
      {
        label: '“Ask me again when you’re older”',
        detail: 'Gain 40 Royalties',
        effects: [{ kind: 'royalties', amount: 40 }],
        result: 'He has a physics PhD. He will ask again. He will ask in print.',
      },
    ],
  },
  {
    id: 'nobel',
    title: 'A Call from Stockholm, 1976',
    emoji: '📞',
    text: 'The Nobel committee is on the line. Outside your hotel, protesters are chanting. Inside, someone has left a very fancy breakfast.',
    choices: [
      {
        label: 'Accept the prize',
        detail: 'Gain the Nobel Medal (+12 max Credibility)',
        effects: [{ kind: 'relic', id: 'medal' }],
        result: 'You give a lecture on inflation and unemployment. The protesters do not attend.',
      },
      {
        label: 'Eat the fancy breakfast',
        detail: 'Heal to full Credibility',
        effects: [{ kind: 'hp', amount: 999 }],
        result: 'There is, it turns out, such a thing as a free breakfast. The Swedish taxpayer thanks you.',
      },
    ],
  },
  {
    id: 'signing',
    title: 'Book Signing',
    emoji: '✍️',
    text: 'The line for Free to Choose goes around the block. Your hand is cramping. A grad student at the back is holding a rare first edition.',
    choices: [
      {
        label: 'Sign every last copy',
        detail: 'Lose 6 Credibility. Gain a random rare card.',
        effects: [{ kind: 'hp', amount: -6 }, { kind: 'randomCard', rarity: 'rare' }],
        result: 'The grad student gives you a tip in return. A very good one.',
        needs: { hp: 7 },
      },
      {
        label: 'Sell signed copies at a premium',
        detail: 'Gain 60 Royalties',
        effects: [{ kind: 'royalties', amount: 60 }],
        result: 'Prices rise to meet demand. Nobody calls it gouging, because you’re charming.',
      },
    ],
  },
  {
    id: 'chile',
    title: 'A Lecture in Santiago, 1975',
    emoji: '🇨🇱',
    text: 'You’re invited to give a few talks on inflation. You know the headlines will be terrible no matter what you say.',
    choices: [
      {
        label: 'Give the lectures anyway',
        detail: 'Lose 10 Credibility. Gain 50 Based.',
        effects: [{ kind: 'hp', amount: -10 }, { kind: 'based', amount: 50 }],
        result: 'Inflation comes down, eventually. The headlines stay terrible for fifty years.',
        needs: { hp: 11 },
      },
      {
        label: 'Stay home and prepare',
        detail: 'Remove a random Show the Data or Stay Calm',
        effects: [{ kind: 'removeRandom' }],
        result: 'You trim the weakest bit of your act.',
      },
    ],
  },
  {
    id: 'newsweek',
    title: 'Newsweek Wants a Column',
    emoji: '📰',
    text: 'Every three weeks, 800 words, alternating with Paul Samuelson. The pay is decent. The readers are not always kind.',
    choices: [
      {
        label: 'Take the column',
        detail: 'Gain the Newsweek Column relic',
        effects: [{ kind: 'relic', id: 'newsweek' }],
        result: 'Eighteen years of columns. Samuelson stays wrong the whole time.',
      },
      {
        label: 'Write a book instead',
        detail: 'Gain a random uncommon card and 25 Royalties',
        effects: [{ kind: 'randomCard', rarity: 'uncommon' }, { kind: 'royalties', amount: 25 }],
        result: 'It sells. Of course it sells.',
      },
    ],
  },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id);
