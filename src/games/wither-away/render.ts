// Drawing a frame: the city at night, the red tape, the XP lying about, the statists, you, and
// everything flying. The camera follows you; the world is scaled so the shorter side of the screen
// shows about 720 units, on a phone or a monitor.

import type { Eyes, Sprite } from './balls.ts';
import { RESTING } from './balls.ts';
import { BOSSES, type MapId, WEAPON_STATS, type WeaponId } from './data.ts';
import { type FoeShot, type Game, handCount, PLAYER_RADIUS, type Wall } from './game.ts';

export const VIEW_UNITS = 720;

/** Balls with writing on them never flip (or "TAX" would read "XAT"). */
const LETTERED = new Set(['austrian', 'taxman', 'bank', 'nimby', 'printer']);

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
}

export interface Zap {
  points: [number, number][];
  life: number;
}

export interface Visuals {
  particles: Particle[];
  texts: FloatText[];
  /** NEIN! shockwaves, Creative Destruction's blasts and It's Happening's bolts. */
  rings: Ring[];
  booms: Ring[];
  zaps: Zap[];
  /** Bomb shockwaves. */
  blasts: Ring[];
  /** How hard the screen is shaking (world units; 0 = still), and the revolution warning (seconds left). */
  shake: number;
  warn: number;
  /** Red flash when you're hit (seconds left), and how long you stay pleased with yourself after an upgrade. */
  hurt: number;
  happy: number;
  /** The touch joystick, if a finger is down. */
  stick: null | { ox: number; oy: number; x: number; y: number };
}

/** Emoji drawn once into small canvases (drawing text every frame is slow). */
const emojiCache = new Map<string, HTMLCanvasElement>();
function emoji(char: string, size = 48): HTMLCanvasElement {
  const k = `${char}:${size}`;
  let c = emojiCache.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d')!;
    x.font = `${Math.round(size * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(char, size / 2, size / 2 + size * 0.05);
    emojiCache.set(k, c);
  }
  return c;
}

const PARTICLE_COLORS: Record<string, string> = {
  communist: '#cc0000',
  socialist: '#e30613',
  keynesian: '#0f4fa1',
  stimulus: '#3b78c9',
  fascist: '#2a2a2a',
  taxman: '#ffca28',
  technocrat: '#dedede',
  nimby: '#4caf50',
  bank: '#0d4d2e',
  marx: '#c62828',
  printer: '#9ccc65',
};
export const particleColor = (type: string) => PARTICLE_COLORS[type] ?? '#fff';

export function draw(ctx: CanvasRenderingContext2D, g: Game, sprites: Map<string, Sprite>, w: number, h: number, dpr: number, vis: Visuals) {
  // Phones show a slightly smaller slice of the world, so the balls aren't specks (new ones still appear off screen).
  const units = Math.min(w, h) < 500 ? 600 : VIEW_UNITS;
  const scale = (Math.min(w, h) / units) * dpr;
  const p = g.player;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = GROUND[g.map];
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  // World coordinates from here on: (0, 0) is the screen centre, at the player (give or take a shake).
  const sx = vis.shake ? (Math.random() - 0.5) * 2 * vis.shake * scale : 0;
  const sy = vis.shake ? (Math.random() - 0.5) * 2 * vis.shake * scale : 0;
  ctx.setTransform(scale, 0, 0, scale, (w * dpr) / 2 - p.x * scale + sx, (h * dpr) / 2 - p.y * scale + sy);
  const halfW = (w * dpr) / 2 / scale;
  const halfH = (h * dpr) / 2 / scale;
  const left = p.x - halfW;
  const top = p.y - halfH;
  const right = p.x + halfW;
  const bottom = p.y + halfH;
  const onScreen = (x: number, y: number, r: number) => x + r > left && x - r < right && y + r > top && y - r < bottom;

  if (g.map === 'vienna') drawVienna(ctx, left, top, right, bottom);
  else if (g.map === 'vault') drawVault(ctx, left, top, right, bottom);
  else drawGround(ctx, left, top, right, bottom);

  // The NIMBYs' picket fences.
  for (const wall of g.walls) if (onScreen((wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2, 80)) drawFence(ctx, wall);

  // XP and pickups.
  for (const pk of g.pickups) {
    if (!onScreen(pk.x, pk.y, 20)) continue;
    if (pk.kind === 'xp') {
      const big = pk.value >= 10;
      const mid = pk.value >= 3;
      const s = big ? 10 : mid ? 8 : 6.5;
      ctx.fillStyle = big ? '#e040fb' : mid ? '#69f0ae' : '#4fc3f7';
      ctx.beginPath();
      ctx.moveTo(pk.x, pk.y - s);
      ctx.lineTo(pk.x + s * 0.8, pk.y);
      ctx.lineTo(pk.x, pk.y + s);
      ctx.lineTo(pk.x - s * 0.8, pk.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      const size = pk.kind === 'chest' ? 40 : 22;
      // Bitcoin, the same coin as in Ancapistan Tycoon (an emoji until the image has loaded).
      const btc = pk.kind === 'gold' ? sprites.get('pickup:bitcoin') : undefined;
      if (btc) {
        // A gentle bob, so it catches the eye.
        const bob = Math.sin(g.time * 5 + pk.id) * 2;
        ctx.drawImage(btc, pk.x - size / 2, pk.y - size / 2 + bob, size, size);
        continue;
      }
      const icon = pk.kind === 'gold' ? '₿' : pk.kind === 'heal' ? '🥨' : pk.kind === 'magnet' ? '🧲' : '💰';
      ctx.drawImage(emoji(icon), pk.x - size / 2, pk.y - size / 2, size, size);
    }
  }

  // The Non-Aggression Pact's aura, under everyone.
  const nap = g.weapons.find((x) => x.id === 'nap');
  if (nap) {
    const r = WEAPON_STATS.nap.radius[nap.level - 1];
    ctx.fillStyle = 'rgba(255, 230, 0, 0.08)';
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Statists, back to front.
  const foes = g.enemies.filter((e) => onScreen(e.x, e.y, e.radius * 1.4)).sort((a, b) => a.y - b.y);
  for (const e of foes) {
    const eyes: Eyes = e.flash > 0.06 ? 'hurt' : (RESTING[e.type] ?? 'normal');
    // A fascist winding up for a charge shakes a little.
    const shake = e.windup && e.windup > 0 ? Math.sin(g.time * 60) * 2 : 0;
    drawBall(ctx, sprites, e.type, eyes, e.x + shake, e.y, e.radius, LETTERED.has(e.type) ? 1 : e.x > p.x ? -1 : 1);
    if (e.windup && e.windup > 0) {
      ctx.font = "900 22px 'Anton', Impact, sans-serif";
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#ff1744';
      ctx.strokeText('!', e.x, e.y - e.radius - 8);
      ctx.fillText('!', e.x, e.y - e.radius - 8);
    }
    if (e.type === 'socialist') {
      // Redistribution in progress: little green crosses drifting up.
      const t = (g.time * 0.9 + e.id * 0.37) % 1;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#4cdc5c';
      const cx = e.x + e.radius * 0.6;
      const cy = e.y - e.radius - t * 18;
      ctx.fillRect(cx - 5, cy - 1.6, 10, 3.2);
      ctx.fillRect(cx - 1.6, cy - 5, 3.2, 10);
      ctx.globalAlpha = 1;
    }
    if (BOSSES.includes(e.type) || e.type === 'printer') {
      // Its own health bar, under it.
      const bw = e.type === 'printer' ? 60 : 100;
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x - bw / 2, e.y + e.radius + 10, bw, 8);
      ctx.fillStyle = e.type === 'printer' ? '#ffb300' : '#c62828';
      ctx.fillRect(e.x - bw / 2 + 1, e.y + e.radius + 11, (bw - 2) * Math.max(0, e.hp / e.maxHp), 6);
    }
  }

  // Creative Destruction: a flash, then a ring of smoke.
  for (const b of vis.booms) {
    const t = 1 - b.life / 0.35;
    ctx.globalAlpha = Math.max(0, b.life / 0.35);
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * (0.5 + 0.5 * t));
    grad.addColorStop(0, '#fff59d');
    grad.addColorStop(0.45, '#ff9800');
    grad.addColorStop(1, 'rgba(183, 28, 28, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (0.5 + 0.5 * t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // You, and your gun if you carry one.
  drawBall(ctx, sprites, g.character, playerEyes(g, vis), p.x, p.y, PLAYER_RADIUS * 1.25, LETTERED.has(g.character) ? 1 : p.facing);
  for (const w of g.weapons) {
    const gun = GUNS[w.id];
    const img = gun && sprites.get(`gun:${w.id}`);
    if (gun && img) {
      drawGun(ctx, img, p.x, p.y, p.aim, gun.length, w.id === 'ak');
      break;
    }
  }

  // Winded after a bomb: a snail over your head.
  if (p.slowed > 0) {
    ctx.globalAlpha = Math.min(1, p.slowed * 2);
    ctx.drawImage(emoji('🐌'), p.x - 11, p.y - PLAYER_RADIUS - 34 + Math.sin(g.time * 6) * 2, 22, 22);
    ctx.globalAlpha = 1;
  }

  // Inflation balloons.
  for (const b of g.foeShots) {
    if (!onScreen(b.x, b.y, b.radius + 10)) continue;
    drawFoeShot(ctx, b, g.time);
  }

  // Your shots.
  for (const s of g.shots) {
    if (!onScreen(s.x, s.y, 30)) continue;
    switch (s.kind) {
      case 'bar': {
        // A gold bar, tumbling end over end.
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(g.time * 10 + s.id);
        ctx.fillStyle = '#ffc107';
        ctx.strokeStyle = '#6d4c00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-11, 6);
        ctx.lineTo(-7, -6);
        ctx.lineTo(7, -6);
        ctx.lineTo(11, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(-4, -3, 8, 2);
        ctx.restore();
        break;
      }
      case 'coin':
        ctx.fillStyle = '#ffd54f';
        ctx.strokeStyle = '#8d6e00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'pellet':
        ctx.fillStyle = '#ffe082';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'bullet': {
        const sp = Math.hypot(s.vx, s.vy) || 1;
        ctx.strokeStyle = s.from === 'm249' ? '#ffcc80' : '#fff59d';
        ctx.lineWidth = s.from === 'm249' ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - (s.vx / sp) * 14, s.y - (s.vy / sp) * 14);
        ctx.stroke();
        break;
      }
      case 'signal': {
        const colors = ['#ef5350', '#ffca28', '#66bb6a'];
        ctx.fillStyle = colors[Math.floor(g.time * 8 + s.id) % 3];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'laffer':
        ctx.save();
        ctx.translate(s.x, s.y);
        // A wobble, not a spin: a Laffer Curve upside down would be a different argument entirely.
        ctx.rotate(Math.sin(g.time * 9 + s.id) * 0.35);
        ctx.drawImage(sprites.get('icon:laffer') ?? emoji('📈'), -17, -17, 34, 34);
        ctx.restore();
        break;
    }
  }

  // The Invisible Hand.
  const hand = g.weapons.find((x) => x.id === 'hand');
  if (hand) {
    const L = hand.level - 1;
    const n = handCount(g);
    for (let i = 0; i < n; i++) {
      const a = hand.angle + (i / n) * Math.PI * 2;
      const hx = p.x + Math.cos(a) * WEAPON_STATS.hand.orbit[L];
      const hy = p.y + Math.sin(a) * WEAPON_STATS.hand.orbit[L];
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a + Math.PI / 2);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(emoji('🤚'), -16, -16, 32, 32);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // NEIN! shockwaves.
  for (const r of vis.rings) {
    const t = 1 - r.life / 0.4;
    ctx.globalAlpha = Math.max(0, r.life / 0.4);
    ctx.strokeStyle = '#ef2b2d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.font = "900 26px 'Anton', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.strokeText('NEIN!', r.x, r.y - PLAYER_RADIUS - 18 - t * 16);
    ctx.fillText('NEIN!', r.x, r.y - PLAYER_RADIUS - 18 - t * 16);
  }
  ctx.globalAlpha = 1;

  // It's Happening: jagged bolts, white with a blue glow.
  for (const z of vis.zaps) {
    ctx.globalAlpha = Math.max(0, z.life / 0.22);
    for (const [color, width] of [['rgba(79, 195, 247, 0.6)', 9], ['#fff', 3]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      z.points.forEach(([x, y], i) => {
        if (i === 0) return ctx.moveTo(x, y);
        const [px, py] = z.points[i - 1];
        // A kink halfway, so it looks like lightning and not a laser.
        const mx = (px + x) / 2 + Math.sin(i * 12.9898 + z.points.length) * 10;
        const my = (py + y) / 2 + Math.cos(i * 78.233) * 10;
        ctx.lineTo(mx, my);
        ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Bomb shockwaves: a white ring racing outwards, a gold one behind it.
  for (const b of vis.blasts) {
    const t = 1 - b.life / 0.5;
    ctx.globalAlpha = Math.max(0, b.life / 0.5);
    ctx.fillStyle = 'rgba(255, 245, 200, 0.18)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * t * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Bits flying off.
  for (const q of vis.particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = "700 15px 'Oswald', sans-serif";
  ctx.lineWidth = 3;
  for (const f of vis.texts) {
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    ctx.strokeStyle = '#000';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Screen space: the boss arrow, the revolution warning, the hurt flash and the joystick.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const toScreen = (x: number, y: number): [number, number] => [w / 2 + ((x - p.x) * scale) / dpr, h / 2 + ((y - p.y) * scale) / dpr];
  for (const e of g.enemies) {
    if (!BOSSES.includes(e.type) || onScreen(e.x, e.y, e.radius)) continue;
    // Where it is, off the edge: an arrow pinned to the border, pointing at it.
    const [ex, ey] = toScreen(e.x, e.y);
    const a = Math.atan2(ey - h / 2, ex - w / 2);
    const m = 34;
    const k = Math.min((w / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(a))), (h / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(a))));
    const ax = w / 2 + Math.cos(a) * k;
    const ay = h / 2 + Math.sin(a) * k;
    const pulse = 1 + Math.sin(g.time * 8) * 0.08;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.fillStyle = '#c62828';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(a);
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(30 * pulse, 0);
    ctx.lineTo(18, -9);
    ctx.lineTo(18, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(emoji(e.type === 'marx' ? '🧔' : '💸'), ax - 13, ay - 13, 26, 26);
  }
  if (vis.warn > 0) {
    // The red creeping in from every edge, pulsing: they're surrounding you.
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 10);
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(204,0,0,0)');
    grad.addColorStop(1, `rgba(204,0,0,${0.18 + 0.22 * pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (vis.hurt > 0) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${Math.min(0.45, vis.hurt * 1.5)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (vis.stick) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(vis.stick.ox, vis.stick.oy, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(vis.stick.x, vis.stick.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/**
 * Your face, moment to moment: hurt when hit, pleased after an upgrade or a big kill, sweating when
 * low on health or swamped, angry when the crowd closes in or the boss is near, otherwise your own
 * resting face.
 */
export function playerEyes(g: Game, vis: Pick<Visuals, 'happy'>): Eyes {
  const p = g.player;
  if (p.iframes > 0.2) return 'hurt';
  if (vis.happy > 0 || g.over === 'won') return 'happy';
  let close = 0;
  let bossNear = false;
  for (const e of g.enemies) {
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d2 < 170 * 170) close++;
    if (BOSSES.includes(e.type) && d2 < 400 * 400) bossNear = true;
  }
  if (p.hp < p.maxHp * 0.3 || close >= 25) return 'scared';
  if (close >= 8 || bossNear) return 'angry';
  return RESTING[g.character] ?? 'normal';
}

/** A night-time street grid: blocks, roads, dashed lane markings. */
function drawGround(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
  const BLOCK = 480;
  const ROAD = 70;
  ctx.fillStyle = '#232a3a';
  const bx0 = Math.floor(left / BLOCK) * BLOCK;
  const by0 = Math.floor(top / BLOCK) * BLOCK;
  for (let bx = bx0; bx < right; bx += BLOCK) ctx.fillRect(bx - ROAD / 2, top, ROAD, bottom - top);
  for (let by = by0; by < bottom; by += BLOCK) ctx.fillRect(left, by - ROAD / 2, right - left, ROAD);
  ctx.strokeStyle = 'rgba(255, 214, 79, 0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 22]);
  ctx.beginPath();
  for (let bx = bx0; bx < right; bx += BLOCK) {
    ctx.moveTo(bx, top);
    ctx.lineTo(bx, bottom);
  }
  for (let by = by0; by < bottom; by += BLOCK) {
    ctx.moveTo(left, by);
    ctx.lineTo(right, by);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Faint pavement tiles inside the blocks.
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const T = 60;
  for (let x = Math.floor(left / T) * T; x < right; x += T) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  for (let y = Math.floor(top / T) * T; y < bottom; y += T) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();
}

const GROUND: Record<MapId, string> = { streets: '#1b2130', vienna: '#3a332b', vault: '#1c2127' };

/** A number from 0 to 1 for a grid cell, the same every frame (for scattering decorations). */
const hash = (x: number, y: number) => {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Red Vienna: cobbles, tram lines, and a fountain in every square. */
function drawVienna(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
  // Cobbles, in staggered rows.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const CW = 34;
  const CH = 22;
  for (let row = Math.floor(top / CH); row * CH < bottom; row++) {
    const off = row % 2 ? CW / 2 : 0;
    for (let x = Math.floor((left - off) / CW) * CW + off; x < right; x += CW) ctx.rect(x + 1, row * CH + 1, CW - 2, CH - 2);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 236, 200, 0.035)';
  ctx.fillRect(left, top, right - left, bottom - top);
  // The tram lines, every few blocks: sleepers, then two rails.
  const SQ = 720;
  for (let ty = Math.floor(top / SQ) * SQ; ty < bottom + SQ; ty += SQ) {
    if (ty < top - 40 || ty > bottom + 40) continue;
    ctx.fillStyle = 'rgba(30, 24, 18, 0.75)';
    ctx.fillRect(left, ty - 26, right - left, 52);
    ctx.fillStyle = '#5d4632';
    for (let x = Math.floor(left / 26) * 26; x < right; x += 26) ctx.fillRect(x, ty - 20, 9, 40);
    ctx.fillStyle = '#9ea7ad';
    ctx.fillRect(left, ty - 14, right - left, 4);
    ctx.fillRect(left, ty + 10, right - left, 4);
  }
  // A fountain in the middle of each square.
  for (let cx = Math.floor(left / SQ) * SQ + SQ / 2; cx < right + SQ; cx += SQ) {
    for (let cy = Math.floor(top / SQ) * SQ + SQ / 2; cy < bottom + SQ; cy += SQ) {
      if (cx < left - 90 || cx > right + 90 || cy < top - 90 || cy > bottom + 90) continue;
      ctx.fillStyle = '#b8a78c';
      ctx.strokeStyle = '#2a231b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3d7fb0';
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(cx - 16, cy - 18, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d7c7a8';
      ctx.strokeStyle = '#2a231b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

let hazard: CanvasPattern | null = null;
/** The Federal Reserve vault: steel plates, hazard stripes, and piles of cash and gold. */
function drawVault(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
  const P = 120;
  ctx.strokeStyle = '#2d3640';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = Math.floor(left / P) * P; x < right; x += P) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  for (let y = Math.floor(top / P) * P; y < bottom; y += P) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();
  // Rivets at the plate corners.
  ctx.fillStyle = '#3c4753';
  ctx.beginPath();
  for (let x = Math.floor(left / P) * P; x < right; x += P) {
    for (let y = Math.floor(top / P) * P; y < bottom; y += P) {
      ctx.moveTo(x + 12, y + 12);
      ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  // Hazard stripes along the aisles.
  if (!hazard) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d')!;
    x.fillStyle = '#1a1a1a';
    x.fillRect(0, 0, 32, 32);
    x.fillStyle = '#f9a825';
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(16, 0);
    x.lineTo(0, 16);
    x.moveTo(32, 0);
    x.lineTo(32, 16);
    x.lineTo(16, 32);
    x.lineTo(0, 32);
    x.closePath();
    x.fill();
    hazard = ctx.createPattern(c, 'repeat');
  }
  const A = 960;
  ctx.fillStyle = hazard ?? '#f9a825';
  ctx.globalAlpha = 0.55;
  for (let x = Math.floor(left / A) * A; x < right; x += A) ctx.fillRect(x - 12, top, 24, bottom - top);
  for (let y = Math.floor(top / A) * A; y < bottom; y += A) ctx.fillRect(left, y - 12, right - left, 24);
  ctx.globalAlpha = 1;
  // Pallets of cash and stacks of gold, here and there.
  const C = 480;
  for (let gx = Math.floor(left / C) - 1; gx * C < right + C; gx++) {
    for (let gy = Math.floor(top / C) - 1; gy * C < bottom + C; gy++) {
      const r = hash(gx, gy);
      if (r > 0.6) continue;
      const x = gx * C + 120 + hash(gy, gx) * 240;
      const y = gy * C + 120 + hash(gx + 7, gy - 3) * 240;
      if (x < left - 80 || x > right + 80 || y < top - 80 || y > bottom + 80) continue;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#000';
      if (r < 0.3) {
        // A pallet of banknotes, banded.
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i % 2 ? '#558b2f' : '#689f38';
          ctx.fillRect(x - 34, y - 12 - i * 10, 68, 22);
          ctx.strokeRect(x - 34, y - 12 - i * 10, 68, 22);
          ctx.fillStyle = '#efebe9';
          ctx.fillRect(x - 4, y - 12 - i * 10, 8, 22);
        }
      } else {
        // A pyramid of gold bars.
        const bar = (bx: number, by: number) => {
          ctx.fillStyle = '#ffc107';
          ctx.beginPath();
          ctx.moveTo(bx - 16, by + 7);
          ctx.lineTo(bx - 11, by - 7);
          ctx.lineTo(bx + 11, by - 7);
          ctx.lineTo(bx + 16, by + 7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };
        bar(x - 17, y + 7);
        bar(x + 17, y + 7);
        bar(x, y - 7);
      }
    }
  }
}

/** A NIMBY's picket fence (fading out in its last second). */
function drawFence(ctx: CanvasRenderingContext2D, w: Wall) {
  const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  ctx.save();
  ctx.translate(w.x1, w.y1);
  ctx.rotate(Math.atan2(w.y2 - w.y1, w.x2 - w.x1));
  ctx.globalAlpha = Math.min(1, w.life);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-2, 2, len + 4, 10);
  ctx.strokeStyle = '#3e3e3e';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, -7, len, 4);
  ctx.strokeRect(0, -7, len, 4);
  ctx.fillRect(0, 2, len, 4);
  ctx.strokeRect(0, 2, len, 4);
  for (let x = 0; x <= len - 8; x += 11) {
    ctx.beginPath();
    ctx.moveTo(x, 9);
    ctx.lineTo(x, -10);
    ctx.lineTo(x + 4, -15);
    ctx.lineTo(x + 8, -10);
    ctx.lineTo(x + 8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** What they throw: inflation balloons, the Technocrat's expert opinions, Marx's hammers and sickles. */
function drawFoeShot(ctx: CanvasRenderingContext2D, b: FoeShot, time: number) {
  if (b.kind === 'balloon') {
    ctx.drawImage(emoji('🎈', 64), b.x - b.radius * 1.3, b.y - b.radius * 1.3, b.radius * 2.6, b.radius * 2.6);
    return;
  }
  if (b.kind === 'bolt') {
    ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0f7fa';
    ctx.strokeStyle = '#00838f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - b.radius - 2);
    ctx.lineTo(b.x + b.radius + 2, b.y);
    ctx.lineTo(b.x, b.y + b.radius + 2);
    ctx.lineTo(b.x - b.radius - 2, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  // Hammers and sickles, gold, spinning.
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(time * 12);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#ffcc00';
  if (b.kind === 'hammer') {
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -6);
    ctx.stroke();
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#000';
    ctx.fillRect(-11, -14, 22, 9);
    ctx.strokeRect(-11, -14, 22, 9);
  } else {
    for (const [color, width] of [['#000', 8], ['#ffcc00', 4.5]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(2, -2, 12, -Math.PI * 0.9, Math.PI * 0.45);
      ctx.moveTo(-4, 12);
      ctx.lineTo(-10, 18);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, sprites: Map<string, Sprite>, id: string, eyes: Eyes, x: number, y: number, r: number, facing: 1 | -1) {
  const sprite = sprites.get(`${id}:${eyes}`) ?? sprites.get(`${id}:normal`);
  if (!sprite) return;
  // The ball fills 88% of the sprite's width; its centre sits 66/112 of the way down.
  const w = (r * 2) / 0.88;
  const h = (w * 112) / 100;
  ctx.save();
  ctx.translate(x, y);
  if (facing === -1) ctx.scale(-1, 1);
  ctx.drawImage(sprite, -w / 2, -h * (66 / 112), w, h);
  ctx.restore();
}

/**
 * The guns, from the pictures in public/vidya/img: the direction each muzzle points in its picture
 * (degrees, screen-style: negative is up), whether to mirror it first, and how long to draw it.
 */
export interface GunDef {
  file: string;
  angle: number;
  mirror: boolean;
  length: number;
}
export const GUNS: Partial<Record<WeaponId, GunDef>> = {
  shotgun: { file: 'shotgun.webp', angle: -5, mirror: false, length: 56 },
  autoshotgun: { file: 'autoshotgun.webp', angle: -43, mirror: false, length: 56 },
  ak: { file: 'ak47.webp', angle: -49, mirror: false, length: 50 },
  m249: { file: 'm249.webp', angle: -43, mirror: true, length: 60 },
};

/** Turns a gun picture so the muzzle points right, trimmed to the gun. */
export function normalizeGun(img: HTMLImageElement, def: GunDef): HTMLCanvasElement {
  const size = Math.ceil(Math.hypot(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.translate(size / 2, size / 2);
  x.rotate((-def.angle * Math.PI) / 180);
  if (def.mirror) x.scale(-1, 1);
  x.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const data = x.getImageData(0, 0, size, size).data;
  let x0 = size;
  let y0 = size;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < size; y++) {
    for (let xx = 0; xx < size; xx++) {
      if (data[(y * size + xx) * 4 + 3] < 24) continue;
      if (xx < x0) x0 = xx;
      if (xx > x1) x1 = xx;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const out = document.createElement('canvas');
  out.width = Math.max(1, x1 - x0 + 1);
  out.height = Math.max(1, y1 - y0 + 1);
  out.getContext('2d')!.drawImage(c, -x0, -y0);
  return out;
}

/** Your gun, held at your side and pointing at whoever you're shooting (the AK keeps its price tag). */
function drawGun(ctx: CanvasRenderingContext2D, img: Sprite, x: number, y: number, aim: number, length: number, tag: boolean) {
  ctx.save();
  ctx.translate(x, y + 6);
  ctx.rotate(aim);
  if (Math.cos(aim) < 0) ctx.scale(1, -1);
  const h = (length * img.height) / img.width;
  // A faint light edge, so a black gun still shows up on the night-time street.
  ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
  ctx.shadowBlur = 4;
  ctx.drawImage(img, -4, -h / 2, length, h);
  ctx.shadowColor = 'transparent';
  if (tag) {
    // Hanging off the barrel on a string.
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(length * 0.62, -h * 0.1);
    ctx.lineTo(length * 0.66, h * 0.45);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(length * 0.6, h * 0.45, 7, 5);
    ctx.strokeRect(length * 0.6, h * 0.45, 7, 5);
  }
  ctx.restore();
}
