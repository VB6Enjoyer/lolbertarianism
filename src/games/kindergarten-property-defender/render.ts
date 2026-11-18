// Draws the classroom as a doodle: notebook paper, wobbly stick figures, the
// teacher on the left, Jack behind his ancap desk on the right, the block pile
// in the middle, and long stretchy arms reaching in for it.

import { holdTime, handPosition, ITEMS, needsFor, pileAt, slapRadius, type GameState, type Hand } from './logic.ts';
import { isBoss, disguised, NEEDS, periodAt, roleInfo, type Role } from './school.ts';
import { classmateById, isFriend } from './classmates.ts';
import { tollText } from './capital.ts';

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
  big?: boolean;
}

export interface Bubble {
  who: 'teacher' | 'jack' | 'kid';
  text: string;
  until: number;
  /** Where a classmate's bubble goes (their hand). */
  x?: number;
  y?: number;
}

export interface Scene {
  time: number;
  floaters: Floater[];
  bubbles: Bubble[];
  /** Seconds of screen shake left. */
  shake: number;
  /** Jack's arm, mid-slap. */
  slapAt: { x: number; y: number; t: number } | null;
  /** The hired kid's arm, mid-slap. */
  guardAt: { x: number; y: number; t: number } | null;
  /** Where the pointer is (a flashlight at nap time). */
  pointer: { x: number; y: number } | null;
  /** When the picture-day camera last flashed. */
  flash: number;
  /** Jack's face for a moment (upset when blocks go, happy after a trade); on a streak he's smug anyway. */
  mood: { kind: 'upset' | 'happy'; until: number } | null;
  /** Slaps landing (a burst) and missing (a puff of dust), and when each hand was last hit. */
  hits: { x: number; y: number; t: number; big: boolean; miss: boolean }[];
  struck: Record<number, number>;
  /** The guided first morning points at this hand. */
  pointAt: number | null;
  /** A big announcement across the top (a new period, a new troublemaker). */
  banner: { text: string; sub?: string; until: number } | null;
  /** Playing on a touch screen (double-tap instead of right-click). */
  touch: boolean;
  /** Orange and blue instead of red and green, with a ✊/✋ on every sleeve. */
  colorblind: boolean;
}

/** In colour-blind mode: thieves warm (orange and brown), traders blue. */
const CB_LOOK: Partial<Record<Role, string>> = { grabby: '#e8710a', group: '#e8710a', monitor: '#b35806', mitten: '#7f3b08', sticky: '#c79a3b', fraud: '#1f77b4', lunch: '#1f77b4', pet: '#d95f02' };
/** Substitute day: the sub mixed up the sleeves (red for green, orange for blue). */
const SUB_SWAP: Record<string, string> = { '#d64545': '#2f9e57', '#c0392b': '#27ae60', '#2f9e57': '#d64545', '#e8710a': '#1f77b4', '#1f77b4': '#e8710a' };
const CB_THIEF = '#e8710a';
const CB_TRADER = '#1f77b4';

/** Each troublemaker's sleeve, and what it carries. */
const BOSS_LABELS: Partial<Record<Role, string>> = { principal: 'THE PRINCIPAL', superintendent: 'THE SUPERINTENDENT', board: 'SCHOOL BOARD', doe: 'DEPT. OF EDUCATION' };

const ROLE_LOOK: Record<Role, { color: string; badge?: string; scale?: number }> = {
  grabby: { color: '#d64545' },
  monitor: { color: '#e67e22', badge: '🦺' },
  group: { color: '#c0392b', badge: '📎' },
  president: { color: '#8e44ad', badge: '🗳️' },
  fraud: { color: '#2f9e57' },
  lunch: { color: '#2f9e57' },
  pet: { color: '#e84393', badge: '🍎' },
  principal: { color: '#34495e', badge: '👔', scale: 1.8 },
  mitten: { color: '#1f618d' },
  superintendent: { color: '#2c3e50', badge: '🏛️', scale: 1.9 },
  board: { color: '#5d6d7e', badge: '📋', scale: 1.4 },
  doe: { color: '#1b2631', badge: '🦅', scale: 2 },
  sticky: { color: '#b9770e', badge: '🍯' },
};

const FONT = "'Patrick Hand', 'Comic Sans MS', 'Chalkboard SE', cursive";
const INK = '#1b1b1b';
const SKIN = '#ffe2c4';
const THIEF = '#d64545';
const TRADER = '#2f9e57';
const LETTERS = 'PROPERTYRIGHTSAREHUMANRIGHTSMINEMINEMINE';
const LETTER_COLORS = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98'];

/** A wobble that changes eight times a second: the "boiling line" look of hand-drawn animation. */
function jitter(time: number, i: number): number {
  const n = Math.sin((Math.floor(time * 8) * 131.7 + i * 977.3) * 12.9898) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function wobblyPath(ctx: CanvasRenderingContext2D, pts: [number, number][], amp: number, time: number, seed: number) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + jitter(time, seed + i * 2) * amp;
    const jy = y + jitter(time, seed + i * 2 + 1) * amp;
    if (i === 0) ctx.moveTo(jx, jy);
    else ctx.lineTo(jx, jy);
  });
}

function stroke(ctx: CanvasRenderingContext2D, pts: [number, number][], width: number, time: number, seed: number, color = INK, amp = 1.2) {
  wobblyPath(ctx, pts, amp, time, seed);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function circlePts(cx: number, cy: number, r: number, n = 14): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function wobblyCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, width: number, time: number, seed: number, fill?: string) {
  wobblyPath(ctx, circlePts(cx, cy, r), Math.max(0.8, r * 0.04), time, seed);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Layout unit: everything scales with the screen. */
const unitOf = (s: GameState) => Math.min(s.w * 0.12, s.h * 0.09);

export function teacherHead(s: GameState) {
  const u = unitOf(s);
  return { x: s.w * 0.11, y: s.h - u * 5.3, r: u * 0.85 };
}

export function jackHead(s: GameState) {
  const u = unitOf(s);
  return { x: s.w * 0.86, y: s.h - u * 3.3, r: u * 1.0 };
}

function drawPaper(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = '#fdfcf6';
  ctx.fillRect(0, 0, s.w, s.h);
  const gap = Math.max(22, s.h / 24);
  ctx.strokeStyle = '#cfe0f2';
  ctx.lineWidth = 1;
  for (let y = gap * 2; y < s.h; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s.w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f0a9a9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.min(60, s.w * 0.07), 0);
  ctx.lineTo(Math.min(60, s.w * 0.07), s.h);
  ctx.stroke();
}

function drawTeacher(ctx: CanvasRenderingContext2D, s: GameState, t: number, angry: boolean) {
  const u = unitOf(s);
  const h = teacherHead(s);
  const w = Math.max(2, u * 0.07);
  wobblyCircle(ctx, h.x, h.y, h.r, w, t, 10, '#fff');
  // Long hair, the way the meme draws it
  stroke(ctx, [[h.x - h.r * 0.9, h.y - h.r * 0.2], [h.x - h.r * 1.3, h.y + h.r * 1.2], [h.x - h.r * 1.1, h.y + h.r * 2.3]], w, t, 20);
  stroke(ctx, [[h.x + h.r * 0.9, h.y - h.r * 0.2], [h.x + h.r * 1.3, h.y + h.r * 1.2], [h.x + h.r * 1.1, h.y + h.r * 2.3]], w, t, 30);
  stroke(ctx, [[h.x - h.r, h.y - h.r * 0.3], [h.x - h.r * 0.2, h.y - h.r * 1.1], [h.x + h.r, h.y - h.r * 0.4]], w, t, 40);
  // Eyes and a disappointed mouth (an open "o" when she's scolding)
  ctx.fillStyle = INK;
  for (const dx of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.arc(h.x + h.r * dx, h.y - h.r * 0.05, Math.max(1.5, w * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  if (angry) wobblyCircle(ctx, h.x, h.y + h.r * 0.45, h.r * 0.22, w, t, 50);
  else stroke(ctx, [[h.x - h.r * 0.35, h.y + h.r * 0.5], [h.x, h.y + h.r * 0.38], [h.x + h.r * 0.35, h.y + h.r * 0.5]], w, t, 60);
  // Body and arms
  const neck = h.y + h.r;
  stroke(ctx, [[h.x, neck], [h.x, s.h + 10]], w, t, 70);
  stroke(ctx, [[h.x, neck + u * 0.9], [h.x - u * 0.8, neck + u * 2.2]], w, t, 80);
  stroke(ctx, [[h.x, neck + u * 0.9], [h.x + u * 0.9, neck + u * 1.9], [h.x + u * 1.4, neck + u * 1.7]], w, t, 90, s.special === 'substitute' ? TRADER : THIEF, 1.5);
  if (s.special === 'substitute') {
    for (const dx of [-0.35, 0.35]) wobblyCircle(ctx, h.x + h.r * dx, h.y - h.r * 0.05, h.r * 0.24, w * 0.8, t, 95 + dx);
    stroke(ctx, [[h.x - h.r * 0.11, h.y - h.r * 0.05], [h.x + h.r * 0.11, h.y - h.r * 0.05]], w * 0.8, t, 97);
    drawTag(ctx, h.x + h.r * 0.4, h.y + h.r * 2.1, 'HELLO, I’M THE SUB', Math.max(10, u * 0.22), t, 98, '#7d3c98');
  }
}

function drawJack(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const t = scene.time;
  const u = unitOf(s);
  const h = jackHead(s);
  const w = Math.max(2.2, u * 0.085);
  const shoulder = { x: h.x - h.r * 0.2, y: h.y + h.r + u * 0.9 };
  // Body behind the desk
  stroke(ctx, [[h.x, h.y + h.r], [h.x, s.h]], w, t, 100);
  // Mid-slap: his arm shoots out to wherever you tapped.
  const slap = scene.slapAt;
  const slapping = slap && t - slap.t < 0.16;
  if (slapping) {
    stroke(ctx, [[shoulder.x, shoulder.y], [(shoulder.x + slap.x) / 2, (shoulder.y + slap.y) / 2 - u * 0.4], [slap.x, slap.y]], w, t, 110);
    wobblyCircle(ctx, slap.x, slap.y, u * 0.32, w, t, 115, SKIN);
  } else {
    stroke(ctx, [[shoulder.x, shoulder.y], [shoulder.x - u * 0.7, shoulder.y + u * 1.1]], w, t, 120);
  }
  wobblyCircle(ctx, h.x, h.y, h.r, w, t, 130, '#fff');
  drawJackFace(ctx, s, scene, h, w);
  // The desk: the ancap flag, as in the meme (yellow, with black across the lower right)
  const top = s.h - u * 1.9;
  const left = s.w * 0.7;
  ctx.fillStyle = '#f7e43a';
  ctx.fillRect(left, top, s.w - left, s.h - top);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(left, s.h);
  ctx.lineTo(s.w, top);
  ctx.lineTo(s.w, s.h);
  ctx.closePath();
  ctx.fill();
  stroke(ctx, [[left, s.h], [left, top], [s.w, top]], w, t, 170);
}

/**
 * Jack's face: angry by default (the meme), smug on a streak (shades from 15 in a row), upset when
 * blocks are taken, pleased after a trade.
 */
function drawJackFace(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene, h: { x: number; y: number; r: number }, w: number) {
  const t = scene.time;
  const mood = scene.mood && scene.mood.until > t ? scene.mood.kind : s.combo >= 5 && s.phase === 'playing' ? 'smug' : 'angry';
  const eye = (dx: number, dy = -0.02) => {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(h.x + h.r * dx, h.y + h.r * dy, Math.max(2, w), 0, Math.PI * 2);
    ctx.fill();
  };
  if (mood === 'upset') {
    // Worried brows, wide eyes, an open mouth, and a tear
    stroke(ctx, [[h.x - h.r * 0.6, h.y - h.r * 0.2], [h.x - h.r * 0.15, h.y - h.r * 0.45]], w, t, 140);
    stroke(ctx, [[h.x + h.r * 0.6, h.y - h.r * 0.2], [h.x + h.r * 0.15, h.y - h.r * 0.45]], w, t, 150);
    wobblyCircle(ctx, h.x - h.r * 0.3, h.y, h.r * 0.13, w * 0.8, t, 141, '#fff');
    wobblyCircle(ctx, h.x + h.r * 0.3, h.y, h.r * 0.13, w * 0.8, t, 151, '#fff');
    eye(-0.3, 0.02);
    eye(0.3, 0.02);
    wobblyCircle(ctx, h.x, h.y + h.r * 0.5, h.r * 0.18, w, t, 160, '#7b241c');
    ctx.fillStyle = '#5dade2';
    const drop = (t * 1.5) % 1;
    ctx.beginPath();
    ctx.ellipse(h.x + h.r * 0.42, h.y + h.r * (0.2 + drop * 0.5), h.r * 0.07, h.r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (mood === 'happy') {
    eye(-0.3);
    eye(0.3);
    stroke(ctx, [[h.x - h.r * 0.38, h.y + h.r * 0.38], [h.x, h.y + h.r * 0.62], [h.x + h.r * 0.38, h.y + h.r * 0.38]], w, t, 160);
    return;
  }
  if (mood === 'smug') {
    // One brow up, a smirk, and shades on a long streak
    stroke(ctx, [[h.x - h.r * 0.6, h.y - h.r * 0.38], [h.x - h.r * 0.12, h.y - h.r * 0.3]], w, t, 140);
    stroke(ctx, [[h.x + h.r * 0.6, h.y - h.r * 0.6], [h.x + h.r * 0.12, h.y - h.r * 0.42]], w, t, 150);
    if (s.combo >= 15) {
      ctx.fillStyle = INK;
      ctx.fillRect(h.x - h.r * 0.62, h.y - h.r * 0.16, h.r * 0.52, h.r * 0.28);
      ctx.fillRect(h.x + h.r * 0.1, h.y - h.r * 0.16, h.r * 0.52, h.r * 0.28);
      ctx.fillRect(h.x - h.r * 0.12, h.y - h.r * 0.12, h.r * 0.24, h.r * 0.06);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(h.x - h.r * 0.55, h.y - h.r * 0.12, h.r * 0.12, h.r * 0.07);
    } else {
      eye(-0.3);
      eye(0.3);
    }
    stroke(ctx, [[h.x - h.r * 0.3, h.y + h.r * 0.5], [h.x + h.r * 0.1, h.y + h.r * 0.5], [h.x + h.r * 0.38, h.y + h.r * 0.36]], w, t, 160);
    return;
  }
  // Angry eyebrows, beady eyes, a frown
  stroke(ctx, [[h.x - h.r * 0.6, h.y - h.r * 0.45], [h.x - h.r * 0.12, h.y - h.r * 0.15]], w, t, 140);
  stroke(ctx, [[h.x + h.r * 0.6, h.y - h.r * 0.45], [h.x + h.r * 0.12, h.y - h.r * 0.15]], w, t, 150);
  eye(-0.3);
  eye(0.3);
  stroke(ctx, [[h.x - h.r * 0.32, h.y + h.r * 0.55], [h.x, h.y + h.r * 0.38], [h.x + h.r * 0.32, h.y + h.r * 0.55]], w, t, 160);
}

/** A slap landing: a jagged burst with speed lines. A miss: a little puff of dust. */
function drawHits(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const u = unitOf(s);
  for (const hit of scene.hits) {
    const age = scene.time - hit.t;
    const life = hit.miss ? 0.3 : 0.28;
    if (age < 0 || age > life) continue;
    const k = age / life;
    if (hit.miss) {
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.fillStyle = '#bbb';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(hit.x + Math.cos(a) * u * 0.4 * (0.4 + k), hit.y + Math.sin(a) * u * 0.25 * (0.4 + k), u * 0.12 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      continue;
    }
    const r = u * (hit.big ? 0.95 : 0.7) * (0.6 + k * 0.6);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2 + hit.t * 7;
      const rr = i % 2 ? r * 0.5 : r;
      pts.push([hit.x + Math.cos(a) * rr, hit.y + Math.sin(a) * rr]);
    }
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = hit.big ? '#f5b041' : '#fff3a0';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Speed lines
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      ctx.beginPath();
      ctx.moveTo(hit.x + Math.cos(a) * r * 1.15, hit.y + Math.sin(a) * r * 1.15);
      ctx.lineTo(hit.x + Math.cos(a) * r * (1.5 + k * 0.6), hit.y + Math.sin(a) * r * (1.5 + k * 0.6));
      ctx.stroke();
    }
    if (hit.big && k < 0.6) {
      ctx.font = `bold ${Math.round(u * 0.42)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = INK;
      ctx.fillText('POW!', hit.x, hit.y);
    }
    ctx.globalAlpha = 1;
  }
}

/** The guided first morning: a bouncing arrow over the hand it's talking about. */
function drawPointer(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const hand = s.hands.find((h) => h.id === scene.pointAt);
  if (!hand || hand.slapped || hand.traded) return;
  const at = handPosition(hand);
  const u = unitOf(s);
  const bob = Math.sin(scene.time * 6) * u * 0.18;
  const y = at.y - u * 1.9 + bob;
  ctx.beginPath();
  ctx.moveTo(at.x, y + u * 0.75);
  ctx.lineTo(at.x - u * 0.45, y + u * 0.15);
  ctx.lineTo(at.x - u * 0.18, y + u * 0.15);
  ctx.lineTo(at.x - u * 0.18, y - u * 0.5);
  ctx.lineTo(at.x + u * 0.18, y - u * 0.5);
  ctx.lineTo(at.x + u * 0.18, y + u * 0.15);
  ctx.lineTo(at.x + u * 0.45, y + u * 0.15);
  ctx.closePath();
  ctx.fillStyle = '#f5b041';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  // A ring around it
  ctx.beginPath();
  ctx.arc(at.x, at.y, u * (0.9 + 0.12 * Math.sin(scene.time * 6)), 0, Math.PI * 2);
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f39c12';
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawClassmates(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const u = unitOf(s);
  const r = u * 0.55;
  [0.3, 0.55, 0.78].forEach((fx, i) => {
    const x = s.w * fx;
    const y = -r * 0.25 + Math.sin(t * 1.5 + i) * r * 0.08;
    wobblyCircle(ctx, x, y, r, Math.max(1.6, u * 0.05), t, 200 + i * 10, '#fff');
    ctx.fillStyle = INK;
    for (const dx of [-0.32, 0.32]) {
      ctx.beginPath();
      ctx.arc(x + r * dx, y + r * 0.35, Math.max(1.4, u * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, i: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(jitter(t * 0.25, i + 500) * 0.04);
  ctx.fillStyle = '#e8cf9c';
  ctx.strokeStyle = '#8a6a3c';
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.fillStyle = LETTER_COLORS[i % LETTER_COLORS.length];
  ctx.font = `bold ${Math.round(size * 0.62)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(LETTERS[i % LETTERS.length], 0, size * 0.04);
  ctx.restore();
}

/** Block size for the pile. */
export const blockSize = (s: GameState) => Math.max(18, unitOf(s) * 0.55);

/** A wooden sign on a post, with a line or two of text. */
function drawSign(ctx: CanvasRenderingContext2D, x: number, ground: number, size: number, lines: string[], color: string, t: number, seed: number) {
  const w = size * 3.6;
  const h = size * (0.7 + lines.length * 0.62);
  const top = ground - size * 3.4;
  stroke(ctx, [[x, ground], [x, top + h]], Math.max(3, size * 0.16), t, seed, '#8a6a3c');
  wobblyPath(ctx, [[x - w / 2, top], [x + w / 2, top], [x + w / 2, top + h], [x - w / 2, top + h], [x - w / 2, top]], 1, t, seed + 5);
  ctx.fillStyle = '#f3e2bd';
  ctx.fill();
  ctx.strokeStyle = '#8a6a3c';
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size * 0.5)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, x, top + size * (0.62 + i * 0.62)));
}

function emoji(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** What Jack has built: around the pile, and on his desk. */
function drawBuildings(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const t = scene.time;
  const b = s.built;
  const pile = pileAt(s);
  const size = blockSize(s);
  const ground = pile.y + size * 1.9;
  const u = unitOf(s);
  if (b.glue) {
    // A glue moat around the pile
    ctx.beginPath();
    ctx.ellipse(pile.x, ground - size * 0.2, size * (3.6 + b.glue * 0.6), size * (0.55 + b.glue * 0.12), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(236, 226, 150, 0.6)';
    ctx.fill();
    ctx.strokeStyle = '#c9b458';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Signs beside the pile; on a tall screen, just below it (beside it they'd cover the teacher and Jack).
  const tall = s.h > s.w * 1.25;
  const signGround = tall ? ground + size * 3.8 : ground;
  const signOff = tall ? size * 2.3 : size * 5.5;
  if (b.sign) drawSign(ctx, pile.x - signOff, signGround, size, b.sign > 1 ? ['KEEP OUT!!', 'NO REALLY'] : ['NO', 'TRESPASSING'], b.sign > 1 ? '#c0392b' : INK, t, 700);
  if (b.toll) drawSign(ctx, pile.x + signOff, signGround, size, ['🌉 TOLL', `${tollText(b.toll)} a trade`], '#1e8449', t, 720);
  if (b.guard) {
    // The hired kid, in shades
    const gx = pile.x - size * 3.3;
    const head = { x: gx, y: ground - size * 3.1, r: size * 0.7 };
    const w = Math.max(2, size * 0.1);
    stroke(ctx, [[gx, head.y + head.r], [gx, ground - size * 1.1]], w, t, 740);
    stroke(ctx, [[gx, ground - size * 1.1], [gx - size * 0.5, ground]], w, t, 742);
    stroke(ctx, [[gx, ground - size * 1.1], [gx + size * 0.5, ground]], w, t, 744);
    const g = scene.guardAt;
    if (g && t - g.t < 0.2) {
      stroke(ctx, [[gx, head.y + head.r * 1.6], [g.x, g.y]], w, t, 746);
      wobblyCircle(ctx, g.x, g.y, size * 0.4, w, t, 747, SKIN);
    } else {
      stroke(ctx, [[gx, head.y + head.r * 1.6], [gx + size * 0.7, head.y + head.r * 2.4]], w, t, 748);
      stroke(ctx, [[gx, head.y + head.r * 1.6], [gx - size * 0.7, head.y + head.r * 2.4]], w, t, 749);
    }
    wobblyCircle(ctx, head.x, head.y, head.r, w, t, 750, '#fff');
    emoji(ctx, '🕶️', head.x, head.y - head.r * 0.05, head.r * 1.2);
    if (b.guard > 1) emoji(ctx, '🦺', gx, head.y + head.r * 2.1, size * 0.9);
  }
  if (b.lemonade) {
    // A lemonade stand between the teacher and the pile
    const lx = Math.max(teacherHead(s).x + u * 2.2, Math.min(s.w * 0.3, pile.x - size * 9.4));
    const w = size * 3.2;
    const h = size * 1.8;
    const top = s.h - h;
    wobblyPath(ctx, [[lx - w / 2, top], [lx + w / 2, top], [lx + w / 2, s.h], [lx - w / 2, s.h], [lx - w / 2, top]], 1, t, 760);
    ctx.fillStyle = '#fff8c4';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `bold ${Math.round(size * 0.45)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LEMONADE', lx, top + size * 0.45);
    emoji(ctx, '🍋'.repeat(b.lemonade), lx, top + size * 1.15, size * 0.6);
  }
}

/** Things on Jack's desk: the piggy bank and the flag. */
function drawDeskItems(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const b = s.built;
  const u = unitOf(s);
  const size = blockSize(s);
  const deskTop = s.h - u * 1.9;
  if (b.piggy) emoji(ctx, '🐷', s.w * 0.77, deskTop + size * 0.9, size * (1 + b.piggy * 0.25));
  if (b.flag) {
    // A Gadsden flag on a pole at the left end of the desk, flying away from Jack (bigger with each level).
    // On a tall screen there's no room for a pole: it's a sticker on the desk instead.
    const tall = s.h > s.w * 1.25;
    const fw = u * (0.9 + b.flag * 0.25);
    const fh = fw * 0.65;
    const px = tall ? s.w - u * 0.25 : s.w * 0.7 + 3;
    const top = tall ? s.h - fh - u * 0.25 : deskTop - u * (1.6 + b.flag * 0.5);
    if (!tall) stroke(ctx, [[px, deskTop], [px, top]], Math.max(2.5, u * 0.07), t, 780);
    wobblyPath(ctx, [[px, top], [px - fw, top + fh * 0.1], [px - fw, top + fh], [px, top + fh * 0.9], [px, top]], 1, t, 785);
    ctx.fillStyle = '#f7e43a';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    emoji(ctx, '🐍', px - fw / 2, top + fh / 2, fh * 0.6);
  }
}

/** A crayon fence in front of the pile: one stroke for each grab it'll still stop. */
function drawFence(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const pile = pileAt(s);
  const size = blockSize(s);
  const colors = ['#e74c3c', '#3498db', '#27ae60'];
  for (let k = 0; k < Math.min(3, s.fence); k++) {
    const pts: [number, number][] = [];
    const rx = size * (4.4 + k * 0.5);
    const ry = size * (2.6 + k * 0.35);
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI + (i / 18) * Math.PI;
      const zig = i % 2 ? size * 0.25 : -size * 0.25;
      pts.push([pile.x + Math.cos(a) * rx, pile.y + size * 1.4 + Math.sin(a) * ry + zig]);
    }
    stroke(ctx, pts, Math.max(3, size * 0.14), t, 600 + k * 40, colors[k], 1.5);
  }
}

function drawPile(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const pile = pileAt(s);
  const size = blockSize(s);
  // A pyramid: rows get shorter going up.
  let row = 0;
  let placed = 0;
  let perRow = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(s.blocks * 2))));
  const baseY = pile.y + size * 1.4;
  if (s.special === 'field-trip') {
    // The school bus: the pile rides on the roof.
    const half = (perRow + 1.5) * size * 0.55;
    const top = baseY + size * 0.5;
    const bottom = top + size * 1.6;
    wobblyPath(ctx, [[pile.x - half, top], [pile.x + half, top], [pile.x + half + size * 0.4, top + size * 0.6], [pile.x + half + size * 0.4, bottom], [pile.x - half, bottom], [pile.x - half, top]], 1, t, 501);
    ctx.fillStyle = '#f4c430';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const wx = pile.x - half + size * 0.35 + i * ((half * 2 - size * 0.7) / 3.5);
      ctx.fillStyle = '#d6eaf8';
      ctx.fillRect(wx, top + size * 0.2, size * 0.6, size * 0.45);
      ctx.strokeRect(wx, top + size * 0.2, size * 0.6, size * 0.45);
    }
    for (const fx of [-0.6, 0.6]) wobblyCircle(ctx, pile.x + half * fx, bottom, size * 0.38, ctx.lineWidth, t, 510 + fx * 4, '#2c2c2c');
  }
  while (placed < s.blocks) {
    const count = Math.min(perRow, s.blocks - placed);
    const y = baseY - row * size * 0.98;
    for (let i = 0; i < count; i++) drawBlock(ctx, pile.x + (i - (count - 1) / 2) * size * 1.02, y, size, placed + i, t);
    placed += count;
    perRow = Math.max(1, perRow - 1);
    row++;
  }
}

function drawHand(ctx: CanvasRenderingContext2D, s: GameState, hand: Hand, scene: Scene) {
  const t = scene.time;
  const u = unitOf(s);
  const at = handPosition(hand);
  // The fraud kid and the Free Lunch kid are drawn exactly like traders: only the tag gives them away.
  const thief = hand.kind === 'thief' && !disguised(hand.role);
  const look = hand.role ? ROLE_LOOK[hand.role] : null;
  const base = scene.colorblind ? (hand.role ? (CB_LOOK[hand.role] ?? look!.color) : thief ? CB_THIEF : CB_TRADER) : look ? look.color : thief ? THIEF : TRADER;
  const color = s.special === 'substitute' ? (SUB_SWAP[base] ?? base) : base;
  // The arm: a long wobbly sleeve from off the edge, outlined in ink like a crayon drawing.
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const f = i / 6;
    const sag = Math.sin(f * Math.PI) * u * 0.25 * Math.sin(hand.phase);
    pts.push([hand.rootX + (at.x - hand.rootX) * f + sag, hand.rootY + (at.y - hand.rootY) * f + sag]);
  }
  const armW = Math.max(5, u * 0.17) * (look?.scale ?? 1);
  ctx.globalAlpha = hand.slapped ? 0.75 : 1;
  stroke(ctx, pts, armW + 4, t, hand.id * 31, INK, 1.4);
  stroke(ctx, pts, armW, t, hand.id * 31, color, 1.4);
  // Colour-blind mode: a fist or an open hand on the sleeve, so the colour isn't the only clue.
  if (scene.colorblind && !hand.slapped) {
    const mid = pts[2];
    const badge = Math.max(9, u * 0.22);
    ctx.beginPath();
    ctx.arc(mid[0], mid[1], badge, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    emoji(ctx, hand.kind === 'trader' || disguised(hand.role) ? '✋' : '✊', mid[0], mid[1] + 1, badge * 1.25);
  }
  const struck = t - (scene.struck[hand.id] ?? -9);
  const r = Math.max(13, u * 0.42) * (look?.scale ?? 1) * (struck < 0.12 ? 1.3 - struck * 2.5 : 1);
  const w = Math.max(1.8, u * 0.065);
  // Tough ones show how many slaps they've got left.
  if (hand.hp > 1 && !hand.slapped) {
    const pip = Math.max(5, u * 0.12);
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < hand.hp; i++) {
      ctx.beginPath();
      ctx.arc(at.x + (i - (hand.hp - 1) / 2) * pip * 2.4, at.y - r * 1.9, pip, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (look?.badge && thief) emoji(ctx, look.badge, at.x + r * 1.1, at.y - r * 1.1, r * 1.1);
  if (isBoss(hand.role) && !hand.slapped) {
    ctx.font = `bold ${Math.round(Math.max(12, u * 0.3))}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(BOSS_LABELS[hand.role!] ?? '', at.x, at.y - r * 2.6);
  }
  // For their first couple of days, the special ones say how to beat them.
  // The Department of Education always shows what it needs right now (it keeps changing).
  const needs = hand.role === 'doe' ? (needsFor(hand) === 'pinch' ? 'pinch' : undefined) : hand.role ? NEEDS[hand.role] : undefined;
  if (needs && !hand.slapped && (hand.role === 'doe' || s.wave <= roleInfo(hand.role!).from + 1)) {
    ctx.font = `bold ${Math.round(Math.max(11, u * 0.26))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    const label = needs === 'pinch' ? (scene.touch ? 'DOUBLE-TAP' : 'RIGHT-CLICK') : 'HOLD';
    ctx.strokeText(label, at.x, at.y - r * 2.1);
    ctx.fillStyle = color;
    ctx.fillText(label, at.x, at.y - r * 2.1);
  }
  if (hand.role === 'mitten' || (hand.role === 'doe' && needsFor(hand) === 'pinch')) {
    // A big oven mitt: slaps bounce off it.
    const dir = Math.atan2(at.y - hand.rootY, at.x - hand.rootX);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(dir + Math.PI / 2);
    wobblyPath(ctx, [[-r * 0.9, r * 0.9], [-r * 1.0, -r * 0.6], [-r * 0.5, -r * 1.5], [r * 0.3, -r * 1.5], [r * 0.8, -r * 0.7], [r * 0.9, r * 0.9], [-r * 0.9, r * 0.9]], 1.2, t, hand.id * 17);
    const mitt = scene.colorblind ? '#f5b041' : '#5dade2';
    ctx.fillStyle = mitt;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = w;
    ctx.stroke();
    // The thumb, and the cuff
    wobblyCircle(ctx, -r * 1.15, -r * 0.1, r * 0.42, w, t, hand.id * 19, mitt);
    stroke(ctx, [[-r * 0.9, r * 0.55], [r * 0.9, r * 0.55]], w * 2.2, t, hand.id * 23, '#fdfefe', 0.8);
    ctx.restore();
    for (let k = 0; k < hand.carrying; k++) drawBlock(ctx, at.x + (k - (hand.carrying - 1) / 2) * r * 0.9, at.y, r * 0.85, hand.id + k, t);
  } else if (hand.role === 'sticky') {
    // Sticky fingers: spread wide, dripping honey.
    const dir = Math.atan2(at.y - hand.rootY, at.x - hand.rootX);
    for (let f = -2; f <= 2; f++) {
      const a = dir + f * 0.42;
      const tip: [number, number] = [at.x + Math.cos(a) * r * 1.6, at.y + Math.sin(a) * r * 1.6];
      stroke(ctx, [[at.x + Math.cos(a) * r * 0.6, at.y + Math.sin(a) * r * 0.6], tip], w * 1.6, t, hand.id * 7 + f * 3);
      ctx.fillStyle = '#e5a50a';
      ctx.beginPath();
      ctx.ellipse(tip[0], tip[1] + r * 0.25, r * 0.16, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    wobblyCircle(ctx, at.x, at.y, r, w, t, hand.id * 13, '#f8d26a');
    for (let k = 0; k < hand.carrying; k++) drawBlock(ctx, at.x + (k - (hand.carrying - 1) / 2) * r * 0.9, at.y, r * 0.85, hand.id + k, t);
    // How far you've pried it off
    if (hand.held > 0 && !hand.slapped) {
      ctx.beginPath();
      ctx.arc(at.x, at.y, r * 1.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, hand.held / holdTime(s)));
      ctx.strokeStyle = '#1e8449';
      ctx.lineWidth = Math.max(4, u * 0.12);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  } else if (thief) {
    // A grabby claw: fingers opening and closing.
    const grab = (Math.sin(t * 11 + hand.id) + 1) / 2;
    const dir = Math.atan2(at.y - hand.rootY, at.x - hand.rootX);
    for (let f = -1.5; f <= 1.5; f++) {
      const a = dir + f * 0.45;
      const reach = r * (1.25 + grab * 0.45);
      const bend = dir + f * 0.45 + (grab - 0.5) * 1.2 * Math.sign(f || 1);
      stroke(ctx, [[at.x + Math.cos(a) * r * 0.6, at.y + Math.sin(a) * r * 0.6], [at.x + Math.cos(a) * reach, at.y + Math.sin(a) * reach], [at.x + Math.cos(bend) * reach * 1.05 + Math.cos(dir) * r * 0.2, at.y + Math.sin(bend) * reach * 1.05 + Math.sin(dir) * r * 0.2]], w * 1.4, t, hand.id * 7 + f * 3);
    }
    wobblyCircle(ctx, at.x, at.y, r, w, t, hand.id * 13, struck < 0.1 ? '#fff' : SKIN);
    // The Teacher's Pet: a neat white cuff and a gold star sticker.
    if (hand.role === 'pet') {
      const dir = Math.atan2(at.y - hand.rootY, at.x - hand.rootX);
      const cx = at.x - Math.cos(dir) * r * 1.15;
      const cy = at.y - Math.sin(dir) * r * 1.15;
      const nx = -Math.sin(dir) * r * 0.85;
      const ny = Math.cos(dir) * r * 0.85;
      stroke(ctx, [[cx - nx, cy - ny], [cx + nx, cy + ny]], w * 3.2, t, hand.id * 29, INK, 0.6);
      stroke(ctx, [[cx - nx, cy - ny], [cx + nx, cy + ny]], w * 2.2, t, hand.id * 29, '#fdfefe', 0.6);
      emoji(ctx, '⭐', at.x, at.y + 1, r * 0.95);
    }
    // Off with your blocks
    for (let k = 0; k < hand.carrying; k++) drawBlock(ctx, at.x + (k - (hand.carrying - 1) / 2) * r * 0.9, at.y, r * 0.85, hand.id + k, t);
  } else {
    // An open palm, offering.
    const dir = Math.atan2(at.y - hand.rootY, at.x - hand.rootX);
    for (let f = -2; f <= 2; f++) {
      const a = dir + f * 0.38;
      stroke(ctx, [[at.x + Math.cos(a) * r * 0.7, at.y + Math.sin(a) * r * 0.7], [at.x + Math.cos(a) * r * 1.55, at.y + Math.sin(a) * r * 1.55]], w * 1.3, t, hand.id * 7 + f * 3);
    }
    wobblyCircle(ctx, at.x, at.y, r, w, t, hand.id * 13, SKIN);
    const offer = hand.offer!;
    if (!hand.traded && !hand.slapped) {
      // What's in the hand, and the deal on a little tag
      const icon = offer.wants === 'blocks' ? ITEMS[offer.item].icon : '🧱';
      ctx.font = `${Math.round(r * 1.6)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, at.x, at.y);
      const label = offer.item === 'money' ? `💵 for ${offer.price}🧱` : hand.role === 'lunch' ? `${ITEMS[offer.item].icon} FREE!` : offer.wants === 'blocks' ? `${ITEMS[offer.item].icon} for ${offer.price}🧱` : `${offer.price}🧱 for your ${ITEMS[offer.item].icon}`;
      drawTag(ctx, at.x, at.y - r * 2.3, label, Math.max(11, u * 0.26), t, hand.id, color);
      // The regulars wear their names.
      if (hand.classmate) {
        const c = classmateById(hand.classmate);
        const name = `${c.icon} ${c.name}${isFriend(s.regulars[hand.classmate]) ? ' 💛' : ''}`;
        ctx.font = `bold ${Math.round(Math.max(11, u * 0.26))}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(name, at.x, at.y - r * 3.55);
        ctx.fillStyle = INK;
        ctx.fillText(name, at.x, at.y - r * 3.55);
      }
    } else if (hand.traded) {
      ctx.font = `${Math.round(r * 1.5)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(offer.wants === 'blocks' ? '🧱' : ITEMS[offer.item].icon, at.x, at.y);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, size: number, t: number, seed: number, color = TRADER) {
  ctx.font = `bold ${Math.round(size)}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  const left = Math.max(4, Math.min(x - w / 2, ctx.canvas.clientWidth - w - 4));
  wobblyPath(ctx, [[left, y - h / 2], [left + w, y - h / 2], [left + w, y + h / 2], [left, y + h / 2], [left, y - h / 2]], 1, t, seed * 5);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + w / 2, y + 1);
}

function drawBubble(ctx: CanvasRenderingContext2D, s: GameState, b: Bubble, t: number) {
  const u = unitOf(s);
  const size = Math.max(12, u * 0.3);
  ctx.font = `bold ${Math.round(size)}px ${FONT}`;
  // Wrap to a sensible width
  const maxW = Math.min(s.w * 0.42, size * 16);
  const words = b.text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.6;
  const h = lines.length * size * 1.25 + size * 1.1;
  let x: number;
  let y: number;
  let tailX: number;
  let tailY: number;
  if (b.who === 'teacher') {
    const head = teacherHead(s);
    x = Math.min(s.w - w - 6, head.x + head.r * 0.6);
    y = Math.max(6, head.y - head.r * 1.6 - h);
    tailX = head.x + head.r * 0.4;
    tailY = head.y - head.r;
  } else if (b.who === 'jack') {
    const head = jackHead(s);
    x = Math.max(6, head.x - w + head.r * 0.4);
    y = Math.max(6, head.y - head.r * 1.6 - h);
    tailX = head.x - head.r * 0.2;
    tailY = head.y - head.r;
  } else {
    x = Math.max(6, Math.min(s.w - w - 6, (b.x ?? s.w / 2) - w / 2));
    y = Math.max(6, (b.y ?? s.h / 2) - h - u * 1.2);
    tailX = b.x ?? s.w / 2;
    tailY = (b.y ?? s.h / 2) - u * 0.6;
  }
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  wobblyPath(ctx, [[x + w * 0.3, y + h], [tailX, tailY], [x + w * 0.55, y + h]], 1, t, 900);
  ctx.fill();
  ctx.stroke();
  wobblyPath(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], 1.4, t, 950);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + size * 0.55 + i * size * 1.25));
}

function drawFloaters(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const u = unitOf(s);
  for (const f of scene.floaters) {
    const age = scene.time - f.born;
    if (age > 1.1) continue;
    const size = Math.max(14, u * (f.big ? 0.5 : 0.34));
    ctx.globalAlpha = Math.max(0, 1 - age / 1.1);
    ctx.font = `bold ${Math.round(size)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    const y = f.y - age * u * 1.2;
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const t = scene.time;
  ctx.save();
  if (scene.shake > 0) ctx.translate(jitter(t * 6, 1) * 6 * scene.shake * 3, jitter(t * 6, 2) * 6 * scene.shake * 3);
  drawPaper(ctx, s);
  drawClassmates(ctx, s, t);
  const scolding = scene.bubbles.some((b) => b.who === 'teacher' && b.until > t);
  drawTeacher(ctx, s, t, scolding);
  drawBuildings(ctx, s, scene);
  drawPile(ctx, s, t);
  if (s.fence > 0) drawFence(ctx, s, t);
  drawJack(ctx, s, scene);
  drawDeskItems(ctx, s, t);
  // Leaving hands under reaching ones, so the dangerous ones are on top.
  for (const hand of s.hands) if (hand.state === 'leaving') drawHand(ctx, s, hand, scene);
  for (const hand of s.hands) if (hand.state === 'reaching') drawHand(ctx, s, hand, scene);
  // Nap time: lights out, except around the pile (and wherever you're pointing).
  if (s.phase === 'playing' && periodAt(s.waveTime).id === 'nap') drawDark(ctx, s, scene);
  // Sugar rush: show how far a slap reaches
  if (s.rush > 0 && scene.pointer && s.phase === 'playing') {
    ctx.beginPath();
    ctx.arc(scene.pointer.x, scene.pointer.y, slapRadius(s), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(46, 204, 113, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 132, 73, 0.6)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawHits(ctx, s, scene);
  if (scene.pointAt !== null) drawPointer(ctx, s, scene);
  if (s.special === 'snow' && s.phase === 'playing') drawSnow(ctx, s, t);
  if (s.photo === 'freeze' && s.phase === 'playing') drawViewfinder(ctx, s, t);
  if (t - scene.flash < 0.45) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - (t - scene.flash) / 0.45)})`;
    ctx.fillRect(0, 0, s.w, s.h);
  }
  for (const b of scene.bubbles) if (b.until > t) drawBubble(ctx, s, b, t);
  drawFloaters(ctx, s, scene);
  drawBanner(ctx, s, scene);
  ctx.restore();
}

let darkLayer: HTMLCanvasElement | null = null;

/**
 * Nap time: dark enough that you have to look for the hands (not just catch them out of the corner of
 * your eye), with soft light around the pile and around the pointer.
 */
/** Snow day: flakes drifting down past the window that isn't there. */
function drawSnow(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const size = Math.max(10, unitOf(s) * 0.28);
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#85c1e9';
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 36; i++) {
    const speed = 30 + ((i * 37) % 40);
    const x = ((i * 97.3) % s.w) + Math.sin(t * 0.8 + i) * 18;
    const y = ((t * speed + i * 131) % (s.h + 40)) - 20;
    ctx.fillText('❄', x, y);
  }
  ctx.globalAlpha = 1;
}

/** Picture day: the camera's corners while everyone holds still. */
function drawViewfinder(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const m = Math.min(s.w, s.h) * 0.06;
  const len = Math.min(s.w, s.h) * 0.12;
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 4;
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [s.w - m, m, -1, 1], [m, s.h - m, 1, -1], [s.w - m, s.h - m, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * len, y);
    ctx.stroke();
  }
  if (Math.floor(t * 3) % 2 === 0) {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(m + len * 0.4, m + len * 0.4, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `bold ${Math.round(Math.max(18, unitOf(s) * 0.5))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fff';
  ctx.strokeText('📸 SAY CHEESE! (nobody move)', s.w / 2, s.h * 0.18);
  ctx.fillStyle = '#c0392b';
  ctx.fillText('📸 SAY CHEESE! (nobody move)', s.w / 2, s.h * 0.18);
}

function drawDark(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const pile = pileAt(s);
  const size = blockSize(s);
  const u = unitOf(s);
  darkLayer ??= document.createElement('canvas');
  const w = Math.ceil(s.w);
  const h = Math.ceil(s.h);
  if (darkLayer.width !== w || darkLayer.height !== h) {
    darkLayer.width = w;
    darkLayer.height = h;
  }
  const d = darkLayer.getContext('2d')!;
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, w, h);
  d.fillStyle = 'rgba(10, 12, 30, 0.94)';
  d.fillRect(0, 0, w, h);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number) => {
    const g = d.createRadialGradient(x, y, r * 0.45, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g;
    d.beginPath();
    d.arc(x, y, r, 0, Math.PI * 2);
    d.fill();
  };
  const vision = s.perks.night ? 1.4 : 1;
  hole(pile.x, pile.y, size * 6 * vision);
  if (scene.pointer) hole(scene.pointer.x, scene.pointer.y, u * 2.1 * vision);
  ctx.drawImage(darkLayer, 0, 0, w, h);
  ctx.font = `${Math.round(u * 0.5)}px ${FONT}`;
  ctx.fillStyle = '#c9d4ff';
  ctx.textAlign = 'center';
  ctx.fillText('z z z', teacherHead(s).x + u, teacherHead(s).y - u);
}

function drawBanner(ctx: CanvasRenderingContext2D, s: GameState, scene: Scene) {
  const b = scene.banner;
  if (!b || b.until < scene.time) return;
  const u = unitOf(s);
  const left = b.until - scene.time;
  ctx.globalAlpha = Math.min(1, left * 2);
  const size = Math.max(22, u * 0.7);
  ctx.font = `bold ${Math.round(size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff';
  const y = s.h * 0.24;
  ctx.strokeText(b.text, s.w / 2, y);
  ctx.fillStyle = INK;
  ctx.fillText(b.text, s.w / 2, y);
  if (b.sub) {
    const sub = Math.max(13, u * 0.3);
    ctx.font = `bold ${Math.round(sub)}px ${FONT}`;
    // Wrap the explanation
    const words = b.sub.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > s.w * 0.8 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    ctx.lineWidth = 4;
    lines.forEach((l, i) => {
      ctx.strokeText(l, s.w / 2, y + size * 0.9 + i * sub * 1.3);
      ctx.fillStyle = '#c0392b';
      ctx.fillText(l, s.w / 2, y + size * 0.9 + i * sub * 1.3);
    });
  }
  ctx.globalAlpha = 1;
}
