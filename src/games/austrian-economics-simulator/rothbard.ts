// Rothbard's commentary: a short line for each kind of moment. main.ts picks
// one (never the same twice in a row) and shows it in a speech bubble.

export type Cue =
  | 'start'
  | 'idle'
  | 'fomc-boom'
  | 'fomc-bust'
  | 'boom'
  | 'bust'
  | 'stole'
  | 'stole-brass'
  | 'stole-fed'
  | 'sold-peak'
  | 'sold-crash'
  | 'bought'
  | 'withdrawal'
  | 'seen'
  | 'heat'
  | 'cop-fell'
  | 'ped-fell'
  | 'lap'
  | 'dea'
  | 'stimulus'
  | 'recall'
  | 'clunkers'
  | 'min-wage'
  | 'rival-arrives'
  | 'rival-fell'
  | 'shoved'
  | 'loan-called'
  | 'default'
  | 'borrowed'
  | 'saved'
  | 'gold'
  | 'gear'
  | 'stash'
  | 'contract-new'
  | 'contract-done'
  | 'contract-failed';

export const LINES: Record<Cue, readonly string[]> = {
  start: [
    'Remember: it is not stealing if it was stolen from you first. Through taxes.',
    'They call it public property. I call it unowned.',
    'The State builds the roads. We merely recycle them.',
  ],
  idle: [
    'Time preference, my boy. Think about the next boom.',
    'Every manhole cover was paid for with taxes. Consider it a refund.',
    'Keynes said in the long run we are all dead. Not if we keep moving.',
    'The cycle is not natural. The Fed makes it. We just ride it.',
    'Have you considered the discount window? Neither has the Fed, apparently.',
  ],
  'fomc-boom': ['They are going to cut rates. Hold your covers, sell into the bubble.', 'Here comes the cheap money. Brace yourself for malinvestment.'],
  'fomc-bust': ['A rate hike is coming. Sell now, while the fools are still buying.', 'The music is about to stop. Get your chair.'],
  boom: ['Ah, the boom. Enjoy it while the malinvestment lasts.', 'Money printer goes brrr. Scrap goes up. This will end well.', 'Look at them build. Every one of those manholes is a bad investment.'],
  bust: ['And there it is: the bust. Mises called it in 1912.', 'The liquidation of malinvestment. Painful, necessary, predictable.', 'Recession. Now the Austrians get invited back on television.'],
  stole: ['Homesteaded.', 'Returned to the private sector.', 'Another public good, privatized.', 'Unowned, then owned. Locke would approve. Probably.'],
  'stole-brass': ['Brass! The hard money of manhole covers.', 'A historic cover. History belongs to whoever pries it off.'],
  'stole-fed': ['You took the Fed’s cover! Run, you magnificent bastard!', 'End the Fed. Starting with its manhole.'],
  'sold-peak': ['Sold at the top. Cantillon would be proud.', 'Buy low, sell high. They should teach this at Harvard. They won’t.'],
  'sold-crash': ['Selling in a bust? Your time preference is showing.', 'That is what we call capital consumption.'],
  bought: ['Subjective value. Who are we to judge?', 'Your body, your property. Self-ownership!', 'Consumption is the end of all production. Enjoy.'],
  withdrawal: ['You are running low. Get to the Corner, quick!', 'Withdrawal. The market is sending you a price signal.'],
  seen: ['Someone saw that!', 'Witnesses! Act natural. Whistle something.'],
  heat: ['Too much heat! Lay low for a while.', 'The State is noticing you. Disappear.'],
  'cop-fell': ['Ha! The State fell into its own infrastructure.', 'Officer down. The hole, I mean. He’s fine.'],
  'ped-fell': ['Moral hazard. He should have watched where he was going.', 'An externality. Coase would say: negotiate.'],
  lap: ['Around we go! The business cycle, in miniature.', 'Steal, sell, buy, wait. That is the whole of Austrian economics.'],
  dea: ['A DEA raid! Prohibition: the gift that keeps on giving to dealers.', 'Supply shock. Prices up. Exactly as theory predicts.'],
  stimulus: ['Free money! Spend it fast, before the prices catch up.', 'Helicopter money. The helicopter is also paid for with your money.'],
  recall: ['Plastic covers! The State debases even its manholes.', 'Debasement. First the coins, now the covers.'],
  clunkers: ['Cash for clunkers! Destroying wealth to stimulate. Bastiat is spinning.', 'Double for scrap! Sell, sell, sell!'],
  'min-wage': ['A minimum wage hike. Watch the price of everything go up.', 'Price controls. They never learn.'],
  'rival-arrives': ['Competition! Good. It keeps you honest.', 'A rival scrapper. The market for manhole covers is getting crowded.'],
  'rival-fell': ['Creative destruction!', 'Outcompeted. Ruthlessly.'],
  shoved: ['A little friendly competition.', 'His property? He homesteaded it. You homesteaded it from him.'],
  'loan-called': ['They called your loan! Pay it back before the bust ends!', 'This is what easy credit gets you. Pay up!'],
  default: ['Default! No bailout for the little guy.', 'Too small to bail out. The banks got theirs, though.'],
  borrowed: ['Borrowing in a boom? You know how this ends.', 'Credit expansion! What could possibly go wrong.'],
  saved: ['Savings! The foundation of all capital.', 'Low time preference. Mises smiles upon you.'],
  gold: ['Gold. The barbarous relic. Keynes hated it, which tells you everything.', 'Hard money. They can’t print it.'],
  gear: ['A capital good! Roundabout production at work.', 'Invest now, consume later. That is how civilization works.'],
  stash: ['Saving them for the boom. Very Austrian.', 'Covers in the stash. Capital, accumulated.'],
  'contract-new': ['An order from the junkyard! Freedom of contract.', 'A contract. Voluntary exchange at its finest.'],
  'contract-done': ['Contract fulfilled. That is how trust is built.', 'Delivered! Reputation is the free market’s police.'],
  'contract-failed': ['You missed the deadline. Your reputation suffers.', 'Breach of contract. In Ancapistan, that costs you.'],
};

/** Urgent cues get through even if he just spoke. */
export const URGENT: ReadonlySet<Cue> = new Set<Cue>(['withdrawal', 'loan-called', 'default', 'stole-fed', 'seen', 'heat']);

/** A line for the cue, avoiding `last` when there's another. `roll` is in [0, 1). */
export function pickLine(cue: Cue, roll: number, last?: string): string {
  const lines = LINES[cue];
  const options = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return options[Math.floor(roll * options.length) % options.length];
}
