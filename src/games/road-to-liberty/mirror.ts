// The rearview mirror: the road behind you, streaming away as you drive, and
// the cop car seen from the front, closer and bigger as they catch up.

import { CONFIG, curveAt, PLAYER_Z, segmentIndex, type Environment, type GameState } from './logic.ts';

/** Dash spacing in the mirror, in world units. */
const DASH_EVERY = 1600;
const DASHES = 9;

/** 0 (far) to 1 (right behind you). */
export function copCloseness(copGap: number): number {
  return 1 - Math.min(1, Math.max(0, copGap) / CONFIG.copMaxGap);
}

/** Draws the mirror view. (width, height) in CSS pixels. */
export function renderMirror(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, env: Environment): void {
  const horizon = height * 0.36;
  // The road behind bends the other way from the road ahead. It sits right of
  // center: Hoppe's face takes up the left of the mirror.
  const curve = curveAt(segmentIndex(state.position + PLAYER_Z));
  const centerX = width * 0.66;
  const vanishX = centerX - curve * width * 0.04;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#6fa8dc');
  sky.addColorStop(1, '#cfe8f7');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);
  ctx.fillStyle = '#5c9a6c';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 6) ctx.lineTo(x, horizon - 6 - 5 * Math.sin(x * 0.04 + state.position * 0.00002));
  ctx.lineTo(width, horizon);
  ctx.fill();
  ctx.fillStyle = '#3f9a49';
  ctx.fillRect(0, horizon, width, height - horizon);

  // Road: a wedge from the vanishing point to the bottom of the glass.
  const roadBottom = width * 0.62;
  ctx.fillStyle = '#5a5a5a';
  ctx.beginPath();
  ctx.moveTo(vanishX - 1, horizon);
  ctx.lineTo(vanishX + 1, horizon);
  ctx.lineTo(centerX + roadBottom, height);
  ctx.lineTo(centerX - roadBottom, height);
  ctx.closePath();
  ctx.fill();

  /** Screen position of a point `z` units behind you, at lateral offset `x` (-1..1). */
  const at = (z: number, x: number) => {
    const s = 1 / (1 + z / 1800);
    return {
      s,
      x: vanishX + (centerX - vanishX) * s + x * roadBottom * s,
      y: horizon + (height - horizon) * s,
    };
  };

  // Center dashes, moving away toward the horizon as you drive.
  const phase = (state.position % DASH_EVERY) / DASH_EVERY;
  ctx.fillStyle = '#f5d000';
  for (let k = 0; k < DASHES; k++) {
    const z1 = (k + phase) * DASH_EVERY;
    const a = at(z1, 0);
    const b = at(z1 + DASH_EVERY * 0.45, 0);
    const w1 = Math.max(0.6, a.s * 5);
    const w2 = Math.max(0.4, b.s * 5);
    ctx.beginPath();
    ctx.moveTo(a.x - w1, a.y);
    ctx.lineTo(b.x - w2, b.y);
    ctx.lineTo(b.x + w2, b.y);
    ctx.lineTo(a.x + w1, a.y);
    ctx.fill();
  }

  // Night and rain dim the view behind you (the cop lights stay bright).
  const dark = (1 - env.daylight) * 0.65 + env.rain * 0.15;
  if (dark > 0.01) {
    ctx.fillStyle = `rgba(0, 4, 20, ${dark})`;
    ctx.fillRect(0, 0, width, height);
  }

  // The cop car, nose first.
  const gap = Math.max(0, state.copGap);
  const car = at(gap * 0.35 + 300, Math.sin(state.time * 0.7) * 0.25);
  drawCopFront(ctx, car.x, car.y, width * 0.62 * car.s, state.time);
}

/** A police car seen head-on: body, windshield, light bar, headlights, grille. */
function drawCopFront(ctx: CanvasRenderingContext2D, x: number, bottom: number, w: number, time: number) {
  if (w < 3) return;
  const h = w * 0.62;
  const top = bottom - h;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w * 0.52, bottom - h * 0.05, w * 1.04, h * 0.08);
  // Tires
  ctx.fillStyle = '#111';
  ctx.fillRect(x - w * 0.48, bottom - h * 0.2, w * 0.16, h * 0.2);
  ctx.fillRect(x + w * 0.32, bottom - h * 0.2, w * 0.16, h * 0.2);
  // Lower body (black) and hood/cabin (white): classic black-and-white
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.roundRect(x - w * 0.5, bottom - h * 0.55, w, h * 0.42, w * 0.06);
  ctx.fill();
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.46, bottom - h * 0.52);
  ctx.lineTo(x - w * 0.34, top + h * 0.2);
  ctx.lineTo(x + w * 0.34, top + h * 0.2);
  ctx.lineTo(x + w * 0.46, bottom - h * 0.52);
  ctx.closePath();
  ctx.fill();
  // Windshield
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.36, bottom - h * 0.56);
  ctx.lineTo(x - w * 0.28, top + h * 0.26);
  ctx.lineTo(x + w * 0.28, top + h * 0.26);
  ctx.lineTo(x + w * 0.36, bottom - h * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.2, bottom - h * 0.56);
  ctx.lineTo(x - w * 0.1, top + h * 0.26);
  ctx.lineTo(x - w * 0.02, top + h * 0.26);
  ctx.lineTo(x - w * 0.12, bottom - h * 0.56);
  ctx.fill();
  // Light bar, flashing red and blue
  const flip = Math.floor(time * 6) % 2 === 0;
  ctx.fillStyle = flip ? '#ff1744' : '#5c0010';
  ctx.fillRect(x - w * 0.26, top + h * 0.06, w * 0.24, h * 0.12);
  ctx.fillStyle = flip ? '#0a1a5c' : '#2979ff';
  ctx.fillRect(x + w * 0.02, top + h * 0.06, w * 0.24, h * 0.12);
  if (w > 18) {
    ctx.fillStyle = flip ? 'rgba(255,23,68,0.35)' : 'rgba(41,121,255,0.35)';
    ctx.beginPath();
    ctx.arc(flip ? x - w * 0.14 : x + w * 0.14, top + h * 0.12, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grille and headlights
  ctx.fillStyle = '#333';
  ctx.fillRect(x - w * 0.18, bottom - h * 0.4, w * 0.36, h * 0.14);
  ctx.fillStyle = '#fffde7';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.36, bottom - h * 0.36, w * 0.1, h * 0.07, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.36, bottom - h * 0.36, w * 0.1, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  if (w > 40) {
    ctx.fillStyle = 'rgba(255, 253, 231, 0.25)';
    ctx.beginPath();
    ctx.arc(x - w * 0.36, bottom - h * 0.36, w * 0.2, 0, Math.PI * 2);
    ctx.arc(x + w * 0.36, bottom - h * 0.36, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    // The badge on the hood
    ctx.fillStyle = '#ffd600';
    ctx.font = `bold ${Math.round(h * 0.13)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', x, bottom - h * 0.62);
  }
  ctx.restore();
}
