// The polcompballs, drawn as SVG and then stamped into canvas sprites once (hundreds of them on
// screen would be too slow as live SVG). Thick black outline, white eyes, no pupils: the eyes do
// the acting (normal, angry, happy, hurt).

import type { CharacterId, EnemyId } from './data.ts';

export type BallId = CharacterId | EnemyId;
export type Eyes = 'normal' | 'angry' | 'happy' | 'hurt';

const OUT = 'stroke="#000" stroke-width="3" stroke-linejoin="round"';
const EYE = `fill="#fff" ${OUT}`;

/** Diagonal two-tone (top-left / bottom-right), like the ancap flag. */
const diagonal = (a: string, b: string) => `<rect x="0" y="0" width="100" height="100" fill="${a}"/><polygon points="8,100 100,6 100,100" fill="${b}"/>`;

/** The flag, emblem and extras for each ball (inside a 100 × 100 box, clipped to the circle). */
const PAINT: Record<BallId, string> = {
  ancap: diagonal('#ffe600', '#111'),
  minarchist: diagonal('#f2c552', '#4a86e8'),
  agorist: diagonal('#8c8c8c', '#141414'),
  austrian: `<rect width="100" height="100" fill="#ef2b2d"/><rect y="34" width="100" height="33" fill="#fff"/>`,
  communist: `<rect width="100" height="100" fill="#d6261c"/>${star(30, 30, 11, '#ffd700')}`,
  socialist: `<rect width="100" height="100" fill="#e2373f"/><circle cx="68" cy="70" r="10" fill="#fff" opacity="0.9"/><path d="M68 62c-5 3-5 10 0 12 5-2 5-9 0-12z" fill="#c2185b"/><path d="M68 80v12" stroke="#2e7d32" stroke-width="3"/>`,
  keynesian: `<rect width="100" height="100" fill="#2f8f5b"/><text x="68" y="82" font-family="Arial Black, Arial, sans-serif" font-size="30" font-weight="900" fill="#e8f5e9" text-anchor="middle">$</text>`,
  stimulus: `<rect width="100" height="100" fill="#55b47e"/><text x="50" y="86" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900" fill="#e8f5e9" text-anchor="middle">$</text>`,
  bureaucrat: `<rect width="100" height="100" fill="#9aa0a6"/><polygon points="0,64 100,30 100,44 0,78" fill="#d32f2f"/><rect x="58" y="70" width="22" height="14" fill="none" stroke="#d32f2f" stroke-width="3" transform="rotate(-12 69 77)"/>`,
  taxman: `<rect width="100" height="100" fill="#1f3d2c"/><text x="50" y="88" font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="900" fill="#ffd54f" text-anchor="middle">TAX</text>`,
  bank: `<rect width="100" height="100" fill="#0e5c3a"/><circle cx="50" cy="74" r="15" fill="none" stroke="#c8e6c9" stroke-width="3"/><text x="50" y="82" font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="900" fill="#c8e6c9" text-anchor="middle">$</text>`,
};

function star(cx: number, cy: number, r: number, fill: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

/** Eye positions: most balls look the same way; the Austrian's sit on his top band. */
const EYE_AT: Partial<Record<BallId, [number, number, number, number]>> = { austrian: [34, 25, 66, 25] };

function eyes(kind: Eyes, id: BallId): string {
  const [lx, ly, rx, ry] = EYE_AT[id] ?? [33, 46, 67, 44];
  switch (kind) {
    case 'angry':
      // Brows slanting down to the middle (the minarchist's look, and every boss's).
      return `<path ${EYE} d="M${lx - 10},${ly - 6} L${lx + 9},${ly - 1} Q${lx + 8},${ly + 9} ${lx},${ly + 8} Q${lx - 10},${ly + 7} ${lx - 10},${ly - 6} Z"/>
        <path ${EYE} d="M${rx - 9},${ry - 1} L${rx + 10},${ry - 6} Q${rx + 10},${ry + 7} ${rx},${ry + 8} Q${rx - 8},${ry + 9} ${rx - 9},${ry - 1} Z"/>`;
    case 'happy':
      // Closed, smiling arcs (the agorist's look, and the Austrian's).
      return `<path ${EYE} d="M${lx - 10},${ly + 4} Q${lx},${ly - 8} ${lx + 10},${ly + 4} Q${lx},${ly - 1} ${lx - 10},${ly + 4} Z"/>
        <path ${EYE} d="M${rx - 10},${ry + 4} Q${rx},${ry - 8} ${rx + 10},${ry + 4} Q${rx},${ry - 1} ${rx - 10},${ry + 4} Z"/>`;
    case 'hurt':
      return `<path d="M${lx - 7},${ly - 6} L${lx + 7},${ly + 6} M${lx + 7},${ly - 6} L${lx - 7},${ly + 6} M${rx - 7},${ry - 6} L${rx + 7},${ry + 6} M${rx + 7},${ry - 6} L${rx - 7},${ry + 6}" stroke="#000" stroke-width="4" stroke-linecap="round"/>`;
    default:
      return `<ellipse ${EYE} cx="${lx}" cy="${ly}" rx="8" ry="9"/><ellipse ${EYE} cx="${rx}" cy="${ry}" rx="8" ry="9"/>`;
  }
}

/** Extras on top of the ball: the minarchist's cigarette, the Austrian's snake and "nein", hats. */
function extras(id: BallId): string {
  switch (id) {
    case 'minarchist':
      return `<g transform="rotate(-25 56 70)"><rect x="50" y="68" width="14" height="3.5" fill="#fafafa" stroke="#555" stroke-width="0.8"/><rect x="50" y="68" width="4" height="3.5" fill="#e07b39"/></g><path d="M50 64 q-3 -5 1 -9 q3 -4 0 -8" fill="none" stroke="#bbb" stroke-width="1.2"/>`;
    case 'austrian':
      // A coiled snake (after the Gadsden flag) on the white band, and his one word.
      return `<path d="M60 38 q10 2 8 9 q-2 6 -12 6 q-10 0 -12 7 q-1 7 9 8" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><circle cx="61" cy="38" r="2.6" fill="#111"/>
        <text x="52" y="86" font-family="'Comic Sans MS', 'Comic Neue', cursive, sans-serif" font-size="15" fill="#111" text-anchor="middle">nein</text>`;
    case 'keynesian':
      return `<g ${OUT}><rect x="34" y="-6" width="32" height="20" rx="2" fill="#151515"/><rect x="26" y="12" width="48" height="6" rx="3" fill="#151515"/></g>`;
    case 'bank':
      return `<g ${OUT}><rect x="30" y="-8" width="40" height="22" rx="2" fill="#1b1b1b"/><rect x="22" y="12" width="56" height="6" rx="3" fill="#1b1b1b"/><rect x="30" y="7" width="40" height="4" fill="#c9a227" stroke="none"/></g>`;
    case 'bureaucrat':
      return `<g ${OUT}><path d="M32 16 Q50 4 68 16 L66 20 L34 20 Z" fill="#37474f"/></g>`;
    default:
      return '';
  }
}

/** One ball as an SVG string (a 100 × 100 ball with room above for a hat). */
export function ballSvg(id: BallId, kind: Eyes = 'normal', size = 128): string {
  const clip = `wa-${id}-${kind}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -12 100 112" width="${size}" height="${Math.round((size * 112) / 100)}">
  <defs><clipPath id="${clip}"><circle cx="50" cy="52" r="44"/></clipPath></defs>
  <g clip-path="url(#${clip})" transform="translate(0 2)"><g transform="translate(0 0)">${PAINT[id]}</g></g>
  <circle cx="50" cy="52" r="44" fill="none" stroke="#000" stroke-width="5"/>
  <g transform="translate(0 2)">${eyes(kind, id)}${extras(id)}</g>
</svg>`;
}

/** Each character's own resting face. */
export const RESTING: Partial<Record<BallId, Eyes>> = { minarchist: 'angry', agorist: 'happy', austrian: 'happy', bank: 'angry', bureaucrat: 'angry', taxman: 'angry' };

export const ALL_BALLS: BallId[] = ['ancap', 'minarchist', 'agorist', 'austrian', 'communist', 'socialist', 'keynesian', 'stimulus', 'bureaucrat', 'taxman', 'bank'];

/** A canvas holding a ball, drawn once from its SVG. */
export type Sprite = HTMLCanvasElement;

export async function loadSprites(size = 128): Promise<Map<string, Sprite>> {
  const sprites = new Map<string, Sprite>();
  const jobs: Promise<void>[] = [];
  for (const id of ALL_BALLS) {
    for (const kind of ['normal', 'angry', 'happy', 'hurt'] as Eyes[]) {
      jobs.push(
        (async () => {
          const img = new Image();
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ballSvg(id, kind, size))}`;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = size;
          c.height = Math.round((size * 112) / 100);
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          sprites.set(`${id}:${kind}`, c);
        })(),
      );
    }
  }
  await Promise.all(jobs);
  return sprites;
}
