// Draws the road and everything on it onto a canvas, OutRun style: each road
// segment is projected to the screen as a trapezoid, nearest last, and sprites
// are drawn back to front on top, clipped behind hills.

import { borderName, COMMIES, CONFIG, cameraDepth, curveAt, heightAt, isScenery, PLAYER_Z, segmentIndex, type Entity, type EntityKind, type Environment, type GameState, type PowerUp } from './logic.ts';
import { drawScenery, SCENERY_SIZE } from './scenery.ts';
import { blink, display } from './settings.ts';
import { HELI_PARTS, heliImage, TANK_PARTS, tankImage } from './bosses.ts';
import { BIOMES, biomeAt, blendColor, blendNumber, type Biome } from './biomes.ts';

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
  /** Marx seated; the standing commies use COMMIE_HEIGHT and their photo's proportions. */
  commie: [860, 1070],
  gold: [380, 380],
  fuel: [330, 400],
  spikes: [2000, 160],
  cruiser: [900, 640],
  tank: [1500, 900],
  border: [5000, 2700],
  donuts: [520, 450],
  killdozer: [700, 450],
  smoke: [330, 450],
  wrench: [620, 380],
  ...SCENERY_SIZE,
  traffic: [900, 620],
  roadblock: [1400, 760],
};

const CAR_COLORS = ['#c0392b', '#2471a3', '#f1c40f', '#7f8c8d'];
/** Indexes 4 and 5 are the lane events' toll booths and road work (TOLL_SIGN, ROADWORK_SIGN in logic.ts). */
const ROADBLOCK_SIGNS = ['IRS CHECKPOINT', 'TOLL: 40% OF ALL', 'PERMIT REQUIRED', 'SOCIAL CREDIT CHECK', 'STATE TOLL BOOTH', 'ROAD WORK · LANE CLOSED'];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The commies' photos (public/vidya/img/<id>.webp): Marx in his armchair, the rest standing. */
const COMMIE_IMAGES = COMMIES.map((c) => {
  const image = new Image();
  image.src = `${import.meta.env.BASE_URL}vidya/img/${c.id}.webp`;
  return image;
});
const imageReady = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;
/** Standing commies are this tall in world units (about a person next to the road's width). */
const COMMIE_HEIGHT = 1000;

/** A commie's size in world units: Marx's chair is wide; the others follow their photo. */
function commieSize(variant: number): [number, number] {
  if (variant === 0) return SIZE.commie;
  const image = COMMIE_IMAGES[variant];
  const ratio = image && imageReady(image) ? image.naturalWidth / image.naturalHeight : 0.37;
  return [COMMIE_HEIGHT * ratio, COMMIE_HEIGHT];
}

/** Power-up pictures, with an emoji stand-in until they load, and a glow color each. */
const POWER_UP_LOOK: Record<PowerUp, { image: HTMLImageElement; emoji: string; glow: string }> = {
  donuts: { image: new Image(), emoji: '🍩', glow: 'rgba(255, 128, 171, 0.45)' },
  killdozer: { image: new Image(), emoji: '🚜', glow: 'rgba(255, 193, 7, 0.45)' },
  smoke: { image: new Image(), emoji: '💨', glow: 'rgba(176, 190, 197, 0.55)' },
  wrench: { image: new Image(), emoji: '🔧', glow: 'rgba(129, 212, 250, 0.5)' },
};
POWER_UP_LOOK.donuts.image.src = `${import.meta.env.BASE_URL}vidya/img/donuts.webp`;
POWER_UP_LOOK.killdozer.image.src = `${import.meta.env.BASE_URL}vidya/img/killdozer.webp`;
POWER_UP_LOOK.smoke.image.src = `${import.meta.env.BASE_URL}vidya/img/smoke-grenade.webp`;
POWER_UP_LOOK.wrench.image.src = `${import.meta.env.BASE_URL}vidya/img/wrench.webp`;

/** A power-up floating over the road: a pulsing glow and its picture. */
function drawPowerUp(ctx: CanvasRenderingContext2D, kind: PowerUp, x: number, y: number, w: number, h: number, time: number, id: number) {
  const look = POWER_UP_LOOK[kind];
  const bob = Math.sin(time * 4 + id) * h * 0.06;
  ctx.save();
  ctx.fillStyle = look.glow;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.5 + bob, Math.max(w, h) * (0.62 + Math.sin(time * 6) * 0.05), 0, Math.PI * 2);
  ctx.fill();
  if (look.image.complete && look.image.naturalWidth > 0) {
    const ratio = look.image.naturalWidth / look.image.naturalHeight;
    const drawH = Math.min(h, w / ratio);
    ctx.drawImage(look.image, x - (drawH * ratio) / 2, y - drawH + bob, drawH * ratio, drawH);
  } else {
    ctx.font = `${Math.round(h)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(look.emoji, x, y + bob);
  }
  ctx.restore();
}

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

const BEACH = BIOMES.find((b) => b.sea)!;

function drawSegment(ctx: CanvasRenderingContext2D, width: number, index: number, p1: Point, p2: Point) {
  const band = Math.floor(index / 3) % 2 === 0;
  const z = index * CONFIG.segmentLength;
  ctx.fillStyle = css(blendColor(z, (b) => b.ground[band ? 0 : 1]));
  ctx.fillRect(0, p2.y, width, p1.y - p2.y);
  // The sea, beyond the beach on the right
  const sea = blendNumber(z, (b) => (b.sea ? 1 : 0));
  if (sea > 0) {
    const shore1 = p1.x + p1.w * 2.4;
    const shore2 = p2.x + p2.w * 2.4;
    ctx.globalAlpha = sea;
    ctx.fillStyle = css(BEACH.sea![band ? 0 : 1]);
    ctx.beginPath();
    ctx.moveTo(shore1, p1.y);
    ctx.lineTo(shore2, p2.y);
    ctx.lineTo(Math.max(width, shore2), p2.y);
    ctx.lineTo(Math.max(width, shore1), p1.y);
    ctx.closePath();
    ctx.fill();
    // Foam along the shore
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(shore1 - p1.w * 0.06, p1.y);
    ctx.lineTo(shore2 - p2.w * 0.06, p2.y);
    ctx.lineTo(shore2 + p2.w * 0.04, p2.y);
    ctx.lineTo(shore1 + p1.w * 0.04, p1.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const rumble1 = p1.w / 8;
  const rumble2 = p2.w / 8;
  quad(ctx, p1.x, p1.y, p1.w + rumble1, p2.x, p2.y, p2.w + rumble2, band ? '#f2f2f2' : '#c62828');
  quad(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, css(blendColor(z, (b) => b.road[band ? 0 : 1])));
  if (band) {
    for (const d of LANE_DIVIDERS) {
      quad(ctx, p1.x + p1.w * d, p1.y, p1.w / 40, p2.x + p2.w * d, p2.y, p2.w / 40, '#f5d000');
    }
  }
}

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;

const SKY = {
  sunset: [255, 158, 94] as RGB,
  nightTop: [5, 10, 31] as RGB,
  nightBottom: [26, 35, 71] as RGB,
  overcast: [120, 132, 145] as RGB,
};

/** Stars at fixed spots (0..1 coordinates), so they don't flicker around. */
const STARS = Array.from({ length: 70 }, (_, i) => [((i * 7919) % 1000) / 1000, ((i * 104729) % 1000) / 1000] as const);

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, skyOffset: number, env: Environment, playerZ: number) {
  const horizon = height / 2;
  const d = env.daylight;
  // Each biome has its own daytime sky; night and sunset are shared.
  const dayTop = blendColor(playerZ, (b) => b.sky[0]);
  const dayBottom = blendColor(playerZ, (b) => b.sky[1]);
  let top = mix(SKY.nightTop, dayTop, d);
  let bottom = d > 0.5 ? mix(SKY.sunset, dayBottom, (d - 0.5) * 2) : mix(SKY.nightBottom, SKY.sunset, d * 2);
  top = mix(top, mix(SKY.overcast, SKY.nightTop, 1 - d), env.rain * 0.7);
  bottom = mix(bottom, mix(SKY.overcast, SKY.nightBottom, 1 - d), env.rain * 0.7);
  // Ground under the horizon, so nothing from earlier frames shows between the hills and the road.
  ctx.fillStyle = css(blendColor(playerZ + CONFIG.drawDistance * CONFIG.segmentLength, (b) => b.ground[1]));
  ctx.fillRect(0, horizon, width, height - horizon);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, css(top));
  sky.addColorStop(1, css(bottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 2);

  // Stars and the moon at night
  if (d < 0.6 && env.rain < 0.8) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.6 - d) * (1 - env.rain)})`;
    for (const [sx, sy] of STARS) ctx.fillRect(sx * width, sy * horizon * 0.85, 1.6, 1.6);
    ctx.fillStyle = `rgba(240, 240, 220, ${(0.6 - d) * 1.5 * (1 - env.rain)})`;
    ctx.beginPath();
    ctx.arc(width * 0.2, horizon * 0.3, Math.max(14, width * 0.018), 0, Math.PI * 2);
    ctx.fill();
  }

  // The sun sinks as the day ends
  if (d > 0 && env.rain < 0.9) {
    const sunX = width * 0.78 - skyOffset * width * 0.2;
    const wrapped = ((sunX % (width * 1.4)) + width * 1.4) % (width * 1.4) - width * 0.2;
    ctx.fillStyle = d > 0.6 ? `rgba(255, 236, 140, ${0.9 * (1 - env.rain)})` : `rgba(255, 140, 70, ${0.9 * (1 - env.rain)})`;
    ctx.beginPath();
    ctx.arc(wrapped, horizon * (0.35 + (1 - d) * 0.7), Math.max(24, width * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }

  // The horizon: this biome's hills, crossfading into the next one's.
  const shade = 0.3 + 0.7 * d;
  const here = biomeAt(playerZ);
  drawHills(ctx, width, horizon, skyOffset, here.biome, shade);
  if (here.t > 0) {
    ctx.globalAlpha = here.t;
    drawHills(ctx, width, horizon, skyOffset, here.next, shade);
    ctx.globalAlpha = 1;
  }
}

/** A repeatable pseudo-random number in [0, 1) for peak heights. */
const hash = (k: number) => {
  const v = Math.sin(k * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/** Two layers of distant scenery that slide sideways in curves (parallax), shaped by biome. */
function drawHills(ctx: CanvasRenderingContext2D, width: number, horizon: number, skyOffset: number, biome: Biome, shade: number) {
  const tint = (rgb: RGB) => css(rgb.map((c) => Math.round(c * shade)) as RGB);
  const layer = (rgb: RGB, parallax: number, height: (t: number) => number, freq: number) => {
    ctx.fillStyle = tint(rgb);
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    const shift = skyOffset * width * parallax;
    for (let x = 0; x <= width; x += 6) ctx.lineTo(x, horizon - height((x + shift) * freq));
    ctx.lineTo(width, horizon + 2);
    ctx.closePath();
    ctx.fill();
  };
  const [far, near] = biome.hills;
  switch (biome.hillShape) {
    case 'rolling':
    case 'snowdrifts': {
      const low = biome.hillShape === 'snowdrifts' ? 0.8 : 1;
      layer(far, 0.35, (t) => horizon * 0.22 * low * (0.55 + 0.3 * Math.sin(t) + 0.15 * Math.sin(t * 2.7 + 1)), 0.004);
      layer(near, 0.7, (t) => horizon * 0.14 * low * (0.55 + 0.3 * Math.sin(t) + 0.15 * Math.sin(t * 2.7 + 1)), 0.009);
      return;
    }
    case 'dunes':
      // Flat-topped mesas far away, soft dunes nearer.
      layer(far, 0.3, (t) => {
        const mesa = Math.min(1, Math.max(0, (Math.sin(t) - 0.35) * 5));
        return horizon * (0.05 + 0.22 * mesa * (0.7 + 0.3 * hash(Math.floor(t / Math.PI))));
      }, 0.006);
      layer(near, 0.65, (t) => horizon * 0.09 * (0.6 + 0.4 * Math.sin(t) * Math.sin(t * 0.37)), 0.007);
      return;
    case 'islands': {
      // Open sea to the horizon, with a few islands on it.
      ctx.fillStyle = tint(BEACH.sea![0]);
      ctx.fillRect(0, horizon - horizon * 0.035, width, horizon * 0.035 + 2);
      layer(far, 0.3, (t) => {
        const bump = Math.max(0, Math.sin(t) - 0.7) * 3.3;
        return bump > 0 ? horizon * 0.035 + horizon * 0.12 * bump : 0;
      }, 0.005);
      return;
    }
    case 'peaks': {
      // Jagged peaks with snow caps, and darker foothills in front.
      const tri = (t: number) => 1 - Math.abs(2 * (t - Math.floor(t)) - 1);
      const peakHeight = (t: number) => horizon * 0.55 * (0.5 + 0.5 * hash(Math.floor(t))) * tri(t);
      layer(far, 0.3, peakHeight, 0.006);
      // Snow caps on each far peak
      ctx.fillStyle = tint([248, 250, 252]);
      const shift = skyOffset * width * 0.3;
      const freq = 0.006;
      for (let k = Math.floor(shift * freq) - 1; k <= Math.floor((shift + width) * freq) + 1; k++) {
        const apexX = (k + 0.5) / freq - shift;
        const h = horizon * 0.55 * (0.5 + 0.5 * hash(k));
        const capH = h * 0.28;
        const halfW = (0.5 / freq) * 0.28;
        ctx.beginPath();
        ctx.moveTo(apexX, horizon - h);
        ctx.lineTo(apexX - halfW, horizon - h + capH);
        ctx.lineTo(apexX - halfW * 0.4, horizon - h + capH * 0.8);
        ctx.lineTo(apexX, horizon - h + capH);
        ctx.lineTo(apexX + halfW * 0.5, horizon - h + capH * 0.75);
        ctx.lineTo(apexX + halfW, horizon - h + capH);
        ctx.closePath();
        ctx.fill();
      }
      layer(near, 0.6, (t) => horizon * 0.2 * (0.4 + 0.6 * hash(Math.floor(t))) * tri(t), 0.011);
      return;
    }
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

/** The photo version: a shadow, then the commie (and Marx's chair), swaying a little. */
function drawCommiePhoto(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, time: number, id: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.48, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 2 + id) * 0.02);
  const ratio = image.naturalWidth / image.naturalHeight;
  const drawW = h * ratio;
  ctx.drawImage(image, -drawW / 2, -h, drawW, h);
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

/** A spike strip across two lanes: a dark band of steel teeth, striped ends. */
function drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = '#222';
  ctx.fillRect(x - w / 2, y - h * 0.5, w, h * 0.5);
  ctx.fillStyle = '#cfd8dc';
  const teeth = 16;
  for (let i = 0; i < teeth; i++) {
    const tx = x - w / 2 + (i + 0.5) * (w / teeth);
    ctx.beginPath();
    ctx.moveTo(tx - w / teeth / 2.5, y - h * 0.45);
    ctx.lineTo(tx, y - h);
    ctx.lineTo(tx + w / teeth / 2.5, y - h * 0.45);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd600';
  ctx.fillRect(x - w / 2, y - h * 0.5, w * 0.05, h * 0.5);
  ctx.fillRect(x + w / 2 - w * 0.05, y - h * 0.5, w * 0.05, h * 0.5);
  ctx.restore();
}

/** A police cruiser from behind, light bar going. */
function drawCruiser(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w * 0.5, y - h * 0.06, w, h * 0.08);
  ctx.fillStyle = '#111';
  ctx.fillRect(x - w * 0.46, y - h * 0.18, w * 0.18, h * 0.18);
  ctx.fillRect(x + w * 0.28, y - h * 0.18, w * 0.18, h * 0.18);
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(x - w * 0.5, y - h * 0.6, w, h * 0.46);
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.38, y - h * 0.6);
  ctx.lineTo(x - w * 0.28, y - h * 0.9);
  ctx.lineTo(x + w * 0.28, y - h * 0.9);
  ctx.lineTo(x + w * 0.38, y - h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(x - w * 0.27, y - h * 0.85, w * 0.54, h * 0.2);
  // Alternating red and blue (both lit and steady with reduced flashing)
  const flip = Math.floor(time * 6) % 2 === 0;
  ctx.fillStyle = flip || display.reducedFlashing ? '#ff1744' : '#5c0010';
  ctx.fillRect(x - w * 0.24, y - h, w * 0.22, h * 0.1);
  ctx.fillStyle = flip && !display.reducedFlashing ? '#0a1a5c' : '#2979ff';
  ctx.fillRect(x + w * 0.02, y - h, w * 0.22, h * 0.1);
  ctx.fillStyle = '#ff1744';
  ctx.fillRect(x - w * 0.47, y - h * 0.5, w * 0.14, h * 0.1);
  ctx.fillRect(x + w * 0.33, y - h * 0.5, w * 0.14, h * 0.1);
  if (w > 50) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(h * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', x, y - h * 0.34);
  }
  ctx.restore();
}

/** The State's tank, from behind (the SVG in bosses.ts), with moving treads and brake lights on top. */
function drawTank(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number) {
  const img = tankImage();
  if (!img) return;
  const left = x - w / 2;
  const top = y - h;
  const sx = w / 300;
  const sy = h / 180;
  ctx.save();
  ctx.drawImage(img, left, top, w, h);
  // Tread links rolling down the tracks
  if (w > 24) {
    ctx.fillStyle = 'rgba(110, 110, 110, 0.75)';
    const tick = (time * 10) % 1;
    const span = TANK_PARTS.trackBottom - TANK_PARTS.trackTop;
    for (const t of TANK_PARTS.tracks) {
      for (let i = 0; i < 6; i++) {
        const ty = TANK_PARTS.trackTop + ((i + tick) / 6) * span;
        ctx.fillRect(left + (t.x + 4) * sx, top + ty * sy, (t.w - 8) * sx, Math.max(1, 2.5 * sy));
      }
    }
  }
  // Brake lights flash on the brake check
  if (blink(time, 4)) {
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = Math.min(20, w * 0.04);
    for (const l of TANK_PARTS.brakeLights) ctx.fillRect(left + l.x * sx, top + l.y * sy, l.w * sx, l.h * sy);
  }
  ctx.restore();
}

/** IRS Air Support, hovering over the road ahead (drawn in screen space). */
function drawHelicopter(ctx: CanvasRenderingContext2D, width: number, height: number, bossX: number, time: number, night: boolean) {
  const img = heliImage();
  if (!img) return;
  // Below the rearview mirror, and a bit off-center so the mirror never hides it.
  const x = width / 2 + width * 0.17 + bossX * width * 0.22;
  const y = height * 0.4 + Math.sin(time * 2.2) * height * 0.015;
  const W = Math.max(150, width * 0.18);
  const H = W / 2;
  const left = x - (HELI_PARTS.anchor.x / 240) * W;
  const top = y - (HELI_PARTS.anchor.y / 120) * H;
  const at = (p: { x: number; y: number }) => [left + (p.x / 240) * W, top + (p.y / 120) * H] as const;
  ctx.save();
  // A slight nose-down tilt, like it's chasing
  ctx.translate(x, y);
  ctx.rotate(-0.06 + Math.sin(time * 1.7) * 0.015);
  ctx.translate(-x, -y);
  if (night) {
    // Searchlight sweeping the road, from under the nose
    const [lx, ly] = at(HELI_PARTS.searchlight);
    const sweep = Math.sin(time * 1.3) * width * 0.12;
    const beam = ctx.createLinearGradient(0, ly, 0, height);
    beam.addColorStop(0, 'rgba(255, 255, 220, 0.4)');
    beam.addColorStop(1, 'rgba(255, 255, 220, 0.04)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx - W * 0.015, ly);
    ctx.lineTo(lx + W * 0.015, ly);
    ctx.lineTo(lx + sweep + width * 0.12, height * 1.2);
    ctx.lineTo(lx + sweep - width * 0.12, height * 1.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.drawImage(img, left, top, W, H);
  // Tail rotor: a spinning blur with one visible blade
  const [tx, ty] = at(HELI_PARTS.tailRotor);
  const tr = W * 0.06;
  ctx.fillStyle = 'rgba(40, 40, 40, 0.22)';
  ctx.beginPath();
  ctx.arc(tx, ty, tr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 20, 20, 0.7)';
  ctx.lineWidth = Math.max(1.5, W * 0.01);
  const ta = time * 45;
  ctx.beginPath();
  ctx.moveTo(tx - Math.cos(ta) * tr, ty - Math.sin(ta) * tr);
  ctx.lineTo(tx + Math.cos(ta) * tr, ty + Math.sin(ta) * tr);
  ctx.stroke();
  // Main rotor: a flat disc seen almost edge-on, with two blades sweeping round
  const [hx, hy] = at(HELI_PARTS.rotorHub);
  const R = W * 0.56;
  ctx.fillStyle = 'rgba(30, 30, 30, 0.16)';
  ctx.beginPath();
  ctx.ellipse(hx, hy, R, R * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 15, 15, 0.8)';
  ctx.lineWidth = Math.max(2, W * 0.014);
  ctx.lineCap = 'round';
  const a = time * 28;
  for (const offset of [0, Math.PI]) {
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a + offset) * R, hy + Math.sin(a + offset) * R * 0.07);
    ctx.stroke();
  }
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(hx, hy, W * 0.03, W * 0.012, 0, 0, Math.PI * 2);
  ctx.fill();
  // Beacon under the belly
  const [bx, by] = at(HELI_PARTS.beacon);
  ctx.fillStyle = blink(time, 5) ? '#ff1744' : '#2979ff';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = W * 0.04;
  ctx.beginPath();
  ctx.arc(bx, by, W * 0.014, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A border gate across the whole road: two posts, a banner, a checkered line. */
function drawBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, index: number, roadHalf: number) {
  ctx.save();
  // Checkered line across the road
  const squares = 16;
  const lineH = Math.max(2, h * 0.03);
  for (let i = 0; i < squares; i++) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = (i + row) % 2 ? '#111' : '#fafafa';
      ctx.fillRect(x - roadHalf + (i * 2 * roadHalf) / squares, y - lineH * (row + 1), (2 * roadHalf) / squares + 1, lineH);
    }
  }
  // Posts
  ctx.fillStyle = '#d4af37';
  const postW = Math.max(2, w * 0.02);
  ctx.fillRect(x - w * 0.48, y - h, postW, h);
  ctx.fillRect(x + w * 0.48 - postW, y - h, postW, h);
  // Banner
  const bannerH = h * 0.2;
  ctx.fillStyle = '#111';
  ctx.fillRect(x - w * 0.48, y - h, w * 0.96, bannerH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeRect(x - w * 0.47, y - h + bannerH * 0.08, w * 0.94, bannerH * 0.84);
  if (w > 60) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f6e27a';
    ctx.font = `bold ${Math.round(bannerH * 0.32)}px 'Courier New', monospace`;
    ctx.fillText('WELCOME TO', x, y - h + bannerH * 0.3, w * 0.9);
    ctx.font = `bold ${Math.round(bannerH * 0.42)}px 'Courier New', monospace`;
    ctx.fillText(borderName(index).toUpperCase(), x, y - h + bannerH * 0.68, w * 0.9);
  }
  ctx.restore();
}

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, x: number, y: number, w: number, h: number, time: number, roadHalf: number) {
  if (isScenery(e.kind)) {
    drawScenery(ctx, e.kind, x, y, w, h, e.variant);
    return;
  }
  switch (e.kind) {
    case 'donuts':
    case 'killdozer':
    case 'smoke':
    case 'wrench':
      if (!e.hit) drawPowerUp(ctx, e.kind, x, y, w, h, time, e.id);
      return;
    case 'spikes':
      drawSpikes(ctx, x, y, w, h);
      return;
    case 'cruiser':
      drawCruiser(ctx, x, y, w, h, time);
      return;
    case 'tank':
      drawTank(ctx, x, y, w, h, time);
      return;
    case 'border':
      drawBorder(ctx, x, y, w, h, e.variant, roadHalf);
      return;
    case 'commie': {
      if (e.hit) return;
      const image = COMMIE_IMAGES[e.variant];
      if (image && imageReady(image)) drawCommiePhoto(ctx, image, x, y, w, h, time, e.id);
      else drawMarx(ctx, x, y, w * 0.6, h * 0.93, time, e.id);
      return;
    }
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
// Night and rain, drawn over the scene
// ---------------------------------------------------------------------------

/** The Fog of Regulation daily: you can only see the road close to you. */
function drawFog(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const fog = ctx.createLinearGradient(0, 0, 0, height);
  fog.addColorStop(0, 'rgba(190, 196, 202, 0.9)');
  fog.addColorStop(0.5, 'rgba(190, 196, 202, 0.97)');
  fog.addColorStop(0.62, 'rgba(190, 196, 202, 0.75)');
  fog.addColorStop(0.85, 'rgba(190, 196, 202, 0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, width, height);
}

function drawWeather(ctx: CanvasRenderingContext2D, width: number, height: number, env: Environment, state: GameState, snowy: number) {
  const dark = (1 - env.daylight) * 0.72 + env.rain * 0.12;
  if (dark > 0.01) {
    // Darkness everywhere except where your headlights reach (bottom center).
    const night = ctx.createRadialGradient(width / 2, height * 1.05, height * 0.12, width / 2, height * 1.05, height * 0.95);
    night.addColorStop(0, `rgba(0, 4, 20, ${dark * 0.1})`);
    night.addColorStop(0.5, `rgba(0, 4, 20, ${dark * 0.7})`);
    night.addColorStop(1, `rgba(0, 4, 20, ${dark})`);
    ctx.fillStyle = night;
    ctx.fillRect(0, 0, width, height);
    // The sides of the road, outside the headlights, stay dark too.
    const sides = ctx.createLinearGradient(0, 0, width, 0);
    sides.addColorStop(0, `rgba(0, 4, 20, ${dark * 0.55})`);
    sides.addColorStop(0.3, 'rgba(0, 4, 20, 0)');
    sides.addColorStop(0.7, 'rgba(0, 4, 20, 0)');
    sides.addColorStop(1, `rgba(0, 4, 20, ${dark * 0.55})`);
    ctx.fillStyle = sides;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);
  }
  if (env.daylight < 0.6) {
    // Headlight cones
    const glow = (0.6 - env.daylight) * 0.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const cone = ctx.createLinearGradient(0, height, 0, height * 0.55);
      cone.addColorStop(0, `rgba(255, 240, 190, ${glow})`);
      cone.addColorStop(1, 'rgba(255, 240, 190, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(width / 2 + side * width * 0.08, height);
      ctx.lineTo(width / 2 + side * width * 0.02, height * 0.55);
      ctx.lineTo(width / 2 + side * width * 0.24, height * 0.55);
      ctx.lineTo(width / 2 + side * width * 0.38, height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // On the snowfield it snows instead (a light flurry even between storms).
  const snow = Math.max(env.rain, 0.3) * snowy;
  if (snow > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * Math.min(1, snow * 1.5)})`;
    const flakes = Math.round(160 * snow);
    for (let i = 0; i < flakes; i++) {
      const fx = ((i * 7919 + Math.sin(state.time * 1.3 + i) * 30 + state.time * 60 * (i % 2 ? 1 : -1)) % (width + 20) + width + 20) % (width + 20) - 10;
      const fy = ((i * 104729 + state.time * (90 + (i % 5) * 25)) % (height + 20)) - 10;
      ctx.fillRect(fx, fy, 2 + (i % 3), 2 + (i % 3));
    }
  }
  const rain = env.rain * (1 - snowy);
  if (rain > 0.01) {
    ctx.fillStyle = `rgba(150, 165, 180, ${rain * 0.12})`;
    ctx.fillRect(0, 0, width, height);
    // Streaks, slanted by your speed
    ctx.strokeStyle = `rgba(210, 225, 240, ${0.45 * rain})`;
    ctx.lineWidth = 1.2;
    const slant = (state.speed / CONFIG.maxSpeed) * 14;
    const drops = Math.round(140 * rain);
    ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const dx = ((i * 7919 + state.time * 900 * (1 + (i % 3))) % (width + 40)) - 20;
      const dy = ((i * 104729 + state.time * 1600) % (height + 40)) - 20;
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - slant, dy + 18);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------

/**
 * Draws one frame. `width`/`height` are in CSS pixels (the context is already
 * scaled for the screen's pixel density). `skyOffset` slides the hills in curves.
 */
export function render(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, skyOffset: number, env: Environment): void {
  const segLen = CONFIG.segmentLength;
  ctx.save();
  if (state.crashLeft > 0 && display.shake) {
    const shake = state.crashLeft * 14;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  // No rain in the desert: the weather there stays clear.
  const playerZ = state.position + PLAYER_Z;
  const view: Environment = { daylight: env.daylight, rain: env.rain * blendNumber(playerZ, (b) => (b.precipitation === 'none' ? 0 : 1)) };
  const snowy = blendNumber(playerZ, (b) => (b.precipitation === 'snow' ? 1 : 0));
  drawBackground(ctx, width, height, skyOffset, view, playerZ);

  const base = segmentIndex(state.position);
  const basePercent = (state.position % segLen) / segLen;
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
    const [ww, wh] = e.kind === 'commie' ? commieSize(e.variant) : SIZE[e.kind];
    const w = scale * ww * (width / 2);
    const h = scale * wh * (width / 2);
    if (w < 2 || sy - h > seg.clip) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, seg.clip);
    ctx.clip();
    drawEntity(ctx, e, sx, sy, w, h, state.time, lerp(seg.p1.w, seg.p2.w, t));
    ctx.restore();
  }

  if (state.boss?.kind === 'helicopter') drawHelicopter(ctx, width, height, state.boss.x, state.time, view.daylight < 0.4);
  if (state.daily === 'fog') drawFog(ctx, width, height);
  drawWeather(ctx, width, height, view, state, snowy);

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
