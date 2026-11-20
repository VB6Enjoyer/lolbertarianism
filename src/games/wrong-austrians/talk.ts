// What the advisors say: accusations, defences, dodges (the interview questions live in
// questions.ts). Real Austrian School economists answer like Mises would, mostly. The ones from
// Vienna have read the brochures.

export { type NearMiss, type Question, QUESTIONS } from './questions.ts';

/** When someone dodges the question (anyone might). */
export const DODGES = [
  'Uh, could you repeat that? I was thinking about strudel.',
  'It depends. Most things do.',
  'Let me get back to you after lunch.',
  'That’s a very good question. Next question.',
  'I’d rather not say before my coffee.',
  'Can I answer that one in writing? Next quarter?',
  'Economists disagree about that. I disagree with all of them.',
];

/**
 * What the council says in the debate. Everyone (loyal or not) uses the same lines, built from the
 * same record, so the wording never gives anyone away: only whom they pick on does. {x} is who
 * they're talking about, {q} a question they fumbled, {item} a clue or rumour, {tool} where it came
 * from, {p} a policy.
 */
export interface Lines {
  accuseAnswer: string[];
  accuseClue: string[];
  accuseRumour: string[];
  accuseBill: string[];
  /** Backing a statist policy right now (only when you can see who backs what). */
  accuseBacked: string[];
  /** Nothing on the record, just a feeling. */
  hunch: string[];
  vouch: string[];
  unsure: string[];
}

export const LINES: Lines = {
  accuseAnswer: [
    'Did you hear {x} on “{q}”? That wasn’t an Austrian answer.',
    'Read {x}’s answer to “{q}” again. Slowly.',
    'I’d ask {x} about “{q}” once more, if I were you. Something was off.',
  ],
  accuseClue: ['Have you looked at {x}’s past? {item}. Make of that what you will.', '{x}: {item}. Just saying.'],
  accuseRumour: ['Did you see the papers about {x}? “{item}”. If that’s true…', 'There’s talk about {x}: “{item}”. Nobody’s denied it.'],
  accuseBill: ['Remember “{p}”? {x} backed it, and we’re still paying for it.', '{x} sold us “{p}”. Look how that turned out.'],
  accuseBacked: ['{x} is backing “{p}”. Nobody who has read Mises proposes that.', '“{p}”? {x} said that with a straight face.'],
  hunch: ['Something about {x} doesn’t add up. I can’t say what yet.', 'I’d keep an eye on {x}. Call it a hunch.'],
  vouch: ['{x} has given sound advice every quarter. I’d keep them.', 'Whatever else happens, {x} is the real thing.', 'I’ve worked with {x} for years. I trust them.'],
  unsure: ['No idea yet. Watch what everyone backs.', 'Hard to say. Ask them some questions.', 'Too early to accuse anyone. Keep digging.'],
};

/** Mirror mode: you're Austria, the loyal ones are Viennese, and the impostors are ancaps. */
export const LINES_MIRROR: Lines = {
  ...LINES,
  accuseAnswer: [
    'Did you hear {x} on “{q}”? That wasn’t a Viennese answer.',
    'Read {x}’s answer to “{q}” again. Slowly.',
    'I’d ask {x} about “{q}” once more, if I were you. Something was off.',
  ],
  accuseBacked: ['{x} is backing “{p}”. Nobody who loves Vienna proposes that.', '“{p}”? {x} said that with a straight face.'],
  vouch: ['{x} has served the Republic every quarter. I’d keep them.', 'Whatever else happens, {x} has been straight with me.', 'I’ve worked with {x} for years. I trust them.'],
  unsure: ['No idea yet. Watch what everyone backs.', 'Hard to say. Ask them some questions.', 'Too early to accuse anyone. Fill in the forms first.'],
};

/** What an impostor still on the council quietly does every quarter (nobody signs it). */
export const SNEAK_NEWS = {
  ancap: [
    'Overnight, {n} pages of new regulations appeared in the official gazette. Nobody on the council signed them.',
    'A new permit is now needed to sell lemonade. Nobody knows who wrote the rule.',
    'Someone has quietly created a Ministry of Ministries. It already has {n} staff.',
    'A “temporary” fee on gold coins appeared in the budget. Nobody admits to adding it.',
    'Ladders now need a licence. The form is {n} pages long and the author anonymous.',
  ],
  mirror: [
    'Overnight, the state porcelain factory was sold to its workers. Nobody signed the order, and the voters are furious nobody asked them.',
    'Someone quietly abolished the Ministry of Ministries. All {n} staff were sent home. Talk radio is livid.',
    'A tram line was sold to a start-up overnight. The paperwork is unsigned. The commuters are not amused.',
    '{n} regulations vanished from the official gazette. Nobody admits deleting them. The opposition smells blood.',
    'The licence for ladders was abolished. Nobody knows who did it, and the tabloids blame you.',
  ],
};

// --- Names and looks: everyone's Austrian. That's the problem. ---

export const FIRST_NAMES = ['Ludwig', 'Friedrich', 'Carl', 'Eugen', 'Gottfried', 'Hans', 'Fritz', 'Wolfgang', 'Maximilian', 'Sepp', 'Franz', 'Johann', 'Leopold', 'Anton', 'Josef', 'Klemens'];
export const SURNAMES = ['Grübl', 'Hasenhüttl', 'Pfeffer', 'Moosbrugger', 'Kranzl', 'Wimmer', 'Strudl', 'Leitner', 'Hofbauer', 'Gruber', 'Ebner', 'Edelweiß', 'Zwickl', 'Pichler', 'Schnitzler', 'Huber'];

export const HATS = ['none', 'top', 'bowler', 'tyrolean', 'beret'] as const;
export const FACES = ['none', 'monocle', 'glasses', 'moustache'] as const;
export type Hat = (typeof HATS)[number];
export type Face = (typeof FACES)[number];
