// Showdowns: two books, one topic. Each round is a claim, and you say who would make it: one author, the other, or both.
// The claims paraphrase each book; the explanations say where the authors agree and where they part ways.

import type { Question } from './questions.ts';
import { shuffle } from './bank.ts';

export interface Showdown {
  id: string;
  title: string;
  /** The two books, by id, and the names shown on the answer buttons. */
  a: string;
  b: string;
  aName: string;
  bName: string;
  /** What Anya says as it starts. */
  intro: string;
  rounds: readonly { says: string; who: 'a' | 'b' | 'both'; why: string }[];
}

export const SHOWDOWNS: readonly Showdown[] = [
  {
    id: 'sowell-hazlitt',
    title: 'Two Primers',
    a: 'be',
    b: 'eol',
    aName: 'Sowell',
    bName: 'Hazlitt',
    intro: 'Sowell versus Hazlitt. Two primers, one side. Anya wants to know if you can tell them apart.',
    rounds: [
      { says: 'Look not only at a policy’s immediate effects, but at its longer effects on all groups.', who: 'b', why: 'Hazlitt’s “one lesson,” the key to his whole book. Sowell makes the same plea in his own words throughout.' },
      { says: 'Economics is the study of the use of scarce resources which have alternative uses.', who: 'a', why: 'Sowell opens Basic Economics with this definition.' },
      { says: 'The glazier’s gain from a broken window is seen; the tailor’s lost sale is not.', who: 'b', why: 'Hazlitt’s broken window, borrowed from Bastiat.' },
      { says: 'Rent control brings housing shortages and lets buildings deteriorate.', who: 'a', why: 'Sowell spends pages on rent control. Hazlitt’s 1946 Lesson covers price-fixing in general, without a rent control chapter.' },
      { says: 'Minimum wage laws price the least skilled workers out of jobs.', who: 'both', why: 'Sowell and Hazlitt (in “Minimum Wage Laws”) make the same argument.' },
      { says: 'Tariffs help protected producers at the expense of consumers.', who: 'both', why: 'Both books take apart protectionism.' },
      { says: 'For every public works job created, a private job is destroyed somewhere else.', who: 'b', why: 'Hazlitt’s “Public Works Mean Taxes.”' },
      { says: 'Middlemen survive only because they do the job more cheaply than the alternatives.', who: 'a', why: 'Sowell’s defence of middlemen.' },
      { says: '“Parity” prices for farmers help them at the expense of consumers and taxpayers.', who: 'b', why: 'Hazlitt’s chapter on “parity” prices.' },
      { says: 'The real cost of anything is the alternative you give up to get it.', who: 'a', why: 'Sowell’s opportunity cost. Hazlitt’s unseen tailor is the same idea in a story.' },
      { says: 'Machines don’t cause lasting unemployment: they free labour and money for other work.', who: 'b', why: 'Hazlitt’s “The Curse of Machinery.”' },
    ],
  },
  {
    id: 'hazlitt-forty',
    title: 'Price Controls',
    a: 'eol',
    b: 'fc',
    aName: 'Hazlitt',
    bName: 'Schuettinger & Butler',
    intro: 'Hazlitt versus Schuettinger and Butler. They both hate price controls. Which book said what? That’s the fight.',
    rounds: [
      { says: 'Look at a policy’s longer effects, and its effects on all groups, not just one.', who: 'a', why: 'Hazlitt’s “one lesson,” the key to his whole book.' },
      { says: 'Diocletian’s edict of A.D. 301 fixed prices on pain of death, and goods vanished from the markets.', who: 'b', why: 'Forty Centuries tells the story of Diocletian’s edict in detail.' },
      { says: 'Price ceilings create shortages: they discourage supply and encourage demand.', who: 'both', why: 'Hazlitt explains it in theory; Forty Centuries shows it again and again in history.' },
      { says: 'The glazier’s gain from a broken window is seen; the tailor’s lost sale is not.', who: 'a', why: 'Hazlitt’s broken window, borrowed from Bastiat.' },
      { says: 'Athens executed its own grain inspectors when their zeal for enforcing prices flagged.', who: 'b', why: 'One of the ancient episodes in Forty Centuries.' },
      { says: 'One price control leads to another: ceilings bring shortages, then rationing, then controls on everything.', who: 'both', why: 'Hazlitt traces the logic in “Government Price-Fixing”; Forty Centuries shows it from the Kaiser’s Germany to the Confederacy.' },
      { says: 'In the long run, a nation’s exports pay for its imports, so cutting imports cuts exports too.', who: 'a', why: 'Hazlitt’s “The Drive for Exports.” Forty Centuries touches trade only in the Corn Laws’ repeal.' },
      { says: 'Bengal’s famine of 1770 was worsened by grain price controls; in 1866, free trade in grain eased the next one.', who: 'b', why: 'Forty Centuries contrasts the two Bengal famines.' },
      { says: 'Inflation comes from expanding the money supply, and price controls can’t cure it.', who: 'both', why: 'Hazlitt’s “mirage of inflation,” and the conclusion of Forty Centuries.' },
      { says: 'Machines create more jobs in the long run than they destroy.', who: 'a', why: 'Hazlitt’s “curse of machinery” chapter.' },
      { says: 'Indexing wages, taxes and bonds to prices could ease the pain of ending inflation.', who: 'b', why: 'Forty Centuries discusses indexation in its chapters on coping with and curing inflation.' },
    ],
  },
  {
    id: 'mises-rothbard',
    title: 'The State',
    a: 'ha',
    b: 'mes',
    aName: 'Mises',
    bName: 'Rothbard',
    intro: 'Mises versus his star student, Rothbard. Teacher against pupil. Anya loves a family feud.',
    rounds: [
      { says: 'Government is needed to protect the market economy from violence and fraud.', who: 'a', why: 'Mises was a classical liberal who wanted a limited state. Rothbard argued that even defense could be supplied on the free market.' },
      { says: 'No tax can be neutral: every tax distorts the market.', who: 'b', why: 'Rothbard, in Power and Market, against the idea of a neutral tax.' },
      { says: 'Interventionism defeats its own purposes and drifts toward socialism.', who: 'both', why: 'Mises’s analysis of the hampered market, which Rothbard extends in Power and Market.' },
      { says: 'Intervention comes in three kinds: autistic, binary and triangular.', who: 'b', why: 'Rothbard’s own classification in Power and Market.' },
      { says: 'A monopoly price can arise on the free market when demand above the competitive price is inelastic.', who: 'a', why: 'Mises accepted monopoly prices on the free market. Rothbard argued no such price can even be identified there.' },
      { says: 'Praxeology deduces economics a priori from the fact that people act.', who: 'both', why: 'Rothbard took the method straight from Human Action.' },
      { says: 'Economic calculation is impossible under socialism.', who: 'both', why: 'Mises’s argument, which Rothbard adopts and builds on.' },
      { says: 'Defense services could be supplied by competing agencies on the free market.', who: 'b', why: 'Power and Market opens with defense services on the free market. Mises kept defense for government.' },
      { says: 'Democracy lets the majority change rulers by ballots instead of bullets.', who: 'a', why: 'Mises defended democracy as a means of peaceful change. Rothbard was far more critical of the democratic state.' },
      { says: 'Henry George’s single tax on land rent is unjustified.', who: 'b', why: 'Rothbard criticizes the single tax at length in Power and Market.' },
      { says: 'Originary interest springs from time preference, not from the productivity of capital.', who: 'both', why: 'Rothbard follows Mises’s pure time-preference theory of interest.' },
    ],
  },
  {
    id: 'rothbard-friedman',
    title: 'Anarchy, Two Ways',
    a: 'mes',
    b: 'dmf',
    aName: 'Rothbard',
    bName: 'Friedman',
    intro: 'Rothbard versus David Friedman: both anarchists, from opposite directions. Rights against results. Fight!',
    rounds: [
      { says: 'Libertarianism is best defended by showing that its institutions have good consequences.', who: 'b', why: 'Friedman argues as a consequentialist. Rothbard grounds liberty in natural rights.' },
      { says: 'Simple statements of libertarian rights, taken literally, lead to absurd conclusions.', who: 'b', why: 'Friedman’s chapter “Problems”: photons and breath would trespass. Rothbard defends rights as absolute.' },
      { says: 'Defense and courts could be supplied by competing private agencies.', who: 'both', why: 'Both are anarcho-capitalists: Rothbard in Power and Market, Friedman in Part III of his book.' },
      { says: 'Medieval Iceland shows how private law enforcement can work.', who: 'b', why: 'Friedman devotes a chapter to saga-period Iceland.' },
      { says: 'Taxation is a binary intervention: a coerced exchange between the State and the subject.', who: 'a', why: 'Rothbard’s classification of interventions.' },
      { says: 'On the free market, no meaningful monopoly price can be identified.', who: 'a', why: 'Rothbard’s break with Mises. Friedman uses standard price theory, natural monopoly included.' },
      { says: 'National defense is the hard problem: a public good that is hard to fund voluntarily.', who: 'b', why: 'Friedman concedes the difficulty and spends two chapters on it.' },
      { says: 'It costs government about twice as much to do anything as it costs anyone else.', who: 'b', why: '“Friedman’s law,” from his moon-landing chapter.' },
      { says: 'Minimum wage laws throw the least productive workers out of work.', who: 'both', why: 'Ordinary price theory, on which these two agree.' },
      { says: 'Economics proceeds deductively from the axiom that humans act.', who: 'a', why: 'Rothbard’s praxeology. Friedman works in the empirical, neoclassical tradition.' },
      { says: 'Market law, produced by competing agencies, would tend toward economically efficient rules.', who: 'b', why: 'Friedman’s economic analysis of law. Rothbard argued for a libertarian legal code derived from rights.' },
    ],
  },
  {
    id: 'rothbard-huerta',
    title: 'Banks and Deposits',
    a: 'tmb',
    b: 'jhs',
    aName: 'Rothbard',
    bName: 'Huerta de Soto',
    intro: 'Rothbard versus Huerta de Soto. Spoiler: they agree a lot. Anya wants to see you sort out the details.',
    rounds: [
      { says: 'Banks should keep a 100-percent reserve against demand deposits.', who: 'both', why: 'Both reject fractional reserves for demand deposits; it is the reform each proposes.' },
      { says: 'In Roman law, a depositary who used a deposit for another purpose was guilty of theft.', who: 'b', why: 'Huerta de Soto builds his case on Roman law and the Digest. Rothbard argues from the economics of warehouse receipts.' },
      { says: 'A time deposit is really a loan, which a bank may legitimately lend out.', who: 'both', why: 'Rothbard’s “loan banking” and Huerta de Soto’s mutuum: lending money borrowed for a term is legitimate.' },
      { says: 'The Federal Reserve was set up in 1913 to cartelize the banks under government protection.', who: 'a', why: 'Rothbard tells the story of the Fed’s founding in detail in The Mystery of Banking.' },
      { says: 'The Ricardo effect helps explain why the boom from credit expansion turns into a crisis.', who: 'b', why: 'Huerta de Soto develops Hayek’s Ricardo effect at length in his account of the cycle.' },
      { says: 'Credit expansion distorts the structure of production, causing malinvestment that must be liquidated.', who: 'both', why: 'Both hold the Austrian theory of the business cycle, Huerta de Soto at far greater length.' },
      { says: 'Return to sound money: define the dollar as a weight of gold and abolish the Fed.', who: 'a', why: 'Rothbard’s concrete plan, ending The Mystery of Banking.' },
      { says: 'The School of Salamanca’s Saravia de la Calle condemned bankers who paid interest on deposits.', who: 'b', why: 'Huerta de Soto traces the Spanish scholastics’ debate over deposit banking.' },
      { says: 'Money emerges on the market from the most marketable commodity.', who: 'both', why: 'Both follow Menger and Mises on money’s spontaneous origin.' },
      { says: 'The medieval Medici Bank’s secret ledgers reveal banking’s hidden, shameful nature.', who: 'b', why: 'Huerta de Soto discusses the Medici libri segreti in his history of banking.' },
      { says: 'Fractional reserve banking is a form of fraud, inherently inflationary.', who: 'both', why: 'Rothbard calls it fraud and embezzlement; Huerta de Soto, misappropriation in breach of the deposit contract. Same verdict, different routes.' },
    ],
  },
  {
    id: 'sowell-marx',
    title: 'Markets and Labour',
    a: 'be',
    b: 'kap',
    aName: 'Sowell',
    bName: 'Marx',
    intro: 'Sowell versus Marx. Common sense against three volumes. Ding ding.',
    rounds: [
      { says: 'Prices carry information about scarcity, guiding resources to the uses people value most.', who: 'a', why: 'The theme running through Basic Economics. Marx saw prices as forms that conceal the labour behind value.' },
      { says: 'Middlemen survive only because they do the job more cheaply than the alternatives.', who: 'a', why: 'Sowell defends middlemen. Marx treats commercial profit as a share of surplus-value produced in industry.' },
      { says: 'The worker sells his labour-power, and the capitalist pockets the value it creates beyond its cost.', who: 'b', why: 'Surplus-value, for Marx. Sowell argues that over time, productivity is what sets the pay employers can afford.' },
      { says: 'Profits reward meeting demand efficiently; losses tell firms to stop wasting resources.', who: 'a', why: 'Sowell’s view of profit and loss. For Marx, profit is unpaid labour.' },
      { says: 'Capitalist machinery is meant not to lighten toil but to produce more surplus-value.', who: 'b', why: 'Marx, opening Chapter 15 with John Stuart Mill. Sowell sees machinery raising productivity and so living standards.' },
      { says: 'Minimum wage laws price the least skilled and least experienced out of work.', who: 'a', why: 'Sowell’s classic argument. Marx thought wages tended toward the value of labour-power regardless of such laws.' },
      { says: 'An industrial reserve army of the unemployed holds wages down.', who: 'b', why: 'Marx’s relative surplus population. Sowell traces unemployment largely to laws such as minimum wages.' },
      { says: 'Scarcity, not any economic system, is why we can’t all have everything we want.', who: 'a', why: 'Sowell: what everybody wants adds up to more than there is. Marx blamed capitalism’s relations of production.' },
      { says: 'The wage form hides the division of the working day into paid and unpaid labour.', who: 'b', why: 'Marx: under wages all labour appears paid. Sowell sees a wage as the price of a service, agreed by both sides.' },
      { says: 'Trade between nations benefits both, through comparative advantage.', who: 'a', why: 'Sowell, following Ricardo. Marx linked foreign trade to colonial plunder and the cheapening of capital’s inputs.' },
      { says: 'Capital first came into being through conquest, enslavement and robbery: in short, force.', who: 'b', why: 'Marx’s “primitive accumulation.” Sowell explains wealth by productivity, culture and institutions.' },
    ],
  },
  {
    id: 'mises-marx',
    title: 'Value and Exploitation',
    a: 'ha',
    b: 'kap',
    aName: 'Mises',
    bName: 'Marx',
    intro: 'Mises versus Marx. Anya has popcorn. Anya is not neutral.',
    rounds: [
      { says: 'Value is not in things. It lies in the judgments of acting people, who rank ends and means.', who: 'a', why: 'Mises’s subjective value. Marx held instead that value is congealed abstract labour.' },
      { says: 'A commodity’s value is set by the socially necessary labour time it takes to produce.', who: 'b', why: 'The core of Capital, Volume I. Mises rejects any labour measure of value: valuation ranks, it doesn’t measure.' },
      { says: 'Interest springs from time preference: present goods are worth more than future ones.', who: 'a', why: 'Originary interest, for Mises. For Marx, interest is a share of surplus-value squeezed from workers.' },
      { says: 'The capitalist’s profit is unpaid labour, the surplus-value workers create beyond their wage.', who: 'b', why: 'Marx’s theory of exploitation. Mises sees profit as the reward for anticipating consumers’ wishes better than others.' },
      { says: 'Without market prices for the means of production, economic calculation is impossible.', who: 'a', why: 'Mises’s case against socialism. Marx gave no account of how a society without markets would calculate.' },
      { says: 'Capitalism piles up wealth at one pole and misery, toil and degradation at the other.', who: 'b', why: 'Marx’s general law of capitalist accumulation. Mises argues capitalism has raised the masses’ standard of living as never before.' },
      { says: 'Money emerged from exchange, as the commodity everyone would accept: historically, gold.', who: 'both', why: 'Marx derives the money-form from exchanging commodities; Mises’s regression theorem traces money back to a commodity. They agree on the origin, not on much else.' },
      { says: 'Capital is not a thing, but a social relation between persons.', who: 'b', why: 'Marx, in his last chapter, via Wakefield’s colonies. For Mises, capital is a concept of economic calculation: the money value of resources set aside for production.' },
      { says: 'The entrepreneur’s profit comes from foreseeing future demand better than others; his losses come from foreseeing it worse.', who: 'a', why: 'Mises’s entrepreneur bears uncertainty. Marx’s capitalist simply appropriates surplus-value, uncertainty or not.' },
      { says: 'Crises recur because capitalism develops production as if consumption had no limits.', who: 'b', why: 'Marx: the ultimate reason for crises is the masses’ restricted consumption. Mises blames booms and busts on credit expansion, an intervention.' },
    ],
  },
];

export const showdownById = (id: string) => SHOWDOWNS.find((s) => s.id === id);

/** A showdown’s rounds as questions: the claims shuffled, the answers always in the same order (A, B, both). */
export function showdownQuestions(sd: Showdown, rng: () => number = Math.random): Question[] {
  const options = [sd.aName, sd.bName, 'Both of them'];
  return shuffle(sd.rounds, rng).map((r, i) => ({
    id: `showdown-${sd.id}-${i}`,
    level: 'medium',
    chapter: `Showdown · ${sd.title}`,
    q: `Who would say this? “${r.says}”`,
    options,
    correct: r.who === 'a' ? 0 : r.who === 'b' ? 1 : 2,
    comment: r.why,
    hint: 'Think about where each author starts from.',
  }));
}
