// Achievements for the fight club. main.ts awards them as things happen.

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Hidden (name and description) until it's unlocked. */
  secret?: boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Betting
  { id: 'first-bet', icon: '💵', name: 'Skin in the Game', description: 'Place your first bet.' },
  { id: 'first-win', icon: '💰', name: 'The Market Provides', description: 'Come out ahead on a bout.' },
  { id: 'underdog', icon: '😏', name: 'Contrarian Position, Sweetie', description: 'Win a bet at 3× or longer.' },
  { id: 'longshot', icon: '🦢', name: 'Black Swan', description: 'Win a bet at 8× or longer.' },
  { id: 'big-win', icon: '🐂', name: 'Animal Spirits', description: 'Come out $1,000 ahead on a single bout.' },
  { id: 'cashout-profit', icon: '💸', name: 'Taking Profits', description: 'Cash out a bet for more than you staked.' },
  { id: 'cashout-save', icon: '🛑', name: 'Stop-Loss', description: 'Cash out a bet that would have lost.' },
  { id: 'live-win', icon: '⚡', name: 'In-Play Praxeology', description: 'Win a live bet.' },
  { id: 'parlay', icon: '🧾', name: 'Three for Three', description: 'Hit a parlay.' },
  { id: 'prop-flee', icon: '🏃', name: 'Exit Over Voice', description: 'Win the “a lobster flees” prop.' },
  { id: 'prop-ko1', icon: '1️⃣', name: 'First-Round Knockout', description: 'Win the “KO in round 1” prop.' },
  { id: 'props-3', icon: '🎲', name: 'Diversified Portfolio', description: 'Hit three props on one bout.' },
  { id: 'perfect-night', icon: '🌙', name: 'Perfect Night', description: 'Come out ahead on all five bouts of a night.' },
  { id: 'fade-public', icon: '🙅', name: 'Fade the Public', description: 'Win 5 bets on the crowd’s underdog.' },
  { id: 'diamond-claws', icon: '💎', name: 'Diamond Claws', description: 'Win a bet you could only have cashed out at a loss.' },
  // Intel
  { id: 'tipsters', icon: '🗣️', name: 'Market for Lemons', description: 'Buy tips from all three tipsters.' },
  { id: 'insider-wrong', icon: '🕵️', name: 'Asymmetric Information', description: 'Catch the Insider being wrong.' },
  { id: 'insider-trading', icon: '📈', name: 'Insider Trading', description: 'Win a bet on the Insider’s pick.' },
  { id: 'scout-10', icon: '👀', name: 'Due Diligence', description: 'Scout 10 lobsters in the tank.' },
  { id: 'traits-all', icon: '🔬', name: 'Taxonomist', description: 'Know the trait of every lobster in the league.' },
  // Career
  { id: 'garage', icon: '🚗', name: 'Out of the Kitchen', description: 'Get invited to the Garage.' },
  { id: 'porcfest', icon: '🏕️', name: 'Free State', description: 'Get invited to PorcFest.' },
  { id: 'convention', icon: '🏛️', name: 'Party Animal', description: 'Get invited to the Convention.' },
  { id: 'liberland', icon: '🏰', name: 'Liberland Calling', description: 'Get invited to the Liberland Championship.' },
  { id: 'champion', icon: '🏆', name: 'The Invisible Claw', description: 'Win the Liberland Championship.' },
  { id: 'bailout', icon: '👴', name: 'Have Fun Staying Poor', description: 'Get bailed out by your uncle.' },
  { id: 'boom-bust', icon: '🎢', name: 'Boom and Bust', description: 'Make it to the Convention, then go broke.' },
  // Night events
  { id: 'cantillon', icon: '🖨️', name: 'Cantillon Effect', description: 'End a Money Printer night up on the night.' },
  { id: 'whale-watching', icon: '🐋', name: 'Whale Watching', description: 'Win a bet against the Bitcoin Whale.' },
  { id: 'forfeiture', icon: '🚔', name: 'Civil Asset Forfeiture', description: 'Have money on a bout when the cops raid it.' },
  // Your lobster
  { id: 'buy', icon: '🦞', name: 'Homesteaded a Crustacean', description: 'Buy a lobster of your own.' },
  { id: 'lemon', icon: '🍋', name: 'Bought a Lemon', description: 'Your new lobster turns out to have a bad trait.' },
  { id: 'therapy', icon: '🛋️', name: 'Talk Therapy', description: 'Cure your lobster’s bad trait.' },
  { id: 'mine-win', icon: '🥊', name: 'Prizefighter', description: 'Your lobster wins a fight.' },
  { id: 'mine-hard', icon: '🗿', name: 'Giant Killer', description: 'Your lobster beats a Hard opponent.' },
  { id: 'mine-streak', icon: '🔥', name: 'Undefeated', description: 'Your lobster wins five fights in a row.' },
  { id: 'maxed', icon: '💪', name: 'Peak Lobster', description: 'Train one of your lobster’s stats to 10.' },
  { id: 'dive', icon: '🤫', name: 'Took a Dive', description: 'Throw your lobster’s fight and win your bet on the other one.' },
  { id: 'dive-caught', icon: '🚨', name: 'Caught Red-Clawed', description: 'Get caught throwing a fight.' },
  { id: 'dive-won', icon: '🙃', name: 'It Couldn’t Help Itself', description: 'Your lobster wins a fight you paid it to throw.' },
  // The shark
  { id: 'shark', icon: '🦈', name: 'Leverage', description: 'Borrow from Vinny the Fin.' },
  { id: 'shark-repaid', icon: '🤝', name: 'Debt-Free', description: 'Pay Vinny back in full.' },
  { id: 'shark-claw', icon: '🦴', name: 'Nice Claw. Shame If Something Happened to It.', description: 'Let Vinny collect.' },
  { id: 'moral-hazard', icon: '🎰', name: 'Moral Hazard', description: 'Borrow from Vinny three times.' },
  // Secret
  { id: 'removed', icon: '🚁', name: 'Physically Removed', description: 'Back a Hoppean that wins by knockout.', secret: true },
  { id: 'roads', icon: '🛣️', name: 'Who Will Build the Roads?', description: 'Back an Ancap that beats a Minarchist.', secret: true },
  { id: 'hype', icon: '🎤', name: 'Hype Man', description: 'Back a lobster the announcer called undefeated, and watch it lose.', secret: true },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export function normalizeUnlocked(raw: unknown): Set<string> {
  return new Set((Array.isArray(raw) ? raw : []).filter((id): id is string => typeof id === 'string' && !!achievementById(id)));
}
