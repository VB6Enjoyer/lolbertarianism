// The interview questions. Each has answers a real Austrian School economist gives, near-misses that
// sound free-market but that anyone who has read Mises would object to (with why, for the case file
// at the end; the last two of each are the hard ones, where the slip is in a technical detail), and
// outright statist slips. The Viennese have read the brochures: they get it right
// about half the time, and their mistakes are mostly near-misses. Real Austrians get it wrong
// sometimes too.

export interface NearMiss {
  text: string;
  /** What an Austrian would object to. */
  why: string;
  /** A technical one: the slip is in a detail only someone who knows the school would catch. Hard and Expert use only these. */
  hard?: boolean;
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
/** A technical near-miss (Hard and Expert use only these). */
const x = (text: string, why: string): NearMiss => ({ text, why, hard: true });

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
      x('Credit expansion, but only once it pushes real rates below zero. Negative real rates are what do the damage.', 'It isn’t about real rates against inflation. What matters is the market rate pushed below the natural rate set by time preference, even if real rates stay positive.'),
      x('Overinvestment. Cheap credit makes firms invest too much in everything, then they have to cut back.', 'Austrians say malinvestment, not overinvestment: credit expansion bends the structure of production towards long, early stages, rather than raising investment across the board.'),
      x('Credit expansion, and the bust is the economy falling back below its potential output.', '“Potential output” is a mainstream aggregate. For Austrians the bust isn’t a shortfall from potential but the discovery that resources were misallocated across the stages of production.'),
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
      x('The market. The central bank should just track the neutral rate it estimates.', 'Estimating a “neutral rate” and tracking it is still a committee setting the price of time with a guess: the knowledge problem again.'),
      x('Competing banks, free to lend out most of their deposits to keep rates low.', 'Lending out demand deposits is fractional reserve banking. Rothbard and Huerta de Soto see it as credit without real savings behind it, which pushes rates down artificially.'),
      x('At the marginal productivity of capital, which a good statistics office could estimate.', 'For Mises and Fetter interest isn’t the marginal productivity of capital but time preference, and no office can estimate the rate the market would set.'),
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
      x('Unemployment, because the demand curve for labour slopes down. It’s in every textbook diagram.', 'The conclusion is right but the reasoning is textbook comparative statics. An Austrian argues from action: nobody pays a worker more than the discounted value of what their work adds.'),
      x('It mostly hurts teenagers. For experienced workers it hardly matters, so a moderate one is harmless.', 'Anyone whose discounted marginal value product is below the floor is priced out, and hiring shifts to machines and the black market. “Moderate” doesn’t change the logic.'),
      x('It only causes unemployment where employers lack monopsony power. Elsewhere a modest floor can even raise employment.', 'The monopsony argument assumes a static employer with market power. Austrians answer that competition for workers erodes it, and the floor still bans every job worth less than it.'),
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
      x('Böhm-Bawerk, who showed that interest comes from the higher productivity of roundabout production.', 'Böhm-Bawerk is a hero, but Mises and Fetter corrected him on exactly this: interest comes from time preference, not from the productivity of roundabout methods.'),
      x('Wieser, the father of the school. He coined “marginal utility”.', 'Wieser did coin the German term, but the father of the school is Carl Menger. And Wieser drifted towards an interventionist “social economics” later on.'),
      x('Menger, whose Principles built the school on marginal analysis and mathematical equilibrium.', 'Menger rejected mathematical equilibrium (unlike Walras and Jevons). His marginalism was causal and verbal.'),
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
      x('They settle at equilibrium, where supply meets demand and all the information is already in them.', 'Austrians stress the process, not equilibrium. Prices are always moving, and entrepreneurs profit from their errors. If all the information were already in them, there’d be nothing left to discover.'),
      x('They measure value: a price tells you how much utility a good gives.', 'Prices don’t measure value. Value is ordinal and subjective; a price is a historical exchange ratio, not a quantity of utility.'),
      x('They aggregate all the available information perfectly. That’s why markets are efficient.', 'That’s the efficient-markets reading. Hayek’s point is that prices carry enough local knowledge to coordinate plans, not that they’re perfect; the errors are what entrepreneurs profit from.'),
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
      x('Cut spending, but keep unemployment benefits generous so demand doesn’t collapse.', 'Propping up “demand” is Keynesian reasoning. Subsidizing unemployment slows the move of workers to where the structure of production needs them.'),
      x('Cut taxes on investment, to rebuild the capital stock lost in the boom.', 'The boom didn’t just lose capital; it misshaped the structure of production. What’s needed is liquidation and reallocation, not more investment of any kind.'),
      x('Let wages fall, and the economy soon returns to the same structure of production as before.', 'Not the same structure: the boom’s malinvestments have to be liquidated and resources moved to a structure that matches people’s real time preferences.'),
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
      x('No, because of sticky prices: new money changes output until prices catch up.', 'Sticky prices is the New Keynesian reason. The Austrian reason is the Cantillon effect: new money enters at particular points and shifts relative prices for good, even if every price is flexible.'),
      x('It isn’t, so the central bank must inject new money carefully and evenly across the economy.', 'There’s no way to inject money evenly. The Cantillon effect can’t be avoided, which is why Austrians oppose the injecting.'),
      x('Only while prices adjust. Once they settle, relative prices are back where they were.', 'The Cantillon effect permanently changes relative prices and who owns what. The economy doesn’t go back to where it was.'),
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
      x('A head tax: the same amount from everyone, so it doesn’t distort any incentives.', 'That’s the textbook “non-distortionary” lump-sum tax. Austrians deny any tax is neutral: it still takes resources by force and moves them by political choice.'),
      x('Tariffs instead of an income tax, like the early United States.', 'Tariffs are taxes on consumers and on trade. No Austrian would pick them.'),
      x('A consumption tax, because it’s neutral between spending and saving.', 'No tax is neutral. Rothbard argued a consumption tax also falls on the income people save from, and it still moves resources to the state.'),
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
      x('The study of rational economic man maximizing his utility.', 'Praxeology isn’t about homo economicus. The ends can be anything, altruism or whim included; it only analyses the relation of means to ends.'),
      x('Economics built on assumptions that are roughly true, like perfect information, then checked against the data.', 'That’s Friedman’s methodology. Praxeology starts from a self-evident axiom and deduces; its propositions are apodictically true, not approximately.'),
      x('Economics deduced from axioms, so it holds only as long as the axioms happen to be empirically true.', 'For Mises the action axiom is a priori and self-evident (denying it is itself an action), not an empirical hypothesis that might turn out false.'),
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
      x('No. The economy is too complex and chaotic to model.', 'Complexity isn’t the argument. Even a simple economy without private property in the means of production couldn’t calculate: Mises’s point is the absence of prices.'),
      x('Market socialism could work: planners set prices by trial and error, as Lange suggested.', 'That was Oskar Lange’s reply, and Mises and Hayek answered it: prices set by planners aren’t market prices. Without owners risking their own capital, the trial and error means nothing.'),
      x('Hayek’s knowledge problem: planners lack data that could, in principle, be collected with enough surveys.', 'Hayek’s knowledge is tacit, local and created in the market process. Much of it exists only in people’s actions and prices, so no survey can collect it.'),
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
      x('Wonderful, and it brings in tourists, so the city gets the subsidy back anyway.', '“It pays for itself through tourism” looks only at the seen. The unseen is what the taxpayers would have spent that money on instead.'),
      x('Great. A state lottery could fund it, instead of taxes.', 'A state lottery is a state monopoly on gambling: taxation under another name.'),
      x('A concert is non-rival and non-excludable, so it’s a public good the market under-provides.', 'A concert is neither: tickets exclude people, and seats are rival. And Austrians doubt the public-goods argument even where it does apply.'),
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
      x('Privatize it in one piece, so it keeps its economies of scale.', 'Selling it whole with its legal monopoly makes a private monopoly. Austrians want the monopoly abolished so anyone can deliver.'),
      x('Keep the monopoly on letters, but open parcels to competition.', 'Half a monopoly is still a monopoly.'),
      x('Delivery has economies of scale, so it’s a natural monopoly. Only the pricing should be freed.', 'Economies of scale don’t make a monopoly natural. The postal monopoly was made and defended by law: Spooner’s company was shut down.'),
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
      x('Money growing faster than real output. As long as money tracks GDP, there’s no inflation.', 'That’s monetarist. Even with flat prices, new money redistributes and distorts, as in the 1920s, when rising productivity hid the credit expansion. For Austrians the expansion itself is the inflation.'),
      x('Government deficits. Balance the budget and inflation stops.', 'Deficits only inflate when they’re financed with new money. The cause is the money creation, whoever does it, banks lending out new credit included.'),
      x('Money growing faster than the demand for money, so a central bank can avoid it by tracking money demand.', 'Austrians define inflation as the increase in money itself. And no central bank can know money demand; trying to accommodate it is the credit expansion that drives cycles.'),
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
      x('The LSE. It’s where Hayek taught, and still the place for Austrian economics.', 'Hayek taught there in the 1930s, but the LSE has long been mainstream. Nobody goes there for Austrian economics today.'),
      x('I started with The Constitution of Liberty and Popper. That’s the core of the school.', 'Popper isn’t Austrian School (falsificationism is the opposite of praxeology), and The Constitution of Liberty is political philosophy. Human Action is the core.'),
      x('Under Lachmann at the LSE, where Mises taught too.', 'Lachmann studied at the LSE under Hayek, but Mises never taught there: he taught in Vienna, Geneva and New York.'),
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
      x('A minimal state that issues sound money, backed by gold.', 'Austrians want money out of the state’s hands altogether, gold included: a state that issues money will debase it.'),
      x('A constitutional republic with strict limits. The constitution will keep it small.', 'Rothbard’s point: constitutions haven’t limited the state, because the state interprets its own limits.'),
      x('None at all, like Mises said: he was the first anarcho-capitalist.', 'Mises was a classical liberal who accepted a minimal state. Anarcho-capitalism came with Rothbard.'),
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
      x('Yes, but only as a lender of last resort in a crisis.', 'Bagehot’s lender of last resort is still a bailout machine. Knowing it’s there, banks take more risk. Austrians would have none.'),
      x('No. Replace it with deposit insurance to stop bank runs.', 'Deposit insurance guarantees reckless lending. Austrians want banks to keep their reserves, not to insure their absence.'),
      x('No central bank, and banks free to keep fractional reserves on demand deposits, as Rothbard argued.', 'Rothbard argued the opposite: he called fractional reserves on demand deposits fraud and wanted 100% reserves.'),
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
      x('Bad, but capping rent increases for sitting tenants only is harmless.', 'Tenancy controls still freeze people in their flats, cut maintenance and investment, and push up the rents for everyone else.'),
      x('Bad. The real fix is for the city to build more social housing.', 'State-built housing is still the state allocating housing. Austrians want zoning and permits out of the way, and private building.'),
      x('Bad, because it pushes landlords’ profits below the normal rate of return.', 'The problem isn’t landlords’ profits but the price signal: a capped rent stops prices from rationing flats and guiding building and upkeep.'),
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
      x('That destruction doesn’t help, unless resources are idle. In a recession, fixing windows does create jobs.', 'That’s the Keynesian exception. Even with idle resources, the money spent on glass isn’t spent elsewhere, and “idle” resources reflect wrong prices that need to adjust.'),
      x('Hazlitt’s lesson that we should look at the long run, since in the long run we are all dead.', 'Hazlitt says look at the long run and at all groups. “In the long run we are all dead” is Keynes, making the opposite point.'),
      x('It shows that GDP overstates welfare, because it counts repairs.', 'That’s a national-accounts point. Bastiat’s is about opportunity cost: the seen spending, and the unseen alternative it displaced.'),
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
      x('Sell the utilities to one private buyer, with a contract guaranteeing their profits.', 'A guaranteed-profit contract is crony capitalism, not privatization.'),
      x('Privatize everything, then put an independent regulator in charge of quality.', 'Privatized, then run by a state regulator: the regulator becomes the new planner.'),
      x('Auction everything to the highest bidder and pay the proceeds out as a basic income.', 'That keeps the state as the great redistributor. Rothbard argued state property should go to those who use it (tenants, workers), not be sold for revenue.'),
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
      x('The equilibrium price, where supply meets demand.', 'Austrians don’t treat equilibrium as the fair price. Real prices are agreed between people, and the market process is never at equilibrium.'),
      x('The price that reflects the true cost of production, externalities included.', '“True cost including externalities” is a Pigouvian planner’s idea. Costs are subjective, and nobody can calculate them from above.'),
      x('Whatever reflects the good’s marginal utility to society.', 'There’s no marginal utility “to society”: utility is individual and ordinal, and can’t be added up.'),
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
      x('From marginal utility: the extra satisfaction each unit gives, measured in money.', 'Marginal utility is ordinal: a ranking, not an amount of satisfaction, and money doesn’t measure it.'),
      x('From usefulness. Water is more valuable than diamonds, because it’s more useful.', 'That’s the paradox Menger solved: value depends on the marginal unit, not the whole category. A glass of water is worth less than a diamond to most people.'),
      x('Value is subjective, but a capital good is worth what it cost to produce.', 'Imputation runs the other way: capital goods get their value from the consumer goods they help make (Menger’s higher-order goods), not from their costs.'),
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
      x('Yes: the classical gold standard before 1914, run by central banks under the rules of the game.', 'The classical gold standard was managed by central banks with fractional reserves, and Rothbard argued its credit expansion paved the way for what came after. Austrians want market money with full reserves.'),
      x('Yes, because gold has intrinsic value.', 'Nothing has intrinsic value. Gold is valued subjectively, and became money through the market (Menger, the regression theorem).'),
      x('Gold became money because governments chose it for its stable supply.', 'Money emerged from barter through the market, not by government choice: Menger, and Mises’s regression theorem.'),
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
      x('Yes, because savings turn into investment automatically, through the interest rate.', 'Only if credit expansion doesn’t distort the interest rate. And the point is time preference lengthening the structure of production, not an automatic identity.'),
      x('Yes, ideally in government bonds: safe and productive.', 'Government bonds fund the state’s consumption, not productive capital.'),
      x('More saving lowers interest rates, which shortens the structure of production.', 'The opposite: lower rates from real saving lengthen the structure of production, towards more roundabout, capital-intensive methods.'),
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
      x('Monopoly means a big market share. Above 70%, the state should step in.', 'Market share isn’t monopoly. For Rothbard, a monopoly is an exclusive privilege granted by the state.'),
      x('Monopolies are fine if they’re efficient, so judge each case on consumer welfare.', 'The “consumer welfare” standard is Chicago antitrust: still a judge deciding from above.'),
      x('A monopoly price is any price above marginal cost.', 'That’s the neoclassical definition. Rothbard argued a “monopoly price” can’t even be identified on a free market: only state privilege makes a monopoly.'),
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
      x('Any asset that earns a return, human capital included.', 'Austrians define capital as produced means of production in a time structure. Lumping in “human capital” mixes up labour and capital goods.'),
      x('The stock of machines, measured by its total value.', 'Capital goods are heterogeneous. Adding up their values hides the structure and complementarity that matter (Lachmann).'),
      x('Capital is homogeneous enough to measure as one stock. What matters is how much there is.', 'Austrians stress that capital goods are heterogeneous and complementary: the structure matters, not one total.'),
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
      x('Pushes the economy away from equilibrium, like Schumpeter said: creative destruction.', 'Kirzner’s entrepreneur moves the economy towards coordination by spotting errors; Schumpeter’s disrupts equilibrium. Mises and Kirzner part ways with Schumpeter here.'),
      x('Starts a company. Managers of big firms aren’t entrepreneurs.', 'Entrepreneurship is a function, not a job title. Anyone acting under uncertainty is an entrepreneur, investors and managers included.'),
      x('Earns profit by correctly predicting a known probability distribution of outcomes.', 'That’s risk, not uncertainty. Entrepreneurial judgment deals with unique cases with no known distribution (Knight; Mises’s case probability).'),
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
      x('It’s the reward for taking risks.', 'Risk can be insured. Profit rewards bearing uncertainty and anticipating correctly (Knight, Mises).'),
      x('In a competitive market it should be zero, so profit means something’s wrong.', 'Zero profit is the textbook equilibrium. In the real market process, profits are the signal that steers resources to unmet wants.'),
      x('The return on the entrepreneur’s own capital. That’s why big firms make more of it.', 'A return on capital is interest. Profit is what’s left from anticipating correctly, whatever the capital involved, and it can be a loss.'),
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
      x('Free trade is good because exports create jobs and bring money in.', 'That’s mercantilist reasoning. The point of trade is the imports: getting goods for less.'),
      x('Free trade, behind a common external tariff, like a customs union.', 'A customs union is free trade inside a wall.'),
      x('It benefits a country only where it has an absolute advantage.', 'Comparative advantage (Ricardo, and Mises’s law of association): trade pays even without any absolute advantage.'),
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
      x('No, because of Ricardian equivalence: people save to pay the future taxes.', 'Ricardian equivalence is a mainstream model (Barro). The Austrian argument is the unseen, and the misallocation of resources.'),
      x('No, but tax cuts are a good stimulus.', 'Austrians don’t believe in “stimulus” at all. Tax cuts are good because they give people back their property, not because they boost aggregate demand.'),
      x('No: it crowds out private spending one-for-one, so it has no effect at all.', 'The Austrian objection isn’t a zero multiplier. Spending moves resources to politically chosen ends and distorts the structure of production.'),
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
      x('It solves the tragedy of the commons by assigning rights efficiently, as Coase showed.', 'Coase is Chicago: rights assigned by a judge for efficiency. Austrians ground property in self-ownership and homesteading.'),
      x('It’s a legal convention that maximizes social welfare.', 'For Rothbard and Hoppe property comes before law, and “social welfare” can’t be measured or added up.'),
      x('Property rights are a bundle of permissions granted by the state.', 'For Rothbard and Hoppe property comes from self-ownership and homesteading, before any state.'),
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
      x('Too much saving looking for a home: the global savings glut.', 'The savings glut is Bernanke’s explanation. Austrians blame credit expansion, not savings.'),
      x('Low rates. The central bank just has to raise them sooner next time.', 'Raising rates “sooner” keeps the central bank as the planner. Austrians want rates out of its hands.'),
      x('Investors with adaptive expectations, always a step behind reality.', 'That’s a behavioural, mainstream story. Austrians point to credit expansion distorting interest rates and relative prices.'),
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
      x('A free market, with a strong state safety net for the poor.', 'Austrians favour private charity and mutual aid over a state safety net.'),
      x('Deregulate everything, but keep doctors’ licensing for safety.', 'Licensing is a cartel that restricts supply. Private certification can do the job.'),
      x('Free prices, but insurers must cover pre-existing conditions at the same rate as everyone.', 'Community rating is the state setting the terms: it shifts costs onto others and distorts the market.'),
    ],
    slips: ['A single state health service. Like the Post, but sicker.', 'Free for everyone, paid for by the rich.'],
  },
];
