// Achievements for Basic Economics Trainer. main.ts awards them as things happen.

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Hidden (name and description) until it's unlocked. */
  secret?: boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Getting started
  { id: 'took-book', icon: '📕', name: 'Here, Take This', description: 'Take a book from Anya.' },
  { id: 'second-book', icon: '📚', name: 'Bookworm', description: 'Take every one of Anya’s books.' },
  { id: 'first-right', icon: '✅', name: 'Not Dumb After All', description: 'Get your first answer right.' },
  { id: 'streak-5', icon: '😏', name: 'Heh.', description: 'Get five right in a row.' },
  { id: 'streak-10', icon: '✨', name: 'Waku Waku', description: 'Get ten right in a row.' },
  { id: 'perfect', icon: '💯', name: 'Not Dumb', description: 'Get 10 out of 10 in a part, a drill or the daily quiz.' },
  // Basic Economics, part by part
  { id: 'part-1', icon: '🏷️', name: 'The Price Is Right', description: 'Pass Part I: Prices and Markets.' },
  { id: 'part-2', icon: '🏭', name: 'Captain of Industry', description: 'Pass Part II: Industry and Commerce.' },
  { id: 'part-3', icon: '🔧', name: 'Worth Your Wage', description: 'Pass Part III: Work and Pay.' },
  { id: 'part-4', icon: '⏳', name: 'Low Time Preference', description: 'Pass Part IV: Time and Risk.' },
  { id: 'part-5', icon: '🏛️', name: 'Macro Manager', description: 'Pass Part V: The National Economy.' },
  { id: 'part-6', icon: '🌍', name: 'Comparative Advantage', description: 'Pass Part VI: The International Economy.' },
  { id: 'part-7', icon: '🧙', name: 'Myth Buster', description: 'Pass Part VII: Special Economic Issues.' },
  { id: 'all-parts', icon: '🎓', name: 'Sowell-Pilled', description: 'Pass every part of Basic Economics.' },
  { id: 'whole-book', icon: '📖', name: 'Read the Whole Book', description: 'Answer every question in Basic Economics right at least once.' },
  // Human Action, part by part
  { id: 'ha-part-1', icon: '🎯', name: 'Purposeful Behavior', description: 'Pass Part One of Human Action: Human Action.' },
  { id: 'ha-part-2', icon: '🤝', name: 'Social Cooperation', description: 'Pass Part Two: Action Within the Framework of Society.' },
  { id: 'ha-part-3', icon: '🧮', name: 'Calculated', description: 'Pass Part Three: Economic Calculation.' },
  { id: 'ha-part-4', icon: '🏪', name: 'Consumer Sovereignty', description: 'Pass Part Four: Catallactics or Economics of the Market Society.' },
  { id: 'ha-part-5', icon: '🚫', name: 'Calculation Problem', description: 'Pass Part Five: Social Cooperation Without a Market.' },
  { id: 'ha-part-6', icon: '⛓️', name: 'Unhampered', description: 'Pass Part Six: The Hampered Market Economy.' },
  { id: 'ha-part-7', icon: '🦉', name: 'Nondescript No More', description: 'Pass Part Seven: The Place of Economics in Society.' },
  { id: 'ha-all-parts', icon: '🎩', name: 'Misesian', description: 'Pass every part of Human Action.' },
  { id: 'ha-whole-book', icon: '📜', name: 'Read the Whole Treatise', description: 'Answer every question in Human Action right at least once.' },
  // Economics in One Lesson, part by part
  { id: 'eol-part-1', icon: '🪟', name: 'Broken Window', description: 'Pass Part I of Economics in One Lesson: The Lesson.' },
  { id: 'eol-part-2', icon: '🌉', name: 'The Unbuilt Homes', description: 'Pass Part II: Spending, Taxes and Credit.' },
  { id: 'eol-part-3', icon: '⚙️', name: 'Technophile', description: 'Pass Part III: Machines and Jobs.' },
  { id: 'eol-part-4', icon: '🧶', name: 'Cheaper Sweaters', description: 'Pass Part IV: Trade and Protection.' },
  { id: 'eol-part-5', icon: '🚂', name: 'The Governor', description: 'Pass Part V: Prices and Price-Fixing.' },
  { id: 'eol-part-6', icon: '🪙', name: 'Real Wages', description: 'Pass Part VI: Wages, Unions and Profits.' },
  { id: 'eol-part-7', icon: '🐖', name: 'Thrifty Benjamin', description: 'Pass Part VII: Inflation, Saving and the Lesson Restated.' },
  { id: 'eol-all-parts', icon: '🧑‍🏫', name: 'One Lesson Learned', description: 'Pass every part of Economics in One Lesson.' },
  { id: 'eol-whole-book', icon: '👤', name: 'The Forgotten Man', description: 'Answer every question in Economics in One Lesson right at least once.' },
  // The Mystery of Banking, part by part
  { id: 'tmb-part-1', icon: '🐚', name: 'Double Coincidence', description: 'Pass Part I of The Mystery of Banking: Money and Prices.' },
  { id: 'tmb-part-2', icon: '😇', name: 'Angel Gabriel', description: 'Pass Part II: Supply and Demand for Money.' },
  { id: 'tmb-part-3', icon: '🧾', name: 'Warehouse Receipt', description: 'Pass Part III: Banking.' },
  { id: 'tmb-part-4', icon: '🏃', name: 'Bank Run', description: 'Pass Part IV: Free Banking and Central Banking.' },
  { id: 'tmb-part-5', icon: '🪑', name: 'The Fed Bought My Desk', description: 'Pass Part V: How the Central Bank Inflates.' },
  { id: 'tmb-part-6', icon: '🏦', name: 'Suffolk System', description: 'Pass Part VI: Central Banking in History.' },
  { id: 'tmb-part-7', icon: '🏝️', name: 'Jekyll Island', description: 'Pass Part VII: The National Banks, the Fed and Sound Money.' },
  { id: 'tmb-all-parts', icon: '🥇', name: '100 Percent Reserve', description: 'Pass every part of The Mystery of Banking.' },
  { id: 'tmb-whole-book', icon: '🔮', name: 'Mystery Solved', description: 'Answer every question in The Mystery of Banking right at least once.' },
  // Man, Economy, and State with Power and Market, part by part
  { id: 'mes-part-1', icon: '🫐', name: 'Crusoe’s Stick', description: 'Pass Part I of Man, Economy, and State: Human Action and Exchange.' },
  { id: 'mes-part-2', icon: '⏳', name: 'Time Preference', description: 'Pass Part II: Prices, Production and Interest.' },
  { id: 'mes-part-3', icon: '🧭', name: 'Capitalist-Entrepreneur', description: 'Pass Part III: Factors, Entrepreneurs and Incomes.' },
  { id: 'mes-part-4', icon: '🎭', name: 'Illusion of Monopoly Price', description: 'Pass Part IV: Monopoly and Money.' },
  { id: 'mes-part-5', icon: '🛡️', name: 'Private Defense', description: 'Pass Part V: Violent Intervention.' },
  { id: 'mes-part-6', icon: '🔺', name: 'Triangular Intervention', description: 'Pass Part VI: Triangular and Binary Intervention.' },
  { id: 'mes-part-7', icon: '⚔️', name: 'Market versus Hegemony', description: 'Pass Part VII: Government, Ethics and Policy.' },
  { id: 'mes-all-parts', icon: '♟️', name: 'Checkmate', description: 'Pass every part of Man, Economy, and State.' },
  { id: 'mes-whole-book', icon: '👑', name: 'Power and Market', description: 'Answer every question in Man, Economy, and State right at least once.' },
  // Money, Bank Credit, and Economic Cycles, part by part
  { id: 'jhs-part-1', icon: '⚖️', name: 'Tantundem', description: 'Pass Part I of Money, Bank Credit, and Economic Cycles: The Irregular Deposit.' },
  { id: 'jhs-part-2', icon: '🏛️', name: 'Bank of Amsterdam', description: 'Pass Part II: Banking History.' },
  { id: 'jhs-part-3', icon: '📜', name: 'Aliud Est Credere', description: 'Pass Part III: Legal Justifications.' },
  { id: 'jhs-part-4', icon: '✖️', name: 'Ex Nihilo', description: 'Pass Part IV: The Credit Expansion Process.' },
  { id: 'jhs-part-5', icon: '🏗️', name: 'Ricardo Effect', description: 'Pass Part V: Credit Expansion and the Cycle.' },
  { id: 'jhs-part-6', icon: '🎢', name: 'Manic-Depressive Economy', description: 'Pass Part VI: The Cycle and Its Critics.' },
  { id: 'jhs-part-7', icon: '🔒', name: 'Full Reserve', description: 'Pass Part VII: Central Banking, Free Banking and Reform.' },
  { id: 'jhs-all-parts', icon: '🇪🇸', name: 'School of Salamanca', description: 'Pass every part of Money, Bank Credit, and Economic Cycles.' },
  { id: 'jhs-whole-book', icon: '💯', name: '100-Percent Reserve', description: 'Answer every question in Money, Bank Credit, and Economic Cycles right at least once.' },
  { id: 'dmf-part-1', icon: '🏠', name: 'Love, Trade or Force', description: 'Pass Part I of The Machinery of Freedom: In Defense of Property.' },
  { id: 'dmf-part-2', icon: '🚕', name: 'Jitney Transit', description: 'Pass Part II: Schools, Streets and Moon Shots.' },
  { id: 'dmf-part-3', icon: '🥛', name: 'Certified Raw Milk', description: 'Pass Part III: Drugs, Youth and Creeping Capitalism.' },
  { id: 'dmf-part-4', icon: '📺', name: 'Tannahelp Inc.', description: 'Pass Part IV: Anarchy Is Not Chaos.' },
  { id: 'dmf-part-5', icon: '🌋', name: 'Lawspeaker', description: 'Pass Part V: For Libertarians.' },
  { id: 'dmf-part-6', icon: '🗡️', name: 'Right Makes Might', description: 'Pass Part VI: Further Thoughts.' },
  { id: 'dmf-part-7', icon: '🚚', name: 'Capitalist Truck', description: 'Pass Part VII: New Stuff.' },
  { id: 'dmf-all-parts', icon: '🔩', name: 'Agoric Order', description: 'Pass every part of The Machinery of Freedom.' },
  { id: 'dmf-whole-book', icon: '🏴', name: 'Anarchy Is Not Chaos', description: 'Answer every question in The Machinery of Freedom right at least once.' },
  { id: 'fc-part-1', icon: '🔺', name: 'Edict of Diocletian', description: 'Pass Part I of Forty Centuries of Wage and Price Controls: The Ancient World and Rome.' },
  { id: 'fc-part-2', icon: '🦫', name: 'No Corn, No Beaver', description: 'Pass Part II: Medieval Times to the Revolution.' },
  { id: 'fc-part-3', icon: '🌽', name: 'Corn Laws Repealed', description: 'Pass Part III: Corn Laws to the Interwar Years.' },
  { id: 'fc-part-4', icon: '🛑', name: 'Price Stop', description: 'Pass Part IV: Dictatorships and Democracies at War.' },
  { id: 'fc-part-5', icon: '🏚️', name: 'San Francisco, 1906', description: 'Pass Part V: Rents, Incomes and Currencies.' },
  { id: 'fc-part-6', icon: '🥩', name: 'Phase Four', description: 'Pass Part VI: The 1970s and Inflation’s Causes.' },
  { id: 'fc-part-7', icon: '🪶', name: 'Pelatiah Webster', description: 'Pass Part VII: Cures, Effects and Conclusions.' },
  { id: 'fc-all-parts', icon: '🏺', name: 'Forty Centuries', description: 'Pass every part of Forty Centuries of Wage and Price Controls.' },
  { id: 'fc-whole-book', icon: '🎈', name: 'How Not to Fight Inflation', description: 'Answer every question in Forty Centuries of Wage and Price Controls right at least once.' },
  // Every book
  { id: 'well-read', icon: '📚', name: 'Well Read', description: 'Answer 100 different questions right.' },
  // Drills
  { id: 'drill-hard', icon: '🧠', name: 'Hard Mode', description: 'Get 8 or more right in a hard drill.' },
  { id: 'empiricist', icon: '🔬', name: 'Empiricist', description: 'Get 50 hard questions right.' },
  // The daily quiz and the lightning round
  { id: 'daily', icon: '📅', name: 'Daily Reader', description: 'Finish a daily quiz.' },
  { id: 'daily-5', icon: '🗓️', name: 'Book Club', description: 'Play the daily quiz on five different days.' },
  { id: 'streak-days-3', icon: '🔥', name: 'Habit Forming', description: 'Play the daily quiz three days in a row.' },
  { id: 'streak-days-7', icon: '📆', name: 'Week Streak', description: 'Play the daily quiz seven days in a row.' },
  { id: 'streak-days-30', icon: '🎇', name: 'Thirty Days of Anya', description: 'Play the daily quiz thirty days in a row.' },
  { id: 'shared', icon: '📣', name: 'Bragging Rights', description: 'Share a daily quiz result.' },
  { id: 'lightning-10', icon: '⚡', name: 'Speed Reader', description: 'Get 10 right in a lightning round.' },
  { id: 'lightning-20', icon: '🌩️', name: 'Faster Than Inflation', description: 'Get 20 right in a lightning round.' },
  // Peanuts and lifelines
  { id: 'mind-read', icon: '🔮', name: 'Telepath', description: 'Use Mind-read.' },
  { id: 'swap', icon: '🔄', name: 'Second Opinion', description: 'Use Swap.' },
  { id: 'ask-sowell', icon: '👓', name: 'Ask the Author', description: 'Ask the author for a hint.' },
  { id: 'peanuts-100', icon: '🥜', name: 'Peanut Gallery', description: 'Earn 100 peanuts in all.' },
  { id: 'no-lifelines', icon: '🦾', name: 'No Help Needed', description: 'Pass a part without using any lifelines.' },
  // Secret
  { id: 'still-dumb', icon: '🤦', name: 'Still Dumb', description: 'Score 0 out of 10.', secret: true },
  { id: 'no-refunds', icon: '🧾', name: 'No Refunds', description: 'Get stamped STILL DUMB three times.', secret: true },
  { id: 'lucky', icon: '🍀', name: 'Lucky Guess', description: 'Get a hard question right within two seconds.', secret: true },
  { id: 'cant-help', icon: '🤯', name: 'Even Anya Can’t Help', description: 'Get it wrong after Mind-read left only two answers.', secret: true },
  { id: 'sowell-said', icon: '🙉', name: 'Didn’t Listen', description: 'Get it wrong right after asking the author.', secret: true },
  // Mistakes review and final exams
  { id: 'review', icon: '🩹', name: 'Second Chance', description: 'Finish a mistakes review.' },
  { id: 'review-empty', icon: '🧽', name: 'Clean Slate', description: 'Clear every question from a book’s mistakes review.' },
  { id: 'showdown', icon: '🤺', name: 'Ringside Seat', description: 'Finish a showdown between two books.' },
  { id: 'showdown-perfect', icon: '🥊', name: 'Referee', description: 'Get every claim right in a showdown.' },
  { id: 'showdown-all', icon: '🏟️', name: 'Undisputed', description: 'Finish every showdown.' },
  { id: 'flashcards', icon: '🗂️', name: 'Flash Learner', description: 'Go through a whole deck of flashcards.' },
  { id: 'flashcards-all', icon: '📇', name: 'Walking Dictionary', description: 'Know every key term in a book.' },
  { id: 'exam', icon: '🧑‍🎓', name: 'Graduate', description: 'Pass a book’s final exam (16 out of 20, no lifelines).' },
  { id: 'exam-perfect', icon: '🏆', name: 'Summa Cum Laude', description: 'Get 20 out of 20 in a final exam.' },
  { id: 'exam-3', icon: '🎖️', name: 'Triple Major', description: 'Pass the final exams of three books.' },
  // Easter eggs (secret): touch Anya, or keep her waiting
  { id: 'night-owl', icon: '🌙', name: 'Night Owl', description: 'Start a quiz between midnight and 4 a.m.', secret: true },
  { id: 'early-bird', icon: '🐦', name: 'Early Bird', description: 'Start a quiz between 5 and 7 a.m.', secret: true },
  { id: 'boop', icon: '👃', name: 'Boop!', description: 'Boop Anya’s nose.', secret: true },
  { id: 'impatient', icon: '⏰', name: 'Tick Tock', description: 'Keep Anya waiting until she gets impatient.', secret: true },
  { id: 'pink-hair', icon: '🌸', name: 'Pretty in Pink', description: 'Pat Anya’s head ten times.', secret: true },
  { id: 'green-eyes', icon: '💚', name: 'Green-Eyed', description: 'Poke Anya’s eyes ten times.', secret: true },
  { id: 'makeover', icon: '🎀', name: 'Full Makeover', description: 'Unlock both of Anya’s new looks.', secret: true },
  // The secret book: Anya hands you Capital after too many wrong answers. Every one of these is a secret.
  { id: 'red-pill', icon: '🚩', name: 'Reading List', description: 'Get ten answers wrong in a row, or a hundred wrong in all. Anya has a book for you.', secret: true },
  { id: 'kap-part-1', icon: '🧥', name: '20 Yards of Linen', description: 'Pass Part I of Capital: Commodities, Money and Capital.', secret: true },
  { id: 'kap-part-2', icon: '🧛', name: 'Vampire-Like', description: 'Pass Part II: Surplus-Value, the Working Day and Machinery.', secret: true },
  { id: 'kap-part-3', icon: '🐑', name: 'Sheep-Walk', description: 'Pass Part III: Wages, Accumulation and Expropriation.', secret: true },
  { id: 'kap-part-4', icon: '🔁', name: 'Circuit of Capital', description: 'Pass Part IV: The Circulation of Capital.', secret: true },
  { id: 'kap-part-5', icon: '⚗️', name: 'Transformation Problem', description: 'Pass Part V: Profit and Prices of Production.', secret: true },
  { id: 'kap-part-6', icon: '📉', name: 'Tendency to Fall', description: 'Pass Part VI: The Falling Rate of Profit and Merchant’s Capital.', secret: true },
  { id: 'kap-part-7', icon: '🍐', name: 'Pear-Trees Bearing Pears', description: 'Pass Part VII: Interest, Credit, Rent and Classes.', secret: true },
  { id: 'kap-all-parts', icon: '⚒️', name: 'Expropriators Expropriated', description: 'Pass every part of Capital.', secret: true },
  { id: 'kap-whole-book', icon: '🕵️', name: 'Know Your Enemy', description: 'Answer every question in Capital right at least once.', secret: true },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Per-book achievement ids. Basic Economics came first, so its ids have no prefix. */
const perBook = (book: string, id: string) => (book === 'be' ? id : `${book}-${id}`);
export const partAchievement = (book: string, part: number) => perBook(book, `part-${part}`);
export const allPartsAchievement = (book: string) => perBook(book, 'all-parts');
export const wholeBookAchievement = (book: string) => perBook(book, 'whole-book');

export function normalizeUnlocked(raw: unknown): Set<string> {
  return new Set((Array.isArray(raw) ? raw : []).filter((id): id is string => typeof id === 'string' && !!achievementById(id)));
}
