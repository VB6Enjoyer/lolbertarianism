// Draws the road and everything on it onto a canvas, OutRun style: each road
// segment is projected to the screen as a trapezoid, nearest last, and sprites
// are drawn back to front on top, clipped behind hills.

import { CONFIG, cameraDepth, curveAt, heightAt, PLAYER_Z, segmentIndex, type Entity, type EntityKind, type GameState } from './logic.ts';

interface Point {
  x: number;
  y: number;
  /** Half the road's width on screen. */
  w: number;
  scale: number;
}

interface Projected {
  p1: Point;
  p2: Point;
  /** Sprites on this segment are clipped below this y (hidden behind a hill in front). */
  clip: number;
  visible: boolean;
}

const LANE_DIVIDERS = [-1 / 3, 1 / 3];

/** Sprite sizes in world units (width, height). */
const SIZE: Record<EntityKind, [number, number]> = {
  marx: [860, 1070],
  gold: [380, 380],
  fuel: [330, 400],
  traffic: [900, 620],
  roadblock: [1400, 760],
};

const CAR_COLORS = ['#c0392b', '#2471a3', '#f1c40f', '#7f8c8d'];
const ROADBLOCK_SIGNS = ['IRS CHECKPOINT', 'TOLL: 40% OF ALL', 'PERMIT REQUIRED', 'SOCIAL CREDIT CHECK'];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Marx in his armchair (public/vidya/img/marx.webp). Until it loads, he's drawn with shapes. */
const marxImage = new Image();
marxImage.src = `${import.meta.env.BASE_URL}vidya/img/marx.webp`;
const marxReady = () => marxImage.complete && marxImage.naturalWidth > 0;

function project(cameraX: number, cameraY: number, cameraZ: number, width: number, height: number): Point {
  const scale = cameraDepth / cameraZ;
  return {
    x: width / 2 + scale * cameraX * (width / 2),
    // Whole pixels, so neighboring segments share exact edges (no anti-aliased seams).
    y: Math.round(height / 2 - scale * cameraY * (height / 2)),
    w: scale * CONFIG.roadWidth * (width / 2),
    scale,
  };
}

function quad(ctx: CanvasRenderingContext2D, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x2 - w2, y2);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x1 + w1, y1);
  ctx.closePath();
  ctx.fill();
}

function drawSegment(ctx: CanvasRenderingContext2D, width: number, index: number, p1: Point, p2: Point) {
  const band = Math.floor(index / 3) % 2 === 0;
  ctx.fillStyle = band ? '#45a84f' : '#3d9a47';
  ctx.fillRect(0, p2.y, width, p1.y - p2.y);
  const rumble1 = p1.w / 8;
  const rumble2 = p2.w / 8;
  quad(ctx, p1.x, p1.y, p1.w + rumble1, p2.x, p2.y, p2.w + rumble2, band ? '#f2f2f2' : '#c62828');
  quad(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, band ? '#5e5e5e' : '#585858');
  if (band) {
    for (const d of LANE_DIVIDERS) {
      quad(ctx, p1.x + p1.w * d, p1.y, p1.w / 40, p2.x + p2.w * d, p2.y, p2.w / 40, '#f5d000');
    }
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, skyOffset: number) {
  const horizon = height / 2;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#3a8fd9');
  sky.addColorStop(1, '#bfe6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 2);

  // Sun
  const sunX = width * 0.78 - skyOffset * width * 0.2;
  ctx.fillStyle = 'rgba(255, 236, 140, 0.9)';
  ctx.beginPath();
  ctx.arc(((sunX % (width * 1.4)) + width * 1.4) % (width * 1.4) - width * 0.2, horizon * 0.35, Math.max(24, width * 0.03), 0, Math.PI * 2);
  ctx.fill();

  // Two layers of hills that slide sideways in curves (parallax).
  const layers: [string, number, number, number][] = [
    ['#7fb3a3', 0.35, horizon * 0.22, 0.004],
    ['#5c9a6c', 0.7, horizon * 0.14, 0.009],
  ];
  for (const [color, parallax, amplitude, freq] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    const shift = skyOffset * width * parallax;
    for (let x = 0; x <= width; x += 8) {
      const t = (x + shift) * freq;
      const y = horizon - amplitude * (0.55 + 0.3 * Math.sin(t) + 0.15 * Math.sin(t * 2.7 + 1));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, horizon + 2);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Sprites (drawn with canvas shapes: no image files needed)
// ---------------------------------------------------------------------------

/** Karl, mid-stroll across your road. `w`/`h` are his size on screen; (x, y) is where his feet are. */
function drawMarx(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number, id: number) {
  const sway = Math.sin(time * 6 + id) * 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.45, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = '#1b1b1b';
  const step = Math.sin(time * 8 + id) * w * 0.08;
  ctx.fillRect(-w * 0.2 + step, -h * 0.3, w * 0.16, h * 0.3);
  ctx.fillRect(w * 0.04 - step, -h * 0.3, w * 0.16, h * 0.3);
  // Frock coat
  ctx.fillStyle = '#262626';
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, -h * 0.26);
  ctx.lineTo(-w * 0.32, -h * 0.66);
  ctx.lineTo(w * 0.32, -h * 0.66);
  ctx.lineTo(w * 0.42, -h * 0.26);
  ctx.closePath();
  ctx.fill();
  // Red flag on a pole, for the true believer
  ctx.strokeStyle = '#6d4c2f';
  ctx.lineWidth = Math.max(1, w * 0.04);
  ctx.beginPath();
  ctx.moveTo(w * 0.42, -h * 0.35);
  ctx.lineTo(w * 0.42, -h * 1.05);
  ctx.stroke();
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.moveTo(w * 0.42, -h * 1.05);
  ctx.quadraticCurveTo(w * 0.7, -h * (0.98 + Math.sin(time * 9 + id) * 0.03), w * 0.95, -h * 1.0);
  ctx.lineTo(w * 0.95, -h * 0.84);
  ctx.quadraticCurveTo(w * 0.7, -h * 0.86, w * 0.42, -h * 0.85);
  ctx.closePath();
  ctx.fill();
  if (w > 40) {
    ctx.fillStyle = '#ffd600';
    ctx.font = `bold ${Math.round(h * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☭', w * 0.66, -h * 0.93);
  }
  // Head: face, the hair, and the beard to end all beards
  const headY = -h * 0.78;
  ctx.fillStyle = '#f3f3f3';
  for (const [dx, dy, r] of [[-0.2, -0.04, 0.17], [0.2, -0.04, 0.17], [0, -0.13, 0.17], [-0.14, -0.14, 0.13], [0.14, -0.14, 0.13]] as const) {
    ctx.beginPath();
    ctx.arc(w * dx, headY + h * dy, w * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f1c9a5';
  ctx.beginPath();
  ctx.ellipse(0, headY, w * 0.17, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ececec';
  ctx.beginPath();
  ctx.ellipse(0, headY + h * 0.09, w * 0.26, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (w > 24) {
    ctx.fillStyle = '#222';
    ctx.fillRect(-w * 0.09, headY - h * 0.02, w * 0.05, h * 0.014);
    ctx.fillRect(w * 0.04, headY - h * 0.02, w * 0.05, h * 0.014);
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(-w * 0.12, headY - h * 0.045, w * 0.1, h * 0.012);
    ctx.fillRect(w * 0.02, headY - h * 0.045, w * 0.1, h * 0.012);
  }
  ctx.restore();
}

/** The photo version: a shadow, then Marx and his chair, rocking a little. */
function drawMarxPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number, id: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.48, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 2 + id) * 0.02);
  const ratio = marxImage.naturalWidth / marxImage.naturalHeight;
  const drawW = h * ratio;
  ctx.drawImage(marxImage, -drawW / 2, -h, drawW, h);
  ctx.restore();
}

/** A red jerry can. */
function drawFuel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number, id: number) {
  const bob = Math.sin(time * 4 + id) * h * 0.05;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(255, 82, 82, 0.3)';
  ctx.beginPath();
  ctx.arc(0, -h * 0.5, w * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c62828';
  ctx.beginPath();
  ctx.roundRect(-w * 0.45, -h * 0.82, w * 0.9, h * 0.82, w * 0.1);
  ctx.fill();
  // Handle cut-out and spout
  ctx.fillStyle = '#8e0000';
  ctx.fillRect(-w * 0.3, -h * 0.76, w * 0.36, h * 0.1);
  ctx.fillStyle = '#ffca28';
  ctx.fillRect(w * 0.18, -h, w * 0.16, h * 0.2);
  // An X stamped on the side
  ctx.strokeStyle = '#8e0000';
  ctx.lineWidth = Math.max(1, w * 0.06);
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h * 0.58);
  ctx.lineTo(w * 0.32, -h * 0.08);
  ctx.moveTo(w * 0.32, -h * 0.58);
  ctx.lineTo(-w * 0.32, -h * 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawGold(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, time: number, id: number) {
  const bob = Math.sin(time * 4 + id) * w * 0.08;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
  ctx.beginPath();
  ctx.arc(x, y - w * 0.55 + bob, w * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${Math.round(w)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('💰', x, y + bob);
  ctx.restore();
}

/** A slowpoke from behind: body, rear window, tail lights, wheels. */
function drawTraffic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w * 0.5, y - h * 0.06, w, h * 0.08);
  ctx.fillStyle = '#111';
  ctx.fillRect(x - w * 0.46, y - h * 0.18, w * 0.18, h * 0.18);
  ctx.fillRect(x + w * 0.28, y - h * 0.18, w * 0.18, h * 0.18);
  ctx.fillStyle = CAR_COLORS[variant % CAR_COLORS.length];
  ctx.fillRect(x - w * 0.5, y - h * 0.62, w, h * 0.48);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.38, y - h * 0.62);
  ctx.lineTo(x - w * 0.28, y - h);
  ctx.lineTo(x + w * 0.28, y - h);
  ctx.lineTo(x + w * 0.38, y - h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9fd3ff';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.31, y - h * 0.66);
  ctx.lineTo(x - w * 0.24, y - h * 0.93);
  ctx.lineTo(x + w * 0.24, y - h * 0.93);
  ctx.lineTo(x + w * 0.31, y - h * 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff1744';
  ctx.fillRect(x - w * 0.47, y - h * 0.52, w * 0.14, h * 0.1);
  ctx.fillRect(x + w * 0.33, y - h * 0.52, w * 0.14, h * 0.1);
  if (w > 50) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - w * 0.14, y - h * 0.36, w * 0.28, h * 0.12);
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.round(h * 0.09)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXED', x, y - h * 0.3);
  }
  ctx.restore();
}

/** A striped barrier with a sign: the State wants a word. */
function drawRoadblock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  ctx.save();
  ctx.fillStyle = '#555';
  ctx.fillRect(x - w * 0.42, y - h * 0.55, w * 0.05, h * 0.55);
  ctx.fillRect(x + w * 0.37, y - h * 0.55, w * 0.05, h * 0.55);
  // Striped bar
  const barY = y - h * 0.55;
  const barH = h * 0.16;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.5, barY, w, barH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w * 0.5, barY, w, barH);
  ctx.clip();
  ctx.fillStyle = '#d32f2f';
  const stripe = w / 8;
  for (let i = -1; i < 9; i++) {
    ctx.beginPath();
    const sx = x - w * 0.5 + i * stripe;
    ctx.moveTo(sx, barY + barH);
    ctx.lineTo(sx + stripe * 0.5, barY);
    ctx.lineTo(sx + stripe, barY);
    ctx.lineTo(sx + stripe * 0.5, barY + barH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Sign
  ctx.fillStyle = '#1a237e';
  ctx.fillRect(x - w * 0.36, y - h, w * 0.72, h * 0.36);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.strokeRect(x - w * 0.34, y - h * 0.97, w * 0.68, h * 0.3);
  if (w > 60) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(h * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ROADBLOCK_SIGNS[variant % ROADBLOCK_SIGNS.length], x, y - h * 0.82, w * 0.64);
  }
  // Traffic cones
  for (const side of [-0.5, 0.5]) {
    const cx = x + w * side;
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.05, y);
    ctx.lineTo(cx, y - h * 0.3);
    ctx.lineTo(cx + w * 0.05, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - w * 0.025, y - h * 0.17, w * 0.05, h * 0.04);
  }
  ctx.restore();
}

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, x: number, y: number, w: number, h: number, time: number) {
  switch (e.kind) {
    case 'marx':
      if (e.hit) return;
      if (marxReady()) drawMarxPhoto(ctx, x, y, w, h, time, e.id);
      else drawMarx(ctx, x, y, w * 0.6, h * 0.93, time, e.id);
      return;
    case 'fuel':
      drawFuel(ctx, x, y, w, h, time, e.id);
      return;
    case 'gold':
      drawGold(ctx, x, y, w, time, e.id);
      return;
    case 'traffic':
      drawTraffic(ctx, x, y, w, h, e.variant);
      return;
    case 'roadblock':
      drawRoadblock(ctx, x, y, w, h, e.variant);
  }
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------

/**
 * Draws one frame. `width`/`height` are in CSS pixels (the context is already
 * scaled for the screen's pixel density). `skyOffset` slides the hills in curves.
 */
export function render(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, skyOffset: number): void {
  const segLen = CONFIG.segmentLength;
  ctx.save();
  if (state.crashLeft > 0) {
    const shake = state.crashLeft * 14;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawBackground(ctx, width, height, skyOffset);

  const base = segmentIndex(state.position);
  const basePercent = (state.position % segLen) / segLen;
  const playerZ = state.position + PLAYER_Z;
  const playerSeg = segmentIndex(playerZ);
  const playerY = lerp(heightAt(playerSeg), heightAt(playerSeg + 1), (playerZ % segLen) / segLen);
  const cameraY = playerY + CONFIG.cameraHeight;
  const cameraX = state.x * CONFIG.roadWidth;

  const segments: Projected[] = [];
  let x = 0;
  let dx = -curveAt(base) * basePercent;
  let maxY = height;
  for (let n = 0; n < CONFIG.drawDistance; n++) {
    const i = base + n;
    const z1 = i * segLen - state.position;
    const p1 = project(x - cameraX, heightAt(i) - cameraY, Math.max(z1, 1), width, height);
    const p2 = project(x + dx - cameraX, heightAt(i + 1) - cameraY, z1 + segLen, width, height);
    x += dx;
    dx += curveAt(i);
    const visible = z1 > cameraDepth && p2.y < p1.y && p2.y < maxY;
    segments.push({ p1, p2, clip: maxY, visible });
    if (!visible) continue;
    drawSegment(ctx, width, i, p1, p2);
    maxY = p2.y;
  }

  // Sprites, far to near.
  const sorted = [...state.entities].sort((a, b) => b.z - a.z);
  for (const e of sorted) {
    const n = segmentIndex(e.z) - base;
    if (n < 0 || n >= segments.length) continue;
    const seg = segments[n];
    if (e.z - state.position < cameraDepth * 2) continue;
    const t = (e.z % segLen) / segLen;
    const scale = lerp(seg.p1.scale, seg.p2.scale, t);
    const sx = lerp(seg.p1.x, seg.p2.x, t) + scale * e.x * CONFIG.roadWidth * (width / 2);
    const sy = lerp(seg.p1.y, seg.p2.y, t);
    const [ww, wh] = SIZE[e.kind];
    const w = scale * ww * (width / 2);
    const h = scale * wh * (width / 2);
    if (w < 2 || sy - h > seg.clip) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, seg.clip);
    ctx.clip();
    drawEntity(ctx, e, sx, sy, w, h, state.time);
    ctx.restore();
  }

  // Speed streaks while boosted.
  if (state.boostLeft > 0) {
    ctx.strokeStyle = `rgba(255, 235, 59, ${Math.min(0.6, state.boostLeft / 2)})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const side = k % 2 ? 1 : -1;
      const yy = height * (0.55 + ((k * 0.137 + state.time * 3) % 1) * 0.45);
      const xx = width / 2 + side * width * (0.28 + ((k * 0.31) % 0.2));
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + side * width * 0.08, yy + height * 0.06);
      ctx.stroke();
    }
  }
  ctx.restore();
}
