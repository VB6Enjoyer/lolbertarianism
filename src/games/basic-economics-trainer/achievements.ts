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
  // Every book
  { id: 'well-read', icon: '📚', name: 'Well Read', description: 'Answer 100 different questions right.' },
  // Drills
  { id: 'drill-hard', icon: '🧠', name: 'Hard Mode', description: 'Get 8 or more right in a hard drill.' },
  { id: 'empiricist', icon: '🔬', name: 'Empiricist', description: 'Get 50 hard questions right.' },
  // The daily quiz and the lightning round
  { id: 'daily', icon: '📅', name: 'Daily Reader', description: 'Finish a daily quiz.' },
  { id: 'daily-5', icon: '🗓️', name: 'Book Club', description: 'Play the daily quiz on five different days.' },
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
  // Easter eggs (secret): touch Anya, or keep her waiting
  { id: 'boop', icon: '👃', name: 'Boop!', description: 'Boop Anya’s nose.', secret: true },
  { id: 'impatient', icon: '⏰', name: 'Tick Tock', description: 'Keep Anya waiting until she gets impatient.', secret: true },
  { id: 'pink-hair', icon: '🌸', name: 'Pretty in Pink', description: 'Pat Anya’s head ten times.', secret: true },
  { id: 'green-eyes', icon: '💚', name: 'Green-Eyed', description: 'Poke Anya’s eyes ten times.', secret: true },
  { id: 'makeover', icon: '🎀', name: 'Full Makeover', description: 'Unlock both of Anya’s new looks.', secret: true },
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
