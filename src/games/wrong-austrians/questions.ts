// The interview questions. Each has answers a real Austrian School economist gives, near-misses that
// sound free-market but that anyone who has read Mises would object to (with why, for the case file
// at the end), and outright statist slips. The Viennese have read the brochures: they get it right
// about half the time, and their mistakes are mostly near-misses. Real Austrians get it wrong
// sometimes too.

export interface NearMiss {
  text: string;
  /** What an Austrian would object to. */
  why: string;
}

export interface Question {
  id: string;
  q: string;
  /** What a real Austrian School economist says. */
  sound: string[];
  /** Sounds pro-market, but isn't Austrian. */
  near: NearMiss[];
  /** Gives away a statist outright. */
  slips: string[];
}

const n = (text: string, why: string): NearMiss => ({ text, why });

export const QUESTIONS: Question[] = [
  {
    id: 'cycle',
    q: 'What causes the business cycle?',
    sound: [
      'Cheap credit. The central bank pushes rates down and people invest in things nobody really wants.',
      'Malinvestment, from interest rates held below where the market would put them.',
      'Credit expansion. Entrepreneurs start projects that the real savings can’t finish.',
    ],
    near: [
      n('Technology shocks, mostly. Booms and busts are just the economy adjusting to new inventions.', 'That’s real business cycle theory (Kydland and Prescott). Austrians blame credit expansion, not technology.'),
      n('Speculators and greed. Markets overshoot, then correct.', 'Blaming greed misses the point: the Austrian theory is about cheap credit sending the same false signal to everyone at once.'),
      n('Too little money. The Fed let the money supply shrink, like in 1929.', 'That’s Friedman’s monetarism. Austrians see the credit boom of the 1920s as the cause, and the bust as the correction.'),
    ],
    slips: ['Animal spirits. Which is why the Finance Ministry needs a bigger budget.', 'Not enough government spending, mostly. Keynes was very clear.'],
  },
  {
    id: 'rates',
    q: 'Who should set interest rates?',
    sound: ['Nobody. Savers and borrowers, between them.', 'The market. Interest is the price of time.', 'Time preference does: how much people value now over later.'],
    near: [
      n('An independent central bank following a strict rule, like the Taylor rule.', 'A rule-bound central bank is still a central planner of the price of time. Austrians want nobody setting it.'),
      n('The central bank, but it should keep them a bit higher than now.', 'Higher or lower, a committee picking the rate is the problem. The rate should come from savers and borrowers.'),
      n('Interest is just the price of money, so whoever issues the money.', 'Interest isn’t the price of money; it’s the price of time, as Böhm-Bawerk and Mises explained.'),
    ],
    slips: ['A wise committee in Vienna. I know some of them personally.', 'The central bank, obviously. Who else would?'],
  },
  {
    id: 'minwage',
    q: 'What is the minimum wage?',
    sound: [
      'A law that makes it illegal to hire anyone whose work is worth less than it.',
      'Unemployment for the least skilled, with good intentions.',
      'A price floor on labour. Set it above what someone produces and they’re priced out.',
    ],
    near: [
      n('A bad idea, unless it’s indexed to local living costs.', 'Indexing doesn’t fix a price floor: anyone whose work is worth less than it is still priced out.'),
      n('Fine as long as it’s low. A small minimum wage doesn’t hurt anyone.', 'A “small” floor still bans the jobs worth less than it. And it rarely stays small.'),
      n('Better to replace it with a negative income tax.', 'That’s Milton Friedman’s idea: welfare run through the tax office. Free-market-ish, not Austrian.'),
    ],
    slips: ['A floor of dignity. My cousin at the Chamber of Labour explained it to me.', 'Social justice, with a number on it.'],
  },
  {
    id: 'hero',
    q: 'Name a great Austrian economist.',
    sound: ['Mises. Or Menger, who started the whole thing.', 'Hayek. Böhm-Bawerk. Rothbard, if you let an American in.', 'Menger, Böhm-Bawerk, Mises, Hayek. And Rothbard, the honorary Austrian from the Bronx.'],
    near: [
      n('Ludwig von Misses! I loved his book, Human Actions.', 'Mises, not “Misses”. And the book is Human Action, singular.'),
      n('F.A. Kayak, of course.', 'Hayek. Not a boat.'),
      n('Murray Rothberd. And Milton Friedman, the greatest of them all.', 'Rothbard, with an a. And Friedman was the Chicago School, a monetarist. Not Austrian.'),
      n('David Friedman. The Machinery of Freedom changed my life.', 'A great book, but the wrong school: David Friedman argues from Chicago-style price theory and consequences, not praxeology.'),
      n('Schumpeter. Born in Moravia, taught in Vienna, so he counts.', 'Schumpeter studied under Böhm-Bawerk but went his own way: he thought socialism would win, and loved Walras’s equilibrium. Not one of the school.'),
    ],
    slips: ['The governor of the Nationalbank? Lovely man. We golf.', 'Keynes. Well, he visited Vienna once.'],
  },
  {
    id: 'prices',
    q: 'What are prices for?',
    sound: [
      'They carry information. Nobody could plan anything without them.',
      'They’re signals. They tell everyone what’s scarce and what isn’t.',
      'Coordination: they tell people far away what to economize on, without anyone knowing why.',
    ],
    near: [
      n('They reflect how much labour went into making something.', 'That’s the labour theory of value (Smith, Ricardo, Marx). Austrians hold that value is subjective: prices come from people’s valuations.'),
      n('They tell you what something is objectively worth.', 'Nothing has an objective worth. Value is subjective; a price is just where two different valuations met.'),
      n('Mostly they cover costs, plus a fair margin.', 'Prices aren’t set by costs. Costs are prices too, and they come from what consumers value (imputation, Menger).'),
    ],
    slips: ['Prices are something the state should keep fair, mostly.', 'That’s a matter for the Price Commission, I believe.'],
  },
  {
    id: 'recession',
    q: 'What would you do in a recession?',
    sound: ['Let it clear out the bad investments. The bust is the cure, not the disease.', 'Cut spending, cut taxes, and get out of the way.', 'Nothing, loudly. Let prices and wages adjust. 1921 was over in a year.'],
    near: [
      n('Cut taxes, and have the central bank cut rates a little to cushion it.', 'Cutting rates is what caused the boom. More cheap credit props up the very malinvestment the bust should clear.'),
      n('Have the central bank print just enough to keep spending steady.', 'That’s market monetarism (nominal GDP targeting). Austrians say it just restarts the boom.'),
      n('Bail out only the banks that are too big to fail.', 'Austrians would let them fail. Bailouts protect the malinvestment the recession is liquidating, and teach recklessness.'),
    ],
    slips: ['A stimulus! Shovel-ready, of course.', 'Lower interest rates and build a nice new railway station.'],
  },
  {
    id: 'neutral',
    q: 'Is money neutral?',
    sound: [
      'No. New money reaches some people first, and they gain at everyone else’s expense.',
      'No. Whoever’s closest to the printing press wins. Cantillon worked that out in 1730.',
      'Never. New money shifts relative prices and wealth along its path.',
    ],
    near: [
      n('In the long run, yes. It only matters in the short run.', 'That’s the mainstream view, and Friedman’s. Austrians say money is never neutral: it changes relative prices and who gets what.'),
      n('Yes, as long as inflation is low and predictable.', 'Even predictable inflation moves wealth to whoever gets the new money first.'),
      n('Money is just a veil over the real economy.', 'The “veil” view is exactly what Mises rejected: money changes relative prices and production.'),
    ],
    slips: ['Neutral enough to print a little more, I’d say.', 'Money is whatever the state says it is. That’s what makes it so convenient.'],
  },
  {
    id: 'tax',
    q: 'What’s your favourite tax?',
    sound: ['Zero. Cut all taxes to 0%.', 'The one we abolish next.', 'None. Taxation is theft, with paperwork.'],
    near: [
      n('A flat tax. Simple, fair, and nobody needs an accountant.', 'A flat tax is still a tax. Austrians (Rothbard especially) don’t pick a favourite form of theft.'),
      n('A land value tax. Even economists love it.', 'That’s Henry George, not the Austrian School. Rothbard wrote a whole essay against it.'),
      n('Consumption taxes. They encourage saving.', 'Better than an income tax, perhaps, but a tax on spending is still a tax. There’s no good one.'),
    ],
    slips: ['A wealth tax. Very fair. Very popular at dinner parties.', 'VAT. Twenty percent, like back home.'],
  },
  {
    id: 'praxeology',
    q: 'What is praxeology?',
    sound: [
      'The logic of human action: people act on purpose, to reach a state they prefer.',
      'Economics from first principles. Humans act. Everything else follows.',
      'The science of human action, deduced from the axiom that people act. Mises named it.',
    ],
    near: [
      n('The study of the psychological reasons humans act!', 'Praxeology is specifically not psychology. It doesn’t ask why people want what they want, only what follows from the fact that they act.'),
      n('Economics tested with experiments and data, like behavioural economics.', 'Praxeology is a priori: its laws are deduced, not tested. Data illustrates history; it can’t prove or refute the theory.'),
      n('A branch of game theory about rational choice.', 'Praxeology doesn’t assume people are “rational” in the game-theory sense, only that they act on purpose, whatever their goals.'),
    ],
    slips: ['Some kind of physiotherapy, I think? My knee could use it.', 'It sounds Greek. Is it funded by the EU?'],
  },
  {
    id: 'planning',
    q: 'Could a central planner run the economy?',
    sound: [
      'No. The knowledge is scattered across millions of people. Nobody can gather it all.',
      'No. Without market prices for capital goods, there’s no way to calculate.',
      'No. Mises showed it in 1920: no private property in capital, no prices, no calculation.',
    ],
    near: [
      n('Not yet. With enough data and AI, maybe someday.', 'The calculation problem isn’t about computing power: without property and exchange in capital goods, there are no prices to compute with.'),
      n('No, because planners are corrupt and lazy.', 'Incentives matter, but the Austrian point is deeper: even angels with supercomputers couldn’t calculate without market prices.'),
      n('No, because people won’t work hard without incentives.', 'That’s the incentive argument. Mises and Hayek made a different one: calculation, and knowledge that’s scattered.'),
    ],
    slips: ['With enough computers, why not?', 'Vienna’s planning office runs the trams on time. So: yes.'],
  },
  {
    id: 'phil',
    q: 'What do you think of the Vienna Philharmonic?',
    sound: ['Wonderful. I’d pay full price for a ticket.', 'A great orchestra. It shouldn’t need a subsidy to stay great.', 'Lovely. Sell tickets, find patrons, no Ministry required.'],
    near: [
      n('Wonderful. Culture is a public good, so a modest subsidy makes sense.', '“Public good” is the textbook excuse for subsidies. Austrians ask what people will freely pay for.'),
      n('Great, and it would be even better with a tax break for donors.', 'A tax break is a subsidy by other means: it still steers money by political choice.'),
      n('Excellent. It should be run by the city, but efficiently.', 'An efficient state orchestra is still a state orchestra.'),
    ],
    slips: ['Essential state infrastructure!', 'I have a season pass. Through the ministry.'],
  },
  {
    id: 'post',
    q: 'Should the state run the post office?',
    sound: ['No. Private couriers deliver faster and cheaper.', 'There’s no reason it should. Let anyone deliver letters.', 'Abolish the monopoly. Lysander Spooner tried in 1844, and the government shut him down.'],
    near: [
      n('Corporatize it: a state-owned company, run like a business.', 'State-owned and “run like a business” is still state-owned. Austrians want it sold, and the monopoly abolished.'),
      n('Privatize it, but keep a universal service guarantee, paid by the state.', 'A state guarantee is a subsidy and a mandate: the market doesn’t get to decide.'),
      n('Keep it public, but contract out the trucks.', 'Outsourcing the trucks leaves the monopoly where it was.'),
    ],
    slips: ['The Post is part of who we are. It must stay public.', 'Yes, and the telephones too, like in the good old days.'],
  },
  {
    id: 'inflation',
    q: 'What causes inflation?',
    sound: ['More money chasing the same goods. Someone has been printing.', 'Increasing the money supply. That’s what the word used to mean.', 'Monetary expansion. Rising prices are the symptom, not the disease.'],
    near: [
      n('Inflation has a variety of reasons, including money printing.', 'There’s one cause: more money. Prices rising after a bad harvest isn’t inflation, just scarcity.'),
      n('Wages rising faster than productivity.', 'That’s “cost-push”. Wages can’t push all prices up unless the money supply grows to pay for them.'),
      n('Rising prices. That’s what inflation means.', 'Mises insisted inflation means the increase in money; rising prices are its result. Mixing them up lets the printers off the hook.'),
    ],
    slips: ['Greedy shopkeepers, mostly.', 'Supply chains. And the weather. And bad luck.'],
  },
  {
    id: 'study',
    q: 'Where did you learn your economics?',
    sound: [
      'A summer school, then anywhere I could find a used copy of Human Action.',
      'In libraries, mostly. Hayek first, then Mises, then years of arguing.',
      'The Mises Institute’s summer university. Then Rothbard, cover to cover.',
    ],
    near: [
      n('The University of Chicago. Free markets all the way!', 'Chicago is the home of Friedman and Stigler: free-market, yes, but monetarist and positivist. Not Austrian.'),
      n('George Mason, with the public choice people.', 'Mason has Austrians, but public choice (Buchanan, Tullock) is a different school.'),
      n('Online. Mostly old clips of Milton Friedman.', 'Friedman again: a great communicator, but the Chicago School.'),
    ],
    slips: ['The University of Economics in Vienna, then twenty years at the Ministry.', 'A state scholarship, then a state job. Next up, a state pension.'],
  },
  {
    id: 'government',
    q: 'What’s the best form of government?',
    sound: ['As little as possible. Ideally none.', 'One that does nothing. And then less.', 'Private law: competing courts and defence agencies. Rothbard and Hoppe sketched it out.'],
    near: [
      n('Democracy. The people should vote on economic policy.', 'Mises warned voters can vote away property, and Hoppe called democracy “the god that failed”. Austrians don’t want majorities running the economy.'),
      n('A technocracy of free-market economists.', 'Hayek’s knowledge problem applies to free-market experts too: nobody knows enough to run things from the top.'),
      n('A strong leader who pushes market reforms through.', '“Reform from above” is still rule from above. Austrians don’t want a benevolent dictator.'),
    ],
    slips: ['A grand coalition, like the good old days.', 'A strong one, with a good social partnership.'],
  },
  {
    id: 'centralbank',
    q: 'Should we have a central bank?',
    sound: ['No. Free banking, competing currencies, gold if people want it.', 'End it. Let the market choose its own money.', 'No. It’s a cartel for the banks with a printing press attached.'],
    near: [
      n('Yes, with a rule in the constitution: grow the money supply 3% a year.', 'That’s Friedman’s k-percent rule. Austrians want no central bank, not a better-programmed one.'),
      n('Yes, but it should target zero inflation.', 'A central bank aiming at zero is still a central bank fixing the money. Austrians want market money.'),
      n('Replace it with a currency board pegged to the dollar.', 'Pegging to another central bank’s money is still fiat money. Gold, or free choice, is the Austrian answer.'),
    ],
    slips: ['Of course! The Nationalbank is a national treasure.', 'Yes, as long as it’s run by sensible people. Like me.'],
  },
  {
    id: 'rent',
    q: 'What do you make of rent control?',
    sound: ['The best way to destroy a city, short of bombing it.', 'Fewer flats, worse flats, and a waiting list.', 'A price ceiling on flats: shortages, decay, and a black market in sublets.'],
    near: [
      n('Bad, but some tenant protection is only fair.', '“Some” controls still cap a price and cause shortages. Fairness is the argument for all of them.'),
      n('Bad. Give renters housing vouchers instead.', 'Vouchers are a subsidy: still the state steering housing with other people’s money.'),
      n('Bad, unless there’s a genuine housing emergency.', 'There’s always an emergency. That’s how Vienna got a century of it.'),
    ],
    slips: ['Vienna has had it for a century, and look how nice Vienna is!', 'Necessary. For the flat I live in, at least.'],
  },
  {
    id: 'window',
    q: 'What’s the broken window fallacy?',
    sound: [
      'Thinking a broken window helps the economy because the glazier gets paid, and forgetting what wasn’t bought instead.',
      'Seeing what’s spent and forgetting what’s lost. Bastiat explained it, then Hazlitt.',
      'The seen and the unseen: the glazier’s gain is visible, the shoemaker’s lost sale isn’t.',
    ],
    near: [
      n('That broken windows lead to crime, so we need more police.', 'That’s the “broken windows” theory of policing. The fallacy is Bastiat’s: destruction doesn’t create wealth.'),
      n('That wars are good for the economy. Which is sometimes true.', 'Never true. The war spending is seen; what wasn’t produced instead is unseen. That’s the fallacy.'),
      n('That fixing things creates jobs, which is good in moderation.', 'It doesn’t create wealth at all: the money would have bought something else. No moderation about it.'),
    ],
    slips: ['That’s when windows get broken and the state has to fix them, right?', 'A building code violation, I believe.'],
  },
  {
    id: 'vienna',
    q: 'How would you privatize Vienna?',
    sound: ['Sell all of it. The streets, the trams, the Prater. Privatize Vienna plz.', 'The trams first, then the housing, then the opera.', 'Auction everything, give every Viennese a share, and let them sell it.'],
    near: [
      n('Carefully. Public-private partnerships for the trams.', 'Public-private partnerships keep the state in charge and the taxpayer on the hook. Privatize means sell.'),
      n('Sell the trams, but regulate the fares so nobody is priced out.', 'Regulated fares give you a private monopoly with state prices: the worst of both.'),
      n('Lease the council flats to a private manager, keep them publicly owned.', 'Leasing out the management isn’t privatizing ownership.'),
    ],
    slips: ['Privatize… Vienna? Why would anyone say such a thing?', 'Maybe the gift shops. Not the rest. Never the rest.'],
  },
  {
    id: 'fair',
    q: 'What’s a fair price?',
    sound: ['Whatever two people freely agree on.', 'There’s no such thing as a fair price, only an agreed one.', 'The one both sides accept. Anything else is somebody’s opinion.'],
    near: [
      n('Whatever the entrepreneur wants it to be!', 'Not quite: a price takes two. An entrepreneur can ask anything; they only get what a buyer accepts.'),
      n('Cost plus a reasonable profit.', 'That’s the medieval “just price” in modern dress. Costs don’t set prices, and nobody knows what “reasonable” is.'),
      n('The price in a perfectly competitive market.', '“Perfect competition” is a textbook model with no entrepreneurs in it. Austrians reject it as a yardstick.'),
    ],
    slips: ['Whatever the Price Commission decides.', 'The price my uncle charges. Plus a small subsidy.'],
  },
  {
    id: 'value',
    q: 'Where does value come from?',
    sound: ['From people. Things are worth what someone wants them for: value is subjective.', 'Subjective valuation, at the margin. Menger, 1871.', 'From the eye of the beholder, one unit at a time.'],
    near: [
      n('From the labour and materials that go into a product.', 'That’s the labour theory of value. The marginal revolution (Menger) replaced it with subjective value.'),
      n('From utility, which we can measure and add up across people.', 'Austrians hold value is ordinal: you can rank your preferences, not measure them or add them up across people.'),
      n('From scarcity: the rarer something is, the more it’s worth.', 'Rarity alone isn’t value: a unique bad painting is rare and worthless. Someone has to want it.'),
    ],
    slips: ['From the state, which decides what’s essential.', 'From the five-year plan.'],
  },
  {
    id: 'gold',
    q: 'Should money be backed by gold?',
    sound: ['If people choose gold, yes. Money should come from the market, not a decree.', 'Gold became money on its own. That’s the regression theorem.', 'A 100% reserve gold standard. No fractional tricks.'],
    near: [
      n('Yes: a gold standard, run by the central bank at a fixed price.', 'A central bank managing a gold peg can still inflate and devalue, as Bretton Woods did.'),
      n('Gold, with 10% reserves so banks can still lend.', 'Rothbard and Huerta de Soto call fractional reserves fraud: they create money out of nothing, gold standard or not.'),
      n('Yes, because gold stops prices from ever changing.', 'Prices still change under gold; mining adds money too. The point is market money, not frozen prices.'),
    ],
    slips: ['Gold? A barbarous relic. Keynes said so.', 'Money is backed by the full faith of the state. Isn’t that enough?'],
  },
  {
    id: 'saving',
    q: 'Is saving good for the economy?',
    sound: ['Yes. Savings fund the capital that makes us richer.', 'Savings lower interest rates and lengthen the structure of production.', 'Every bit of capital started as someone not consuming.'],
    near: [
      n('In moderation. Too much saving causes recessions: the paradox of thrift.', 'That’s Keynes. Austrians say saving funds investment: it shifts production, it doesn’t destroy demand.'),
      n('Yes, as long as the banks lend it all out, ideally ten times over.', 'That’s fractional reserve lending. Austrians see lending money that isn’t there as the source of the boom.'),
      n('Yes, and the government should make everyone save, like Singapore.', 'Forced saving is a state mandate. Austrians want people to choose their own time preference.'),
    ],
    slips: ['No. Spending is patriotic. Saving is hoarding.', 'Saving is what you do when you don’t have a good state pension.'],
  },
  {
    id: 'monopoly',
    q: 'Are monopolies a market failure?',
    sound: ['Only the state makes lasting monopolies, with licences and charters.', 'Without barriers to entry, a high price is an invitation to competitors.', 'The real monopolies have charters: the Post, the central bank.'],
    near: [
      n('Yes. Natural monopolies like utilities need regulating.', 'Austrians argue “natural monopoly” is a myth: the classic examples were created by state franchises.'),
      n('Sometimes, and that’s what antitrust law is for.', 'Antitrust punishes success, and competitors use it as a weapon. Austrians reject it.'),
      n('Big firms are inefficient and should be broken up.', 'Size isn’t the problem. If the big firm serves customers worse, someone will take them. Breaking it up is planning.'),
    ],
    slips: ['Yes, which is why the state should own the big industries.', 'Market failure is everywhere. That’s what ministries are for.'],
  },
  {
    id: 'capital',
    q: 'What is capital?',
    sound: ['Produced means of production, in a structure of stages that takes time.', 'Heterogeneous goods, each with specific uses. You can’t just add them up.', 'Higher-order goods: tools to make tools to make bread.'],
    near: [
      n('A big pool of money that firms draw on.', 'Capital isn’t money; it’s specific goods (machines, buildings) that fit together in stages.'),
      n('K in the production function. Add labour, get output.', 'Austrians reject treating capital as one homogeneous lump. It’s a structure (Böhm-Bawerk, Hayek, Lachmann).'),
      n('The stock market, basically.', 'Shares are claims on capital, not capital itself.'),
    ],
    slips: ['Something to be redistributed.', 'What the bourgeoisie has, and the state should.'],
  },
  {
    id: 'entrepreneur',
    q: 'What does an entrepreneur do?',
    sound: [
      'Bears uncertainty: buys resources now, betting on what people will want later.',
      'Spots opportunities nobody else noticed. Kirzner called it alertness.',
      'Acts on judgment about the future, and lives with the profit or the loss.',
    ],
    near: [
      n('Takes calculated risks, like an insurance company.', 'Austrians (with Knight) separate risk from uncertainty. Entrepreneurship is about what can’t be calculated.'),
      n('Optimizes a known production function.', 'If everything is known, there’s nothing for an entrepreneur to do. Austrian economics is about discovery.'),
      n('Exploits workers, but creates jobs, so it evens out.', 'Profit isn’t exploitation. It’s the reward for correctly anticipating what consumers want.'),
    ],
    slips: ['Applies for grants.', 'Fills in permit forms, mostly.'],
  },
  {
    id: 'profit',
    q: 'What is profit for?',
    sound: ['It shows you used resources better than others did. Losses show the opposite.', 'It rewards anticipating what consumers wanted.', 'It’s a signal: keep doing this. A loss says stop.'],
    near: [
      n('It’s fine, as long as it’s reasonable and not price gouging.', 'Who decides “reasonable”? High profits in a shortage attract supply; capping them makes it last.'),
      n('It’s the return on capital, about 5% a year.', 'That’s interest (time preference). Profit is what entrepreneurial foresight earns on top, and it can be negative.'),
      n('Paying the shareholders, mostly.', 'True on a spreadsheet, but it misses the point: profit is the market telling you what people want more of.'),
    ],
    slips: ['Profit is theft, mostly.', 'Profit is what the windfall tax is for.'],
  },
  {
    id: 'trade',
    q: 'What about free trade?',
    sound: ['Unilateral free trade. Tariffs are taxes on your own people.', 'Trade with anyone, any time, no treaty needed.', 'The division of labour across borders. Mises loved it.'],
    near: [
      n('Yes, through big trade agreements like the EU single market.', 'Thousands of pages of managed trade aren’t free trade. Austrians want it unilateral, no treaties needed.'),
      n('Free trade, but with tariffs against countries that cheat.', 'Retaliatory tariffs tax your own consumers to punish someone else’s government.'),
      n('Free trade is good, as long as the trade balance stays even.', 'Trade deficits aren’t a problem to balance. Mercantilists worried about them; Austrians don’t.'),
    ],
    slips: ['Protect our industries! Austrian jobs for Austrian workers.', 'Tariffs on everything with a German name.'],
  },
  {
    id: 'stimulus',
    q: 'Does government spending create growth?',
    sound: [
      'No. It moves resources from where people want them to where politicians want them.',
      'The spending is seen; the private projects it crowded out are not.',
      'Every euro it spends was taken from someone who would have spent it better.',
    ],
    near: [
      n('Only infrastructure spending. Roads pay for themselves.', 'Without a market price, nobody knows whether they pay for themselves. Austrians would privatize the roads.'),
      n('A little, in the short run, but it adds to the debt.', 'The “short-run boost” is the broken window fallacy: the spending is seen, what it displaced isn’t.'),
      n('It works if experts spend it efficiently.', 'Without profit and loss there’s no way to know what “efficient” even is.'),
    ],
    slips: ['Yes! That’s what the multiplier is for.', 'The more the state spends, the richer we get. Obviously.'],
  },
  {
    id: 'property',
    q: 'Why does private property matter?',
    sound: ['Without it there’s no exchange, no prices, no calculation.', 'Self-ownership first, then homesteading. Everything follows.', 'It settles who decides over scarce things, without a fight.'],
    near: [
      n('Because it’s efficient, as long as the state defines it well.', 'Property comes before the state (homesteading, Rothbard). The state is its greatest violator.'),
      n('It matters, but eminent domain is fine for big projects.', 'Taking property for a “big project” is exactly what property rights forbid.'),
      n('It gives people an incentive to work.', 'Incentives, yes, but the Austrian point is calculation: without property, no prices.'),
    ],
    slips: ['Property is theft. Proudhon said so.', 'It matters, so the state should own as much of it as possible.'],
  },
  {
    id: 'bubble',
    q: 'What causes stock market bubbles?',
    sound: ['Cheap credit. Easy money has to go somewhere, and it goes into assets.', 'Central banks holding rates down. The boom shows up wherever the new money lands first.', 'Credit expansion, again. Same disease, different patient.'],
    near: [
      n('Irrational exuberance. Investors are just emotional.', 'Austrians look for why everyone errs at once, and find distorted signals from cheap credit, not moods.'),
      n('Bubbles don’t exist. Markets are always efficient.', 'That’s the efficient-market hypothesis (Chicago). Austrians do see bubbles, caused by credit expansion.'),
      n('Short sellers. Short selling should be banned.', 'Short sellers help prices find the truth. Banning them is a price control.'),
    ],
    slips: ['Speculators. Arrest them.', 'Capitalism. Obviously.'],
  },
  {
    id: 'health',
    q: 'How should healthcare work?',
    sound: ['A market: prices, competition, charity. No insurance mandates.', 'Let doctors and patients agree on prices. Abolish the licensing cartel.', 'Like anything else people need: supplied by people who want to supply it.'],
    near: [
      n('Private, with an individual mandate to buy insurance.', 'A mandate is a state order to buy a product.'),
      n('Health savings accounts, subsidized with tax breaks.', 'Better than most, but a tax-subsidized account is still the state steering spending.'),
      n('Mostly private, with a public option for fairness.', 'A public option competes with taxpayers’ money, and it always grows.'),
    ],
    slips: ['A single state health service. Like the Post, but sicker.', 'Free for everyone, paid for by the rich.'],
  },
];
