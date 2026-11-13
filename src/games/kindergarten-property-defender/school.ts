// The school day: five periods, each with its own mood, a new troublemaker
// most days of the week, the Principal on Fridays, and a report card at 3pm.

export type PeriodId = 'circle' | 'snack' | 'recess' | 'nap' | 'show';

export interface Period {
  id: PeriodId;
  icon: string;
  name: string;
  /** What the teacher says when it starts. */
  line: string;
  /** More or fewer hands, more or fewer of them traders, and faster or slower thieves. */
  spawn: number;
  traders: number;
  speed: number;
}

export const PERIODS: readonly Period[] = [
  { id: 'circle', icon: '🧸', name: 'Circle time', line: 'Circle time, everyone! Hands to yourselves.', spawn: 0.75, traders: 0.15, speed: 1 },
  { id: 'snack', icon: '🍪', name: 'Snack time', line: 'Snack time! Remember to share.', spawn: 1, traders: 0.3, speed: 1 },
  { id: 'recess', icon: '⚽', name: 'Recess', line: 'Recess! Go wild. Within reason.', spawn: 1.55, traders: -0.1, speed: 1.15 },
  { id: 'nap', icon: '😴', name: 'Nap time', line: 'Nap time. Lights off. Shhh.', spawn: 0.8, traders: -0.05, speed: 0.9 },
  { id: 'show', icon: '🎤', name: 'Show and tell', line: 'Show and tell! Who brought something?', spawn: 1.05, traders: 0, speed: 1 },
];

/** Seconds per period, and so the length of a school day. */
export const PERIOD_LENGTH = 11;
export const DAY_LENGTH = PERIOD_LENGTH * PERIODS.length;

export const periodAt = (seconds: number): Period => PERIODS[Math.min(PERIODS.length - 1, Math.floor(seconds / PERIOD_LENGTH))];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
/** Day 1 is the first Monday. */
export const dayName = (day: number) => DAYS[(day - 1) % DAYS.length];
export const weekOf = (day: number) => Math.floor((day - 1) / DAYS.length) + 1;
export const isFriday = (day: number) => (day - 1) % DAYS.length === DAYS.length - 1;

/** The kinds of grabby hand, and the classmates who pretend to trade. */
export type Role = 'grabby' | 'monitor' | 'group' | 'president' | 'fraud' | 'principal' | 'mitten' | 'sticky' | 'superintendent' | 'board' | 'doe';

export interface RoleInfo {
  id: Role;
  name: string;
  /** Introduced on this day of the first week. */
  from: number;
  /** How often it turns up (out of the thieves), once it's around. */
  weight: number;
  intro: string;
}

export const ROLES: readonly RoleInfo[] = [
  { id: 'grabby', name: 'Grabby hand', from: 1, weight: 10, intro: '' },
  { id: 'monitor', name: 'Hall Monitor', from: 2, weight: 1.5, intro: '🦺 New today: the Hall Monitor. Takes three slaps. Just following orders.' },
  { id: 'mitten', name: 'Oven Mitts', from: 3, weight: 1.2, intro: '🧤 New today: Oven Mitts. Slaps bounce right off. RIGHT-CLICK to pinch (on a phone, double-tap).' },
  { id: 'sticky', name: 'Sticky Fingers', from: 4, weight: 1.2, intro: '🍯 New today: Sticky Fingers. Won’t let go of a slap. PRESS AND HOLD on it to pry it off.' },
  { id: 'group', name: 'Group Project', from: 4, weight: 1.5, intro: '👯 Also new: the Group Project kids. They come in pairs. “We did it together!”' },
  { id: 'president', name: 'Class President', from: 5, weight: 1.2, intro: '🗳️ New today: the Class President, here to collect a 10% tax. Slap the ballot box.' },
  { id: 'principal', name: 'The Principal', from: 5, weight: 0, intro: '📢 It’s Friday: the Principal visits during show and tell. Eminent domain. Eight slaps to stop.' },
  { id: 'fraud', name: 'Monopoly-money kid', from: 6, weight: 1.2, intro: '💵 Careful: the Monopoly-money kid looks like a trader, but pays in funny money. Fraud is aggression: slap it, no gold star lost.' },
  // The later Friday bosses (they come on a schedule; see BOSSES)
  { id: 'superintendent', name: 'The Superintendent', from: 999, weight: 0, intro: '' },
  { id: 'board', name: 'The School Board', from: 999, weight: 0, intro: '' },
  { id: 'doe', name: 'The Department of Education', from: 999, weight: 0, intro: '' },
];

/** Friday's boss, a bigger one each week. */
export interface Boss {
  role: Role;
  title: string;
  warning: string;
  /** Hits to send it away, and the share of the pile it takes if it gets there. */
  hp: number;
  take: number;
}

export const BOSSES: readonly Boss[] = [
  { role: 'principal', title: 'THE PRINCIPAL', warning: 'Eminent domain: it takes 30% of your pile. Eight slaps to send it away.', hp: 8, take: 0.3 },
  { role: 'superintendent', title: 'THE SUPERINTENDENT', warning: 'Comes with a Hall Monitor escort, and calls in more as you slap it. Ten slaps. Takes 35%.', hp: 10, take: 0.35 },
  { role: 'board', title: 'THE SCHOOL BOARD', warning: 'Three members, from three directions. Four slaps each. Each one takes 15%.', hp: 4, take: 0.15 },
  { role: 'doe', title: 'THE DEPARTMENT OF EDUCATION', warning: 'Switches between needing slaps and needing pinches (right-click). Fourteen hits. Takes 40%.', hp: 14, take: 0.4 },
];

/** This week's boss (the Department of Education keeps coming back, tougher every week). */
export const bossFor = (week: number): Boss => {
  const b = BOSSES[Math.min(week, BOSSES.length) - 1];
  return week > BOSSES.length ? { ...b, hp: b.hp + 3 * (week - BOSSES.length) } : b;
};

export const isBoss = (r: Role | null | undefined) => !!r && BOSSES.some((b) => b.role === r);
export const bossInfo = (r: Role) => BOSSES.find((b) => b.role === r);

/** How the special input each troublemaker needs (most just need a slap). */
export const NEEDS: Partial<Record<Role, 'pinch' | 'hold'>> = { mitten: 'pinch', sticky: 'hold' };

export const roleInfo = (r: Role) => ROLES.find((x) => x.id === r)!;

/** Which troublemakers are around on a day (the Principal comes on a schedule, not by chance). */
export function rolesOn(day: number): RoleInfo[] {
  return ROLES.filter((r) => r.weight > 0 && r.from <= day);
}

/**
 * Troublemakers get more common every day after they first turn up (the ones that need a pinch or a hold
 * fastest), and plain grabby hands get rarer.
 */
export function weightOn(r: RoleInfo, day: number): number {
  if (r.id === 'grabby') return Math.max(5, r.weight - 0.4 * (day - 1));
  const since = day - r.from;
  return NEEDS[r.id] ? r.weight * Math.min(4, 1 + 0.5 * since) : r.weight * Math.min(3, 1 + 0.3 * since);
}

/** Who's new today (first week only). */
export const newToday = (day: number): RoleInfo[] => ROLES.filter((r) => r.from === day && r.id !== 'grabby');

export function pickRole(day: number, period: PeriodId, rng: () => number): Role {
  const pool = rolesOn(day).map((r) => ({ id: r.id, weight: weightOn(r, day) * (period === 'show' && r.id !== 'grabby' ? 2 : 1) }));
  let roll = rng() * pool.reduce((sum, r) => sum + r.weight, 0);
  for (const r of pool) {
    roll -= r.weight;
    if (roll <= 0) return r.id;
  }
  return 'grabby';
}

/** How the day went, for the report card. */
export interface DayStats {
  /** Grabby hands that came for the pile, and the ones stopped (slapped, scared, or caught on the way out). */
  thieves: number;
  stopped: number;
  trades: number;
  profit: number;
  violations: number;
  stolen: number;
}

export const emptyDay = (): DayStats => ({ thieves: 0, stopped: 0, trades: 0, profit: 0, violations: 0, stolen: 0 });

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
const grade = (x: number, cuts: [number, number, number, number]): Grade => (x >= cuts[0] ? 'A' : x >= cuts[1] ? 'B' : x >= cuts[2] ? 'C' : x >= cuts[3] ? 'D' : 'F');

export interface ReportCard {
  defence: Grade;
  economics: Grade;
  citizenship: Grade;
  comment: string;
  /** Points for the grades. */
  bonus: number;
}

export function reportCard(d: DayStats): ReportCard {
  const defence = grade(d.thieves ? d.stopped / d.thieves : 1, [0.9, 0.75, 0.6, 0.45]);
  const economics = grade(d.trades + Math.max(0, d.profit) / 3, [10, 7, 4, 2]);
  const citizenship: Grade = (['A', 'B', 'C', 'D'] as Grade[])[d.violations] ?? 'F';
  const points: Record<Grade, number> = { A: 100, B: 60, C: 30, D: 10, F: 0 };
  const comment =
    citizenship === 'F'
      ? 'Jack has been hitting classmates who only wanted to trade. We talked about consent.'
      : defence === 'A' && economics === 'A'
        ? 'Jack runs a tight ship. Refuses to share. Somehow everyone wants to trade with him anyway.'
        : defence === 'A'
          ? 'Jack guards his blocks with real conviction. Keeps saying “property rights”.'
          : economics === 'A'
            ? 'Jack has started a small trading empire. I am not sure that is allowed. It is.'
            : defence === 'F' || defence === 'D'
              ? 'Jack lost a lot of blocks today. Sharing is caring, I told him. He did not agree.'
              : 'Jack has strong opinions for a five-year-old. A pleasure to have in class, mostly.';
  return { defence, economics, citizenship, comment, bonus: points[defence] + points[economics] + points[citizenship] };
}

/** The weekend's allowance (after Friday): more each week. */
export const allowance = (week: number) => 3 + week * 2;
