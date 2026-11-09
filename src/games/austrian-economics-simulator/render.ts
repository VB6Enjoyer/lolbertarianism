// Draws the city from above: streets, the six places, manholes, the cops,
// passers-by and City Works trucks, and you (Rothbard, with a manhole cover).

import { COLS, isIntersection, isRoad, PLACES, ROWS, type Place } from './map.ts';
import { capacity, CONFIG, drugPrice, scrapPrice, type Agent, type GameState } from './logic.ts';

export interface View {
  /** Tile size and the map's top-left corner, in CSS pixels. */
  tile: number;
  ox: number;
  oy: number;
}

export function fitView(width: number, height: number): View {
  const tile = Math.min(width / COLS, height / ROWS);
  return { tile, ox: (width - tile * COLS) / 2, oy: (height - tile * ROWS) / 2 };
}

/** Screen position of a tile center. */
const at = (v: View, x: number, y: number) => [v.ox + (x + 0.5) * v.tile, v.oy + (y + 0.5) * v.tile] as const;

const money = (n: number) => `$${n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString('en-US')}`;

export interface Images {
  rothbard: HTMLImageElement;
}

export function render(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, v: View, images: Images, highlight: { x: number; y: number } | null): void {
  const T = v.tile;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#1d2a1f';
  ctx.fillRect(0, 0, width, height);

  // Edge lots: grass with trees and little houses
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (isRoad(x, y) || PLACES.some((p) => x >= p.block.x && x < p.block.x + p.block.w && y >= p.block.y && y < p.block.y + p.block.h)) continue;
      drawLot(ctx, v, x, y);
    }
  }
  drawStreets(ctx, v);
  for (const p of PLACES) drawPlace(ctx, v, p, state);

  // The door you're standing at
  if (highlight) {
    const [hx, hy] = at(v, highlight.x, highlight.y);
    ctx.strokeStyle = `rgba(95, 251, 241, ${0.5 + 0.4 * Math.sin(state.time * 6)})`;
    ctx.lineWidth = Math.max(2, T * 0.06);
    ctx.strokeRect(hx - T * 0.46, hy - T * 0.46, T * 0.92, T * 0.92);
  }

  for (const h of state.manholes) {
    if (h.state === 'paved') continue;
    const [x, y] = at(v, h.x, h.y);
    drawManhole(ctx, x, y, T, h.state === 'open', state.time);
  }

  for (const a of state.agents) {
    if (a.kind === 'cop') drawCop(ctx, v, a, state.time);
    else if (a.kind === 'ped') drawPed(ctx, v, a, state.time);
    else drawCrew(ctx, v, a, state.time);
  }
  drawPlayer(ctx, v, state, images);

  // The economy's mood
  if (state.phase === 'boom') {
    ctx.fillStyle = 'rgba(255, 200, 40, 0.07)';
    ctx.fillRect(0, 0, width, height);
  } else if (state.phase === 'bust') {
    ctx.fillStyle = 'rgba(40, 50, 70, 0.22)';
    ctx.fillRect(0, 0, width, height);
  }
}

function drawLot(ctx: CanvasRenderingContext2D, v: View, x: number, y: number) {
  const T = v.tile;
  const left = v.ox + x * T;
  const top = v.oy + y * T;
  ctx.fillStyle = (x + y) % 2 ? '#2f4a2c' : '#2b4429';
  ctx.fillRect(left, top, T, T);
  const kind = (x * 7 + y * 13) % 5;
  if (kind < 2) {
    // A tree
    ctx.fillStyle = '#1e3a1c';
    ctx.beginPath();
    ctx.arc(left + T * 0.52, top + T * 0.56, T * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7a35';
    ctx.beginPath();
    ctx.arc(left + T * 0.46, top + T * 0.48, T * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind < 4) {
    // A little house, from above
    ctx.fillStyle = ['#a1887f', '#90a4ae', '#bcaaa4'][kind - 2] ?? '#a1887f';
    ctx.fillRect(left + T * 0.14, top + T * 0.16, T * 0.72, T * 0.68);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(left + T * 0.14, top + T * 0.5, T * 0.72, T * 0.34);
  }
}

function drawStreets(ctx: CanvasRenderingContext2D, v: View) {
  const T = v.tile;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!isRoad(x, y)) continue;
      const left = v.ox + x * T;
      const top = v.oy + y * T;
      ctx.fillStyle = '#3b3f45';
      ctx.fillRect(left, top, T + 0.5, T + 0.5);
      // Sidewalk curbs where the street meets a block
      ctx.fillStyle = '#8e959c';
      const curb = T * 0.1;
      if (!isRoad(x, y - 1)) ctx.fillRect(left, top, T + 0.5, curb);
      if (!isRoad(x, y + 1)) ctx.fillRect(left, top + T - curb, T + 0.5, curb);
      if (!isRoad(x - 1, y)) ctx.fillRect(left, top, curb, T + 0.5);
      if (!isRoad(x + 1, y)) ctx.fillRect(left + T - curb, top, curb, T + 0.5);
      // Lane markings, and crosswalks at the crossings
      ctx.fillStyle = 'rgba(255, 213, 79, 0.75)';
      const horizontal = isRoad(x - 1, y) && isRoad(x + 1, y) && !isRoad(x, y - 1);
      const vertical = isRoad(x, y - 1) && isRoad(x, y + 1) && !isRoad(x - 1, y);
      if (isIntersection(x, y)) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let i = 0; i < 4; i++) ctx.fillRect(left + T * (0.12 + i * 0.22), top + T * 0.04, T * 0.1, T * 0.12);
      } else if (horizontal) {
        ctx.fillRect(left + T * 0.15, top + T * 0.47, T * 0.35, T * 0.06);
        ctx.fillRect(left + T * 0.65, top + T * 0.47, T * 0.2, T * 0.06);
      } else if (vertical) {
        ctx.fillRect(left + T * 0.47, top + T * 0.15, T * 0.06, T * 0.35);
        ctx.fillRect(left + T * 0.47, top + T * 0.65, T * 0.06, T * 0.2);
      }
    }
  }
}

/** A sign board, shrunk to fit `maxWidth` (its block) on small screens. */
function sign(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, T: number, bg: string, fg: string, maxWidth = Infinity) {
  ctx.font = `bold ${Math.max(8, Math.round(T * 0.26))}px 'Courier New', monospace`;
  const pad = T * 0.3;
  const w = Math.min(ctx.measureText(text).width + pad, maxWidth);
  const h = T * 0.42;
  ctx.fillStyle = bg;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, T * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1, w - pad * 0.6);
}

function drawPlace(ctx: CanvasRenderingContext2D, v: View, p: Place, state: GameState) {
  const T = v.tile;
  const { x: bx, y: by, w, h } = p.block;
  const left = v.ox + bx * T + T * 0.08;
  const top = v.oy + by * T + T * 0.08;
  const W = w * T - T * 0.16;
  const H = h * T - T * 0.16;
  const cx = left + W / 2;
  ctx.save();
  switch (p.id) {
    case 'fed': {
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(left, top, W, H);
      // Columns and steps
      ctx.fillStyle = '#c9c3b0';
      for (let i = 0; i < 7; i++) ctx.fillRect(left + W * (0.08 + i * 0.13), top + H * 0.32, W * 0.05, H * 0.5);
      ctx.fillStyle = '#b8b19b';
      ctx.fillRect(left, top + H * 0.82, W, H * 0.18);
      ctx.fillStyle = '#d6d0bc';
      ctx.beginPath();
      ctx.moveTo(left - T * 0.02, top + H * 0.32);
      ctx.lineTo(cx, top + H * 0.04);
      ctx.lineTo(left + W + T * 0.02, top + H * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5d4037';
      ctx.font = `bold ${Math.round(T * 0.22)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FEDERAL RESERVE', cx, top + H * 0.24, W * 0.8);
      // The money printer goes brrr in a boom
      if (state.phase === 'boom') {
        ctx.font = `bold ${Math.round(T * 0.34)}px sans-serif`;
        for (let i = 0; i < 6; i++) {
          const u = (state.time * 0.6 + i / 6) % 1;
          ctx.globalAlpha = 1 - u;
          ctx.fillStyle = '#2e7d32';
          ctx.fillText('$', left + W * (0.15 + ((i * 0.37) % 0.7)), top - u * T * 1.2);
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'yard-near':
    case 'yard-far': {
      ctx.fillStyle = '#6d5c45';
      ctx.fillRect(left, top, W, H);
      // Fence
      ctx.strokeStyle = '#a1887f';
      ctx.setLineDash([T * 0.12, T * 0.08]);
      ctx.lineWidth = 2;
      ctx.strokeRect(left + 2, top + 2, W - 4, H - 4);
      ctx.setLineDash([]);
      // Scrap piles
      const piles = [[0.22, 0.62, 0.2], [0.5, 0.72, 0.26], [0.78, 0.6, 0.18]];
      for (const [px, py, r] of piles) {
        ctx.fillStyle = '#5f6368';
        ctx.beginPath();
        ctx.ellipse(left + W * px, top + H * py, W * r, H * r * 0.9, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#80868b';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(left + W * (px - r * 0.5 + k * r * 0.33), top + H * (py - r * 0.35), T * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // A crane arm
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = Math.max(2, T * 0.07);
      ctx.beginPath();
      ctx.moveTo(left + W * 0.88, top + H * 0.9);
      ctx.lineTo(left + W * 0.88, top + H * 0.3);
      ctx.lineTo(left + W * 0.55, top + H * 0.22);
      ctx.stroke();
      const price = scrapPrice(state, p.id);
      sign(ctx, cx, top + H * 0.17, `${p.id === 'yard-near' ? 'CANTILLON SCRAP' : 'LAST-IN-LINE'} ${money(price)}`, T, '#263238', '#5fff8f', W);
      break;
    }
    case 'hardware': {
      ctx.fillStyle = '#8d3b2f';
      ctx.fillRect(left, top, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let r = 0; r < 6; r++) ctx.fillRect(left, top + H * (r / 6), W, 1);
      ctx.fillStyle = '#90caf9';
      ctx.fillRect(left + W * 0.12, top + H * 0.45, W * 0.3, H * 0.32);
      ctx.fillRect(left + W * 0.58, top + H * 0.45, W * 0.3, H * 0.32);
      ctx.font = `${Math.round(T * 0.5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔧', left + W * 0.27, top + H * 0.62);
      ctx.fillText('🛒', left + W * 0.73, top + H * 0.62);
      sign(ctx, cx, top + H * 0.2, 'ROUNDABOUT HARDWARE', T, '#fff3e0', '#8d3b2f', W);
      break;
    }
    case 'squat': {
      ctx.fillStyle = '#5d4a3a';
      ctx.fillRect(left, top, W, H);
      // Boarded windows
      ctx.fillStyle = '#a1887f';
      for (const wx of [0.15, 0.62]) {
        ctx.fillRect(left + W * wx, top + H * 0.42, W * 0.22, H * 0.08);
        ctx.fillRect(left + W * wx, top + H * 0.56, W * 0.22, H * 0.08);
      }
      // Your stash, stacked
      const stash = Math.min(state.stash, 12);
      for (let i = 0; i < stash; i++) {
        const sx = left + W * 0.5 + (i % 4) * T * 0.22 - T * 0.33;
        const sy = top + H * 0.86 - Math.floor(i / 4) * T * 0.12;
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.ellipse(sx, sy, T * 0.13, T * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      sign(ctx, cx, top + H * 0.2, state.stash ? `YOUR SQUAT · ${state.stash} SAVED` : 'YOUR SQUAT', T, '#3e2723', '#ffe082', W);
      break;
    }
    case 'dealer': {
      ctx.fillStyle = '#262130';
      ctx.fillRect(left, top, W, H);
      ctx.fillStyle = '#3a3346';
      ctx.fillRect(left + W * 0.38, top, W * 0.24, H);
      // A hooded figure in the alley
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(left + W * 0.5, top + H * 0.82, T * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d7ccc8';
      ctx.beginPath();
      ctx.arc(left + W * 0.5, top + H * 0.86, T * 0.08, 0, Math.PI * 2);
      ctx.fill();
      sign(ctx, cx, top + H * 0.2, 'THE CORNER', T, '#120d1a', '#ff4dd2', W);
      sign(ctx, cx, top + H * 0.5, `H ${money(drugPrice(state, 'heroin'))} · C ${money(drugPrice(state, 'crack'))}`, T * 0.85, state.dea > 0 ? '#b71c1c' : '#1a1325', '#5ffbf1', W);
      break;
    }
  }
  ctx.restore();
}

function drawManhole(ctx: CanvasRenderingContext2D, x: number, y: number, T: number, open: boolean, time: number) {
  const r = T * 0.3;
  if (open) {
    // A hole in the road, with a little warning glow
    ctx.fillStyle = `rgba(255, 82, 82, ${0.18 + 0.1 * Math.sin(time * 5)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b6b6b';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.08, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = '#56595e';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2c30';
  ctx.lineWidth = Math.max(1.5, T * 0.04);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = '#3d4044';
  ctx.lineWidth = Math.max(1, T * 0.025);
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * r * 0.28, y - r);
    ctx.lineTo(x + k * r * 0.28, y + r);
    ctx.moveTo(x - r, y + k * r * 0.28);
    ctx.lineTo(x + r, y + k * r * 0.28);
    ctx.stroke();
  }
  ctx.restore();
}

const PED_COLORS = ['#ef5350', '#42a5f5', '#ab47bc', '#26a69a'];

function person(ctx: CanvasRenderingContext2D, x: number, y: number, T: number, body: string, head = '#f1c27d', bob = 0) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + T * 0.2, T * 0.18, T * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y + T * 0.04 + bob, T * 0.17, T * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(x, y - T * 0.12 + bob, T * 0.11, 0, Math.PI * 2);
  ctx.fill();
}

const bobFor = (a: Agent, time: number, T: number) => (a.mover.path.length ? Math.sin(time * 14 + a.id) * T * 0.02 : 0);

function drawPed(ctx: CanvasRenderingContext2D, v: View, a: Agent, time: number) {
  const [x, y] = at(v, a.mover.x, a.mover.y);
  person(ctx, x, y, v.tile, PED_COLORS[a.variant % PED_COLORS.length], '#f1c27d', bobFor(a, time, v.tile));
}

function drawCop(ctx: CanvasRenderingContext2D, v: View, a: Agent, time: number) {
  const T = v.tile;
  const [x, y] = at(v, a.mover.x, a.mover.y);
  if (a.down > 0) {
    // Climbing out of the hole: just the cap, and stars
    ctx.fillStyle = '#1a237e';
    ctx.beginPath();
    ctx.ellipse(x, y, T * 0.15, T * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.round(T * 0.28)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💫', x + Math.cos(time * 4) * T * 0.2, y - T * 0.3);
    return;
  }
  // How far they can see
  ctx.fillStyle = 'rgba(41, 121, 255, 0.08)';
  ctx.strokeStyle = 'rgba(41, 121, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, T * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  person(ctx, x, y, T, '#283593', '#f1c27d', bobFor(a, time, T));
  ctx.fillStyle = '#0d1442';
  ctx.fillRect(x - T * 0.13, y - T * 0.26 + bobFor(a, time, T), T * 0.26, T * 0.08);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(x - T * 0.03, y - T * 0.25 + bobFor(a, time, T), T * 0.06, T * 0.05);
}

function drawCrew(ctx: CanvasRenderingContext2D, v: View, a: Agent, time: number) {
  const T = v.tile;
  const [x, y] = at(v, a.mover.x, a.mover.y);
  const next = a.mover.path[0];
  const horizontal = !next || Math.abs(next.x - a.mover.x) >= Math.abs(next.y - a.mover.y);
  const w = horizontal ? T * 0.86 : T * 0.5;
  const h = horizontal ? T * 0.5 : T * 0.86;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w / 2 + 3, y - h / 2 + 3, w, h);
  ctx.fillStyle = '#ef6c00';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, T * 0.08);
  ctx.fill();
  ctx.fillStyle = '#ffe0b2';
  ctx.fillRect(x - w * 0.36, y - h * 0.3, w * 0.72, h * 0.6);
  ctx.fillStyle = '#e65100';
  ctx.font = `bold ${Math.round(T * 0.15)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (horizontal) ctx.fillText('CITY', x, y);
  // Amber light
  ctx.fillStyle = Math.floor(time * 4) % 2 ? '#ffca28' : '#795548';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.38, T * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (a.work > 0) {
    // A worker in hi-vis at the hole, with a cone
    person(ctx, x + T * 0.42, y + T * 0.1, T * 0.9, '#c6ff00', '#f1c27d', Math.sin(time * 10) * T * 0.02);
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.moveTo(x - T * 0.45, y + T * 0.32);
    ctx.lineTo(x - T * 0.36, y + T * 0.05);
    ctx.lineTo(x - T * 0.27, y + T * 0.32);
    ctx.fill();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, state: GameState, images: Images) {
  const T = v.tile;
  const p = state.player;
  const [x, y] = at(v, p.mover.x, p.mover.y);
  const moving = p.mover.path.length > 0;
  const bob = moving ? Math.sin(state.time * 16) * T * 0.025 : 0;
  // Speed lines on a crack rush, z's on a heroin nod
  if (p.rush > 0 && moving) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - T * 0.5, y - T * 0.1 + i * T * 0.12);
      ctx.lineTo(x - T * 0.3, y - T * 0.1 + i * T * 0.12);
      ctx.stroke();
    }
  }
  if (state.gear.bike) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = Math.max(1.5, T * 0.04);
    for (const dx of [-0.2, 0.2]) {
      ctx.beginPath();
      ctx.arc(x + dx * T, y + T * 0.22, T * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // The suit (and a vest over it)
  person(ctx, x, y + T * 0.04, T * 1.05, state.gear.vest ? '#c6ff00' : '#5d4037', '#f1c27d', bob);
  ctx.fillStyle = '#b71c1c';
  ctx.beginPath();
  ctx.moveTo(x - T * 0.07, y - T * 0.02 + bob);
  ctx.lineTo(x, y + T * 0.02 + bob);
  ctx.lineTo(x - T * 0.07, y + T * 0.06 + bob);
  ctx.moveTo(x + T * 0.07, y - T * 0.02 + bob);
  ctx.lineTo(x, y + T * 0.02 + bob);
  ctx.lineTo(x + T * 0.07, y + T * 0.06 + bob);
  ctx.fill();
  // Rothbard's face
  const hw = T * 0.42;
  const hh = hw * (182 / 140);
  if (images.rothbard.complete && images.rothbard.naturalWidth) ctx.drawImage(images.rothbard, x - hw / 2, y - T * 0.12 - hh * 0.72 + bob, hw, hh);
  // Covers on your back (or in the cart)
  for (let i = 0; i < state.carried; i++) {
    const cx = x + T * (state.gear.cart ? 0.36 : 0.28);
    const cy = y + T * 0.12 - i * T * 0.1;
    ctx.fillStyle = '#56595e';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, T * 0.2, T * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (state.gear.cart && state.carried < capacity(state)) {
    ctx.strokeStyle = '#b0bec5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + T * 0.2, y + T * 0.02, T * 0.32, T * 0.2);
  }
  if (p.nod > 0) {
    ctx.fillStyle = '#e1f5fe';
    ctx.font = `bold ${Math.round(T * 0.26)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('z', x + T * 0.3, y - T * 0.55 - ((state.time * 0.8) % 1) * T * 0.3);
  }
  // Prying: a progress ring
  if (p.pry) {
    const total = state.gear.crowbar ? CONFIG.crowbarPryTime : CONFIG.pryTime;
    const done = 1 - p.pry.left / total;
    ctx.strokeStyle = '#5fff8f';
    ctx.lineWidth = Math.max(3, T * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, T * 0.48, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2);
    ctx.stroke();
  }
}
