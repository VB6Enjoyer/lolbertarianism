// Mirror mode's side of every crisis: you're Austria, so the sound advice (for you) is statist, and
// the impostors are Austrian School ancaps dressing privatization up as something social. Same
// shape as crises.ts: three loyal policies, two disguised, one blatant ("Privatize Vienna plz").

import { blatant, disguised, type Policy, sound } from './crises.ts';

export interface MirrorCrisis {
  /** A different title or text from Vienna's point of view, if needed. */
  title?: string;
  text?: string;
  policies: Policy[];
}

export const MIRROR: Record<string, MirrorCrisis> = {
  oil: {
    policies: [
      sound('m-oil-reserve', ['A state fuel reserve', 'Buy oil now, store it, release it when prices spike. The state as a calm, wise squirrel.', 'The reserve smoothed the spike. The Ministry of Fuel got a new building.']),
      sound('m-oil-trams', ['Raise the fuel tax, fund the trams', 'Make driving dearer and the trams cheaper. Everyone wins, except cars.', 'Tram ridership is up. The tram authority is very proud of itself.']),
      sound('m-oil-commission', ['A fuel price commission', 'A commission of sensible people sets a fair price. With hearings.', 'The fuel commission meets weekly. Its approval rating is excellent.']),
      disguised('m-oil-partner', ['A partnership with private refiners', 'A public-private partnership! Very modern. The state keeps a golden share.', 'The golden share was only gold-plated. The refiners own everything now.']),
      disguised('m-oil-suspend', ['Suspend the fuel rules, temporarily', 'Just for one winter, to help. Only one.', 'The rules never came back. Nobody missed them, which is the worst part.']),
      blatant('m-oil-sell', ['Privatize the oil fields', 'Sell the fields, the pipelines, the stations. Privatize Vienna plz.', 'The oil fields were sold. So was the ministry building.']),
    ],
  },
  bankrun: {
    text: 'Lines outside the People’s Bank. Depositors want their savings back, and the bank doesn’t have it all.',
    policies: [
      sound('m-bank-guarantee', ['Guarantee every deposit', 'The state stands behind every euro. Nobody needs to queue.', 'The queues vanished. The guarantee fund needs a ministry of its own.']),
      sound('m-bank-nationalize', ['Nationalize the troubled banks', 'If they can’t run a bank, the state will. Carefully.', 'The state bank is stable, slow and has 900 new employees.']),
      sound('m-bank-office', ['A banking supervision office', 'A new office to watch the banks. With forms.', 'The supervision office inspects every bank twice a year. Voters feel safer.']),
      disguised('m-bank-notes', ['Community banknotes', 'Local money, issued by local banks! Very communal. Very social.', 'The community notes replaced the euro in three provinces. The central bank is furious.']),
      disguised('m-bank-review', ['A review of deposit insurance', 'Just a review. To make it sustainable.', 'The review recommended abolishing deposit insurance. It was abolished.']),
      blatant('m-bank-end', ['Abolish the central bank', 'End it. Let people choose their own money: gold, francs, whatever.', 'The central bank was dissolved. The governor sells gold coins at the Naschmarkt now.']),
    ],
  },
  opera: {
    title: 'The Opera Wants a New Wing',
    text: 'The State Opera wants a new wing. The ballet wants one too, and so does the opera’s own ministry.',
    policies: [
      sound('m-opera-wing', ['Build the new wing', 'Culture is infrastructure. Build it, staff it, fund it.', 'The new wing opened with a gala. Everyone who matters was there.']),
      sound('m-opera-levy', ['A culture levy on tickets and TV', 'A small levy, for culture. Everyone pays a little.', 'The culture levy funds four orchestras and a ministry.']),
      sound('m-opera-students', ['Free opera for students', 'Young people at the opera, at the state’s expense. Lovely.', 'Students fill the cheap seats. Some even stay awake.']),
      disguised('m-opera-sponsors', ['Let sponsors name the boxes', 'A little private money, for the boxes only. Very modest.', 'It’s the Energy Drink State Opera now. The state’s share is a rounding error.']),
      disguised('m-opera-foundation', ['Turn the opera into a foundation', 'A foundation! Independent, but still ours. Basically ours.', 'The foundation sold the building and rents it back.']),
      blatant('m-opera-sell', ['Sell the opera house', 'Sell it. If people love opera, they’ll buy tickets.', 'The opera house was sold. Tickets doubled. It sold out anyway.']),
    ],
  },
  housing: {
    policies: [
      sound('m-house-council', ['Build more council flats', 'Vienna has done it for a century. Do it more.', 'Thousands of new council flats. The housing ministry hired a choir.']),
      sound('m-house-freeze', ['Tighten rent control', 'Freeze the rents. Tenants vote.', 'Tenants are delighted. The waiting list now has its own office.']),
      sound('m-house-authority', ['A housing allocation authority', 'A fair queue, run by fair people.', 'The housing authority allocates every flat by lottery. Very fair. Very popular.']),
      disguised('m-house-simplify', ['Simplify the zoning code', 'Just tidy up the rules. Simplify.', 'The simplified code has one rule left: build what you like. They did.']),
      disguised('m-house-buy', ['A tenant purchase scheme', 'Let tenants buy their council flats. Ownership is social, isn’t it?', 'Half the council flats are privately owned. The housing ministry shrank by half.']),
      blatant('m-house-sell', ['Sell the council flats', 'Sell them all. Let the market house people.', 'The council flats were sold. Rents went up, then down, then the ministry closed.']),
    ],
  },
  strike: {
    policies: [
      sound('m-strike-partnership', ['Convene the social partnership', 'Unions, employers and the state round one table. Like always.', 'A deal was struck. A new partnership office was born.']),
      sound('m-strike-35', ['Grant a 35-hour week', 'A compromise: five hours less, same pay. Everyone loves us.', 'The 35-hour week is popular. The labour inspectorate doubled.']),
      sound('m-strike-wage', ['Raise the minimum wage', 'Higher wages, happier voters.', 'Wages up, approval up. The wage office needs a bigger office.']),
      disguised('m-strike-optout', ['Let firms opt out of the national deal', 'A little flexibility, firm by firm. Very social.', 'Every firm opted out. The national deal is now a historical document.']),
      disguised('m-strike-voluntary', ['Make union membership voluntary', 'Freedom of association! Social democrats invented that, surely.', 'Membership halved. So did the unions’ seats at the table.']),
      blatant('m-strike-chambers', ['Abolish the Chamber of Labour', 'Abolish the compulsory chambers. All of them.', 'The chambers were abolished. Nobody pays dues. Nobody misses them.']),
    ],
  },
  inflation: {
    policies: [
      sound('m-infl-controls', ['Price controls on essentials', 'Bread and milk at a fair price, set by the state.', 'Prices are fair. The shelves are a bit empty. The price office is thriving.']),
      sound('m-infl-bonus', ['An inflation bonus for everyone', 'Send everyone a cheque. Voters love cheques.', 'The cheques were a hit. Prices went up again, but who’s counting?']),
      sound('m-infl-index', ['Index wages and pensions', 'Wages and pensions rise with prices, automatically.', 'Everyone’s protected. The indexation office calculates day and night.']),
      disguised('m-infl-gold', ['Let people pay in gold', 'Just as an option. For tourists, mostly.', 'Half the country prices things in gold now. The euro is a souvenir.']),
      disguised('m-infl-freeze', ['A temporary spending freeze', 'Freeze spending for one year. Responsible. Very Viennese.', 'The freeze became permanent. Three ministries quietly closed.']),
      blatant('m-infl-stop', ['Stop printing money', 'Stop printing. Full stop. Let prices fall.', 'The printing stopped and prices settled. The central bank has nothing to do.']),
    ],
  },
  imports: {
    policies: [
      sound('m-trade-tariff', ['A tariff on Swiss chocolate', 'Protect our chocolatiers. Swiss chocolate can pay its way in.', 'Local chocolate is thriving. The customs office got new uniforms.']),
      sound('m-trade-grants', ['Subsidize local chocolatiers', 'A grant for every chocolatier. It’s culture, really.', 'Every chocolatier has a grant. The chocolate office has a fountain.']),
      sound('m-trade-authority', ['A chocolate quality authority', 'Strict standards. Swiss chocolate won’t meet them, mysteriously.', 'The authority rejected all Swiss chocolate on grounds of “texture”.']),
      disguised('m-trade-pilot', ['A free-trade pilot with Switzerland', 'Just a pilot. One year.', 'The pilot became a treaty. The customs office is a café now.']),
      disguised('m-trade-tape', ['Cut red tape for importers', 'Fewer forms. Who likes forms?', 'Importers love it. The forms office has nothing left to stamp.']),
      blatant('m-trade-abolish', ['Abolish all tariffs', 'Free trade. Unilateral. Today.', 'Tariffs gone, chocolate cheap, customs ministry dissolved.']),
    ],
  },
  snow: {
    policies: [
      sound('m-snow-bailout', ['Bail out the ski resorts', 'The resorts are our heritage. The state will keep them open.', 'Every resort stayed open. The tourism ministry put a ski slope in its lobby.']),
      sound('m-snow-cannons', ['A state snow-cannon programme', 'Snow, made by the state, for the people.', 'State snow cannons cover every slope. The snow office is very busy.']),
      sound('m-snow-board', ['A tourism marketing board', 'Promote the country with a jingle and a board.', 'The jingle is everywhere. The board is very pleased with the jingle.']),
      disguised('m-snow-prices', ['Let the resorts set their own prices', 'Flexibility for the resorts! Just this season.', 'The resorts set their own prices and stopped asking for subsidies. The ministry is bored.']),
      disguised('m-snow-lease', ['Lease the slopes to operators', 'A long lease. Still state land. Technically.', 'The 99-year leases are ownership in all but name. The slopes are private now.']),
      blatant('m-snow-sell', ['Sell the ski lifts', 'Sell every lift. Let the resorts sink or swim.', 'The lifts were sold. The good ones are busier than ever.']),
    ],
  },
  pensions: {
    policies: [
      sound('m-pens-raise', ['Raise contributions', 'A little more from every paycheck. The pension is sacred.', 'The fund is topped up. The pension office grew a new wing.']),
      sound('m-pens-borrow', ['Borrow to cover the gap', 'Rates are low. The state’s credit is excellent.', 'The gap is covered. The debt office hired twenty economists, all Viennese.']),
      sound('m-pens-constitution', ['Put the pension in the constitution', 'Write it into the constitution. Nobody will dare touch it.', 'The pension is constitutional now. Voters adore it.']),
      disguised('m-pens-topup', ['Optional private top-ups', 'A little extra private savings, if people want. Harmless.', 'The private savings outgrew the state pension. The young opted out entirely.']),
      disguised('m-pens-reform', ['A sustainability reform', 'Just make it sustainable. Small adjustments.', 'The reform cut pensions to what the fund can pay. Honest, and very unpopular.']),
      blatant('m-pens-optout', ['Let everyone opt out', 'Let anyone leave the scheme and keep their own money.', 'Everyone under 50 opted out. The pension ministry is a museum now.']),
    ],
  },
  merger: {
    policies: [
      sound('m-merge-block', ['Block the merger', 'Two schnitzel giants? Not on our watch.', 'The merger was blocked. The competition authority held a press conference.']),
      sound('m-merge-board', ['A state schnitzel price board', 'Fair schnitzel prices, for the people.', 'Schnitzel prices are set monthly. The board serves lunch.']),
      sound('m-merge-seats', ['Approve it, with state seats on the board', 'They can merge if the state sits on the board.', 'The state has two seats on the schnitzel board. Everyone feels represented.']),
      disguised('m-merge-light', ['Approve it, after a light review', 'A light review. Very light.', 'The review was so light it was invisible. The merger went through untouched.']),
      disguised('m-merge-licence', ['Ease the restaurant licence', 'A small simplification for small kitchens.', 'Anyone can open a kitchen now. The licensing office closed.']),
      blatant('m-merge-antitrust', ['Abolish antitrust law', 'Let them merge, let anyone compete. No referee needed.', 'Antitrust is gone. Twelve new schnitzel chains opened anyway.']),
    ],
  },
  roads: {
    policies: [
      sound('m-roads-plan', ['A big state road programme', 'A five-year road plan. Our planners are the best.', 'The road plan is roughly on schedule. The road ministry is very proud.']),
      sound('m-roads-levy', ['A road maintenance levy', 'A small levy on every car, for every pothole.', 'The levy fixed the potholes and funded a pothole office.']),
      sound('m-roads-bank', ['A state infrastructure bank', 'A bank that only lends for roads. State-run, of course.', 'The infrastructure bank built three bridges and a ministry.']),
      disguised('m-roads-tolls', ['A toll partnership', 'Private builders, public roads. Mostly public.', 'The toll partner owns the highways now. The state kept a commemorative plaque.']),
      disguised('m-roads-towns', ['Let towns maintain their own roads', 'Subsidiarity! Very European.', 'The towns did it themselves and stopped sending money to Vienna.']),
      blatant('m-roads-sell', ['Privatize the roads', 'Privatize Vienna plz. Start with the roads.', 'The roads were sold to toll companies. The road ministry was sold too.']),
    ],
  },
  recession: {
    policies: [
      sound('m-rec-stimulus', ['A big stimulus', 'Spend our way out. Shovels, trams, a new railway station.', 'The stimulus built a railway station. Approval at the station is high.']),
      sound('m-rec-rates', ['Cut interest rates', 'Cheap money, happy voters.', 'Cheap money flowed. Everyone’s happy, for now. The central bank is beloved.']),
      sound('m-rec-jobs', ['A state jobs programme', 'Jobs for everyone, from the state.', 'Ten thousand state jobs. Some even involve work.']),
      disguised('m-rec-balanced', ['Pledge a balanced budget', 'Responsible government. The voters will respect it.', 'The balanced budget meant real cuts. Two ministries closed.']),
      disguised('m-rec-taxcut', ['Tax cuts to boost demand', 'Cut taxes, put money in pockets. Keynes would approve.', 'The tax cuts stuck. The state is smaller now. Keynes would not approve.']),
      blatant('m-rec-bust', ['Let the bust run its course', 'Do nothing. Let the bad investments fail.', 'The bust cleared and the recovery came without the state. Embarrassing.']),
    ],
  },
};
