// The daily cycle: one seeded run per day, the same for everyone, with a
// twist on the Fed's schedule. The twists rotate so each comes up once a week.

export type TwistId = 'weimar' | 'gold-standard' | 'stagflation' | 'police-state' | 'helicopter' | 'gilded-age' | 'zirp';

export interface Twist {
  id: TwistId;
  icon: string;
  name: string;
  description: string;
}

export const TWISTS: readonly Twist[] = [
  { id: 'weimar', icon: '🛒', name: 'Weimar Day', description: 'Hyperinflation: prices triple and keep going. Cash rots in your hands; gold and covers don’t.' },
  { id: 'gold-standard', icon: '🥇', name: 'Gold Standard Day', description: 'No booms, no busts, no inflation. Just honest scrap at honest prices.' },
  { id: 'stagflation', icon: '🐌', name: 'Stagflation Day', description: 'Booms barely lift scrap prices, but inflation runs hot all day.' },
  { id: 'police-state', icon: '🚓', name: 'Police State Day', description: 'Three cops on patrol from the start, and up to five.' },
  { id: 'helicopter', icon: '🚁', name: 'Helicopter Money Day', description: 'Stimulus checks rain down every half minute. So do prices.' },
  { id: 'gilded-age', icon: '🎺', name: 'Gilded Age Day', description: 'Half the covers in town are brass.' },
  { id: 'zirp', icon: '0️⃣', name: 'Zero Rates Day', description: 'Long booms at 0%, short sharp busts. The bubble never pops… until it does.' },
];

export const twistById = (id: TwistId) => TWISTS.find((t) => t.id === id)!;

export interface Daily {
  /** The local date, YYYY-MM-DD. */
  key: string;
  seed: number;
  twist: Twist;
}

/** Today's (or any day's) cycle. */
export function dailyFor(date: Date): Daily {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Days since 1970 in local time, so the twist changes at local midnight.
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return { key, seed: (day * 2654435761) >>> 0, twist: TWISTS[day % TWISTS.length] };
}

/** mulberry32: a small seeded random-number generator returning [0, 1). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Keeps valid dates with positive scores, the 60 most recent. */
export function normalizeDailyBests(raw: unknown): Record<string, number> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const entries = Object.entries(r)
    .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number(v) > 0)
    .map(([k, v]) => [k, Math.floor(Number(v))] as const)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 60);
  return Object.fromEntries(entries);
}
