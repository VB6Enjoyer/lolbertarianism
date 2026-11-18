// Days: the daily-quiz streak, how long you've been away, the time of day, and what Anya says about all three.
// Pure (dates in, words out), so it can be tested; main.ts keeps the state and shows the lines.

import type { Face } from './anya.ts';

/** Days from one date key (YYYY-MM-DD, local) to another: 1 for yesterday-to-today. */
export function daysBetween(from: string, to: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** The daily-quiz streak: the last day you did a daily quiz, how many days in a row up to it, and your longest run. */
export interface DailyStreak {
  last: string;
  current: number;
  best: number;
}

export const emptyStreak = (): DailyStreak => ({ last: '', current: 0, best: 0 });

/** The streak after finishing a daily quiz today: once a day counts, the day after yesterday continues it, a gap restarts it. */
export function recordDaily(s: DailyStreak, today: string): DailyStreak {
  if (s.last === today) return s;
  const current = s.last && daysBetween(s.last, today) === 1 ? s.current + 1 : 1;
  return { last: today, current, best: Math.max(s.best, current) };
}

/** The streak as it stands today: still alive if your last daily quiz was today or yesterday, otherwise gone. */
export const liveStreak = (s: DailyStreak, today: string) => (s.last && daysBetween(s.last, today) <= 1 ? s.current : 0);

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

const TIME_LINES: Record<PartOfDay, string[]> = {
  morning: [
    'Good morning. Anya has been up for hours. Fine, minutes. Take the book.',
    'Morning! Economics before breakfast. Very healthy. Anya read it in a magazine.',
    'You’re up early. Suspicious. Take the book before Anya changes her mind.',
  ],
  afternoon: [
    'Good afternoon. Perfect time for economics. All times are. Take the book.',
    'Afternoon slump? Anya has the cure: scarcity, choices and tradeoffs.',
    'Lunch is over. Learning starts now. Take the book.',
  ],
  evening: [
    'Good evening. One more chapter before bed. Anya insists.',
    'Evening study session. Anya approves. Mostly of herself, for suggesting it.',
    'The sun is down, the book is up. Take it.',
  ],
  night: [
    'It’s late. Anya should be asleep. So should you. Take the book anyway.',
    'Studying at this hour? Anya is impressed. And a bit worried.',
    'Night owl, huh? Opportunity cost of sleep: very high. Take the book.',
  ],
};

/** A short aside for the menu, by time of day. */
export const TIME_ASIDES: Record<PartOfDay, string[]> = {
  morning: ['Morning brain is the best brain. Use it.'],
  afternoon: ['Afternoon. The book won’t read itself, even after lunch.'],
  evening: ['A part before bed? Anya likes your style.'],
  night: ['It’s very late. Anya is only staying up for you. Don’t tell anyone.'],
};

/** How long you’ve been away, in Anya’s words. */
function awayLine(days: number): string[] {
  if (days >= 30)
    return [
      `${days} days?! Anya thought you’d moved to a socialist country. Welcome back. Take the book.`,
      'You’re alive! Anya was about to put up posters. Missing: one student, probably dumb.',
    ];
  if (days >= 7)
    return [
      `Over a week. ${days} days, to be precise. Anya counted. Not because she missed you.`,
      'Look who remembered Anya exists. The books gathered dust. Anya did not. Take one.',
    ];
  return [
    'You’re back. Anya wasn’t waiting. At all. Take the book.',
    `${days} days without economics. Anya hopes you weren’t buying anything with price controls.`,
    'Oh. It’s you. Anya was just… reading. Not waiting. Take the book.',
  ];
}

export interface GreetingState {
  hour: number;
  /** Days since your last visit (0 if today, null on your very first). */
  daysAway: number | null;
  /** A streak of two days or more that lapsed since your last daily quiz. */
  brokenStreak: number;
}

/** What Anya says when you open the game. */
export function greeting(state: GreetingState, rng: () => number = Math.random): { face: Face; line: string } {
  const pick = (lines: readonly string[]) => lines[Math.floor(rng() * lines.length)];
  if (state.daysAway === null) return { face: 'shock', line: 'Take the book. I don’t have all day.' };
  if (state.brokenStreak >= 2)
    return {
      face: 'pout',
      line: pick([
        `You broke your ${state.brokenStreak}-day streak. Anya isn’t upset. Anya is never upset. Hmph.`,
        `A ${state.brokenStreak}-day streak, gone. Anya will be fine. Eventually. Do today’s quiz.`,
      ]),
    };
  if (state.daysAway >= 2) return { face: state.daysAway >= 7 ? 'deadpan' : 'smug', line: pick(awayLine(state.daysAway)) };
  return { face: 'smug', line: pick(TIME_LINES[partOfDay(state.hour)]) };
}

/** What she says about your streak after a daily quiz: smugger the longer it gets. */
export function streakLine(current: number): string {
  if (current >= 30) return `🔥 ${current} days in a row. Anya is running out of ways to act unimpressed.`;
  if (current >= 7) return `🔥 ${current}-day streak. Anya will allow herself a small waku waku.`;
  if (current >= 3) return `🔥 ${current}-day streak. Don’t let it go to your head. Come back tomorrow.`;
  if (current === 2) return '🔥 Two days in a row. That’s a streak. Barely.';
  return '🔥 Streak started. Come back tomorrow to keep it.';
}

/** The daily quiz’s result as text to share: the score, a grid of right and wrong, and the streak. */
export function shareText(o: { bookTitle: string; icon: string; date: string; score: number; total: number; results: readonly boolean[]; streak: number; url: string }): string {
  const grid = o.results.map((r) => (r ? '🟩' : '🟥')).join('');
  return [
    `Basic Economics Trainer · Daily quiz ${o.date}`,
    `${o.icon} ${o.bookTitle}: ${o.score}/${o.total}`,
    grid,
    o.streak > 1 ? `🔥 ${o.streak}-day streak` : '',
    o.url,
  ]
    .filter(Boolean)
    .join('\n');
}
