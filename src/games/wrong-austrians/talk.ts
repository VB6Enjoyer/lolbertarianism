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

/** {x} is who they're talking about, {p} a policy. */
export const LINES = {
  /** A real Austrian accusing, with evidence. */
  accuseBacked: [
    'I don’t trust {x}. Nobody who has read Mises proposes “{p}”.',
    '“{p}”? {x} said that with a straight face. Think about it.',
    '{x} backed “{p}”. That’s straight out of a ministry brochure.',
  ],
  accuseBill: ['Remember “{p}”? {x} pushed it, and we’re still paying for it.', '{x} sold us “{p}”. Look how that turned out.'],
  accuseSlip: ['{x} answered your question like someone from the Finance Ministry.', 'Did you hear {x} earlier? That was not an Austrian School answer.'],
  /** A real Austrian with nothing to go on. */
  unsure: ['No idea yet. Watch who backs what.', 'Hard to say. Ask them some questions.', 'Something about {x} feels… state-issued. But that’s just a hunch.'],
  /** Someone from Vienna, framing a real Austrian. */
  frame: [
    '{x} is awfully extreme, don’t you think? That’s suspicious.',
    'I’d keep an eye on {x}. Very quiet lately.',
    '{x} keeps saying “abolish the state”. Who even talks like that?',
    'Between us, I saw {x} reading Keynes on the tram.',
  ],
  /** Someone from Vienna, sticking up for a fellow Viennese. */
  defendFriend: ['Leave {x} alone. {x} is one of us. A real Austrian, I mean.', '{x}? Solid. Very solid. We go way back. To… university.', 'Let’s not be hasty about {x}. Reasonable people can propose “{p}”.'],
  /** A real Austrian vouching for someone. */
  vouch: ['{x} has given sound advice every quarter. I’d keep them.', 'Whatever else happens, {x} is the real thing.'],
};

/** Mirror mode: you're Austria, the loyal ones are Viennese, and the impostors are ancaps. */
export const LINES_MIRROR: typeof LINES = {
  accuseBacked: [
    'I don’t trust {x}. Nobody who loves Vienna proposes “{p}”.',
    '“{p}”? {x} said that with a straight face. Think about it.',
    '{x} backed “{p}”. That’s straight out of a Mises Institute pamphlet.',
  ],
  accuseBill: LINES.accuseBill,
  accuseSlip: ['{x} answered your question like someone from the Mises Institute.', 'Did you hear {x} earlier? That was not a Viennese answer.'],
  unsure: ['No idea yet. Watch who backs what.', 'Hard to say. Ask them some questions.', 'Something about {x} feels… privately funded. But that’s just a hunch.'],
  frame: [
    '{x} is awfully keen on markets lately, don’t you think?',
    'I’d keep an eye on {x}. Very quiet lately.',
    '{x} keeps saying “privatize”. Who even talks like that?',
    'Between us, I saw {x} reading Hayek on the tram.',
  ],
  defendFriend: ['Leave {x} alone. {x} is one of us. A real Viennese, I mean.', '{x}? Solid. Very solid. We go way back. To… summer school.', 'Let’s not be hasty about {x}. Reasonable people can propose “{p}”.'],
  vouch: LINES.vouch,
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
