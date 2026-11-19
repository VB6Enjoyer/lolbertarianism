// Drawing a frame: the city at night, the red tape, the XP lying about, the statists, you, and
// everything flying. The camera follows you; the world is scaled so the shorter side of the screen
// shows about 720 units, on a phone or a monitor.

import type { Eyes, Sprite } from './balls.ts';
import { RESTING } from './balls.ts';
import { WEAPON_STATS, type WeaponId } from './data.ts';
import { type Game, handCount, PLAYER_RADIUS } from './game.ts';

export const VIEW_UNITS = 720;

/** Balls with writing on them never flip (or "TAX" would read "XAT"). */
const LETTERED = new Set(['austrian', 'taxman', 'bank']);

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
  bank: '#0d4d2e',
};
export const particleColor = (type: string) => PARTICLE_COLORS[type] ?? '#fff';

export function draw(ctx: CanvasRenderingContext2D, g: Game, sprites: Map<string, Sprite>, w: number, h: number, dpr: number, vis: Visuals) {
  // Phones show a slightly smaller slice of the world, so the balls aren't specks (new ones still appear off screen).
  const units = Math.min(w, h) < 500 ? 600 : VIEW_UNITS;
  const scale = (Math.min(w, h) / units) * dpr;
  const p = g.player;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1b2130';
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  // World coordinates from here on: (0, 0) is the screen centre, at the player.
  ctx.setTransform(scale, 0, 0, scale, (w * dpr) / 2 - p.x * scale, (h * dpr) / 2 - p.y * scale);
  const halfW = (w * dpr) / 2 / scale;
  const halfH = (h * dpr) / 2 / scale;
  const left = p.x - halfW;
  const top = p.y - halfH;
  const right = p.x + halfW;
  const bottom = p.y + halfH;
  const onScreen = (x: number, y: number, r: number) => x + r > left && x - r < right && y + r > top && y - r < bottom;

  drawGround(ctx, left, top, right, bottom);

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
    if (e.type === 'bank') {
      // Its own health bar, under it.
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x - 50, e.y + e.radius + 10, 100, 8);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(e.x - 49, e.y + e.radius + 11, 98 * Math.max(0, e.hp / e.maxHp), 6);
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

  // Inflation balloons.
  for (const b of g.foeShots) {
    if (!onScreen(b.x, b.y, b.radius)) continue;
    ctx.drawImage(emoji('🎈', 64), b.x - b.radius * 1.3, b.y - b.radius * 1.3, b.radius * 2.6, b.radius * 2.6);
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

  // Screen space: the hurt flash and the joystick.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    if (e.type === 'bank' && d2 < 400 * 400) bossNear = true;
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
