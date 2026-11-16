// Anya, hand-inked as an SVG in the meme's style: black ink on cream, a pale bob with
// black cat-ear clips, a black dress with a white collar, and the book held out on a plate.
// The face is a separate layer, so expressions swap without redrawing her.

export type Face = 'neutral' | 'talk' | 'shock' | 'smug' | 'happy' | 'deadpan' | 'pout' | 'blink';

const INK = '#1a1a1a';
const SKIN = '#fff8ef';
const HAIR = '#fffaf3';
const DRESS = '#1f1f1f';

/** The eye centres. */
const EYES = [
  { x: 158, y: 220, side: -1 },
  { x: 242, y: 220, side: 1 },
] as const;

const path = (d: string, fill = 'none', width = 3, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

/** One open eye: white, a big grey iris, highlights, and a heavy upper lash. `lid` lowers the upper lid (0 open, 1 shut). */
function eye(x: number, y: number, side: number, opts: { iris?: number; lid?: number; stars?: boolean } = {}): string {
  const { iris = 1, lid = 0, stars = false } = opts;
  const top = y - 33 + lid * 36;
  const clip = `eye-clip-${side < 0 ? 'l' : 'r'}`;
  const outer = x + side * 32;
  const inner = x - side * 28;
  const lash = `M ${inner} ${top + 12} Q ${x} ${top - 6} ${outer} ${top + 10}`;
  const highlights = stars
    ? `<path d="M ${x - 6} ${y - 18} l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 z" fill="#fff"/>
       <path d="M ${x + 8} ${y + 6} l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z" fill="#fff"/>`
    : `<ellipse cx="${x - 7}" cy="${y - 9}" rx="6.5" ry="7.5" fill="#fff"/><circle cx="${x + 8}" cy="${y + 11}" r="3.2" fill="#fff"/>`;
  return `
    <clipPath id="${clip}"><path d="M ${inner - 4} ${top + 12} Q ${x} ${top - 8} ${outer + 4} ${top + 10} L ${outer + 4} ${y + 40} L ${inner - 4} ${y + 40} Z"/></clipPath>
    <g clip-path="url(#${clip})">
      <ellipse cx="${x}" cy="${y}" rx="27" ry="32" fill="#fff"/>
      <ellipse cx="${x}" cy="${y + 3}" rx="${20 * iris}" ry="${26 * iris}" fill="url(#anya-iris)"/>
      <ellipse cx="${x}" cy="${y + 5}" rx="${9 * iris}" ry="${12 * iris}" fill="#262626"/>
      <path d="M ${x - 14 * iris} ${y - 4} Q ${x} ${y - 16 * iris} ${x + 14 * iris} ${y - 4}" fill="none" stroke="#111" stroke-width="2" opacity="0.5"/>
      ${highlights}
    </g>
    ${path(lash, 'none', 6)}
    ${path(`M ${outer - side * 2} ${top + 10} l ${side * 8} ${-5}`, 'none', 3)}
    ${path(`M ${x - 19} ${y + 31} Q ${x} ${y + 36} ${x + 19} ${y + 30}`, 'none', 1.8)}`;
}

function brows(kind: 'normal' | 'up' | 'angry' | 'flat'): string {
  return EYES.map(({ x, side }) => {
    const inner = x - side * 20;
    const outer = x + side * 22;
    const d =
      kind === 'angry'
        ? `M ${outer} 178 L ${inner} 190`
        : kind === 'up'
          ? `M ${outer} 184 Q ${x} 170 ${inner} 176`
          : kind === 'flat'
            ? `M ${outer} 184 L ${inner} 184`
            : `M ${outer} 184 Q ${x} 176 ${inner} 182`;
    return path(d, 'none', 2, 'opacity="0.85"');
  }).join('');
}

/** Manga blush: a few short diagonal strokes on each cheek. */
const blush = () =>
  [130, 250]
    .map((cx) => [0, 7, 14].map((dx) => path(`M ${cx + dx} 256 l 6 -8`, 'none', 1.8, 'opacity="0.7"')).join(''))
    .join('');

/** The face layer: brows, eyes, nose and mouth for an expression. */
export function faceMarkup(face: Face): string {
  const nose = path('M 199 251 Q 201 254 203 252', 'none', 2);
  const eyes = (opts: Parameters<typeof eye>[3] = {}) => EYES.map((e) => eye(e.x, e.y, e.side, opts)).join('');
  switch (face) {
    case 'shock':
      // The meme: wide eyes, a little white "o"
      return `${brows('up')}${eyes({ iris: 0.82 })}${nose}<ellipse cx="200" cy="274" rx="10" ry="13" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
    case 'smug':
      // Heh: half-lidded, a cat smile, a blush
      return `${brows('flat')}${eyes({ lid: 0.5 })}${nose}${path('M 184 268 Q 192 276 200 269 Q 208 276 216 268')}${blush()}`;
    case 'happy':
      // Waku waku: sparkly eyes, a big open smile
      return `${brows('up')}${eyes({ stars: true, iris: 1.05 })}${nose}${path('M 184 266 Q 200 292 216 266 Z', '#f1b6a8', 3)}${blush()}`;
    case 'deadpan':
      // Flat lids, dot pupils, a flat mouth
      return `${brows('flat')}${EYES.map(({ x, y }) => `${path(`M ${x - 24} ${y - 2} L ${x + 24} ${y - 2}`, 'none', 5)}<circle cx="${x}" cy="${y + 8}" r="4.5" fill="${INK}"/>`).join('')}${nose}${path('M 190 274 L 210 274')}`;
    case 'pout':
      return `${brows('angry')}${eyes({ lid: 0.25, iris: 0.95 })}${nose}${path('M 189 276 Q 194 269 200 275 Q 206 269 211 276')}${path('M 268 262 q 6 4 4 10', 'none', 2)}`;
    case 'blink':
      return `${brows('normal')}${EYES.map(({ x, y }) => path(`M ${x - 26} ${y + 2} Q ${x} ${y + 14} ${x + 26} ${y + 2}`, 'none', 5)).join('')}${nose}${path('M 193 272 Q 200 275 207 272')}`;
    case 'talk':
      return `${brows('normal')}${eyes()}${nose}<ellipse cx="200" cy="273" rx="7" ry="6" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`;
    default:
      return `${brows('normal')}${eyes()}${nose}${path('M 193 272 Q 200 275 207 272')}`;
  }
}

/** The book (the meme's cover: black over red), standing on the plate. */
export const bookMarkup = () => `
  <g id="anya-book">
    <path d="M 168 300 L 178 296 L 178 424 L 168 428 Z" fill="#f4efe6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#c9482a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 64 302 L 168 300 L 168 368 L 64 370 Z" fill="#141414"/>
    <text x="116" y="328" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" fill="#fff" letter-spacing="0.5">BASIC</text>
    <text x="116" y="348" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="14" fill="#fff" letter-spacing="0.3">ECONOMICS</text>
    <text x="116" y="382" text-anchor="middle" font-family="Georgia, serif" font-size="5.6" fill="#1a1a1a">A Common Sense Guide to the Economy</text>
    <text x="116" y="402" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="12" fill="#1a1a1a">Thomas Sowell</text>
  </g>`;

/** Focus lines (manga speed lines) radiating from behind her, for big reactions. */
function focusLines(): string {
  const lines: string[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + (i % 3) * 0.02;
    const r1 = 210 + (i % 5) * 18;
    const w = 1.2 + (i % 4) * 0.9;
    lines.push(`<line x1="${(200 + Math.cos(a) * r1).toFixed(1)}" y1="${(220 + Math.sin(a) * r1).toFixed(1)}" x2="${(200 + Math.cos(a) * 520).toFixed(1)}" y2="${(220 + Math.sin(a) * 520).toFixed(1)}" stroke="${INK}" stroke-width="${w}"/>`);
  }
  return `<g id="anya-focus" class="anya-focus">${lines.join('')}</g>`;
}

/** The whole of her (call once); the face goes in #anya-face. */
export function anyaSvg(): string {
  return `
  <defs>
    <radialGradient id="anya-iris" cx="50%" cy="65%" r="60%">
      <stop offset="0" stop-color="#9a9a9a"/>
      <stop offset="0.55" stop-color="#5c5c5c"/>
      <stop offset="1" stop-color="#2a2a2a"/>
    </radialGradient>
    <pattern id="anya-tone" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.1" fill="${INK}" opacity="0.35"/>
    </pattern>
  </defs>
  ${focusLines()}
  <!-- Hair, behind -->
  ${path('M 200 70 C 116 70 82 130 85 202 C 87 258 90 302 96 342 Q 118 330 138 346 Q 200 334 262 346 Q 282 330 304 342 C 310 302 313 258 315 202 C 318 130 284 70 200 70 Z', HAIR, 3.2)}
  ${path('M 108 250 C 110 290 112 320 120 338', 'none', 1.6)}
  ${path('M 292 250 C 290 290 288 320 280 338', 'none', 1.6)}
  <!-- Neck, dress and collar -->
  ${path('M 184 288 L 184 322 L 216 322 L 216 288', SKIN, 3)}
  ${path('M 104 500 C 106 430 116 372 146 344 C 168 326 232 326 254 344 C 284 372 294 430 296 500 Z', DRESS, 3)}
  ${path('M 196 344 L 196 500 M 204 344 L 204 500', 'none', 0)}
  <rect x="195" y="346" width="10" height="70" fill="#fff" stroke="${INK}" stroke-width="2"/>
  <circle cx="200" cy="360" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/>
  ${path('M 200 326 C 178 318 148 326 146 342 C 148 360 182 364 200 340 Z', '#fff', 3)}
  ${path('M 200 326 C 222 318 252 326 254 342 C 252 360 218 364 200 340 Z', '#fff', 3)}
  <!-- Face -->
  ${path('M 118 186 C 118 250 152 294 200 298 C 248 294 282 250 282 186 Z', SKIN, 3.2)}
  <!-- Ears peeking out under the hair -->
  <g id="anya-face">${faceMarkup('neutral')}</g>
  <!-- Bangs and side locks, in front of the face -->
  ${path('M 104 178 C 98 108 146 72 200 72 C 254 72 302 108 296 178 Q 288 160 282 174 Q 280 190 272 200 Q 268 172 258 162 Q 254 182 246 194 Q 240 166 232 154 Q 226 176 218 190 Q 212 162 204 150 Q 196 172 188 194 Q 180 164 170 156 Q 164 178 156 200 Q 150 170 142 162 Q 136 182 128 196 Q 124 172 116 168 Q 110 172 104 178 Z', HAIR, 3.2)}
  ${path('M 170 96 Q 160 120 156 150 M 230 96 Q 242 120 246 150 M 200 82 Q 198 110 202 140', 'none', 1.5)}
  ${path('M 116 168 C 104 220 108 272 122 306 C 128 280 128 240 134 200 Z', HAIR, 3)}
  ${path('M 284 168 C 296 220 292 272 278 306 C 272 280 272 240 266 200 Z', HAIR, 3)}
  <!-- The ahoge (that one strand) -->
  ${path('M 196 74 C 186 48 214 34 226 50 C 214 44 202 52 206 74', HAIR, 3)}
  <!-- Black cat-ear clips -->
  ${path('M 88 156 L 96 92 L 142 124 Z', DRESS, 3)}
  ${path('M 312 156 L 304 92 L 258 124 Z', DRESS, 3)}
  ${path('M 290 132 q 4 -6 8 0 q -4 8 -8 0', '#fff', 1.5)}
  <!-- Arms, the plate and the book -->
  <g id="anya-arms">
    ${path('M 150 350 C 124 370 96 400 74 438 L 104 452 C 120 420 140 396 162 380 Z', DRESS, 3)}
    ${path('M 250 350 C 262 380 262 412 248 446 L 216 444 C 228 412 232 388 232 370 Z', DRESS, 3)}
    ${path('M 70 434 L 106 454 L 100 466 L 64 446 Z', '#fff', 2.5)}
    ${path('M 214 440 L 250 444 L 250 458 L 214 454 Z', '#fff', 2.5)}
    ${path('M 70 434 L 106 454 L 100 466 L 64 446 Z', 'url(#anya-tone)', 0)}
    ${path('M 214 440 L 250 444 L 250 458 L 214 454 Z', 'url(#anya-tone)', 0)}
    <ellipse cx="140" cy="430" rx="112" ry="20" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="140" cy="428" rx="94" ry="13" fill="none" stroke="${INK}" stroke-width="1.5"/>
    ${path('M 58 438 C 46 446 50 462 66 462 C 80 462 92 452 96 444', SKIN, 3)}
    ${path('M 222 442 C 232 432 252 436 250 450 C 248 462 230 464 216 458', SKIN, 3)}
    ${bookMarkup()}
  </g>`;
}

/** The view box for each shot: her whole self with the book, or a head-and-shoulders close-up. */
export const SHOTS = {
  full: '20 30 360 470',
  close: '72 40 256 320',
} as const;
