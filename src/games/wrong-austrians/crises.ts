// What lands on the council's table each quarter, and what the advisors can propose. Every crisis
// has three sound policies (they often sting now and pay off later), two statist ones dressed up as
// market policies (they look great now, and the bill comes later), and one openly statist one.

/** Prosperity and Liberty, the two meters. */
export interface Effect {
  p?: number;
  l?: number;
}

export type PolicyKind = 'sound' | 'disguised' | 'blatant';

export interface Policy {
  id: string;
  kind: PolicyKind;
  title: string;
  /** What the advisor says when proposing it. */
  pitch: string;
  /** Right away. */
  now: Effect;
  /** A quarter or two later (the bill, or the payoff). */
  later: Effect & { in: 1 | 2 };
  /** The news when the later effect lands. */
  outcome: string;
}

export interface Crisis {
  id: string;
  title: string;
  emoji: string;
  text: string;
  /** What it costs, whatever you do. */
  hit: Effect;
  policies: Policy[];
}

type Line = [title: string, pitch: string, outcome: string];

// The usual numbers for each kind; a crisis can nudge them.
export const sound = (id: string, [title, pitch, outcome]: Line, now: Effect = { p: -2 }, later: Policy['later'] = { p: 8, l: 2, in: 1 }): Policy => ({ id, kind: 'sound', title, pitch, outcome, now, later });
export const disguised = (id: string, [title, pitch, outcome]: Line, now: Effect = { p: 5 }, later: Policy['later'] = { p: -11, l: -4, in: 1 }): Policy => ({ id, kind: 'disguised', title, pitch, outcome, now, later });
export const blatant = (id: string, [title, pitch, outcome]: Line, now: Effect = { p: 6, l: -8 }, later: Policy['later'] = { p: -9, l: -3, in: 1 }): Policy => ({ id, kind: 'blatant', title, pitch, outcome, now, later });

export const CRISES: Crisis[] = [
  {
    id: 'oil',
    title: 'Oil Shock',
    emoji: '🛢️',
    text: 'Prices at the pump just doubled. People are queuing round the block at every station.',
    hit: { p: -6 },
    policies: [
      sound('oil-prices', ['Let prices rise', 'High prices are the signal. People drive less, someone drills more.', 'Drilling’s up and the queues are gone. Turns out prices work.']),
      sound('oil-tax', ['Scrap the fuel tax', 'Cut the tax on every litre to zero. Cut all taxes to 0%, while we’re at it.', 'Cheaper fuel, and nobody misses the tax office.'], { p: 1, l: 2 }, { p: 6, l: 2, in: 1 }),
      sound('oil-drill', ['Open the oil fields to anyone', 'Sell drilling rights to whoever wants them. Competition finds oil.', 'Three new wells, and a price war at the pumps.'], { p: -2 }, { p: 9, l: 1, in: 2 }),
      disguised('oil-cap', ['A temporary price cap', 'Just a cap until things calm down. Temporary. Very market-friendly.', 'The price cap emptied the stations. The queues are longer than ever.']),
      disguised('oil-reserve', ['A public-private fuel reserve', 'A strategic reserve, run by private firms. With state guarantees. Mostly private.', 'The fuel reserve lost money every month. Guess who covered it.'], { p: 4 }, { p: -10, l: -5, in: 2 }),
      blatant('oil-nationalize', ['Nationalize oil', 'Nationalize oil. All of it. For the people.', 'The state oil company found no oil, but it did hire 4,000 people.']),
    ],
  },
  {
    id: 'bankrun',
    title: 'Bank Run',
    emoji: '🏦',
    text: 'Lines outside the First Ancap Bank. Depositors want their gold back, and the bank doesn’t have it all.',
    hit: { p: -6 },
    policies: [
      sound('bank-fail', ['Let insolvent banks fail', 'If they lent out money they didn’t have, let them fail. The others will learn.', 'Two banks failed. The rest started keeping real reserves.'], { p: -4 }, { p: 10, l: 2, in: 1 }),
      sound('bank-free', ['Free banking', 'Let banks issue their own notes and compete on how trustworthy they are.', 'Banks now brag about their reserves on billboards.']),
      sound('bank-nothing', ['Announce: no bailouts, ever', 'Say it loudly. Watch everyone get careful with other people’s money.', 'Nobody expects a bailout, so nobody lends like a lunatic.']),
      disguised('bank-fund', ['A one-time rescue fund', 'One time only. The banks pay in, the treasury backs it. One time.', 'The one-time fund has been used four times. Banks lend like there’s no tomorrow.']),
      disguised('bank-reserves', ['Lower reserve requirements', 'Free up those reserves! More credit is more freedom.', 'The credit boom went bust. Half the new ski resorts are empty.'], { p: 6 }, { p: -12, l: -3, in: 2 }),
      blatant('bank-nationalize', ['Nationalize the banks', 'If the state owns the banks, there can’t be a run. Logic.', 'The national bank had a run of a different kind: on its pension fund.']),
    ],
  },
  {
    id: 'opera',
    title: 'Vienna Wants an Opera House',
    emoji: '🎭',
    text: 'A delegation from Vienna insists every civilized country needs a state opera. They brought a brochure.',
    hit: { l: -4 },
    policies: [
      sound('opera-patrons', ['Let the patrons pay', 'If people love opera, they’ll buy tickets. And they do.', 'The private opera sold out its season. Expensive tickets. Nobody minded.'], { p: 0 }, { p: 6, l: 3, in: 1 }),
      sound('opera-land', ['Sell the land to a theatre company', 'Somebody wants to build a theatre? Sell them the land and wish them luck.', 'The new theatre runs Mozart and a musical about Mises. Both sell out.'], { p: 2 }, { p: 6, l: 2, in: 2 }),
      sound('opera-nein', ['Say no, politely, in German', '“Nein, danke.” Then hum some Mozart. It’s free.', 'Vienna sulked. Everyone else kept their money.'], { p: 0, l: 2 }, { p: 5, l: 2, in: 1 }),
      disguised('opera-credit', ['A tax credit for culture', 'It isn’t a subsidy, it’s a tax credit. Completely different.', 'The culture tax credit now funds 300 “cultural” consultants.'], { p: 3 }, { p: -9, l: -5, in: 1 }),
      disguised('opera-stake', ['A modest state stake', 'Just 49%. A minority stake. Barely the state at all.', 'The opera ran 400% over budget. The state’s 49% became 100%.'], { p: 4 }, { p: -11, l: -4, in: 2 }),
      blatant('opera-state', ['Build the State Opera', 'Every civilized country needs a state opera. And a state opera tax.', 'The State Opera premiered. The opera tax will outlive us all.']),
    ],
  },
  {
    id: 'housing',
    title: 'Housing Shortage',
    emoji: '🏠',
    text: 'Rents are up again. Young people are living with their parents until 40.',
    hit: { p: -5 },
    policies: [
      sound('house-zoning', ['Scrap the zoning rules', 'Let people build. Up, out, anywhere they own the land.', 'Cranes everywhere. Rents are falling for the first time in years.'], { p: -1 }, { p: 9, l: 2, in: 2 }),
      sound('house-land', ['Sell off the public land', 'The state owns half the land in town and builds nothing on it.', 'The old state lots are flats now. Thousands of them.']),
      sound('house-rents', ['Let rents rise, for now', 'High rents tell builders where to build. Then rents fall.', 'Builders followed the rents. Now there are flats to spare.'], { p: -3 }, { p: 10, l: 1, in: 1 }),
      disguised('house-stabilize', ['Rent stabilization', 'Not rent control. Rent stabilization. Gentle, market-based stabilization.', 'Landlords stopped repairing anything. Stabilized, all right.']),
      disguised('house-grants', ['First-time buyer grants', 'Help young people buy! The money goes straight to them. Well, to the sellers.', 'The grants pushed house prices up by exactly the size of the grant.'], { p: 5 }, { p: -10, l: -4, in: 1 }),
      blatant('house-council', ['Build council flats', 'The state builds the flats, the state picks the tenants. Like Vienna. Vienna loves it.', 'The council flats have a twelve-year waiting list and a ministry to run it.']),
    ],
  },
  {
    id: 'strike',
    title: 'General Strike',
    emoji: '✊',
    text: 'The unions want a 30-hour week at 40 hours’ pay, and they’ve shut down the trams until they get it.',
    hit: { p: -6 },
    policies: [
      sound('strike-free', ['Let employers negotiate freely', 'Each firm settles with its own workers. No national deal.', 'Most firms settled in a week. The rest found people who wanted the job.']),
      sound('strike-closed', ['Repeal the closed-shop laws', 'Nobody should have to join a union to get a job.', 'Union membership is voluntary now. The trams run again.'], { p: -1, l: 3 }, { p: 7, l: 1, in: 1 }),
      sound('strike-wait', ['Wait it out', 'Strike funds run dry. Contracts get signed. Patience.', 'The strike fizzled out. Nobody had to pass a law about it.'], { p: -3 }, { p: 9, l: 1, in: 1 }),
      disguised('strike-council', ['A social partnership council', 'Unions, bosses and the state round one table. So cooperative!', 'The partnership council now sets every wage in the country.'], { p: 5 }, { p: -10, l: -6, in: 2 }),
      disguised('strike-minwage', ['A minimum wage, but small', 'A small minimum wage. Tiny. It won’t hurt anyone.', 'The tiny minimum wage priced the youngest workers out of their jobs.']),
      blatant('strike-law', ['Legislate the 30-hour week', 'Regulate everything. Start with the working week.', 'The 30-hour week cut output by a quarter. Pay followed.']),
    ],
  },
  {
    id: 'inflation',
    title: 'Prices Are Rising',
    emoji: '🎈',
    text: 'Bread costs more every week. Somebody somewhere has been printing a lot of something.',
    hit: { p: -5 },
    policies: [
      sound('infl-stop', ['Stop printing', 'Whoever is printing money, take the printer away from them.', 'Prices stopped climbing. Savers can breathe again.'], { p: -3 }, { p: 10, l: 1, in: 1 }),
      sound('infl-gold', ['Back the currency with gold', 'Tie it to something nobody can print.', 'The currency is boring now. Boring is beautiful.']),
      sound('infl-compete', ['Let competing currencies circulate', 'Let people pay in whatever they like. Bad money loses customers.', 'Shops take gold, francs and three kinds of coin. Prices are steady in all of them.'], { p: -1, l: 2 }, { p: 7, l: 2, in: 2 }),
      disguised('infl-controls', ['Price controls on essentials', 'Only on bread and milk. Essentials.', 'Bread is cheap now. There just isn’t any.']),
      disguised('infl-cheque', ['An inflation relief cheque', 'Send everyone a bit of money to cope with the prices.', 'The relief cheques pushed prices up again. Who could have guessed.'], { p: 6 }, { p: -11, l: -3, in: 1 }),
      blatant('infl-print', ['Print more to keep up', 'If prices rise, print more so everyone can still afford them!', 'Bread is now sold by the gram and paid for by the wheelbarrow.']),
    ],
  },
  {
    id: 'imports',
    title: 'Cheap Swiss Chocolate',
    emoji: '🍫',
    text: 'Swiss chocolate is flooding the shops at half the price. Local chocolatiers are furious.',
    hit: { p: -3 },
    policies: [
      sound('trade-free', ['Keep trade free', 'Cheaper chocolate for everyone. That’s the point of trade.', 'Everyone eats better chocolate. The chocolatiers switched to pralines and do fine.'], { p: 1 }, { p: 6, l: 2, in: 1 }),
      sound('trade-zero', ['Cut the last tariffs to zero', 'While we’re at it: no tariffs on anything.', 'Imports are cheaper across the board. Exporters are booming too.'], { p: -1, l: 2 }, { p: 8, l: 1, in: 2 }),
      sound('trade-adapt', ['Let the chocolatiers adapt', 'They can specialize, or make something else. Nobody owes them customers.', 'Local chocolate went upmarket. The tourists love it.']),
      disguised('trade-fee', ['An anti-dumping fee', 'Not a tariff. A fee. For fairness.', 'The “fee” doubled the price of chocolate. The Swiss just sell elsewhere.']),
      disguised('trade-local', ['Buy-local subsidies', 'Support local chocolate! With a small subsidy. From taxes. Local taxes.', 'The local chocolate subsidy now costs more than the chocolate.'], { p: 4 }, { p: -10, l: -4, in: 2 }),
      blatant('trade-ban', ['Ban Swiss chocolate', 'Ban it. National chocolate for a national people.', 'Chocolate smuggling is now the country’s fastest-growing industry.']),
    ],
  },
  {
    id: 'snow',
    title: 'No Snow This Winter',
    emoji: '❄️',
    text: 'The ski season is a washout. The resorts want help, and they’ve hired a lobbyist in lederhosen.',
    hit: { p: -5 },
    policies: [
      sound('snow-adapt', ['Let the resorts adapt or close', 'Some will make snow, some will sell hiking, some will close. That’s fine.', 'The resorts that survived run summer hiking now. They’re doing better than ever.'], { p: -3 }, { p: 9, l: 1, in: 1 }),
      sound('snow-tax', ['Cut their taxes, not cheques', 'Let them keep what they earn. No handouts.', 'Lower taxes, and three new ski lifts. Built with their own money.']),
      sound('snow-land', ['Let them sell land to developers', 'Unused slopes, new chalets. Let them sell.', 'New chalets on the old slopes. The resorts paid off their debts.'], { p: 0 }, { p: 6, l: 2, in: 2 }),
      disguised('snow-loans', ['Cheap loans for resorts', 'A little low-interest credit to get them through the winter.', 'The cheap loans kept zombie resorts open. Now they owe twice as much.']),
      disguised('snow-board', ['A tourism marketing board', 'Promote the country! A board of experts, publicly funded, privately minded.', 'The tourism board spent its whole budget on a jingle.'], { p: 3 }, { p: -9, l: -5, in: 1 }),
      blatant('snow-nationalize', ['Nationalize the ski lifts', 'The people’s ski lifts. Free for everyone, paid for by everyone.', 'The people’s ski lifts are free. They also don’t run on weekends.']),
    ],
  },
  {
    id: 'pensions',
    title: 'The Pension Hole',
    emoji: '👴',
    text: 'The state pension fund has promised far more than it has. Far, far more.',
    hit: { p: -4, l: -2 },
    policies: [
      sound('pens-optout', ['Let people opt out and save', 'Let anyone leave the scheme and keep their own savings.', 'Half the country opted out. Their savings are growing nicely.'], { p: -2, l: 3 }, { p: 7, l: 2, in: 2 }),
      sound('pens-cut', ['Cut the promises to what’s there', 'You can’t pay out money that doesn’t exist. Say so now.', 'Painful news, honestly told. The fund is solvent for the first time in decades.'], { p: -4 }, { p: 10, l: 1, in: 1 }),
      sound('pens-sell', ['Sell state assets to fill it', 'The state owns hotels, a bank and a porcelain factory. Sell them.', 'The porcelain factory sold for a fortune. The hole is half filled.']),
      disguised('pens-borrow', ['Borrow to cover it, just this once', 'Just this once. Interest rates are low. What could go wrong?', 'Rates went up. “Just this once” now costs a tenth of the budget.']),
      disguised('pens-payroll', ['Raise contributions a little', 'Only a little. Workers won’t even notice.', 'Workers noticed. Hiring slowed, and the hole kept growing.'], { p: 3 }, { p: -10, l: -5, in: 2 }),
      blatant('pens-taxes', ['Raise all taxes to cover it', 'Everyone pays more. Simple. Fair. Austrian.', 'Taxes are up across the board. The hole is still there.']),
    ],
  },
  {
    id: 'merger',
    title: 'The Big Schnitzel Merger',
    emoji: '🍖',
    text: 'The two biggest schnitzel chains want to merge. Half the country is outraged on principle.',
    hit: { l: -3 },
    policies: [
      sound('merge-allow', ['Let them merge', 'If they get too greedy, somebody opens a schnitzel stand next door.', 'The merged chain raised prices. Twelve new schnitzel stands opened that month.'], { p: 1 }, { p: 6, l: 2, in: 1 }),
      sound('merge-licence', ['Scrap the restaurant licence', 'The real monopoly is the licence you need to open a kitchen.', 'Anyone can fry a schnitzel now. Prices fell everywhere.'], { p: 0, l: 2 }, { p: 7, l: 2, in: 2 }),
      sound('merge-ignore', ['Ignore it entirely', 'Two companies want to become one. Not the council’s business.', 'Nobody remembers what the fuss was about.']),
      disguised('merge-board', ['Approve it, with a price-review board', 'Approve the merger, and a small board to keep prices fair.', 'The price-review board now reviews the price of everything fried.']),
      disguised('merge-breakup', ['Break it up, but gently', 'A gentle break-up. Market-friendly antitrust.', 'The gentle break-up took four years of lawyers. The lawyers did great.'], { p: 4 }, { p: -10, l: -5, in: 2 }),
      blatant('merge-nationalize', ['Nationalize schnitzel', 'The schnitzel belongs to the people.', 'The state schnitzel is thin, grey and available Tuesdays.']),
    ],
  },
  {
    id: 'roads',
    title: 'Potholes Everywhere',
    emoji: '🛣️',
    text: 'The roads are falling apart. A tram fell into a pothole last week. It’s still there.',
    hit: { p: -4 },
    policies: [
      sound('roads-sell', ['Privatize the roads', 'Privatize Vienna plz. Start with the roads.', 'The toll companies fixed every pothole. Customers complain less than voters did.'], { p: -2, l: 2 }, { p: 8, l: 2, in: 2 }),
      sound('roads-streets', ['Let neighbourhoods own their streets', 'Every street owned by the people who live on it.', 'The residents fixed their own streets. Some planted trees.']),
      sound('roads-auction', ['Auction the highways', 'Sell the highways to the highest bidder. They’ll want customers.', 'The highway buyer resurfaced the lot to win drivers back.'], { p: 1 }, { p: 7, l: 1, in: 1 }),
      disguised('roads-bank', ['An infrastructure bank', 'A bank that only lends for roads. Very businesslike. State-backed, of course.', 'The infrastructure bank funded a bridge to nowhere. Then another.']),
      disguised('roads-ppp', ['A public-private toll partnership', 'Private tolls, with guaranteed returns from the treasury.', 'The guaranteed returns were guaranteed. The roads, less so.'], { p: 5 }, { p: -11, l: -4, in: 2 }),
      blatant('roads-programme', ['A big state road programme', 'A five-year road plan. Our planners have never been wrong.', 'Year three of the five-year road plan. The pothole has a plaque.']),
    ],
  },
  {
    id: 'recession',
    title: 'Recession',
    emoji: '📉',
    text: 'Output is down two quarters running. Everyone is shouting for a stimulus.',
    hit: { p: -6 },
    policies: [
      sound('rec-clear', ['Let the bust clear the malinvestment', 'The boom built things nobody wanted. Let them go, and start again on solid ground.', 'The bad investments are gone. The recovery is real this time.'], { p: -4 }, { p: 11, l: 1, in: 1 }),
      sound('rec-cut', ['Cut spending and taxes', 'Less state, more room for everyone else to fix things.', 'Lower taxes, a smaller state, and business is picking up.']),
      sound('rec-adjust', ['Let wages and prices adjust', 'Prices fall, wages fall, people get back to work. It’s how it heals.', 'Prices settled, hiring picked up. Nobody needed a programme.'], { p: -3 }, { p: 9, l: 1, in: 1 }),
      disguised('rec-shovel', ['A shovel-ready stimulus', 'Only shovel-ready projects. Very targeted. Very temporary.', 'The shovel-ready projects needed six years of permits. And more shovels.']),
      disguised('rec-zero', ['Cut interest rates to zero', 'Cheap money for everyone! Zero percent, just for a while.', 'Zero rates blew a new bubble. It has started popping.'], { p: 6 }, { p: -12, l: -3, in: 2 }),
      blatant('rec-holes', ['Dig holes and fill them in', 'Pay people to dig holes, then pay them to fill them in. Growth!', 'The holes were filled in. So was the budget.']),
    ],
  },
];

export const crisisById = (id: string) => CRISES.find((c) => c.id === id);
export const policyById = (id: string): Policy | undefined => {
  for (const c of CRISES) {
    const p = c.policies.find((x) => x.id === id);
    if (p) return p;
  }
  return undefined;
};
