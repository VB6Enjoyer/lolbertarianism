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
  }
  ctx.restore();
}
