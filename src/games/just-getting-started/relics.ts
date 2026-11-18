// Relics: things Friedman carries for the whole run. Combat and the run check for them by id.

export interface RelicDef {
  id: string;
  name: string;
  emoji: string;
  text: string;
  /** Starter relics come with the run; boss relics are offered after a boss. */
  tier: 'starter' | 'common' | 'boss';
}

const LIST: RelicDef[] = [
  { id: 'glasses', name: 'Thick Glasses', emoji: '👓', tier: 'starter', text: 'On the first turn of each fight, draw 2 more cards.' },
  { id: 'machinery-book', name: 'The Machinery of Freedom (1973)', emoji: '📕', tier: 'starter', text: 'Start each fight with 1 Agency.' },
  { id: 'pipe', name: 'The Pipe', emoji: '🚬', tier: 'common', text: 'Start each fight with 6 Composure.' },
  { id: 'medal', name: 'Nobel Medal', emoji: '🏅', tier: 'common', text: '+12 max Credibility.' },
  { id: 'chalk', name: 'Chalk Dust', emoji: '🧂', tier: 'common', text: 'Start each fight with 1 Momentum.' },
  { id: 'newsweek', name: 'Newsweek Column', emoji: '📰', tier: 'common', text: 'Earn 15 more Royalties after each fight.' },
  { id: 'freelunch', name: 'A Free Lunch', emoji: '🍱', tier: 'common', text: 'Heal 6 Credibility after each fight. (There is such a thing, apparently.)' },
  { id: 'helicopter', name: 'Toy Helicopter', emoji: '🚁', tier: 'common', text: 'Your first Argument in each fight deals double damage.' },
  { id: 'tape', name: '1999 Interview Tape', emoji: '📼', tier: 'common', text: 'The Based meter fills 50% faster. (He predicted e-cash. Laser eyes, deserved.)' },
  { id: 'press', name: 'Printing Press', emoji: '🖨️', tier: 'boss', text: '+1 Airtime every turn. Start each fight with 2 Inflation in your draw pile.' },
  { id: 'vhs', name: 'Free to Choose (VHS Box Set)', emoji: '🎞️', tier: 'boss', text: 'Draw 1 more card every turn.' },
  { id: 'surgery', name: 'Laser Eye Surgery', emoji: '🔴', tier: 'boss', text: 'Laser Eyes deal double damage, and start each fight with the Based meter at least half full.' },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(LIST.map((r) => [r.id, r]));
export const relicDef = (id: string) => RELICS[id];
export const COMMON_RELICS = LIST.filter((r) => r.tier === 'common').map((r) => r.id);
export const BOSS_RELICS = LIST.filter((r) => r.tier === 'boss').map((r) => r.id);
