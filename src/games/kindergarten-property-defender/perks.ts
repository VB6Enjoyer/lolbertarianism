// Weekend perks: after each Friday, Jack picks one of three upgrades. Each run
// builds a different Jack.

export type PerkId = 'hands' | 'loud' | 'pry' | 'double' | 'sales' | 'homestead' | 'reputation' | 'fence' | 'combo' | 'night';

export interface Perk {
  id: PerkId;
  icon: string;
  name: string;
  description: string;
  /** How many times it can be picked. */
  max: number;
}

export const PERKS: readonly Perk[] = [
  { id: 'hands', icon: '🖐️', name: 'Big Hands', description: 'Your slaps reach 25% farther.', max: 2 },
  { id: 'loud', icon: '📢', name: 'Loudmouth', description: 'The PROPERTY RIGHTS! meter fills 3 slaps sooner.', max: 2 },
  { id: 'pry', icon: '🍯', name: 'Pry Master', description: 'Sticky Fingers come off 40% quicker.', max: 1 },
  { id: 'double', icon: '👐', name: 'Double Slap', description: 'On a streak of 5 or more, each slap also knocks away the next-nearest thief.', max: 1 },
  { id: 'sales', icon: '💰', name: 'Salesman', description: 'Classmates pay an extra block when they buy from your stash.', max: 1 },
  { id: 'homestead', icon: '🏠', name: 'Homesteader', description: 'A new block from the toy bin every 6 seconds instead of 9.', max: 1 },
  { id: 'reputation', icon: '😇', name: 'Good Reputation', description: 'All your gold stars back now, and they come back after 2 good trades instead of 3.', max: 1 },
  { id: 'fence', icon: '🖍️', name: 'Morning Fence', description: 'Start every day with 2 crayon-fence charges.', max: 1 },
  { id: 'combo', icon: '🎯', name: 'Combo King', description: 'Your streak multiplier goes up to ×6 instead of ×4.', max: 1 },
  { id: 'night', icon: '🔦', name: 'Night Vision', description: 'More light at nap time, around the pile and the pointer.', max: 1 },
];

export const perkById = (id: PerkId) => PERKS.find((p) => p.id === id)!;

export type Perks = Record<PerkId, number>;
export const noPerks = (): Perks => ({ hands: 0, loud: 0, pry: 0, double: 0, sales: 0, homestead: 0, reputation: 0, fence: 0, combo: 0, night: 0 });

/** Three different perks to choose from (fewer, if almost everything's been taken). */
export function perkChoices(have: Perks, rng: () => number): PerkId[] {
  const open = PERKS.filter((p) => have[p.id] < p.max).map((p) => p.id);
  for (let i = open.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [open[i], open[j]] = [open[j], open[i]];
  }
  return open.slice(0, 3);
}

// --- Graduation ---

/** Jack graduates at the end of this week. */
export const GRADUATION_WEEK = 5;

/** Grade points for the GPA. */
export const GRADE_POINTS: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export function honours(gpa: number): string {
  if (gpa >= 3.5) return 'summa cum laude';
  if (gpa >= 3) return 'magna cum laude';
  if (gpa >= 2.5) return 'cum laude';
  return '';
}
