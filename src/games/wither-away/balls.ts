// The polcompballs, drawn as SVG and then stamped into canvas sprites once (hundreds of them on
// screen would be too slow as live SVG). Thick black outline, white eyes, no pupils: the eyes do
// the acting (normal, angry, happy, hurt, scared).

import type { CharacterId, EnemyId } from './data.ts';

export type BallId = CharacterId | EnemyId;
export type Eyes = 'normal' | 'angry' | 'happy' | 'hurt' | 'scared';

const OUT = 'stroke="#000" stroke-width="3" stroke-linejoin="round"';
const EYE = `fill="#fff" ${OUT}`;

/** Diagonal two-tone (top-left / bottom-right), like the ancap flag. */
const diagonal = (a: string, b: string) => `<rect x="0" y="0" width="100" height="100" fill="${a}"/><polygon points="8,100 100,6 100,100" fill="${b}"/>`;

/** A fleur-de-lis, for the Keynesian (after the flag in his picture). */
const fleur = (cx: number, cy: number, s: number) => `<g transform="translate(${cx} ${cy}) scale(${s})" fill="#cfd3d6">
  <path d="M0 -10 C3.2 -6 3.2 -2 0 2.5 C-3.2 -2 -3.2 -6 0 -10 Z"/>
  <path d="M-1 1 C-6 -6 -11.5 -2 -8.5 2.5 C-6.5 4.5 -3.5 3.5 -2 1.5 Z"/>
  <path d="M1 1 C6 -6 11.5 -2 8.5 2.5 C6.5 4.5 3.5 3.5 2 1.5 Z"/>
  <rect x="-5.5" y="2.5" width="11" height="2.4" rx="0.6"/>
  <path d="M-1.6 4.9 L1.6 4.9 L0.9 10.5 L-0.9 10.5 Z"/>
</g>`;

/** The flag, emblem and extras for each ball (inside a 100 × 100 box, clipped to the circle). */
const PAINT: Record<BallId, string> = {
  ancap: diagonal('#ffe600', '#111'),
  minarchist: diagonal('#f2c552', '#4a86e8'),
  agorist: diagonal('#8c8c8c', '#141414'),
  austrian: `<rect width="100" height="100" fill="#ef2b2d"/><rect y="34" width="100" height="33" fill="#fff"/>`,
  // Red, a golden hammer and sickle (the sickle arcs round the right, the hammer's head at top left).
  communist: `<rect width="100" height="100" fill="#cc0000"/>
    <g fill="none" stroke="#ffcc00" stroke-linecap="round">
      <path d="M40 53 A20 20 0 1 1 43 85" stroke-width="6"/>
      <path d="M43 85 L35 93" stroke-width="7.5"/>
      <path d="M66 88 L40 62" stroke-width="5.5"/>
    </g>
    <rect x="28" y="55" width="23" height="9" rx="1.5" fill="#ffcc00" transform="rotate(-45 39.5 59.5)"/>`,
  // Social democracy: red, a white rose (one silhouette: outer petals curling up, a pointed bud, red folds).
  socialist: `<rect width="100" height="100" fill="#e30613"/>
    <path d="M36 57 Q35 80 50 83 Q65 80 64 57 Q60 51 56 55 Q53 47 50 44 Q47 47 44 55 Q40 51 36 57 Z" fill="#fff"/>
    <path d="M44 55 Q46 66 50 71 Q54 66 56 55 M39 63 Q43 74 50 76 Q57 74 61 63" fill="none" stroke="#e30613" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M46 86 L54 86 L50 93 Z" fill="#fff"/>`,
  // Keynesianism: blue, three diagonal stripes, a fleur-de-lis in two corners.
  keynesian: `<rect width="100" height="100" fill="#0f4fa1"/>
    <g stroke="#cfd3d6" stroke-width="3.5"><path d="M10 -6 L108 92"/><path d="M2 2 L100 100"/><path d="M-10 10 L88 108"/></g>
    ${fleur(76, 24, 1.15)}${fleur(24, 78, 1.15)}`,
  stimulus: `<rect width="100" height="100" fill="#3b78c9"/>
    <g stroke="#e3e6e8" stroke-width="5"><path d="M6 -4 L104 94"/><path d="M-6 8 L92 106"/></g>
    ${fleur(74, 26, 1.5)}`,
  // Black, the fasces: a bundle of golden rods bound in white cord, an axe head out of the side.
  fascist: `<rect width="100" height="100" fill="#151515"/>
    <path d="M60 52 Q76 50 76 62 Q76 72 61 70 Z" fill="#d6d6d6" stroke="#9e9e9e" stroke-width="1"/>
    <rect x="42" y="44" width="18" height="46" rx="3" fill="#c9a227"/>
    <g stroke="#8a6d10" stroke-width="1.6"><path d="M47 46 V88"/><path d="M51 46 V88"/><path d="M55 46 V88"/></g>
    <path d="M42 54 L60 64 M42 64 L60 74 M42 74 L60 84" stroke="#fafafa" stroke-width="2.6" stroke-linecap="round"/>`,
  // The taxman: a charcoal suit of a ball, a gold percent sign.
  taxman: `<rect width="100" height="100" fill="#2e3238"/>
    <rect x="0" y="66" width="100" height="40" fill="#23262b"/>
    <path d="M50 66 L44 100 M50 66 L56 100" stroke="#fafafa" stroke-width="3"/>
    <path d="M50 70 L46 78 L50 96 L54 78 Z" fill="#b71c1c"/>
    <g fill="none" stroke="#ffca28" stroke-width="3"><circle cx="72" cy="74" r="4"/><circle cx="84" cy="88" r="4"/><path d="M86 70 L70 92"/></g>`,
  // The Central Bank: dollar-bill green, engraved rings, and the eye in the pyramid.
  bank: `<rect width="100" height="100" fill="#0d4d2e"/>
    <g fill="none" stroke="#2f7d55" stroke-width="1.2"><circle cx="50" cy="56" r="40"/><circle cx="50" cy="56" r="34"/><circle cx="50" cy="56" r="28"/></g>
    <path d="M34 90 L50 62 L66 90 Z" fill="#b8a03a" stroke="#6e5f1c" stroke-width="1.5"/>
    <path d="M40 80 H60 M37 85 H63" stroke="#6e5f1c" stroke-width="1.2"/>
    <path d="M44 72 L50 62 L56 72 Z" fill="#fff59d"/>
    <ellipse cx="50" cy="69" rx="3.4" ry="2" fill="#fff"/><circle cx="50" cy="69" r="1.3" fill="#0d4d2e"/>
    <g stroke="#fff59d" stroke-width="1" opacity="0.8"><path d="M50 60 V54 M44 63 L40 59 M56 63 L60 59"/></g>`,
  // Technocracy: a yin-yang in white and red (the white curling round the bottom, the red over the top).
  technocrat: `<rect width="100" height="100" fill="#b71c1c"/>
    <path d="M50 8 A22 22 0 0 0 50 52 A22 22 0 0 1 50 96 A44 44 0 0 1 50 8 Z" fill="#dedede"/>
    <path d="M50 96 A44 44 0 0 1 8 60 Q30 92 50 96 Z" fill="#a8a8a8"/>
    <path d="M94 52 A44 44 0 0 1 60 95 Q86 80 94 52 Z" fill="#7f1414"/>
    <ellipse cx="66" cy="24" rx="12" ry="7" fill="#fff" opacity="0.18"/>`,
  // The NIMBY: a suburb of a ball. Clapboard siding, a lawn, and a little picket fence along the bottom.
  nimby: `<rect width="100" height="100" fill="#ecdfba"/>
    <g stroke="#c9b583" stroke-width="1.4">${[14, 23, 32, 59, 68].map((y) => `<path d="M0 ${y} H100"/>`).join('')}</g>
    <rect y="80" width="100" height="24" fill="#4caf50"/>
    <g fill="#fafafa" stroke="#555" stroke-width="1">
      <rect x="0" y="85" width="100" height="3"/>
      ${[4, 13, 22, 31, 40, 49, 58, 67, 76, 85, 94].map((x) => `<path d="M${x} 83 L${x + 3} 79 L${x + 6} 83 V96 H${x} Z"/>`).join('')}
    </g>`,
  // Marx: a red ball under all that hair (the hair and beard go on top, in extras).
  marx: `<rect width="100" height="100" fill="#c62828"/><ellipse cx="40" cy="20" rx="13" ry="6" fill="#fff" opacity="0.25"/>`,
  printer: '',
};

/** The beard, hair and moustache: grey clouds outlined once round the outside (draw them stroked, then again unstroked on top). */
const cloud = (circles: [number, number, number][], fill: string) =>
  `<g fill="${fill}" stroke="#000" stroke-width="5">${circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
  <g fill="${fill}">${circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
const BEARD: [number, number, number][] = [[50, 83, 13], [35, 80, 13], [65, 80, 13], [23, 71, 12], [77, 71, 12], [50, 73, 14], [36, 70, 10], [64, 70, 10]];
const HAIR_L: [number, number, number][] = [[13, 38, 9], [11, 52, 8], [16, 25, 8], [14, 62, 7]];
const HAIR_R: [number, number, number][] = HAIR_L.map(([x, y, r]) => [100 - x, y, r]);

/** The vault's money printer: not a ball, a machine, with bills coming out of the top. */
function printerSvg(kind: Eyes, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -12 100 112" width="${size}" height="${Math.round((size * 112) / 100)}">
  <g stroke="#000" stroke-width="3" stroke-linejoin="round">
    <rect x="30" y="2" width="22" height="30" fill="#7cb342" transform="rotate(-12 41 17)"/>
    <rect x="46" y="-2" width="22" height="34" fill="#9ccc65" transform="rotate(8 57 15)"/>
    <rect x="8" y="28" width="84" height="66" rx="7" fill="#607d8b"/>
    <rect x="16" y="24" width="68" height="8" rx="2" fill="#37474f"/>
    <rect x="18" y="42" width="64" height="38" rx="4" fill="#263238"/>
    <circle cx="80" cy="35" r="4" fill="#ff1744"/>
  </g>
  <text x="50" y="72" font-family="Anton, Impact, sans-serif" font-size="30" fill="#ffd54f" text-anchor="middle">$</text>
  <text x="50" y="91" font-family="Anton, Impact, sans-serif" font-size="9" fill="#cfd8dc" text-anchor="middle">BRRRRR</text>
  <text x="57" y="22" font-family="Anton, Impact, sans-serif" font-size="11" fill="#1b5e20" text-anchor="middle" transform="rotate(8 57 15)">$</text>
  ${kind === 'hurt' ? '<rect x="8" y="-2" width="84" height="96" rx="7" fill="#ff1744" opacity="0.35"/>' : ''}
</svg>`;
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
    case 'scared':
      // Wide eyes and a bead of sweat: low on health, or surrounded.
      return `<ellipse ${EYE} cx="${lx}" cy="${ly}" rx="9.5" ry="11.5"/><ellipse ${EYE} cx="${rx}" cy="${ry}" rx="9.5" ry="11.5"/>
        <path d="M86 26 Q80 36 84 40 Q90 40 88 32 Z" fill="#7fd3ff" stroke="#000" stroke-width="2"/>`;
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
    case 'fascist':
      // A black side cap with a red badge.
      return `<g ${OUT}><path d="M28 18 Q50 2 74 14 L72 22 Q50 16 30 24 Z" fill="#1d1d1d"/></g><path d="M47 12 l3 -4 3 4 -3 3 z" fill="#e53935" stroke="#ffca28" stroke-width="1"/>`;
    case 'taxman':
      // A green accountant's eyeshade.
      return `<g ${OUT}><path d="M18 30 Q50 10 82 30 L78 38 Q50 24 22 38 Z" fill="#2e7d32" fill-opacity="0.92"/></g><path d="M18 30 Q50 10 82 30" fill="none" stroke="#a5d6a7" stroke-width="1.5"/>`;
    case 'nimby':
      // A roof for a hat (with a chimney), and his sign: NO!
      return `<g ${OUT}><rect x="62" y="-6" width="9" height="16" fill="#8d6e63"/><path d="M14 18 L50 -8 L86 18 Z" fill="#b5523b"/></g>
        <path d="M24 12 L50 -3 L76 12" fill="none" stroke="#8e3a28" stroke-width="1.5"/>
        <path d="M90 52 V76" stroke="#6d4c41" stroke-width="4" stroke-linecap="round"/>
        <g ${OUT}><rect x="74" y="34" width="26" height="19" rx="2" fill="#fafafa"/></g>
        <text x="87" y="49" font-family="Anton, Impact, sans-serif" font-size="12" fill="#d50000" text-anchor="middle">NO!</text>`;
    case 'marx':
      // The hair either side, the great grey beard, and a dark moustache.
      return `${cloud(HAIR_L, '#bdbdbd')}${cloud(HAIR_R, '#bdbdbd')}${cloud(BEARD, '#9e9e9e')}
        <path d="M27 63 Q38 54 50 60 Q62 54 73 63 Q68 72 57 67 Q50 64 43 67 Q32 72 27 63 Z" fill="#424242" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'bank':
      // A top hat with a gold band, and a gold monocle on its chain.
      return `<g ${OUT}><rect x="30" y="-10" width="40" height="24" rx="2" fill="#141414"/><rect x="20" y="12" width="60" height="7" rx="3" fill="#141414"/></g>
        <rect x="30" y="6" width="40" height="5" fill="#d4af37"/>
        <circle cx="67" cy="44" r="12" fill="none" stroke="#d4af37" stroke-width="3"/><path d="M78 50 Q86 64 80 76" fill="none" stroke="#d4af37" stroke-width="1.6"/>`;
    default:
      return '';
  }
}

/** One ball as an SVG string (a 100 × 100 ball with room above for a hat). */
export function ballSvg(id: BallId, kind: Eyes = 'normal', size = 128): string {
  if (id === 'printer') return printerSvg(kind, size);
  const clip = `wa-${id}-${kind}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -12 100 112" width="${size}" height="${Math.round((size * 112) / 100)}">
  <defs><clipPath id="${clip}"><circle cx="50" cy="52" r="44"/></clipPath></defs>
  <g clip-path="url(#${clip})" transform="translate(0 2)"><g transform="translate(0 0)">${PAINT[id]}</g></g>
  <circle cx="50" cy="52" r="44" fill="none" stroke="#000" stroke-width="5"/>
  <g transform="translate(0 2)">${eyes(kind, id)}${extras(id)}</g>
</svg>`;
}

/** Each character's own resting face. */
export const RESTING: Partial<Record<BallId, Eyes>> = { minarchist: 'angry', agorist: 'happy', austrian: 'happy', communist: 'angry', socialist: 'happy', fascist: 'angry', taxman: 'angry', bank: 'angry', technocrat: 'happy', nimby: 'angry', marx: 'angry' };

export const ALL_BALLS: BallId[] = ['ancap', 'minarchist', 'agorist', 'austrian', 'communist', 'socialist', 'keynesian', 'stimulus', 'fascist', 'taxman', 'technocrat', 'nimby', 'bank', 'marx', 'printer'];

/** A canvas holding a ball, drawn once from its SVG. */
export type Sprite = HTMLCanvasElement;

export async function loadSprites(size = 128): Promise<Map<string, Sprite>> {
  const sprites = new Map<string, Sprite>();
  const jobs: Promise<void>[] = [];
  for (const id of ALL_BALLS) {
    for (const kind of ['normal', 'angry', 'happy', 'hurt', 'scared'] as Eyes[]) {
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
