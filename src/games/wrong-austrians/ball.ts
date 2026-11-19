// Countryballs, drawn as SVG: an ancap flag with the Austrian eagle for the Austrian School, red
// white red for the ones who are just from Austria, plain ancap for you. Thick black outline, white
// eyes, no pupils, and a hat if they're feeling fancy.

import type { Face, Hat } from './talk.ts';

export type Flag = 'ancap' | 'austria' | 'player';
export type Eyes = 'normal' | 'happy' | 'shocked' | 'shifty';

export interface BallLook {
  flag: Flag;
  hat?: Hat;
  face?: Face;
  eyes?: Eyes;
  /** Faces left instead of right. */
  flip?: boolean;
}

let uid = 0;

const EAGLE = `<g transform="translate(52 61) scale(0.7)" stroke="#5c5c5c" stroke-width="0.8" stroke-linejoin="round">
  <path fill="#a7a7a7" d="M0,-6 L-6,-14 L-7,-9 L-15,-13 L-11,-5 L-17,-4 L-10,1 L-14,5 L-6,4 L-3,12 L0,8 L3,12 L6,4 L14,5 L10,1 L17,-4 L11,-5 L15,-13 L7,-9 L6,-14 Z"/>
  <circle cx="-3" cy="-13" r="2.6" fill="#a7a7a7"/><circle cx="3" cy="-13" r="2.6" fill="#a7a7a7"/>
  <path fill="#ef2b2d" stroke="none" d="M-4,-4 h8 v6 q0,4 -4,5 q-4,-1 -4,-5 Z"/>
  <path fill="#fff" stroke="none" d="M-4,-1 h8 v2 h-8 Z"/>
</g>`;

function eyes(kind: Eyes): string {
  const stroke = 'stroke="#000" stroke-width="3" fill="#fff"';
  const L = [29, 62];
  const R = [75, 60];
  switch (kind) {
    case 'happy':
      // The meme's grin: a flat top and a round bottom on the near eye.
      return `<path ${stroke} d="M${L[0] - 9},${L[1] - 5} L${L[0] + 9},${L[1] - 7} Q${L[0] + 9},${L[1] + 9} ${L[0]},${L[1] + 8} Q${L[0] - 9},${L[1] + 7} ${L[0] - 9},${L[1] - 5} Z"/>
        <ellipse ${stroke} cx="${R[0]}" cy="${R[1]}" rx="7" ry="9.5"/>`;
    case 'shocked':
      return `<circle ${stroke} cx="${L[0]}" cy="${L[1]}" r="9"/><circle ${stroke} cx="${R[0]}" cy="${R[1]}" r="9"/>`;
    case 'shifty':
      return `<path ${stroke} d="M${L[0] - 8},${L[1]} Q${L[0]},${L[1] - 3} ${L[0] + 8},${L[1]} Q${L[0]},${L[1] + 8} ${L[0] - 8},${L[1]} Z"/>
        <path ${stroke} d="M${R[0] - 8},${R[1]} Q${R[0]},${R[1] - 3} ${R[0] + 8},${R[1]} Q${R[0]},${R[1] + 8} ${R[0] - 8},${R[1]} Z"/>`;
    default:
      return `<ellipse ${stroke} cx="${L[0]}" cy="${L[1]}" rx="6.5" ry="7.5"/><ellipse ${stroke} cx="${R[0]}" cy="${R[1]}" rx="6.5" ry="7.5"/>`;
  }
}

function face(kind: Face | undefined): string {
  switch (kind) {
    case 'monocle':
      return `<circle cx="75" cy="60" r="11" fill="none" stroke="#c9a227" stroke-width="2.5"/><path d="M85,64 Q90,76 82,90" fill="none" stroke="#c9a227" stroke-width="1.5"/>`;
    case 'glasses':
      return `<g fill="none" stroke="#000" stroke-width="2.5"><circle cx="29" cy="62" r="11"/><circle cx="75" cy="60" r="11"/><path d="M40,61 Q52,56 64,60"/></g>`;
    case 'moustache':
      return `<path fill="#000" d="M52,74 q-6,-5 -14,-2 q-6,3 -11,-1 q3,9 13,8 q8,-1 12,-5 q4,4 12,5 q10,1 13,-8 q-5,4 -11,1 q-8,-3 -14,2 Z"/>`;
    default:
      return '';
  }
}

function hat(kind: Hat | undefined): string {
  switch (kind) {
    case 'top':
      return `<g stroke="#000" stroke-width="2.5"><rect x="34" y="-4" width="32" height="26" rx="2" fill="#151515"/><rect x="34" y="14" width="32" height="5" fill="#b3261e"/><rect x="25" y="20" width="50" height="6" rx="3" fill="#151515"/></g>`;
    case 'bowler':
      return `<g stroke="#000" stroke-width="2.5"><path d="M34,22 Q34,4 50,4 Q66,4 66,22 Z" fill="#2a2a2a"/><ellipse cx="50" cy="23" rx="24" ry="4.5" fill="#2a2a2a"/></g>`;
    case 'tyrolean':
      return `<g stroke="#000" stroke-width="2.5"><path d="M36,22 L40,6 Q50,1 60,6 L64,22 Z" fill="#2e6b3a"/><ellipse cx="50" cy="23" rx="22" ry="4.5" fill="#2e6b3a"/><path d="M58,8 Q70,-6 66,-12" fill="none" stroke="#e8e2d0" stroke-width="3"/><rect x="38" y="16" width="24" height="3.5" fill="#8a5a2b" stroke="none"/></g>`;
    case 'beret':
      return `<g stroke="#000" stroke-width="2.5"><path d="M28,24 Q26,10 50,8 Q74,8 72,22 Q50,28 28,24 Z" fill="#7a1f2b"/><path d="M50,8 L52,2" fill="none"/></g>`;
    default:
      return '';
  }
}

/** The ball as an SVG string (100 × 110: room for a hat on top). */
export function ballSvg(look: BallLook): string {
  const id = `wa-clip-${++uid}`;
  let paint: string;
  if (look.flag === 'austria') {
    paint = `<rect x="0" y="0" width="100" height="110" fill="#ef2b2d"/><rect x="0" y="49" width="100" height="25" fill="#fff"/>`;
  } else {
    paint = `<rect x="0" y="0" width="100" height="110" fill="#ffe31a"/><polygon points="22,110 96,16 110,16 110,110" fill="#111"/>${look.flag === 'ancap' ? EAGLE : ''}`;
  }
  const flip = look.flip ? ' transform="translate(100 0) scale(-1 1)"' : '';
  return `<svg class="ball" xmlns="http://www.w3.org/2000/svg" viewBox="0 -14 100 124" width="200" height="248" aria-hidden="true">
  <defs><clipPath id="${id}"><circle cx="50" cy="62" r="40"/></clipPath></defs>
  <g${flip}>
    <g clip-path="url(#${id})">${paint}</g>
    <circle cx="50" cy="62" r="40" fill="none" stroke="#000" stroke-width="4"/>
    ${eyes(look.eyes ?? 'normal')}
    ${face(look.face)}
    ${hat(look.hat)}
  </g>
</svg>`;
}
