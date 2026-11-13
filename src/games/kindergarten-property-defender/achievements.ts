// Achievements for Kindergarten Property Defender. main.ts awards them as things happen.

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Hidden (name and description) until it's unlocked. */
  secret?: boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Slapping
  { id: 'first-slap', icon: '👋', name: 'Hands Off', description: 'Slap your first grabby hand.' },
  { id: 'combo-10', icon: '🔥', name: 'On a Roll', description: 'Slap 10 thieves in a row.' },
  { id: 'combo-25', icon: '🥋', name: 'Untouchable', description: 'Slap 25 thieves in a row.' },
  { id: 'repossess', icon: '🔙', name: 'Repossessed', description: 'Catch a thief on its way out and get your blocks back.' },
  { id: 'repo-10', icon: '🚚', name: 'Repo Man', description: 'Get 10 stolen blocks back in one game.' },
  // The cast
  { id: 'monitor', icon: '🦺', name: 'Just Following Orders', description: 'Send a Hall Monitor packing.' },
  { id: 'fraud', icon: '💵', name: 'Fraud Is Aggression', description: 'Slap the Monopoly-money kid.' },
  { id: 'president', icon: '🗳️', name: 'Vote With Your Hands', description: 'Slap the Class President before the tax comes in.' },
  { id: 'principal', icon: '📢', name: 'No Eminent Domain', description: 'Send the Principal away.' },
  { id: 'superintendent', icon: '🏛️', name: 'District Overruled', description: 'Send the Superintendent away.' },
  { id: 'board', icon: '📋', name: 'Motion Denied', description: 'Send all three School Board members away.' },
  { id: 'doe', icon: '🦅', name: 'Abolish It', description: 'Send the Department of Education away.' },
  { id: 'shout', icon: '📢', name: 'Property Rights!', description: 'Shout PROPERTY RIGHTS! with a full meter.' },
  { id: 'shout-5', icon: '🌪️', name: 'Hurricane Jack', description: 'Blow away 5 or more hands with one shout.' },
  { id: 'item', icon: '🎒', name: 'Utility Maximizer', description: 'Use something from your stash instead of selling it.' },
  { id: 'mitten', icon: '🧤', name: 'Oven Mitts Off', description: 'Pinch away a pair of Oven Mitts.' },
  { id: 'sticky', icon: '🍯', name: 'Pry Bar', description: 'Pry Sticky Fingers off your pile.' },
  // Trading
  { id: 'first-trade', icon: '🤝', name: 'Voluntary Exchange', description: 'Complete your first trade.' },
  { id: 'flip', icon: '📈', name: 'Buy Low, Sell High', description: 'Sell something you traded for.' },
  { id: 'middleman', icon: '🧑‍💼', name: 'Middleman', description: 'Sell something for 2 or more blocks more than you paid.' },
  { id: 'collector', icon: '🎒', name: 'Collector', description: 'Have 5 things in your stash at once.' },
  { id: 'tycoon', icon: '🎩', name: 'Kindergarten Tycoon', description: 'Make 50 trades in one game.' },
  // Citizenship
  { id: 'my-bad', icon: '😬', name: 'My Bad', description: 'Slap a classmate who only wanted to trade.' },
  { id: 'redemption', icon: '⭐', name: 'Redemption', description: 'Win a gold star back with good trades.' },
  { id: 'model-citizen', icon: '😇', name: 'Model Citizen', description: 'Go a whole week without a NAP violation.' },
  // Report cards
  { id: 'straight-a', icon: '🅰️', name: 'Straight A’s', description: 'Get all A’s on a report card.' },
  // Getting through the weeks
  { id: 'tgif', icon: '🎉', name: 'TGIF', description: 'Make it through your first Friday.' },
  { id: 'week-2', icon: '📅', name: 'Two Weeks’ Notice', description: 'Make it through two weeks.' },
  { id: 'week-3', icon: '🎓', name: 'Tenure', description: 'Make it through three weeks.' },
  { id: 'night-watch', icon: '🔦', name: 'Night Watch', description: 'Get through nap time without losing a block.' },
  { id: 'score-10k', icon: '🏅', name: 'Gold Star Student', description: 'Score 10,000 points in one game.' },
  { id: 'score-50k', icon: '🏆', name: 'Valedictorian', description: 'Score 50,000 points in one game.' },
  // Capital
  { id: 'first-build', icon: '🏗️', name: 'Capital Formation', description: 'Build something with your blocks.' },
  { id: 'lemonade', icon: '🍋', name: 'Lemonade Mogul', description: 'Build the lemonade stand all the way up.' },
  { id: 'security', icon: '🕶️', name: 'Private Security', description: 'Hire the kid in shades.' },
  { id: 'diversified', icon: '🧺', name: 'Diversified', description: 'Build one of everything.' },
  { id: 'compound', icon: '🐷', name: 'Compound Interest', description: 'Earn 20 blocks of interest in one game.' },
  { id: 'capitalist-pig', icon: '🏰', name: 'Capitalist Pig', description: 'Have 60 blocks, the most the pile can hold.' },
  // Secret
  { id: 'funny-money', icon: '🃏', name: 'Funny Money', description: 'Get paid in Monopoly money.', secret: true },
  { id: 'unpaid', icon: '🧾', name: 'Unpaid Wages', description: 'Can’t pay the security kid, who quits.', secret: true },
  { id: 'nightmare', icon: '😈', name: 'Teacher’s Nightmare', description: 'Get an F in Plays Well With Others.', secret: true },
  { id: 'expelled', icon: '🚸', name: 'Principal’s Office', description: 'Get sent to the principal.', secret: true },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export function normalizeUnlocked(raw: unknown): Set<string> {
  return new Set((Array.isArray(raw) ? raw : []).filter((id): id is string => typeof id === 'string' && !!achievementById(id)));
}
