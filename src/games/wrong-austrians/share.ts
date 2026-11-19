// Sharing a term: a few lines of text with the council as a row of emoji, or a 1200 × 630 card with
// the whole council unmasked.

import type { Ending, Mode } from './council.ts';

export interface ShareAdvisor {
  name: string;
  impostor: boolean;
  fired: boolean;
}

export interface TermSummary {
  mode: Mode;
  won: boolean;
  ending: Ending;
  /** The ending's headline (from sides.ts). */
  headline: string;
  score: number;
  quarter: number;
  /** The meters at the end, with their icons. */
  meters: [string, number][];
  advisors: ShareAdvisor[];
  daily: { key: string; name: string; icon: string } | null;
  url: string;
}

/** One emoji per advisor: loyal and kept, loyal and fired, impostor caught, impostor who got away. */
export function councilEmoji(s: TermSummary): string {
  const loyal = s.mode === 'mirror' ? '🇦🇹' : '🦅';
  return s.advisors.map((a) => (a.impostor ? (a.fired ? '🔥' : '🕵️') : a.fired ? '😬' : loyal)).join('');
}

const when = (q: number) => `Year ${Math.ceil(q / 4)}, Q${((q - 1) % 4) + 1}`;

export function shareText(s: TermSummary): string {
  const title = `${s.mode === 'mirror' ? '🇦🇹' : '🦅'} I THOUGHT I HIRED AUSTRIAN ECONOMISTS${s.mode === 'mirror' ? ' · 🪞 Mirror mode' : ''}`;
  const caught = s.advisors.filter((a) => a.impostor && a.fired).length;
  const impostors = s.advisors.filter((a) => a.impostor).length;
  return [
    s.daily ? `${title} · 📅 Daily ${s.daily.key} (${s.daily.icon} ${s.daily.name})` : title,
    `${s.headline} · ${when(s.quarter)}`,
    `🏆 ${s.score} points · ${s.meters.map(([icon, v]) => `${icon} ${v}`).join(' · ')}`,
    `${councilEmoji(s)} (${caught}/${impostors} impostors caught)`,
    s.url,
  ].join('\n');
}

export const CARD_W = 1200;
export const CARD_H = 630;

/** Draws the card. `balls` are the advisors drawn as images (unmasked), in order; any can be null. */
export function drawShareCard(ctx: CanvasRenderingContext2D, s: TermSummary, balls: (HTMLImageElement | null)[]) {
  const W = CARD_W;
  const H = CARD_H;
  ctx.fillStyle = '#f1ece0';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let x = 7; x < W; x += 14) for (let y = 7; y < H; y += 14) ctx.fillRect(x, y, 1.6, 1.6);
  // The comic panel.
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(28, 28, W - 56, H - 56);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#111';
  ctx.strokeRect(28, 28, W - 56, H - 56);

  const head = (size: number) => `900 ${size}px 'Roboto Condensed', 'Arial Narrow', sans-serif`;
  const body = (size: number, weight = 500) => `${weight} ${size}px Roboto, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111';
  ctx.font = head(44);
  ctx.fillText('I THOUGHT I HIRED AUSTRIAN ECONOMISTS', W / 2, 92, W - 120);
  const tag = s.daily ? `📅 DAILY ${s.daily.key} · ${s.daily.icon} ${s.daily.name.toUpperCase()}` : s.mode === 'mirror' ? '🪞 MIRROR MODE: PLAYING AS AUSTRIA' : '';
  if (tag) {
    ctx.font = head(24);
    ctx.fillStyle = '#5d5a52';
    ctx.fillText(tag, W / 2, 128, W - 120);
  }
  ctx.font = head(54);
  ctx.fillStyle = s.won ? '#1f8a4c' : '#ef2b2d';
  ctx.fillText(s.headline, W / 2, tag ? 196 : 180, W - 120);
  ctx.font = body(28, 700);
  ctx.fillStyle = '#111';
  ctx.fillText(`🏆 ${s.score} points  ·  ${s.meters.map(([icon, v]) => `${icon} ${v}`).join('  ·  ')}  ·  ${when(s.quarter)}`, W / 2, tag ? 246 : 232, W - 120);

  // The council, unmasked.
  const n = s.advisors.length;
  const slot = (W - 120) / n;
  const size = Math.min(150, slot - 20);
  const top = 280;
  s.advisors.forEach((a, i) => {
    const cx = 60 + slot * i + slot / 2;
    const img = balls[i];
    if (img) ctx.drawImage(img, cx - size / 2, top, size, size * 1.24);
    ctx.fillStyle = '#111';
    ctx.font = head(22);
    ctx.fillText(a.name, cx, top + size * 1.24 + 26, slot - 10);
    const role = a.impostor ? (s.mode === 'mirror' ? '🦅 Austrian School' : '🇦🇹 From Vienna') : s.mode === 'mirror' ? '🇦🇹 Viennese' : '🦅 Austrian School';
    ctx.font = body(18, 700);
    ctx.fillStyle = a.impostor ? '#ef2b2d' : '#1f8a4c';
    ctx.fillText(role, cx, top + size * 1.24 + 52, slot - 10);
    ctx.font = body(17);
    ctx.fillStyle = '#5d5a52';
    ctx.fillText(a.fired ? (a.impostor ? '🔥 Fired, rightly' : '😬 Fired, wrongly') : a.impostor ? '🕵️ Got away' : 'Stayed', cx, top + size * 1.24 + 76, slot - 10);
  });
  ctx.font = body(18);
  ctx.fillStyle = '#5d5a52';
  ctx.fillText(s.url.replace(/^https?:\/\//, ''), W / 2, H - 44, W - 120);
}
