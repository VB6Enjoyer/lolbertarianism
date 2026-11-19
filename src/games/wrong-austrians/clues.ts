// The investigations: one-time tools that dig up a piece of an economist's past. Everyone has a
// hidden profile (their thesis, where they studied, their CV, their bookshelf, who pays them, their
// old op-eds), and every item leans one way: Austrian School, free-market-but-not-Austrian (Chicago,
// public choice), mainstream, or statist. Clues lean; they don't prove. The Viennese have built
// themselves convincing pasts, and plenty of real Austrians did a mainstream PhD first.

export type Lean = 'austrian' | 'freemarket' | 'mainstream' | 'statist';
export type ToolId = 'thesis' | 'alma' | 'cv' | 'shelf' | 'funding' | 'oped';

export interface Tool {
  id: ToolId;
  icon: string;
  name: string;
  /** What the report is headed with. */
  heading: string;
  items: Record<Lean, string[]>;
}

export const LEAN_LABEL: Record<Lean, string> = {
  austrian: '🦅 Austrian School',
  freemarket: '🗽 Free-market, but not Austrian',
  mainstream: '🎓 Mainstream',
  statist: '🏛️ Statist',
};

export const TOOLS: Record<ToolId, Tool> = {
  thesis: {
    id: 'thesis',
    icon: '🎓',
    name: 'Their thesis',
    heading: 'Doctoral thesis',
    items: {
      austrian: [
        'Capital Heterogeneity and the Structure of Production',
        'The Regression Theorem and the Origins of Money',
        'Time Preference and the Pure Rate of Interest',
        'Economic Calculation Under Socialism, Revisited',
        'Malinvestment in the Austrian Housing Boom, 2003–2008',
      ],
      freemarket: [
        'Rules Versus Discretion in Monetary Policy',
        'A Public Choice Analysis of Agricultural Subsidies',
        'Rational Expectations and the Phillips Curve',
        'Nominal GDP Targeting for a Small Open Economy',
        'Market Efficiency in Commodity Futures',
      ],
      mainstream: [
        'A DSGE Model of the Austrian Labour Market',
        'Optimal Taxation with Heterogeneous Agents',
        'Nudging Savers: Behavioural Approaches to Pension Reform',
        'Econometric Evidence on Tourism in Tyrol',
        'Inflation Expectations in the Euro Area: A Survey-Based Approach',
      ],
      statist: [
        'The Social Partnership as an Engine of Growth',
        'Towards a Fairer Wealth Tax',
        'Fiscal Multipliers in the Second Republic',
        'Planning the Danube: Infrastructure as Industrial Policy',
        'The Nationalbank and Price Stability: A Celebration',
      ],
    },
  },
  alma: {
    id: 'alma',
    icon: '🏛️',
    name: 'Alma mater',
    heading: 'Where they studied',
    items: {
      austrian: [
        'Universidad Rey Juan Carlos, Madrid, under Huerta de Soto',
        'A Mises Institute summer fellowship, then Auburn',
        'NYU, in the old Austrian colloquium with Kirzner',
        'Grove City College, then ten years of reading groups',
        'The Liechtenstein Academy, on a private scholarship',
      ],
      freemarket: [
        'The University of Chicago',
        'George Mason University, with the public choice crowd',
        'Hillsdale College',
        'UCLA, with the old price theory people',
        'The University of Rochester',
      ],
      mainstream: ['MIT', 'The London School of Economics', 'Harvard', 'WU Vienna, then a PhD in Bonn', 'The European University Institute, Florence'],
      statist: [
        'The Vienna School of Public Administration',
        'The Chamber of Labour’s training academy',
        'WU Vienna, on a Ministry scholarship',
        'The New School, New York, in the post-Keynesian programme',
        'The Diplomatic Academy, with a minor in subsidies',
      ],
    },
  },
  cv: {
    id: 'cv',
    icon: '💼',
    name: 'Their CV',
    heading: 'Previous experience',
    items: {
      austrian: [
        'Ran a gold-backed savings co-op for six years',
        'Research fellow at a free-market institute, writing on monetary history',
        'Founded a private arbitration service',
        'Translated Mises into Slovene, unpaid',
        'Advised a private city project in Honduras',
      ],
      freemarket: [
        'Bond trader at a Swiss bank',
        'Economist at a Chicago hedge fund',
        'Consultant to a deregulation think tank in Washington',
        'Chief economist at a tech start-up',
        'Wrote the tax plan for a flat-tax party',
      ],
      mainstream: [
        'Analyst at the OECD in Paris',
        'Five years at an investment bank, then academia',
        'Lecturer in statistics at a provincial university',
        'Adviser at an international development bank',
        'Research assistant to a Nobel laureate (a mainstream one)',
      ],
      statist: [
        'Fifteen years in the National Bank’s research department',
        'Head of section, Federal Ministry of Finance',
        'Policy officer at the Chamber of Labour',
        'Board member of a state-owned energy company',
        'Drafted three rent-control amendments for the City of Vienna',
      ],
    },
  },
  shelf: {
    id: 'shelf',
    icon: '📚',
    name: 'Their bookshelf',
    heading: 'On their bookshelf',
    items: {
      austrian: [
        'Human Action, Man, Economy, and State, and a dog-eared Economics in One Lesson',
        'Huerta de Soto’s Money, Bank Credit, and Economic Cycles, with notes in every margin',
        'Menger’s Principles in German, and a framed photo of Mises',
        'Hoppe, Rothbard, Mises, in that order',
        'The Road to Serfdom, Prices and Production, and Böhm-Bawerk’s Capital and Interest',
      ],
      freemarket: [
        'Capitalism and Freedom, Free to Choose, and The Calculus of Consent',
        'Atlas Shrugged and a stack of Thomas Sowell',
        'A Monetary History of the United States',
        'The Machinery of Freedom and a lot of Gary Becker',
        'The Wealth of Nations and a bust of Adam Smith',
      ],
      mainstream: [
        'Mankiw’s textbook, Freakonomics, and Nudge',
        'Thinking, Fast and Slow, and three econometrics manuals',
        'Piketty, unread, next to a Samuelson textbook',
        'The Undercover Economist and some Krugman columns, printed out',
        'A complete set of the Journal of Economic Perspectives',
      ],
      statist: [
        'The General Theory, heavily underlined',
        'Das Kapital and a biography of Bruno Kreisky',
        'Mazzucato’s The Entrepreneurial State, with fan mail tucked inside',
        'Polanyi’s The Great Transformation, and the federal budget bound in leather',
        'Every annual report of the Chamber of Labour since 1975',
      ],
    },
  },
  funding: {
    id: 'funding',
    icon: '💶',
    name: 'Follow the money',
    heading: 'Who pays them',
    items: {
      austrian: [
        'Small private donors, and not a cent of public money',
        'A private foundation in Liechtenstein, paid in gold coins',
        'Book royalties and a Patreon',
        'Nobody: they sold their house to fund research on free banking',
        'Tuition from a private evening school',
      ],
      freemarket: [
        'A grant from a Washington free-market foundation',
        'Consulting fees from a big Swiss bank',
        'A Koch-funded fellowship',
        'Speaking fees at bitcoin conferences',
        'A chair endowed by a Chicago trading firm',
      ],
      mainstream: [
        'A university salary and an EU research grant',
        'A European Research Council grant',
        'Occasional consulting for the IMF',
        'An endowed chair at a business school',
        'A textbook that every first-year student has to buy',
      ],
      statist: [
        'A Ministry of Finance research contract, renewed every year',
        'A National Bank pension, plus fees from the Chamber of Commerce',
        'The Federal Ministry for Social Affairs',
        'State broadcaster consulting, on “economic narratives”',
        'Three overlapping public grants for the same project',
      ],
    },
  },
  oped: {
    id: 'oped',
    icon: '🗞️',
    name: 'Old op-eds',
    heading: 'An old op-ed of theirs',
    items: {
      austrian: [
        '“End the Central Bank Before It Ends Us”',
        '“The Boom Was the Problem; the Bust Is the Cure”',
        '“Why Rent Control Is Destroying Vienna”',
        '“Gold, Not Decrees: Money Without the State”',
        '“Praxeology Is Not Psychology, and Here’s Why”',
      ],
      freemarket: [
        '“A Rule-Based Central Bank for Austria”',
        '“Lower Taxes Will Pay for Themselves”',
        '“The Case for a Negative Income Tax”',
        '“Let the ECB Target Nominal GDP”',
        '“Vouchers Will Fix Our Schools”',
      ],
      mainstream: [
        '“What the Data Says About Pension Reform”',
        '“Behavioural Nudges Can Fix Retirement Saving”',
        '“The Euro at Twenty-Five: A Balanced Assessment”',
        '“Why We Need Better Economic Statistics”',
        '“Ten Charts That Explain Inflation”',
      ],
      statist: [
        '“A Wealth Tax Is Long Overdue”',
        '“In Defence of the Social Partnership”',
        '“Austria Needs a National Investment Bank”',
        '“Price Controls Worked Before. They Can Work Again.”',
        '“Why the State Should Own the Ski Lifts”',
      ],
    },
  },
};

export const TOOL_ORDER: ToolId[] = ['thesis', 'alma', 'cv', 'shelf', 'funding', 'oped'];

/**
 * How each side's pasts lean. The loyal ones mostly look the part; the impostors have built
 * themselves convincing pasts (a lot of free-market-but-not-quite), and only sometimes leave a
 * statist trace. "own" is the side's own school (Austrian for Ancapball's council, statist in
 * mirror mode); "other" is the opposite one.
 */
export const LEAN_ODDS: Record<'loyal' | 'impostor', Record<'own' | 'freemarket' | 'mainstream' | 'other', number>> = {
  loyal: { own: 0.55, freemarket: 0.15, mainstream: 0.22, other: 0.08 },
  impostor: { own: 0.28, freemarket: 0.32, mainstream: 0.25, other: 0.15 },
};
