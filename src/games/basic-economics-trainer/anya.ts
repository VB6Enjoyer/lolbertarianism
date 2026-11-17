// Anya, hand-inked as an SVG in the meme's style: black ink on cream, the book held out on a plate.
// Version 2, drawn closer to the character: softer bangs in curved locks, hair that flicks out at the
// ends, rounded cat-ear clips with bands, and the ribbon at her collar (the colour of the book she’s holding).
// The face is a separate layer, so expressions swap without redrawing her. Hair and eyes carry
// classes so the unlockable looks (pink hair, green eyes) can recolor them from CSS. Invisible
// hit zones (nose, eyes, head) are on top, for the easter eggs. Version 1 is kept in anya-v1.ts.

export type Face = 'neutral' | 'talk' | 'shock' | 'smug' | 'happy' | 'deadpan' | 'pout' | 'blink';

const INK = '#1a1a1a';
const SKIN = '#fff8ef';
const HAIR = '#fffaf3';
const DRESS = '#1f1f1f';
const RIBBON = '#c9482a';

/** The eye centres. */
const EYES = [
  { x: 158, y: 220, side: -1 },
  { x: 242, y: 220, side: 1 },
] as const;

const path = (d: string, fill = 'none', width = 3, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const hair = (d: string, width = 3) => path(d, HAIR, width, 'class="anya-hair"');
/** A path with its own colors (path() fixes the stroke to ink). */
const paint = (d: string, attrs: string) => `<path d="${d}" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;

/** One open eye: white, a big iris, highlights, and a heavy upper lash. `lid` lowers the upper lid (0 open, 1 shut). */
function eye(x: number, y: number, side: number, opts: { iris?: number; lid?: number; stars?: boolean } = {}): string {
  const { iris = 1, lid = 0, stars = false } = opts;
  const top = y - 33 + lid * 36;
  const clip = `eye-clip-${side < 0 ? 'l' : 'r'}`;
  const outer = x + side * 32;
  const inner = x - side * 28;
  const lash = `M ${inner} ${top + 12} Q ${x} ${top - 7} ${outer} ${top + 10}`;
  const highlights = stars
    ? `<path d="M ${x - 6} ${y - 18} l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 z" fill="#fff"/>
       <path d="M ${x + 8} ${y + 6} l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z" fill="#fff"/>`
    : `<ellipse cx="${x - 7}" cy="${y - 10}" rx="7" ry="8" fill="#fff"/><circle cx="${x + 9}" cy="${y + 11}" r="3.4" fill="#fff"/><circle cx="${x - 9}" cy="${y + 12}" r="1.8" fill="#fff" opacity="0.8"/>`;
  return `
    <clipPath id="${clip}"><path d="M ${inner - 4} ${top + 12} Q ${x} ${top - 8} ${outer + 4} ${top + 10} L ${outer + 4} ${y + 40} L ${inner - 4} ${y + 40} Z"/></clipPath>
    <g clip-path="url(#${clip})">
      <ellipse cx="${x}" cy="${y}" rx="27" ry="32" fill="#fff"/>
      <ellipse class="anya-iris" cx="${x}" cy="${y + 3}" rx="${20 * iris}" ry="${26 * iris}" fill="url(#anya-iris)"/>
      <path class="anya-iris-top" d="M ${x - 20 * iris} ${y - 2} Q ${x} ${y - 30 * iris} ${x + 20 * iris} ${y - 2} Z" fill="#000" opacity="0.28"/>
      <ellipse cx="${x}" cy="${y + 5}" rx="${9 * iris}" ry="${12 * iris}" fill="#262626"/>
      ${highlights}
    </g>
    ${path(lash, 'none', 6.5)}
    ${path(`M ${outer - side * 2} ${top + 10} l ${side * 9} ${-6}`, 'none', 3)}
    ${path(`M ${outer - side * 6} ${top + 6} l ${side * 6} ${-9}`, 'none', 2.2)}
    ${path(`M ${x - 19} ${y + 31} Q ${x} ${y + 36} ${x + 19} ${y + 30}`, 'none', 1.8)}`;
}

function brows(kind: 'normal' | 'up' | 'angry' | 'flat'): string {
  return EYES.map(({ x, side }) => {
    const inner = x - side * 20;
    const outer = x + side * 22;
    const d =
      kind === 'angry'
        ? `M ${outer} 176 L ${inner} 190`
        : kind === 'up'
          ? `M ${outer} 184 Q ${x} 170 ${inner} 176`
          : kind === 'flat'
            ? `M ${outer} 184 L ${inner} 184`
            : `M ${outer} 184 Q ${x} 176 ${inner} 182`;
    return path(d, 'none', kind === 'angry' ? 3 : 2, 'opacity="0.85"');
  }).join('');
}

/** Manga blush: a few short diagonal strokes on each cheek. */
const blush = () =>
  [130, 250]
    .map((cx) => [0, 7, 14].map((dx) => path(`M ${cx + dx} 256 l 6 -8`, 'none', 1.8, 'opacity="0.7"')).join(''))
    .join('');

/**
 * What goes on top of her hair for an expression: the manga anger mark when she's cross, a sweat
 * drop when she's fed up.
 */
export function overMarkup(face: Face): string {
  if (face === 'pout') {
    // The cross-vein: four corner arcs
    return `<g transform="translate(262 116) scale(1.25)" fill="none" stroke="${RIBBON}" stroke-width="3.4" stroke-linecap="round">
      <path d="M -3 -12 Q -3 -3 -12 -3"/><path d="M 3 -12 Q 3 -3 12 -3"/><path d="M -3 12 Q -3 3 -12 3"/><path d="M 3 12 Q 3 3 12 3"/></g>`;
  }
  if (face === 'deadpan') return path('M 300 168 q 10 14 4 22 q -8 6 -12 -4 q 0 -8 8 -18 Z', '#dff1ff', 2.4);
  return '';
}

/** While she talks, her mouth opens and closes; her eyes and brows keep the expression. */
export type Mouth = 'closed' | 'open';

const NEUTRAL_MOUTH = path('M 193 272 Q 200 275 207 272');
const TALK_MOUTH = `<ellipse cx="200" cy="273" rx="7" ry="6" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`;
const HAPPY_MOUTH = `${path('M 182 265 Q 200 294 218 265 Z', '#f1a99a', 3)}${paint('M 190 279 Q 200 286 210 279 Q 200 283 190 279 Z', 'fill="#e07f72" stroke="none"')}`;
const SHOCK_MOUTH = `<ellipse cx="200" cy="274" rx="10" ry="13" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
const POUT_MOUTH = path('M 189 276 Q 194 269 200 275 Q 206 269 211 276');

/** An expression in pieces: the eyes and brows, its own mouth, and anything drawn over the mouth (blush, marks). */
function faceParts(face: Face): { upper: string; mouth: string; extra: string } {
  const eyes = (opts: Parameters<typeof eye>[3] = {}) => EYES.map((e) => eye(e.x, e.y, e.side, opts)).join('');
  switch (face) {
    case 'shock':
      // The meme: wide eyes, a little white "o"
      return { upper: `${brows('up')}${eyes({ iris: 0.82 })}`, mouth: SHOCK_MOUTH, extra: '' };
    case 'smug':
      // Heh: half-lidded, a cat smile, a blush
      return { upper: `${brows('flat')}${eyes({ lid: 0.5 })}`, mouth: path('M 184 268 Q 192 276 200 269 Q 208 276 216 268'), extra: blush() };
    case 'happy':
      // Waku waku: sparkly eyes, a big open smile
      return { upper: `${brows('up')}${eyes({ stars: true, iris: 1.05 })}`, mouth: HAPPY_MOUTH, extra: blush() };
    case 'deadpan':
      // Flat lids, dot pupils, a flat mouth
      return { upper: `${brows('flat')}${EYES.map(({ x, y }) => `${path(`M ${x - 24} ${y - 2} L ${x + 24} ${y - 2}`, 'none', 5)}<circle cx="${x}" cy="${y + 8}" r="4.5" fill="${INK}"/>`).join('')}`, mouth: path('M 190 274 L 210 274'), extra: '' };
    case 'pout':
      // Cross: angry brows, narrowed eyes, a wobbly pout, puffed cheek and an anger mark
      return { upper: `${brows('angry')}${eyes({ lid: 0.25, iris: 0.95 })}`, mouth: POUT_MOUTH, extra: path('M 268 262 q 6 4 4 10', 'none', 2) };
    case 'blink':
      return { upper: `${brows('normal')}${EYES.map(({ x, y }) => path(`M ${x - 26} ${y + 2} Q ${x} ${y + 14} ${x + 26} ${y + 2}`, 'none', 5)).join('')}`, mouth: NEUTRAL_MOUTH, extra: '' };
    case 'talk':
      return { upper: `${brows('normal')}${eyes()}`, mouth: TALK_MOUTH, extra: '' };
    default:
      return { upper: `${brows('normal')}${eyes()}`, mouth: NEUTRAL_MOUTH, extra: '' };
  }
}

/** The mouth while talking, closed or open, in a shape that suits the expression. */
function talkingMouth(face: Face, mouth: Mouth): string {
  if (mouth === 'open') {
    if (face === 'happy') return HAPPY_MOUTH;
    if (face === 'shock') return SHOCK_MOUTH;
    if (face === 'pout') return `<ellipse cx="200" cy="274" rx="6" ry="5" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`;
    return TALK_MOUTH;
  }
  if (face === 'happy') return path('M 187 269 Q 200 280 213 269');
  if (face === 'shock') return `<ellipse cx="200" cy="274" rx="6" ry="7" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`;
  if (face === 'pout') return POUT_MOUTH;
  if (face === 'deadpan') return path('M 192 274 L 208 274');
  if (face === 'smug') return path('M 191 271 Q 200 277 209 271');
  return NEUTRAL_MOUTH;
}

/** The face layer: brows, eyes, nose and mouth for an expression. With `mouth`, she's mid-sentence. */
export function faceMarkup(face: Face, mouth?: Mouth): string {
  const nose = path('M 199 251 Q 201 254 203 252', 'none', 2);
  const parts = faceParts(face);
  return `${parts.upper}${nose}${mouth ? talkingMouth(face, mouth) : parts.mouth}${parts.extra}`;
}

/** The block of pages: the fore-edge on the right and the top edge above the cover, each with faint
 *  page lines, so the book reads as solid rather than an open shell. */
const pageLines = [0.3, 0.55, 0.78]
  .map((t) => {
    const dx = (10 * t).toFixed(1);
    const dy = (4 * t).toFixed(1);
    return `<path d="M ${64 + 10 * t} ${302 - 4 * t} L ${168 + 10 * t} ${300 - 4 * t}" stroke="#cfc4b1" stroke-width="0.8"/><path d="M ${168 + +dx} ${300 - +dy} L ${168 + +dx} ${428 - +dy}" stroke="#cfc4b1" stroke-width="0.8"/>`;
  })
  .join('');
const PAGES = `<path d="M 168 300 L 178 296 L 178 424 L 168 428 Z" fill="#f4efe6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M 64 302 L 74 298 L 178 296 L 168 300 Z" fill="#f8f3ea" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    ${pageLines}`;
const SANS = `'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;

/** Each book's cover, drawn on the same face (64,300 to 168,430) so they can swap on the plate. */
const COVERS: Record<string, () => string> = {
  // Basic Economics: the meme's cover, black over red.
  be: () => `${PAGES}
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#c9482a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 64 302 L 168 300 L 168 368 L 64 370 Z" fill="#141414"/>
    <text x="116" y="328" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" fill="#fff" letter-spacing="0.5">BASIC</text>
    <text x="116" y="348" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="14" fill="#fff" letter-spacing="0.3">ECONOMICS</text>
    <text x="116" y="382" text-anchor="middle" font-family="Georgia, serif" font-size="5.6" fill="#1a1a1a">A Common Sense Guide to the Economy</text>
    <text x="116" y="402" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="12" fill="#1a1a1a">Thomas Sowell</text>`,
  // Human Action, the Scholar's Edition: white, a turquoise block of diagonal stripes, the title in black.
  ha: () => {
    const stripes: string[] = [];
    for (let i = 0; i < 14; i++) {
      const y = 404 + i * 7;
      stripes.push(`<path d="M 60 ${y} L 124 ${y - 64}" stroke="#7cc8e6" stroke-width="${(1 + (i % 3) * 0.7).toFixed(1)}" opacity="${(0.35 + (i % 4) * 0.12).toFixed(2)}"/>`);
    }
    return `${PAGES}
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <clipPath id="ha-block"><path d="M 64 322 L 116 321 L 116 405 L 64 406 Z"/></clipPath>
    <path d="M 64 322 L 116 321 L 116 405 L 64 406 Z" fill="#0280b2"/>
    <g clip-path="url(#ha-block)" fill="none">${stripes.join('')}</g>
    <path d="M 64 405 L 168 403 L 168 428 L 64 430 Z" fill="#0280b2" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <text x="91" y="315" text-anchor="middle" font-family="${SANS}" font-size="4" fill="#1a1a1a" textLength="46" lengthAdjust="spacingAndGlyphs">A TREATISE ON ECONOMICS</text>
    <text x="142" y="334" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="13" fill="#1a1a1a" textLength="46" lengthAdjust="spacingAndGlyphs">HUMAN</text>
    <text x="142" y="349" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="13" fill="#1a1a1a" textLength="46" lengthAdjust="spacingAndGlyphs">ACTION</text>
    <text x="142" y="368" text-anchor="middle" font-family="${SANS}" font-size="3.8" fill="#1a1a1a" textLength="42" lengthAdjust="spacingAndGlyphs">THE SCHOLAR’S EDITION</text>
    <text x="116" y="421" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="#fff" letter-spacing="0.2">Ludwig von Mises</text>`;
  },
  // Economics in One Lesson: white over black, the title in gold serif, “in” in a red circle,
  // and the author's name in a red box.
  eol: () => `${PAGES}
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#141414" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 64 302 L 168 300 L 168 352 L 64 353 Z" fill="#fff"/>
    <text x="116" y="313" text-anchor="middle" font-family="${SANS}" font-size="3.6" fill="#a5243a" textLength="56" lengthAdjust="spacingAndGlyphs">OVER ONE MILLION COPIES SOLD</text>
    <text x="116" y="340" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="16" fill="#b8983a" textLength="92" lengthAdjust="spacingAndGlyphs">ECONOMICS</text>
    <circle cx="116" cy="356" r="7" fill="#a5243a"/>
    <text x="116" y="358.5" text-anchor="middle" font-family="Georgia, serif" font-size="7" fill="#fff">in</text>
    <text x="116" y="383" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" fill="#b8983a" textLength="92" lengthAdjust="spacingAndGlyphs">ONE LESSON</text>
    <text x="116" y="396" text-anchor="middle" font-family="${SANS}" font-size="3.8" fill="#fff" textLength="70" lengthAdjust="spacingAndGlyphs">The Shortest &amp; Surest Way to Understand</text>
    <text x="116" y="405" text-anchor="middle" font-family="Georgia, serif" font-size="6" fill="#b8983a" textLength="64" lengthAdjust="spacingAndGlyphs">BASIC ECONOMICS</text>
    <rect x="84" y="411" width="64" height="11" fill="#a5243a"/>
    <text x="116" y="419" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="6.2" fill="#fff" letter-spacing="0.6">HENRY HAZLITT</text>`,
  // The Mystery of Banking, second edition: the title in black serif on white, an olive band with
  // the author's name, and a crystal ball holding a rolled $100 bill on a gold stand.
  tmb: () => `${PAGES}
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#f7f5ee" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <clipPath id="tmb-face"><path d="M 64 302 L 168 300 L 168 428 L 64 430 Z"/></clipPath>
    <g clip-path="url(#tmb-face)">
      <path d="M 64 360 L 168 358 L 168 428 L 64 430 Z" fill="#e9e6d8"/>
      <text x="152" y="311" text-anchor="end" font-family="Georgia, serif" font-style="italic" font-size="4.6" fill="#7d6a3a">2nd Edition</text>
      <text x="116" y="325" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="14" fill="#1a1a1a" textLength="84" lengthAdjust="spacingAndGlyphs">The Mystery</text>
      <text x="80" y="341" font-family="Georgia, serif" font-style="italic" font-size="9" fill="#1a1a1a">of</text>
      <text x="92" y="341" font-family="Georgia, 'Times New Roman', serif" font-size="13" fill="#1a1a1a" textLength="62" lengthAdjust="spacingAndGlyphs">BANKING</text>
      <path d="M 64 346 L 168 345 L 168 356 L 64 357 Z" fill="#a8ac69"/>
      <text x="116" y="353.6" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="5.6" fill="#2b2d14" letter-spacing="0.4">MURRAY N. ROTHBARD</text>
      <path d="M 96 416 L 136 416 L 140 432 L 92 432 Z" fill="#b59a4a"/>
      <ellipse cx="116" cy="416" rx="20" ry="4" fill="#d9c47a"/>
      <circle cx="116" cy="389" r="25" fill="#eef0ea" stroke="#9aa08e" stroke-width="1.2"/>
      <g transform="rotate(-24 116 391)">
        <rect x="99" y="377" width="34" height="26" rx="3" fill="#c9d2b4" stroke="#6f7a5a" stroke-width="0.9"/>
        <path d="M 99 384 Q 116 378 133 384" fill="none" stroke="#6f7a5a" stroke-width="0.7"/>
        <circle cx="116" cy="392" r="5.5" fill="#dfe5cf" stroke="#6f7a5a" stroke-width="0.7"/>
        <text x="103" y="400" font-family="Georgia, serif" font-weight="700" font-size="5.5" fill="#4f5a3a">100</text>
        <text x="129" y="383.5" text-anchor="end" font-family="Georgia, serif" font-weight="700" font-size="4.5" fill="#4f5a3a">100</text>
      </g>
      <ellipse cx="106" cy="378" rx="7" ry="4.5" fill="#fff" opacity="0.75" transform="rotate(-30 106 378)"/>
    </g>`,
  // Man, Economy, and State with Power and Market, the Scholar's Edition: cream serif title on
  // black, a copper rule, and wooden chess pieces on a board, the author's name along the bottom.
  mes: () => {
    const wood = (x: number, base: number, tall: number, king = false) => {
      const top = base - tall;
      const crown = king
        ? `<rect x="${x - 0.8}" y="${top - 7}" width="1.6" height="5" fill="#d9a46a"/><rect x="${x - 2.2}" y="${top - 5.6}" width="4.4" height="1.4" fill="#d9a46a"/>`
        : `<circle cx="${x}" cy="${top - 2.6}" r="3.3" fill="url(#mes-wood)"/>`;
      return `${crown}<path d="M ${x - 3.2} ${top} Q ${x} ${top - 1.6} ${x + 3.2} ${top} L ${x + 4.6} ${base - 2} L ${x - 4.6} ${base - 2} Z" fill="url(#mes-wood)"/>
      <rect x="${x - 5.6}" y="${base - 2.4}" width="11.2" height="2.4" rx="0.8" fill="#6e4423"/>`;
    };
    const squares: string[] = [];
    for (let i = 0; i < 9; i++) squares.push(`<rect x="${64 + i * 12}" y="403" width="12" height="9" fill="${i % 2 ? '#3b2616' : '#7a5232'}"/>`);
    return `${PAGES}
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#0d0b09" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <clipPath id="mes-face"><path d="M 64 302 L 168 300 L 168 428 L 64 430 Z"/></clipPath>
    <linearGradient id="mes-wood" x1="0" x2="1"><stop offset="0" stop-color="#5e3a1d"/><stop offset="0.45" stop-color="#c58a52"/><stop offset="1" stop-color="#6e4423"/></linearGradient>
    <g clip-path="url(#mes-face)">
      <text x="160" y="309" text-anchor="end" font-family="Georgia, serif" font-style="italic" font-size="4" fill="#c87a3c">2nd edition</text>
      <text x="70" y="320" font-family="Georgia, 'Times New Roman', serif" font-size="11" fill="#f1e6d2" textLength="90" lengthAdjust="spacingAndGlyphs">Man, Economy,</text>
      <text x="70" y="333" font-family="Georgia, serif" font-size="6" fill="#f1e6d2">and</text>
      <text x="82" y="333" font-family="Georgia, 'Times New Roman', serif" font-size="11" fill="#f1e6d2">State</text>
      <text x="70" y="343" font-family="Georgia, serif" font-size="5" fill="#f1e6d2">with</text>
      <text x="82" y="343" font-family="Georgia, 'Times New Roman', serif" font-size="7.5" fill="#f1e6d2" textLength="68" lengthAdjust="spacingAndGlyphs">Power and Market</text>
      <rect x="70" y="347" width="54" height="0.8" fill="#c87a3c"/>
      <text x="70" y="355" font-family="Georgia, serif" font-size="4.6" fill="#f1e6d2">Scholar’s Edition</text>
      ${squares.join('')}
      ${wood(150, 395, 26, true)}${wood(132, 398, 22, true)}${wood(84, 402, 14)}${wood(100, 404, 13)}${wood(118, 405, 12)}${wood(158, 406, 13)}
      <text x="116" y="423" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="9" fill="#f1e6d2" textLength="86" lengthAdjust="spacingAndGlyphs">Murray N. Rothbard</text>
    </g>`;
  },
  // Money, Bank Credit, and Economic Cycles: a burgundy cover shading from rose at the left to near-black,
  // the author in small caps at the top and the title in large cream serif below.
  jhs: () => `${PAGES}
    <linearGradient id="jhs-cover" x1="0" x2="1"><stop offset="0" stop-color="#9a5a5a"/><stop offset="0.35" stop-color="#5e2228"/><stop offset="1" stop-color="#2a0d10"/></linearGradient>
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="url(#jhs-cover)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <text x="76" y="318" font-family="Georgia, 'Times New Roman', serif" font-size="6" fill="#f1e2cf" letter-spacing="0.4" textLength="82" lengthAdjust="spacingAndGlyphs">JESÚS HUERTA DE SOTO</text>
    <text x="76" y="368" font-family="Georgia, 'Times New Roman', serif" font-size="10" fill="#f6ead8">Money,</text>
    <text x="76" y="380" font-family="Georgia, 'Times New Roman', serif" font-size="10" fill="#f6ead8" textLength="78" lengthAdjust="spacingAndGlyphs">Bank Credit, and</text>
    <text x="76" y="392" font-family="Georgia, 'Times New Roman', serif" font-size="10" fill="#f6ead8">Economic</text>
    <text x="76" y="404" font-family="Georgia, 'Times New Roman', serif" font-size="10" fill="#f6ead8">Cycles</text>
    <text x="76" y="420" font-family="Georgia, serif" font-size="3.6" fill="#e6cdb8" letter-spacing="0.3" textLength="64" lengthAdjust="spacingAndGlyphs">TRANSLATED BY MELINDA A. STROUP</text>`,
  // The Machinery of Freedom: a cream cover with the title in deep teal over a train of meshing gears,
  // brass and teal, and the author along the bottom.
  dmf: () => {
    const gear = (cx: number, cy: number, r: number, n: number, fill: string, turn = 0) => {
      const pts: string[] = [];
      const step = (Math.PI * 2) / n;
      for (let i = 0; i < n; i++) {
        const a = i * step + turn;
        for (const [f, rr] of [[0, 0.8], [0.12, 1], [0.42, 1], [0.54, 0.8]] as const) {
          pts.push(`${(cx + Math.cos(a + f * step) * r * rr).toFixed(1)},${(cy + Math.sin(a + f * step) * r * rr).toFixed(1)}`);
        }
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="${cx}" cy="${cy}" r="${(r * 0.55).toFixed(1)}" fill="none" stroke="#f3ead6" stroke-width="0.8" opacity="0.7"/>
        <circle cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(1)}" fill="#efe6d1" stroke="${INK}" stroke-width="1"/>`;
    };
    return `${PAGES}
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#efe6d1" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="70" y="307" width="92" height="0.9" fill="#1f4e5a"/>
    <text x="116" y="320" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="6" fill="#1f4e5a" letter-spacing="1">THE</text>
    <text x="116" y="335" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="13" font-weight="bold" fill="#1f4e5a" textLength="90" lengthAdjust="spacingAndGlyphs">MACHINERY</text>
    <text x="116" y="347" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="8" fill="#1f4e5a" letter-spacing="0.6" textLength="62" lengthAdjust="spacingAndGlyphs">OF FREEDOM</text>
    <text x="116" y="356" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="4.4" fill="#6b5a3a" textLength="72" lengthAdjust="spacingAndGlyphs">Guide to a Radical Capitalism</text>
    ${gear(96, 391, 19, 12, '#b8892e')}${gear(128, 382, 13, 9, '#2f6b73', 0.2)}${gear(144, 400, 9, 7, '#8a6420', 0.1)}
    <rect x="70" y="413" width="92" height="0.9" fill="#1f4e5a"/>
    <text x="116" y="423" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="6.5" fill="#1f4e5a" letter-spacing="0.5" textLength="76" lengthAdjust="spacingAndGlyphs">DAVID D. FRIEDMAN</text>`;
  },
  // Forty Centuries of Wage and Price Controls: a cream cover with the title in rust capitals at the
  // right, a sepia engraving of pyramids and labourers on a slope, and the authors on a black band.
  fc: () => {
    const SEPIA = '#7a6550';
    const hatch = Array.from({ length: 20 }, (_, i) => {
      const x = 68 + i * 4.6;
      const y = 372 + i * 1.3;
      return `<path d="M ${x.toFixed(1)} ${(y + 3).toFixed(1)} l 3 -2.2" stroke="${SEPIA}" stroke-width="0.6"/><path d="M ${(x + 1.5).toFixed(1)} ${(y + 9).toFixed(1)} l 3 -2.2" stroke="${SEPIA}" stroke-width="0.6"/>`;
    }).join('');
    const worker = (x: number, y: number, flip = 1) =>
      `<g stroke="${SEPIA}" stroke-width="1" fill="none" stroke-linecap="round"><circle cx="${x}" cy="${y}" r="1.6" fill="${SEPIA}"/><path d="M ${x} ${y + 1.6} L ${x - flip * 1.2} ${y + 7} M ${x - flip * 1.2} ${y + 7} L ${x - flip * 3} ${y + 11} M ${x - flip * 1.2} ${y + 7} L ${x + flip * 1.5} ${y + 11} M ${x - flip * 0.3} ${y + 3.5} L ${x + flip * 4} ${y + 1} M ${x + flip * 4} ${y + 1} L ${x + flip * 5.5} ${y + 5}"/></g>`;
    return `${PAGES}
    <path d="M 64 302 L 168 300 L 168 428 L 64 430 Z" fill="#f3eee3" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 68 371 L 79 352 L 90 369 Z M 84 369 L 93 356 L 102 368 Z" fill="#ebe3d3" stroke="${SEPIA}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M 79 352 L 82 370 M 93 356 L 95 368" stroke="${SEPIA}" stroke-width="0.5"/>
    <text font-family="Georgia, 'Times New Roman', serif" fill="#c0532f" text-anchor="end">
      <tspan x="162" y="316" font-size="9">FORTY</tspan>
      <tspan x="162" y="326" font-size="9">CENTURIES</tspan>
      <tspan x="162" y="335.5" font-size="8"><tspan font-style="italic">of</tspan> WAGE &amp; PRICE</tspan>
      <tspan x="162" y="345" font-size="9">CONTROLS</tspan>
      <tspan x="162" y="353" font-size="4.8" font-style="italic" textLength="58" lengthAdjust="spacingAndGlyphs">How Not to Fight Inflation</tspan>
    </text>
    <path d="M 66 372 Q 116 362 166 392 L 166 408 L 66 408 Z" fill="#e7dcc6"/>
    <path d="M 66 372 Q 116 362 166 392" fill="none" stroke="${SEPIA}" stroke-width="0.9"/>
    ${hatch}
    ${worker(108, 362)}${worker(122, 364, -1)}${worker(136, 368)}${worker(152, 376, -1)}
    <path d="M 64.5 408 L 167.5 408 L 167.5 427.5 L 64.5 429.5 Z" fill="#2b2724"/>
    <text x="70" y="416" font-family="Georgia, serif" font-size="5" fill="#f3eee3">Robert L. Schuettinger</text>
    <text x="70" y="424" font-family="Georgia, serif" font-size="5" fill="#f3eee3"><tspan font-style="italic">and</tspan> Eamonn F. Butler</text>`;
  },
};

/** A book's cover, for the plate (the inside of #anya-book). */
export const coverMarkup = (book: string) => (COVERS[book] ?? COVERS.be)();

/** The book standing on the plate. */
export const bookMarkup = (book = 'be') => `<g id="anya-book">${coverMarkup(book)}</g>`;

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

/** A cat-ear clip: a rounded black cone with a white band near the base. */
function clip(side: -1 | 1): string {
  const m = (x: number) => 200 + side * (x - 200);
  const cone = `M ${m(90)} 160 C ${m(84)} 130 ${m(90)} 104 ${m(104)} 86 C ${m(110)} 84 ${m(116)} 86 ${m(120)} 92 C ${m(130)} 104 ${m(140)} 116 ${m(148)} 128 Z`;
  const band = `M ${m(94)} 150 Q ${m(118)} 128 ${m(142)} 122`;
  return `${path(cone, DRESS, 3)}${path(band, 'none', 10)}${paint(band, 'fill="none" stroke="#fff" stroke-width="5"')}${paint(`M ${m(102)} 96 Q ${m(98)} 112 ${m(99)} 128`, 'fill="none" stroke="#666" stroke-width="2.5"')}`;
}

/** The whole of her (call once); the face goes in #anya-face. */
export function anyaSvg(): string {
  return `
  <defs>
    <radialGradient id="anya-iris" cx="50%" cy="68%" r="62%">
      <stop offset="0" stop-color="#a4a4a4"/>
      <stop offset="0.55" stop-color="#5e5e5e"/>
      <stop offset="1" stop-color="#262626"/>
    </radialGradient>
    <radialGradient id="anya-iris-green" cx="50%" cy="68%" r="62%">
      <stop offset="0" stop-color="#b9ecb0"/>
      <stop offset="0.5" stop-color="#4fa55f"/>
      <stop offset="1" stop-color="#1d5530"/>
    </radialGradient>
    <pattern id="anya-tone" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.1" fill="${INK}" opacity="0.35"/>
    </pattern>
  </defs>
  ${focusLines()}
  <!-- Hair, behind: a bob that flicks out at the ends -->
  ${hair('M 200 70 C 116 70 82 130 85 202 C 87 256 88 296 94 326 Q 86 340 70 348 Q 98 354 116 340 Q 126 346 140 344 Q 200 334 260 344 Q 274 346 284 340 Q 302 354 330 348 Q 314 340 306 326 C 312 296 313 256 315 202 C 318 130 284 70 200 70 Z', 3.2)}
  ${path('M 106 246 C 108 286 110 312 118 334', 'none', 1.6)}
  ${path('M 294 246 C 292 286 290 312 282 334', 'none', 1.6)}
  <!-- Neck, dress, collar and ribbon -->
  ${path('M 184 288 L 184 322 L 216 322 L 216 288', SKIN, 3)}
  ${path('M 104 500 C 106 430 116 372 146 344 C 168 326 232 326 254 344 C 284 372 294 430 296 500 Z', DRESS, 3)}
  <rect x="195" y="350" width="10" height="66" fill="#fff" stroke="${INK}" stroke-width="2"/>
  <circle cx="200" cy="380" r="4.5" fill="#fff" stroke="${INK}" stroke-width="2"/>
  ${path('M 200 326 C 178 318 148 326 146 342 C 148 360 182 364 200 340 Z', '#fff', 3)}
  ${path('M 200 326 C 222 318 252 326 254 342 C 252 360 218 364 200 340 Z', '#fff', 3)}
  ${path('M 200 344 L 182 334 L 184 356 Z', RIBBON, 2.5, 'class="anya-ribbon"')}
  ${path('M 200 344 L 218 334 L 216 356 Z', RIBBON, 2.5, 'class="anya-ribbon"')}
  ${path('M 196 344 L 190 368 L 200 362 L 210 368 L 204 344 Z', RIBBON, 2.5, 'class="anya-ribbon"')}
  <circle class="anya-ribbon" cx="200" cy="345" r="5" fill="${RIBBON}" stroke="${INK}" stroke-width="2.5"/>
  <!-- Face -->
  ${path('M 118 186 C 118 250 152 294 200 298 C 248 294 282 250 282 186 Z', SKIN, 3.2)}
  <g id="anya-face">${faceMarkup('neutral')}</g>
  <!-- Bangs, in curved locks, and side locks, in front of the face -->
  ${hair('M 104 182 C 96 108 146 70 200 70 C 254 70 304 108 296 182 Q 292 192 282 200 Q 278 184 266 168 Q 264 186 250 198 Q 248 176 236 160 Q 230 180 216 194 Q 214 170 204 152 Q 196 172 184 196 Q 174 178 166 160 Q 158 182 148 200 Q 140 184 134 168 Q 124 186 118 200 Q 108 194 104 182 Z', 3.2)}
  ${path('M 168 92 Q 156 120 158 154 M 232 92 Q 246 120 244 154 M 200 80 Q 196 112 204 146 M 136 120 Q 128 140 132 164 M 264 120 Q 272 140 268 164', 'none', 1.5)}
  ${hair('M 116 172 C 100 228 102 288 114 324 Q 118 332 126 330 C 122 292 124 240 136 196 Z')}
  ${hair('M 284 172 C 300 228 298 288 286 324 Q 282 332 274 330 C 278 292 276 240 264 196 Z')}
  ${path('M 116 230 C 112 262 114 292 120 314', 'none', 1.4)}
  ${path('M 284 230 C 288 262 286 292 280 314', 'none', 1.4)}
  <!-- The ahoge (that one strand) -->
  ${hair('M 196 74 C 184 46 216 30 230 48 C 216 42 202 52 207 74')}
  <!-- Cat-ear clips -->
  ${clip(-1)}${clip(1)}
  <g id="anya-over"></g>
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
  </g>
  <!-- Where she can be touched (invisible): head pats, eye pokes, nose boops -->
  <g id="anya-hits">
    <ellipse class="anya-hit" data-part="head" cx="200" cy="112" rx="92" ry="44" fill="transparent"/>
    <ellipse class="anya-hit" data-part="eye" cx="158" cy="222" rx="30" ry="30" fill="transparent"/>
    <ellipse class="anya-hit" data-part="eye" cx="242" cy="222" rx="30" ry="30" fill="transparent"/>
    <circle class="anya-hit" data-part="nose" cx="201" cy="252" r="13" fill="transparent"/>
  </g>`;
}

/** The view box for each shot: her whole self with the book, or a head-and-shoulders close-up. */
export const SHOTS = {
  full: '20 30 360 470',
  close: '72 40 256 320',
} as const;
