// Sharing a run: a few lines of text, or a 1200 × 630 card with Friedman's laser eyes on it.

export interface RunSummary {
  won: boolean;
  score: number;
  act: number;
  floor: number;
  fights: number;
  damage: number;
  lasers: number;
  deck: number;
  /** The Late Stage (1 = the plain run). */
  stage: number;
  /** Who played, and how the secret boss went (the other Friedman's name if beaten). */
  character: string;
  beatSecret: string | null;
  daily: { key: string; name: string; icon: string } | null;
  url: string;
}

const headline = (s: RunSummary) => (s.won ? 'Late Stage Capitalism: cancelled. Again. 😈' : `Ratio’d in Act ${s.act}, floor ${s.floor} 😔`);

export function shareText(s: RunSummary): string {
  return [
    s.daily ? `😈 JUST GETTING STARTED · ${s.daily.icon} Daily ${s.daily.key} (${s.daily.name})` : `😈 JUST GETTING STARTED${s.stage > 1 ? ` · Late Stage ${s.stage}` : ''}`,
    headline(s) + (s.beatSecret ? ` And out-argued ${s.beatSecret}. 🤝` : ''),
    s.character !== 'Milton' ? `Played as ${s.character} Friedman` : '',
    `🏆 ${s.score} points · 🎙️ ${s.fights} arguments won · 🔴 ${s.lasers} laser blasts`,
    s.url,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Friedman's pupils on mfriedman.webp (fractions of its width and height), and the tilt of the line between them. */
export const EYES: readonly [number, number][] = [
  [0.273, 0.454],
  [0.613, 0.429],
];
export const EYE_TILT = (-5 * Math.PI) / 180;

export const CARD_W = 1200;
export const CARD_H = 630;

/** Draws the card; `face` is Friedman's photo (null if it didn't load). */
export function drawShareCard(ctx: CanvasRenderingContext2D, s: RunSummary, face: HTMLImageElement | null) {
  const W = CARD_W;
  const H = CARD_H;
  const bg = ctx.createRadialGradient(W * 0.28, H * 0.55, 40, W * 0.28, H * 0.55, W * 0.8);
  bg.addColorStop(0, '#3a0a05');
  bg.addColorStop(0.6, '#0e0303');
  bg.addColorStop(1, '#000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Friedman, deep-fried, with the laser streak through his glasses.
  if (face) {
    const fw = 360;
    const fh = (fw * face.naturalHeight) / face.naturalWidth || 430;
    const fx = 70;
    const fy = (H - fh) / 2 + 20;
    ctx.save();
    ctx.filter = 'grayscale(1) sepia(1) saturate(6) hue-rotate(-38deg) contrast(1.5)';
    ctx.drawImage(face, fx, fy, fw, fh);
    ctx.restore();
    // His pupils, measured on the photo (the same spots the game uses); the beams tilt with his head.
    for (const [px, py] of EYES) {
      const ex = fx + fw * px;
      const ey = fy + fh * py;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(EYE_TILT);
      const beam = ctx.createLinearGradient(-260, 0, 260, 0);
      beam.addColorStop(0, 'rgba(255,0,0,0)');
      beam.addColorStop(0.42, '#ff2a1a');
      beam.addColorStop(0.5, '#ffffff');
      beam.addColorStop(0.58, '#ff2a1a');
      beam.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(-260, -3, 520, 6);
      ctx.restore();
      const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 22);
      glow.addColorStop(0, '#fff');
      glow.addColorStop(0.35, '#ff3b2a');
      glow.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(ex - 22, ey - 22, 44, 44);
    }
  }

  // The words, meme-style: white with a black outline.
  const meme = (text: string, x: number, y: number, size: number, color = '#fff', maxWidth = W - x - 50) => {
    ctx.font = `${size}px Anton, Impact, 'Arial Narrow', sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size / 8;
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, x, y, maxWidth);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y, maxWidth);
  };
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const x = 500;
  meme('JUST GETTING STARTED', x, 110, 58);
  if (s.daily) meme(`${s.daily.icon} DAILY ${s.daily.key} · ${s.daily.name.toUpperCase()}`, x, 160, 28, '#f6c94a');
  else if (s.stage > 1) meme(`LATE STAGE ${s.stage}`, x, 160, 28, '#f6c94a');
  const tagged = !!s.daily || s.stage > 1;
  meme(s.won ? 'LATE STAGE CAPITALISM: CANCELLED' : `RATIO’D IN ACT ${s.act}, FLOOR ${s.floor}`, x, tagged ? 230 : 200, 40, s.won ? '#46d17a' : '#ff2a1a');
  meme(`${s.score} POINTS`, x, tagged ? 310 : 285, 64, '#f6c94a');
  if (s.beatSecret) meme(`🤝 + OUT-ARGUED ${s.beatSecret.toUpperCase()}`, x + 380, tagged ? 310 : 285, 24, '#46d17a', 300);
  const rows: [string, string][] = [
    ['🎙️ Arguments won', String(s.fights)],
    ['💥 Credibility knocked off', String(s.damage)],
    ['🔴 Laser blasts', String(s.lasers)],
    ['🃏 Cards in the deck', String(s.deck)],
  ];
  ctx.font = "26px Oswald, 'Arial Narrow', sans-serif";
  rows.forEach(([label, value], i) => {
    const y = (tagged ? 370 : 350) + i * 44;
    ctx.fillStyle = '#b8a9a2';
    ctx.fillText(label, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(value, x + 400, y);
  });
  ctx.fillStyle = '#8a7a74';
  ctx.font = "20px Oswald, 'Arial Narrow', sans-serif";
  ctx.fillText(s.url.replace(/^https?:\/\//, ''), x, H - 34, W - x - 40);
}
