// The words and looks for each side: Ancapball hiring the Austrian School (and getting Viennese),
// or, in mirror mode, Austria hiring Austrians (and getting the Austrian School).

import type { Flag } from './ball.ts';
import type { Ending, Mode } from './council.ts';

export interface Side {
  /** The two meters (p and l in the engine): icon and name. */
  meters: { p: [string, string]; l: [string, string] };
  /** You, the council before anyone's unmasked, and an unmasked impostor. */
  player: Flag;
  council: Flag;
  impostorFlag: Flag;
  /** "From Vienna" / "An ancap", and the loyal ones. */
  impostor: string;
  loyal: string;
  tag: { firedImpostor: string; firedLoyal: string; impostor: string; loyal: string };
  status: { impostor: string; loyal: string };
  role: { impostor: string; loyal: string };
  firedNote: { impostor: string; loyal: string };
  fireWarning: string;
  reveal: { impostorTitle: string; loyalTitle: string; impostor: (name: string) => string; loyal: (name: string) => string };
  /** The first-term walkthrough: a title and a few lines per step. */
  walkthrough: (council: number, impostors: number) => [string, string][];
  /**
   * The title screen: the comic's lines (three advisors, then you; an empty line is a silent ball),
   * and the pitch. Like the meme, the three are what you got instead of what you hired.
   */
  comic: [string, string, string, string];
  pitch: (council: number, impostors: number) => string;
  how: (council: number, impostors: number, quarters: number) => string;
  endings: Record<Ending, [string, string]>;
  /** Party mode: the role cards, the private labels on dealt policies, and who won. */
  party: {
    loyalGoal: string;
    impostorGoal: string;
    kinds: { sound: string; disguised: string; blatant: string };
    loyalWin: string;
    impostorsWin: string;
  };
}

const SIDES: Record<Mode, Side> = {
  ancap: {
    meters: { p: ['📈', 'Prosperity'], l: ['🗽', 'Liberty'] },
    player: 'player',
    council: 'ancap',
    impostorFlag: 'austria',
    impostor: 'Viennese',
    loyal: 'real Austrian',
    tag: { firedImpostor: '🇦🇹 Fired: from Vienna', firedLoyal: '😢 Fired: was real', impostor: '🔍 From Vienna!', loyal: '🔍 Real Austrian' },
    status: { impostor: '🇦🇹 From Vienna. Not the Austrian School.', loyal: '🦅 A real Austrian School economist.' },
    role: { impostor: '🇦🇹 From Vienna', loyal: '🦅 Austrian School' },
    firedNote: { impostor: 'From Vienna, as suspected.', loyal: 'A real Austrian. Oops.' },
    fireWarning: 'Everyone will find out what they were. A real Austrian costs you −8 📈 −4 🗽 (severance, and a scathing op-ed), and fire two of them and the Viennese take over. A Viennese: +4 🗽.',
    walkthrough: (c, i) => [
      ['Two of them are lying', `Your council has ${c} economists, all Austrian. But ${i} aren’t from the Austrian School: they’re just from Vienna, and they want the state to grow. They’ve read the brochures, so they’ll mostly sound like the real thing.`],
      ['Every quarter, a crisis', 'Everyone proposes a fix. Statist policy dressed up as market policy looks good now and sends the bill later, with the backers’ names on it. The Viennese back sound policy most of the time, to blend in.'],
      ['❓ Interview them', 'Ask 3 questions a quarter. Listen closely: the Viennese answer correctly about half the time, and when they don’t, it’s usually something that <i>sounds</i> free-market but isn’t Austrian. Telling which is which is up to you. Real Austrians get it wrong now and then too.'],
      ['🔎 Investigate them', 'Once a quarter, dig into someone’s past: their thesis, where they studied, their CV, their bookshelf, who pays them, their old op-eds. Each tool works once a term. Clues lean one way; they don’t prove anything, and anyone’s past can mislead.'],
      ['🔥 Fire them', 'Tap an economist’s portrait (at the top) to open their file: everything they’ve said, proposed and been caught at, your ✅/🚩 notes, and the <b>🔥 Fire</b> button. Austrian labour law protects them for the first two quarters, so firing opens in quarter 3, one a quarter.'],
      ['Winning and losing', 'Fire both Viennese to win early, or survive 8 quarters. Every quarter they stay, they slip a regulation through. Lose if Prosperity or Liberty hits 0, or if you fire two real Austrians and the Viennese take over. Then: enact one proposal to end the quarter.'],
    ],
    reveal: {
      impostorTitle: 'FROM VIENNA!',
      loyalTitle: 'A REAL AUSTRIAN',
      impostor: (n) => `Under the ancap paint: red, white, red. ${n} goes back to the Finance Ministry, muttering about the social partnership.`,
      loyal: (n) => `${n} was the real thing. They leave to write a book about your mistake. It’s footnoted.`,
    },
    comic: ['Nationalize oil', '', 'Regulate everything', 'Why are Austrian economists suddenly statists?'],
    pitch: (c, i) =>
      `You’re Ancapball, two years in office, with a council of ${c} economists. ${i} of them aren’t from the Austrian School at all: they’re just from Austria, and they want the state to grow. Find them before they regulate everything.`,
    how: (c, i, q) => `<li>🏛️ Your council has <b>${c} economists</b>. <b>${i}</b> are secretly <b>from Vienna</b>: Austrian, but not the Austrian School. They want the state to grow.</li>
        <li>📰 Each quarter a <b>crisis</b> hits. Everyone proposes a fix. Real Austrians propose sound policy; the Viennese usually dress up something statist so it sounds market-friendly.</li>
        <li>⏳ <b>Bad policy looks good now and sends the bill later</b>; sound policy often stings now and pays off later. When a bill lands, the news says who backed it.</li>
        <li>❓ Ask <b>3 questions</b> a quarter. The Viennese get it right about half the time; when they don’t, it usually <i>sounds</i> free-market but isn’t Austrian: spotting it is the game. Real Austrians miss now and then too. Anyone might dodge.</li>
        <li>🔎 <b>Investigate</b> once a quarter: someone’s thesis, alma mater, CV, bookshelf, funding or old op-eds. Each tool works once a term. Clues lean; they don’t prove.</li>
        <li>🗣️ The council <b>accuses each other</b>. The real ones go on the evidence. The Viennese frame the real ones, and cover for each other.</li>
        <li>🔥 <b>Fire</b> someone from their file (tap their portrait): one a quarter, from quarter 3 (labour law). You’ll find out what they were. Firing a real Austrian costs you.</li>
        <li>📋 Every quarter a Viennese stays on the council, they slip a regulation through: <b>−5 🗽 −2 📈</b> each, unsigned.</li>
        <li>🏁 Lose if 📈 Prosperity or 🗽 Liberty hits 0, or if the Viennese outnumber the real Austrians. Fire both Viennese to win early; survive ${q} quarters to win anyway.</li>
        <li>🚩 Tap an advisor for their record, and to mark them ✅ trusted or 🚩 suspect.</li>
        <li>📅 The <b>daily term</b> is the same for everyone each day, with a twist, and a best score to beat. 🏅 Achievements on the title screen.</li>`,
    endings: {
      term: ['TWO YEARS. STILL STATELESS. 😎', 'You made it through the term. Not everyone on the council was who they said they were, but the country survived them.'],
      purged: ['COUNCIL PURGED 🦅', 'Only real Austrians left. The rest of the term runs itself, mostly by abolishing things.'],
      broke: ['THE ECONOMY COLLAPSED 📉', 'Prosperity hit zero. Somewhere in Vienna, someone is drafting a stimulus.'],
      chained: ['REGULATED INTO OBLIVION 📋', 'Liberty hit zero. You now need a permit to read this sentence.'],
      takeover: ['I THOUGHT I HIRED AUSTRIAN ECONOMISTS', 'The Viennese outnumber the real Austrians. The council votes to nationalize oil, then to regulate everything.'],
    },
    party: {
      loyalGoal: 'Propose sound policy, and find the Viennese. Your side wins if every impostor is fired, or if Ancapistan survives all 8 quarters.',
      impostorGoal: 'Get statist policy enacted without getting caught. Your side wins if a meter hits 0, or if you match the real Austrians in number.',
      kinds: { sound: '✅ Sound', disguised: '🎭 Statist, in disguise', blatant: '🚩 Openly statist' },
      loyalWin: '🦅 The real Austrians win!',
      impostorsWin: '🇦🇹 The Viennese win!',
    },
  },
  mirror: {
    meters: { p: ['🏛️', 'The State'], l: ['🗳️', 'Approval'] },
    player: 'austria',
    council: 'austria',
    impostorFlag: 'ancap',
    impostor: 'ancap',
    loyal: 'loyal Viennese',
    tag: { firedImpostor: '🦅 Fired: an ancap', firedLoyal: '😢 Fired: was loyal', impostor: '🔍 An ancap!', loyal: '🔍 Loyal Viennese' },
    status: { impostor: '🦅 Austrian School. An ancap in red-white-red paint.', loyal: '🇦🇹 A loyal Viennese economist.' },
    role: { impostor: '🦅 Austrian School', loyal: '🇦🇹 Viennese' },
    firedNote: { impostor: 'An ancap, as suspected.', loyal: 'A loyal Viennese. Oops.' },
    fireWarning: 'Everyone will find out what they were. A loyal Viennese costs you −8 🏛️ −4 🗳️ (severance, and a union grievance), and fire two of them and the ancaps take over. An ancap: +4 🗳️.',
    walkthrough: (c, i) => [
      ['Two of them are lying', `Your council has ${c} economists, all Austrian. But ${i} are from the Austrian School: ancaps who want to privatize Vienna. They’ve practised their Finance Ministry voice, so they’ll mostly sound like the real thing.`],
      ['Every quarter, a crisis', 'Everyone proposes a fix. Privatization dressed up as something social looks harmless now and guts the state later, with the backers’ names on it. The ancaps back proper policy most of the time, to blend in.'],
      ['❓ Interview them', 'Ask 3 questions a quarter. The ancaps answer like a ministry lifer about half the time; when they don’t, it’s usually something a little too market-friendly. Loyal Viennese let one slip now and then too.'],
      ['🔎 Investigate them', 'Once a quarter, dig into someone’s past: their thesis, where they studied, their CV, their bookshelf, who pays them, their old op-eds. Each tool works once a term. Clues lean one way; they don’t prove anything.'],
      ['🔥 Fire them', 'Tap an economist’s portrait (at the top) to open their file: everything they’ve said and proposed, your ✅/🚩 notes, and the <b>🔥 Fire</b> button. The collective agreement protects them for the first two quarters, so firing opens in quarter 3, one a quarter.'],
      ['Winning and losing', 'Fire both ancaps to win early, or survive 8 quarters. Every quarter they stay, something gets quietly privatized. Lose if the State or Approval hits 0, or if you fire two loyal Viennese and the ancaps take over. Then: enact one proposal to end the quarter.'],
    ],
    reveal: {
      impostorTitle: 'AN ANCAP!',
      loyalTitle: 'A LOYAL VIENNESE',
      impostor: (n) => `Under the red, white and red: yellow, black, and an eagle. ${n} leaves to found a seastead, muttering about praxeology.`,
      loyal: (n) => `${n} was loyal to the last form. They leave to file a grievance, in triplicate.`,
    },
    comic: ['Cut all taxes to 0%', '', 'Privatize Vienna plz', 'I thought I hired Austrian economists'],
    pitch: (c, i) =>
      `Mirror mode. You’re Austria, two years in office, with a council of ${c} economists. You asked for Austrian economists, and got ${i} from the Austrian School: ancaps who want to privatize Vienna. Find them before they sell the Hofburg.`,
    how: (c, i, q) => `<li>🇦🇹 You’re <b>Austria</b> now. Your council has <b>${c} economists</b>. <b>${i}</b> are secretly <b>Austrian School ancaps</b>. They want the state to shrink, preferably to nothing.</li>
        <li>📰 Each quarter a <b>crisis</b> hits. Everyone proposes a fix. Loyal Viennese propose proper state solutions; the ancaps dress up privatization as something social (“a public-private partnership”).</li>
        <li>⏳ <b>Their policies look harmless now and gut the state later</b>; loyal ones often cost a little approval now and pay off later. When a bill lands, the news says who backed it.</li>
        <li>❓ Ask <b>3 questions</b> a quarter. The ancaps answer like a ministry lifer about half the time; otherwise it’s usually something a little too market-friendly, now and then a full quote from Mises. Loyal Viennese slip too, sometimes.</li>
        <li>🔎 <b>Investigate</b> once a quarter: someone’s thesis, alma mater, CV, bookshelf, funding or old op-eds. Each tool works once a term. Clues lean; they don’t prove.</li>
        <li>🗣️ The council <b>accuses each other</b>. The loyal ones go on the evidence. The ancaps frame the loyal ones, and cover for each other.</li>
        <li>🔥 <b>Fire</b> someone from their file (tap their portrait): one a quarter, from quarter 3. You’ll find out what they were. Firing a loyal Viennese costs you.</li>
        <li>🏷️ Every quarter an ancap stays on the council, something gets quietly privatized, and the voters blame you: <b>−5 🗳️ −2 🏛️</b> each, unsigned.</li>
        <li>🏁 Lose if 🏛️ the State or 🗳️ Approval hits 0, or if the ancaps outnumber the loyal Viennese. Fire both ancaps to win early; survive ${q} quarters to win anyway.</li>
        <li>🚩 Tap an advisor for their record, and to mark them ✅ trusted or 🚩 suspect.</li>
        <li>📅 The <b>daily term</b> is the same for everyone each day, with a twist, and a best score to beat. 🏅 Achievements on the title screen.</li>`,
    endings: {
      term: ['TWO YEARS. STILL BUREAUCRATIC. 🇦🇹', 'You made it through the term. The forms are in triplicate, as they should be.'],
      purged: ['COUNCIL PURGED 🇦🇹', 'Only loyal Viennese left. The rest of the term runs itself, mostly by founding committees.'],
      broke: ['VIENNA HAS BEEN PRIVATIZED 🏷️', 'The State hit zero. The Hofburg is a hostel now, and the trams take crypto.'],
      chained: ['VOTED OUT 🗳️', 'Approval hit zero. The voters picked someone promising lower taxes. The horror.'],
      takeover: ['I THOUGHT I HIRED AUSTRIAN ECONOMISTS', 'The ancaps outnumber the loyal Viennese. The council votes to privatize Vienna, plz.'],
    },
    party: {
      loyalGoal: 'Propose proper state policy, and find the ancaps. Your side wins if every impostor is fired, or if Austria survives all 8 quarters.',
      impostorGoal: 'Get privatization enacted without getting caught. Your side wins if a meter hits 0, or if you match the loyal Viennese in number.',
      kinds: { sound: '✅ Loyal', disguised: '🎭 Ancap, in disguise', blatant: '🚩 Openly ancap' },
      loyalWin: '🇦🇹 The loyal Viennese win!',
      impostorsWin: '🦅 The ancaps win!',
    },
  },
};

export const sideOf = (mode: Mode): Side => SIDES[mode];
