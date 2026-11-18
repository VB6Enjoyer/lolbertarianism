// Anya's wardrobe: the looks you unlock (with peanuts earned, achievements, or a December visit) and
// how each is drawn. Hair and eye colours are CSS classes on her; hats and glasses are SVG drawn in
// the #anya-wear layer, over her hair and under the arms. One look per slot: one hat, one pair of glasses.

/** Where a look goes: only one per slot is worn at a time. */
export type Slot = 'hair' | 'eyes' | 'face' | 'head';
export const SLOTS: readonly { slot: Slot; label: string }[] = [
  { slot: 'head', label: 'Hats' },
  { slot: 'face', label: 'Glasses' },
  { slot: 'hair', label: 'Hair' },
  { slot: 'eyes', label: 'Eyes' },
];

export type Unlock = { peanuts: number } | { achievement: string; hint: string; secret?: boolean };

export interface Look {
  id: string;
  slot: Slot;
  label: string;
  unlock: Unlock;
  /** What she says when it's new. */
  line: string;
  /** Drawn over her (hats, glasses); colour looks have none. */
  art?: () => string;
  /** Hides her cat-ear clips (a hat that covers them). */
  hidesClips?: boolean;
}

const INK = '#1a1a1a';
const GOLD = '#e8b93a';
const p = (d: string, fill: string, width = 3, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

/** A glint on a lens. */
const glint = (x: number, y: number) => `<path d="M ${x} ${y} l 10 -10 M ${x + 6} ${y + 6} l 5 -5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`;

const glasses = () => `
  ${[158, 242].map((x) => `<circle cx="${x}" cy="222" r="35" fill="#dff1ff" fill-opacity="0.18" stroke="${INK}" stroke-width="4.5"/>${glint(x - 22, 210)}`).join('')}
  ${p('M 193 214 Q 200 206 207 214', 'none', 4)}
  ${p('M 123 216 L 112 210', 'none', 4)}${p('M 277 216 L 288 210', 'none', 4)}`;

const monocle = () => `
  <path d="M 268 248 C 284 280 270 300 292 330" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M 268 248 C 284 280 270 300 292 330" fill="none" stroke="${GOLD}" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
  <circle cx="242" cy="222" r="35" fill="#fff6d8" fill-opacity="0.2" stroke="${INK}" stroke-width="7"/>
  <circle cx="242" cy="222" r="35" fill="none" stroke="${GOLD}" stroke-width="3.5"/>
  ${glint(220, 210)}`;

const shades = () => `
  ${p('M 116 196 L 196 196 L 192 230 Q 158 254 124 232 Z', '#141414', 3.5)}
  ${p('M 284 196 L 204 196 L 208 230 Q 242 254 276 232 Z', '#141414', 3.5)}
  ${p('M 194 200 L 206 200', 'none', 5)}
  ${p('M 116 198 L 104 192 M 284 198 L 296 192', 'none', 4)}
  <path d="M 132 214 l 14 -12 M 144 220 l 8 -7 M 216 214 l 14 -12 M 228 220 l 8 -7" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity="0.85"/>`;

const mortarboard = () => `
  ${p('M 146 84 L 148 108 Q 200 124 252 108 L 254 84 Z', '#232323', 3)}
  ${p('M 112 76 L 200 48 L 288 76 L 200 104 Z', '#1f1f1f', 3)}
  <path d="M 200 76 L 266 84 L 268 122" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>
  ${p('M 263 120 L 273 120 L 276 140 L 260 140 Z', GOLD, 2)}
  <circle cx="200" cy="76" r="5" fill="${GOLD}" stroke="${INK}" stroke-width="2"/>`;

const topHat = () => `<g transform="translate(200 100) rotate(-8) scale(1.25) translate(-200 -94)">
  ${p('M 140 94 C 140 82 260 82 260 94 C 260 105 140 105 140 94 Z', '#1f1f1f', 2.6)}
  ${p('M 166 94 L 170 54 C 184 49 216 49 230 54 L 234 94 C 216 100 184 100 166 94 Z', '#232323', 2.6)}
  <path class="anya-ribbon" d="M 167.4 80 C 184 85 216 85 232.6 80 L 233.7 91 C 216 97 184 97 166.3 91 Z" fill="#c9482a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  ${p('M 170 54 C 184 59 216 59 230 54', 'none', 1.8)}
  <path d="M 181 62 L 179 76" stroke="#555" stroke-width="2.6" stroke-linecap="round"/></g>`;

const crown = () => `
  ${p('M 140 98 L 130 56 L 162 80 L 182 46 L 200 76 L 218 46 L 238 80 L 270 56 L 260 98 C 230 106 170 106 140 98 Z', '#f2c94c', 3)}
  ${p('M 142 90 C 172 97 228 97 258 90', 'none', 2)}
  ${[130, 182, 218, 270].map((x) => `<circle cx="${x}" cy="${x === 130 || x === 270 ? 56 : 46}" r="5.5" fill="#f2c94c" stroke="${INK}" stroke-width="2.5"/>`).join('')}
  <circle cx="200" cy="94" r="6" fill="#c9482a" stroke="${INK}" stroke-width="2"/>
  <circle cx="168" cy="93" r="4.5" fill="#3a7bd5" stroke="${INK}" stroke-width="2"/>
  <circle cx="232" cy="93" r="4.5" fill="#3a7bd5" stroke="${INK}" stroke-width="2"/>
  <path d="M 150 66 l 4 12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`;

const star = (cx: number, cy: number, r: number) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    return `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  });
  return `<path d="M ${pts.join(' L ')} Z" fill="#d6332a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
};

const ushanka = () => `
  ${p('M 104 120 C 96 160 100 200 112 222 C 126 228 140 218 140 204 L 136 124 Z', '#7a6652', 3)}
  ${p('M 296 120 C 304 160 300 200 288 222 C 274 228 260 218 260 204 L 264 124 Z', '#7a6652', 3)}
  ${p('M 110 118 C 106 50 294 50 290 118 Z', '#5e4c3c', 3)}
  ${p('M 122 90 C 160 74 240 74 278 90 L 282 128 C 240 112 160 112 118 128 Z', '#8d7963', 3)}
  <path d="M 132 100 l 6 -4 M 160 92 l 5 -4 M 236 92 l 5 -4 M 264 100 l 6 -4 M 146 116 l 6 -4 M 250 116 l 6 -4" stroke="#5e4c3c" stroke-width="2" stroke-linecap="round"/>
  ${star(200, 102, 13)}`;

const santa = () => `
  ${p('M 116 104 C 120 58 168 40 212 44 C 254 48 290 76 306 116 C 292 106 276 98 262 96 C 272 100 280 104 284 108 Z', '#d63a2f', 3)}
  ${p('M 108 100 C 160 82 240 82 292 100 L 294 126 C 240 108 160 108 106 126 Z', '#fff', 3)}
  <circle cx="306" cy="120" r="14" fill="#fff" stroke="${INK}" stroke-width="3"/>
  <path d="M 150 62 C 170 52 190 48 206 49" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;

export const LOOKS: readonly Look[] = [
  // Bought with nothing: peanuts are a score, and these are its milestones.
  { id: 'glasses', slot: 'face', label: '👓 Reading glasses', unlock: { peanuts: 50 }, art: glasses, line: 'Glasses! Anya looks smart now. Smarter. Anya was already smart.' },
  { id: 'gold-eyes', slot: 'eyes', label: '🪙 Gold eyes', unlock: { peanuts: 150 }, line: 'Gold eyes. Sound money, sound vision. Anya can see inflation coming.' },
  { id: 'monocle', slot: 'face', label: '🧐 Monocle', unlock: { peanuts: 250 }, art: monocle, line: 'A monocle. Anya will now say “indubitably”. Indubitably.' },
  { id: 'top-hat', slot: 'head', label: '🎩 Top hat', unlock: { peanuts: 400 }, art: topHat, line: 'A top hat. Anya is a capitalist now. A small one. Very small.' },
  { id: 'gold-hair', slot: 'hair', label: '✨ Golden hair', unlock: { peanuts: 600 }, line: 'Golden hair! Backed by real gold. Unlike some currencies Anya could mention.' },
  { id: 'crown', slot: 'head', label: '👑 Sovereign crown', unlock: { peanuts: 1000 }, art: crown, line: 'A crown! Not a king. A sovereign individual. There’s a difference. Anya checked.' },
  // Earned another way
  { id: 'shades', slot: 'face', label: '🕶️ Shades', unlock: { achievement: 'streak-10', hint: 'Get ten right in a row' }, art: shades, line: 'Ten in a row. Anya is too cool to look at you now. Deal with it.' },
  { id: 'mortarboard', slot: 'head', label: '🎓 Graduation cap', unlock: { achievement: 'exam', hint: 'Pass a final exam' }, art: mortarboard, line: 'A graduation cap! Anya graduated too. By watching. It counts.' },
  { id: 'ancap-hair', slot: 'hair', label: '🏴 Black-and-gold hair', unlock: { achievement: 'exam-3', hint: 'Pass three final exams' }, line: 'Black and gold. Anya’s hair is a flag now. A very voluntary one.' },
  { id: 'santa', slot: 'head', label: '🎅 Santa hat', unlock: { achievement: 'festive', hint: 'Visit in December' }, art: santa, hidesClips: true, line: 'A Santa hat! Gifts are voluntary exchanges with a delayed return. Anya expects one.' },
  // Secrets
  { id: 'pink-hair', slot: 'hair', label: '🌸 Pink hair', unlock: { achievement: 'pink-hair', hint: 'A secret look', secret: true }, line: 'Anya’s hair… is pink?! Anya likes it.' },
  { id: 'green-eyes', slot: 'eyes', label: '💚 Green eyes', unlock: { achievement: 'green-eyes', hint: 'A secret look', secret: true }, line: 'Woah. Anya’s eyes are green now. Like money. Heh.' },
  { id: 'ushanka', slot: 'head', label: '☭ Ushanka', unlock: { achievement: 'red-pill', hint: 'A secret look', secret: true }, art: ushanka, hidesClips: true, line: 'An ushanka. For reading Marx in the cold. Anya will wear it ironically. Only ironically.' },
];

export const lookById = (id: string) => LOOKS.find((l) => l.id === id);

/** Whether a look is yours: enough peanuts earned, or the achievement it comes with. */
export function lookUnlocked(look: Look, earned: number, achievements: ReadonlySet<string>): boolean {
  return 'peanuts' in look.unlock ? earned >= look.unlock.peanuts : achievements.has(look.unlock.achievement);
}

/** What a locked look's button says: its price in peanuts, how to get it, or nothing at all if it's a secret. */
export function lockedLabel(look: Look, earned: number): string {
  if ('peanuts' in look.unlock) return `🔒 ${look.label.replace(/^\S+\s/, '')}: ${look.unlock.peanuts - earned} more 🥜`;
  return look.unlock.secret ? '🔒 A secret look' : `🔒 ${look.label.replace(/^\S+\s/, '')}: ${look.unlock.hint}`;
}

/** What she's wearing: a look id per slot ('' for none). */
export type Outfit = Record<Slot, string>;
export const emptyOutfit = (): Outfit => ({ hair: '', eyes: '', face: '', head: '' });

/** Reads a saved outfit, and saves from before the wardrobe (pink hair and green eyes switched on or off). */
export function outfitFrom(raw: unknown, legacy?: { pink?: unknown; green?: unknown }): Outfit {
  const o = emptyOutfit();
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (r) {
    for (const { slot } of SLOTS) {
      const look = typeof r[slot] === 'string' ? lookById(r[slot] as string) : undefined;
      if (look && look.slot === slot) o[slot] = look.id;
    }
    return o;
  }
  if (legacy?.pink === true) o.hair = 'pink-hair';
  if (legacy?.green === true) o.eyes = 'green-eyes';
  return o;
}

/** The looks worn now, among those you have. */
export const wornLooks = (outfit: Outfit, has: (look: Look) => boolean) =>
  SLOTS.map(({ slot }) => lookById(outfit[slot])).filter((l): l is Look => !!l && has(l));

/** The SVG for whatever she's wearing over her hair: glasses first, then the hat on top. */
export const wearMarkup = (looks: readonly Look[]) =>
  [...looks]
    .sort((a, b) => (a.slot === 'head' ? 1 : 0) - (b.slot === 'head' ? 1 : 0))
    .map((l) => l.art?.() ?? '')
    .join('');
