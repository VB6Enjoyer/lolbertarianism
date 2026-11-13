// Draws the classroom as a doodle: notebook paper, wobbly stick figures, the
// teacher on the left, Jack behind his ancap desk on the right, the block pile
// in the middle, and long stretchy arms reaching in for it.

import { handPosition, ITEMS, pileAt, type GameState, type Hand } from './logic.ts';

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
}

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
  stroke(ctx, [[h.x, neck + u * 0.9], [h.x + u * 0.9, neck + u * 1.9], [h.x + u * 1.4, neck + u * 1.7]], w, t, 90, THIEF, 1.5);
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
  // Angry eyebrows, beady eyes, a frown
  stroke(ctx, [[h.x - h.r * 0.6, h.y - h.r * 0.45], [h.x - h.r * 0.12, h.y - h.r * 0.15]], w, t, 140);
  stroke(ctx, [[h.x + h.r * 0.6, h.y - h.r * 0.45], [h.x + h.r * 0.12, h.y - h.r * 0.15]], w, t, 150);
  ctx.fillStyle = INK;
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(h.x + h.r * dx, h.y - h.r * 0.02, Math.max(2, w), 0, Math.PI * 2);
    ctx.fill();
  }
  stroke(ctx, [[h.x - h.r * 0.32, h.y + h.r * 0.55], [h.x, h.y + h.r * 0.38], [h.x + h.r * 0.32, h.y + h.r * 0.55]], w, t, 160);
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
  if (b.toll) drawSign(ctx, pile.x + signOff, signGround, size, ['🌉 TOLL', `+${b.toll}🧱 a trade`], '#1e8449', t, 720);
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

function drawPile(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const pile = pileAt(s);
  const size = blockSize(s);
  // A pyramid: rows get shorter going up.
  let row = 0;
  let placed = 0;
  let perRow = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(s.blocks * 2))));
  const baseY = pile.y + size * 1.4;
  while (placed < s.blocks) {
    const count = Math.min(perRow, s.blocks - placed);
    const y = baseY - row * size * 0.98;
    for (let i = 0; i < count; i++) drawBlock(ctx, pile.x + (i - (count - 1) / 2) * size * 1.02, y, size, placed + i, t);
    placed += count;
    perRow = Math.max(1, perRow - 1);
    row++;
  }
}

function drawHand(ctx: CanvasRenderingContext2D, s: GameState, hand: Hand, t: number) {
  const u = unitOf(s);
  const at = handPosition(hand);
  const thief = hand.kind === 'thief';
  const color = thief ? THIEF : TRADER;
  // The arm: a long wobbly sleeve from off the edge, outlined in ink like a crayon drawing.
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const f = i / 6;
    const sag = Math.sin(f * Math.PI) * u * 0.25 * Math.sin(hand.phase);
    pts.push([hand.rootX + (at.x - hand.rootX) * f + sag, hand.rootY + (at.y - hand.rootY) * f + sag]);
  }
  const armW = Math.max(5, u * 0.17);
  ctx.globalAlpha = hand.slapped ? 0.75 : 1;
  stroke(ctx, pts, armW + 4, t, hand.id * 31, INK, 1.4);
  stroke(ctx, pts, armW, t, hand.id * 31, color, 1.4);
  const r = Math.max(13, u * 0.42);
  const w = Math.max(1.8, u * 0.065);
  if (thief) {
    // A grabby claw: fingers opening and closing.
    const grab = (Math.sin(t * 11 + hand.id) + 1) / 2;
    const dir = Math.atan2(at.y - hand.rootY, at.x - hand.rootX);
    for (let f = -1.5; f <= 1.5; f++) {
      const a = dir + f * 0.45;
      const reach = r * (1.25 + grab * 0.45);
      const bend = dir + f * 0.45 + (grab - 0.5) * 1.2 * Math.sign(f || 1);
      stroke(ctx, [[at.x + Math.cos(a) * r * 0.6, at.y + Math.sin(a) * r * 0.6], [at.x + Math.cos(a) * reach, at.y + Math.sin(a) * reach], [at.x + Math.cos(bend) * reach * 1.05 + Math.cos(dir) * r * 0.2, at.y + Math.sin(bend) * reach * 1.05 + Math.sin(dir) * r * 0.2]], w * 1.4, t, hand.id * 7 + f * 3);
    }
    wobblyCircle(ctx, at.x, at.y, r, w, t, hand.id * 13, SKIN);
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
      const label = offer.wants === 'blocks' ? `${ITEMS[offer.item].icon} for ${offer.price}🧱` : `${offer.price}🧱 for your ${ITEMS[offer.item].icon}`;
      drawTag(ctx, at.x, at.y - r * 2.3, label, Math.max(11, u * 0.26), t, hand.id);
    } else if (hand.traded) {
      ctx.font = `${Math.round(r * 1.5)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(offer.wants === 'blocks' ? '🧱' : ITEMS[offer.item].icon, at.x, at.y);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, size: number, t: number, seed: number) {
  ctx.font = `bold ${Math.round(size)}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  const left = Math.max(4, Math.min(x - w / 2, ctx.canvas.clientWidth - w - 4));
  wobblyPath(ctx, [[left, y - h / 2], [left + w, y - h / 2], [left + w, y + h / 2], [left, y + h / 2], [left, y - h / 2]], 1, t, seed * 5);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = TRADER;
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
  drawJack(ctx, s, scene);
  drawDeskItems(ctx, s, t);
  // Leaving hands under reaching ones, so the dangerous ones are on top.
  for (const hand of s.hands) if (hand.state === 'leaving') drawHand(ctx, s, hand, t);
  for (const hand of s.hands) if (hand.state === 'reaching') drawHand(ctx, s, hand, t);
  for (const b of scene.bubbles) if (b.until > t) drawBubble(ctx, s, b, t);
  drawFloaters(ctx, s, scene);
  ctx.restore();
}
