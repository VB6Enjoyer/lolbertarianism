// Achievements: checked against the term in progress (or just finished) and the lifetime records,
// after every move. A few are secret until earned.

import { findPolicy, type Game, QUARTERS, QUESTIONS_PER_QUARTER, score, won } from './council.ts';

export interface Records {
  wins: number;
  mirrorWins: number;
  dailies: number;
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  secret?: boolean;
  done: (g: Game | null, r: Records) => boolean;
}

const over = (g: Game | null): g is Game => !!g && g.phase === 'over';
const fired = (g: Game, impostor: boolean) => g.advisors.filter((a) => a.fired && a.impostor === impostor).length;
const kindOf = (id: string) => findPolicy(id)?.kind;

export const ACHIEVEMENTS: Achievement[] = [
  // --- Getting started ---
  { id: 'sworn-in', icon: '🎖️', name: 'Sworn In', description: 'Finish a term, however it ends.', done: (g) => over(g) },
  { id: 'stateless', icon: '😎', name: 'Still Stateless', description: 'Win a term as Ancapball.', done: (g, r) => (over(g) && won(g) && g.mode === 'ancap') || r.wins - r.mirrorWins > 0 },
  { id: 'gotcha-one', icon: '🕵️', name: 'Under the Paint', description: 'Fire an impostor.', done: (g) => !!g && fired(g, true) >= 1 },
  { id: 'purge', icon: '🧹', name: 'Purge', description: 'Fire both impostors.', done: (g) => !!g && fired(g, true) >= 2 },
  { id: 'clean-sweep', icon: '✨', name: 'Clean Sweep', description: 'Fire both impostors without firing anyone loyal.', done: (g) => !!g && g.ending === 'purged' && fired(g, false) === 0 },
  { id: 'blitz', icon: '⚡', name: 'Blitz', description: 'Purge the council by the end of the third quarter.', done: (g) => !!g && g.ending === 'purged' && g.quarter <= 3 },
  { id: 'full-term', icon: '📅', name: 'Full Term', description: 'Serve all eight quarters.', done: (g) => !!g && g.ending === 'term' && g.twist !== 'snap-election' },
  { id: 'enemies-close', icon: '🤝', name: 'Keep Your Enemies Close', description: 'Serve the whole term with an impostor still on the council.', done: (g) => !!g && g.ending === 'term' && g.advisors.some((a) => a.impostor && !a.fired) },

  // --- Detective work ---
  { id: 'interrogator', icon: '❓', name: 'Interrogator', description: `Ask every question you’re allowed in a full term (${QUESTIONS_PER_QUARTER * QUARTERS} or more).`, done: (g) => !!g && g.answers.length >= QUESTIONS_PER_QUARTER * QUARTERS },
  { id: 'slip-fire', icon: '🎯', name: 'Gotcha', description: 'Fire an impostor who slipped in one of your interviews.', done: (g) => !!g && g.advisors.some((a) => a.fired && a.impostor && g.answers.some((x) => x.advisor === a.id && x.tone === 'slip')) },
  { id: 'paper-trail', icon: '🔍', name: 'Paper Trail', description: 'Unmask an impostor with a background check.', done: (g) => !!g && g.checked.some((id) => g.advisors[id]?.impostor) },
  { id: 'judge', icon: '🧐', name: 'Good Judge of Character', description: 'End a term with at least three marks, every ✅ on someone loyal and every 🚩 on an impostor.', done: (g) => {
    if (!over(g)) return false;
    const marked = g.advisors.filter((a) => a.mark !== 'none');
    return marked.length >= 3 && marked.every((a) => (a.mark === 'trust') === !a.impostor);
  } },

  // --- Running the country ---
  { id: 'sound-money', icon: '🪙', name: 'Sound Money', description: 'Serve a full term enacting nothing but sound policy.', done: (g) => !!g && g.ending === 'term' && g.enacted.length >= 6 && g.enacted.every((e) => kindOf(e.policy) === 'sound') },
  { id: 'boom', icon: '📈', name: 'Boom Without Bust', description: 'Win a term and leave the first meter (Prosperity, or the State) no lower than you found it: 50 or more.', done: (g) => over(g) && won(g) && g.prosperity >= 50 },
  { id: 'free-bird', icon: '🗽', name: 'Free as a Bird', description: 'Win a term and leave the second meter (Liberty, or Approval) at 50 or more.', done: (g) => over(g) && won(g) && g.liberty >= 50 },
  { id: 'mises', icon: '🦅', name: 'Mises Would Be Proud', description: 'Score 330 points in a term.', done: (g) => over(g) && score(g) >= 330 },
  { id: 'hayek', icon: '🏆', name: 'Hayek Would Be Prouder', description: 'Score 365 points in a term.', done: (g) => over(g) && score(g) >= 365 },

  // --- The other side, and the daily ---
  { id: 'vienna-abides', icon: '🇦🇹', name: 'Vienna Abides', description: 'Win a term as Austria, in mirror mode.', done: (g, r) => (over(g) && won(g) && g.mode === 'mirror') || r.mirrorWins > 0 },
  { id: 'both-sides', icon: '🪞', name: 'Both Sides Now', description: 'Win a term on each side.', done: (_g, r) => r.mirrorWins > 0 && r.wins - r.mirrorWins > 0 },
  { id: 'daily', icon: '📆', name: 'Daily Briefing', description: 'Finish a daily term.', done: (g, r) => (over(g) && !!g.daily) || r.dailies > 0 },
  { id: 'dailies', icon: '🗞️', name: 'Newspaper of Record', description: 'Finish 7 daily terms.', done: (_g, r) => r.dailies >= 7 },

  // --- Secrets ---
  { id: 'oops', icon: '😬', name: 'Oops', description: 'Fire someone loyal.', secret: true, done: (g) => !!g && fired(g, false) >= 1 },
  { id: 'hired', icon: '🤦', name: 'I Thought I Hired Austrian Economists', description: 'Let the impostors take over the council.', secret: true, done: (g) => !!g && g.ending === 'takeover' },
  { id: 'nationalize', icon: '🛢️', name: 'Nationalize Oil', description: 'As Ancapball, enact an openly statist policy.', secret: true, done: (g) => !!g && g.mode === 'ancap' && g.enacted.some((e) => kindOf(e.policy) === 'blatant') },
  { id: 'privatize', icon: '🏷️', name: 'Privatize Vienna plz', description: 'As Austria, enact an openly ancap policy.', secret: true, done: (g) => !!g && g.mode === 'mirror' && g.enacted.some((e) => kindOf(e.policy) === 'blatant') },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Everything earned right now (whether or not it was earned before). */
export function earnedNow(g: Game | null, r: Records): string[] {
  return ACHIEVEMENTS.filter((a) => a.done(g, r)).map((a) => a.id);
}

/** Achievements from a save, without any this version doesn't have. */
export function normalizeUnlocked(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && !!achievementById(id)))] : [];
}
