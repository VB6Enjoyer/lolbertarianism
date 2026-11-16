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
  { id: 'took-book', icon: '📕', name: 'Here, Take This', description: 'Take the book from Anya.' },
  { id: 'first-right', icon: '✅', name: 'Not Dumb After All', description: 'Get your first answer right.' },
  { id: 'streak-5', icon: '😏', name: 'Heh.', description: 'Get five right in a row.' },
  { id: 'streak-10', icon: '✨', name: 'Waku Waku', description: 'Get ten right in a row.' },
  { id: 'perfect', icon: '💯', name: 'Not Dumb', description: 'Get 10 out of 10 in a part, a drill or the daily quiz.' },
  // The book, part by part
  { id: 'part-1', icon: '🏷️', name: 'The Price Is Right', description: 'Pass Part I: Prices and Markets.' },
  { id: 'part-2', icon: '🏭', name: 'Captain of Industry', description: 'Pass Part II: Industry and Commerce.' },
  { id: 'part-3', icon: '🔧', name: 'Worth Your Wage', description: 'Pass Part III: Work and Pay.' },
  { id: 'part-4', icon: '⏳', name: 'Low Time Preference', description: 'Pass Part IV: Time and Risk.' },
  { id: 'part-5', icon: '🏛️', name: 'Macro Manager', description: 'Pass Part V: The National Economy.' },
  { id: 'part-6', icon: '🌍', name: 'Comparative Advantage', description: 'Pass Part VI: The International Economy.' },
  { id: 'part-7', icon: '🧙', name: 'Myth Buster', description: 'Pass Part VII: Special Economic Issues.' },
  { id: 'all-parts', icon: '🎓', name: 'Sowell-Pilled', description: 'Pass every part of the book.' },
  { id: 'well-read', icon: '📚', name: 'Well Read', description: 'Answer 100 different questions right.' },
  { id: 'whole-book', icon: '📖', name: 'Read the Whole Book', description: 'Answer every question in the book right at least once.' },
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
  { id: 'ask-sowell', icon: '👓', name: 'Ask the Author', description: 'Use Ask Sowell.' },
  { id: 'peanuts-100', icon: '🥜', name: 'Peanut Gallery', description: 'Earn 100 peanuts in all.' },
  { id: 'no-lifelines', icon: '🦾', name: 'No Help Needed', description: 'Pass a part without using any lifelines.' },
  // Secret
  { id: 'still-dumb', icon: '🤦', name: 'Still Dumb', description: 'Score 0 out of 10.', secret: true },
  { id: 'no-refunds', icon: '🧾', name: 'No Refunds', description: 'Get stamped STILL DUMB three times.', secret: true },
  { id: 'lucky', icon: '🍀', name: 'Lucky Guess', description: 'Get a hard question right within two seconds.', secret: true },
  { id: 'cant-help', icon: '🤯', name: 'Even Anya Can’t Help', description: 'Get it wrong after Mind-read left only two answers.', secret: true },
  { id: 'sowell-said', icon: '🙉', name: 'Didn’t Listen', description: 'Get it wrong right after asking Sowell.', secret: true },
  // Easter eggs (secret): touch Anya, or keep her waiting
  { id: 'boop', icon: '👃', name: 'Boop!', description: 'Boop Anya’s nose.', secret: true },
  { id: 'impatient', icon: '⏰', name: 'Tick Tock', description: 'Keep Anya waiting until she gets impatient.', secret: true },
  { id: 'pink-hair', icon: '🌸', name: 'Pretty in Pink', description: 'Pat Anya’s head ten times.', secret: true },
  { id: 'green-eyes', icon: '💚', name: 'Green-Eyed', description: 'Poke Anya’s eyes ten times.', secret: true },
  { id: 'makeover', icon: '🎀', name: 'Full Makeover', description: 'Unlock both of Anya’s new looks.', secret: true },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export function normalizeUnlocked(raw: unknown): Set<string> {
  return new Set((Array.isArray(raw) ? raw : []).filter((id): id is string => typeof id === 'string' && !!achievementById(id)));
}
