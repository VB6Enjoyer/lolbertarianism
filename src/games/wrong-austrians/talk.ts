// What the advisors say: answers to your questions, accusations, defences. Real Austrian School
// economists answer like Mises would. The ones from Vienna bluff, and slip.

export interface Question {
  id: string;
  q: string;
  /** What a real Austrian School economist says. */
  sound: [string, string];
  /** What gives away someone who's just from Austria. */
  slips: [string, string];
}

export const QUESTIONS: Question[] = [
  {
    id: 'cycle',
    q: 'What causes the business cycle?',
    sound: ['Cheap credit. The central bank pushes rates down and people invest in things nobody really wants.', 'Malinvestment, from interest rates held below where the market would put them.'],
    slips: ['Animal spirits. Which is why the Finance Ministry needs a bigger budget.', 'Not enough government spending, mostly. Keynes was very clear.'],
  },
  {
    id: 'rates',
    q: 'Who should set interest rates?',
    sound: ['Nobody. Savers and borrowers, between them.', 'The market. Interest is the price of time.'],
    slips: ['A wise committee in Vienna. I know some of them personally.', 'The central bank, obviously. Who else would?'],
  },
  {
    id: 'minwage',
    q: 'What is the minimum wage?',
    sound: ['A law that makes it illegal to hire anyone whose work is worth less than it.', 'Unemployment for the least skilled, with good intentions.'],
    slips: ['A floor of dignity. My cousin at the Chamber of Labour explained it to me.', 'Social justice, with a number on it.'],
  },
  {
    id: 'hero',
    q: 'Name a great Austrian economist.',
    sound: ['Mises. Or Menger, who started the whole thing.', 'Hayek. Böhm-Bawerk. Rothbard, if you let an American in.'],
    slips: ['Schumpeter! Austrian, and he was finance minister. Twice the qualifications.', 'The governor of the Nationalbank? Lovely man. We golf.'],
  },
  {
    id: 'prices',
    q: 'What are prices for?',
    sound: ['They carry information. Nobody could plan anything without them.', 'They’re signals. They tell everyone what’s scarce and what isn’t.'],
    slips: ['Prices are something the state should keep fair, mostly.', 'That’s a matter for the Price Commission, I believe.'],
  },
  {
    id: 'recession',
    q: 'What would you do in a recession?',
    sound: ['Let it clear out the bad investments. The bust is the cure, not the disease.', 'Cut spending, cut taxes, and get out of the way.'],
    slips: ['A stimulus! Shovel-ready, of course.', 'Lower interest rates and build a nice new railway station.'],
  },
  {
    id: 'neutral',
    q: 'Is money neutral?',
    sound: ['No. New money reaches some people first, and they gain at everyone else’s expense.', 'No. Whoever’s closest to the printing press wins. Cantillon worked that out in 1730.'],
    slips: ['Neutral enough to print a little more, I’d say.', 'Money is whatever the state says it is. That’s what makes it so convenient.'],
  },
  {
    id: 'tax',
    q: 'What’s your favourite tax?',
    sound: ['Zero. Cut all taxes to 0%.', 'The one we abolish next.'],
    slips: ['A wealth tax. Very fair. Very popular at dinner parties.', 'VAT. Twenty percent, like back home.'],
  },
  {
    id: 'praxeology',
    q: 'What is praxeology?',
    sound: ['The logic of human action: people act on purpose, to reach a state they prefer.', 'Economics from first principles. Humans act. Everything else follows.'],
    slips: ['Some kind of physiotherapy, I think? My knee could use it.', 'It sounds Greek. Is it funded by the EU?'],
  },
  {
    id: 'planning',
    q: 'Could a central planner run the economy?',
    sound: ['No. The knowledge is scattered across millions of people. Nobody can gather it all.', 'No. Without market prices for capital goods, there’s no way to calculate.'],
    slips: ['With enough computers, why not?', 'Vienna’s planning office runs the trams on time. So: yes.'],
  },
  {
    id: 'phil',
    q: 'What do you think of the Vienna Philharmonic?',
    sound: ['Wonderful. I’d pay full price for a ticket.', 'A great orchestra. It shouldn’t need a subsidy to stay great.'],
    slips: ['Essential state infrastructure!', 'I have a season pass. Through the ministry.'],
  },
  {
    id: 'post',
    q: 'Should the state run the post office?',
    sound: ['No. Private couriers deliver faster and cheaper.', 'There’s no reason it should. Let anyone deliver letters.'],
    slips: ['The Post is part of who we are. It must stay public.', 'Yes, and the telephones too, like in the good old days.'],
  },
  {
    id: 'inflation',
    q: 'What causes inflation?',
    sound: ['More money chasing the same goods. Someone has been printing.', 'Increasing the money supply. That’s what the word used to mean.'],
    slips: ['Greedy shopkeepers, mostly.', 'Supply chains. And the weather. And bad luck.'],
  },
  {
    id: 'study',
    q: 'Where did you study economics?',
    sound: ['A summer school, then anywhere I could find a used copy of Human Action.', 'In libraries, mostly. Hayek first, then Mises, then years of arguing.'],
    slips: ['The University of Economics in Vienna, then twenty years at the Ministry.', 'A state scholarship, then a state job. Next up, a state pension.'],
  },
  {
    id: 'government',
    q: 'What’s the best form of government?',
    sound: ['As little as possible. Ideally none.', 'One that does nothing. And then less.'],
    slips: ['A grand coalition, like the good old days.', 'A strong one, with a good social partnership.'],
  },
  {
    id: 'centralbank',
    q: 'Should we have a central bank?',
    sound: ['No. Free banking, competing currencies, gold if people want it.', 'End it. Let the market choose its own money.'],
    slips: ['Of course! The Nationalbank is a national treasure.', 'Yes, as long as it’s run by sensible people. Like me.'],
  },
  {
    id: 'rent',
    q: 'What do you make of rent control?',
    sound: ['The best way to destroy a city, short of bombing it.', 'Fewer flats, worse flats, and a waiting list.'],
    slips: ['Vienna has had it for a century, and look how nice Vienna is!', 'Necessary. For the flat I live in, at least.'],
  },
  {
    id: 'window',
    q: 'What’s the broken window fallacy?',
    sound: ['Thinking a broken window helps the economy because the glazier gets paid, and forgetting what wasn’t bought instead.', 'Seeing what’s spent and forgetting what’s lost. Bastiat explained it, then Hazlitt.'],
    slips: ['That’s when windows get broken and the state has to fix them, right?', 'A building code violation, I believe.'],
  },
  {
    id: 'vienna',
    q: 'How would you privatize Vienna?',
    sound: ['Sell all of it. The streets, the trams, the Prater. Privatize Vienna plz.', 'The trams first, then the housing, then the opera.'],
    slips: ['Privatize… Vienna? Why would anyone say such a thing?', 'Maybe the gift shops. Not the rest. Never the rest.'],
  },
  {
    id: 'fair',
    q: 'What’s a fair price?',
    sound: ['Whatever two people freely agree on.', 'There’s no such thing as a fair price, only an agreed one.'],
    slips: ['Whatever the Price Commission decides.', 'The price my uncle charges. Plus a small subsidy.'],
  },
];

/** When someone dodges the question (anyone might). */
export const DODGES = [
  'Uh, could you repeat that? I was thinking about strudel.',
  'It depends. Most things do.',
  'Let me get back to you after lunch.',
  'That’s a very good question. Next question.',
  'I’d rather not say before my coffee.',
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

// --- Names and looks: everyone's Austrian. That's the problem. ---

export const FIRST_NAMES = ['Ludwig', 'Friedrich', 'Carl', 'Eugen', 'Gottfried', 'Hans', 'Fritz', 'Wolfgang', 'Maximilian', 'Sepp', 'Franz', 'Johann', 'Leopold', 'Anton', 'Josef', 'Klemens'];
export const SURNAMES = ['Grübl', 'Hasenhüttl', 'Pfeffer', 'Moosbrugger', 'Kranzl', 'Wimmer', 'Strudl', 'Leitner', 'Hofbauer', 'Gruber', 'Ebner', 'Edelweiß', 'Zwickl', 'Pichler', 'Schnitzler', 'Huber'];

export const HATS = ['none', 'top', 'bowler', 'tyrolean', 'beret'] as const;
export const FACES = ['none', 'monocle', 'glasses', 'moustache'] as const;
export type Hat = (typeof HATS)[number];
export type Face = (typeof FACES)[number];
