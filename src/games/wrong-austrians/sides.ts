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
  check: { impostor: (name: string) => string; loyal: (name: string) => string };
  /** The title screen: the comic's lines (three advisors, then you), and the pitch. */
  comic: [string, string, string, string];
  pitch: (council: number, impostors: number) => string;
  how: (council: number, impostors: number, quarters: number) => string;
  endings: Record<Ending, [string, string]>;
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
    fireWarning: 'Everyone will find out what they were. A real Austrian costs you −6 📈 −2 🗽 (severance, and a scathing op-ed). A Viennese: +4 🗽.',
    reveal: {
      impostorTitle: 'FROM VIENNA!',
      loyalTitle: 'A REAL AUSTRIAN',
      impostor: (n) => `Under the ancap paint: red, white, red. ${n} goes back to the Finance Ministry, muttering about the social partnership.`,
      loyal: (n) => `${n} was the real thing. They leave to write a book about your mistake. It’s footnoted.`,
    },
    check: {
      impostor: (n) => `The registrar writes back: ${n}, twenty years at the Ministry of Finance, member of three chambers, season pass to the State Opera. Austrian, yes. School: no.`,
      loyal: (n) => `The registrar writes back: ${n}, no state employment on record, ever. Owns four copies of Human Action. The real thing.`,
    },
    comic: ['Cut all taxes to 0%', 'Privatize Vienna plz', 'Nationalize oil', 'Wait. Why are Austrian economists suddenly statists?'],
    pitch: (c, i) =>
      `You’re Ancapball, two years in office, with a council of ${c} economists. ${i} of them aren’t from the Austrian School at all: they’re just from Austria, and they want the state to grow. Find them before they regulate everything.`,
    how: (c, i, q) => `<li>🏛️ Your council has <b>${c} economists</b>. <b>${i}</b> are secretly <b>from Vienna</b>: Austrian, but not the Austrian School. They want the state to grow.</li>
        <li>📰 Each quarter a <b>crisis</b> hits. Everyone proposes a fix. Real Austrians propose sound policy; the Viennese usually dress up something statist so it sounds market-friendly.</li>
        <li>⏳ <b>Bad policy looks good now and sends the bill later</b>; sound policy often stings now and pays off later. When a bill lands, the news says who backed it.</li>
        <li>❓ Ask <b>2 questions</b> a quarter. Real Austrians answer like Mises would. The Viennese bluff, and sometimes slip. Anyone might dodge.</li>
        <li>🗣️ The council <b>accuses each other</b>. The real ones go on the evidence. The Viennese frame the real ones, and cover for each other.</li>
        <li>🔥 <b>Fire</b> one advisor a quarter; you’ll find out what they were. Firing a real Austrian costs you. 🔍 One <b>background check</b> a term tells you about someone quietly.</li>
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
    fireWarning: 'Everyone will find out what they were. A loyal Viennese costs you −6 🏛️ −2 🗳️ (severance, and a union grievance). An ancap: +4 🗳️.',
    reveal: {
      impostorTitle: 'AN ANCAP!',
      loyalTitle: 'A LOYAL VIENNESE',
      impostor: (n) => `Under the red, white and red: yellow, black, and an eagle. ${n} leaves to found a seastead, muttering about praxeology.`,
      loyal: (n) => `${n} was loyal to the last form. They leave to file a grievance, in triplicate.`,
    },
    check: {
      impostor: (n) => `The registrar writes back: ${n}, no state employment on record, ever. Owns four copies of Human Action. Austrian School. The wrong kind of Austrian.`,
      loyal: (n) => `The registrar writes back: ${n}, twenty years at the Ministry of Finance, member of three chambers, season pass to the State Opera. One of ours.`,
    },
    comic: ['Regulate everything', 'Nationalize oil', 'Privatize Vienna plz', 'I thought I hired Austrian economists'],
    pitch: (c, i) =>
      `Mirror mode. You’re Austria, two years in office, with a council of ${c} economists. You asked for Austrian economists, and got ${i} from the Austrian School: ancaps who want to privatize Vienna. Find them before they sell the Hofburg.`,
    how: (c, i, q) => `<li>🇦🇹 You’re <b>Austria</b> now. Your council has <b>${c} economists</b>. <b>${i}</b> are secretly <b>Austrian School ancaps</b>. They want the state to shrink, preferably to nothing.</li>
        <li>📰 Each quarter a <b>crisis</b> hits. Everyone proposes a fix. Loyal Viennese propose proper state solutions; the ancaps dress up privatization as something social (“a public-private partnership”).</li>
        <li>⏳ <b>Their policies look harmless now and gut the state later</b>; loyal ones often cost a little approval now and pay off later. When a bill lands, the news says who backed it.</li>
        <li>❓ Ask <b>2 questions</b> a quarter. Loyal Viennese answer like a Finance Ministry lifer. The ancaps bluff, and sometimes slip into quoting Mises. Anyone might dodge.</li>
        <li>🗣️ The council <b>accuses each other</b>. The loyal ones go on the evidence. The ancaps frame the loyal ones, and cover for each other.</li>
        <li>🔥 <b>Fire</b> one advisor a quarter; you’ll find out what they were. Firing a loyal Viennese costs you. 🔍 One <b>background check</b> a term.</li>
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
  },
};

export const sideOf = (mode: Mode): Side => SIDES[mode];
