// Roadside scenery: billboards and buildings, drawn with canvas shapes.
// (x, y) is the middle of the base; w/h are the size on screen. `variant` picks
// colors and text.

import type { Scenery } from './logic.ts';

/** Sizes in world units (width, height). */
export const SCENERY_SIZE: Record<Scenery, [number, number]> = {
  billboard: [2200, 1950],
  house: [1800, 1500],
  bar: [2300, 1400],
  'gas-station': [2700, 1300],
  diner: [2400, 1200],
  barn: [1900, 1700],
  cactus: [520, 1100],
  skull: [700, 380],
  rock: [1300, 760],
  palm: [1000, 1900],
  'surf-shack': [2000, 1300],
  lifeguard: [1000, 1600],
  pine: [900, 1800],
  'snowy-pine': [900, 1800],
  snowman: [620, 920],
  'ski-lodge': [2500, 1700],
  cabin: [1800, 1300],
};

/** [headline, small print, background, text color]. */
export const BILLBOARDS: readonly [string, string, string, string][] = [
  ['END THE FED', 'Ron Paul was right', '#b71c1c', '#ffffff'],
  ['WHO WILL BUILD THE ROADS?', 'We did. Toll: voluntary.', '#1a237e', '#ffffff'],
  ['TAXATION IS THEFT', 'Pass it on', '#111111', '#f7d02c'],
  ['YOUR AD HERE', 'No permit required', '#ffffff', '#111111'],
  ['MISES INSTITUTE', 'Next exit · Auburn, AL', '#0d47a1', '#ffffff'],
  ['VOTE FOR NOBODY', 'Nobody keeps promises', '#4a148c', '#ffffff'],
  ['BITCOIN ACCEPTED', 'Fiat politely declined', '#f7931a', '#111111'],
  ['LIBERTY FM 101.1', 'All Rothbard, all the time', '#1b5e20', '#ffffff'],
  ["DON'T TREAD ON ME", 'Snakes have property rights too', '#f7d02c', '#111111'],
  ['HUMAN ACTION', 'Now with 50% more action', '#3e2723', '#ffe082'],
  ['ABOLISH THE IRS', 'Honk if you agree', '#263238', '#ffffff'],
  ['RAW MILK AHEAD', "Don't tell the FDA", '#fafafa', '#1565c0'],
];

const BAR_NAMES = ['LAISSEZ-FAIRE SALOON', 'THE NAP ROOM', 'NO FDA BAR & GRILL', "GALT'S TAVERN"];
const DINER_NAMES = ['BROKEN WINDOW DINER', "BASTIAT'S DINER", 'SPONTANEOUS ORDER CAFE'];
const HOUSE_COLORS = ['#e8d5b7', '#b3c7d6', '#d7ccc8', '#c5e1a5'];

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, maxWidth: number) {
  if (size < 5) return;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y, maxWidth);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.55, w * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
}

function billboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  const [head, small, bg, fg] = BILLBOARDS[variant % BILLBOARDS.length];
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(x - w * 0.32, y - h * 0.5, w * 0.04, h * 0.5);
  ctx.fillRect(x + w * 0.28, y - h * 0.5, w * 0.04, h * 0.5);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x - w * 0.5, y - h, w, h * 0.52);
  ctx.fillStyle = bg;
  ctx.fillRect(x - w * 0.48, y - h * 0.98, w * 0.96, h * 0.48);
  text(ctx, head, x, y - h * 0.8, h * 0.12, fg, w * 0.9);
  text(ctx, small, x, y - h * 0.62, h * 0.07, fg, w * 0.9);
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = HOUSE_COLORS[variant % HOUSE_COLORS.length];
  ctx.fillRect(x - w * 0.42, y - h * 0.55, w * 0.84, h * 0.55);
  ctx.fillStyle = '#8d3b2f';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.55);
  ctx.lineTo(x, y - h * 0.95);
  ctx.lineTo(x + w * 0.5, y - h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + w * 0.2, y - h * 0.92, w * 0.08, h * 0.2); // chimney
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(x - w * 0.07, y - h * 0.32, w * 0.14, h * 0.32);
  ctx.fillStyle = '#90caf9';
  ctx.fillRect(x - w * 0.34, y - h * 0.42, w * 0.18, h * 0.16);
  ctx.fillRect(x + w * 0.16, y - h * 0.42, w * 0.18, h * 0.16);
  // A Gadsden flag out front, sometimes
  if (variant % 3 === 0) {
    ctx.fillStyle = '#777';
    ctx.fillRect(x + w * 0.46, y - h * 0.75, w * 0.015, h * 0.75);
    ctx.fillStyle = '#f7d02c';
    ctx.fillRect(x + w * 0.475, y - h * 0.75, w * 0.16, h * 0.12);
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(x - w * 0.45, y - h * 0.62, w * 0.9, h * 0.62);
  // False front, like an old saloon
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(x - w * 0.5, y - h * 0.95, w, h * 0.36);
  ctx.fillStyle = '#212121';
  ctx.fillRect(x - w * 0.42, y - h * 0.9, w * 0.84, h * 0.24);
  // Neon sign
  const neon = variant % 2 ? '#ff4081' : '#18ffff';
  ctx.shadowColor = neon;
  ctx.shadowBlur = Math.min(12, w * 0.02);
  text(ctx, BAR_NAMES[variant % BAR_NAMES.length], x, y - h * 0.78, h * 0.12, neon, w * 0.8);
  ctx.shadowBlur = 0;
  // Swinging doors and windows
  ctx.fillStyle = '#3e2723';
  ctx.fillRect(x - w * 0.08, y - h * 0.34, w * 0.16, h * 0.3);
  ctx.fillStyle = '#ffcc80';
  ctx.fillRect(x - w * 0.36, y - h * 0.46, w * 0.18, h * 0.18);
  ctx.fillRect(x + w * 0.18, y - h * 0.46, w * 0.18, h * 0.18);
}

function gasStation(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  // Canopy on two pillars
  ctx.fillStyle = '#cfd8dc';
  ctx.fillRect(x - w * 0.4, y - h * 0.7, w * 0.03, h * 0.7);
  ctx.fillRect(x + w * 0.37, y - h * 0.7, w * 0.03, h * 0.7);
  ctx.fillStyle = '#c62828';
  ctx.fillRect(x - w * 0.5, y - h * 0.84, w, h * 0.16);
  text(ctx, 'FREE MARKET FUEL', x, y - h * 0.76, h * 0.1, '#ffffff', w * 0.9);
  // Pumps
  for (const px of [-0.18, 0.12]) {
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(x + w * px, y - h * 0.3, w * 0.07, h * 0.3);
    ctx.fillStyle = '#c62828';
    ctx.fillRect(x + w * px, y - h * 0.3, w * 0.07, h * 0.06);
  }
  // Price sign
  ctx.fillStyle = '#263238';
  ctx.fillRect(x - w * 0.5, y - h, w * 0.2, h * 0.14);
  text(ctx, variant % 2 ? '1 oz/barrel' : '$1.99 (gold)', x - w * 0.4, y - h * 0.93, h * 0.06, '#ffeb3b', w * 0.19);
}

function diner(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = '#b0bec5';
  ctx.beginPath();
  ctx.roundRect(x - w * 0.48, y - h * 0.6, w * 0.96, h * 0.6, h * 0.12);
  ctx.fill();
  ctx.fillStyle = '#d32f2f';
  ctx.fillRect(x - w * 0.48, y - h * 0.2, w * 0.96, h * 0.06);
  ctx.fillStyle = '#e1f5fe';
  for (let i = 0; i < 6; i++) ctx.fillRect(x - w * 0.42 + i * w * 0.145, y - h * 0.5, w * 0.11, h * 0.22);
  ctx.fillStyle = '#ffeb3b';
  ctx.fillRect(x - w * 0.3, y - h * 0.95, w * 0.6, h * 0.24);
  text(ctx, DINER_NAMES[variant % DINER_NAMES.length], x, y - h * 0.83, h * 0.11, '#b71c1c', w * 0.56);
}

function barn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = '#b71c1c';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.45, y);
  ctx.lineTo(x - w * 0.45, y - h * 0.55);
  ctx.lineTo(x - w * 0.25, y - h * 0.85);
  ctx.lineTo(x + w * 0.25, y - h * 0.85);
  ctx.lineTo(x + w * 0.45, y - h * 0.55);
  ctx.lineTo(x + w * 0.45, y);
  ctx.closePath();
  ctx.fill();
  // White trim and the X doors
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.strokeRect(x - w * 0.16, y - h * 0.42, w * 0.32, h * 0.42);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.16, y - h * 0.42);
  ctx.lineTo(x + w * 0.16, y);
  ctx.moveTo(x + w * 0.16, y - h * 0.42);
  ctx.lineTo(x - w * 0.16, y);
  ctx.stroke();
  if (variant % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w * 0.3, y - h * 0.68, w * 0.6, h * 0.12);
    text(ctx, 'RAW MILK · UNPASTEURIZED', x, y - h * 0.62, h * 0.06, '#1565c0', w * 0.58);
  }
}

// --- Desert ---

function cactus(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w * 0.8);
  ctx.fillStyle = variant % 2 ? '#2e7d32' : '#388e3c';
  const trunk = w * 0.26;
  ctx.beginPath();
  ctx.roundRect(x - trunk / 2, y - h, trunk, h, trunk / 2);
  ctx.fill();
  // Arms: one up on each side, at different heights
  const arm = (side: number, at: number, up: number) => {
    ctx.beginPath();
    ctx.roundRect(side > 0 ? x : x - w * 0.42, y - h * at - trunk * 0.4, w * 0.42, trunk * 0.8, trunk / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + side * w * 0.42 - (side > 0 ? trunk * 0.8 : 0), y - h * (at + up), trunk * 0.8, h * up, trunk / 2);
    ctx.fill();
  };
  arm(-1, 0.45, 0.3);
  if (variant % 3 !== 0) arm(1, 0.6, 0.25);
}

function skull(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  shadow(ctx, x, y, w * 0.7);
  ctx.fillStyle = '#f5efe0';
  // Horns
  ctx.beginPath();
  ctx.moveTo(x - w * 0.15, y - h * 0.7);
  ctx.quadraticCurveTo(x - w * 0.5, y - h * 0.75, x - w * 0.5, y - h);
  ctx.quadraticCurveTo(x - w * 0.35, y - h * 0.8, x - w * 0.12, y - h * 0.55);
  ctx.moveTo(x + w * 0.15, y - h * 0.7);
  ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.75, x + w * 0.5, y - h);
  ctx.quadraticCurveTo(x + w * 0.35, y - h * 0.8, x + w * 0.12, y - h * 0.55);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.4, w * 0.18, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3e2723';
  ctx.beginPath();
  ctx.arc(x - w * 0.07, y - h * 0.55, w * 0.04, 0, Math.PI * 2);
  ctx.arc(x + w * 0.07, y - h * 0.55, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function rock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = variant % 2 ? '#8d8d8d' : '#a1887f';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.lineTo(x - w * 0.38, y - h * 0.6);
  ctx.lineTo(x - w * 0.1, y - h);
  ctx.lineTo(x + w * 0.25, y - h * 0.82);
  ctx.lineTo(x + w * 0.48, y - h * 0.35);
  ctx.lineTo(x + w * 0.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.38, y - h * 0.6);
  ctx.lineTo(x - w * 0.1, y - h);
  ctx.lineTo(x, y - h * 0.5);
  ctx.closePath();
  ctx.fill();
}

// --- Beach ---

function palm(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w * 0.6);
  const lean = (variant % 2 ? 1 : -1) * w * 0.25;
  ctx.strokeStyle = '#8d6e63';
  ctx.lineWidth = Math.max(2, w * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.2, y - h * 0.5, x + lean, y - h * 0.82);
  ctx.stroke();
  // Fronds
  ctx.fillStyle = '#2e7d32';
  const topX = x + lean;
  const topY = y - h * 0.82;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(angle) * w * 0.4, topY - h * 0.12 + Math.sin(angle) * h * 0.04, topX + Math.cos(angle) * w * 0.55, topY + h * 0.1);
    ctx.quadraticCurveTo(topX + Math.cos(angle) * w * 0.3, topY - h * 0.02, topX, topY);
    ctx.fill();
  }
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath();
  ctx.arc(topX - w * 0.05, topY + h * 0.03, w * 0.05, 0, Math.PI * 2);
  ctx.arc(topX + w * 0.05, topY + h * 0.03, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function surfShack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = '#ffcc80';
  ctx.fillRect(x - w * 0.4, y - h * 0.6, w * 0.8, h * 0.6);
  // Thatched roof
  ctx.fillStyle = '#c8a165';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.58);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w * 0.5, y - h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(x - w * 0.3, y - h * 0.5, w * 0.6, h * 0.16);
  text(ctx, variant % 2 ? 'SURF · NO LICENSE' : 'TIKI BAR · NO FDA', x, y - h * 0.42, h * 0.08, '#0d47a1', w * 0.58);
  // Surfboards leaning on it
  for (const [dx, color] of [[-0.46, '#e53935'], [0.42, '#fdd835']] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + w * dx, y - h * 0.32, w * 0.05, h * 0.32, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lifeguard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  shadow(ctx, x, y, w);
  ctx.strokeStyle = '#eceff1';
  ctx.lineWidth = Math.max(1, w * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.35, y);
  ctx.lineTo(x - w * 0.25, y - h * 0.55);
  ctx.moveTo(x + w * 0.35, y);
  ctx.lineTo(x + w * 0.25, y - h * 0.55);
  ctx.stroke();
  ctx.fillStyle = '#e53935';
  ctx.fillRect(x - w * 0.35, y - h * 0.82, w * 0.7, h * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.45, y - h * 0.82);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w * 0.45, y - h * 0.82);
  ctx.closePath();
  ctx.fill();
  text(ctx, 'PRIVATE', x, y - h * 0.67, h * 0.07, '#ffffff', w * 0.6);
}

// --- Snow and mountains ---

function pineTree(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number, snowy: boolean) {
  shadow(ctx, x, y, w * 0.7);
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(x - w * 0.06, y - h * 0.18, w * 0.12, h * 0.18);
  const green = variant % 2 ? '#1b5e20' : '#2e7d32';
  for (let tier = 0; tier < 3; tier++) {
    const bottom = y - h * (0.12 + tier * 0.26);
    const width = w * (0.5 - tier * 0.12);
    const top = bottom - h * 0.42;
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.moveTo(x - width, bottom);
    ctx.lineTo(x, top);
    ctx.lineTo(x + width, bottom);
    ctx.closePath();
    ctx.fill();
    if (snowy) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x - width * 0.45, top + (bottom - top) * 0.45);
      ctx.lineTo(x, top);
      ctx.lineTo(x + width * 0.45, top + (bottom - top) * 0.45);
      ctx.quadraticCurveTo(x, top + (bottom - top) * 0.6, x - width * 0.45, top + (bottom - top) * 0.45);
      ctx.fill();
    }
  }
}

function snowman(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w * 0.8);
  ctx.fillStyle = '#fafafa';
  for (const [cy, r] of [[0.22, 0.4], [0.55, 0.3], [0.8, 0.21]] as const) {
    ctx.beginPath();
    ctx.arc(x, y - h * cy, w * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#212121';
  ctx.fillRect(x - w * 0.2, y - h * 0.98, w * 0.4, h * 0.06); // hat brim
  ctx.fillRect(x - w * 0.13, y - h * 1.12, w * 0.26, h * 0.16);
  ctx.fillStyle = '#ff6d00';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.8);
  ctx.lineTo(x + w * 0.22, y - h * 0.78);
  ctx.lineTo(x, y - h * 0.76);
  ctx.fill();
  // A little Gadsden scarf on some of them
  ctx.fillStyle = variant % 2 ? '#f7d02c' : '#c62828';
  ctx.fillRect(x - w * 0.22, y - h * 0.69, w * 0.44, h * 0.05);
}

function skiLodge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = '#795548';
  ctx.fillRect(x - w * 0.42, y - h * 0.55, w * 0.84, h * 0.55);
  ctx.fillStyle = '#4e342e';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.52);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w * 0.5, y - h * 0.52);
  ctx.closePath();
  ctx.fill();
  // Snow on the roof
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.52);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w * 0.5, y - h * 0.52);
  ctx.lineTo(x + w * 0.42, y - h * 0.58);
  ctx.lineTo(x, y - h * 0.9);
  ctx.lineTo(x - w * 0.42, y - h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe082';
  ctx.fillRect(x - w * 0.3, y - h * 0.42, w * 0.16, h * 0.16);
  ctx.fillRect(x + w * 0.14, y - h * 0.42, w * 0.16, h * 0.16);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - w * 0.25, y - h * 0.7, w * 0.5, h * 0.1);
  text(ctx, variant % 2 ? 'LODGE · NO PERMITS' : 'HAYEK SKI RESORT', x, y - h * 0.65, h * 0.065, '#4e342e', w * 0.48);
}

function cabin(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number) {
  shadow(ctx, x, y, w);
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(x - w * 0.4, y - h * 0.55, w * 0.8, h * 0.55);
  // Log lines
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = Math.max(1, h * 0.02);
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.4, y - h * 0.11 * i);
    ctx.lineTo(x + w * 0.4, y - h * 0.11 * i);
    ctx.stroke();
  }
  ctx.fillStyle = '#3e2723';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.52);
  ctx.lineTo(x, y - h * 0.95);
  ctx.lineTo(x + w * 0.5, y - h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe082';
  ctx.fillRect(x - w * 0.08, y - h * 0.32, w * 0.16, h * 0.32);
  // Gadsden flag for the off-grid homesteader
  if (variant % 2 === 0) {
    ctx.fillStyle = '#777';
    ctx.fillRect(x + w * 0.45, y - h * 0.8, w * 0.015, h * 0.8);
    ctx.fillStyle = '#f7d02c';
    ctx.fillRect(x + w * 0.465, y - h * 0.8, w * 0.16, h * 0.12);
  }
}

export function drawScenery(ctx: CanvasRenderingContext2D, kind: Scenery, x: number, y: number, w: number, h: number, variant: number) {
  ctx.save();
  switch (kind) {
    case 'billboard':
      billboard(ctx, x, y, w, h, variant);
      break;
    case 'house':
      house(ctx, x, y, w, h, variant);
      break;
    case 'bar':
      bar(ctx, x, y, w, h, variant);
      break;
    case 'gas-station':
      gasStation(ctx, x, y, w, h, variant);
      break;
    case 'diner':
      diner(ctx, x, y, w, h, variant);
      break;
    case 'barn':
      barn(ctx, x, y, w, h, variant);
      break;
    case 'cactus':
      cactus(ctx, x, y, w, h, variant);
      break;
    case 'skull':
      skull(ctx, x, y, w, h);
      break;
    case 'rock':
      rock(ctx, x, y, w, h, variant);
      break;
    case 'palm':
      palm(ctx, x, y, w, h, variant);
      break;
    case 'surf-shack':
      surfShack(ctx, x, y, w, h, variant);
      break;
    case 'lifeguard':
      lifeguard(ctx, x, y, w, h);
      break;
    case 'pine':
      pineTree(ctx, x, y, w, h, variant, false);
      break;
    case 'snowy-pine':
      pineTree(ctx, x, y, w, h, variant, true);
      break;
    case 'snowman':
      snowman(ctx, x, y, w, h, variant);
      break;
    case 'ski-lodge':
      skiLodge(ctx, x, y, w, h, variant);
      break;
    case 'cabin':
      cabin(ctx, x, y, w, h, variant);
      break;
  }
  ctx.restore();
}
